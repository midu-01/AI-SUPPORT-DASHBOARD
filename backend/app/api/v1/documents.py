import uuid
from pathlib import Path

import anyio
from fastapi import APIRouter, Depends, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.deps import get_current_user, get_db
from app.core.errors import HTTP_413_TOO_LARGE, AppError, error_docs
from app.models.user import User
from app.repositories.document_repository import DocumentRepository
from app.schemas.document import DocumentRead

router = APIRouter()

# The stored extension is chosen from this map, never taken from the uploaded
# filename, so a name like "../../.ssh/authorized_keys" cannot influence the path.
EXTENSION_BY_MIME = {
    "application/pdf": ".pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
    "text/plain": ".txt",
}

CHUNK_SIZE = 1024 * 1024  # 1 MiB


@router.post(
    "",
    response_model=DocumentRead,
    status_code=status.HTTP_201_CREATED,
    summary="Upload a document (metadata only)",
    description=(
        "Accepts `multipart/form-data`. Allowed types: PDF, DOCX, TXT. The size "
        "limit is enforced while streaming, so an oversized upload is rejected "
        "without being held in memory. The stored filename is generated "
        "server-side; the client's filename is kept only as metadata."
    ),
    responses=error_docs(
        (400, "FILE_TYPE_NOT_ALLOWED", "File type is not PDF, DOCX, or TXT"),
        (413, "FILE_TOO_LARGE", "File exceeds the 10 MB size limit"),
    ),
)
async def upload_document(
    file: UploadFile,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # content_type and filename are both optional in the multipart spec, so a
    # crafted request can leave either unset — reject before dereferencing them.
    if not file.filename:
        raise AppError(
            status_code=status.HTTP_400_BAD_REQUEST,
            code="FILENAME_REQUIRED",
            detail="The uploaded file must have a filename.",
        )

    extension = EXTENSION_BY_MIME.get(file.content_type or "")
    if extension is None:
        raise AppError(
            status_code=status.HTTP_400_BAD_REQUEST,
            code="FILE_TYPE_NOT_ALLOWED",
            detail=(
                f"File type '{file.content_type or 'unknown'}' is not allowed. "
                "Allowed: PDF, DOCX, TXT"
            ),
        )

    upload_dir = settings.upload_path
    upload_dir.mkdir(parents=True, exist_ok=True)

    # A fresh UUID plus a known-safe extension: the client's filename never
    # reaches the filesystem, it is only recorded as metadata.
    stored_filename = f"{uuid.uuid4()}{extension}"
    storage_path = upload_dir / stored_filename

    # Stream to disk, enforcing the limit as the bytes arrive. Reading the whole
    # upload first would mean a 2 GB request costs 2 GB of memory before the
    # 413 is raised.
    size_bytes = 0
    try:
        async with await anyio.open_file(storage_path, "wb") as out:
            while chunk := await file.read(CHUNK_SIZE):
                size_bytes += len(chunk)
                if size_bytes > settings.MAX_UPLOAD_SIZE_BYTES:
                    raise AppError(
                        status_code=HTTP_413_TOO_LARGE,
                        code="FILE_TOO_LARGE",
                        detail=(
                            "File exceeds the "
                            f"{settings.MAX_UPLOAD_SIZE_BYTES // (1024 * 1024)} MB "
                            "size limit"
                        ),
                    )
                await out.write(chunk)
    except Exception:
        # Never leave a partial or oversized file behind.
        storage_path.unlink(missing_ok=True)
        raise

    if size_bytes == 0:
        storage_path.unlink(missing_ok=True)
        raise AppError(
            status_code=status.HTTP_400_BAD_REQUEST,
            code="FILE_EMPTY",
            detail="The uploaded file is empty.",
        )

    repo = DocumentRepository(db)
    return await repo.create(
        user_id=current_user.id,
        filename=stored_filename,
        original_filename=file.filename,
        mime_type=file.content_type,
        size_bytes=size_bytes,
        storage_path=str(storage_path),
    )


@router.get(
    "",
    response_model=list[DocumentRead],
    summary="List all documents for the current user",
)
async def list_documents(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    repo = DocumentRepository(db)
    return await repo.list_by_user(current_user.id)


@router.delete(
    "/{document_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a document",
    responses=error_docs(
        (
            404,
            "DOCUMENT_NOT_FOUND",
            "Document does not exist, or belongs to another user",
        )
    ),
)
async def delete_document(
    document_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    repo = DocumentRepository(db)
    document = await repo.get_by_id(document_id)
    if document is None or document.user_id != current_user.id:
        # 404 rather than 403, for the same reason as conversations.
        raise AppError(
            status_code=status.HTTP_404_NOT_FOUND,
            code="DOCUMENT_NOT_FOUND",
            detail="Document not found",
        )

    # Delete the row first: an orphaned file on disk is a cleanup job, whereas a
    # row pointing at a file that no longer exists is a broken download.
    await repo.delete(document)

    stored = Path(document.storage_path)
    if stored.is_relative_to(settings.upload_path):
        stored.unlink(missing_ok=True)

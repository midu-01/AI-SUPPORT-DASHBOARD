from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.document import Document, DocumentStatus


class DocumentRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_by_id(self, document_id: str) -> Document | None:
        result = await self.db.execute(
            select(Document).where(Document.id == document_id)
        )
        return result.scalar_one_or_none()

    async def list_by_user(self, user_id: str, org_id: str) -> list[Document]:
        # Both filters required: user_id scopes to the owner, org_id scopes to
        # the active organisation.  The composite index ix_documents_org_user
        # (org_id, user_id) covers this query exactly.
        result = await self.db.execute(
            select(Document)
            .where(
                Document.user_id == user_id,
                Document.org_id == org_id,
            )
            .order_by(Document.uploaded_at.desc())
        )
        return result.scalars().all()

    async def create(
        self,
        user_id: str,
        org_id: str,
        filename: str,
        original_filename: str,
        mime_type: str,
        size_bytes: int,
        storage_path: str,
    ) -> Document:
        document = Document(
            user_id=user_id,
            org_id=org_id,
            filename=filename,
            original_filename=original_filename,
            mime_type=mime_type,
            size_bytes=size_bytes,
            storage_path=storage_path,
            status=DocumentStatus.uploaded,
        )
        self.db.add(document)
        await self.db.commit()
        await self.db.refresh(document)
        return document

    async def delete(self, document: Document) -> None:
        await self.db.delete(document)
        await self.db.commit()

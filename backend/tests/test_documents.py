from pathlib import Path

import pytest_asyncio
from httpx import AsyncClient

from app.core.config import settings

DOCUMENTS = "/api/v1/documents"
PDF = "application/pdf"
TXT = "text/plain"


@pytest_asyncio.fixture
async def auth_client(client: AsyncClient) -> AsyncClient:
    await client.post(
        "/api/v1/auth/register",
        json={
            "email": "docs@example.com",
            "password": "password123",
            "full_name": "Docs",
        },
    )
    await client.post(
        "/api/v1/auth/login",
        json={"email": "docs@example.com", "password": "password123"},
    )
    return client


async def test_upload_stores_metadata_and_a_file(auth_client: AsyncClient):
    response = await auth_client.post(
        DOCUMENTS, files={"file": ("notes.txt", b"hello world", TXT)}
    )
    assert response.status_code == 201
    body = response.json()

    assert body["original_filename"] == "notes.txt"
    assert body["mime_type"] == TXT
    assert body["size_bytes"] == len(b"hello world")
    # Every upload starts in `uploaded` — the hook a future indexing pipeline drives.
    assert body["status"] == "uploaded"

    stored = Path(body["storage_path"])
    assert stored.exists()
    assert stored.read_bytes() == b"hello world"
    stored.unlink(missing_ok=True)


async def test_stored_filename_never_uses_the_uploaded_name(auth_client: AsyncClient):
    """A traversal attempt must not escape the upload directory."""
    hostile = "../../../../etc/authorized_keys"
    response = await auth_client.post(
        DOCUMENTS, files={"file": (hostile, b"payload", TXT)}
    )
    assert response.status_code == 201
    body = response.json()

    stored = Path(body["storage_path"]).resolve()
    # The file landed inside the upload directory, whatever the client asked for.
    assert stored.is_relative_to(settings.upload_path.resolve())
    assert ".." not in body["filename"]
    assert "/" not in body["filename"]
    assert body["filename"].endswith(".txt")
    # The original name is kept, but only as metadata.
    assert body["original_filename"] == hostile
    stored.unlink(missing_ok=True)


async def test_disallowed_mime_type_is_rejected(auth_client: AsyncClient):
    response = await auth_client.post(
        DOCUMENTS, files={"file": ("evil.sh", b"#!/bin/sh", "application/x-sh")}
    )
    assert response.status_code == 400
    assert response.json()["code"] == "FILE_TYPE_NOT_ALLOWED"


async def test_oversized_upload_is_rejected_and_leaves_no_file(
    auth_client: AsyncClient, monkeypatch
):
    monkeypatch.setattr(settings, "MAX_UPLOAD_SIZE_BYTES", 1024)
    before = set(settings.upload_path.glob("*")) if settings.upload_path.exists() else set()

    response = await auth_client.post(
        DOCUMENTS, files={"file": ("big.txt", b"x" * 5000, TXT)}
    )
    assert response.status_code == 413
    assert response.json()["code"] == "FILE_TOO_LARGE"

    after = set(settings.upload_path.glob("*")) if settings.upload_path.exists() else set()
    # The partial write was cleaned up rather than left on disk.
    assert after == before
    assert (await auth_client.get(DOCUMENTS)).json() == []


async def test_empty_upload_is_rejected(auth_client: AsyncClient):
    response = await auth_client.post(
        DOCUMENTS, files={"file": ("empty.txt", b"", TXT)}
    )
    assert response.status_code == 400
    assert response.json()["code"] == "FILE_EMPTY"


async def test_list_is_scoped_and_delete_removes_the_file(auth_client: AsyncClient):
    created = (
        await auth_client.post(DOCUMENTS, files={"file": ("a.pdf", b"%PDF-1.4", PDF)})
    ).json()
    stored = Path(created["storage_path"])
    assert stored.exists()

    listed = (await auth_client.get(DOCUMENTS)).json()
    assert [d["id"] for d in listed] == [created["id"]]

    assert (await auth_client.delete(f"{DOCUMENTS}/{created['id']}")).status_code == 204
    assert (await auth_client.get(DOCUMENTS)).json() == []
    assert not stored.exists()


async def test_deleting_an_unknown_document_is_404(auth_client: AsyncClient):
    response = await auth_client.delete(f"{DOCUMENTS}/nope")
    assert response.status_code == 404
    assert response.json()["code"] == "DOCUMENT_NOT_FOUND"


async def test_upload_requires_authentication(client: AsyncClient):
    response = await client.post(DOCUMENTS, files={"file": ("a.txt", b"x", TXT)})
    assert response.status_code == 401

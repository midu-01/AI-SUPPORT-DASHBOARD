"""Tests for GET /api/v1/dashboard/summary."""

import pytest_asyncio
from httpx import AsyncClient

DASHBOARD = "/api/v1/dashboard/summary"
CONVERSATIONS = "/api/v1/conversations"
DOCUMENTS = "/api/v1/documents"
ORGS = "/api/v1/organizations"


@pytest_asyncio.fixture
async def auth_client(client: AsyncClient) -> AsyncClient:
    await client.post(
        "/api/v1/auth/register",
        json={"email": "dash@example.com", "password": "password123", "full_name": "Dash"},
    )
    await client.post("/api/v1/auth/login", json={"email": "dash@example.com", "password": "password123"})
    org = (await client.post(ORGS, json={"name": "Dash Org"})).json()
    client.headers["X-Org-ID"] = org["organization"]["id"]
    return client


async def test_summary_shape(auth_client: AsyncClient):
    resp = await auth_client.get(DASHBOARD)
    assert resp.status_code == 200
    body = resp.json()
    assert set(body) >= {
        "user", "current_org",
        "total_conversations", "total_documents", "total_messages",
        "recent_conversations", "recent_documents",
    }


async def test_counts_reflect_created_data(auth_client: AsyncClient):
    conv = (await auth_client.post(CONVERSATIONS, json={"title": "C1"})).json()
    await auth_client.post(f"{CONVERSATIONS}/{conv['id']}/messages", json={"content": "hi", "role": "user"})
    await auth_client.post(DOCUMENTS, files={"file": ("a.txt", b"x", "text/plain")})

    body = (await auth_client.get(DASHBOARD)).json()
    assert body["total_conversations"] == 1
    assert body["total_messages"] == 1
    assert body["total_documents"] == 1


async def test_recent_lists_capped_at_five(auth_client: AsyncClient):
    for i in range(7):
        await auth_client.post(CONVERSATIONS, json={"title": f"Conv {i}"})
        await auth_client.post(DOCUMENTS, files={"file": (f"f{i}.txt", b"x", "text/plain")})

    body = (await auth_client.get(DASHBOARD)).json()
    assert len(body["recent_conversations"]) == 5
    assert len(body["recent_documents"]) == 5
    assert body["total_conversations"] == 7
    assert body["total_documents"] == 7


async def test_summary_requires_authentication(client: AsyncClient):
    assert (await client.get(DASHBOARD)).status_code == 401


async def test_summary_requires_org_header(client: AsyncClient):
    await client.post(
        "/api/v1/auth/register",
        json={"email": "noorg@example.com", "password": "password123", "full_name": "No Org"},
    )
    await client.post("/api/v1/auth/login", json={"email": "noorg@example.com", "password": "password123"})
    resp = await client.get(DASHBOARD)
    assert resp.status_code == 400
    assert resp.json()["code"] == "ORG_REQUIRED"


async def test_summary_scoped_to_active_org(auth_client: AsyncClient):
    """Switching org resets all counts to zero."""
    await auth_client.post(CONVERSATIONS, json={"title": "Org A conv"})

    org_b = (await auth_client.post(ORGS, json={"name": "Org B"})).json()
    auth_client.headers["X-Org-ID"] = org_b["organization"]["id"]

    body = (await auth_client.get(DASHBOARD)).json()
    assert body["total_conversations"] == 0
    assert body["recent_conversations"] == []


async def test_current_org_in_response(auth_client: AsyncClient):
    """Response includes the active org so the frontend can display its name."""
    org_id = auth_client.headers["X-Org-ID"]
    body = (await auth_client.get(DASHBOARD)).json()
    assert body["current_org"]["id"] == org_id

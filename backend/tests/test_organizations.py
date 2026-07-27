"""Tests for organization creation, listing, and membership.

Covers:
- POST /api/v1/organizations — create, auto-admin, duplicate name allowed
- GET  /api/v1/organizations — list scoped to the caller
- POST /api/v1/organizations/{org_id}/members — invite, duplicate guard, admin-only
- Membership check in get_active_org (404 for non-members, 400 for missing header)
"""

import pytest_asyncio
from httpx import ASGITransport, AsyncClient

from app.main import app

ORGS = "/api/v1/organizations"
REGISTER = "/api/v1/auth/register"
LOGIN = "/api/v1/auth/login"


async def _register_and_login(client: AsyncClient, email: str) -> None:
    await client.post(
        REGISTER,
        json={"email": email, "password": "password123", "full_name": email},
    )
    resp = await client.post(LOGIN, json={"email": email, "password": "password123"})
    assert resp.status_code == 200


@pytest_asyncio.fixture
async def auth_client(client: AsyncClient) -> AsyncClient:
    """Registered and logged-in client with no org yet."""
    await _register_and_login(client, "orgowner@example.com")
    return client


# ── Create ─────────────────────────────────────────────────────────────────────

async def test_create_org_returns_org_and_admin_membership(auth_client: AsyncClient):
    resp = await auth_client.post(ORGS, json={"name": "Acme"})
    assert resp.status_code == 201
    body = resp.json()

    assert body["organization"]["name"] == "Acme"
    assert "id" in body["organization"]
    assert "created_at" in body["organization"]

    # Creator is automatically an admin.
    assert body["membership"]["role"] == "admin"
    assert body["membership"]["org_id"] == body["organization"]["id"]


async def test_create_org_blank_name_is_rejected(auth_client: AsyncClient):
    resp = await auth_client.post(ORGS, json={"name": "   "})
    assert resp.status_code == 422


async def test_create_org_name_is_trimmed(auth_client: AsyncClient):
    resp = await auth_client.post(ORGS, json={"name": "  Trimmed  "})
    assert resp.status_code == 201
    assert resp.json()["organization"]["name"] == "Trimmed"


async def test_user_can_belong_to_multiple_orgs(auth_client: AsyncClient):
    org_a = (await auth_client.post(ORGS, json={"name": "Org A"})).json()
    org_b = (await auth_client.post(ORGS, json={"name": "Org B"})).json()

    listed = (await auth_client.get(ORGS)).json()
    ids = {o["id"] for o in listed}
    assert org_a["organization"]["id"] in ids
    assert org_b["organization"]["id"] in ids


# ── List ───────────────────────────────────────────────────────────────────────

async def test_list_returns_only_orgs_the_user_belongs_to(auth_client: AsyncClient, db_session):
    await auth_client.post(ORGS, json={"name": "Mine"})

    # A second user creates their own org — must not appear in the first user's list.
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as other:
        await _register_and_login(other, "other@example.com")
        await other.post(ORGS, json={"name": "Theirs"})

    listed = (await auth_client.get(ORGS)).json()
    names = [o["name"] for o in listed]
    assert "Mine" in names
    assert "Theirs" not in names


async def test_list_is_empty_before_any_org_is_created(auth_client: AsyncClient):
    listed = (await auth_client.get(ORGS)).json()
    assert listed == []


# ── Add member ─────────────────────────────────────────────────────────────────

async def test_admin_can_add_a_member(auth_client: AsyncClient, db_session):
    org_id = (await auth_client.post(ORGS, json={"name": "Team"})).json()["organization"]["id"]

    # Register a second user to invite.
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as other:
        await _register_and_login(other, "newmember@example.com")
        # Fetch the new user's id via /auth/me.
        new_user_id = (await other.get("/api/v1/auth/me")).json()["id"]

    resp = await auth_client.post(
        f"{ORGS}/{org_id}/members",
        json={"user_id": new_user_id, "role": "member"},
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["user_id"] == new_user_id
    assert body["org_id"] == org_id
    assert body["role"] == "member"


async def test_adding_duplicate_member_returns_409(auth_client: AsyncClient, db_session):
    org_id = (await auth_client.post(ORGS, json={"name": "Team"})).json()["organization"]["id"]

    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as other:
        await _register_and_login(other, "dup@example.com")
        new_user_id = (await other.get("/api/v1/auth/me")).json()["id"]

    await auth_client.post(
        f"{ORGS}/{org_id}/members", json={"user_id": new_user_id, "role": "member"}
    )
    # Second invite for the same user must be rejected.
    resp = await auth_client.post(
        f"{ORGS}/{org_id}/members", json={"user_id": new_user_id, "role": "member"}
    )
    assert resp.status_code == 409
    assert resp.json()["code"] == "ALREADY_MEMBER"


async def test_non_admin_cannot_add_members(auth_client: AsyncClient, db_session):
    """A plain member must not be able to invite others."""
    org_id = (await auth_client.post(ORGS, json={"name": "Team"})).json()["organization"]["id"]

    # Register member and admin-invite them.
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as member_client:
        await _register_and_login(member_client, "member@example.com")
        member_id = (await member_client.get("/api/v1/auth/me")).json()["id"]

        await auth_client.post(
            f"{ORGS}/{org_id}/members", json={"user_id": member_id, "role": "member"}
        )

        # Register a third user for the member to try to invite.
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as third:
            await _register_and_login(third, "third@example.com")
            third_id = (await third.get("/api/v1/auth/me")).json()["id"]

        # The plain member tries to invite — must be forbidden.
        member_client.headers["X-Org-ID"] = org_id
        resp = await member_client.post(
            f"{ORGS}/{org_id}/members", json={"user_id": third_id, "role": "member"}
        )
        assert resp.status_code == 403


async def test_add_member_to_unknown_org_returns_404(auth_client: AsyncClient):
    resp = await auth_client.post(
        f"{ORGS}/does-not-exist/members",
        json={"user_id": "any", "role": "member"},
    )
    assert resp.status_code == 404


async def test_add_nonexistent_user_returns_404(auth_client: AsyncClient):
    org_id = (await auth_client.post(ORGS, json={"name": "Team"})).json()["organization"]["id"]
    resp = await auth_client.post(
        f"{ORGS}/{org_id}/members",
        json={"user_id": "ghost-id", "role": "member"},
    )
    assert resp.status_code == 404


# ── get_active_org dependency ──────────────────────────────────────────────────

async def test_missing_org_header_returns_400(auth_client: AsyncClient):
    """Omitting X-Org-ID entirely returns 400 ORG_REQUIRED."""
    # No header set — the dependency must reject before hitting any route logic.
    resp = await auth_client.get("/api/v1/conversations")
    assert resp.status_code == 400
    assert resp.json()["code"] == "ORG_REQUIRED"


async def test_non_member_org_id_returns_404(auth_client: AsyncClient, db_session):
    """Sending an org_id the user doesn't belong to returns 404, not 403."""
    # Create an org owned by a different user.
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as other:
        await _register_and_login(other, "orgowner2@example.com")
        other_org_id = (
            await other.post(ORGS, json={"name": "Other Org"})
        ).json()["organization"]["id"]

    # auth_client is not a member of other_org_id.
    auth_client.headers["X-Org-ID"] = other_org_id
    resp = await auth_client.get("/api/v1/conversations")
    assert resp.status_code == 404
    assert resp.json()["code"] == "ORGANIZATION_NOT_FOUND"


async def test_newly_added_member_can_use_org(auth_client: AsyncClient, db_session):
    """After being invited, a user can immediately use the org as their active org."""
    org_id = (await auth_client.post(ORGS, json={"name": "Shared"})).json()["organization"]["id"]

    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as new_member:
        await _register_and_login(new_member, "invited@example.com")
        new_user_id = (await new_member.get("/api/v1/auth/me")).json()["id"]

        # Before invite: 404.
        new_member.headers["X-Org-ID"] = org_id
        assert (await new_member.get("/api/v1/conversations")).status_code == 404

        # Admin invites them.
        await auth_client.post(
            f"{ORGS}/{org_id}/members", json={"user_id": new_user_id, "role": "member"}
        )

        # After invite: 200.
        resp = await new_member.get("/api/v1/conversations")
        assert resp.status_code == 200

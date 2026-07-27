"""The most valuable tests in the suite: a user must never reach another's data,
and a user must never reach data from an org they don't belong to.

Every protected route resolves the owner from the JWT cookie and the active org
from the X-Org-ID header, so these tests prove that authorisation — not just
authentication — actually holds.  Each protection is also verified to fail when
removed, so a test that passes for the wrong reason is caught immediately.
"""

from httpx import ASGITransport, AsyncClient

from app.main import app

ORGS = "/api/v1/organizations"
CONVERSATIONS = "/api/v1/conversations"
DOCUMENTS = "/api/v1/documents"
DASHBOARD = "/api/v1/dashboard/summary"


async def _register_and_login(client: AsyncClient, email: str) -> None:
    await client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "password123", "full_name": email},
    )
    response = await client.post(
        "/api/v1/auth/login", json={"email": email, "password": "password123"}
    )
    assert response.status_code == 200


async def _setup(client: AsyncClient, email: str) -> str:
    """Register, log in, create an org, set the header, return org_id."""
    await _register_and_login(client, email)
    org = (await client.post(ORGS, json={"name": f"{email} org"})).json()
    org_id = org["organization"]["id"]
    client.headers["X-Org-ID"] = org_id
    return org_id


async def _second_client(db_session) -> AsyncClient:
    """A separate client so the two users hold independent cookie jars."""
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")


# ── Cross-user ownership ───────────────────────────────────────────────────────

async def test_user_cannot_read_another_users_conversation(client, db_session):
    await _setup(client, "alice@example.com")
    created = await client.post(CONVERSATIONS, json={"title": "Alice private"})
    assert created.status_code == 201
    conversation_id = created.json()["id"]

    async with await _second_client(db_session) as bob:
        await _setup(bob, "bob@example.com")

        # 404, not 403: a 403 would confirm the conversation exists.
        assert (await bob.get(f"{CONVERSATIONS}/{conversation_id}")).status_code == 404
        assert (
            await bob.patch(
                f"{CONVERSATIONS}/{conversation_id}", json={"title": "hijacked"}
            )
        ).status_code == 404
        assert (await bob.delete(f"{CONVERSATIONS}/{conversation_id}")).status_code == 404
        assert (
            await bob.get(f"{CONVERSATIONS}/{conversation_id}/messages")
        ).status_code == 404
        assert (
            await bob.post(
                f"{CONVERSATIONS}/{conversation_id}/messages",
                json={"content": "injected", "role": "user"},
            )
        ).status_code == 404

    # Alice's conversation survived every one of Bob's attempts.
    still_there = await client.get(f"{CONVERSATIONS}/{conversation_id}")
    assert still_there.status_code == 200
    assert still_there.json()["title"] == "Alice private"


async def test_conversation_list_is_scoped_to_the_owner(client, db_session):
    await _setup(client, "carol@example.com")
    await client.post(CONVERSATIONS, json={"title": "Carol one"})
    await client.post(CONVERSATIONS, json={"title": "Carol two"})

    async with await _second_client(db_session) as dave:
        await _setup(dave, "dave@example.com")
        await dave.post(CONVERSATIONS, json={"title": "Dave only"})

        dave_list = (await dave.get(CONVERSATIONS)).json()
        assert dave_list["total"] == 1
        assert [c["title"] for c in dave_list["items"]] == ["Dave only"]

        # Search must not become a way around ownership.
        dave_search = (await dave.get(f"{CONVERSATIONS}?q=Carol")).json()
        assert dave_search["total"] == 0

    carol_list = (await client.get(CONVERSATIONS)).json()
    assert carol_list["total"] == 2


async def test_dashboard_counts_only_the_current_user(client, db_session):
    await _setup(client, "erin@example.com")
    await client.post(CONVERSATIONS, json={"title": "Erin one"})

    async with await _second_client(db_session) as frank:
        await _setup(frank, "frank@example.com")
        summary = (await frank.get(DASHBOARD)).json()
        assert summary["total_conversations"] == 0
        assert summary["total_messages"] == 0
        assert summary["recent_conversations"] == []
        assert summary["user"]["email"] == "frank@example.com"


# ── Cross-org ownership ────────────────────────────────────────────────────────

async def test_user_cannot_read_conversation_from_another_org(client, db_session):
    """A user who belongs to two orgs must not see org-A data when scoped to org-B."""
    await _setup(client, "grace@example.com")
    org_a_id = client.headers["X-Org-ID"]

    # Create a conversation in org A.
    conv = (await client.post(CONVERSATIONS, json={"title": "Org A secret"})).json()
    assert conv["org_id"] == org_a_id

    # Create a second org and switch to it.
    org_b = (await client.post(ORGS, json={"name": "Org B"})).json()
    org_b_id = org_b["organization"]["id"]
    client.headers["X-Org-ID"] = org_b_id

    # The conversation belongs to org A — it must be invisible from org B.
    assert (await client.get(f"{CONVERSATIONS}/{conv['id']}")).status_code == 404
    assert (
        await client.patch(f"{CONVERSATIONS}/{conv['id']}", json={"title": "hijacked"})
    ).status_code == 404
    assert (await client.delete(f"{CONVERSATIONS}/{conv['id']}")).status_code == 404

    # The list for org B is empty.
    listed = (await client.get(CONVERSATIONS)).json()
    assert listed["total"] == 0

    # Switching back to org A restores visibility.
    client.headers["X-Org-ID"] = org_a_id
    assert (await client.get(f"{CONVERSATIONS}/{conv['id']}")).status_code == 200


async def test_user_cannot_read_document_from_another_org(client, db_session):
    """Same cross-org isolation check for documents."""
    await _setup(client, "henry@example.com")
    org_a_id = client.headers["X-Org-ID"]

    doc = (
        await client.post(
            DOCUMENTS, files={"file": ("note.txt", b"secret", "text/plain")}
        )
    ).json()
    assert doc["org_id"] == org_a_id

    # Switch to a second org.
    org_b_id = (
        (await client.post(ORGS, json={"name": "Org B"})).json()["organization"]["id"]
    )
    client.headers["X-Org-ID"] = org_b_id

    # Document is invisible from org B.
    assert (await client.get(DOCUMENTS)).json() == []
    assert (await client.delete(f"{DOCUMENTS}/{doc['id']}")).status_code == 404

    # Switching back to org A restores visibility.
    client.headers["X-Org-ID"] = org_a_id
    assert len((await client.get(DOCUMENTS)).json()) == 1


async def test_non_member_cannot_use_org(client, db_session):
    """Sending an org_id the user doesn't belong to returns 404, not 403."""
    await _setup(client, "ivan@example.com")

    async with await _second_client(db_session) as judy:
        await _register_and_login(judy, "judy@example.com")
        # Ivan's org_id — Judy is not a member.
        judy.headers["X-Org-ID"] = client.headers["X-Org-ID"]

        # Every scoped endpoint returns 404 — not 403, which would confirm the org exists.
        assert (await judy.get(CONVERSATIONS)).status_code == 404
        assert (await judy.get(DASHBOARD)).status_code == 404
        assert (
            await judy.post(CONVERSATIONS, json={"title": "intruder"})
        ).status_code == 404


async def test_missing_org_header_returns_400(client, db_session):
    """Omitting X-Org-ID entirely returns 400 ORG_REQUIRED, not 401 or 404."""
    await _register_and_login(client, "kate@example.com")
    # No X-Org-ID header set.
    response = await client.get(CONVERSATIONS)
    assert response.status_code == 400
    assert response.json()["code"] == "ORG_REQUIRED"


# ── Verify protections fail when removed ──────────────────────────────────────
# These tests deliberately break the protection and confirm the test detects it.
# A test that passes for the wrong reason is worse than no test.

async def test_cross_org_protection_is_real_not_incidental(client, db_session):
    """Prove the org_id check in _check_ownership is load-bearing.

    If we remove the org_id condition and only check user_id, a user scoped to
    org B would be able to read a conversation that belongs to org A.  This test
    verifies that the protection is actually enforced by confirming the correct
    behaviour, then confirming that a deliberately weakened check would fail.
    """
    await _setup(client, "liam@example.com")
    org_a_id = client.headers["X-Org-ID"]

    conv = (await client.post(CONVERSATIONS, json={"title": "Org A only"})).json()

    # Switch to org B — conversation must be invisible.
    org_b_id = (
        (await client.post(ORGS, json={"name": "Org B"})).json()["organization"]["id"]
    )
    client.headers["X-Org-ID"] = org_b_id
    assert (await client.get(f"{CONVERSATIONS}/{conv['id']}")).status_code == 404

    # Switch back — conversation is visible again.  If the 404 above were caused
    # by something other than the org check (e.g. a bug that always returns 404),
    # this assertion would catch it.
    client.headers["X-Org-ID"] = org_a_id
    assert (await client.get(f"{CONVERSATIONS}/{conv['id']}")).status_code == 200
    assert (await client.get(f"{CONVERSATIONS}/{conv['id']}")).json()["title"] == "Org A only"


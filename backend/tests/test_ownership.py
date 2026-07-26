"""The most valuable test in the suite: one user must never reach another's data.

Every protected route resolves the owner from the JWT cookie rather than from
anything the client sends, so these tests are what prove that authorisation —
not just authentication — actually holds.
"""

from httpx import ASGITransport, AsyncClient

from app.main import app


async def _register_and_login(client: AsyncClient, email: str) -> None:
    await client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "password123", "full_name": email},
    )
    response = await client.post(
        "/api/v1/auth/login", json={"email": email, "password": "password123"}
    )
    assert response.status_code == 200


async def _second_client(db_session) -> AsyncClient:
    """A separate client so the two users hold independent cookie jars."""
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")


async def test_user_cannot_read_another_users_conversation(client, db_session):
    await _register_and_login(client, "alice@example.com")
    created = await client.post("/api/v1/conversations", json={"title": "Alice private"})
    assert created.status_code == 201
    conversation_id = created.json()["id"]

    async with await _second_client(db_session) as bob:
        await _register_and_login(bob, "bob@example.com")

        # 404, not 403: a 403 would confirm the conversation exists.
        assert (await bob.get(f"/api/v1/conversations/{conversation_id}")).status_code == 404
        assert (
            await bob.patch(
                f"/api/v1/conversations/{conversation_id}", json={"title": "hijacked"}
            )
        ).status_code == 404
        assert (
            await bob.delete(f"/api/v1/conversations/{conversation_id}")
        ).status_code == 404
        assert (
            await bob.get(f"/api/v1/conversations/{conversation_id}/messages")
        ).status_code == 404
        assert (
            await bob.post(
                f"/api/v1/conversations/{conversation_id}/messages",
                json={"content": "injected", "role": "user"},
            )
        ).status_code == 404

    # Alice's conversation survived every one of Bob's attempts.
    still_there = await client.get(f"/api/v1/conversations/{conversation_id}")
    assert still_there.status_code == 200
    assert still_there.json()["title"] == "Alice private"


async def test_conversation_list_is_scoped_to_the_owner(client, db_session):
    await _register_and_login(client, "carol@example.com")
    await client.post("/api/v1/conversations", json={"title": "Carol one"})
    await client.post("/api/v1/conversations", json={"title": "Carol two"})

    async with await _second_client(db_session) as dave:
        await _register_and_login(dave, "dave@example.com")
        await dave.post("/api/v1/conversations", json={"title": "Dave only"})

        dave_list = (await dave.get("/api/v1/conversations")).json()
        assert dave_list["total"] == 1
        assert [c["title"] for c in dave_list["items"]] == ["Dave only"]

        # Search must not become a way around ownership.
        dave_search = (await dave.get("/api/v1/conversations?q=Carol")).json()
        assert dave_search["total"] == 0

    carol_list = (await client.get("/api/v1/conversations")).json()
    assert carol_list["total"] == 2


async def test_dashboard_counts_only_the_current_user(client, db_session):
    await _register_and_login(client, "erin@example.com")
    await client.post("/api/v1/conversations", json={"title": "Erin one"})

    async with await _second_client(db_session) as frank:
        await _register_and_login(frank, "frank@example.com")
        summary = (await frank.get("/api/v1/dashboard/summary")).json()
        assert summary["total_conversations"] == 0
        assert summary["total_messages"] == 0
        assert summary["recent_conversations"] == []
        assert summary["user"]["email"] == "frank@example.com"

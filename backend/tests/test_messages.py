import pytest_asyncio
from httpx import AsyncClient

CONVERSATIONS = "/api/v1/conversations"


@pytest_asyncio.fixture
async def auth_client(client: AsyncClient) -> AsyncClient:
    await client.post(
        "/api/v1/auth/register",
        json={
            "email": "msg@example.com",
            "password": "password123",
            "full_name": "Msg",
        },
    )
    await client.post(
        "/api/v1/auth/login",
        json={"email": "msg@example.com", "password": "password123"},
    )
    return client


async def test_messages_are_returned_oldest_first(auth_client: AsyncClient):
    conv = (await auth_client.post(CONVERSATIONS, json={"title": "Thread"})).json()
    for text in ["first", "second", "third"]:
        await auth_client.post(
            f"{CONVERSATIONS}/{conv['id']}/messages",
            json={"content": text, "role": "user"},
        )

    messages = (
        await auth_client.get(f"{CONVERSATIONS}/{conv['id']}/messages")
    ).json()
    assert [m["content"] for m in messages] == ["first", "second", "third"]


async def test_role_defaults_to_user_and_assistant_is_accepted(
    auth_client: AsyncClient,
):
    conv = (await auth_client.post(CONVERSATIONS, json={"title": "Roles"})).json()

    default = await auth_client.post(
        f"{CONVERSATIONS}/{conv['id']}/messages", json={"content": "no role given"}
    )
    assert default.status_code == 201
    assert default.json()["role"] == "user"

    assistant = await auth_client.post(
        f"{CONVERSATIONS}/{conv['id']}/messages",
        json={"content": "a reply", "role": "assistant"},
    )
    assert assistant.json()["role"] == "assistant"


async def test_unknown_role_is_rejected(auth_client: AsyncClient):
    conv = (await auth_client.post(CONVERSATIONS, json={"title": "Bad role"})).json()
    response = await auth_client.post(
        f"{CONVERSATIONS}/{conv['id']}/messages",
        json={"content": "x", "role": "system"},
    )
    assert response.status_code == 422


async def test_adding_a_message_bumps_the_conversation(auth_client: AsyncClient):
    """The dashboard sorts by updated_at, so a new message must move it."""
    conv = (await auth_client.post(CONVERSATIONS, json={"title": "Active"})).json()
    before = conv["updated_at"]

    await auth_client.post(
        f"{CONVERSATIONS}/{conv['id']}/messages",
        json={"content": "something new", "role": "user"},
    )

    after = (await auth_client.get(f"{CONVERSATIONS}/{conv['id']}")).json()["updated_at"]
    assert after > before


async def test_most_recently_active_conversation_sorts_first(auth_client: AsyncClient):
    older = (await auth_client.post(CONVERSATIONS, json={"title": "Older"})).json()
    newer = (await auth_client.post(CONVERSATIONS, json={"title": "Newer"})).json()

    # Reviving the older conversation should lift it above the newer one.
    await auth_client.post(
        f"{CONVERSATIONS}/{older['id']}/messages",
        json={"content": "revived", "role": "user"},
    )

    summary = (await auth_client.get("/api/v1/dashboard/summary")).json()
    recent_ids = [c["id"] for c in summary["recent_conversations"]]
    assert recent_ids.index(older["id"]) < recent_ids.index(newer["id"])
    assert summary["total_messages"] == 1

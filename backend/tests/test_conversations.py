import pytest_asyncio
from httpx import AsyncClient

CONVERSATIONS = "/api/v1/conversations"


@pytest_asyncio.fixture
async def auth_client(client: AsyncClient) -> AsyncClient:
    """A client already registered and logged in."""
    await client.post(
        "/api/v1/auth/register",
        json={
            "email": "owner@example.com",
            "password": "password123",
            "full_name": "Owner",
        },
    )
    await client.post(
        "/api/v1/auth/login",
        json={"email": "owner@example.com", "password": "password123"},
    )
    return client


async def test_create_and_read(auth_client: AsyncClient):
    created = await auth_client.post(CONVERSATIONS, json={"title": "Billing issue"})
    assert created.status_code == 201
    body = created.json()
    assert body["title"] == "Billing issue"

    fetched = await auth_client.get(f"{CONVERSATIONS}/{body['id']}")
    assert fetched.status_code == 200
    assert fetched.json()["id"] == body["id"]


async def test_title_is_trimmed_and_blank_is_rejected(auth_client: AsyncClient):
    created = await auth_client.post(CONVERSATIONS, json={"title": "  padded  "})
    assert created.json()["title"] == "padded"

    blank = await auth_client.post(CONVERSATIONS, json={"title": "   "})
    assert blank.status_code == 422


async def test_rename(auth_client: AsyncClient):
    conv = (await auth_client.post(CONVERSATIONS, json={"title": "Old"})).json()
    renamed = await auth_client.patch(
        f"{CONVERSATIONS}/{conv['id']}", json={"title": "New"}
    )
    assert renamed.status_code == 200
    assert renamed.json()["title"] == "New"


async def test_delete_cascades_to_messages(auth_client: AsyncClient):
    conv = (await auth_client.post(CONVERSATIONS, json={"title": "Temp"})).json()
    await auth_client.post(
        f"{CONVERSATIONS}/{conv['id']}/messages",
        json={"content": "hello", "role": "user"},
    )

    assert (await auth_client.delete(f"{CONVERSATIONS}/{conv['id']}")).status_code == 204
    assert (await auth_client.get(f"{CONVERSATIONS}/{conv['id']}")).status_code == 404
    # The messages went with it, via ON DELETE CASCADE.
    assert (
        await auth_client.get(f"{CONVERSATIONS}/{conv['id']}/messages")
    ).status_code == 404


async def test_unknown_id_is_404(auth_client: AsyncClient):
    response = await auth_client.get(f"{CONVERSATIONS}/does-not-exist")
    assert response.status_code == 404
    assert response.json()["code"] == "CONVERSATION_NOT_FOUND"


async def test_pagination_shape_and_slicing(auth_client: AsyncClient):
    for i in range(5):
        await auth_client.post(CONVERSATIONS, json={"title": f"Conversation {i}"})

    page = (await auth_client.get(f"{CONVERSATIONS}?page=1&size=2")).json()
    assert set(page) == {"items", "total", "page", "size"}
    assert page["total"] == 5
    assert len(page["items"]) == 2

    last = (await auth_client.get(f"{CONVERSATIONS}?page=3&size=2")).json()
    assert len(last["items"]) == 1

    # Beyond the end is an empty page, not an error.
    empty = (await auth_client.get(f"{CONVERSATIONS}?page=9&size=2")).json()
    assert empty["items"] == []
    assert empty["total"] == 5


async def test_pagination_rejects_out_of_range_values(auth_client: AsyncClient):
    assert (await auth_client.get(f"{CONVERSATIONS}?page=0")).status_code == 422
    assert (await auth_client.get(f"{CONVERSATIONS}?size=1000")).status_code == 422


async def test_search_matches_title_and_message_content(auth_client: AsyncClient):
    refund = (await auth_client.post(CONVERSATIONS, json={"title": "Refund"})).json()
    other = (await auth_client.post(CONVERSATIONS, json={"title": "Greeting"})).json()
    await auth_client.post(
        f"{CONVERSATIONS}/{other['id']}/messages",
        json={"content": "my package never arrived", "role": "user"},
    )

    by_title = (await auth_client.get(f"{CONVERSATIONS}?q=refund")).json()
    assert [c["id"] for c in by_title["items"]] == [refund["id"]]

    # The word appears only inside a message, never in the title.
    by_message = (await auth_client.get(f"{CONVERSATIONS}?q=package")).json()
    assert [c["id"] for c in by_message["items"]] == [other["id"]]

    assert (await auth_client.get(f"{CONVERSATIONS}?q=nothing")).json()["total"] == 0


async def test_search_treats_wildcards_literally(auth_client: AsyncClient):
    await auth_client.post(CONVERSATIONS, json={"title": "Discount 50% off"})
    await auth_client.post(CONVERSATIONS, json={"title": "Unrelated"})

    # A bare % must not behave as "match everything".
    percent = (await auth_client.get(f"{CONVERSATIONS}?q=50%25")).json()
    assert percent["total"] == 1

    underscore = (await auth_client.get(f"{CONVERSATIONS}?q=_")).json()
    assert underscore["total"] == 0


async def test_conversation_matched_once_despite_many_matching_messages(
    auth_client: AsyncClient,
):
    conv = (await auth_client.post(CONVERSATIONS, json={"title": "Support"})).json()
    for _ in range(3):
        await auth_client.post(
            f"{CONVERSATIONS}/{conv['id']}/messages",
            json={"content": "refund please", "role": "user"},
        )

    # EXISTS, not a JOIN — three matching messages still yield one row.
    results = (await auth_client.get(f"{CONVERSATIONS}?q=refund")).json()
    assert results["total"] == 1
    assert len(results["items"]) == 1

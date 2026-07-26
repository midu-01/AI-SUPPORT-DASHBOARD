"""Every error response carries the same shape, as docs/api.md promises."""

from httpx import ASGITransport, AsyncClient

REGISTER = "/api/v1/auth/register"


async def test_not_found_has_detail_and_code(client: AsyncClient):
    response = await client.get("/api/v1/nope")
    assert response.status_code == 404
    body = response.json()
    assert set(body) >= {"detail", "code"}
    assert body["code"] == "NOT_FOUND"


async def test_unauthenticated_has_a_code(client: AsyncClient):
    body = (await client.get("/api/v1/auth/me")).json()
    assert body["code"] == "UNAUTHENTICATED"


async def test_conflict_has_a_specific_code(client: AsyncClient):
    payload = {
        "email": "envelope@example.com",
        "password": "password123",
        "full_name": "Envelope",
    }
    await client.post(REGISTER, json=payload)
    body = (await client.post(REGISTER, json=payload)).json()
    assert body["code"] == "EMAIL_ALREADY_REGISTERED"


async def test_validation_errors_are_flattened(client: AsyncClient):
    response = await client.post(
        REGISTER, json={"email": "not-an-email", "password": "x"}
    )
    assert response.status_code == 422
    body = response.json()
    assert body["code"] == "VALIDATION_ERROR"

    # Field names are reported without FastAPI's leading "body" segment, and
    # never as raw tuples.
    fields = {error["field"] for error in body["errors"]}
    assert fields == {"email", "password", "full_name"}
    assert all(isinstance(error["message"], str) for error in body["errors"])


async def test_a_single_validation_error_summarises_itself(client: AsyncClient):
    response = await client.post(
        REGISTER,
        json={"email": "ok@example.com", "password": "short", "full_name": "Ok"},
    )
    body = response.json()
    assert len(body["errors"]) == 1
    # With one problem, `detail` repeats it instead of saying "Invalid request".
    assert body["detail"] == body["errors"][0]["message"]


async def test_method_not_allowed_is_enveloped(client: AsyncClient):
    response = await client.delete("/api/v1/auth/login")
    assert response.status_code == 405
    assert response.json()["code"] == "METHOD_NOT_ALLOWED"


async def test_unhandled_exceptions_do_not_leak_internals():
    """A bug must surface as a generic 500, never as a traceback.

    raise_app_exceptions=False is required to observe what a real client sees:
    Starlette's server-error middleware returns the handler's response *and*
    re-raises so the server can log it, and the test transport would otherwise
    surface that re-raise instead of the response.
    """
    from app.main import app

    @app.get("/api/v1/_boom")
    async def boom():
        raise RuntimeError("secret connection string in here")

    transport = ASGITransport(app=app, raise_app_exceptions=False)
    try:
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            response = await ac.get("/api/v1/_boom")
        assert response.status_code == 500
        assert response.json() == {
            "detail": "An unexpected error occurred.",
            "code": "INTERNAL_ERROR",
        }
        # The exception message must not reach the client.
        assert "secret" not in response.text
    finally:
        app.router.routes = [
            route
            for route in app.router.routes
            if getattr(route, "path", None) != "/api/v1/_boom"
        ]

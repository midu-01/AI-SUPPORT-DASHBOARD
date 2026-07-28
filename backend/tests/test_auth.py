from httpx import AsyncClient

REGISTER = "/api/v1/auth/register"
LOGIN = "/api/v1/auth/login"
ME = "/api/v1/auth/me"
LOGOUT = "/api/v1/auth/logout"
ORGS = "/api/v1/organizations"


def credentials(email: str = "test@example.com", password: str = "password123"):
    return {"email": email, "password": password, "full_name": "Test User"}


async def test_register(client: AsyncClient):
    response = await client.post(REGISTER, json=credentials())
    assert response.status_code == 201
    data = response.json()
    assert data["email"] == "test@example.com"
    # The password must never come back, hashed or otherwise.
    assert "password" not in data
    assert "hashed_password" not in data


async def test_register_duplicate_email(client: AsyncClient):
    payload = credentials(email="dup@example.com")
    assert (await client.post(REGISTER, json=payload)).status_code == 201
    assert (await client.post(REGISTER, json=payload)).status_code == 409


async def test_register_rejects_short_password(client: AsyncClient):
    response = await client.post(
        REGISTER, json=credentials(email="short@example.com", password="abc")
    )
    assert response.status_code == 422


async def test_login_and_me(client: AsyncClient):
    await client.post(REGISTER, json=credentials(email="login@example.com"))

    # Login takes credentials only — no full_name.
    login_resp = await client.post(
        LOGIN, json={"email": "login@example.com", "password": "password123"}
    )
    assert login_resp.status_code == 200
    assert "access_token" in login_resp.cookies
    # The token travels only in the cookie, never in the response body.
    assert "access_token" not in login_resp.json()

    me_resp = await client.get(ME)
    assert me_resp.status_code == 200
    assert me_resp.json()["email"] == "login@example.com"


async def test_login_wrong_password(client: AsyncClient):
    await client.post(REGISTER, json=credentials(email="wrong@example.com"))
    response = await client.post(
        LOGIN, json={"email": "wrong@example.com", "password": "not-the-password"}
    )
    assert response.status_code == 401


async def test_login_unknown_email(client: AsyncClient):
    response = await client.post(
        LOGIN, json={"email": "ghost@example.com", "password": "password123"}
    )
    # Same status and message as a wrong password, so the response cannot be
    # used to discover which emails are registered.
    assert response.status_code == 401


async def test_me_requires_authentication(client: AsyncClient):
    assert (await client.get(ME)).status_code == 401


async def test_me_rejects_a_forged_cookie(client: AsyncClient):
    client.cookies.set("access_token", "not.a.real.jwt")
    assert (await client.get(ME)).status_code == 401
    client.cookies.clear()


async def test_logout_clears_the_cookie(client: AsyncClient):
    await client.post(REGISTER, json=credentials(email="logout@example.com"))
    await client.post(
        LOGIN, json={"email": "logout@example.com", "password": "password123"}
    )
    assert (await client.get(ME)).status_code == 200

    assert (await client.post(LOGOUT)).status_code == 200
    assert (await client.get(ME)).status_code == 401


async def test_register_creates_default_org(client: AsyncClient):
    """A fresh user must land on a usable dashboard, which requires at least
    one org.  Registration creates a default workspace automatically."""
    await client.post(REGISTER, json=credentials(email="fresh@example.com"))
    await client.post(
        LOGIN, json={"email": "fresh@example.com", "password": "password123"}
    )
    orgs_resp = await client.get(ORGS)
    assert orgs_resp.status_code == 200
    orgs = orgs_resp.json()
    assert len(orgs) == 1
    assert orgs[0]["name"] == "Test User's Workspace"

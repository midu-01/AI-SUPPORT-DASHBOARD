import asyncio

import pytest
import pytest_asyncio
from alembic import command
from alembic.config import Config
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.core.config import BACKEND_DIR, settings
from app.core.deps import get_db
from app.main import app

# NullPool: every connection is opened and closed on the loop that asked for it,
# so nothing is ever handed between event loops.
TEST_ENGINE = create_async_engine(
    settings.TEST_DATABASE_URL, echo=False, poolclass=NullPool
)
TestSessionLocal = async_sessionmaker(
    bind=TEST_ENGINE, class_=AsyncSession, expire_on_commit=False
)

# Child tables first so TRUNCATE order is valid even without CASCADE.
# user_organizations must come before both users and organizations.
TABLES = ("messages", "documents", "conversations", "user_organizations", "users", "organizations")


async def _reset_schema() -> None:
    engine = create_async_engine(
        settings.TEST_DATABASE_URL, poolclass=NullPool, isolation_level="AUTOCOMMIT"
    )
    async with engine.connect() as conn:
        await conn.execute(text("DROP SCHEMA public CASCADE"))
        await conn.execute(text("CREATE SCHEMA public"))
    await engine.dispose()


def _alembic_config() -> Config:
    cfg = Config(str(BACKEND_DIR / "alembic.ini"))
    cfg.set_main_option("script_location", str(BACKEND_DIR / "alembic"))
    # env.py reads this instead of DATABASE_URL, so migrations can never be
    # applied to the development database by accident.
    cfg.attributes["sqlalchemy_url"] = settings.TEST_DATABASE_URL
    return cfg


@pytest.fixture(scope="session", autouse=True)
def migrated_database():
    """Build the test schema with Alembic rather than Base.metadata.create_all.

    This means the migration itself is exercised on every test run — a migration
    that does not match the models fails the suite instead of shipping.
    """
    url = settings.TEST_DATABASE_URL
    db_name = url.rsplit("/", 1)[-1]
    # Guard against a mis-set TEST_DATABASE_URL wiping a real database.
    assert "test" in db_name, (
        f"TEST_DATABASE_URL must point at a test database, got {db_name!r}"
    )

    # Start from a genuinely empty schema: an earlier run may have left tables
    # behind with no alembic_version row, which would make `upgrade` fail with
    # "relation already exists".
    asyncio.run(_reset_schema())
    command.upgrade(_alembic_config(), "head")
    yield
    command.downgrade(_alembic_config(), "base")


@pytest_asyncio.fixture(autouse=True)
async def clean_tables(migrated_database):
    """Give every test an empty database.

    Rolling back the fixture's session cannot isolate tests here: the
    repositories commit their own transactions, so by the time a test ends its
    writes are already durable. Truncating before each test is what actually
    works.
    """
    async with TEST_ENGINE.begin() as conn:
        await conn.execute(text(f"TRUNCATE {', '.join(TABLES)} CASCADE"))
    yield


@pytest_asyncio.fixture
async def db_session():
    async with TestSessionLocal() as session:
        yield session


@pytest_asyncio.fixture
async def client(db_session: AsyncSession):
    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as ac:
        yield ac
    app.dependency_overrides.clear()

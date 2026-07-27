from typing import AsyncGenerator

from fastapi import Cookie, Depends, Header, status
from jwt.exceptions import InvalidTokenError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError
from app.core.security import decode_access_token
from app.db.session import AsyncSessionLocal
from app.models.organization import Organization
from app.models.user import User
from app.repositories.organization_repository import OrganizationRepository
from app.repositories.user_repository import UserRepository


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        yield session


async def get_current_user(
    access_token: str | None = Cookie(default=None),
    db: AsyncSession = Depends(get_db),
) -> User:
    credentials_exception = AppError(
        status_code=status.HTTP_401_UNAUTHORIZED,
        code="UNAUTHENTICATED",
        detail="Could not validate credentials",
    )
    if not access_token:
        raise credentials_exception
    try:
        payload = decode_access_token(access_token)
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except InvalidTokenError:
        raise credentials_exception

    user_repo = UserRepository(db)
    user = await user_repo.get_by_id(user_id)
    if user is None:
        raise credentials_exception
    return user


async def get_active_org(
    x_org_id: str | None = Header(default=None, alias="X-Org-ID"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Organization:
    """Resolve and authorise the active organisation from the ``X-Org-ID`` header.

    **Why a header, not a JWT claim or a second cookie?**

    - JWT claim: the token would need to be re-issued on every org switch, forcing a
      round-trip through the auth endpoint and a new ``Set-Cookie`` just to change
      context.  That couples two orthogonal concerns — identity and workspace — and
      makes switching feel like a partial re-login.
    - Separate cookie: the browser sends it automatically, which is convenient, but
      it is invisible to ``fetch`` calls that do not explicitly set it, and it is
      awkward to read in Next.js Server Components without going through the
      ``cookies()`` API on every request.
    - **Request header (chosen):** the frontend sets ``X-Org-ID`` on every API call
      after the user picks an org.  It is stateless — the server holds no session —
      and switching orgs is a client-side state change with no server round-trip.
      The header is explicit, easy to test with ``curl`` or Postman, and carries no
      CSRF risk because custom headers are blocked by the same-origin policy.

    **Authorisation:** membership is verified on every request, not cached.  A user
    removed from an org between requests will be rejected on the next call.  The
    response is always **404**, never 403 — a 403 would confirm the org exists to a
    non-member, leaking information the same way a 403 on a conversation would.
    """
    if not x_org_id:
        raise AppError(
            status_code=status.HTTP_400_BAD_REQUEST,
            code="ORG_REQUIRED",
            detail="X-Org-ID header is required",
        )

    org_repo = OrganizationRepository(db)

    # Verify membership first — if the user is not a member we return 404
    # regardless of whether the org exists, to avoid confirming its existence.
    is_member = await org_repo.is_member(current_user.id, x_org_id)
    if not is_member:
        raise AppError(
            status_code=status.HTTP_404_NOT_FOUND,
            code="ORGANIZATION_NOT_FOUND",
            detail="Organization not found",
        )

    org = await org_repo.get_by_id(x_org_id)
    # is_member passed, so the org must exist — but guard defensively.
    if org is None:  # pragma: no cover
        raise AppError(
            status_code=status.HTTP_404_NOT_FOUND,
            code="ORGANIZATION_NOT_FOUND",
            detail="Organization not found",
        )

    return org

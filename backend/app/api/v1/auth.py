from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.deps import get_current_user, get_db
from app.core.errors import AppError, error_docs
from app.core.security import create_access_token, hash_password, verify_password
from app.models.user import User
from app.repositories.user_repository import UserRepository
from app.schemas.errors import ValidationErrorResponse
from app.schemas.user import (
    LoginResponse,
    MessageResponse,
    UserCreate,
    UserLogin,
    UserRead,
)

router = APIRouter()


@router.post(
    "/register",
    response_model=UserRead,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new user",
    responses={
        **error_docs((409, "EMAIL_ALREADY_REGISTERED", "Email is already registered")),
        422: {"model": ValidationErrorResponse, "description": "Request failed validation"},
    },
)
async def register(payload: UserCreate, db: AsyncSession = Depends(get_db)):
    user_repo = UserRepository(db)
    existing = await user_repo.get_by_email(payload.email)
    if existing:
        raise AppError(
            status_code=status.HTTP_409_CONFLICT,
            code="EMAIL_ALREADY_REGISTERED",
            detail="Email already registered",
        )
    hashed = hash_password(payload.password)
    try:
        user = await user_repo.create(
            email=payload.email,
            hashed_password=hashed,
            full_name=payload.full_name,
        )
    except IntegrityError:
        # Two simultaneous registrations can both pass the check above; the
        # unique index on users.email is the actual guarantee, so translate its
        # violation into the same 409 instead of a 500.
        await db.rollback()
        raise AppError(
            status_code=status.HTTP_409_CONFLICT,
            code="EMAIL_ALREADY_REGISTERED",
            detail="Email already registered",
        )
    return user


@router.post(
    "/login",
    response_model=LoginResponse,
    summary="Login and receive an httpOnly cookie",
    description=(
        "On success the JWT is set as an `httpOnly`, `SameSite=Lax` cookie. It is "
        "deliberately **not** included in the response body: putting it there "
        "would expose to JavaScript the exact value the cookie exists to hide."
    ),
    responses=error_docs(
        (401, "INVALID_CREDENTIALS", "Unknown email or wrong password"),
    ),
)
async def login(
    payload: UserLogin,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    user_repo = UserRepository(db)
    user = await user_repo.get_by_email(payload.email)
    if not user or not verify_password(payload.password, user.hashed_password):
        # One message for both "no such user" and "wrong password", so the
        # response cannot be used to discover which emails are registered.
        raise AppError(
            status_code=status.HTTP_401_UNAUTHORIZED,
            code="INVALID_CREDENTIALS",
            detail="Invalid email or password",
        )
    token = create_access_token(user.id)
    response.set_cookie(
        key="access_token",
        value=token,
        httponly=True,
        samesite="lax",
        # Off in local development because there is no HTTPS; on everywhere else.
        secure=settings.APP_ENV != "development",
        # Derived from the token's own lifetime so the cookie and the JWT can
        # never expire at different times.
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )
    return LoginResponse()


@router.post(
    "/logout",
    response_model=MessageResponse,
    summary="Clear the auth cookie",
    description="Safe to call when not logged in; clearing an absent cookie is a no-op.",
)
async def logout(response: Response):
    # The attributes must match the ones used to set the cookie, otherwise
    # browsers treat it as a different cookie and leave the original in place.
    response.delete_cookie(
        key="access_token",
        httponly=True,
        samesite="lax",
        secure=settings.APP_ENV != "development",
    )
    return {"message": "Logged out"}


@router.get(
    "/me",
    response_model=UserRead,
    summary="Get current user",
    responses=error_docs(
        (401, "UNAUTHENTICATED", "Missing, forged, or expired authentication cookie")
    ),
)
async def me(current_user: User = Depends(get_current_user)):
    return current_user

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.deps import get_current_user, get_db
from app.core.security import create_access_token, hash_password, verify_password
from app.models.user import User
from app.repositories.user_repository import UserRepository
from app.schemas.user import LoginResponse, UserCreate, UserLogin, UserRead

router = APIRouter()


@router.post(
    "/register",
    response_model=UserRead,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new user",
)
async def register(payload: UserCreate, db: AsyncSession = Depends(get_db)):
    user_repo = UserRepository(db)
    existing = await user_repo.get_by_email(payload.email)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
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
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered",
        )
    return user


@router.post(
    "/login",
    response_model=LoginResponse,
    summary="Login and receive an httpOnly cookie",
)
async def login(
    payload: UserLogin,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    user_repo = UserRepository(db)
    user = await user_repo.get_by_email(payload.email)
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
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


@router.post("/logout", summary="Clear the auth cookie")
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


@router.get("/me", response_model=UserRead, summary="Get current user")
async def me(current_user: User = Depends(get_current_user)):
    return current_user

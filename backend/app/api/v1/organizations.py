from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, get_db
from app.core.errors import AppError, error_docs
from app.models.user import User
from app.repositories.organization_repository import OrganizationRepository
from app.repositories.user_repository import UserRepository
from app.schemas.organization import (
    AddMemberRequest,
    MembershipRead,
    OrganizationCreate,
    OrganizationCreated,
    OrganizationRead,
)

router = APIRouter()

# Shared 404 docs — same pattern as conversations.py
NOT_FOUND = error_docs(
    (404, "ORGANIZATION_NOT_FOUND", "Organization does not exist or you are not a member")
)

ALREADY_MEMBER = error_docs(
    (409, "ALREADY_MEMBER", "User is already a member of this organization")
)


def _check_membership(membership, *, org_id: str):
    """Raise 404 if the caller is not a member of the org.

    404 rather than 403 — a 403 would confirm the org exists to a non-member,
    which is the same information-leak we avoid on conversations.
    """
    if membership is None:
        raise AppError(
            status_code=status.HTTP_404_NOT_FOUND,
            code="ORGANIZATION_NOT_FOUND",
            detail="Organization not found",
        )


@router.post(
    "",
    response_model=OrganizationCreated,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new organization",
    description=(
        "Creates an organization and automatically adds the authenticated user "
        "as its first **admin** member. Both writes are committed atomically."
    ),
)
async def create_organization(
    payload: OrganizationCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    repo = OrganizationRepository(db)
    org = await repo.create(name=payload.name, creator_user_id=current_user.id)
    # Fetch the membership row that create() just committed so we can return it.
    membership = await repo.get_membership(current_user.id, org.id)
    return OrganizationCreated(
        organization=OrganizationRead.model_validate(org),
        membership=MembershipRead.model_validate(membership),
    )


@router.get(
    "",
    response_model=list[OrganizationRead],
    summary="List organizations the current user belongs to",
)
async def list_organizations(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    repo = OrganizationRepository(db)
    return await repo.list_by_user(user_id=current_user.id)


@router.post(
    "/{org_id}/members",
    response_model=MembershipRead,
    status_code=status.HTTP_201_CREATED,
    summary="Add a member to an organization",
    description=(
        "Only an existing **admin** of the organization may invite new members. "
        "Adding a user who is already a member returns **409**."
    ),
    responses={**NOT_FOUND, **ALREADY_MEMBER},
)
async def add_member(
    org_id: str,
    payload: AddMemberRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    repo = OrganizationRepository(db)

    # Caller must be a member (and specifically an admin) of the org.
    caller_membership = await repo.get_membership(current_user.id, org_id)
    _check_membership(caller_membership, org_id=org_id)

    if caller_membership.role != "admin":
        raise AppError(
            status_code=status.HTTP_403_FORBIDDEN,
            code="FORBIDDEN",
            detail="Only admins can add members",
        )

    # Verify the target user exists.
    user_repo = UserRepository(db)
    target_user = await user_repo.get_by_id(payload.user_id)
    if target_user is None:
        raise AppError(
            status_code=status.HTTP_404_NOT_FOUND,
            code="USER_NOT_FOUND",
            detail="User not found",
        )

    # Guard against duplicate membership.
    existing = await repo.get_membership(payload.user_id, org_id)
    if existing is not None:
        raise AppError(
            status_code=status.HTTP_409_CONFLICT,
            code="ALREADY_MEMBER",
            detail="User is already a member of this organization",
        )

    membership = await repo.add_member(
        user_id=payload.user_id, org_id=org_id, role=payload.role
    )
    return membership

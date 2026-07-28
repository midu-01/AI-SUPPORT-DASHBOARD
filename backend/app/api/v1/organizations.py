from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, get_db
from app.core.errors import AppError, error_docs
from app.models.user import User
from app.repositories.organization_repository import OrganizationRepository
from app.repositories.user_repository import UserRepository
from app.schemas.organization import (
    AddMemberRequest,
    InviteMemberRequest,
    MemberDetail,
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


@router.get(
    "/{org_id}/members",
    response_model=list[MemberDetail],
    summary="List members of an organization",
    description="Returns all members with their user info. Caller must be a member.",
    responses={**NOT_FOUND},
)
async def list_members(
    org_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    repo = OrganizationRepository(db)

    caller_membership = await repo.get_membership(current_user.id, org_id)
    _check_membership(caller_membership, org_id=org_id)

    memberships = await repo.list_members(org_id)
    return [
        MemberDetail(
            user_id=m.user_id,
            org_id=m.org_id,
            role=m.role,
            joined_at=m.joined_at,
            email=m.user.email,
            full_name=m.user.full_name,
        )
        for m in memberships
    ]


@router.post(
    "/{org_id}/members/invite",
    response_model=MembershipRead,
    status_code=status.HTTP_201_CREATED,
    summary="Invite a member by email",
    description=(
        "Looks up a registered user by email and adds them to the organization. "
        "Only an existing **admin** may invite. Returns **404** if the email is "
        "not registered, **409** if already a member."
    ),
    responses={**NOT_FOUND, **ALREADY_MEMBER},
)
async def invite_member_by_email(
    org_id: str,
    payload: InviteMemberRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    repo = OrganizationRepository(db)

    # Caller must be an admin of the org.
    caller_membership = await repo.get_membership(current_user.id, org_id)
    _check_membership(caller_membership, org_id=org_id)

    if caller_membership.role != "admin":
        raise AppError(
            status_code=status.HTTP_403_FORBIDDEN,
            code="FORBIDDEN",
            detail="Only admins can invite members",
        )

    # Look up the target user by email.
    user_repo = UserRepository(db)
    target_user = await user_repo.get_by_email(payload.email)
    if target_user is None:
        raise AppError(
            status_code=status.HTTP_404_NOT_FOUND,
            code="USER_NOT_FOUND",
            detail="No registered user with that email address",
        )

    # Guard against duplicate membership.
    existing = await repo.get_membership(target_user.id, org_id)
    if existing is not None:
        raise AppError(
            status_code=status.HTTP_409_CONFLICT,
            code="ALREADY_MEMBER",
            detail="User is already a member of this organization",
        )

    membership = await repo.add_member(
        user_id=target_user.id, org_id=org_id, role=payload.role
    )
    return membership

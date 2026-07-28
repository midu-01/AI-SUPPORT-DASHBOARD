from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.models.organization import Organization, UserOrganization


class OrganizationRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    # ------------------------------------------------------------------
    # Reads
    # ------------------------------------------------------------------

    async def get_by_id(self, org_id: str) -> Organization | None:
        result = await self.db.execute(
            select(Organization).where(Organization.id == org_id)
        )
        return result.scalar_one_or_none()

    async def list_by_user(self, user_id: str) -> list[Organization]:
        """Return every org the user is a member of, ordered by name."""
        result = await self.db.execute(
            select(Organization)
            .join(UserOrganization, UserOrganization.org_id == Organization.id)
            .where(UserOrganization.user_id == user_id)
            .order_by(Organization.name)
        )
        return list(result.scalars().all())

    async def get_membership(
        self, user_id: str, org_id: str
    ) -> UserOrganization | None:
        """Return the join-table row, or None if the user is not a member."""
        result = await self.db.execute(
            select(UserOrganization).where(
                UserOrganization.user_id == user_id,
                UserOrganization.org_id == org_id,
            )
        )
        return result.scalar_one_or_none()

    async def is_member(self, user_id: str, org_id: str) -> bool:
        """Convenience boolean — use get_membership when you need the row."""
        return await self.get_membership(user_id, org_id) is not None

    # ------------------------------------------------------------------
    # Writes
    # ------------------------------------------------------------------

    async def create(self, name: str, creator_user_id: str) -> Organization:
        """Create an org and immediately add the creator as admin.

        Both writes happen in a single commit so the org never exists
        without at least one admin.
        """
        org = Organization(name=name)
        self.db.add(org)
        await self.db.flush()  # populate org.id before the FK insert

        membership = UserOrganization(
            user_id=creator_user_id,
            org_id=org.id,
            role="admin",
        )
        self.db.add(membership)
        await self.db.commit()
        await self.db.refresh(org)
        return org

    async def add_member(
        self, user_id: str, org_id: str, role: str = "member"
    ) -> UserOrganization:
        """Add a user to an org.  Caller must verify the org exists first."""
        membership = UserOrganization(user_id=user_id, org_id=org_id, role=role)
        self.db.add(membership)
        await self.db.commit()
        await self.db.refresh(membership)
        return membership

    async def list_members(
        self, org_id: str
    ) -> list[UserOrganization]:
        """Return all memberships for an org, eagerly loading the user."""
        result = await self.db.execute(
            select(UserOrganization)
            .options(joinedload(UserOrganization.user))
            .where(UserOrganization.org_id == org_id)
            .order_by(UserOrganization.joined_at)
        )
        return list(result.scalars().all())

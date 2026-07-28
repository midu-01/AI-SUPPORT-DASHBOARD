"""backfill and enforce org_id not null on conversations and documents

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-07-28 00:00:01.000000

The preceding migration deliberately introduced org_id as nullable. This migration
assigns legacy resources to each user's earliest membership, creates a default admin
organization for a legacy user with no memberships, and then makes both columns
NOT NULL to enforce that every resource belongs to exactly one organization.
"""
import uuid
from datetime import datetime, timezone
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "b2c3d4e5f6a7"
down_revision: Union[str, None] = "a1b2c3d4e5f6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _backfill_legacy_users() -> None:
    connection = op.get_bind()

    legacy_users = connection.execute(
        sa.text(
            """
            SELECT DISTINCT u.id, u.full_name
            FROM users AS u
            WHERE EXISTS (
                SELECT 1 FROM conversations AS c
                WHERE c.user_id = u.id AND c.org_id IS NULL
            ) OR EXISTS (
                SELECT 1 FROM documents AS d
                WHERE d.user_id = u.id AND d.org_id IS NULL
            )
            """
        )
    ).mappings()

    for user in legacy_users:
        org_id = connection.scalar(
            sa.text(
                """
                SELECT org_id
                FROM user_organizations
                WHERE user_id = :user_id
                ORDER BY joined_at, org_id
                LIMIT 1
                """
            ),
            {"user_id": user["id"]},
        )

        if org_id is None:
            org_id = str(uuid.uuid4())
            now = datetime.now(timezone.utc)
            connection.execute(
                sa.text(
                    """
                    INSERT INTO organizations (id, name, created_at)
                    VALUES (:id, :name, :created_at)
                    """
                ),
                {
                    "id": org_id,
                    "name": f"{user['full_name']}'s Workspace",
                    "created_at": now,
                },
            )
            connection.execute(
                sa.text(
                    """
                    INSERT INTO user_organizations (user_id, org_id, role, joined_at)
                    VALUES (:user_id, :org_id, 'admin', :joined_at)
                    """
                ),
                {"user_id": user["id"], "org_id": org_id, "joined_at": now},
            )

        for table_name in ("conversations", "documents"):
            connection.execute(
                sa.text(
                    f"""
                    UPDATE {table_name}
                    SET org_id = :org_id
                    WHERE user_id = :user_id AND org_id IS NULL
                    """
                ),
                {"org_id": org_id, "user_id": user["id"]},
            )


def upgrade() -> None:
    _backfill_legacy_users()

    op.alter_column(
        "conversations",
        "org_id",
        existing_type=sa.String(length=36),
        nullable=False,
    )
    op.alter_column(
        "documents",
        "org_id",
        existing_type=sa.String(length=36),
        nullable=False,
    )


def downgrade() -> None:
    op.alter_column(
        "documents",
        "org_id",
        existing_type=sa.String(length=36),
        nullable=True,
    )
    op.alter_column(
        "conversations",
        "org_id",
        existing_type=sa.String(length=36),
        nullable=True,
    )

"""add organizations, user_organizations; add org_id to conversations and documents

Revision ID: a1b2c3d4e5f6
Revises: 2c786f6fcf5b
Create Date: 2026-07-28 00:00:00.000000

NOTE: org_id is nullable on both conversations and documents. Rows created before
organizations existed have no org assignment. In production the migration path is:
  1. add nullable column (this migration)
  2. backfill: assign existing rows to a default/migrated org
  3. ALTER COLUMN SET NOT NULL
Step 3 is deferred — see ASSUMPTIONS.md for the scope decision.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = '2c786f6fcf5b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'organizations',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )

    op.create_table(
        'user_organizations',
        sa.Column('user_id', sa.String(length=36), nullable=False),
        sa.Column('org_id', sa.String(length=36), nullable=False),
        sa.Column(
            'role',
            sa.Enum(
                'member', 'admin',
                name='org_role',
                native_enum=False,
                create_constraint=True,
                length=10,
            ),
            nullable=False,
        ),
        sa.Column('joined_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['org_id'], ['organizations.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('user_id', 'org_id'),
    )

    # Replace the user-only index with an org+user composite before adding the column
    op.drop_index('ix_conversations_user_updated', table_name='conversations')
    op.add_column(
        'conversations',
        sa.Column('org_id', sa.String(length=36), nullable=True),
    )
    op.create_foreign_key(
        'fk_conversations_org_id',
        'conversations', 'organizations',
        ['org_id'], ['id'],
        ondelete='CASCADE',
    )
    op.create_index(
        'ix_conversations_org_user_updated',
        'conversations',
        ['org_id', 'user_id', 'updated_at'],
    )

    op.drop_index('ix_documents_user_id', table_name='documents')
    op.add_column(
        'documents',
        sa.Column('org_id', sa.String(length=36), nullable=True),
    )
    op.create_foreign_key(
        'fk_documents_org_id',
        'documents', 'organizations',
        ['org_id'], ['id'],
        ondelete='CASCADE',
    )
    op.create_index('ix_documents_org_user', 'documents', ['org_id', 'user_id'])


def downgrade() -> None:
    op.drop_index('ix_documents_org_user', table_name='documents')
    op.drop_constraint('fk_documents_org_id', 'documents', type_='foreignkey')
    op.drop_column('documents', 'org_id')
    op.create_index('ix_documents_user_id', 'documents', ['user_id'])

    op.drop_index('ix_conversations_org_user_updated', table_name='conversations')
    op.drop_constraint('fk_conversations_org_id', 'conversations', type_='foreignkey')
    op.drop_column('conversations', 'org_id')
    op.create_index(
        'ix_conversations_user_updated', 'conversations', ['user_id', 'updated_at']
    )

    op.drop_table('user_organizations')
    op.drop_table('organizations')

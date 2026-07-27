import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, Index, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Conversation(Base):
    __tablename__ = "conversations"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    org_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    user: Mapped["User"] = relationship(back_populates="conversations")  # noqa: F821
    organization: Mapped["Organization"] = relationship(  # noqa: F821
        back_populates="conversations"
    )
    messages: Mapped[list["Message"]] = relationship(  # noqa: F821
        back_populates="conversation", cascade="all, delete-orphan"
    )

    # Serves the dashboard's "recent conversations" query, which is now scoped to
    # the active organization as well as the user:
    #   WHERE org_id = ? AND user_id = ? ORDER BY updated_at DESC
    # org_id leads because it is the coarser filter and every list/search query
    # carries it; user_id alone no longer appears without an org.
    # The index is ascending on purpose — PostgreSQL scans a btree backwards just
    # as cheaply, so an explicit DESC only matters when mixing sort directions.
    __table_args__ = (
        Index("ix_conversations_org_user_updated", "org_id", "user_id", "updated_at"),
    )

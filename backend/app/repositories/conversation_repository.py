from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.conversation import Conversation
from app.models.message import Message


def _escape_like(value: str) -> str:
    """Escape LIKE wildcards so a user searching for "50%" doesn't match everything."""
    return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


class ConversationRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_by_id(self, conversation_id: str) -> Conversation | None:
        result = await self.db.execute(
            select(Conversation).where(Conversation.id == conversation_id)
        )
        return result.scalar_one_or_none()

    async def list_by_user(
        self,
        user_id: str,
        org_id: str,
        query: str | None = None,
        page: int = 1,
        size: int = 20,
    ) -> tuple[list[Conversation], int]:
        # Both filters are required: user_id scopes to the owner, org_id scopes
        # to the active organisation.  The composite index
        # ix_conversations_org_user_updated (org_id, user_id, updated_at) covers
        # this query exactly — org_id leads because it is the coarser filter.
        base_query = select(Conversation).where(
            Conversation.user_id == user_id,
            Conversation.org_id == org_id,
        )

        if query and query.strip():
            # Match the conversation title, or the text of any message inside it.
            # .any() becomes an EXISTS subquery, so a conversation with several
            # matching messages is still returned once — no JOIN + DISTINCT needed.
            pattern = f"%{_escape_like(query.strip())}%"
            base_query = base_query.where(
                or_(
                    Conversation.title.ilike(pattern, escape="\\"),
                    Conversation.messages.any(
                        Message.content.ilike(pattern, escape="\\")
                    ),
                )
            )

        count_result = await self.db.execute(
            select(func.count()).select_from(base_query.subquery())
        )
        total = count_result.scalar_one()

        result = await self.db.execute(
            base_query.order_by(Conversation.updated_at.desc())
            .offset((page - 1) * size)
            .limit(size)
        )
        return result.scalars().all(), total

    async def create(self, user_id: str, org_id: str, title: str) -> Conversation:
        conversation = Conversation(user_id=user_id, org_id=org_id, title=title)
        self.db.add(conversation)
        await self.db.commit()
        await self.db.refresh(conversation)
        return conversation

    async def update(self, conversation: Conversation, title: str) -> Conversation:
        conversation.title = title
        await self.db.commit()
        await self.db.refresh(conversation)
        return conversation

    async def delete(self, conversation: Conversation) -> None:
        await self.db.delete(conversation)
        await self.db.commit()

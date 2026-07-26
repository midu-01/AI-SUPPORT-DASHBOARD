from datetime import datetime, timezone

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.conversation import Conversation
from app.models.message import Message, MessageRole


class MessageRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def list_by_conversation(self, conversation_id: str) -> list[Message]:
        result = await self.db.execute(
            select(Message)
            .where(Message.conversation_id == conversation_id)
            .order_by(Message.created_at.asc())
        )
        return result.scalars().all()

    async def create(
        self, conversation_id: str, role: MessageRole, content: str
    ) -> Message:
        message = Message(
            conversation_id=conversation_id, role=role, content=content
        )
        self.db.add(message)

        # Bump the parent conversation so it rises to the top of "recent
        # conversations". SQLAlchemy's onupdate only fires when a column on the
        # conversation itself changes, and inserting a child row is not that —
        # without this, an active conversation would sink down the list.
        await self.db.execute(
            update(Conversation)
            .where(Conversation.id == conversation_id)
            .values(updated_at=datetime.now(timezone.utc))
        )

        await self.db.commit()
        await self.db.refresh(message)
        return message

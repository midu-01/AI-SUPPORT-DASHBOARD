from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

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
        await self.db.commit()
        await self.db.refresh(message)
        return message

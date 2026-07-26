from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, get_db
from app.models.conversation import Conversation
from app.models.document import Document
from app.models.message import Message
from app.models.user import User
from app.schemas.conversation import ConversationRead
from app.schemas.document import DocumentRead
from app.schemas.user import UserRead

router = APIRouter()


class DashboardSummary(BaseModel):
    user: UserRead
    total_conversations: int
    total_documents: int
    total_messages: int
    recent_conversations: list[ConversationRead]
    recent_documents: list[DocumentRead]


@router.get(
    "/summary",
    response_model=DashboardSummary,
    summary="Get dashboard summary for the current user",
)
async def dashboard_summary(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Counts
    conv_count = await db.scalar(
        select(func.count(Conversation.id)).where(Conversation.user_id == current_user.id)
    )
    doc_count = await db.scalar(
        select(func.count(Document.id)).where(Document.user_id == current_user.id)
    )
    msg_count = await db.scalar(
        select(func.count(Message.id)).join(Conversation).where(
            Conversation.user_id == current_user.id
        )
    )

    # Recent conversations (last 5)
    recent_convs_result = await db.execute(
        select(Conversation)
        .where(Conversation.user_id == current_user.id)
        .order_by(Conversation.updated_at.desc())
        .limit(5)
    )
    recent_convs = recent_convs_result.scalars().all()

    # Recent documents (last 5)
    recent_docs_result = await db.execute(
        select(Document)
        .where(Document.user_id == current_user.id)
        .order_by(Document.uploaded_at.desc())
        .limit(5)
    )
    recent_docs = recent_docs_result.scalars().all()

    return DashboardSummary(
        user=current_user,
        total_conversations=conv_count or 0,
        total_documents=doc_count or 0,
        total_messages=msg_count or 0,
        recent_conversations=recent_convs,
        recent_documents=recent_docs,
    )

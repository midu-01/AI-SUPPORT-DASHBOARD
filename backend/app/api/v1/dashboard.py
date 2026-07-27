from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_active_org, get_current_user, get_db
from app.models.conversation import Conversation
from app.models.document import Document
from app.models.message import Message
from app.models.organization import Organization
from app.models.user import User
from app.schemas.conversation import ConversationRead
from app.schemas.document import DocumentRead
from app.schemas.organization import OrganizationRead
from app.schemas.user import UserRead

router = APIRouter()


class DashboardSummary(BaseModel):
    user: UserRead
    current_org: OrganizationRead
    total_conversations: int
    total_documents: int
    total_messages: int
    recent_conversations: list[ConversationRead]
    recent_documents: list[DocumentRead]


@router.get(
    "/summary",
    response_model=DashboardSummary,
    summary="Get dashboard summary for the current user and active organisation",
)
async def dashboard_summary(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    active_org: Organization = Depends(get_active_org),
):
    # All five queries are scoped to both the user and the active org so that
    # switching org immediately changes every count and list on the dashboard.
    conv_count = await db.scalar(
        select(func.count(Conversation.id)).where(
            Conversation.user_id == current_user.id,
            Conversation.org_id == active_org.id,
        )
    )
    doc_count = await db.scalar(
        select(func.count(Document.id)).where(
            Document.user_id == current_user.id,
            Document.org_id == active_org.id,
        )
    )
    # Message count: join to Conversation so we can filter by org without a
    # separate org_id column on messages.
    msg_count = await db.scalar(
        select(func.count(Message.id)).join(Conversation).where(
            Conversation.user_id == current_user.id,
            Conversation.org_id == active_org.id,
        )
    )

    # Recent conversations (last 5, org-scoped)
    recent_convs_result = await db.execute(
        select(Conversation)
        .where(
            Conversation.user_id == current_user.id,
            Conversation.org_id == active_org.id,
        )
        .order_by(Conversation.updated_at.desc())
        .limit(5)
    )
    recent_convs = recent_convs_result.scalars().all()

    # Recent documents (last 5, org-scoped)
    recent_docs_result = await db.execute(
        select(Document)
        .where(
            Document.user_id == current_user.id,
            Document.org_id == active_org.id,
        )
        .order_by(Document.uploaded_at.desc())
        .limit(5)
    )
    recent_docs = recent_docs_result.scalars().all()

    return DashboardSummary(
        user=current_user,
        current_org=active_org,
        total_conversations=conv_count or 0,
        total_documents=doc_count or 0,
        total_messages=msg_count or 0,
        recent_conversations=recent_convs,
        recent_documents=recent_docs,
    )

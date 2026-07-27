from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_active_org, get_current_user, get_db
from app.core.errors import AppError, error_docs
from app.models.organization import Organization
from app.models.user import User
from app.repositories.conversation_repository import ConversationRepository
from app.repositories.message_repository import MessageRepository
from app.schemas.conversation import (
    ConversationCreate,
    ConversationRead,
    ConversationUpdate,
    PaginatedConversations,
)
from app.schemas.message import MessageCreate, MessageRead

router = APIRouter()

# Deliberately 404 and not 403 — see _check_ownership below.
NOT_FOUND = error_docs(
    (
        404,
        "CONVERSATION_NOT_FOUND",
        "Conversation does not exist, or belongs to another user or organisation",
    )
)


def _check_ownership(conversation, current_user: User, active_org: Organization):
    """Return 404 regardless — avoids leaking resource existence via 403.

    Checks both user ownership and org membership so that a user who is a member
    of org A cannot read a conversation that belongs to org B, even if they know
    the UUID.  Both conditions are tested together: the caller cannot distinguish
    "wrong user" from "wrong org" from "doesn't exist".
    """
    if (
        conversation is None
        or conversation.user_id != current_user.id
        or conversation.org_id != active_org.id
    ):
        raise AppError(
            status_code=status.HTTP_404_NOT_FOUND,
            code="CONVERSATION_NOT_FOUND",
            detail="Conversation not found",
        )


@router.post(
    "",
    response_model=ConversationRead,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new conversation",
)
async def create_conversation(
    payload: ConversationCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    active_org: Organization = Depends(get_active_org),
):
    repo = ConversationRepository(db)
    return await repo.create(
        user_id=current_user.id, org_id=active_org.id, title=payload.title
    )


@router.get(
    "",
    response_model=PaginatedConversations,
    summary="List conversations (with optional search + pagination)",
)
async def list_conversations(
    q: str | None = Query(default=None, description="Search query"),
    page: int = Query(default=1, ge=1),
    size: int = Query(default=20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    active_org: Organization = Depends(get_active_org),
):
    repo = ConversationRepository(db)
    items, total = await repo.list_by_user(
        user_id=current_user.id, org_id=active_org.id, query=q, page=page, size=size
    )
    return PaginatedConversations(items=items, total=total, page=page, size=size)


@router.get(
    "/{conversation_id}",
    response_model=ConversationRead,
    summary="Get a single conversation",
    responses=NOT_FOUND,
)
async def get_conversation(
    conversation_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    active_org: Organization = Depends(get_active_org),
):
    repo = ConversationRepository(db)
    conversation = await repo.get_by_id(conversation_id)
    _check_ownership(conversation, current_user, active_org)
    return conversation


@router.patch(
    "/{conversation_id}",
    response_model=ConversationRead,
    summary="Rename a conversation",
    responses=NOT_FOUND,
)
async def update_conversation(
    conversation_id: str,
    payload: ConversationUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    active_org: Organization = Depends(get_active_org),
):
    repo = ConversationRepository(db)
    conversation = await repo.get_by_id(conversation_id)
    _check_ownership(conversation, current_user, active_org)
    return await repo.update(conversation, title=payload.title)


@router.delete(
    "/{conversation_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a conversation",
    responses=NOT_FOUND,
)
async def delete_conversation(
    conversation_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    active_org: Organization = Depends(get_active_org),
):
    repo = ConversationRepository(db)
    conversation = await repo.get_by_id(conversation_id)
    _check_ownership(conversation, current_user, active_org)
    await repo.delete(conversation)


# ── Messages ──────────────────────────────────────────────────────────────────

@router.get(
    "/{conversation_id}/messages",
    response_model=list[MessageRead],
    summary="Get all messages in a conversation",
    responses=NOT_FOUND,
)
async def list_messages(
    conversation_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    active_org: Organization = Depends(get_active_org),
):
    conv_repo = ConversationRepository(db)
    conversation = await conv_repo.get_by_id(conversation_id)
    _check_ownership(conversation, current_user, active_org)

    msg_repo = MessageRepository(db)
    return await msg_repo.list_by_conversation(conversation_id)


@router.post(
    "/{conversation_id}/messages",
    response_model=MessageRead,
    status_code=status.HTTP_201_CREATED,
    summary="Add a message to a conversation",
    responses=NOT_FOUND,
)
async def create_message(
    conversation_id: str,
    payload: MessageCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    active_org: Organization = Depends(get_active_org),
):
    conv_repo = ConversationRepository(db)
    conversation = await conv_repo.get_by_id(conversation_id)
    _check_ownership(conversation, current_user, active_org)

    msg_repo = MessageRepository(db)
    return await msg_repo.create(
        conversation_id=conversation_id,
        role=payload.role,
        content=payload.content,
    )

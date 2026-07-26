from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, get_db
from app.core.errors import AppError
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


def _check_ownership(conversation, current_user: User):
    """Return 404 regardless — avoids leaking resource existence via 403.

    "Missing" and "belongs to someone else" are deliberately indistinguishable:
    a 403 would confirm that the id is real, letting an attacker enumerate which
    conversations exist without ever being able to read one.
    """
    if conversation is None or conversation.user_id != current_user.id:
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
):
    repo = ConversationRepository(db)
    return await repo.create(user_id=current_user.id, title=payload.title)


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
):
    repo = ConversationRepository(db)
    items, total = await repo.list_by_user(
        user_id=current_user.id, query=q, page=page, size=size
    )
    return PaginatedConversations(items=items, total=total, page=page, size=size)


@router.get(
    "/{conversation_id}",
    response_model=ConversationRead,
    summary="Get a single conversation",
)
async def get_conversation(
    conversation_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    repo = ConversationRepository(db)
    conversation = await repo.get_by_id(conversation_id)
    _check_ownership(conversation, current_user)
    return conversation


@router.patch(
    "/{conversation_id}",
    response_model=ConversationRead,
    summary="Rename a conversation",
)
async def update_conversation(
    conversation_id: str,
    payload: ConversationUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    repo = ConversationRepository(db)
    conversation = await repo.get_by_id(conversation_id)
    _check_ownership(conversation, current_user)
    return await repo.update(conversation, title=payload.title)


@router.delete(
    "/{conversation_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a conversation",
)
async def delete_conversation(
    conversation_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    repo = ConversationRepository(db)
    conversation = await repo.get_by_id(conversation_id)
    _check_ownership(conversation, current_user)
    await repo.delete(conversation)


# ── Messages ──────────────────────────────────────────────────────────────────

@router.get(
    "/{conversation_id}/messages",
    response_model=list[MessageRead],
    summary="Get all messages in a conversation",
)
async def list_messages(
    conversation_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    conv_repo = ConversationRepository(db)
    conversation = await conv_repo.get_by_id(conversation_id)
    _check_ownership(conversation, current_user)

    msg_repo = MessageRepository(db)
    return await msg_repo.list_by_conversation(conversation_id)


@router.post(
    "/{conversation_id}/messages",
    response_model=MessageRead,
    status_code=status.HTTP_201_CREATED,
    summary="Add a message to a conversation",
)
async def create_message(
    conversation_id: str,
    payload: MessageCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    conv_repo = ConversationRepository(db)
    conversation = await conv_repo.get_by_id(conversation_id)
    _check_ownership(conversation, current_user)

    msg_repo = MessageRepository(db)
    return await msg_repo.create(
        conversation_id=conversation_id,
        role=payload.role,
        content=payload.content,
    )

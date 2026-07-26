from fastapi import APIRouter

from app.api.v1.auth import router as auth_router
from app.api.v1.conversations import router as conversations_router
from app.api.v1.dashboard import router as dashboard_router
from app.api.v1.documents import router as documents_router

router = APIRouter()

router.include_router(auth_router, prefix="/auth", tags=["auth"])
router.include_router(conversations_router, prefix="/conversations", tags=["conversations"])
router.include_router(documents_router, prefix="/documents", tags=["documents"])
router.include_router(dashboard_router, prefix="/dashboard", tags=["dashboard"])

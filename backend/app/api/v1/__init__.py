from fastapi import APIRouter

from app.api.v1.auth import router as auth_router
from app.api.v1.conversations import router as conversations_router
from app.api.v1.dashboard import router as dashboard_router
from app.api.v1.documents import router as documents_router
from app.api.v1.organizations import router as organizations_router
from app.core.errors import protected_route_responses

router = APIRouter()

# Every route below requires the auth cookie, so 401 and the validation-error
# shape are declared once here rather than repeated on each endpoint.
PROTECTED = protected_route_responses()

router.include_router(auth_router, prefix="/auth", tags=["auth"])
router.include_router(
    conversations_router,
    prefix="/conversations",
    tags=["conversations"],
    responses=PROTECTED,
)
router.include_router(
    documents_router, prefix="/documents", tags=["documents"], responses=PROTECTED
)
router.include_router(
    dashboard_router, prefix="/dashboard", tags=["dashboard"], responses=PROTECTED
)
router.include_router(
    organizations_router,
    prefix="/organizations",
    tags=["organizations"],
    responses=PROTECTED,
)

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.errors import register_exception_handlers
from app.schemas.errors import ValidationErrorResponse
from app.api.v1 import router as api_router

TAGS_METADATA = [
    {
        "name": "auth",
        "description": (
            "Registration and session management. The JWT is delivered as an "
            "`httpOnly`, `SameSite=Lax` cookie and never in a response body, so "
            "it is unreadable from JavaScript."
        ),
    },
    {
        "name": "conversations",
        "description": (
            "Conversations and their messages. Every route is scoped to the "
            "authenticated user; another user's conversation returns **404, not "
            "403**, because a 403 would confirm that the id exists."
        ),
    },
    {
        "name": "documents",
        "description": (
            "Document metadata. Files are validated and stored, but no content "
            "extraction or AI processing happens — `status` is the hook a future "
            "indexing pipeline would drive."
        ),
    },
    {"name": "dashboard", "description": "Aggregated counts and recent activity."},
    {"name": "health", "description": "Liveness probe."},
]

app = FastAPI(
    title="AI Support Dashboard API",
    version="1.0.0",
    description=(
        "Backend API for the AI-Ready Customer Support Dashboard.\n\n"
        "**Authentication:** call `POST /api/v1/auth/login`; the browser stores the "
        "returned cookie and sends it automatically. In Swagger UI, log in via that "
        "endpoint and subsequent calls on this page are authenticated.\n\n"
        "**Errors** all share one shape: `{ \"detail\": ..., \"code\": ... }`. Branch "
        "on `code`, never on `detail`."
    ),
    openapi_tags=TAGS_METADATA,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Every error leaves the app as { detail, code } — see app/core/errors.py.
register_exception_handlers(app)

app.include_router(
    api_router,
    prefix="/api/v1",
    # Applied once here so no endpoint advertises FastAPI's built-in
    # HTTPValidationError, which is not the shape this API actually returns.
    responses={
        422: {
            "model": ValidationErrorResponse,
            "description": "Request failed validation",
        }
    },
)


@app.get("/health", tags=["health"])
def health_check():
    return {"status": "ok"}

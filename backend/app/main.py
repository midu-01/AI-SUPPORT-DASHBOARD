from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.errors import register_exception_handlers
from app.api.v1 import router as api_router

app = FastAPI(
    title="AI Support Dashboard API",
    version="1.0.0",
    description="Backend API for the AI-Ready Customer Support Dashboard",
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

app.include_router(api_router, prefix="/api/v1")


@app.get("/health", tags=["health"])
def health_check():
    return {"status": "ok"}

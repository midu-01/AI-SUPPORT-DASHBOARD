from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

# backend/app/core/config.py -> backend/
BACKEND_DIR = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    # App
    APP_ENV: str = "development"
    SECRET_KEY: str = "change-me-in-production"

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://midu@localhost:5432/ai_support"
    TEST_DATABASE_URL: str = "postgresql+asyncpg://midu@localhost:5432/ai_support_test"

    # JWT
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours

    # CORS
    ALLOWED_ORIGINS: list[str] = ["http://localhost:3000"]

    # File upload
    MAX_UPLOAD_SIZE_BYTES: int = 10 * 1024 * 1024  # 10 MB
    ALLOWED_MIME_TYPES: list[str] = [
        "application/pdf",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "text/plain",
    ]
    UPLOAD_DIR: str = "uploads"

    @property
    def upload_path(self) -> Path:
        """UPLOAD_DIR resolved to an absolute path.

        Left relative, the upload location would move with the process's working
        directory, so files written by `uvicorn` started in backend/ would be
        invisible to a process started from the repo root.
        """
        configured = Path(self.UPLOAD_DIR)
        return configured if configured.is_absolute() else BACKEND_DIR / configured

    # Absolute path, so settings load the same whether the process starts in
    # backend/ (uvicorn, alembic) or the repo root (pytest from an IDE).
    model_config = SettingsConfigDict(
        env_file=BACKEND_DIR / ".env",
        case_sensitive=True,
        extra="ignore",
    )


settings = Settings()

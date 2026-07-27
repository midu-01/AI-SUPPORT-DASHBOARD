# Import all models here so Alembic can detect them
from app.models.conversation import Conversation  # noqa: F401
from app.models.document import Document  # noqa: F401
from app.models.message import Message  # noqa: F401
from app.models.organization import Organization, UserOrganization  # noqa: F401
from app.models.user import User  # noqa: F401

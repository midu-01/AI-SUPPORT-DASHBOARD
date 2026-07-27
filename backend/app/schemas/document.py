from datetime import datetime

from pydantic import BaseModel

from app.models.document import DocumentStatus


class DocumentRead(BaseModel):
    id: str
    user_id: str
    org_id: str
    filename: str
    original_filename: str
    mime_type: str
    size_bytes: int
    storage_path: str
    status: DocumentStatus
    uploaded_at: datetime

    model_config = {"from_attributes": True}

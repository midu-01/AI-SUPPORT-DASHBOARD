"""Response models for the error envelope, so Swagger documents failures too.

Without these, `/docs` shows the success shape for every endpoint and FastAPI's
own `HTTPValidationError` for 422 — neither of which matches what this API
actually returns.
"""

from pydantic import BaseModel, Field


class ErrorResponse(BaseModel):
    detail: str = Field(description="Human-readable message, safe to display.")
    code: str = Field(
        description="Stable machine-readable identifier. Branch on this, not on `detail`."
    )

    model_config = {
        "json_schema_extra": {
            "example": {"detail": "Conversation not found", "code": "CONVERSATION_NOT_FOUND"}
        }
    }


class ValidationErrorItem(BaseModel):
    field: str = Field(description="Dotted path to the offending field, e.g. `email`.")
    message: str = Field(description="What was wrong with it.")


class ValidationErrorResponse(ErrorResponse):
    errors: list[ValidationErrorItem] = Field(
        description="One entry per invalid field, flattened for direct form mapping."
    )

    model_config = {
        "json_schema_extra": {
            "example": {
                "detail": "Invalid request",
                "code": "VALIDATION_ERROR",
                "errors": [
                    {
                        "field": "email",
                        "message": "value is not a valid email address",
                    },
                    {
                        "field": "password",
                        "message": "String should have at least 8 characters",
                    },
                ],
            }
        }
    }

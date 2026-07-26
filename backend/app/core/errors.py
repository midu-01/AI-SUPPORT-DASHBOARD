"""A single error shape for the whole API.

Every failure — raised deliberately, produced by validation, or entirely
unforeseen — leaves the application as:

    { "detail": "Human-readable message", "code": "MACHINE_READABLE_CODE" }

`detail` is for the person reading the response; `code` is for the frontend,
which should never have to match on English prose to decide what to render.
"""

import logging

from fastapi import FastAPI, Request, status
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

logger = logging.getLogger(__name__)


class AppError(StarletteHTTPException):
    """An HTTPException that also carries a machine-readable code."""

    def __init__(self, status_code: int, code: str, detail: str):
        super().__init__(status_code=status_code, detail=detail)
        self.code = code


# Fallbacks for HTTPExceptions raised without an explicit code, including the
# ones FastAPI itself raises before any of our code runs. Numeric literals
# rather than status.HTTP_* constants: Starlette has renamed several of these
# (413 and 422 among them) and the numbers are the stable spelling.
_DEFAULT_CODES = {
    400: "BAD_REQUEST",
    401: "UNAUTHENTICATED",
    403: "FORBIDDEN",
    404: "NOT_FOUND",
    405: "METHOD_NOT_ALLOWED",
    409: "CONFLICT",
    413: "PAYLOAD_TOO_LARGE",
    422: "VALIDATION_ERROR",
}

HTTP_422_UNPROCESSABLE = 422
HTTP_413_TOO_LARGE = 413


def error_docs(*entries: tuple[int, str, str]) -> dict:
    """Build an OpenAPI `responses` entry for each (status, code, description).

    Documented failures are as much a part of the contract as the success shape:
    a client that only knows the 200 body has to guess at everything else.
    """
    from app.schemas.errors import ErrorResponse  # local import: avoids a cycle

    documented: dict[int, dict] = {}
    for status_code, code, description in entries:
        documented[status_code] = {
            "model": ErrorResponse,
            "description": description,
            "content": {
                "application/json": {
                    "example": {"detail": description, "code": code}
                }
            },
        }
    return documented


def protected_route_responses() -> dict:
    """The failures every authenticated endpoint shares."""
    from app.schemas.errors import ValidationErrorResponse

    responses = error_docs(
        (401, "UNAUTHENTICATED", "Missing, forged, or expired authentication cookie"),
    )
    # Overrides FastAPI's built-in HTTPValidationError, which is not what the
    # RequestValidationError handler actually returns.
    responses[422] = {
        "model": ValidationErrorResponse,
        "description": "Request failed validation",
    }
    return responses


def _envelope(status_code: int, code: str, detail: str, **extra) -> JSONResponse:
    return JSONResponse(
        status_code=status_code, content={"detail": detail, "code": code, **extra}
    )


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(StarletteHTTPException)
    async def http_exception_handler(request: Request, exc: StarletteHTTPException):
        code = getattr(exc, "code", None) or _DEFAULT_CODES.get(
            exc.status_code, "HTTP_ERROR"
        )
        response = _envelope(exc.status_code, code, str(exc.detail))
        # 401s must keep any WWW-Authenticate header the raiser set.
        if exc.headers:
            response.headers.update(exc.headers)
        return response

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(
        request: Request, exc: RequestValidationError
    ):
        """Flatten FastAPI's nested validation output into something a form can use.

        The default body is a list of dicts with tuple locations, which pushes the
        job of interpreting it onto every client.
        """
        errors = [
            {
                # Drop the leading "body"/"query" segment: the client knows where
                # it put the field.
                "field": ".".join(str(p) for p in error["loc"][1:]) or "request",
                "message": error["msg"],
            }
            for error in exc.errors()
        ]
        summary = errors[0]["message"] if len(errors) == 1 else "Invalid request"
        return _envelope(
            HTTP_422_UNPROCESSABLE,
            "VALIDATION_ERROR",
            summary,
            errors=jsonable_encoder(errors),
        )

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(request: Request, exc: Exception):
        """Last line of defence.

        The traceback goes to the logs, never to the client — an internal error
        message can disclose file paths, queries, or library versions.
        """
        logger.exception("Unhandled error on %s %s", request.method, request.url.path)
        return _envelope(
            status.HTTP_500_INTERNAL_SERVER_ERROR,
            "INTERNAL_ERROR",
            "An unexpected error occurred.",
        )

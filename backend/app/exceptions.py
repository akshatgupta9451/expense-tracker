import logging

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

logger = logging.getLogger("app.errors")


class AppError(Exception):
    status_code = status.HTTP_400_BAD_REQUEST
    code = "bad_request"

    def __init__(self, message: str, details: dict | list | None = None):
        super().__init__(message)
        self.message = message
        self.details = details or {}


class NotFoundError(AppError):
    status_code = status.HTTP_404_NOT_FOUND
    code = "not_found"


class ConflictError(AppError):
    status_code = status.HTTP_409_CONFLICT
    code = "conflict"


class AuthError(AppError):
    status_code = status.HTTP_401_UNAUTHORIZED
    code = "unauthorized"


class ForbiddenError(AppError):
    status_code = status.HTTP_403_FORBIDDEN
    code = "forbidden"


class TooManyRequestsError(AppError):
    status_code = status.HTTP_429_TOO_MANY_REQUESTS
    code = "rate_limited"

    def __init__(self, message: str, retry_after: int | None = None):
        super().__init__(message)
        self.retry_after = retry_after


class ServiceUnavailableError(AppError):
    status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    code = "service_unavailable"


class ValidationError(AppError):
    """Business-rule validation that needs the database (e.g. type must match category)."""

    status_code = status.HTTP_422_UNPROCESSABLE_CONTENT
    code = "validation_error"

    def __init__(self, field: str, message: str):
        super().__init__("Invalid request data", details=[{"field": field, "message": message}])


def _error(status_code: int, code: str, message: str, details: dict | list | None = None):
    return JSONResponse(
        status_code=status_code,
        content={"error": {"code": code, "message": message, "details": details or {}}},
    )


def app_error_response(exc: AppError) -> JSONResponse:
    response = _error(exc.status_code, exc.code, exc.message, exc.details)
    if isinstance(exc, AuthError):
        response.headers["WWW-Authenticate"] = "Bearer"
    if isinstance(exc, TooManyRequestsError) and exc.retry_after:
        response.headers["Retry-After"] = str(exc.retry_after)
    return response


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def handle_app_error(_: Request, exc: AppError):
        return app_error_response(exc)

    @app.exception_handler(RequestValidationError)
    async def handle_validation_error(_: Request, exc: RequestValidationError):
        details = [
            {"field": ".".join(str(p) for p in err["loc"][1:]), "message": err["msg"]}
            for err in exc.errors()
        ]
        return _error(422, "validation_error", "Invalid request data", details)

    @app.exception_handler(StarletteHTTPException)
    async def handle_http_error(_: Request, exc: StarletteHTTPException):
        # Unknown routes (404), wrong method (405), etc. use the same error envelope.
        codes = {404: "not_found", 405: "method_not_allowed"}
        response = _error(exc.status_code, codes.get(exc.status_code, "http_error"), exc.detail)
        for key, value in (exc.headers or {}).items():
            response.headers[key] = value
        return response

    @app.exception_handler(Exception)
    async def handle_unexpected_error(request: Request, exc: Exception):
        # Log the real error server-side; never leak internals to the client.
        logger.exception("Unhandled error on %s %s", request.method, request.url.path)
        return _error(500, "internal_error", "Something went wrong. Please try again.")

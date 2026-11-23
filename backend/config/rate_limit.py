from fastapi import Request
from fastapi.responses import JSONResponse
from slowapi import Limiter
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address


# Shared limiter instance used by app middleware and route decorators.
# - key_func uses client IP (same default behavior as express-rate-limit).
# - default_limits applies the global API limit to all requests.
limiter = Limiter(
    key_func=get_remote_address,
    default_limits=["200000/15 minutes"],
    headers_enabled=True,
)

AUTH_RATE_LIMIT = "20/15 minutes"
AUTH_RATE_LIMIT_PATHS = {"/auth/login", "/auth/signup", "/auth/signup/owner"}


async def rate_limit_exceeded_handler(request: Request, exc: RateLimitExceeded) -> JSONResponse:
    """Return project-consistent 429 responses while preserving rate-limit headers."""
    is_auth_endpoint = request.url.path in AUTH_RATE_LIMIT_PATHS
    message = (
        "Too many login attempts, please try again later."
        if is_auth_endpoint
        else "Too many requests, please try again later."
    )

    response = JSONResponse(
        status_code=429,
        content={"success": False, "message": message},
    )

    # SlowAPI exposes the computed limit header value on the exception in recent versions.
    # Preserve any headers already attached by the exception object.
    exc_headers = getattr(exc, "headers", None)
    if isinstance(exc_headers, dict):
        response.headers.update(exc_headers)

    retry_after = getattr(exc, "retry_after", None)
    if retry_after is not None and "Retry-After" not in response.headers:
        response.headers["Retry-After"] = str(retry_after)

    # Fallback: if SlowAPI provided detail in "X per Y" form, expose a basic limit header.
    if "X-RateLimit-Limit" not in response.headers:
        detail = getattr(exc, "detail", "")
        if isinstance(detail, str) and "per" in detail:
            response.headers["X-RateLimit-Limit"] = detail

    return response

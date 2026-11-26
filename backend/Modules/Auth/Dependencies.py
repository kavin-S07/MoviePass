from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer


# HttpOnly cookie the FastAPI side sets with the short-lived access token.
ACCESS_COOKIE_NAME = "access_token"


# Declares Bearer auth for OpenAPI/Swagger while keeping extraction flexible.
# auto_error=False preserves existing behavior (query-token fallback, custom 401).
_bearer_scheme = HTTPBearer(
    auto_error=False,
    scheme_name="BearerAuth",
    description="JWT access token. In Swagger, click Authorize and paste the access token only.",
)


# Resolve the token from the Authorization header (standard clients
# such as Swagger/Postman), falling back to the access-token cookie the
# browser sends on same-origin requests, then the ?token= query param.
def get_token(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer_scheme),
) -> str:

    # Prefer FastAPI security credentials (adds OpenAPI bearer scheme)
    if credentials and credentials.scheme.lower() == "bearer" and credentials.credentials:

        token = credentials.credentials.strip()

        if token:

            return token

    # Backward-compatible manual header parsing
    auth_header = request.headers.get("Authorization", "")

    if auth_header.startswith("Bearer "):

        token = auth_header[len("Bearer "):].strip()

        if token:

            return token

    # Cookie fallback: the frontend uses the HttpOnly access cookie.
    token = request.cookies.get(ACCESS_COOKIE_NAME, "").strip()

    if token:

        return token

    # Backward-compatible query param token (used by existing frontend flows)
    token = request.query_params.get("token", "").strip()

    if token:

        return token

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Missing token. Send Authorization: Bearer <token>, an access_token cookie, or ?token=<token>",
    )

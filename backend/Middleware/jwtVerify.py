from fastapi import Request
from fastapi.responses import JSONResponse
from jose import JWTError

from config.Jwt import decode_access_token


# JWT verify middleware
async def verify_jwt(request: Request, call_next):

    # Skip CORS preflight
    if request.method == "OPTIONS":
        return await call_next(request)

    # Skip login, signups, and cookie-based refresh/logout flows
    if request.url.path in [
        "/auth/login",
        "/auth/signup",
        "/auth/signup/owner",
        "/auth/refresh",
        "/auth/logout",
    ]:
        return await call_next(request)

    # Skip public and documentation routes
    if request.url.path in ["/", "/docs", "/openapi.json", "/redoc"]:
        return await call_next(request)

    # Skip social OAuth routes (no MoviePass JWT yet)
    if request.url.path.startswith("/auth/google"):
        return await call_next(request)

    # Get token from header or query
    auth_header = request.headers.get("Authorization", "")

    if auth_header.startswith("Bearer "):
        token = auth_header[len("Bearer "):].strip()
    else:
        token = request.query_params.get("token", "").strip()

    # Verify token
    try:

        decode_access_token(token)

    except JWTError:

        return JSONResponse(
            status_code=401,
            content={"detail": "Invalid or expired token"}
        )

    return await call_next(request)

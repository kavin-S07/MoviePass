from fastapi import HTTPException, Request, status


# Resolve the token from the Authorization header (standard clients
# such as Postman), falling back to the ?token= query param used by
# the React frontend.
def get_token(request: Request) -> str:

    auth_header = request.headers.get("Authorization", "")

    if auth_header.startswith("Bearer "):

        token = auth_header[len("Bearer "):].strip()

        if token:

            return token

    token = request.query_params.get("token", "").strip()

    if token:

        return token

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Missing token. Send Authorization: Bearer <token> or ?token=<token>",
    )

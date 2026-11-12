import os
import httpx

from authlib.integrations.starlette_client import OAuth

from dotenv import load_dotenv

load_dotenv()


FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")

OWNER_FRONTEND_URL = os.getenv("OWNER_FRONTEND_URL", "http://localhost:5174")


# Provider definitions. Secrets stay on the server.
PROVIDERS = {
    "google": {
        "client_id": os.getenv("GOOGLE_CLIENT_ID", ""),
        "client_secret": os.getenv("GOOGLE_CLIENT_SECRET", ""),
        "auth_url": "https://accounts.google.com/o/oauth2/v2/auth",
        "token_url": "https://oauth2.googleapis.com/token",
        "userinfo_url": "https://openidconnect.googleapis.com/v1/userinfo",
        "scopes": "openid email profile",
    },
}


# Authlib registry. Configured here so client code can create clients.
oauth = OAuth()


# Register providers; credentials may be empty in development.
oauth.register(
    name="google",
    client_id=PROVIDERS["google"]["client_id"],
    client_secret=PROVIDERS["google"]["client_secret"],
    server_metadata_url="https://accounts.google.com/.well-known/openid-configuration",
    client_kwargs={
        "scope": PROVIDERS["google"]["scopes"]
    },
)


# Fetch the verified provider profile for an authenticated session.
async def fetch_profile(provider: str, token: dict):

    if provider != "google":

        raise ValueError(f"Unsupported provider: {provider}")

    cfg = PROVIDERS["google"]

    async with httpx.AsyncClient(timeout=15, base_url=cfg["userinfo_url"]) as client:

        claims = token.get("userinfo") or {}

        if not claims:

            res = await client.get("", headers={"Authorization": f"Bearer {token['access_token']}"})

            res.raise_for_status()

            claims = res.json()

        return {
            "provider_user_id": claims.get("sub"),
            "email": (claims.get("email") or "").strip().lower(),
            "name": claims.get("name"),
            "email_verified": bool(claims.get("email_verified", False)),
        }


# Redirect URL validation: always a configured frontend origin.
def frontend_redirect(app: str, fragment: str):

    if app == "owner":

        base = OWNER_FRONTEND_URL

    else:

        base = FRONTEND_URL

    base = base.rstrip("/") + "/"

    return f"{base}#{fragment}"

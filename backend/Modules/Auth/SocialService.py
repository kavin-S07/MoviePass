import urllib.parse

from authlib.integrations.base_client.errors import OAuthError
from sqlalchemy.orm import Session
from starlette.requests import Request

from Modules.Auth import Repository, Service
from Modules.Auth.Schema import UserRole
from Modules.Auth.Social import fetch_profile, frontend_redirect, oauth


# Build the redirect URL carrying only the MoviePass access token.
# The refresh token is delivered via an HttpOnly cookie by the controller.
def build_success_redirect(user, app: str, access_token: str):

    fragment = urllib.parse.urlencode({
        "access_token": access_token,
    })

    return frontend_redirect(app, fragment)


# Social login start: send the browser to the provider
async def oauth_start(request: Request, provider: str):

    client = oauth.create_client(provider)

    if not client or not client.client_id:

        return frontend_redirect(
            request.query_params.get("app", "booker"),
            "error=oauth_not_configured"
        )

    app = request.query_params.get("app", "booker")

    request.session["oauth_app"] = app

    redirect_uri = request.url_for(
        "social_callback",
        provider=provider
    )

    return await client.authorize_redirect(request, redirect_uri)


# Social login callback: finish the flow and create a refresh session.
# Returns (redirect_url, refresh_token_or_None).
async def oauth_callback(
    db: Session,
    request: Request,
    provider: str
):

    app = request.session.get("oauth_app", "booker")

    client = oauth.create_client(provider)

    try:

        token = await client.authorize_access_token(request)

        profile = await fetch_profile(provider, token)

    except OAuthError:

        return frontend_redirect(app, "error=provider_auth_failed"), None

    except Exception:

        return frontend_redirect(app, "error=provider_auth_failed"), None

    if not profile.get("email"):

        return frontend_redirect(app, "error=email_missing"), None

    email = profile["email"].strip().lower()

    # Only accounts with a provider-verified email may sign in.
    if not profile.get("email_verified", False):

        return frontend_redirect(app, "error=email_not_verified"), None

    # Existing linked social account -> log the user in
    social_account = Repository.get_social_account(
        db,
        provider,
        profile["provider_user_id"]
    )

    if social_account:

        user = Repository.get_user_by_id(
            db,
            social_account.user_id
        )

        if not user:

            return frontend_redirect(app, "error=account_not_found"), None

        access_token, refresh_token = Service.issue_session_tokens(db, user, request)
        db.commit()

        return build_success_redirect(user, app, access_token), refresh_token

    # Verified provider identity -> link to existing account if any
    existing_user = Repository.get_user_by_email(
        db,
        email
    )

    if existing_user:

        Repository.create_social_account(
            db,
            existing_user.id,
            provider,
            profile["provider_user_id"],
            email
        )

        access_token, refresh_token = Service.issue_session_tokens(db, existing_user, request)
        db.commit()

        return build_success_redirect(existing_user, app, access_token), refresh_token

    # New social signup -> always TICKET_BOOKER
    new_user_data = {
        "name": profile.get("name") or email.split("@")[0],
        "email": email,
        "password": None,
        "role": UserRole.TICKET_BOOKER.value,
        "phone_no": None,
        "approval_status": "APPROVED",
    }

    new_user = Repository.create_user(
        db,
        new_user_data
    )

    Repository.create_social_account(
        db,
        new_user.id,
        provider,
        profile["provider_user_id"],
        email
    )

    access_token, refresh_token = Service.issue_session_tokens(db, new_user, request)
    db.commit()

    return build_success_redirect(new_user, app, access_token), refresh_token

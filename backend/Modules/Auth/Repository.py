from datetime import datetime, timezone

from sqlalchemy.orm import Session

from Modules.Auth.Model import RefreshSession, SocialAccount, User


# Find user by email
def get_user_by_email(db: Session, email: str):

    return db.query(User).filter(
        User.email == email
    ).first()


# Find social account by provider and provider user id
def get_social_account(db: Session, provider: str, provider_user_id: str):

    return db.query(SocialAccount).filter(
        SocialAccount.provider == provider,
        SocialAccount.provider_user_id == provider_user_id
    ).first()


# Create social account mapping
def create_social_account(db: Session, user_id: int, provider: str, provider_user_id: str, provider_email: str = None):

    social_account = SocialAccount(
        user_id=user_id,
        provider=provider,
        provider_user_id=provider_user_id,
        provider_email=provider_email
    )

    db.add(social_account)

    db.flush()

    return social_account


# Find all pending theatre owners
def get_pending_owners(db: Session):

    return db.query(User).filter(
        User.role == "THEATRE_OWNER",
        User.approval_status == "PENDING"
    ).all()


# Set a theatre owner's approval status
def set_owner_approval(db: Session, user_id: int, status: str):

    owner = db.query(User).filter(
        User.id == user_id,
        User.role == "THEATRE_OWNER"
    ).first()

    if not owner:

        return None

    owner.approval_status = status

    db.flush()

    return owner


# Find user by ID
def get_user_by_id(db: Session, user_id: int):

    return db.query(User).filter(
        User.id == user_id
    ).first()


# Create user
def create_user(db: Session, user_data: dict):

    new_user = User(**user_data)

    db.add(new_user)

    db.flush()

    db.refresh(new_user)

    return new_user


# Create a refresh session record
def create_refresh_session(db: Session, session_data: dict):

    session = RefreshSession(**session_data)

    db.add(session)

    db.flush()

    db.refresh(session)

    return session


# Find session by jti/hash (locks row when requested)
def get_refresh_session_by_hash(db: Session, refresh_token_hash: str, for_update: bool = False):

    query = db.query(RefreshSession).filter(
        RefreshSession.refresh_token_hash == refresh_token_hash
    )

    if for_update:

        query = query.with_for_update()

    return query.first()


def get_active_refresh_sessions_for_user(db: Session, user_id: int):

    now = datetime.now(timezone.utc)

    return db.query(RefreshSession).filter(
        RefreshSession.user_id == user_id,
        RefreshSession.is_active.is_(True),
        RefreshSession.revoked_at.is_(None),
        RefreshSession.expires_at > now
    ).order_by(RefreshSession.created_at.desc()).all()


def get_user_refresh_session(db: Session, user_id: int, session_id: int):

    return db.query(RefreshSession).filter(
        RefreshSession.id == session_id,
        RefreshSession.user_id == user_id
    ).first()


def revoke_refresh_session(session: RefreshSession):

    session.is_active = False

    if session.revoked_at is None:

        session.revoked_at = datetime.now(timezone.utc)


def revoke_all_user_refresh_sessions(db: Session, user_id: int):

    sessions = db.query(RefreshSession).filter(
        RefreshSession.user_id == user_id,
        RefreshSession.is_active.is_(True)
    ).all()

    for session in sessions:

        revoke_refresh_session(session)

    return sessions

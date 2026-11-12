from datetime import datetime, timezone

from sqlalchemy import (
    BigInteger,
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Identity,
    Index,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship

from config.database import Base


class User(Base):

    __tablename__ = "users"

    id = Column(
        BigInteger,
        Identity(always=True),
        primary_key=True
    )

    name = Column(String(100), nullable=False)

    email = Column(String(255), unique=True, nullable=False)

    password = Column(String(255), nullable=True)

    role = Column(String(30), nullable=False)

    phone_no = Column(String(10), nullable=True)

    # APPROVED, PENDING or REJECTED. Owner signups start as PENDING.
    approval_status = Column(
        String(20),
        nullable=False,
        default="APPROVED",
        server_default="APPROVED"
    )

    refresh_sessions = relationship(
        "RefreshSession",
        back_populates="user",
        cascade="all, delete-orphan"
    )


class SocialAccount(Base):

    __tablename__ = "social_accounts"

    __table_args__ = (
        UniqueConstraint(
            "provider",
            "provider_user_id",
            name="uq_social_accounts_provider_user"
        ),
    )

    id = Column(
        BigInteger,
        Identity(always=True),
        primary_key=True
    )

    user_id = Column(
        BigInteger,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )

    provider = Column(String(20), nullable=False)

    provider_user_id = Column(String(255), nullable=False)

    provider_email = Column(String(255), nullable=True)

    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc)
    )


class RefreshSession(Base):

    __tablename__ = "refresh_sessions"

    __table_args__ = (
        Index("ix_refresh_sessions_user_id", "user_id"),
        Index("ix_refresh_sessions_is_active", "is_active"),
        Index("ix_refresh_sessions_expires_at", "expires_at"),
    )

    id = Column(
        BigInteger,
        Identity(always=True),
        primary_key=True
    )

    user_id = Column(
        BigInteger,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False
    )

    # Stores jti/session identifier; unique and never the raw refresh token.
    refresh_token_hash = Column(
        String(255),
        unique=True,
        nullable=False,
        index=True
    )

    ip_address = Column(String(45), nullable=True)

    user_agent = Column(Text, nullable=True)

    device_name = Column(String(255), nullable=True)

    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc)
    )

    expires_at = Column(
        DateTime(timezone=True),
        nullable=False
    )

    last_used_at = Column(
        DateTime(timezone=True),
        nullable=True
    )

    revoked_at = Column(
        DateTime(timezone=True),
        nullable=True
    )

    is_active = Column(
        Boolean,
        nullable=False,
        default=True,
        server_default="true"
    )

    user = relationship("User", back_populates="refresh_sessions")

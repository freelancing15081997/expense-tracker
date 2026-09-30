"""
Application settings
"""

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional, List
from pathlib import Path
import os


BASE_DIR = Path(__file__).parent.parent


class Settings(BaseSettings):
    """Application settings"""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="allow",
    )

    # Application
    APP_ENV: str = "development"
    APP_NAME: str = "Byjan Business"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False
    SECRET_KEY: str

    # Database
    DATABASE_URL: str
    DB_POOL_SIZE: int = 5
    DB_MAX_OVERFLOW: int = 5

    @field_validator("DATABASE_URL", mode="before")
    @classmethod
    def _asyncpg_url(cls, value: str) -> str:
        """Accept a normal Neon URL and make it usable by asyncpg."""
        if not isinstance(value, str):
            return value
        url = value.strip()
        if url.startswith("postgres://"):
            url = "postgresql://" + url[len("postgres://"):]
        if url.startswith("postgresql://"):
            url = "postgresql+asyncpg://" + url[len("postgresql://"):]
        # asyncpg rejects libpq-only query params
        for token in ("sslmode=require", "sslmode=verify-full", "sslmode=prefer", "channel_binding=require"):
            url = url.replace(token, "")
        url = url.replace("?&", "?").replace("&&", "&").rstrip("?&")
        if url.startswith("postgresql+asyncpg://") and "ssl=" not in url:
            url += "&ssl=require" if "?" in url else "?ssl=require"
        return url
    DB_POOL_TIMEOUT: int = 30
    DB_POOL_RECYCLE: int = 3600

    # Redis
    REDIS_URL: Optional[str] = None
    REDIS_ENABLED: bool = False

    # Firebase
    FIREBASE_PROJECT_ID: Optional[str] = None
    FIREBASE_SERVICE_ACCOUNT_PATH: Optional[str] = None
    FIREBASE_SERVICE_ACCOUNT_JSON: Optional[str] = None  # full SA JSON string (Render)

    # JWT — HS256 uses JWT_SECRET_KEY (or JWT_PRIVATE_KEYS / JWT_PUBLIC_KEYS if set)
    JWT_SECRET_KEY: str
    JWT_PRIVATE_KEYS: Optional[str] = None
    JWT_PUBLIC_KEYS: Optional[str] = None
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    JWT_REFRESH_TOKEN_EXPIRE_DAYS: int = 30
    REFRESH_COOKIE_NAME: str = "byjan_refresh"

    # OTP
    OTP_LENGTH: int = 6
    OTP_EXPIRE_MINUTES: int = 5
    OTP_MAX_ATTEMPTS: int = 3
    OTP_RESEND_COOLDOWN_SECONDS: int = 30

    # Password
    PASSWORD_MIN_LENGTH: int = 8
    PASSWORD_REQUIRE_UPPERCASE: bool = True
    PASSWORD_REQUIRE_LOWERCASE: bool = True
    PASSWORD_REQUIRE_NUMBER: bool = True
    PASSWORD_REQUIRE_SPECIAL: bool = True

    # TOTP
    TOTP_ISSUER: str = "Byjan Business"
    TOTP_DIGITS: int = 6
    TOTP_PERIOD: int = 30
    TOTP_RECOVERY_CODES: int = 10

    # Email — Brevo SMTP on authenticated easypado.com (same as Money)
    EMAIL_API_KEY: Optional[str] = None
    EMAIL_FROM: str = "byjanbooks@easypado.com"
    EMAIL_PROVIDER: str = "brevo"  # brevo smtp | legacy resend label
    SMTP_HOST: str = "smtp-relay.brevo.com"
    SMTP_PORT: int = 587
    SMTP_USER: Optional[str] = None
    SMTP_PASS: Optional[str] = None
    MAIL_FROM: str = "byjanbooks@easypado.com"
    BREVO_API_KEY: Optional[str] = None  # HTTPS send from Render (free tier blocks SMTP)
    PASSWORD_RESET_CONTINUE_URL: str = ""  # empty = Firebase hosted reset page (no domain allowlist)
    # Render free blocks SMTP ports — relay through Cloudflare Worker when set
    MAIL_RELAY_URL: str = "https://www.easypado.com/api/email/relay"
    MAIL_RELAY_SECRET: Optional[str] = None

    # SMS/WhatsApp
    WHATSAPP_ACCESS_TOKEN: Optional[str] = None
    WHATSAPP_PHONE_ID: Optional[str] = None
    SMS_API_KEY: Optional[str] = None

    # GSP (GST filing)
    GSP_API_KEY: Optional[str] = None
    GSP_BASE_URL: str = "https://api.gsp.gov.in"

    # Storage
    S3_ENDPOINT: Optional[str] = None
    S3_ACCESS_KEY_ID: Optional[str] = None
    S3_SECRET_ACCESS_KEY: Optional[str] = None
    S3_BUCKET_NAME: str = "byjan-files"
    S3_REGION: str = "ap-south-1"

    # Webhooks
    WEBHOOK_SECRET: Optional[str] = None
    WEBHOOK_TIMEOUT_SECONDS: int = 30

    # Rate Limiting
    RATE_LIMIT_LOGIN_ATTEMPTS: int = 5
    RATE_LIMIT_LOGIN_WINDOW_MINUTES: int = 15
    RATE_LIMIT_OTP_ATTEMPTS: int = 3
    RATE_LIMIT_OTP_WINDOW_MINUTES: int = 60

    # Idempotency
    IDEMPOTENCY_EXPIRE_HOURS: int = 24

    # Audit
    AUDIT_RETENTION_DAYS: int = 365
    AUDIT_CHAIN_HASH: bool = True

    # Logging
    LOG_LEVEL: str = "INFO"
    LOG_JSON: bool = False

    # Feature Flags
    FEATURE_EINVOICE: bool = False
    FEATURE_EWAYBILL: bool = False
    FEATURE_GST_FILING: bool = False
    FEATURE_BANK_FEED: bool = False
    FEATURE_WHATSAPP: bool = False

    # CORS
    ALLOWED_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:5175",
        "https://business.easypado.com",
        "https://app.easypado.com",
        "https://byjan-business-frontend.pages.dev",
    ]

    # Security
    SECURE_COOKIES: bool = True
    SESSION_EXPIRE_DAYS: int = 30
    SESSION_INACTIVITY_DAYS: int = 7
    PASSWORD_RESET_EXPIRE_HOURS: int = 24
    EMAIL_VERIFY_EXPIRE_HOURS: int = 24

    # Workers
    WORKER_CONCURRENCY: int = 4
    WORKER_MAX_JOBS: int = 100
    WORKER_MAX_RETRIES: int = 3

    # Notifications
    NOTIFICATION_RETENTION_DAYS: int = 30
    NOTIFICATION_BATCH_SIZE: int = 100


# Global settings instance
settings = Settings()

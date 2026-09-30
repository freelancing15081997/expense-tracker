"""
Platform API schemas (Pydantic request/response models)
"""

from pydantic import BaseModel, Field, EmailStr, field_validator
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum


# Auth schemas
class FirebaseExchangeRequest(BaseModel):
    """Firebase ID token exchange request"""
    id_token: str
    name: Optional[str] = None


class OtpSendRequest(BaseModel):
    """OTP send request"""
    channel: str = Field(..., pattern="^(sms|email|whatsapp)$")
    identifier: str
    purpose: str = Field(..., pattern="^(signin|verify|reset|step_up)$")


class OtpVerifyRequest(BaseModel):
    """OTP verify request"""
    identifier: str
    code: str = Field(..., min_length=6, max_length=6)
    purpose: str


class RefreshRequest(BaseModel):
    """Refresh token request"""
    refresh_token: Optional[str] = None


class MfaSetupResponse(BaseModel):
    """MFA setup response"""
    otpauth_uri: str
    recovery_codes: List[str]


class MfaConfirmRequest(BaseModel):
    """MFA confirm request"""
    code: str


class MfaChallengeRequest(BaseModel):
    """MFA challenge request"""
    code: str
    recovery_code: Optional[str] = None


class StepUpRequest(BaseModel):
    """Step-up authentication request"""
    method: str = Field(..., pattern="^(otp|mfa)$")
    code: str


class AuthResponse(BaseModel):
    """Authentication response"""
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int


# Me schemas
class MeResponse(BaseModel):
    """Current user response"""
    id: str
    firebase_uid: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    name: Optional[str] = None
    lang: str = "en"
    ui: Dict[str, Any] = Field(default_factory=dict)
    sup: bool = False
    mfa_enabled: bool = False
    tenants: List[Dict[str, Any]] = Field(default_factory=list)
    session_timeout_min: int = 30
    other_sessions: int = 0


class MeUpdateRequest(BaseModel):
    """Update profile request"""
    name: Optional[str] = None
    phone: Optional[str] = None
    avatar_file_id: Optional[str] = None
    lang: Optional[str] = Field(None, pattern="^(en|te|ta|kn|hi)$")
    ui: Optional[Dict[str, Any]] = None


class PermissionsResponse(BaseModel):
    """Effective permissions response"""
    matrix: Dict[str, Dict[str, bool]]
    abac: Dict[str, Any]


class Session(BaseModel):
    """Session response"""
    id: str
    device: str
    ip: str
    city: Optional[str]
    last_seen: datetime
    current: bool


class ActivityLog(BaseModel):
    """Activity log response"""
    timestamp: datetime
    action: str
    details: Dict[str, Any]


# Tenant schemas
class TenantCreateRequest(BaseModel):
    """Create tenant request"""
    kind: str = Field(..., pattern="^(business|practice|dhani)$")
    name: str = Field(..., min_length=1, max_length=255)
    gstin: Optional[str] = None
    state: Optional[str] = None
    fy_start: int = Field(default=4, ge=1, le=12)
    lang: str = Field(default="en", pattern="^(en|te|ta|kn|hi)$")


class TenantUpdateRequest(BaseModel):
    """Update tenant request"""
    name: Optional[str] = None
    legal: Optional[Dict[str, Any]] = None
    address: Optional[Dict[str, Any]] = None
    logo: Optional[str] = None
    bank: Optional[Dict[str, Any]] = None
    upi: Optional[str] = None


class TenantSettingsRequest(BaseModel):
    """Update tenant settings request"""
    terms: Optional[Dict[str, Any]] = None
    einvoice: Optional[Dict[str, Any]] = None
    ewaybill: Optional[Dict[str, Any]] = None
    tds: Optional[Dict[str, Any]] = None
    round_off: Optional[Dict[str, Any]] = None
    reminders: Optional[Dict[str, Any]] = None
    tally: Optional[Dict[str, Any]] = None
    feed: Optional[Dict[str, Any]] = None
    approvals: Optional[Dict[str, Any]] = None
    lock_after_close: Optional[bool] = None
    date_format: Optional[str] = None


class NumberingUpdateRequest(BaseModel):
    """Update numbering series request"""
    prefix: str
    next_number: int
    reset_per_fy: bool = False


class FeatureSwitchRequest(BaseModel):
    """Update feature switches request"""
    key: str
    enabled: bool


# Member schemas
class MemberCreateRequest(BaseModel):
    """Create member request"""
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    role_id: str
    scope: Optional[List[str]] = None
    kind: str = Field(default="member", pattern="^(member|ca)$")
    message: Optional[str] = None


class MemberUpdateRequest(BaseModel):
    """Update member request"""
    role_id: Optional[str] = None
    scope: Optional[List[str]] = None


# Role schemas
class RoleCreateRequest(BaseModel):
    """Create role request"""
    name: str = Field(..., min_length=1, max_length=255)
    from_role_id: Optional[str] = None


class RoleUpdateRequest(BaseModel):
    """Update role request"""
    name: Optional[str] = None
    description: Optional[str] = None
    limits: Optional[Dict[str, Any]] = None


class RolePermissionsRequest(BaseModel):
    """Update role permissions request"""
    permissions: Dict[str, Dict[str, bool]]


class ViewAsRequest(BaseModel):
    """View-as request"""
    role_id: Optional[str] = None
    user_id: Optional[str] = None


# File schemas
class FileCreateRequest(BaseModel):
    """Create file request"""
    purpose: str
    name: str
    mime: str
    size: int
    sha256: str


class FileResponse(BaseModel):
    """File response"""
    file_id: str
    upload_url: str
    headers: Dict[str, str]


# Notification schemas
class NotificationPreferenceRequest(BaseModel):
    """Update notification preferences request"""
    preferences: Dict[str, Dict[str, bool]]


# Search schemas
class SearchRequest(BaseModel):
    """Search request"""
    q: str = Field(..., min_length=1)
    types: Optional[List[str]] = None


# Export schemas
class ExportRequest(BaseModel):
    """Export request"""
    resource: str
    filter: Optional[Dict[str, Any]] = None
    format: str = Field(default="csv", pattern="^(csv|xlsx|pdf)$")


# Audit schemas
class AuditQuery(BaseModel):
    """Audit query parameters"""
    entity_type: Optional[str] = None
    entity_id: Optional[str] = None
    actor: Optional[str] = None
    module: Optional[str] = None
    from_date: Optional[datetime] = None
    to_date: Optional[datetime] = None


# Console schemas
class ConsoleOverviewResponse(BaseModel):
    """Console overview response"""
    tenants: int
    active_users: int
    error_rate: float
    job_health: Dict[str, Any]
    service_status: Dict[str, str]


class IssueCreateRequest(BaseModel):
    """Create console issue request"""
    sev: str = Field(..., pattern="^(critical|warning|info)$")
    title: str
    module: Optional[str] = None
    tenant_id: Optional[str] = None
    trace_ids: Optional[List[str]] = None


class IssueUpdateRequest(BaseModel):
    """Update console issue request"""
    resolution: Optional[str] = None


class ViewAsConsoleRequest(BaseModel):
    """Console view-as request"""
    tenant_id: str
    user_id: str

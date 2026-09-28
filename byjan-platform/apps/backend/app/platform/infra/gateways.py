"""
Platform infrastructure gateways - external system adapters
"""

import structlog
from typing import Dict, Any
from app.shared.types import Result

log = structlog.get_logger(__name__)


class MockWhatsAppGateway:
    """Mock WhatsApp gateway - logs warning when API key is missing"""

    async def send(self, to: str, template: str, data: Dict[str, Any]) -> Result[str, str]:
        """Send WhatsApp message (mock)"""
        log.warning(
            "whatsapp_mock_adapter",
            to=to,
            template=template,
            message="WhatsApp API key missing - using mock adapter. Add WHATSAPP_API_KEY in settings.",
            integration="whatsapp"
        )
        return Result.ok("mock_sent")


class RealWhatsAppGateway:
    """Real WhatsApp gateway - uses Meta WhatsApp Business API"""

    def __init__(self, api_key: str):
        self.api_key = api_key

    async def send(self, to: str, template: str, data: Dict[str, Any]) -> Result[str, str]:
        """Send WhatsApp message via Meta API"""
        if not self.api_key:
            log.error("whatsapp_api_key_missing", integration="whatsapp")
            return Result.err("API key missing")

        # TODO: Implement real WhatsApp API call
        # For now, return error if not implemented
        return Result.err("Not implemented")


class MockEmailGateway:
    """Mock Email gateway - logs warning when API key is missing"""

    async def send(self, to: str, subject: str, body: str, **kwargs) -> Result[str, str]:
        """Send email (mock)"""
        log.warning(
            "email_mock_adapter",
            to=to,
            subject=subject,
            message="Email API key missing - using mock adapter. Add EMAIL_API_KEY in settings.",
            integration="email"
        )
        return Result.ok("mock_sent")


class RealEmailGateway:
    """Real Email gateway - uses Resend or SES"""

    def __init__(self, api_key: str):
        self.api_key = api_key

    async def send(self, to: str, subject: str, body: str, **kwargs) -> Result[str, str]:
        """Send email via API"""
        if not self.api_key:
            log.error("email_api_key_missing", integration="email")
            return Result.err("API key missing")

        # TODO: Implement real email API call
        return Result.err("Not implemented")


class MockGspGateway:
    """Mock GSP gateway - logs warning when API key is missing"""

    async def fetch_gstr2b(self, period: str, gstin: str) -> Result[Dict[str, Any], str]:
        """Fetch GSTR-2B (mock)"""
        log.warning(
            "gsp_mock_adapter",
            period=period,
            gstin=gstin,
            message="GSP API key missing - using mock adapter. Add GSP_API_KEY in settings.",
            integration="gsp"
        )
        return Result.ok({"mock": True})


class MockFileStore:
    """Mock file store - returns mock URLs"""

    async def get_upload_url(self, file_id: str, tenant_id: str, mime: str, size: int) -> str:
        """Get presigned upload URL (mock)"""
        log.warning(
            "file_store_mock_adapter",
            file_id=file_id,
            tenant_id=tenant_id,
            message="File store not configured - using mock adapter. Add S3_ACCESS_KEY_ID in settings.",
            integration="storage"
        )
        return f"https://storage.example.com/mock-upload/{file_id}"

    async def get_download_url(self, file_id: str, expires_in: int = 60) -> str:
        """Get presigned download URL (mock)"""
        return f"https://storage.example.com/mock-download/{file_id}"

    async def delete_file(self, file_id: str) -> None:
        """Delete file (mock)"""
        pass


class MockPdfRenderer:
    """Mock PDF renderer - returns empty PDF"""

    async def render_pdf(self, template: str, data: Dict[str, Any], lang: str = "en") -> bytes:
        """Render PDF (mock)"""
        log.warning(
            "pdf_renderer_mock_adapter",
            template=template,
            lang=lang,
            message="PDF renderer not configured - using mock adapter.",
            integration="pdf"
        )
        return b"%PDF-1.4\n%Mock PDF\n%%EOF"


# Gateway factory
class GatewayFactory:
    """Factory for creating gateway instances based on settings"""

    @staticmethod
    def create_whatsapp_gateway(api_key: str = None):
        """Create WhatsApp gateway (real or mock)"""
        if api_key:
            return RealWhatsAppGateway(api_key)
        return MockWhatsAppGateway()

    @staticmethod
    def create_email_gateway(api_key: str = None):
        """Create email gateway (real or mock)"""
        if api_key:
            return RealEmailGateway(api_key)
        return MockEmailGateway()

    @staticmethod
    def create_gsp_gateway(api_key: str = None):
        """Create GSP gateway (real or mock)"""
        return MockGspGateway()  # Always mock for now

    @staticmethod
    def create_file_store(access_key: str = None, secret_key: str = None):
        """Create file store (real or mock)"""
        if access_key and secret_key:
            # TODO: Return real S3/R2 store
            return MockFileStore()
        return MockFileStore()

    @staticmethod
    def create_pdf_renderer():
        """Create PDF renderer"""
        return MockPdfRenderer()

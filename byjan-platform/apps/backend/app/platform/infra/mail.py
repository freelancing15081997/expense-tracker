"""
Outbound email via Brevo SMTP (authenticated easypado.com domain).
Branded HTML includes the Byjan mark so clients show a real mail icon.
"""

from __future__ import annotations

import asyncio
import html
import smtplib
import ssl
import time
from email.message import EmailMessage
from typing import Optional

import structlog

from app.settings import settings

log = structlog.get_logger(__name__)

LOGO_URL = "https://www.easypado.com/logo.png"
BUSINESS_URL = "https://business.easypado.com"


def _smtp_ready() -> bool:
    return bool(settings.SMTP_USER and settings.SMTP_PASS)


def _relay_ready() -> bool:
    return bool((settings.MAIL_RELAY_URL or "").strip() and (settings.MAIL_RELAY_SECRET or "").strip())


def mail_configured() -> bool:
    """True when SMTP and/or the Vercel HTTP mail relay is configured."""
    return _smtp_ready() or _relay_ready()


def mail_from_address() -> str:
    """Prefer MAIL_FROM / EMAIL_FROM on Brevo. On Gmail SMTP the From must match the login."""
    host = (settings.SMTP_HOST or "").strip().lower()
    user = (settings.SMTP_USER or "").strip()
    if user and ("gmail.com" in host or "googlemail.com" in host or host == "smtp.gmail.com"):
        return user
    raw = (settings.MAIL_FROM or settings.EMAIL_FROM or "").strip()
    if not raw or raw.endswith("@byjan.com") or "noreply@byjan" in raw:
        return "byjanbooks@easypado.com"
    return raw


def _escape(s: str) -> str:
    return html.escape(str(s or ""), quote=True)


def wrap_byjan_mail(
    *,
    kicker: str,
    title: str,
    intro: str,
    extra_html: str = "",
    note: str = "",
) -> str:
    """Branded HTML shell with Byjan logo (PNG) for deliverability + recognition."""
    note_block = (
        f'<p style="margin:20px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;'
        f'line-height:1.6;color:#64748b">{_escape(note)}</p>'
        if note
        else ""
    )
    return f"""<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#eef2f6">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef2f6;padding:36px 12px">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border:1px solid #dbe3ea;border-radius:16px;overflow:hidden">
        <tr>
          <td style="padding:22px 32px 16px;background:#0B0F1F">
            <table role="presentation" cellpadding="0" cellspacing="0"><tr>
              <td style="vertical-align:middle;padding-right:12px">
                <img src="{LOGO_URL}" width="40" height="40" alt="Byjan" style="display:block;border:0;border-radius:10px;width:40px;height:40px"/>
              </td>
              <td style="vertical-align:middle">
                <p style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:20px;color:#ffffff;letter-spacing:0.12em">BYJAN</p>
                <p style="margin:6px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#8da2ff">{_escape(kicker)}</p>
              </td>
            </tr></table>
          </td>
        </tr>
        <tr><td style="height:4px;background:#3654FF;font-size:0;line-height:0">&nbsp;</td></tr>
        <tr>
          <td style="padding:28px 32px">
            <h1 style="margin:0 0 12px;font-family:Georgia,'Times New Roman',serif;font-size:22px;line-height:1.3;color:#0B0F1F;font-weight:normal">{_escape(title)}</h1>
            {f'<p style="margin:0 0 18px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.65;color:#334155">{_escape(intro)}</p>' if intro else ''}
            {extra_html}
            {note_block}
          </td>
        </tr>
        <tr>
          <td style="padding:16px 32px 24px;border-top:1px solid #edf2f7;font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:1.5;color:#94a3b8">
            Byjan Business · easypado.com · Service notice, not marketing. If you did not expect this, you can ignore it.
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>"""


def password_reset_email(*, reset_href: str) -> dict:
    safe_href = str(reset_href or "").replace('"', "")
    cta = ""
    if safe_href.startswith("https://"):
        cta = f"""<p style="margin:24px 0 8px;text-align:center">
    <a href="{safe_href}" style="display:inline-block;background:#3654FF;color:#ffffff;text-decoration:none;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:700;letter-spacing:0.04em;padding:12px 22px;border-radius:12px">Reset password</a>
  </p>"""
    return {
        "subject": "Reset your Byjan Business password",
        "text": (
            "Reset your Byjan Business password.\n\n"
            f"Open this link (expires soon): {reset_href}\n\n"
            "If you did not request this, ignore this email."
        ),
        "html": wrap_byjan_mail(
            kicker="Password reset",
            title="Reset your Byjan Business password",
            intro="Someone asked to reset the password for this Byjan Business account. Use the button below. The link expires shortly.",
            extra_html=cta,
            note="We never ask for your UPI PIN or bank password. After you reset, every device is signed out.",
        ),
    }


def business_notice_email(
    *,
    subject: str,
    body_text: str,
    kicker: str = "Business notice",
) -> dict:
    body = str(body_text or "")
    extra = (
        f'<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.65;color:#334155">'
        f'{_escape(body).replace(chr(10), "<br/>")}</div>'
    )
    return {
        "subject": subject,
        "text": body,
        "html": wrap_byjan_mail(
            kicker=kicker,
            title=subject,
            intro="",
            extra_html=extra,
        ),
    }


def _send_smtp_sync(
    *,
    to: str,
    subject: str,
    text: str,
    html_body: Optional[str],
    kind: str,
) -> str:
    from_addr = mail_from_address()
    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = f"Byjan Business <{from_addr}>"
    msg["To"] = to
    msg["Reply-To"] = from_addr
    msg["Message-ID"] = f"<{time.time_ns()}@easypado.com>"
    msg["List-Unsubscribe"] = f"<mailto:{from_addr}?subject=unsubscribe>, <{BUSINESS_URL}>"
    msg["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click"
    msg["Feedback-ID"] = f"{kind}:ByjanBusiness:easypado"
    msg.set_content(text or subject)
    if html_body:
        msg.add_alternative(html_body, subtype="html")

    host = settings.SMTP_HOST or "smtp-relay.brevo.com"
    port = int(settings.SMTP_PORT or 587)
    user = settings.SMTP_USER or ""
    password = settings.SMTP_PASS or ""

    context = ssl.create_default_context()
    if port == 465:
        with smtplib.SMTP_SSL(host, port, timeout=20, context=context) as smtp:
            smtp.login(user, password)
            smtp.send_message(msg)
    else:
        with smtplib.SMTP(host, port, timeout=20) as smtp:
            smtp.ehlo()
            smtp.starttls(context=context)
            smtp.ehlo()
            smtp.login(user, password)
            smtp.send_message(msg)
    return msg["Message-ID"] or "sent"


async def _send_relay(
    *,
    to: str,
    subject: str,
    text: str,
    html_body: Optional[str],
    kind: str,
) -> str:
    """POST branded mail through Vercel (Render free blocks SMTP ports)."""
    import httpx

    url = (settings.MAIL_RELAY_URL or "").strip()
    secret = (settings.MAIL_RELAY_SECRET or "").strip()
    if not url or not secret:
        raise RuntimeError("MAIL_RELAY_URL / MAIL_RELAY_SECRET not set")
    payload = {
        "to": to,
        "subject": subject,
        "text": text or subject,
        "html": html_body or "",
        "kind": kind,
        "fromName": "Byjan Business",
    }
    async with httpx.AsyncClient(timeout=25.0) as client:
        res = await client.post(
            url,
            json=payload,
            headers={
                "content-type": "application/json",
                "x-mail-relay-secret": secret,
            },
        )
    if res.status_code >= 400:
        detail = (res.text or "")[:240]
        raise RuntimeError(f"mail relay HTTP {res.status_code}: {detail}")
    data = {}
    try:
        data = res.json()
    except Exception:
        pass
    mid = str(data.get("messageId") or data.get("id") or "relayed")
    log.info("mail_relayed", to=to, kind=kind, subject=subject[:80], status=res.status_code)
    return mid


async def send_mail(
    *,
    to: str,
    subject: str,
    text: str,
    html_body: Optional[str] = None,
    kind: str = "transactional",
) -> str:
    if not mail_configured():
        raise RuntimeError("Mail is not configured (set SMTP_* or MAIL_RELAY_*)")
    to_addr = str(to or "").strip().lower()
    if not to_addr or "@" not in to_addr:
        raise ValueError("invalid recipient")

    # Prefer HTTP relay on Render (SMTP 25/465/587 are blocked on free tier).
    if _relay_ready():
        try:
            mid = await _send_relay(
                to=to_addr,
                subject=subject,
                text=text,
                html_body=html_body,
                kind=kind,
            )
            log.info("mail_sent", to=to_addr, kind=kind, subject=subject[:80], via="relay")
            return mid
        except Exception as relay_err:
            if not _smtp_ready():
                raise
            log.warning("mail_relay_failed_falling_back_smtp", error=str(relay_err)[:200])

    mid = await asyncio.to_thread(
        _send_smtp_sync,
        to=to_addr,
        subject=subject,
        text=text,
        html_body=html_body,
        kind=kind,
    )
    log.info("mail_sent", to=to_addr, kind=kind, subject=subject[:80], via="smtp")
    return mid

function escapeHtml(raw: string) {
  return String(raw || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function ctaButton(label: string, href: string) {
  const safeHref = String(href || '').replace(/"/g, '');
  if (!safeHref.startsWith('https://www.easypado.com')) return '';
  return `<p style="margin:24px 0 8px;text-align:center">
    <a href="${safeHref}" style="display:inline-block;background:#3654FF;color:#ffffff;text-decoration:none;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:700;letter-spacing:0.04em;padding:12px 22px;border-radius:12px">${escapeHtml(label)}</a>
  </p>`;
}

export function wrapByjanMail(opts: {
  kicker: string;
  title: string;
  intro: string;
  extraHtml?: string;
  note?: string;
}) {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#eef2f6">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef2f6;padding:36px 12px">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border:1px solid #dbe3ea;border-radius:16px;overflow:hidden">
        <tr>
          <td style="padding:26px 32px 18px;background:#0B0F1F">
            <p style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:22px;color:#ffffff;letter-spacing:0.12em">BYJAN</p>
            <p style="margin:8px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#8da2ff">${escapeHtml(opts.kicker)}</p>
          </td>
        </tr>
        <tr><td style="height:4px;background:#3654FF;font-size:0;line-height:0">&nbsp;</td></tr>
        <tr>
          <td style="padding:28px 32px">
            <h1 style="margin:0 0 12px;font-family:Georgia,'Times New Roman',serif;font-size:22px;line-height:1.3;color:#0B0F1F;font-weight:normal">${escapeHtml(opts.title)}</h1>
            <p style="margin:0 0 18px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.65;color:#334155">${escapeHtml(opts.intro)}</p>
            ${opts.extraHtml || ''}
            ${opts.note ? `<p style="margin:20px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.6;color:#64748b">${escapeHtml(opts.note)}</p>` : ''}
          </td>
        </tr>
        <tr>
          <td style="padding:16px 32px 24px;border-top:1px solid #edf2f7;font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:1.5;color:#94a3b8">
            Byjan · easypado.com · Service notice, not marketing. If you did not request this, you can ignore this email.
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export function otpEmail(opts: { code: string; purpose?: 'register' | 'reset' }) {
  const reset = opts.purpose === 'reset';
  const title = reset ? 'Reset your Byjan password' : 'Your Byjan verification code';
  const intro = reset
    ? 'Use this code to confirm it is you. We will then email a secure reset link.'
    : 'Use this code to verify your email and activate your Byjan account.';
  const extraHtml = `<p style="margin:8px 0 4px;font-family:Arial,Helvetica,sans-serif;font-size:32px;letter-spacing:0.28em;font-weight:700;color:#0B0F1F;text-align:center">${escapeHtml(opts.code)}</p>
    <p style="margin:0;text-align:center;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#94a3b8">Expires in 10 minutes. Check Spam if you do not see later mail.</p>`;
  return {
    subject: `${opts.code} is your Byjan verification code`,
    text: `${title}\n\nYour code is ${opts.code}. It expires in 10 minutes.\n\nIf you did not request this, ignore this email.`,
    html: wrapByjanMail({
      kicker: reset ? 'Password reset' : 'Verification',
      title,
      intro,
      extraHtml,
      note: "Didn't request this? You can ignore this email. Never share this code.",
    }),
  };
}

export function passwordResetEmail(opts: { href: string }) {
  return {
    subject: 'Reset your Byjan password',
    text: 'Reset your Byjan password from the app. This link expires soon. If you did not request a reset, ignore this email.',
    html: wrapByjanMail({
      kicker: 'Password reset',
      title: 'Reset your Byjan password',
      intro: 'Someone asked to reset the password for this Byjan account. Use the button below. The link expires shortly.',
      extraHtml: ctaButton('Reset Password', opts.href),
      note: "If the button does not work, open Byjan and use Forgot password again. We never ask for your UPI PIN or bank password.",
    }),
  };
}

export function inviteAcceptedEmail(opts: { who: string; bookName: string }) {
  const href = 'https://www.easypado.com/#/expenses';
  return {
    subject: `${opts.who} joined ${opts.bookName}`,
    text: `${opts.who} accepted your invitation and joined ${opts.bookName}. Open Byjan to review the book.`,
    html: wrapByjanMail({
      kicker: 'Invitation',
      title: 'A teammate joined your book',
      intro: `${opts.who} accepted your invitation and joined ${opts.bookName}.`,
      extraHtml: ctaButton('Open Byjan', href),
    }),
  };
}

export function supportAckEmail(opts: { ticketId: string; topic: string }) {
  return {
    subject: `We received your Byjan request (${opts.ticketId})`,
    text: `Thanks for writing to Byjan.\n\nTicket: ${opts.ticketId}\nTopic: ${opts.topic}\n\nYou can see this ticket in the app under Help.`,
    html: wrapByjanMail({
      kicker: 'Help',
      title: 'We received your request',
      intro: `Ticket ${opts.ticketId} · ${opts.topic}. Open Help in Byjan to follow up.`,
      extraHtml: ctaButton('Open Help', 'https://www.easypado.com/#/help'),
    }),
  };
}

export function inboundNotifyEmail(opts: { title: string; intro: string; href?: string }) {
  const href = opts.href || 'https://www.easypado.com/#/financial-inbox';
  return {
    subject: opts.title,
    text: `${opts.title}\n\n${opts.intro}`,
    html: wrapByjanMail({
      kicker: 'Financial inbox',
      title: opts.title,
      intro: opts.intro,
      extraHtml: ctaButton('Review in Byjan', href),
    }),
  };
}

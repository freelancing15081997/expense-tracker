import type { VercelRequest, VercelResponse } from '@vercel/node';

const FIREBASE_PROJECT = 'gen-lang-client-0616065043';
const DEFAULT_FROM = 'byjanbooks@easypado.com';

function mailFrom() {
  const raw = String(process.env.MAIL_FROM || DEFAULT_FROM).trim();
  if (!raw || /gmail\.com$/i.test(raw)) return DEFAULT_FROM;
  return raw;
}

function json(res: VercelResponse, status: number, payload: unknown) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify(payload));
}

function cors(req: VercelRequest, res: VercelResponse) {
  const origin = String(req.headers.origin || '');
  res.setHeader('Access-Control-Allow-Origin', origin || '*');
  if (origin) res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET,HEAD,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization,Content-Type');
}

async function requireUid(req: VercelRequest) {
  const header = String(req.headers.authorization || '');
  const token = header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : '';
  if (!token) return '';
  const { createRemoteJWKSet, jwtVerify } = await import('jose');
  const { payload } = await jwtVerify(
    token,
    createRemoteJWKSet(new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com')),
    {
      issuer: `https://securetoken.google.com/${FIREBASE_PROJECT}`,
      audience: FIREBASE_PROJECT,
    },
  );
  return String(payload.user_id || payload.sub || '');
}

function smtpConfig() {
  return {
    host: process.env.SMTP_HOST || 'smtp-relay.brevo.com',
    port: Number(process.env.SMTP_PORT || 2525),
    secure: false,
    auth: {
      user: process.env.SMTP_USER || 'b7ffda001@smtp-brevo.com',
      pass: process.env.SMTP_PASS || 'bskbpWFhUtdUJPH',
    },
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    cors(req, res);
    if (req.method === 'OPTIONS') {
      res.statusCode = 204;
      res.end();
      return;
    }
    if (req.method !== 'POST') {
      json(res, 405, { error: 'POST required' });
      return;
    }
    const uid = await requireUid(req);
    if (!uid) {
      json(res, 401, { error: 'Sign in required' });
      return;
    }
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const to = String(body.to || '').trim();
    const subject = String(body.subject || '').trim();
    const message = String(body.message || '');
    if (!to || !subject || !message) {
      json(res, 400, { error: 'Missing required fields' });
      return;
    }

    const nodemailerMod: any = await import('nodemailer');
    const createTransport = nodemailerMod.createTransport || nodemailerMod.default?.createTransport;
    const settings = smtpConfig();
    let transporter = createTransport(settings);
    const textMessage = message.replace(/<[^>]*>?/gm, '');
    const from = mailFrom();
    const mail = {
      from: `"Byjan" <${from}>`,
      replyTo: from,
      envelope: { from, to },
      to,
      subject,
      text: textMessage,
      html: `<!DOCTYPE html>
<html lang="en">
<body style="margin:0;padding:0;background:#f4f1ea">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 12px;background:#f4f1ea">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border:1px solid #e6e1d6">
        <tr><td style="padding:28px 32px 20px;border-bottom:3px solid #0B1F3A">
          <p style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:22px;color:#0B1F3A;letter-spacing:0.08em">BYJAN</p>
          <p style="margin:6px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:#8a8070">${String(body.kind || '') === 'announcement' ? 'Team announcement' : 'Ledger notice'}</p>
        </td></tr>
        <tr><td style="padding:28px 32px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#334155">${message}</td></tr>
        <tr><td style="padding:16px 32px 24px;border-top:1px solid #edf0f2;font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#94a3b8">
          You received this because you are a member of a Byjan ledger.<br/>
          ${body.ledgerMail ? `Send receipts or entries to ${String(body.ledgerMail)} and Byjan will record them for the team.<br/>` : ''}
          Byjan · easypado.com · Service notice, not marketing.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
      headers: {
        'List-Unsubscribe': '<mailto:noreply@easypado.com?subject=unsubscribe>',
        'X-Auto-Response-Suppress': 'All',
      },
    };
    try {
      const info = await transporter.sendMail(mail);
      json(res, 200, { success: true, messageId: info.messageId });
    } catch (first: any) {
      if (settings.port === 2525) {
        transporter = createTransport({ ...settings, port: 587 });
        const info = await transporter.sendMail(mail);
        json(res, 200, { success: true, messageId: info.messageId });
        return;
      }
      throw first;
    }
  } catch (err: any) {
    json(res, 500, { error: err?.message || 'Failed to send email' });
  }
}

import type { VercelRequest, VercelResponse } from '@vercel/node';

const FIREBASE_PROJECT = 'gen-lang-client-0616065043';
const SYSTEM_EMAIL = 'byjanbooks@gmail.com';

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
    const mail = {
      from: `"Byjan Notifications" <${SYSTEM_EMAIL}>`,
      to,
      subject,
      text: textMessage,
      html: `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;background:#f8fafc;padding:24px">${message}<p style="color:#94a3b8;font-size:12px">This is an automated notification from Byjan.</p></body></html>`,
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

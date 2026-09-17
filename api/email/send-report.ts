import type { VercelRequest, VercelResponse } from '@vercel/node';
import { readSession } from '../_lib/helpers';

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

function cleanBase64(raw: string) {
  return String(raw || '').replace(/^data:application\/pdf[^,]*,/i, '').replace(/\s+/g, '');
}

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '8mb',
    },
  },
};

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

    const uid = await readSession(req);
    if (!uid) {
      json(res, 401, { error: 'Sign in required' });
      return;
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const to = String(body.to || '').trim();
    const subject = String(body.subject || '').trim();
    const message = String(body.message || 'Please find the attached Byjan report.');
    const pdfBase64 = cleanBase64(body.pdfBase64);
    const filename = String(body.filename || 'Byjan_Report.pdf').replace(/[^\w.-]+/g, '_');
    if (!to || !subject || !pdfBase64) {
      json(res, 400, { error: 'Missing report, address, or subject' });
      return;
    }

    const nodemailerMod: any = await import('nodemailer');
    const createTransport = nodemailerMod.createTransport || nodemailerMod.default?.createTransport;
    const settings = smtpConfig();
    let transporter = createTransport(settings);
    const from = mailFrom();
    const textMessage = message.replace(/<[^>]*>?/gm, '');
    const html = `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#eef2f6">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:36px 12px;background:#eef2f6">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border:1px solid #dbe3ea;border-radius:16px;overflow:hidden">
        <tr><td style="padding:26px 32px 18px;background:#0B1F3A">
          <p style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:22px;color:#ffffff;letter-spacing:0.12em">BYJAN</p>
          <p style="margin:8px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#12B8A8">Money report</p>
        </td></tr>
        <tr><td style="height:4px;background:#12B8A8;font-size:0;line-height:0">&nbsp;</td></tr>
        <tr><td style="padding:28px 32px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.65;color:#334155">
          <p style="margin:0 0 16px">${textMessage}</p>
          <p style="margin:0">The PDF is attached. Open it to review the filtered ledger entries.</p>
        </td></tr>
        <tr><td style="padding:18px 32px 26px;border-top:1px solid #edf2f7;font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#94a3b8">
          You received this because you asked Byjan to email a money-book report.<br/>
          Byjan · easypado.com · Service notice, not marketing.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

    const mail = {
      from: `"Byjan" <${from}>`,
      replyTo: from,
      envelope: { from, to },
      to,
      subject,
      text: `${textMessage}\n\nThe PDF report is attached.`,
      html,
      attachments: [{ filename, content: pdfBase64, encoding: 'base64', contentType: 'application/pdf' }],
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
    json(res, 500, { error: err?.message || 'Failed to send report' });
  }
}

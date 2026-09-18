import type { VercelRequest, VercelResponse } from '@vercel/node';
import { mailFrom, smtpConfig, writeMailTrace } from '../_lib/mail.js';
import { applyCors } from '../_lib/http.js';

const FIREBASE_PROJECT = 'gen-lang-client-0616065043';

function json(res: VercelResponse, status: number, payload: unknown) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify(payload));
}

function escapeHtml(s: string) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

async function requireUser(req: VercelRequest) {
  const header = String(req.headers.authorization || '');
  const token = header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : '';
  if (!token) return null;
  const { createRemoteJWKSet, jwtVerify } = await import('jose');
  const { payload } = await jwtVerify(
    token,
    createRemoteJWKSet(new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com')),
    {
      issuer: `https://securetoken.google.com/${FIREBASE_PROJECT}`,
      audience: FIREBASE_PROJECT,
    },
  );
  return {
    uid: String(payload.user_id || payload.sub || ''),
    email: String(payload.email || '').trim().toLowerCase(),
  };
}

async function recipientAllowed(opts: { uid: string; email: string; to: string; bookId: string }) {
  const to = opts.to.trim().toLowerCase();
  if (!to) return false;
  if (opts.email && to === opts.email) return true;
  const bookId = String(opts.bookId || '').trim();
  if (!bookId) return false;
  try {
    const { ledgerGet, ledgerRequireMember } = await import('../_pg-tables.js');
    await ledgerRequireMember(bookId, opts.uid);
    const book = await ledgerGet(`books/${bookId}`);
    const roles = (book && typeof book === 'object' ? (book as any).roles : null) || {};
    const notify = Array.isArray((book as any)?.notifyEmails)
      ? (book as any).notifyEmails.map((e: string) => String(e).toLowerCase())
      : [];
    if (notify.includes(to)) return true;
    for (const uid of Object.keys(roles || {})) {
      const row = roles[uid];
      const em = String(row?.email || row?.mail || '').trim().toLowerCase();
      if (em && em === to) return true;
    }
    return false;
  } catch {
    return false;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    applyCors(req as any, res as any);
    if (req.method === 'OPTIONS') {
      res.statusCode = 204;
      res.end();
      return;
    }
    if (req.method !== 'POST') {
      json(res, 405, { error: 'POST required' });
      return;
    }
    const user = await requireUser(req);
    if (!user?.uid) {
      json(res, 401, { error: 'Sign in required' });
      return;
    }
    const uid = user.uid;
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const to = String(body.to || '').trim().toLowerCase();
    const subject = String(body.subject || '').trim();
    const message = String(body.message || '');
    const bookId = String(body.bookId || '').trim();
    if (!to || !subject || !message) {
      json(res, 400, { error: 'Missing required fields' });
      return;
    }
    if (!(await recipientAllowed({ uid, email: user.email, to, bookId }))) {
      json(res, 403, { error: 'You can only email yourself or members of a book you belong to' });
      return;
    }

    const nodemailerMod: any = await import('nodemailer');
    const createTransport = nodemailerMod.createTransport || nodemailerMod.default?.createTransport;
    let settings: ReturnType<typeof smtpConfig>;
    try {
      settings = smtpConfig();
    } catch (cfgErr: any) {
      await writeMailTrace('email.config', { ok: false, error: String(cfgErr?.message || cfgErr), uid });
      json(res, 503, { error: String(cfgErr?.message || 'SMTP not configured') });
      return;
    }
    let transporter = createTransport(settings);
    const textMessage = message.replace(/<[^>]*>?/gm, '');
    const from = mailFrom();
    const safeBody = /<!DOCTYPE html/i.test(message) ? message : escapeHtml(message).replace(/\n/g, '<br/>');
    const html = /<!DOCTYPE html/i.test(message) ? message : `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#eef2f6">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:36px 12px;background:#eef2f6">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border:1px solid #dbe3ea;border-radius:16px;overflow:hidden">
        <tr><td style="padding:26px 32px 18px;background:#0B1F3A">
          <p style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:22px;color:#ffffff;letter-spacing:0.12em">BYJAN</p>
          <p style="margin:8px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#12B8A8">${String(body.kind || '') === 'announcement' ? 'Team announcement' : 'Ledger notice'}</p>
        </td></tr>
        <tr><td style="height:4px;background:#12B8A8;font-size:0;line-height:0">&nbsp;</td></tr>
        <tr><td style="padding:28px 32px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.65;color:#334155">${safeBody}</td></tr>
        <tr><td style="padding:18px 32px 26px;border-top:1px solid #edf2f7;font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#94a3b8">
          You received this because you are a member of a Byjan ledger.<br/>
          ${body.ledgerMail ? `Send receipts or entries to ${escapeHtml(String(body.ledgerMail))} and Byjan will record them for the team.<br/>` : ''}
          Byjan · easypado.com · Service notice, not marketing.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
    const mail: Record<string, unknown> = {
      from: `"Byjan" <${from}>`,
      replyTo: from,
      envelope: { from, to },
      to,
      subject,
      text: textMessage,
      html,
      headers: {
        'List-Unsubscribe': '<mailto:noreply@easypado.com?subject=unsubscribe>',
        'X-Auto-Response-Suppress': 'All',
      },
    };
    const pdfBase64 = String(body.pdfBase64 || '').replace(/^data:application\/pdf[^,]*,/i, '').replace(/\s+/g, '');
    if (pdfBase64) {
      mail.attachments = [{
        filename: String(body.filename || 'Byjan_Report.pdf').replace(/[^\w.-]+/g, '_'),
        content: pdfBase64,
        encoding: 'base64',
        contentType: 'application/pdf',
      }];
    }
    try {
      const info = await transporter.sendMail(mail);
      await writeMailTrace('email.send', {
        ok: true,
        uid,
        to,
        subject: subject.slice(0, 120),
        messageId: info.messageId,
        host: settings.host,
        port: settings.port,
      });
      json(res, 200, { success: true, messageId: info.messageId });
    } catch (first: any) {
      if (settings.port === 2525) {
        try {
          transporter = createTransport({ ...settings, port: 587 });
          const info = await transporter.sendMail(mail);
          await writeMailTrace('email.send', {
            ok: true,
            uid,
            to,
            subject: subject.slice(0, 120),
            messageId: info.messageId,
            host: settings.host,
            port: 587,
            note: 'fallback-port-587',
          });
          json(res, 200, { success: true, messageId: info.messageId });
          return;
        } catch (second: any) {
          await writeMailTrace('email.send', {
            ok: false,
            uid,
            to,
            subject: subject.slice(0, 120),
            error: String(second?.message || second || first?.message || 'Send failed'),
            host: settings.host,
            port: 587,
          });
          throw second;
        }
      }
      await writeMailTrace('email.send', {
        ok: false,
        uid,
        to,
        subject: subject.slice(0, 120),
        error: String(first?.message || first || 'Send failed'),
        host: settings.host,
        port: settings.port,
      });
      throw first;
    }
  } catch (err: any) {
    json(res, 500, { error: err?.message || 'Failed to send email' });
  }
}

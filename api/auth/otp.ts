import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createHash, randomInt } from 'node:crypto';
import { applyCors } from '../_lib/http.js';

const PURPOSES = new Set(['register', 'reset']);

function json(res: VercelResponse, status: number, payload: unknown) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json');
  res.setHeader('cache-control', 'no-store');
  res.end(JSON.stringify(payload));
}

function normalizeEmail(raw: string) {
  return String(raw || '').trim().toLowerCase();
}

function isEmail(raw: string) {
  return /^[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}$/i.test(raw);
}

function hashCode(email: string, purpose: string, code: string) {
  return createHash('sha256').update(`${email}|${purpose}|${code}|byjan-otp-v1`).digest('hex');
}

function otpKey(purpose: string, email: string) {
  return `ops/otp/${purpose}/${email.replace(/[^a-z0-9@._+-]/gi, '_')}`;
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
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const op = String(body.op || '').trim();
    const purpose = String(body.purpose || 'register').trim().toLowerCase();
    const email = normalizeEmail(String(body.email || ''));
    if (!PURPOSES.has(purpose)) {
      json(res, 400, { error: 'Unsupported verification purpose.' });
      return;
    }
    if (!isEmail(email)) {
      json(res, 400, { error: 'Enter a valid email address.' });
      return;
    }

    const { ledgerGet, ledgerSet } = await import('../_pg-tables.js');
    const { sendTracedMail } = await import('../_lib/smtp-mail.js');
    const key = otpKey(purpose, email);

    if (op === 'send') {
      const existing = await ledgerGet(key);
      const lastAt = existing && typeof existing === 'object' ? Number((existing as any).sentAtMs || 0) : 0;
      if (lastAt && Date.now() - lastAt < 45_000) {
        json(res, 429, { error: 'Please wait a moment before requesting another code.' });
        return;
      }
      const code = String(randomInt(100000, 999999));
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
      await ledgerSet(key, {
        email,
        purpose,
        hash: hashCode(email, purpose, code),
        expiresAt,
        sentAtMs: Date.now(),
        attempts: 0,
        verified: false,
      });
      const title = purpose === 'reset' ? 'Reset your Byjan password' : 'Verify your Byjan email';
      const intro = purpose === 'reset'
        ? 'Use this code to confirm it is you before resetting your password.'
        : 'Use this code to verify your email and activate your Byjan account.';
      try {
        await sendTracedMail({
          to: email,
          subject: `${code} is your Byjan verification code`,
          kind: 'email.otp',
          text: `${title}\n\nYour code is ${code}. It expires in 10 minutes.\n\nIf you did not request this, ignore this email.`,
          html: `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;background:#eef2f6;padding:24px">
            <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:16px;padding:28px;border:1px solid #dbe3ea">
              <p style="margin:0 0 8px;letter-spacing:.18em;text-transform:uppercase;font-size:11px;color:#12B8A8">Byjan</p>
              <h1 style="margin:0 0 12px;font-size:22px;color:#0B1F3A">${title}</h1>
              <p style="margin:0 0 18px;color:#475569;line-height:1.5">${intro}</p>
              <p style="margin:0;font-size:32px;letter-spacing:.28em;font-weight:700;color:#0B1F3A">${code}</p>
              <p style="margin:18px 0 0;font-size:12px;color:#94a3b8">Expires in 10 minutes.</p>
            </div></body></html>`,
        });
      } catch {
        json(res, 503, { error: 'Could not send the verification email. Please try again shortly.' });
        return;
      }
      json(res, 200, { ok: true, expiresAt });
      return;
    }

    if (op === 'verify') {
      const code = String(body.code || '').replace(/\s+/g, '');
      if (!/^\d{6}$/.test(code)) {
        json(res, 400, { error: 'Enter the 6-digit code from your email.' });
        return;
      }
      const row = await ledgerGet(key);
      if (!row || typeof row !== 'object') {
        json(res, 400, { error: 'No active code found. Request a new one.' });
        return;
      }
      const data = row as Record<string, unknown>;
      const attempts = Number(data.attempts || 0);
      if (attempts >= 8) {
        json(res, 429, { error: 'Too many attempts. Request a new code.' });
        return;
      }
      if (String(data.expiresAt || '') < new Date().toISOString()) {
        json(res, 400, { error: 'That code has expired. Request a new one.' });
        return;
      }
      const ok = String(data.hash || '') === hashCode(email, purpose, code);
      await ledgerSet(key, { ...data, attempts: attempts + 1, verified: ok, verifiedAt: ok ? new Date().toISOString() : data.verifiedAt });
      if (!ok) {
        json(res, 400, { error: 'That code is incorrect. Check your email and try again.' });
        return;
      }
      json(res, 200, { ok: true, purpose, email });
      return;
    }

    json(res, 400, { error: 'Unknown operation' });
  } catch (err: any) {
    json(res, 500, { error: 'Verification is temporarily unavailable. Please try again.' });
  }
}

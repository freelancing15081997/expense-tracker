import type { VercelRequest, VercelResponse } from '@vercel/node';
import { applyCors } from '../_lib/http.js';
import { mailProviderReady, probeBrevoMailHealth, pollBrevoDelivery, sendTracedMail } from '../_lib/smtp-mail.js';

const FIREBASE_PROJECT = 'gen-lang-client-0616065043';
const BUILTIN_SUPER = ['pujaribadrinath@gmail.com', 'byjanbooks@gmail.com', 'badrinathp316@gmail.com'];

function json(res: VercelResponse, status: number, payload: unknown) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json');
  res.setHeader('cache-control', 'no-store');
  res.end(JSON.stringify(payload));
}

function isSuperEmail(email?: string | null) {
  const needle = String(email || '').trim().toLowerCase();
  if (!needle) return false;
  const extra = String(process.env.SUPER_USER_EMAILS || '')
    .split(/[,;\s]+/)
    .map((v) => v.trim().toLowerCase())
    .filter(Boolean);
  return [...BUILTIN_SUPER, ...extra].includes(needle);
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
    email: String(payload.email || '').toLowerCase(),
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    applyCors(req as any, res as any);
    if (req.method === 'OPTIONS') {
      res.statusCode = 204;
      res.end();
      return;
    }
    const user = await requireUser(req);
    if (!user?.uid) {
      json(res, 401, { error: 'Sign in required' });
      return;
    }
    if (!isSuperEmail(user.email)) {
      json(res, 403, { error: 'Mail health is only available to super admins.' });
      return;
    }

    if (req.method === 'GET') {
      const url = new URL(req.url || '/', 'https://www.easypado.com');
      const email = String(url.searchParams.get('email') || user.email || '').trim().toLowerCase();
      const health = await probeBrevoMailHealth({ email, limit: 40 });
      const delivered = health.events.filter((e) => /delivered|opened|click/i.test(String(e.event || ''))).length;
      const bounced = health.events.filter((e) => /bounce|blocked|invalid|error|spam/i.test(String(e.event || ''))).length;
      const requested = health.events.filter((e) => /request/i.test(String(e.event || ''))).length;
      json(res, 200, {
        at: new Date().toISOString(),
        actor: user.email,
        providerReady: mailProviderReady(),
        cfWorker: String(process.env.CF_WORKER || '') === '1',
        mailFrom: process.env.MAIL_FROM || null,
        mailProvider: process.env.MAIL_PROVIDER || null,
        brevo: health,
        summary: { delivered, bounced, requested, total: health.events.length },
        verdict:
          !health.ready || health.error
            ? 'brevo_unreachable'
            : delivered > 0
              ? 'deliveries_visible'
              : requested > 0 && delivered === 0
                ? 'accepted_but_no_delivery_events'
                : bounced > 0
                  ? 'bounces_present'
                  : 'no_recent_events',
      });
      return;
    }

    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
      const to = String(body.to || user.email || '').trim().toLowerCase();
      const subject = String(body.subject || `Money mail health ${new Date().toISOString()}`).trim();
      const message = String(body.message || 'Live delivery probe from Byjan Money. If you see this in inbox, delivery works.');
      if (!to) {
        json(res, 400, { error: 'Missing to' });
        return;
      }
      const info = await sendTracedMail({
        to,
        subject,
        text: message,
        html: `<p>${message}</p>`,
        kind: 'email.health',
        verifyDelivery: true,
      });
      const delivery = info?.delivery || (info?.messageId
        ? await pollBrevoDelivery({ messageId: String(info.messageId), to, attempts: 5, delayMs: 1200 })
        : { status: 'unknown' as const, events: [] });
      json(res, 200, {
        success: true,
        messageId: info?.messageId || null,
        delivery,
        note: delivery.status === 'delivered'
          ? 'Brevo reports delivered — check inbox/spam.'
          : delivery.status === 'accepted'
            ? 'Brevo accepted the message but has not reported inbox delivery yet.'
            : delivery.status === 'failed'
              ? 'Brevo reported a bounce/block.'
              : 'No Brevo delivery event yet — do not treat as inbox-delivered.',
      });
      return;
    }

    json(res, 405, { error: 'GET or POST required' });
  } catch (err: any) {
    const { publicServiceError } = await import('../_lib/ops-classify.js');
    json(res, 500, { error: publicServiceError(err, err?.message || 'Mail health failed') });
  }
}

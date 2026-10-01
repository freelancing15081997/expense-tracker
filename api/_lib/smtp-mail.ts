import type { Transporter } from 'nodemailer';

type TraceDetail = Record<string, unknown>;

export function smtpAuth() {
  const user = String(process.env.SMTP_USER || process.env.BREVO_SMTP_USER || process.env.SMTP_LOGIN || '').trim();
  const pass = String(process.env.SMTP_PASS || process.env.BREVO_SMTP_KEY || process.env.BREVO_SMTP_PASS || '').trim();
  return { user, pass };
}

function mailProviderName() {
  return String(process.env.MAIL_PROVIDER || '').trim().toLowerCase();
}

function preferGodaddyOnly() {
  return mailProviderName() === 'godaddy' || godaddySmtpReady();
}

function onCloudflareWorker() {
  return String(process.env.CF_WORKER || '') === '1';
}

function smtpHost() {
  const configured = String(process.env.SMTP_HOST || '').trim().toLowerCase();
  if (mailProviderName() === 'godaddy') {
    if (/secureserver\.net/i.test(configured) || /godaddy/i.test(configured)) return configured;
    return 'smtpout.secureserver.net';
  }
  return configured || 'smtp-relay.brevo.com';
}

function isGoDaddySmtp() {
  const host = smtpHost();
  return /secureserver\.net/i.test(host) || /godaddy/i.test(host);
}

function godaddySmtpReady() {
  const { user, pass } = smtpAuth();
  return Boolean(user && pass && isGoDaddySmtp());
}

/** True when outbound mail authenticates through Google SMTP. Do not treat a
 *  @gmail.com *login* as Gmail when the host is Brevo (smtp-brevo.com users). */
export function isGmailSmtp() {
  const host = smtpHost();
  return /(^|\.)gmail\.com$/i.test(host) || /(^|\.)googlemail\.com$/i.test(host) || host === 'smtp.gmail.com';
}

/**
 * Envelope/From address must match the SMTP login for Gmail, otherwise Google
 * accepts the session but recipients often never see the message (spam / silent drop).
 * For Brevo / custom SMTP, prefer MAIL_FROM, then the domain mailbox.
 */
export function mailFromAddress(fallback = 'byjanbooks@easypado.com') {
  const { user } = smtpAuth();
  if (isGmailSmtp() && user) return user;
  const raw = String(process.env.MAIL_FROM || fallback).trim();
  if (!raw || /gmail\.com$/i.test(raw)) return fallback;
  return raw;
}

export function smtpConfigured() {
  const { user, pass } = smtpAuth();
  return Boolean(user && pass);
}

/** Headers Gmail/Yahoo expect so authenticated Byjan mail is less likely to land in spam. */
export function outboundMailHeaders(kind = 'transactional') {
  const tag = String(kind || 'transactional').replace(/[^a-z0-9._-]+/gi, '_').slice(0, 40);
  return {
    'List-Unsubscribe': '<mailto:byjanbooks@easypado.com?subject=unsubscribe>, <https://www.easypado.com/api/email/unsubscribe>',
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    'Feedback-ID': `${tag}:Byjan:easypado`,
  };
}

function easypadoMessageId() {
  return `<${Date.now().toString(36)}.${Math.random().toString(36).slice(2, 12)}@easypado.com>`;
}

export function smtpSettings() {
  const { user, pass } = smtpAuth();
  if (!user || !pass) {
    throw new Error('SMTP is not configured. Set SMTP_USER and SMTP_PASS in the server environment.');
  }
  const host = process.env.SMTP_HOST || 'smtp-relay.brevo.com';
  const port = Number(process.env.SMTP_PORT || 587);
  return {
    host,
    // 587 STARTTLS. 2525 is a Brevo alternate; 465 needs secure:true.
    port,
    secure: port === 465,
    requireTLS: port !== 465,
    connectionTimeout: 12_000,
    greetingTimeout: 12_000,
    socketTimeout: 20_000,
    auth: { user, pass },
  };
}

function mailErrorText(err: unknown) {
  const e = err as { message?: string; response?: string; responseCode?: number; code?: string };
  return [e?.code, e?.responseCode, e?.response, e?.message, err].filter(Boolean).join(' ').slice(0, 240);
}

function brevoApiKey() {
  const direct = String(process.env.BREVO_API_KEY || process.env.BREVO_API_V3_KEY || '').trim();
  if (direct) return direct;
  // Cloudflare Workers cannot use SMTP. Brevo's SMTP key often authenticates
  // the HTTPS transactional API as well — use it only on the worker.
  if (String(process.env.CF_WORKER || '') === '1' && /brevo/i.test(smtpHost())) {
    return String(process.env.SMTP_PASS || process.env.BREVO_SMTP_KEY || process.env.BREVO_SMTP_PASS || '').trim();
  }
  return '';
}

/** True when Money has a live outbound provider (GoDaddy SMTP, or Brevo HTTP). */
export function mailProviderReady() {
  if (preferGodaddyOnly()) return godaddySmtpReady() || smtpConfigured();
  return Boolean(brevoApiKey());
}

export type BrevoDeliveryStatus = 'delivered' | 'accepted' | 'failed' | 'unknown';

export type BrevoDeliveryProbe = {
  status: BrevoDeliveryStatus;
  events: Array<{ event?: string; email?: string; date?: string; messageId?: string; subject?: string; reason?: string }>;
  account?: Record<string, unknown> | null;
};

function normalizeMessageId(id: string) {
  return String(id || '').trim().replace(/^<|>$/g, '');
}

function classifyBrevoEvents(events: BrevoDeliveryProbe['events']): BrevoDeliveryStatus {
  const names = events.map((e) => String(e.event || '').toLowerCase());
  if (names.some((n) => /hardbounce|softbounce|blocked|invalid|error|spam|unsubscribed/.test(n))) return 'failed';
  if (names.some((n) => /delivered|unique_opened|opened|click|proxy_open/.test(n))) return 'delivered';
  if (names.some((n) => /request|deferred|loaded_by_proxy/.test(n))) return 'accepted';
  return 'unknown';
}

/** Live Brevo account + recent transactional events (for ops / honest delivery checks). */
export async function probeBrevoMailHealth(opts?: { email?: string; limit?: number }): Promise<{
  ready: boolean;
  account: Record<string, unknown> | null;
  events: BrevoDeliveryProbe['events'];
  error?: string;
}> {
  const apiKey = brevoApiKey();
  if (!apiKey) {
    return { ready: false, account: null, events: [], error: 'BREVO_API_KEY missing' };
  }
  try {
    const [accRes, evRes, sendersRes, aggRes] = await Promise.all([
      fetch('https://api.brevo.com/v3/account', {
        headers: { accept: 'application/json', 'api-key': apiKey },
      }),
      fetch(
        `https://api.brevo.com/v3/smtp/statistics/events?days=30&limit=${Math.min(50, Math.max(5, opts?.limit || 40))}&sort=desc${
          opts?.email ? `&email=${encodeURIComponent(opts.email)}` : ''
        }`,
        { headers: { accept: 'application/json', 'api-key': apiKey } },
      ),
      fetch('https://api.brevo.com/v3/senders?limit=50&offset=0', {
        headers: { accept: 'application/json', 'api-key': apiKey },
      }),
      fetch('https://api.brevo.com/v3/smtp/statistics/aggregatedReport?days=30', {
        headers: { accept: 'application/json', 'api-key': apiKey },
      }),
    ]);
    const account = accRes.ok ? ((await accRes.json().catch(() => null)) as Record<string, unknown> | null) : null;
    const evBody = evRes.ok ? ((await evRes.json().catch(() => ({}))) as { events?: BrevoDeliveryProbe['events'] }) : {};
    const events = Array.isArray(evBody.events) ? evBody.events : [];
    const sendersBody = sendersRes.ok ? ((await sendersRes.json().catch(() => ({}))) as { senders?: Array<Record<string, unknown>> }) : {};
    const aggregated = aggRes.ok ? await aggRes.json().catch(() => null) : null;
    if (!accRes.ok && !evRes.ok) {
      const errText = await accRes.text().catch(() => `HTTP ${accRes.status}`);
      return { ready: true, account: null, events: [], error: errText.slice(0, 240) };
    }
    return {
      ready: true,
      account: account
        ? {
            email: account.email,
            companyName: account.companyName,
            relay: account.relay,
            plan: account.plan,
            senders: Array.isArray(sendersBody.senders)
              ? sendersBody.senders.map((s) => ({
                  email: s.email,
                  active: s.active,
                  verified: s.verified || s.email || null,
                  ips: s.ips,
                }))
              : [],
            aggregated,
          }
        : null,
      events: events.map((e) => ({
        event: e.event,
        email: e.email,
        date: e.date,
        messageId: e.messageId,
        subject: e.subject,
        reason: (e as { reason?: string; tag?: string }).reason,
      })),
    };
  } catch (err: any) {
    return { ready: true, account: null, events: [], error: String(err?.message || err).slice(0, 240) };
  }
}

/** Poll Brevo event stream for a messageId so Activity does not claim "sent" blindly. */
export async function pollBrevoDelivery(input: {
  messageId: string;
  to?: string;
  attempts?: number;
  delayMs?: number;
}): Promise<BrevoDeliveryProbe> {
  const apiKey = brevoApiKey();
  if (!apiKey) return { status: 'unknown', events: [] };
  const needle = normalizeMessageId(input.messageId);
  const attempts = Math.max(1, input.attempts ?? 4);
  const delayMs = Math.max(400, input.delayMs ?? 1200);
  let last: BrevoDeliveryProbe['events'] = [];
  for (let i = 0; i < attempts; i += 1) {
    if (i > 0) await sleep(delayMs);
    try {
      const qs = new URLSearchParams({ limit: '50', sort: 'desc', days: '7' });
      if (input.to) qs.set('email', input.to);
      const res = await fetch(`https://api.brevo.com/v3/smtp/statistics/events?${qs}`, {
        headers: { accept: 'application/json', 'api-key': apiKey },
      });
      if (!res.ok) continue;
      const body = (await res.json().catch(() => ({}))) as { events?: BrevoDeliveryProbe['events'] };
      const all = Array.isArray(body.events) ? body.events : [];
      const matched = all.filter((e) => {
        const mid = normalizeMessageId(String(e.messageId || ''));
        if (mid && (mid === needle || mid.includes(needle) || needle.includes(mid))) return true;
        // Fallback: same recipient in the last few minutes (Brevo sometimes omits messageId match).
        if (input.to && String(e.email || '').toLowerCase() === String(input.to).toLowerCase()) {
          const when = Date.parse(String(e.date || ''));
          if (Number.isFinite(when) && Date.now() - when < 10 * 60_000) return true;
        }
        return false;
      });
      if (matched.length) {
        last = matched;
        const status = classifyBrevoEvents(matched);
        if (status === 'delivered' || status === 'failed') {
          return { status, events: matched };
        }
      }
    } catch {
      /* keep polling */
    }
  }
  return { status: classifyBrevoEvents(last), events: last };
}

/** Brevo HTTP can return 201 while the platform is disabled and nothing is delivered. */
function useBrevoHttp() {
  const provider = mailProviderName();
  if (provider === 'smtp' || provider === 'godaddy' || provider === 'gmail') return false;
  if (provider === 'brevo' || provider === 'brevo-http') return Boolean(brevoApiKey());
  // Default off until Brevo transactional sending is enabled on the account.
  return false;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableBrevoFailure(status: number, errText: string) {
  if (status === 429 || status >= 500) return true;
  return /fetch failed|network|timeout|ECONN|ETIMEDOUT|socket|503|502|504/i.test(errText);
}

/** Business relay on Cloudflare Workers: HTTPS only (Workers cannot do SMTP TLS). */
export async function sendBusinessRelayViaBrevoHttp(input: {
  to: string;
  subject: string;
  html?: string;
  text?: string;
  fromName?: string;
  kind?: string;
}) {
  const apiKey = brevoApiKey();
  if (!apiKey) {
    throw new Error('BREVO_API_KEY is required for Business mail on Cloudflare');
  }
  const from = 'byjanbooks@easypado.com';
  const text = String(input.text || '').trim()
    || String(input.html || '').replace(/<[^>]*>?/gm, ' ').replace(/\s+/g, ' ').trim()
    || input.subject;
  const kind = input.kind || 'business.relay';
  return sendViaBrevoHttp(
    {
      to: input.to,
      subject: input.subject,
      html: input.html,
      text,
      fromName: input.fromName || 'Byjan Business',
      replyTo: from,
    },
    from,
    kind,
    text,
  );
}

async function sendViaBrevoHttp(input: {
  to: string;
  subject: string;
  html?: string;
  text?: string;
  fromName?: string;
  replyTo?: string;
  attachments?: Array<{ filename: string; content: Buffer | string; encoding?: string }>;
}, from: string, kind: string, text: string) {
  const apiKey = brevoApiKey();
  if (!apiKey) {
    throw new Error('BREVO_API_KEY is required for outbound mail');
  }
  const payload: Record<string, unknown> = {
    sender: { name: input.fromName || 'Byjan', email: from },
    to: [{ email: input.to }],
    replyTo: { email: input.replyTo || from },
    subject: input.subject,
    textContent: text,
    headers: outboundMailHeaders(kind),
  };
  if (input.html) payload.htmlContent = input.html;
  if (input.attachments?.length) {
    payload.attachment = input.attachments.map((a) => {
      const raw = a.content;
      const content = Buffer.isBuffer(raw)
        ? raw.toString('base64')
        : a.encoding === 'base64'
          ? String(raw).replace(/\s+/g, '')
          : Buffer.from(String(raw)).toString('base64');
      return { name: a.filename, content };
    });
  }

  let lastError: Error | null = null;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const res = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
          'api-key': apiKey,
        },
        body: JSON.stringify(payload),
      });
      const body = await res.json().catch(() => ({} as Record<string, unknown>));
      if (!res.ok) {
        const msg = String(
          (body as { message?: string; error?: string }).message
          || (body as { error?: string }).error
          || `Brevo HTTP ${res.status}`,
        );
        lastError = new Error(msg);
        if (attempt < 3 && isRetryableBrevoFailure(res.status, msg)) {
          await sleep(250 * attempt * attempt);
          continue;
        }
        throw lastError;
      }
      const messageId = String((body as { messageId?: string }).messageId || '').trim();
      if (!messageId) {
        throw new Error('Brevo accepted the request but returned no messageId');
      }
      return { messageId };
    } catch (err: any) {
      lastError = err instanceof Error ? err : new Error(String(err || 'Brevo send failed'));
      const textErr = mailErrorText(lastError);
      if (attempt < 3 && isRetryableBrevoFailure(0, textErr)) {
        await sleep(250 * attempt * attempt);
        continue;
      }
      throw lastError;
    }
  }
  throw lastError || new Error('Brevo send failed');
}

export async function writeOpsTrace(kind: string, detail: TraceDetail) {
  try {
    const { enrichOpsDetail } = await import('./ops-classify.js');
    const { ledgerSet } = await import('../_pg-tables.js');
    const id = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    await ledgerSet(`ops/trace/${id}`, {
      id,
      kind,
      at: new Date().toISOString(),
      ...enrichOpsDetail(kind, detail),
    });
  } catch {
    /* never block mail on trace write */
  }
}

let pooledTransport: { transporter: Transporter; settings: ReturnType<typeof smtpSettings> } | null = null;

export async function createSmtpTransport(): Promise<{
  transporter: Transporter;
  settings: ReturnType<typeof smtpSettings>;
}> {
  if (pooledTransport) return pooledTransport;
  const nodemailerMod: any = await import('nodemailer');
  const createTransport = nodemailerMod.createTransport || nodemailerMod.default?.createTransport;
  let settings: ReturnType<typeof smtpSettings>;
  try {
    settings = smtpSettings();
  } catch (err: any) {
    // Local `npm run dev` has no Vercel SMTP secrets — do not write email.config
    // into the shared ops ledger or Trace looks like production mail is down.
    if (process.env.VERCEL) {
      await writeOpsTrace('email.config', { ok: false, error: String(err?.message || err) });
    }
    throw err;
  }
  pooledTransport = {
    transporter: createTransport({ ...settings, pool: true, maxConnections: 2, maxMessages: 80 }),
    settings,
  };
  return pooledTransport;
}

export async function sendTracedMail(input: {
  to: string;
  subject: string;
  html?: string;
  text?: string;
  fromName?: string;
  replyTo?: string;
  kind?: string;
  attachments?: Array<{ filename: string; content: Buffer | string; contentType?: string; encoding?: string }>;
  /** When true (default on CF), poll Brevo events so callers can avoid false "sent" labels. */
  verifyDelivery?: boolean;
}) {
  const from = mailFromAddress();
  const text = String(input.text || '').trim()
    || String(input.html || '').replace(/<[^>]*>?/gm, ' ').replace(/\s+/g, ' ').trim();
  const kind = input.kind || 'email.send';
  const verifyDelivery = input.verifyDelivery ?? onCloudflareWorker();

  if (useBrevoHttp()) {
    try {
      const info = await sendViaBrevoHttp(input, from, kind, text);
      let delivery: BrevoDeliveryProbe | undefined;
      if (verifyDelivery && info?.messageId) {
        delivery = await pollBrevoDelivery({
          messageId: info.messageId,
          to: input.to,
          attempts: 5,
          delayMs: 1200,
        });
        // If Brevo gave a messageId but never logged a request/delivered event, treat as not delivered.
        // This account previously returned API success while transactional events stopped after Sep 11.
        if (delivery.status === 'unknown' || (delivery.status === 'accepted' && !delivery.events.some((e) => /delivered|opened|click/i.test(String(e.event || ''))))) {
          const health = await probeBrevoMailHealth({ email: input.to, limit: 20 }).catch(() => null);
          const relayEnabled = Boolean((health?.account as any)?.relay?.enabled);
          const recent = (health?.events || []).filter((e) => {
            const when = Date.parse(String(e.date || ''));
            return Number.isFinite(when) && Date.now() - when < 2 * 60 * 60_000;
          });
          if (!relayEnabled && recent.length === 0) {
            delivery = {
              status: 'failed',
              events: delivery.events,
              account: health?.account || null,
            };
            throw new Error(
              'Brevo accepted the API call but did not queue delivery (no transactional events). Transactional/SMTP sending is not active on this Brevo account — open Brevo support and enable transactional email for byjanbooks@easypado.com.',
            );
          }
        }
      }
      await writeOpsTrace(kind, {
        ok: delivery?.status !== 'failed',
        to: input.to,
        subject: String(input.subject || '').slice(0, 120),
        messageId: info?.messageId,
        via: 'brevo-http',
        deliveryStatus: delivery?.status || 'unknown',
        deliveryEvents: (delivery?.events || []).slice(0, 6).map((e) => e.event),
      });
      if (delivery?.status === 'failed') {
        const reason = delivery.events.map((e) => e.reason || e.event).filter(Boolean).join('; ') || 'Brevo delivery failed';
        throw new Error(reason);
      }
      return { ...info, delivery };
    } catch (httpErr: any) {
      const error = mailErrorText(httpErr);
      console.error('[mail]', kind, 'brevo-http', error);
      await writeOpsTrace(kind, {
        ok: false,
        to: input.to,
        subject: String(input.subject || '').slice(0, 120),
        error,
        via: 'brevo-http',
      });
      if (preferGodaddyOnly()) {
        /* keep going to GoDaddy SMTP; never treat Brevo as success */
      } else if (!godaddySmtpReady()) {
        throw httpErr;
      }
    }
  }

  const settings = smtpSettings();
  const messageId = easypadoMessageId();
  const mail: Record<string, unknown> = {
    from: `"${input.fromName || 'Byjan'}" <${from}>`,
    replyTo: input.replyTo || from,
    envelope: { from, to: input.to },
    to: input.to,
    subject: input.subject,
    text,
    messageId,
    headers: outboundMailHeaders(kind),
  };
  if (input.html) mail.html = input.html;
  if (input.attachments?.length) mail.attachments = input.attachments;

  const { transporter } = await createSmtpTransport();
  try {
    let info;
    try {
      info = await transporter.sendMail(mail);
    } catch (sendErr) {
      pooledTransport = null;
      throw sendErr;
    }
    void writeOpsTrace(kind, {
      ok: true,
      to: input.to,
      subject: String(input.subject || '').slice(0, 120),
      messageId: info.messageId,
      host: settings.host,
      port: settings.port,
      via: 'godaddy-smtp',
    });
    return { ...info, delivery: { status: 'accepted' as const, events: [] } };
  } catch (first: any) {
    const firstText = mailErrorText(first);
    if (isGoDaddySmtp() && settings.port !== 465 && /TLS Handshake Failed|ESOCKET|ECONNECTION/i.test(firstText)) {
      try {
        const nodemailerMod: any = await import('nodemailer');
        const createTransport = nodemailerMod.createTransport || nodemailerMod.default?.createTransport;
        const alt = createTransport({ ...settings, port: 465, secure: true, requireTLS: false });
        const info = await alt.sendMail(mail);
        await writeOpsTrace(kind, {
          ok: true,
          to: input.to,
          subject: String(input.subject || '').slice(0, 120),
          messageId: info.messageId,
          host: settings.host,
          port: 465,
          note: 'fallback-port-465',
        });
        return info;
      } catch {
        /* fall through */
      }
    }
    if (settings.port === 2525) {
      try {
        const nodemailerMod: any = await import('nodemailer');
        const createTransport = nodemailerMod.createTransport || nodemailerMod.default?.createTransport;
        const alt = createTransport({ ...settings, port: 587 });
        const info = await alt.sendMail(mail);
        await writeOpsTrace(kind, {
          ok: true,
          to: input.to,
          subject: String(input.subject || '').slice(0, 120),
          messageId: info.messageId,
          host: settings.host,
          port: 587,
          note: 'fallback-port-587',
        });
        return info;
      } catch (second: any) {
        const error = mailErrorText(second || first);
        console.error('[mail]', kind, error);
        await writeOpsTrace(kind, {
          ok: false,
          to: input.to,
          subject: String(input.subject || '').slice(0, 120),
          error,
          host: settings.host,
          port: 587,
        });
        throw second;
      }
    }
    const error = mailErrorText(first);
    console.error('[mail]', kind, error);
    await writeOpsTrace(kind, {
      ok: false,
      to: input.to,
      subject: String(input.subject || '').slice(0, 120),
      error,
      host: settings.host,
      port: settings.port,
    });
    throw first;
  }
}

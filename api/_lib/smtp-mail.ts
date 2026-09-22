import type { Transporter } from 'nodemailer';

type TraceDetail = Record<string, unknown>;

export function smtpAuth() {
  const user = String(process.env.SMTP_USER || process.env.BREVO_SMTP_USER || process.env.SMTP_LOGIN || '').trim();
  const pass = String(process.env.SMTP_PASS || process.env.BREVO_SMTP_KEY || process.env.BREVO_SMTP_PASS || '').trim();
  return { user, pass };
}

function smtpHost() {
  return String(process.env.SMTP_HOST || 'smtp-relay.brevo.com').trim().toLowerCase();
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
  return String(process.env.BREVO_API_KEY || process.env.BREVO_API_V3_KEY || '').trim();
}

/** Brevo HTTP can return 201 while the platform is disabled and nothing is delivered. */
function useBrevoHttp() {
  const provider = String(process.env.MAIL_PROVIDER || '').trim().toLowerCase();
  if (provider === 'smtp' || provider === 'godaddy' || provider === 'gmail') return false;
  if (provider === 'brevo' || provider === 'brevo-http') return Boolean(brevoApiKey());
  // Default off until Brevo transactional sending is enabled on the account.
  return false;
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
  if (!apiKey) return null;
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
    throw new Error(String((body as { message?: string; error?: string }).message || (body as { error?: string }).error || `Brevo HTTP ${res.status}`));
  }
  return { messageId: String((body as { messageId?: string }).messageId || '') };
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
}) {
  const from = mailFromAddress();
  const text = String(input.text || '').trim()
    || String(input.html || '').replace(/<[^>]*>?/gm, ' ').replace(/\s+/g, ' ').trim();
  const kind = input.kind || 'email.send';

  if (useBrevoHttp()) {
    try {
      const info = await sendViaBrevoHttp(input, from, kind, text);
      await writeOpsTrace(kind, {
        ok: true,
        to: input.to,
        subject: String(input.subject || '').slice(0, 120),
        messageId: info?.messageId,
        via: 'brevo-http',
      });
      return info;
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
      const { user, pass } = smtpAuth();
      if (!user || !pass) throw httpErr;
    }
  }

  const { transporter, settings } = await createSmtpTransport();
  const mail: Record<string, unknown> = {
    from: `"${input.fromName || 'Byjan'}" <${from}>`,
    replyTo: input.replyTo || from,
    envelope: { from, to: input.to },
    to: input.to,
    subject: input.subject,
    text,
    messageId: easypadoMessageId(),
    headers: outboundMailHeaders(kind),
  };
  if (input.html) mail.html = input.html;
  if (input.attachments?.length) mail.attachments = input.attachments;
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
    });
    return info;
  } catch (first: any) {
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

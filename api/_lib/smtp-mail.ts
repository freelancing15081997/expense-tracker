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
  return {
    host,
    // 587 STARTTLS. 2525 is a Brevo alternate; 465 needs secure:true.
    port: Number(process.env.SMTP_PORT || 587),
    secure: false,
    auth: { user, pass },
  };
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

export async function createSmtpTransport(): Promise<{
  transporter: Transporter;
  settings: ReturnType<typeof smtpSettings>;
}> {
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
  return { transporter: createTransport(settings), settings };
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
  const { transporter, settings } = await createSmtpTransport();
  const text = String(input.text || '').trim()
    || String(input.html || '').replace(/<[^>]*>?/gm, ' ').replace(/\s+/g, ' ').trim();
  const kind = input.kind || 'email.send';
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
    const info = await transporter.sendMail(mail);
    await writeOpsTrace(kind, {
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
        await writeOpsTrace(kind, {
          ok: false,
          to: input.to,
          subject: String(input.subject || '').slice(0, 120),
          error: String(second?.message || second || first?.message || 'Send failed'),
          host: settings.host,
          port: 587,
        });
        throw second;
      }
    }
    await writeOpsTrace(kind, {
      ok: false,
      to: input.to,
      subject: String(input.subject || '').slice(0, 120),
      error: String(first?.message || first || 'Send failed'),
      host: settings.host,
      port: settings.port,
    });
    throw first;
  }
}

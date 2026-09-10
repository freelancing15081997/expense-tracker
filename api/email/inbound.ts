import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const R2_REGION = 'auto';
const R2_SERVICE = 's3';
const DOC_PREFIX = 'documents/';
const INBOUND_DOMAIN = 'inbound.easypado.com';
const APP_ORIGIN = 'https://www.easypado.com';
const DEFAULT_FROM = 'byjanbooks@easypado.com';

function json(res: VercelResponse, status: number, payload: unknown) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify(payload));
}

function mailFrom() {
  const raw = String(process.env.MAIL_FROM || DEFAULT_FROM).trim();
  if (!raw || /gmail\.com$/i.test(raw)) return DEFAULT_FROM;
  return raw;
}

function inboundSecret() {
  return String(process.env.BREVO_INBOUND_SECRET || '').trim();
}

function header(req: VercelRequest, name: string) {
  const value = req.headers[name] ?? req.headers[name.toLowerCase()];
  if (Array.isArray(value)) return value[0] || '';
  return String(value || '');
}

function secretsMatch(got: string, expected: string) {
  const a = Buffer.from(got);
  const b = Buffer.from(expected);
  if (!got || !expected || a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function authorized(req: VercelRequest) {
  const expected = inboundSecret();
  if (!expected) return false;
  const url = new URL(req.url || '/', 'https://local.invalid');
  const auth = header(req, 'authorization');
  const bearer = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : '';
  const candidates = [
    header(req, 'x-inbound-secret'),
    header(req, 'x-brevo-secret'),
    bearer,
    String(url.searchParams.get('secret') || ''),
  ];
  return candidates.some((value) => secretsMatch(value, expected));
}

function r2Cfg() {
  const accessKeyId = process.env.R2_ACCESS_KEY_ID || '';
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY || '';
  const endpoint = (process.env.R2_ENDPOINT || '').replace(/\/+$/, '');
  const bucket = process.env.R2_BUCKET_NAME || '';
  if (!accessKeyId || !secretAccessKey || !endpoint || !bucket) {
    throw new Error('Cloudflare R2 is not configured. Set R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_ENDPOINT, and R2_BUCKET_NAME.');
  }
  return { accessKeyId, secretAccessKey, endpoint, bucket, host: new URL(endpoint).host };
}

function r2Sha256(data: Buffer | string) {
  return createHash('sha256').update(data).digest('hex');
}

function r2Hmac(key: Buffer | string, data: string) {
  return createHmac('sha256', key).update(data, 'utf8').digest();
}

function r2Encode(value: string) {
  return encodeURIComponent(value).replace(/[!'()*]/g, (ch) => `%${ch.charCodeAt(0).toString(16).toUpperCase()}`);
}

async function r2Fetch(method: string, key: string, opts?: { body?: Buffer | null; contentType?: string }) {
  const { accessKeyId, secretAccessKey, endpoint, bucket, host } = r2Cfg();
  const objectPath = key ? `/${bucket}/${key.split('/').filter(Boolean).map(r2Encode).join('/')}` : `/${bucket}`;
  const href = `${endpoint}${objectPath}`;
  const amzDate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8);
  const payload = opts?.body && opts.body.length ? opts.body : Buffer.alloc(0);
  const payloadHash = r2Sha256(payload);
  const headers: Record<string, string> = { host, 'x-amz-content-sha256': payloadHash, 'x-amz-date': amzDate };
  if (opts?.contentType) headers['content-type'] = opts.contentType;
  const signed = Object.keys(headers).sort();
  const canonicalHeaders = signed.map((name) => `${name}:${headers[name]}\n`).join('');
  const signedHeaders = signed.join(';');
  const canonicalRequest = [method, objectPath, '', canonicalHeaders, signedHeaders, payloadHash].join('\n');
  const scope = `${dateStamp}/${R2_REGION}/${R2_SERVICE}/aws4_request`;
  const kSigning = r2Hmac(r2Hmac(r2Hmac(r2Hmac(`AWS4${secretAccessKey}`, dateStamp), R2_REGION), R2_SERVICE), 'aws4_request');
  const signature = createHmac('sha256', kSigning).update(['AWS4-HMAC-SHA256', amzDate, scope, r2Sha256(canonicalRequest)].join('\n'), 'utf8').digest('hex');
  headers.authorization = `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
  return fetch(href, {
    method,
    headers,
    body: method === 'GET' || method === 'HEAD' || method === 'DELETE' ? undefined : payload,
  });
}

async function r2GetJson(key: string): Promise<Record<string, unknown> | null> {
  const res = await r2Fetch('GET', key);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`R2 read failed (${res.status})`);
  try {
    const parsed = JSON.parse(Buffer.from(await res.arrayBuffer()).toString('utf8'));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

async function r2PutJson(key: string, data: unknown) {
  const res = await r2Fetch('PUT', key, {
    body: Buffer.from(JSON.stringify(data ?? {}), 'utf8'),
    contentType: 'application/json',
  });
  if (!res.ok) throw new Error(`R2 write failed (${res.status})`);
}

async function r2PutBytes(key: string, body: Buffer, contentType: string) {
  const res = await r2Fetch('PUT', key, { body, contentType });
  if (!res.ok) throw new Error(`R2 write failed (${res.status})`);
}

function postgresUrl() {
  const raw =
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.DATABASE_URL_UNPOOLED ||
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.POSTGRES_PRISMA_URL ||
    '';
  if (!raw) return '';
  try {
    const url = new URL(raw);
    url.searchParams.delete('channel_binding');
    return url.toString();
  } catch {
    return raw;
  }
}

function cleanPath(path: string) {
  const clean = path.replace(/^\/+|\/+$/g, '').replace(/\.\./g, '');
  if (!clean || !/^[a-zA-Z0-9_./-]+$/.test(clean)) throw new Error('Invalid path');
  return clean;
}

function blobKey(path: string) {
  return `${DOC_PREFIX}${cleanPath(path)}.json`;
}

function asObject(value: unknown): Record<string, unknown> | null {
  if (typeof value === 'string') {
    try { value = JSON.parse(value); } catch { return null; }
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

let pgReady = false;

async function pgGet(path: string) {
  const { neon } = await import('@neondatabase/serverless');
  const sql = neon(postgresUrl());
  if (!pgReady) {
    await sql`CREATE TABLE IF NOT EXISTS documents (
      path TEXT PRIMARY KEY,
      data JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`;
    pgReady = true;
  }
  const p = cleanPath(path);
  const rows = await sql`SELECT data FROM documents WHERE path = ${p} LIMIT 1`;
  return rows[0] ? asObject(rows[0].data) : null;
}

async function pgSet(path: string, data: unknown) {
  const { neon } = await import('@neondatabase/serverless');
  const sql = neon(postgresUrl());
  if (!pgReady) {
    await sql`CREATE TABLE IF NOT EXISTS documents (
      path TEXT PRIMARY KEY,
      data JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`;
    pgReady = true;
  }
  const p = cleanPath(path);
  const payload = JSON.stringify(data ?? {});
  await sql`
    INSERT INTO documents (path, data, updated_at)
    VALUES (${p}, ${payload}::jsonb, NOW())
    ON CONFLICT (path) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()
  `;
}

async function docGet(path: string) {
  if (postgresUrl()) {
    const row = await pgGet(path);
    if (row) return row;
  }
  return r2GetJson(blobKey(path));
}

async function docSet(path: string, data: unknown) {
  if (postgresUrl()) {
    await pgSet(path, data);
    return;
  }
  await r2PutJson(blobKey(path), data);
}

function newId() {
  return randomBytes(12).toString('hex');
}

function emailsFrom(value: unknown): string[] {
  if (!value) return [];
  if (typeof value === 'string') {
    return (value.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || []).map((row) => row.toLowerCase());
  }
  if (Array.isArray(value)) return value.flatMap(emailsFrom);
  if (typeof value === 'object') {
    const row = value as Record<string, unknown>;
    return emailsFrom(row.Address || row.address || row.Email || row.email || row.Raw || Object.values(row));
  }
  return [];
}

function firstString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

function parseBookId(text: string) {
  const match = String(text || '').match(/l-([a-zA-Z0-9_-]+)@inbound\.easypado\.com/i);
  return match ? match[1] : '';
}

export function parseAmount(text: string) {
  const raw = String(text || '').replace(/,/g, '');
  const match =
    raw.match(/(?:₹|rs\.?|inr)\s*([0-9]+(?:\.[0-9]{1,2})?)/i) ||
    raw.match(/([0-9]+(?:\.[0-9]{1,2})?)\s*(?:₹|rs\.?|inr)/i);
  if (!match) return 0;
  const amount = Number(match[1]);
  return Number.isFinite(amount) ? amount : 0;
}

function entryTypeFrom(text: string) {
  if (/\b(received|credited|money in|refund)\b/i.test(text)) return 'in';
  return 'out';
}

function categoryFrom(subject: string, body: string) {
  const hay = `${subject}\n${body}`.toLowerCase();
  if (/\bphonepe\b/.test(hay) || /\bpaid to\b/.test(hay)) return 'Uncategorized';
  const trimmed = subject.replace(/^(fwd:|fw:|re:)\s*/i, '').trim();
  return trimmed ? trimmed.slice(0, 48) : 'Uncategorized';
}

type RoleRow = { role?: string; email?: string };
type Mailbox = {
  bookId: string;
  name: string;
  currency: string;
  ownerId?: string;
  roles: Record<string, RoleRow>;
};

function asMailbox(bookId: string, data: Record<string, unknown> | null): Mailbox | null {
  if (!data) return null;
  const roles = (data.roles && typeof data.roles === 'object' && !Array.isArray(data.roles))
    ? data.roles as Record<string, RoleRow>
    : {};
  return {
    bookId,
    name: String(data.name || 'Ledger'),
    currency: String(data.currency || 'INR'),
    ownerId: data.ownerId ? String(data.ownerId) : undefined,
    roles,
  };
}

async function loadMailbox(bookId: string) {
  const fromIndex = asMailbox(bookId, await docGet(`inbound_mailboxes/${bookId}`));
  if (fromIndex && Object.keys(fromIndex.roles).length) return fromIndex;
  return asMailbox(bookId, await docGet(`books/${bookId}`));
}

function matchMember(mailbox: Mailbox, fromEmail: string) {
  const needle = fromEmail.toLowerCase();
  for (const [uid, row] of Object.entries(mailbox.roles || {})) {
    if (String(row?.email || '').toLowerCase() === needle) {
      return { uid, email: String(row.email), role: String(row.role || 'contributor') };
    }
  }
  return null;
}

function fileExt(name: string, contentType: string) {
  const fromName = String(name || '').split('.').pop()?.toLowerCase() || '';
  if (['png', 'jpg', 'jpeg', 'webp', 'pdf'].includes(fromName)) return fromName === 'jpeg' ? 'jpg' : fromName;
  if (contentType.includes('png')) return 'png';
  if (contentType.includes('webp')) return 'webp';
  if (contentType.includes('pdf')) return 'pdf';
  if (contentType.includes('jpeg') || contentType.includes('jpg')) return 'jpg';
  return '';
}

async function fetchAttachment(token: string) {
  const apiKey = String(process.env.BREVO_API_KEY || '').trim();
  if (!apiKey || !token) return null;
  const res = await fetch(`https://api.brevo.com/v3/inbound/attachments/${encodeURIComponent(token)}`, {
    headers: { 'api-key': apiKey },
  });
  if (!res.ok) return null;
  const bytes = Buffer.from(await res.arrayBuffer());
  if (!bytes.length || bytes.length > 8 * 1024 * 1024) return null;
  return { bytes, contentType: res.headers.get('content-type') || 'application/octet-stream' };
}

async function storeReceipt(bookId: string, attachment: { Name?: string; ContentType?: string; DownloadToken?: string }) {
  const ext = fileExt(String(attachment.Name || ''), String(attachment.ContentType || ''));
  if (!ext) return null;
  const downloaded = await fetchAttachment(String(attachment.DownloadToken || ''));
  if (!downloaded) return null;
  const id = newId();
  const path = `books/${bookId}/files/${id}.${ext}`;
  await r2PutBytes(path, downloaded.bytes, downloaded.contentType || attachment.ContentType || 'application/octet-stream');
  return { path, name: String(attachment.Name || `receipt.${ext}`), contentType: downloaded.contentType };
}

async function sendMail(to: string, subject: string, html: string) {
  const nodemailerMod: any = await import('nodemailer');
  const createTransport = nodemailerMod.createTransport || nodemailerMod.default?.createTransport;
  const settings = {
    host: process.env.SMTP_HOST || 'smtp-relay.brevo.com',
    port: Number(process.env.SMTP_PORT || 2525),
    secure: false,
    auth: {
      user: process.env.SMTP_USER || 'b7ffda001@smtp-brevo.com',
      pass: process.env.SMTP_PASS || 'bskbpWFhUtdUJPH',
    },
  };
  let transporter = createTransport(settings);
  const from = mailFrom();
  const mail = {
    from: `"Byjan Notifications" <${from}>`,
    replyTo: from,
    envelope: { from, to },
    to,
    subject,
    text: html.replace(/<[^>]*>?/gm, ''),
    html,
  };
  try {
    await transporter.sendMail(mail);
  } catch (first) {
    if (settings.port === 2525) {
      transporter = createTransport({ ...settings, port: 587 });
      await transporter.sendMail(mail);
      return;
    }
    throw first;
  }
}

async function notifyMembers(mailbox: Mailbox, detail: string, bookId: string) {
  const emails = Object.values(mailbox.roles).map((row) => String(row?.email || '').toLowerCase()).filter(Boolean);
  const unique = [...new Set(emails)];
  const link = `${APP_ORIGIN}/#/book/${bookId}`;
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
      <p style="font-weight:700;color:#0B1F3A">Byjan</p>
      <p>A PhonePe receipt arrived for <strong>${mailbox.name}</strong>.</p>
      <p>${detail}</p>
      <p>Open the ledger, set the category if needed, and keep or edit the draft.</p>
      <p><a href="${link}">Open ledger</a></p>
    </div>
  `;
  for (const email of unique) {
    try {
      await sendMail(email, `Receipt arrived in ${mailbox.name}`, html);
    } catch (err) {
      console.error('inbound notify failed', email, err);
    }
  }
  for (const uid of Object.keys(mailbox.roles)) {
    const id = newId();
    await docSet(`notifications/${id}`, {
      id,
      userId: uid,
      bookId,
      bookName: mailbox.name,
      action: 'Receipt by email',
      detail,
      senderName: 'Inbound mail',
      createdAt: new Date().toISOString(),
      read: false,
    }).catch(() => undefined);
  }
}

function itemsFrom(body: any): any[] {
  if (Array.isArray(body?.items)) return body.items;
  if (body && typeof body === 'object' && (body.From || body.To || body.Subject)) return [body];
  return [];
}

async function processItem(item: any) {
  const recipients = [
    ...emailsFrom(item.To),
    ...emailsFrom(item.Cc),
    ...emailsFrom(item.Recipient),
    ...emailsFrom(item.Recipients),
    ...emailsFrom(item.Headers?.['Delivered-To']),
    ...emailsFrom(item.Headers?.['X-Original-To']),
  ];
  const bookId = recipients.map(parseBookId).find(Boolean) || parseBookId(JSON.stringify(item));
  if (!bookId) return { skipped: 'no ledger address' };

  const messageId = firstString(item.Uuid, item.MessageId, item.Headers?.['Message-ID'], item.Headers?.['Message-Id']) || newId();
  const seenKey = `inbound_seen/${createHash('sha256').update(messageId).digest('hex').slice(0, 32)}`;
  if (await docGet(seenKey)) return { skipped: 'duplicate', bookId };

  const mailbox = await loadMailbox(bookId);
  if (!mailbox) return { skipped: 'unknown ledger', bookId };

  const fromEmail = emailsFrom(item.From)[0] || emailsFrom(item.Headers?.From)[0] || '';
  const member = matchMember(mailbox, fromEmail);
  if (!member) return { skipped: 'unknown sender', bookId, from: fromEmail };

  const subject = firstString(item.Subject, item.Headers?.Subject) || 'PhonePe receipt';
  const body = firstString(item.ExtractedMarkdownMessage, item.RawTextBody, item.RawHtmlBody?.replace(/<[^>]*>?/gm, ' '));
  const hay = `${subject}\n${body}`;
  const amount = parseAmount(hay);
  const category = categoryFrom(subject, body);
  const attachments = Array.isArray(item.Attachments) ? item.Attachments : [];
  let receipt: { path: string; name: string; contentType: string } | null = null;
  for (const attachment of attachments) {
    try {
      receipt = await storeReceipt(bookId, attachment);
      if (receipt) break;
    } catch (err) {
      console.error('inbound receipt store failed', err);
    }
  }

  const id = newId();
  const description = subject.replace(/^(fwd:|fw:|re:)\s*/i, '').trim() || 'PhonePe receipt';
  const expense = {
    id,
    amount,
    description,
    category,
    entryType: entryTypeFrom(hay),
    date: new Date().toISOString().split('T')[0],
    paidByName: member.email,
    enteredBy: member.email,
    enteredByUid: member.uid,
    enteredByEmail: member.email,
    createdAt: new Date().toISOString(),
    status: 'draft',
    source: 'email',
    emailMessageId: messageId,
    receiptPath: receipt?.path || null,
    receiptName: receipt?.name || null,
  };
  await docSet(`books/${bookId}/expenses/${id}`, expense);
  await docSet(seenKey, { id, bookId, at: new Date().toISOString() });
  const detail = amount
    ? `Draft ${mailbox.currency} ${amount.toFixed(2)} · ${category} · from ${member.email}`
    : `Draft from ${member.email}. Amount was not in the mail — open the ledger and fill it in.`;
  await notifyMembers(mailbox, detail, bookId);
  return { ok: true, bookId, expenseId: id, amount, category };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method === 'OPTIONS') {
      res.statusCode = 204;
      res.end();
      return;
    }
    if (req.method !== 'POST') {
      json(res, 405, { error: 'POST required' });
      return;
    }
    if (!inboundSecret()) {
      json(res, 503, { error: 'Set BREVO_INBOUND_SECRET on the server.' });
      return;
    }
    if (!authorized(req)) {
      json(res, 401, { error: 'Invalid inbound secret' });
      return;
    }
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const items = itemsFrom(body);
    const results = [];
    for (const item of items) {
      results.push(await processItem(item));
    }
    json(res, 200, { ok: true, count: results.length, results });
  } catch (err: any) {
    json(res, 500, { error: err?.message || 'Inbound parse failed' });
  }
}

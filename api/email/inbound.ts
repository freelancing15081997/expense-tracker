import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const R2_REGION = 'auto';
const R2_SERVICE = 's3';
const DOC_PREFIX = 'documents/';
const INBOUND_DOMAIN = 'easypado.com';
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
  return String(
    process.env.INBOUND_WEBHOOK_SECRET ||
    process.env.BREVO_INBOUND_SECRET ||
    '',
  ).trim();
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
    header(req, 'x-webhook-secret'),
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

function inboundLocals(text: string) {
  return (String(text || '').match(/[A-Z0-9._+-]+@(?:(?:in|inbound)\.)?easypado\.com/gi) || [])
    .map((row) => row.split('@')[0].toLowerCase())
    .filter(Boolean);
}

function inboundMailboxSlug(name: string) {
  const slug = String(name || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .replace(/[_\s]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
  return slug || 'ledger';
}

function parseBookIdLocal(local: string) {
  const match = String(local || '').match(/^l-([a-zA-Z0-9]{16,})$/i);
  return match ? match[1] : '';
}

type ParsedReceipt = {
  amount: number;
  date: string;
  merchant: string;
  description: string;
  category: string;
  entryType: 'in' | 'out';
  documentType: 'receipt' | 'bill' | 'invoice';
  parseSource: 'text' | 'image' | 'mixed';
};

const CATEGORY_RULES: Array<{ category: string; pattern: RegExp }> = [
  { category: 'Fuel', pattern: /\b(petrol|diesel|fuel|cng|hpcl|iocl|bpcl|nayara|indian oil|bharat petroleum|hindustan petroleum|shell|indianOil|pump)\b/i },
  { category: 'Groceries', pattern: /\b(grocery|groceries|supermarket|dmart|d-mart|big bazaar|reliance fresh|more supermarket|foodgrain)\b/i },
  { category: 'Meals', pattern: /\b(restaurant|cafe|swiggy|zomato|dining|meal|food|lunch|dinner|breakfast)\b/i },
  { category: 'Travel', pattern: /\b(uber|ola|rapido|irctc|flight|airline|hotel|metro|taxi|cab|toll|parking)\b/i },
  { category: 'Utilities', pattern: /\b(electricity|water bill|gas bill|broadband|wifi|internet|rent|maintenance)\b/i },
  { category: 'Health', pattern: /\b(hospital|pharmacy|medicine|clinic|apollo|diagnostic)\b/i },
  { category: 'Shopping', pattern: /\b(amazon|flipkart|myntra|ajio|store|mall)\b/i },
  { category: 'Software Subscriptions', pattern: /\b(subscription|saas|aws|github|google workspace|microsoft 365)\b/i },
];

function toNumber(raw: string) {
  const amount = Number(String(raw || '').replace(/,/g, ''));
  return Number.isFinite(amount) && amount > 0 && amount < 100_000_000 ? amount : 0;
}

function parseIsoDate(value: string) {
  const raw = String(value || '').trim();
  const iso = raw.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const dmy = raw.match(/\b(\d{1,2})[/-](\d{1,2})[/-](20\d{2})\b/);
  if (dmy) {
    const day = dmy[1].padStart(2, '0');
    const month = dmy[2].padStart(2, '0');
    if (Number(month) <= 12) return `${dmy[3]}-${month}-${day}`;
  }
  const named = raw.match(/\b(\d{1,2})\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?,?\s+(20\d{2})\b/i);
  if (named) {
    const months: Record<string, string> = { jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06', jul: '07', aug: '08', sep: '09', sept: '09', oct: '10', nov: '11', dec: '12' };
    const month = months[named[2].toLowerCase().slice(0, 4)] || months[named[2].toLowerCase().slice(0, 3)];
    if (month) return `${named[3]}-${month}-${named[1].padStart(2, '0')}`;
  }
  return '';
}

function clipQuoted(text: string) {
  const cut = String(text || '')
    .replace(/\r/g, '')
    .split(/\nOn .+wrote:|\nFrom: .+(\nSent:)?|\n-{2,}\s*Original Message\s*-{2,}|\n-- \n/i)[0];
  return cut.replace(/\s+/g, ' ').trim().slice(0, 8000);
}

function stripHtml(value: string) {
  return String(value || '').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&');
}

function cleanSubject(subject: string) {
  return String(subject || '').replace(/^(fwd:|fw:|re:)\s*/ig, '').replace(/\.(jpg|jpeg|png|webp|pdf)$/i, '').trim();
}

function parseAmount(text: string) {
  const hay = String(text || '');
  const labeled = hay.match(/(?:grand\s*total|net\s*(?:payable|amount|total)|amount\s*(?:paid|due)|total\s*amount|total|paid)\s*[:\-–]?\s*(?:₹|rs\.?|inr|usd|eur|gbp|\$)?\s*([0-9]{1,3}(?:,[0-9]{2,3})+(?:\.[0-9]{1,2})?|[0-9]+(?:\.[0-9]{1,2})?)/i);
  if (labeled) {
    const amount = toNumber(labeled[1]);
    if (amount) return amount;
  }
  const currency = hay.match(/(?:₹|rs\.?\s*|inr\s*)([0-9]{1,3}(?:,[0-9]{2,3})+(?:\.[0-9]{1,2})?|[0-9]+(?:\.[0-9]{1,2})?)/i)
    || hay.match(/\$\s*([0-9]+(?:,[0-9]{3})*(?:\.[0-9]{1,2})?)/);
  if (currency) {
    const amount = toNumber(currency[1]);
    if (amount) return amount;
  }
  return 0;
}

export { parseAmount };

function categoryFromText(text: string) {
  const hay = String(text || '');
  for (const rule of CATEGORY_RULES) {
    if (rule.pattern.test(hay)) return rule.category;
  }
  return 'Uncategorized';
}

function merchantFrom(text: string) {
  const hay = String(text || '');
  const match =
    hay.match(/paid to\s+([^\n,]+)/i) ||
    hay.match(/merchant(?:\s*name)?\s*[:\-]\s*([^\n]+)/i) ||
    hay.match(/billed by\s*[:\-]?\s*([^\n]+)/i) ||
    hay.match(/vendor\s*[:\-]\s*([^\n]+)/i) ||
    hay.match(/sold by\s*[:\-]\s*([^\n]+)/i);
  const labeled = String(match?.[1] || '').replace(/\s+/g, ' ').trim();
  if (labeled) return labeled.slice(0, 80);
  const first = hay
    .split(/\n/)
    .map((line) => line.trim())
    .find((line) => line.length >= 3 && line.length <= 80 && !/^(date|amount|total|volume|qty|invoice|receipt|bill|fwd:|fw:|re:)/i.test(line));
  return String(first || '').slice(0, 80);
}

function entryTypeFrom(text: string) {
  if (/\b(received|credited|money in|refund|incoming)\b/i.test(text)) return 'in' as const;
  return 'out' as const;
}

function documentTypeFrom(text: string) {
  if (/\binvoice\b/i.test(text)) return 'invoice' as const;
  if (/\bbill\b/i.test(text)) return 'bill' as const;
  return 'receipt' as const;
}

export function parseReceiptFields(text: string, extras?: { subject?: string; fileName?: string }): ParsedReceipt {
  const subject = cleanSubject(extras?.subject || '');
  const fileName = String(extras?.fileName || '').replace(/[_-]+/g, ' ');
  const hay = `${subject}\n${fileName}\n${text}`;
  const merchant = merchantFrom(text) || merchantFrom(fileName);
  const category = categoryFromText(hay);
  const amount = parseAmount(hay);
  const date = parseIsoDate(hay) || new Date().toISOString().split('T')[0];
  const fallback = subject || merchant || cleanSubject(fileName) || 'Inbound document';
  const description = [merchant, subject && subject.toLowerCase() !== merchant.toLowerCase() ? subject : '']
    .filter(Boolean)
    .join(' · ')
    .slice(0, 120) || fallback.slice(0, 120);
  return {
    amount,
    date,
    merchant,
    description,
    category,
    entryType: entryTypeFrom(hay),
    documentType: documentTypeFrom(hay),
    parseSource: 'text',
  };
}

function geminiKey() {
  return String(process.env.GEMINI_API_KEY || process.env.GOOGLE_GENAI_API_KEY || process.env.GOOGLE_API_KEY || '').trim();
}

function mimeForGemini(contentType: string, fileName = '') {
  const type = String(contentType || '').toLowerCase();
  const ext = String(fileName || '').split('.').pop()?.toLowerCase() || '';
  if (type.startsWith('image/')) return type === 'image/jpg' ? 'image/jpeg' : type;
  if (type === 'application/pdf' || ext === 'pdf') return 'application/pdf';
  if (['png', 'jpg', 'jpeg', 'webp'].includes(ext)) return ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
  return '';
}

function asParsed(value: any, fallback: ParsedReceipt): ParsedReceipt {
  if (!value || typeof value !== 'object') return fallback;
  const amount = toNumber(value.amount);
  const date = parseIsoDate(String(value.date || '')) || fallback.date;
  const merchant = String(value.merchant || fallback.merchant || '').slice(0, 80);
  const description = String(value.description || merchant || fallback.description).slice(0, 120);
  const category = String(value.category || '').trim() || fallback.category;
  const entryType = value.entryType === 'in' ? 'in' : 'out';
  const documentType = value.documentType === 'invoice' || value.documentType === 'bill' ? value.documentType : 'receipt';
  return {
    amount: amount || fallback.amount,
    date,
    merchant: merchant || fallback.merchant,
    description: description || fallback.description,
    category: category === 'Uncategorized' ? fallback.category : category,
    entryType: fallback.entryType === 'in' ? 'in' : entryType,
    documentType,
    parseSource: fallback.amount && amount ? 'mixed' : amount ? 'image' : fallback.parseSource,
  };
}

async function parseDocumentWithGemini(bytes: Buffer, contentType: string, fileName: string, fallback: ParsedReceipt) {
  const key = geminiKey();
  const mime = mimeForGemini(contentType, fileName);
  if (!key || !mime || !bytes.length) return fallback;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 18_000);
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${encodeURIComponent(key)}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [{
          parts: [
            {
              text: 'Read this receipt, bill, or invoice. Return JSON only with keys amount (number), date (YYYY-MM-DD), merchant, description, category (Fuel, Groceries, Meals, Travel, Utilities, Health, Shopping, Software Subscriptions, or Uncategorized), entryType (out unless it is money received), documentType (receipt, bill, or invoice). Use 0 if amount is missing. Do not invent amounts.',
            },
            { inline_data: { mime_type: mime, data: bytes.toString('base64') } },
          ],
        }],
        generationConfig: { temperature: 0, responseMimeType: 'application/json' },
      }),
    });
    if (!res.ok) return fallback;
    const payload = await res.json();
    const raw = String(payload?.candidates?.[0]?.content?.parts?.[0]?.text || '').replace(/^```json\s*|\s*```$/g, '');
    return asParsed(JSON.parse(raw), fallback);
  } catch {
    return fallback;
  } finally {
    clearTimeout(timer);
  }
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

async function resolveBookId(item: any) {
  const locals = [
    ...inboundLocals(JSON.stringify(item)),
    ...emailsFrom(item.To).flatMap(inboundLocals),
    ...emailsFrom(item.Cc).flatMap(inboundLocals),
    ...emailsFrom(item.Recipient).flatMap(inboundLocals),
    ...emailsFrom(item.Recipients).flatMap(inboundLocals),
  ];
  const unique = [...new Set(locals)];
  for (const local of unique) {
    const fromId = parseBookIdLocal(local);
    if (fromId) return fromId;
  }
  for (const local of unique) {
    const slug = inboundMailboxSlug(local);
    const alias = await docGet(`inbound_aliases/${slug}`);
    const bookId = String(alias?.bookId || '').trim();
    if (bookId) return bookId;
  }
  return '';
}

function trustedInboundSenders() {
  const raw = String(
    process.env.INBOUND_TRUSTED_SENDERS ||
    'byjanbooks@gmail.com',
  ).trim();
  return new Set(
    raw
      .split(/[,;\s]+/)
      .map((row) => row.trim().toLowerCase())
      .filter(Boolean),
  );
}

function matchMember(mailbox: Mailbox, fromEmail: string) {
  const needle = fromEmail.toLowerCase();
  if (!needle) return null;
  for (const [uid, row] of Object.entries(mailbox.roles || {})) {
    if (String(row?.email || '').toLowerCase() === needle) {
      return { uid, email: String(row.email), role: String(row.role || 'contributor') };
    }
  }
  // Global operators (e.g. main Byjan Gmail) can post to any ledger without joining each team.
  if (!trustedInboundSenders().has(needle)) return null;
  const owner =
    Object.entries(mailbox.roles || {}).find(([, row]) => String(row?.role || '') === 'owner') ||
    Object.entries(mailbox.roles || {})[0];
  return {
    uid: owner?.[0] || String(mailbox.ownerId || 'trusted-sender'),
    email: needle,
    role: 'contributor',
  };
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

function attachmentBytes(attachment: Record<string, unknown>) {
  const raw =
    attachment.content ??
    attachment.Content ??
    attachment.contentBase64 ??
    attachment.ContentBase64 ??
    attachment.data ??
    attachment.Data;
  if (typeof raw === 'string' && raw.trim()) {
    try {
      const bytes = Buffer.from(raw.replace(/^data:[^;]+;base64,/, ''), 'base64');
      if (bytes.length && bytes.length <= 8 * 1024 * 1024) return bytes;
    } catch {
      return null;
    }
  }
  if (Buffer.isBuffer(raw) && raw.length && raw.length <= 8 * 1024 * 1024) return raw;
  return null;
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

async function storeReceipt(bookId: string, attachment: Record<string, unknown>) {
  const name = String(attachment.Name || attachment.filename || attachment.fileName || attachment.name || 'receipt');
  const contentType = String(attachment.ContentType || attachment.contentType || attachment.type || 'application/octet-stream');
  const ext = fileExt(name, contentType);
  if (!ext) return null;

  // Prefer inline bytes from Haraka (fast, no third-party download).
  let bytes = attachmentBytes(attachment);
  let resolvedType = contentType;
  if (!bytes) {
    const token = String(attachment.DownloadToken || attachment.downloadToken || '');
    const downloaded = token ? await fetchAttachment(token) : null;
    if (!downloaded) return null;
    bytes = downloaded.bytes;
    resolvedType = downloaded.contentType || contentType;
  }

  const id = newId();
  const path = `books/${bookId}/files/${id}.${ext}`;
  await r2PutBytes(path, bytes, resolvedType || `image/${ext}`);
  return {
    path,
    name: name.includes('.') ? name : `receipt.${ext}`,
    contentType: resolvedType || `image/${ext}`,
    bytes,
  };
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

async function logInboundEvent(bookId: string, event: Record<string, unknown>) {
  const id = newId();
  await docSet(`books/${bookId}/inbound_events/${id}`, {
    id,
    bookId,
    createdAt: new Date().toISOString(),
    ...event,
  });
  return id;
}

async function notifyMembers(
  mailbox: Mailbox,
  detail: string,
  bookId: string,
  senderName: string,
  action: string,
  inboundEventId?: string,
) {
  const emails = Object.values(mailbox.roles).map((row) => String(row?.email || '').toLowerCase()).filter(Boolean);
  const unique = [...new Set(emails)];
  const link = `${APP_ORIGIN}/#/book/${bookId}`;
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;background:#f8fafc;border:1px solid #e5e7eb;border-radius:12px">
      <p style="font-weight:700;color:#0B1F3A;letter-spacing:1px">Byjan</p>
      <h2 style="color:#111827;font-size:20px;margin:12px 0 8px">Inbound mail · ${mailbox.name}</h2>
      <p style="color:#374151;font-size:15px;line-height:1.5"><strong>${senderName}</strong> — ${action}</p>
      <p style="color:#0f172a;font-size:15px;font-weight:500">${detail}</p>
      <p style="text-align:center;margin:28px 0 8px">
        <a href="${link}" style="display:inline-block;background:#0B1F3A;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:700;font-size:14px">Open ledger in Byjan</a>
      </p>
      <p style="text-align:center;color:#64748b;font-size:12px;margin:0">Or paste this link:<br/><a href="${link}" style="color:#0B1F3A">${link}</a></p>
    </div>
  `;
  let sent = 0;
  let failed = 0;
  const mailResults = await Promise.allSettled(
    unique.map(async (email) => {
      await sendMail(email, `Inbound mail in ${mailbox.name}`, html);
      await docSet(`books/${bookId}/email_events/${newId()}`, {
        direction: 'outbound',
        status: 'sent',
        toEmail: email,
        subject: `Inbound mail in ${mailbox.name}`,
        action,
        detail,
        createdAt: new Date().toISOString(),
      }).catch(() => undefined);
      return email;
    }),
  );
  for (let i = 0; i < mailResults.length; i += 1) {
    const result = mailResults[i];
    const email = unique[i];
    if (result.status === 'fulfilled') {
      sent += 1;
      continue;
    }
    failed += 1;
    console.error('inbound notify failed', email, result.reason);
    await docSet(`books/${bookId}/email_events/${newId()}`, {
      direction: 'outbound',
      status: 'failed',
      toEmail: email,
      subject: `Inbound mail in ${mailbox.name}`,
      action,
      detail: String(result.reason?.message || result.reason || 'Send failed'),
      createdAt: new Date().toISOString(),
    }).catch(() => undefined);
  }
  for (const uid of Object.keys(mailbox.roles)) {
    const id = newId();
    await docSet(`notifications/${id}`, {
      id,
      userId: uid,
      bookId,
      bookName: mailbox.name,
      kind: 'inbound',
      action,
      detail,
      senderName,
      link,
      createdAt: new Date().toISOString(),
      read: false,
    }).catch(() => undefined);
  }
  if (inboundEventId) {
    const current = await docGet(`books/${bookId}/inbound_events/${inboundEventId}`);
    if (current) {
      await docSet(`books/${bookId}/inbound_events/${inboundEventId}`, {
        ...current,
        teamNotified: sent > 0,
        notifySent: sent,
        notifyFailed: failed,
      }).catch(() => undefined);
    }
  }
}

function normalizeItem(raw: any) {
  if (!raw || typeof raw !== 'object') return null;
  // Haraka / Cloudflare Email Worker payload (attachments already inline).
  if (
    raw.source === 'haraka' ||
    raw.source === 'cloudflare-email' ||
    raw.haraka ||
    (!raw.From && (raw.from || raw.to))
  ) {
    const attachments = Array.isArray(raw.attachments)
      ? raw.attachments.map((att: any) => ({
          Name: att.filename || att.fileName || att.name || att.Name,
          ContentType: att.contentType || att.mimeType || att.type || att.ContentType,
          content: att.content || att.Content || att.contentBase64,
        }))
      : [];
    return {
      Uuid: raw.messageId || raw.Uuid || raw.id || raw.receivedAt,
      MessageId: raw.messageId || raw.MessageId,
      From: raw.from || raw.From,
      To: raw.to || raw.To,
      Cc: raw.cc || raw.Cc,
      Subject: raw.subject || raw.Subject,
      RawTextBody: raw.text || raw.RawTextBody || '',
      RawHtmlBody: raw.html || raw.RawHtmlBody || '',
      ExtractedMarkdownMessage: raw.text || '',
      Attachments: attachments,
      Headers: raw.headers || raw.Headers || {},
    };
  }
  return raw;
}

function itemsFrom(body: any): any[] {
  if (Array.isArray(body?.items)) return body.items.map(normalizeItem).filter(Boolean);
  if (body && typeof body === 'object') {
    const one = normalizeItem(body);
    if (one && (one.From || one.To || one.Subject || one.RawTextBody || one.Attachments?.length)) return [one];
  }
  return [];
}

async function processItem(item: any) {
  const bookId = await resolveBookId(item);
  if (!bookId) return { skipped: 'no ledger address' };

  const messageId = firstString(item.Uuid, item.MessageId, item.Headers?.['Message-ID'], item.Headers?.['Message-Id']) || newId();
  const seenKey = `inbound_seen/${createHash('sha256').update(messageId).digest('hex').slice(0, 32)}`;
  if (await docGet(seenKey)) return { skipped: 'duplicate', bookId };

  const mailbox = await loadMailbox(bookId);
  if (!mailbox) return { skipped: 'unknown ledger', bookId };

  const fromEmail = emailsFrom(item.From)[0] || emailsFrom(item.Headers?.From)[0] || '';
  const subject = firstString(item.Subject, item.Headers?.Subject);
  const member = matchMember(mailbox, fromEmail);
  if (!member) {
    await docSet(seenKey, { bookId, at: new Date().toISOString(), status: 'rejected' });
    const eventId = await logInboundEvent(bookId, {
      status: 'rejected',
      reason: fromEmail ? 'Sender is not a member of this ledger' : 'No From address',
      fromEmail: fromEmail || '(missing)',
      subject: subject || '(no subject)',
    });
    await notifyMembers(
      mailbox,
      fromEmail
        ? `${fromEmail} sent mail to this ledger. No entry was created because that address is not on the team.`
        : 'Mail arrived with no From address. No entry was created.',
      bookId,
      fromEmail || 'Unknown sender',
      'Inbound mail was not added',
      eventId,
    ).catch(() => undefined);
    return { skipped: 'sender is not a member', bookId, from: fromEmail };
  }
  const body = clipQuoted(firstString(
    item.ExtractedMarkdownMessage,
    item.RawTextBody,
    stripHtml(String(item.RawHtmlBody || item.HtmlBody || '')),
  ));
  const attachments = Array.isArray(item.Attachments) ? item.Attachments : [];
  let receipt: { path: string; name: string; contentType: string; bytes: Buffer } | null = null;
  for (const attachment of attachments) {
    try {
      receipt = await storeReceipt(bookId, attachment);
      if (receipt) break;
    } catch (err) {
      console.error('inbound receipt store failed', err);
    }
  }

  let parsed = parseReceiptFields(body, { subject, fileName: receipt?.name || attachments[0]?.Name || '' });
  if (receipt?.bytes) {
    parsed = await parseDocumentWithGemini(receipt.bytes, receipt.contentType, receipt.name, parsed);
  }

  const id = newId();
  const expense = {
    id,
    amount: parsed.amount,
    description: parsed.description,
    category: parsed.category,
    entryType: parsed.entryType,
    date: parsed.date,
    paidByName: member.email,
    enteredBy: member.email,
    enteredByUid: member.uid,
    enteredByEmail: member.email,
    createdAt: new Date().toISOString(),
    status: parsed.amount > 0 ? 'recorded' : 'draft',
    source: 'email',
    documentType: parsed.documentType,
    merchant: parsed.merchant || null,
    parseSource: parsed.parseSource,
    emailMessageId: messageId,
    receiptPath: receipt?.path || null,
    receiptName: receipt?.name || null,
  };
  await docSet(`books/${bookId}/expenses/${id}`, expense);
  await docSet(seenKey, { id, bookId, at: new Date().toISOString(), status: 'accepted' });
  if (parsed.category && parsed.category !== 'Uncategorized') {
    try {
      const bookDoc = await docGet(`books/${bookId}`);
      if (bookDoc) {
        const existing = Array.isArray(bookDoc.categories) ? bookDoc.categories.map(String) : [];
        if (!existing.some((c) => c.toLowerCase() === parsed.category.toLowerCase())) {
          await docSet(`books/${bookId}`, { ...bookDoc, categories: [...existing, parsed.category] });
        }
      }
    } catch {
      // category merge is best-effort
    }
  }
  const eventId = await logInboundEvent(bookId, {
    status: 'accepted',
    fromEmail: member.email,
    subject: subject || '(no subject)',
    expenseId: id,
    amount: parsed.amount,
    category: parsed.category,
    description: parsed.description,
    hasFile: Boolean(receipt?.path),
  });
  const detail = parsed.amount
    ? `${mailbox.currency} ${parsed.amount.toFixed(2)} · ${parsed.category} · ${parsed.description} · from ${member.email}`
    : `Entry from ${member.email}. Amount was not found on the document — open the ledger and fill it in.`;
  await notifyMembers(mailbox, detail, bookId, member.email, 'sent inbound mail. Byjan added an entry', eventId).catch(() => undefined);
  return { ok: true, bookId, expenseId: id, amount: parsed.amount, category: parsed.category, date: parsed.date };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method === 'OPTIONS') {
      res.statusCode = 204;
      res.end();
      return;
    }
    if (req.method === 'GET' || req.method === 'HEAD') {
      json(res, 200, {
        ok: true,
        service: 'inbound-email',
        accepts: 'POST',
        secretConfigured: Boolean(inboundSecret()),
      });
      return;
    }
    if (req.method !== 'POST') {
      json(res, 405, { error: 'POST required' });
      return;
    }
    if (!inboundSecret()) {
      json(res, 503, { error: 'Set INBOUND_WEBHOOK_SECRET on the server.' });
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

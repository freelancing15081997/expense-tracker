import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { postgresUrl, cleanPath, ledgerGet, ledgerSet, ledgerInsertIfNew, ledgerList } from '../_pg-tables.js';

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
    body: method === 'GET' || method === 'HEAD' || method === 'DELETE' ? undefined : (payload as any),
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

function blobKey(path: string) {
  return `${DOC_PREFIX}${cleanPath(path)}.json`;
}

async function docInsertIfNew(path: string, data: unknown): Promise<boolean> {
  if (!postgresUrl()) throw new Error('Postgres is not configured');
  return ledgerInsertIfNew(path, data);
}

async function docGet(path: string) {
  if (!postgresUrl()) throw new Error('Postgres is not configured');
  const row = await ledgerGet(path);
  if (row) return row;
  try {
    const blob = await r2GetJson(blobKey(path));
    if (blob) await ledgerSet(path, blob).catch(() => undefined);
    return blob;
  } catch {
    return null;
  }
}

async function docSet(path: string, data: unknown) {
  if (!postgresUrl()) throw new Error('Postgres is not configured');
  await ledgerSet(path, data);
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
  parseSource: 'text' | 'image' | 'mixed' | 'ocr' | 'ai';
  taxAmount?: number;
  currency?: string;
  invoiceNumber?: string;
  paymentMethod?: string;
  notes?: string;
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
  const hay = String(text || '')
    .replace(/[|]/g, ' ')
    .replace(/\b(totai|tota1|tota!)\b/gi, 'total')
    .replace(/\b(arnount|arnout|arnunt)\b/gi, 'amount');
  const labeled = hay.match(/(?:grand\s*total|net\s*(?:payable|amount|total)|amount\s*(?:paid|due)|total\s*amount|total|paid)\s*[:\-–]?\s*(?:₹|rs\.?|inr|usd|eur|gbp|\$)?\s*([0-9]{1,3}(?:[,\s][0-9]{2,3})+(?:\.[0-9]{1,2})?|[0-9]+(?:\.[0-9]{1,2})?)/i);
  if (labeled) {
    const amount = toNumber(labeled[1].replace(/\s/g, ''));
    if (amount) return amount;
  }
  const currency = hay.match(/(?:₹|rs\.?\s*|inr\s*)([0-9]{1,3}(?:[,\s][0-9]{2,3})+(?:\.[0-9]{1,2})?|[0-9]+(?:\.[0-9]{1,2})?)/i)
    || hay.match(/\$\s*([0-9]+(?:,[0-9]{3})*(?:\.[0-9]{1,2})?)/);
  if (currency) {
    const amount = toNumber(currency[1].replace(/\s/g, ''));
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

function mimeForDocument(contentType: string, fileName = '') {
  const type = String(contentType || '').toLowerCase();
  const ext = String(fileName || '').split('.').pop()?.toLowerCase() || '';
  if (type.startsWith('image/')) return type === 'image/jpg' ? 'image/jpeg' : type;
  if (type === 'application/pdf' || ext === 'pdf') return 'application/pdf';
  if (['png', 'jpg', 'jpeg', 'webp'].includes(ext)) return ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
  return '';
}

function withTimeoutMs<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), ms);
    promise.then((value) => {
      clearTimeout(timer);
      resolve(value);
    }).catch(() => {
      clearTimeout(timer);
      resolve(null);
    });
  });
}

function preferParsed(primary: ParsedReceipt, secondary: ParsedReceipt): ParsedReceipt {
  const amount = primary.amount || secondary.amount;
  const merchant = primary.merchant || secondary.merchant;
  const description = primary.description || secondary.description;
  const category = primary.category !== 'Uncategorized' ? primary.category : secondary.category;
  return {
    amount,
    date: primary.date || secondary.date,
    merchant,
    description,
    category,
    entryType: primary.entryType === 'in' || secondary.entryType === 'in' ? 'in' : 'out',
    documentType: primary.documentType !== 'receipt' ? primary.documentType : secondary.documentType,
    parseSource:
      primary.amount && secondary.amount && primary.parseSource !== secondary.parseSource
        ? 'mixed'
        : primary.amount
          ? primary.parseSource
          : secondary.parseSource,
    taxAmount: primary.taxAmount || secondary.taxAmount,
    currency: primary.currency || secondary.currency,
    invoiceNumber: primary.invoiceNumber || secondary.invoiceNumber,
    paymentMethod: primary.paymentMethod || secondary.paymentMethod,
    notes: primary.notes || secondary.notes,
  };
}

async function extractPdfTextFast(bytes: Buffer) {
  const { PDFParse } = await import('pdf-parse');
  const parser = new PDFParse({ data: bytes });
  try {
    const result = await parser.getText({ partial: [1, 2, 3] });
    return String(result?.text || '').replace(/\s+/g, ' ').trim().slice(0, 12000);
  } finally {
    await parser.destroy().catch(() => undefined);
  }
}

async function extractImageText(bytes: Buffer) {
  const { createWorker } = await import('tesseract.js');
  const worker = await createWorker('eng');
  try {
    const result = await worker.recognize(bytes);
    return String(result?.data?.text || '').replace(/\s+/g, ' ').trim().slice(0, 12000);
  } finally {
    await worker.terminate().catch(() => undefined);
  }
}

function geminiKey() {
  return String(process.env.GEMINI_API_KEY || process.env.GOOGLE_GENAI_API_KEY || process.env.GOOGLE_API_KEY || '').trim();
}

function allowSlowOcr() {
  return String(process.env.INBOUND_ALLOW_SLOW_OCR || '').trim() === '1';
}

function asParsed(value: any, fallback: ParsedReceipt): ParsedReceipt {
  if (!value || typeof value !== 'object') return fallback;
  const amount = toNumber(value.amount ?? value.total ?? value.grandTotal);
  const taxAmount = toNumber(value.taxAmount ?? value.tax ?? value.gst ?? value.vat);
  const date = parseIsoDate(String(value.date || value.invoiceDate || value.billDate || '')) || fallback.date;
  const merchant = String(value.merchant || value.vendor || value.seller || fallback.merchant || '').slice(0, 80);
  const description = String(
    value.description ||
    value.summary ||
    (Array.isArray(value.lineItems) ? value.lineItems.slice(0, 3).map((row: any) => row?.name || row?.description).filter(Boolean).join(', ') : '') ||
    merchant ||
    fallback.description,
  ).slice(0, 160);
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
    parseSource: amount ? 'ai' : fallback.parseSource,
    taxAmount: taxAmount || fallback.taxAmount,
    currency: String(value.currency || fallback.currency || '').slice(0, 8) || undefined,
    invoiceNumber: String(value.invoiceNumber || value.billNumber || value.receiptNumber || fallback.invoiceNumber || '').slice(0, 64) || undefined,
    paymentMethod: String(value.paymentMethod || fallback.paymentMethod || '').slice(0, 40) || undefined,
    notes: String(value.notes || fallback.notes || '').slice(0, 240) || undefined,
  };
}

function geminiModels() {
  const preferred = String(process.env.GEMINI_MODEL || '').trim();
  // New Google AI Studio keys require 3.x Flash (2.5 is blocked for new users).
  const defaults = ['gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-flash-latest'];
  return [...new Set([preferred, ...defaults].filter(Boolean))];
}

function extractGeminiText(payload: any) {
  if (!payload) return '';
  if (typeof payload.text === 'string' && payload.text.trim()) return payload.text.trim();
  const parts = payload?.candidates?.[0]?.content?.parts;
  return (Array.isArray(parts) ? parts : [])
    .map((part: any) => String(part?.text || ''))
    .join('\n')
    .trim();
}

async function geminiGenerate(model: string, key: string, body: Record<string, unknown>, timeoutMs = 20_000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify(body),
      },
    );
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false as const, error: String(payload?.error?.message || `http_${res.status}`), payload };
    }
    return { ok: true as const, payload };
  } catch (err: any) {
    return {
      ok: false as const,
      error: err?.name === 'AbortError' ? 'timeout' : String(err?.message || 'request_failed'),
    };
  } finally {
    clearTimeout(timer);
  }
}

async function parseDocumentWithGemini(
  bytes: Buffer,
  contentType: string,
  fileName: string,
  fallback: ParsedReceipt,
  emailContext = '',
): Promise<{ parsed: ParsedReceipt; model?: string; error?: string }> {
  const key = geminiKey();
  const mime = mimeForDocument(contentType, fileName);
  if (!key || !mime || !bytes.length) {
    return { parsed: fallback, error: !key ? 'missing_key' : !mime ? 'unsupported_mime' : 'empty_file' };
  }

  const maxBytes = 3 * 1024 * 1024;
  const payloadBytes = bytes.length > maxBytes ? bytes.subarray(0, maxBytes) : bytes;
  const prompt = `You are a professional accounts-payable document parser for Byjan.
Read this receipt, bill, invoice, tax invoice, UPI screenshot, bank slip, or photo of a document.
Email context (may be empty): ${emailContext.slice(0, 800)}
Return JSON only with keys:
amount (number), taxAmount (number), currency, date (YYYY-MM-DD), merchant, description, category
(Fuel, Groceries, Meals, Travel, Utilities, Health, Shopping, Software Subscriptions, or Uncategorized),
entryType (out|in), documentType (receipt|bill|invoice), invoiceNumber, paymentMethod, notes.
Never invent amounts. Prefer grand total / amount paid / net payable.
If this is not a financial document (selfie, personal photo, meme, blank page, encrypted or password-protected file, or a screenshot with no totals), set amount to 0, leave merchant empty, and set notes to "not_a_receipt".`;

  const requestBody = {
    contents: [{
      parts: [
        { text: prompt },
        { inline_data: { mime_type: mime, data: payloadBytes.toString('base64') } },
      ],
    }],
    generationConfig: {
      temperature: 0,
      responseMimeType: 'application/json',
    },
  };

  const errors: string[] = [];
  for (const model of geminiModels().slice(0, 3)) {
    const result = await geminiGenerate(model, key, requestBody, 22_000);
    if (!result.ok) {
      errors.push(`${model}: ${result.error}`);
      console.error('gemini generate failed', model, result.error);
      continue;
    }
    const raw = extractGeminiText(result.payload).replace(/^```json\s*|\s*```$/g, '').trim();
    if (!raw) {
      const block = result.payload?.candidates?.[0]?.finishReason || result.payload?.promptFeedback?.blockReason || 'empty_response';
      errors.push(`${model}: ${block}`);
      continue;
    }
    const jsonSlice = raw.includes('{') ? raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1) : raw;
    try {
      const parsed = asParsed(JSON.parse(jsonSlice), fallback);
      return { parsed, model };
    } catch (err: any) {
      errors.push(`${model}: bad_json`);
      console.error('gemini json parse failed', model, err?.message || err, raw.slice(0, 220));
    }
  }

  return { parsed: fallback, error: errors.slice(0, 4).join(' | ') || 'all_models_failed' };
}

async function probeGemini() {
  const key = geminiKey();
  if (!key) return { ok: false, error: 'missing_key' };
  const model = geminiModels()[0] || 'gemini-3.6-flash';
  const started = Date.now();
  const result = await geminiGenerate(
    model,
    key,
    {
      contents: [{ parts: [{ text: 'Return JSON only: {"ok":true,"amount":12.5}' }] }],
      generationConfig: { temperature: 0, responseMimeType: 'application/json' },
    },
    15_000,
  );
  if (!result.ok) {
    return { ok: false, model, ms: Date.now() - started, error: result.error };
  }
  return {
    ok: true,
    model,
    ms: Date.now() - started,
    sample: extractGeminiText(result.payload).slice(0, 200),
  };
}

/**
 * Professional + fast document enrichment:
 * 1) Gemini multimodal (complex images/PDFs) when GEMINI_API_KEY is set — typically 2–6s
 * 2) Fast PDF text extract in parallel (embedded text only)
 * 3) Slow Tesseract OCR only if INBOUND_ALLOW_SLOW_OCR=1 and no Gemini key
 */
async function enrichFromDocument(
  bytes: Buffer,
  contentType: string,
  fileName: string,
  body: string,
  subject: string,
  fallback: ParsedReceipt,
) {
  const mime = mimeForDocument(contentType, fileName);
  if (!mime) return { parsed: fallback, preview: '', engine: 'none' };

  const jobs: Array<Promise<{ parsed: ParsedReceipt; preview: string; engine: string } | null>> = [];
  const emailContext = `${subject}\n${body}`.trim();

  if (geminiKey()) {
    jobs.push(
      parseDocumentWithGemini(bytes, contentType, fileName, fallback, emailContext).then((result) => ({
        parsed: result.parsed,
        preview: result.error ? `gemini_error: ${result.error}` : '',
        engine: result.model
          ? `gemini:${result.model}`
          : (result.error ? 'gemini-failed' : 'gemini'),
      })),
    );
  }

  if (mime === 'application/pdf') {
    jobs.push(
      (async () => {
        const text = await withTimeoutMs(extractPdfTextFast(bytes), 8_000);
        if (!text) return null;
        const merged = parseReceiptFields(`${subject}\n${body}\n${text}`, { subject, fileName });
        return {
          parsed: preferParsed(
            {
              ...merged,
              parseSource: merged.amount ? 'ocr' : fallback.parseSource,
            },
            fallback,
          ),
          preview: text.slice(0, 500),
          engine: 'pdf-text',
        };
      })(),
    );
  } else if (mime.startsWith('image/') && !geminiKey() && allowSlowOcr()) {
    jobs.push(
      (async () => {
        const text = await withTimeoutMs(extractImageText(bytes), 12_000);
        if (!text) return null;
        const merged = parseReceiptFields(`${subject}\n${body}\n${text}`, { subject, fileName });
        return {
          parsed: preferParsed(
            {
              ...merged,
              parseSource: merged.amount ? 'ocr' : fallback.parseSource,
            },
            fallback,
          ),
          preview: text.slice(0, 500),
          engine: 'tesseract',
        };
      })(),
    );
  }

  if (!jobs.length) return { parsed: fallback, preview: '', engine: 'none' };

  const settled = await Promise.all(jobs);
  let best = fallback;
  let preview = '';
  let engine = 'none';
  for (const row of settled) {
    if (!row) continue;
    // Prefer AI / higher-confidence amount results.
    if (String(row.engine).startsWith('gemini') && row.engine !== 'gemini-failed' && (row.parsed.amount || row.parsed.merchant)) {
      best = preferParsed(row.parsed, best);
      engine = row.engine;
      if (row.preview) preview = row.preview;
      continue;
    }
    if (row.engine === 'gemini-failed' && !preview) {
      preview = row.preview;
    }
    if (row.parsed.amount && !best.amount) {
      best = preferParsed(row.parsed, best);
      engine = row.engine;
      preview = row.preview || preview;
      continue;
    }
    best = preferParsed(best, row.parsed);
    if (!preview && row.preview) preview = row.preview;
    if (engine === 'none') engine = row.engine;
  }
  return { parsed: best, preview, engine };
}

type RoleRow = { role?: string; email?: string };
type Mailbox = {
  bookId: string;
  name: string;
  currency: string;
  ownerId?: string;
  address?: string;
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
    address: String(data.address || '') || `${inboundMailboxSlug(String(data.name || 'ledger'))}@${INBOUND_DOMAIN}`,
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

function escapeHtml(value: string) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function wrapByjanEmail(opts: {
  kicker: string;
  title: string;
  intro: string;
  rows?: Array<{ label: string; value: string }>;
  note?: string;
  ctaLabel?: string;
  ctaHref?: string;
  ledgerMail?: string;
  extraHtml?: string;
}) {
  const rows = (opts.rows || [])
    .filter((row) => String(row.value || '').trim())
    .map((row) => `
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid #edf0f2;width:34%;font-size:12px;letter-spacing:0.04em;text-transform:uppercase;color:#64748b;font-family:Georgia,'Times New Roman',serif">${escapeHtml(row.label)}</td>
        <td style="padding:10px 0;border-bottom:1px solid #edf0f2;font-size:14px;color:#0f172a;font-family:Arial,Helvetica,sans-serif">${escapeHtml(row.value)}</td>
      </tr>`).join('');
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#f4f1ea;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f1ea;padding:32px 12px">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border:1px solid #e6e1d6">
        <tr>
          <td style="padding:28px 32px 20px;border-bottom:3px solid #0B1F3A">
            <p style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:22px;color:#0B1F3A;letter-spacing:0.08em">BYJAN</p>
            <p style="margin:6px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:#8a8070">${escapeHtml(opts.kicker)}</p>
          </td>
        </tr>
        <tr>
          <td style="padding:28px 32px 8px">
            <h1 style="margin:0 0 12px;font-family:Georgia,'Times New Roman',serif;font-size:22px;line-height:1.3;color:#0B1F3A;font-weight:normal">${escapeHtml(opts.title)}</h1>
            <p style="margin:0 0 20px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#334155">${escapeHtml(opts.intro)}</p>
            ${rows ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>` : ''}
            ${opts.note ? `<p style="margin:20px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.55;color:#64748b">${escapeHtml(opts.note)}</p>` : ''}
            ${opts.extraHtml || ''}
          </td>
        </tr>
        ${opts.ctaLabel && opts.ctaHref ? `<tr>
          <td style="padding:24px 32px 32px">
            <a href="${escapeHtml(opts.ctaHref)}" style="display:inline-block;background:#0B1F3A;color:#ffffff;text-decoration:none;padding:12px 22px;font-family:Arial,Helvetica,sans-serif;font-size:13px;letter-spacing:0.04em">${escapeHtml(opts.ctaLabel)}</a>
          </td>
        </tr>` : ''}
        <tr>
          <td style="padding:16px 32px 24px;border-top:1px solid #edf0f2;font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:1.6;color:#94a3b8">
            You received this because you are a member of this ledger on Byjan.<br/>
            ${opts.ledgerMail ? `Send receipts to ${escapeHtml(opts.ledgerMail)} and Byjan will record them for the team.<br/>` : ''}
            Byjan · easypado.com · This is a service notice, not a marketing message.
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function looksLikeFilename(value: string) {
  const text = String(value || '').trim();
  return !text || /\.(jpe?g|png|webp|gif|heic|pdf)$/i.test(text) || /^img[-_\s.]?\d+/i.test(text);
}

function isUnusableDocument(parsed: ParsedReceipt, body: string, ocrPreview: string, parseEngine: string, hasFile: boolean) {
  const hay = `${parsed.notes || ''} ${parsed.description || ''} ${ocrPreview || ''}`.toLowerCase();
  if (/\bnot_a_receipt\b|not a receipt|not an invoice|not a bill|selfie|personal photo|encrypted|password-protected|password protected|unreadable document/.test(hay)) {
    return true;
  }
  const noAmount = !parsed.amount;
  const noMerchant = looksLikeFilename(parsed.merchant || '');
  const thinBody = clipQuoted(body).length < 24;
  const failedParse = parseEngine === 'gemini-failed' || parseEngine === 'none' || ocrPreview.startsWith('gemini_error:');
  if (noAmount && noMerchant && parsed.category === 'Uncategorized' && (thinBody || failedParse || !hasFile)) {
    return true;
  }
  return false;
}

async function sendMail(
  to: string,
  subject: string,
  html: string,
  attachments?: Array<{ filename: string; content: Buffer; contentType?: string }>,
) {
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
    from: `"Byjan" <${from}>`,
    replyTo: from,
    envelope: { from, to },
    to,
    subject,
    text: html.replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]*>?/gm, ' ').replace(/\s+/g, ' ').trim(),
    html,
    ...(attachments?.length
      ? {
          attachments: attachments.map((row) => ({
            filename: row.filename,
            content: row.content,
            contentType: row.contentType,
          })),
        }
      : {}),
    headers: {
      'List-Unsubscribe': `<mailto:noreply@${INBOUND_DOMAIN}?subject=unsubscribe>`,
      'X-Auto-Response-Suppress': 'All',
    },
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

const inboundLive = new Map<string, Record<string, unknown>>();

async function logInboundEvent(bookId: string, event: Record<string, unknown>) {
  const id = newId();
  const createdAt = new Date().toISOString();
  const { flow: incomingFlow, ...rest } = event;
  const step = String(rest.currentStep || 'received');
  const flow = Array.isArray(incomingFlow)
    ? asFlowRows(incomingFlow)
    : [{ step: 'received', at: createdAt, label: FLOW_LABELS.received }, ...(step === 'received' ? [] : [{ step, at: createdAt, label: FLOW_LABELS[step] || step }])];
  const doc = {
    id,
    bookId,
    createdAt,
    currentStep: step,
    flow,
    ...rest,
  };
  inboundLive.set(id, doc);
  await docSet(`books/${bookId}/inbound_events/${id}`, doc);
  return id;
}

const FLOW_LABELS: Record<string, string> = {
  received: 'Mail received',
  member_ok: 'Sender checked',
  reading: 'Reading the file',
  parsed: 'Details read',
  amount_found: 'Amount found',
  amount_missing: 'Amount missing',
  duplicate_detected: 'Already on the ledger',
  awaiting_sender_confirm: 'Waiting for sender',
  recorded: 'Saved to ledger',
  draft: 'Saved for review',
  not_posted: 'Not added',
  sender_notified: 'Sender emailed',
  team_notified: 'Team notified',
};

function asFlowRows(value: unknown): Array<{ step: string; at: string; label: string }> {
  if (!Array.isArray(value)) return [];
  return value.map((row) => {
    if (typeof row === 'string') {
      return { step: row, at: '', label: FLOW_LABELS[row] || row };
    }
    const rec = row && typeof row === 'object' ? row as Record<string, unknown> : {};
    const step = String(rec.step || '');
    return { step, at: String(rec.at || ''), label: String(rec.label || FLOW_LABELS[step] || step) };
  });
}

async function markFlow(bookId: string, eventId: string, step: string, extra: Record<string, unknown> = {}) {
  if (!eventId) return;
  const current = inboundLive.get(eventId) || await docGet(`books/${bookId}/inbound_events/${eventId}`);
  if (!current) return;
  const flow = asFlowRows(current.flow);
  if (!flow.some((row) => row.step === step)) {
    flow.push({ step, at: new Date().toISOString(), label: FLOW_LABELS[step] || step });
  }
  const next = {
    ...current,
    ...extra,
    currentStep: step,
    flow,
  };
  inboundLive.set(eventId, next);
  await docSet(`books/${bookId}/inbound_events/${eventId}`, next).catch(() => undefined);
}

async function notifyMembers(
  mailbox: Mailbox,
  bookId: string,
  opts: {
    kind: 'added' | 'rejected' | 'unreadable' | 'duplicate_pending' | 'duplicate_kept' | 'duplicate_added';
    sender: string;
    subjectLine?: string;
    amount?: string;
    category?: string;
    description?: string;
    fileName?: string;
    paidBy?: string;
    reason?: string;
    inboundEventId?: string;
  },
) {
  const emails = Object.values(mailbox.roles).map((row) => String(row?.email || '').toLowerCase()).filter(Boolean);
  const unique = [...new Set(emails)];
  const link = `${APP_ORIGIN}/#/book/${bookId}`;
  const copy = {
    added: {
      subject: `Ledger update · ${mailbox.name}`,
      kicker: 'Ledger notice',
      title: `An entry was added to ${mailbox.name}`,
      intro: `${opts.sender} sent a document to this ledger. Byjan recorded the details below.`,
      cta: 'View ledger',
      action: 'Entry added from inbound mail',
    },
    rejected: {
      subject: `Mail not added · ${mailbox.name}`,
      kicker: 'Access notice',
      title: `Mail was not added to ${mailbox.name}`,
      intro: 'A message reached this ledger address, but no entry was created.',
      cta: 'Review team',
      action: 'Inbound mail was not added',
    },
    unreadable: {
      subject: `Document not recorded · ${mailbox.name}`,
      kicker: 'Document notice',
      title: `No entry was created in ${mailbox.name}`,
      intro: `${opts.sender} sent a file that could not be read as a receipt, bill, or invoice. Nothing was posted to the ledger.`,
      cta: 'Open ledger',
      action: 'Unreadable document was not recorded',
    },
    duplicate_pending: {
      subject: `Possible duplicate awaiting confirmation · ${mailbox.name}`,
      kicker: 'Duplicate check',
      title: `A matching receipt is waiting for confirmation`,
      intro: `${opts.sender} sent a file that matches an existing ledger entry. Byjan has asked them to confirm whether it is the same receipt or a different one.`,
      cta: 'Open ledger',
      action: 'Duplicate receipt awaiting sender confirmation',
    },
    duplicate_kept: {
      subject: `Duplicate not posted · ${mailbox.name}`,
      kicker: 'Duplicate check',
      title: `The extra copy was not added`,
      intro: `${opts.sender} confirmed the latest file is the same as an existing entry. Nothing extra was posted.`,
      cta: 'Open ledger',
      action: 'Duplicate receipt declined',
    },
    duplicate_added: {
      subject: `Confirmed as a new entry · ${mailbox.name}`,
      kicker: 'Ledger notice',
      title: `A matching file was posted as a new entry`,
      intro: `${opts.sender} confirmed the latest file is different from the earlier receipt. Byjan recorded a new line.`,
      cta: 'View ledger',
      action: 'Duplicate confirmed as a new entry',
    },
  }[opts.kind];
  const html = wrapByjanEmail({
    kicker: copy.kicker,
    title: copy.title,
    intro: copy.intro,
    rows: [
      { label: 'Ledger', value: mailbox.name },
      { label: 'Ledger mail', value: mailbox.address || '' },
      { label: 'From', value: opts.sender },
      { label: 'Subject', value: opts.subjectLine || '' },
      { label: 'Amount', value: opts.amount || '' },
      { label: 'Category', value: opts.category || '' },
      { label: 'Paid by', value: opts.paidBy || '' },
      { label: 'Description', value: opts.description || '' },
      { label: 'File', value: opts.fileName || '' },
      { label: 'Reason', value: opts.reason || '' },
    ],
    note: opts.kind === 'unreadable'
      ? 'Photos of people, blank images, encrypted files, and other non-financial documents are ignored on purpose.'
      : `Send receipts to ${mailbox.address || `this ledger@${INBOUND_DOMAIN}`} and Byjan will record them for the team.`,
    ctaLabel: copy.cta,
    ctaHref: link,
    ledgerMail: mailbox.address,
  });
  const detail = opts.reason || opts.description || copy.intro;
  let sent = 0;
  let failed = 0;
  const mailResults = await Promise.allSettled(
    unique.map(async (email) => {
      await sendMail(email, copy.subject, html);
      await docSet(`books/${bookId}/email_events/${newId()}`, {
        direction: 'outbound',
        status: 'sent',
        toEmail: email,
        subject: copy.subject,
        action: copy.action,
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
      subject: copy.subject,
      action: copy.action,
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
      action: copy.action,
      detail,
      senderName: opts.sender,
      ledgerMail: mailbox.address || '',
      link,
      createdAt: new Date().toISOString(),
      read: false,
    }).catch(() => undefined);
  }
  if (opts.inboundEventId) {
    const current = await docGet(`books/${bookId}/inbound_events/${opts.inboundEventId}`);
    if (current) {
      await docSet(`books/${bookId}/inbound_events/${opts.inboundEventId}`, {
        ...current,
        teamNotified: sent > 0,
        notifySent: sent,
        notifyFailed: failed,
      }).catch(() => undefined);
    }
  }
}

function fileHash(bytes: Buffer) {
  return createHash('sha256').update(bytes).digest('hex');
}

function confirmSig(id: string) {
  return createHmac('sha256', inboundSecret() || 'inbound').update(`confirm:${id}`).digest('hex').slice(0, 40);
}

function confirmHref(id: string, decision: 'same' | 'new') {
  const url = new URL(`${APP_ORIGIN}/api/email/inbound`);
  url.searchParams.set('confirm', id);
  url.searchParams.set('sig', confirmSig(id));
  url.searchParams.set('decision', decision);
  return url.toString();
}

function moneyLabel(currency: string, amount: unknown) {
  const n = Number(amount || 0);
  if (!Number.isFinite(n) || n <= 0) return 'Not found';
  return `${currency} ${n.toFixed(2)}`;
}

function whoAdded(existing: Record<string, unknown>, senderEmail: string) {
  const email = String(existing.enteredByEmail || existing.enteredBy || existing.paidByName || '').toLowerCase();
  const label = String(existing.enteredBy || existing.paidByName || existing.enteredByEmail || 'a teammate');
  if (email && email === senderEmail.toLowerCase()) return 'you';
  return label;
}

async function storeFileHash(bookId: string, hash: string, expense: Record<string, unknown>) {
  await docSet(`inbound_hashes/${bookId}/${hash}`, {
    bookId,
    hash,
    reserved: false,
    expenseId: expense.id,
    amount: expense.amount || 0,
    category: expense.category || '',
    paidByName: expense.paidByName || '',
    enteredBy: expense.enteredBy || '',
    enteredByEmail: expense.enteredByEmail || '',
    description: expense.description || '',
    date: expense.date || '',
    createdAt: expense.createdAt || new Date().toISOString(),
  });
}

function normText(value: unknown) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

async function listLedgerExpenses(bookId: string): Promise<Array<Record<string, unknown>>> {
  const rows = postgresUrl() ? await ledgerList(`books/${bookId}/expenses`) : [];
  return rows
    .map((row) => ({ id: row.id, ...row.data } as Record<string, unknown>))
    .filter((row) => row.id && row.deleted !== true && row.status !== 'deleted' && !row.deletedAt);
}

async function findMatchingReceipt(
  bookId: string,
  hash: string,
  parsed?: { amount?: number; merchant?: string; date?: string; description?: string; invoiceNumber?: string },
  senderEmail?: string,
) {
  if (hash) {
    const row = await docGet(`inbound_hashes/${bookId}/${hash}`);
    const expenseId = String(row?.expenseId || '').trim();
    if (expenseId) {
      const expense = await docGet(`books/${bookId}/expenses/${expenseId}`);
      if (expense && expense.deleted !== true && expense.status !== 'deleted' && !expense.deletedAt) {
        return { hash, expenseId, expense: { id: expenseId, ...expense }, reason: 'same_file' as const };
      }
    }
    if (row?.reserved) {
      return { hash, expenseId: expenseId || String(row.expenseId || ''), expense: row, reason: 'same_file' as const };
    }
  }
  if (!parsed) return null;
  const expenses = await listLedgerExpenses(bookId);
  if (hash) {
    const byHash = expenses.find((row) => String(row.receiptHash || '') === hash);
    if (byHash) return { hash, expenseId: String(byHash.id), expense: byHash, reason: 'same_file' as const };
  }
  const amount = Number(parsed?.amount || 0);
  const merchant = normText(parsed?.merchant);
  const description = normText(parsed?.description);
  const inv = normText(parsed?.invoiceNumber);
  const sender = String(senderEmail || '').toLowerCase();
  if (amount > 0) {
    const byBill = expenses.find((row) => {
      if (Number(row.amount || 0) !== amount) return false;
      const otherInv = normText(row.invoiceNumber);
      if (inv && otherInv && inv === otherInv) return true;
      const otherMerchant = normText(row.merchant);
      if (merchant && otherMerchant && (merchant === otherMerchant || merchant.includes(otherMerchant) || otherMerchant.includes(merchant))) {
        if (!parsed?.date || !row.date || String(row.date) === parsed.date) return true;
      }
      if (parsed?.date && String(row.date || '') === parsed.date) {
        const otherDesc = normText(row.description);
        if (description && otherDesc && (description === otherDesc || description.includes(otherDesc) || otherDesc.includes(description))) return true;
        const rowSender = String(row.enteredByEmail || row.enteredBy || '').toLowerCase();
        if (sender && rowSender === sender) return true;
      }
      return false;
    });
    if (byBill) return { hash, expenseId: String(byBill.id), expense: byBill, reason: 'same_bill' as const };
  }
  return null;
}

function billFingerprint(
  parsed: { amount?: number; merchant?: string; date?: string; description?: string; invoiceNumber?: string },
  senderEmail: string,
) {
  const amount = Number(parsed?.amount || 0);
  if (!(amount > 0)) return '';
  const inv = normText(parsed?.invoiceNumber);
  const merchant = normText(parsed?.merchant);
  const desc = normText(parsed?.description);
  const date = String(parsed?.date || '');
  const who = String(senderEmail || '').toLowerCase();
  const parts = inv
    ? [amount.toFixed(2), inv]
    : [amount.toFixed(2), date, merchant || desc, who];
  if (!inv && (!date || !(merchant || desc || who))) return '';
  return createHash('sha256').update(parts.join('|')).digest('hex').slice(0, 40);
}

async function reserveReceiptHash(bookId: string, hash: string, meta: Record<string, unknown>) {
  if (!hash) return true;
  return docInsertIfNew(`inbound_hashes/${bookId}/${hash}`, {
    bookId,
    hash,
    reserved: true,
    at: new Date().toISOString(),
    ...meta,
  });
}

async function mergeCategory(bookId: string, category: string) {
  if (!category || category === 'Uncategorized') return;
  try {
    const bookDoc = await docGet(`books/${bookId}`);
    if (!bookDoc) return;
    const existing = Array.isArray(bookDoc.categories) ? bookDoc.categories.map(String) : [];
    if (existing.some((c) => c.toLowerCase() === category.toLowerCase())) return;
    await docSet(`books/${bookId}`, { ...bookDoc, categories: [...existing, category] });
  } catch {
    // category merge is best-effort
  }
}

async function saveExpenseRecord(bookId: string, expense: Record<string, unknown>): Promise<Record<string, unknown>> {
  const id = String(expense.id || newId());
  const row: Record<string, unknown> = { ...expense, id };
  await docSet(`books/${bookId}/expenses/${id}`, row);
  await mergeCategory(bookId, String(row.category || ''));
  return row;
}

async function rollbackExpense(bookId: string, expenseId: string, actor: string) {
  const current = await docGet(`books/${bookId}/expenses/${expenseId}`);
  if (!current || current.deleted === true || current.status === 'deleted') return false;
  await docSet(`books/${bookId}/expenses/${expenseId}`, {
    ...current,
    deleted: true,
    deletedAt: new Date().toISOString(),
    deletedBy: actor,
    status: 'deleted',
    rollbackReason: 'Sender confirmed this was the same receipt as an existing entry',
  });
  return true;
}

function decisionPage(title: string, intro: string, rows: Array<{ label: string; value: string }>, ok: boolean) {
  const details = rows
    .filter((row) => String(row.value || '').trim())
    .map((row) => `<tr><td style="padding:8px 0;color:#64748b;width:34%">${escapeHtml(row.label)}</td><td style="padding:8px 0;color:#0f172a">${escapeHtml(row.value)}</td></tr>`)
    .join('');
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>${escapeHtml(title)} · Byjan</title>
</head>
<body style="margin:0;background:#f4f1ea;font-family:Arial,Helvetica,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:48px 16px">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#fff;border:1px solid #e6e1d6">
        <tr><td style="padding:28px 32px 18px;border-bottom:3px solid #0B1F3A">
          <p style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:22px;color:#0B1F3A;letter-spacing:0.08em">BYJAN</p>
          <p style="margin:6px 0 0;font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:#8a8070">${ok ? 'Confirmation complete' : 'Action needed'}</p>
        </td></tr>
        <tr><td style="padding:28px 32px">
          <h1 style="margin:0 0 12px;font-family:Georgia,'Times New Roman',serif;font-size:22px;font-weight:normal;color:#0B1F3A">${escapeHtml(title)}</h1>
          <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#334155">${escapeHtml(intro)}</p>
          ${details ? `<table role="presentation" width="100%">${details}</table>` : ''}
          <p style="margin:24px 0 0"><a href="${APP_ORIGIN}" style="display:inline-block;background:#0B1F3A;color:#fff;text-decoration:none;padding:12px 22px;font-size:13px">Open Byjan</a></p>
        </td></tr>
        <tr><td style="padding:16px 32px 24px;border-top:1px solid #edf0f2;font-size:11px;color:#94a3b8">You can close this tab. No further action is required.</td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function htmlRes(res: VercelResponse, status: number, html: string) {
  res.statusCode = status;
  res.setHeader('content-type', 'text/html; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.end(html);
}

async function notifySender(
  mailbox: Mailbox,
  bookId: string,
  opts: {
    to: string;
    subject: string;
    kicker: string;
    title: string;
    intro: string;
    rows?: Array<{ label: string; value: string }>;
    note?: string;
    extraHtml?: string;
    ctaLabel?: string;
    ctaHref?: string;
    attachments?: Array<{ filename: string; content: Buffer; contentType?: string }>;
    action: string;
    inboundEventId?: string;
    throwOnFail?: boolean;
  },
) {
  const html = wrapByjanEmail({
    kicker: opts.kicker,
    title: opts.title,
    intro: opts.intro,
    rows: opts.rows,
    note: opts.note,
    extraHtml: opts.extraHtml,
    ctaLabel: opts.ctaLabel,
    ctaHref: opts.ctaHref || `${APP_ORIGIN}/#/book/${bookId}`,
    ledgerMail: mailbox.address,
  });
  try {
    await sendMail(opts.to, opts.subject, html, opts.attachments);
    await docSet(`books/${bookId}/email_events/${newId()}`, {
      direction: 'outbound',
      status: 'sent',
      toEmail: opts.to,
      subject: opts.subject,
      action: opts.action,
      detail: opts.intro,
      createdAt: new Date().toISOString(),
    }).catch(() => undefined);
    if (opts.inboundEventId) {
      const current = await docGet(`books/${bookId}/inbound_events/${opts.inboundEventId}`);
      if (current) {
        await docSet(`books/${bookId}/inbound_events/${opts.inboundEventId}`, {
          ...current,
          senderNotified: true,
        }).catch(() => undefined);
      }
    }
  } catch (err: any) {
    await docSet(`books/${bookId}/email_events/${newId()}`, {
      direction: 'outbound',
      status: 'failed',
      toEmail: opts.to,
      subject: opts.subject,
      action: opts.action,
      detail: String(err?.message || err || 'Send failed'),
      createdAt: new Date().toISOString(),
    }).catch(() => undefined);
    if (opts.throwOnFail) throw err;
  }
}

async function sendAmountMissingToSender(
  mailbox: Mailbox,
  bookId: string,
  opts: {
    sender: string;
    subjectLine: string;
    fileName?: string;
    receipt?: { name: string; contentType: string; bytes: Buffer } | null;
    inboundEventId?: string;
    savedAsDraft: boolean;
  },
) {
  await notifySender(mailbox, bookId, {
    to: opts.sender,
    subject: `Amount not found · ${mailbox.name}`,
    kicker: 'Needs a clearer document',
    title: 'Byjan could not read an amount on your attachment',
    intro: opts.savedAsDraft
      ? 'We saved a draft on the ledger for your team to review, but the amount field is empty. Please send the same receipt again with a clearer photo or PDF so Byjan can complete the entry.'
      : 'No ledger entry was created because the attached file had no readable amount, merchant, or invoice data. Please send a clearer receipt, bill, or invoice.',
    rows: [
      { label: 'Ledger', value: mailbox.name },
      { label: 'Send receipts to', value: mailbox.address || '' },
      { label: 'Your file', value: opts.fileName || opts.receipt?.name || 'Attachment' },
      { label: 'Error', value: 'Amount not found on the attached document' },
    ],
    note: 'Your original attachment is included on this email so you can see exactly what Byjan received.',
    ctaLabel: 'Open ledger',
    ctaHref: `${APP_ORIGIN}/#/book/${bookId}`,
    attachments: opts.receipt?.bytes
      ? [{ filename: opts.receipt.name || 'attachment', content: opts.receipt.bytes, contentType: opts.receipt.contentType }]
      : undefined,
    action: 'Sender notified: amount not found',
    inboundEventId: opts.inboundEventId,
  });
}

async function sendDuplicateConfirmToSender(
  mailbox: Mailbox,
  bookId: string,
  pendingId: string,
  opts: {
    sender: string;
    subjectLine: string;
    existing: Record<string, unknown>;
    parsedAmount: number;
    parsedCategory: string;
    fileName?: string;
    inboundEventId?: string;
  },
) {
  const addedBy = whoAdded(opts.existing, opts.sender);
  const sameAmount = Number(opts.existing.amount || 0) > 0 && Number(opts.existing.amount) === Number(opts.parsedAmount || 0);
  await notifySender(mailbox, bookId, {
    to: opts.sender,
    subject: `Please confirm this receipt · ${mailbox.name}`,
    kicker: 'Possible duplicate',
    title: 'This file looks like an entry already on the ledger',
    intro: addedBy === 'you'
      ? 'This attachment matches a receipt you already added. Confirm whether it is the same entry or a different one. Opening a button below records your choice immediately — Byjan will not ask again.'
      : `This attachment matches a receipt already added by ${addedBy}. Confirm whether it is the same entry or a different one. Opening a button below records your choice immediately — Byjan will not ask again.`,
    rows: [
      { label: 'Ledger', value: mailbox.name },
      { label: 'Already added by', value: addedBy === 'you' ? 'You' : addedBy },
      { label: 'Existing entry', value: String(opts.existing.description || '') },
      { label: 'Existing date', value: String(opts.existing.date || '') },
      { label: 'Existing category', value: String(opts.existing.category || 'Uncategorized') },
      { label: 'Paid by', value: String(opts.existing.paidByName || opts.existing.enteredBy || '—') },
      { label: 'Existing amount', value: moneyLabel(mailbox.currency, opts.existing.amount) },
      ...(Number(opts.parsedAmount || 0) > 0 ? [
        { label: 'This file amount', value: moneyLabel(mailbox.currency, opts.parsedAmount) },
        { label: 'This file category', value: opts.parsedCategory || '' },
      ] : []),
    ].filter((row) => String(row.value || '').trim()),
    note: sameAmount
      ? 'The amounts match. If this is the same receipt, choose Same receipt — nothing extra will be posted, and any extra line will be rolled back.'
      : 'If you consider this a different purchase or invoice, choose Different entry and Byjan will save it without asking again.',
    extraHtml: `
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:24px">
        <tr>
          <td style="padding-right:10px">
            <a href="${escapeHtml(confirmHref(pendingId, 'new'))}" style="display:inline-block;background:#0B1F3A;color:#ffffff;text-decoration:none;padding:12px 18px;font-family:Arial,Helvetica,sans-serif;font-size:13px">Different entry</a>
          </td>
          <td>
            <a href="${escapeHtml(confirmHref(pendingId, 'same'))}" style="display:inline-block;background:#ffffff;color:#0B1F3A;text-decoration:none;padding:11px 18px;font-family:Arial,Helvetica,sans-serif;font-size:13px;border:1px solid #0B1F3A">Same receipt</a>
          </td>
        </tr>
      </table>
      <p style="margin:14px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.55;color:#64748b">Clicking a button opens your browser and completes the action automatically.</p>
    `,
    action: 'Sender asked to confirm possible duplicate',
    inboundEventId: opts.inboundEventId,
    throwOnFail: true,
  });
}

async function handleConfirmDecision(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'HEAD') {
    res.statusCode = 200;
    res.end();
    return;
  }
  const url = new URL(req.url || '/', APP_ORIGIN);
  const pendingId = String(url.searchParams.get('confirm') || '').trim();
  const sig = String(url.searchParams.get('sig') || '').trim();
  const decision = String(url.searchParams.get('decision') || '').trim().toLowerCase();
  if (!pendingId || !secretsMatch(sig, confirmSig(pendingId))) {
    htmlRes(res, 400, decisionPage('This confirmation link is not valid', 'The link is missing or has been altered. Open the original email from Byjan and use one of the buttons there.', [], false));
    return;
  }
  if (decision !== 'same' && decision !== 'new') {
    htmlRes(res, 400, decisionPage('Choose Same or Different', 'Use one of the two buttons in the Byjan email.', [], false));
    return;
  }
  const pending = await docGet(`inbound_pending/${pendingId}`);
  if (!pending) {
    htmlRes(res, 404, decisionPage('This request is no longer available', 'The confirmation record could not be found. It may have expired.', [], false));
    return;
  }
  const bookId = String(pending.bookId || '');
  const mailbox = await loadMailbox(bookId);
  const existing = (pending.existing && typeof pending.existing === 'object') ? pending.existing as Record<string, unknown> : {};
  const expense = (pending.expense && typeof pending.expense === 'object') ? pending.expense as Record<string, unknown> : {};
  const sender = String(pending.fromEmail || '');
  if (String(pending.status || '') !== 'pending') {
    htmlRes(res, 200, decisionPage(
      'This choice was already recorded',
      `Byjan already processed this confirmation as “${String(pending.status)}”. No further change was made.`,
      [
        { label: 'Ledger', value: mailbox?.name || '' },
        { label: 'Decision', value: String(pending.status) },
      ],
      true,
    ));
    return;
  }

  await docSet(`inbound_pending/${pendingId}`, { ...pending, status: decision, decidedAt: new Date().toISOString() });
  const eventId = String(pending.inboundEventId || '');

  if (decision === 'same') {
    let rolledBack = false;
    const extraId = String(pending.expenseId || '');
    const existingAmount = Number(existing.amount || 0);
    const newAmount = Number(expense.amount || 0);
    if (extraId && extraId !== String(existing.id || pending.existingExpenseId || '')) {
      if (!existingAmount || existingAmount === newAmount) {
        rolledBack = await rollbackExpense(bookId, extraId, sender || 'email-confirm');
      }
    }
    if (eventId) {
      const current = await docGet(`books/${bookId}/inbound_events/${eventId}`);
      if (current) {
        await docSet(`books/${bookId}/inbound_events/${eventId}`, {
          ...current,
          status: 'duplicate_same',
          decided: 'same',
          rolledBack,
          flow: [...(Array.isArray(current.flow) ? current.flow : []), 'sender_confirmed_same', rolledBack ? 'extra_entry_rolled_back' : 'nothing_posted'],
        }).catch(() => undefined);
      }
    }
    if (mailbox) {
      await notifyMembers(mailbox, bookId, {
        kind: 'duplicate_kept',
        sender: sender || 'Sender',
        subjectLine: String(pending.subject || ''),
        amount: moneyLabel(mailbox.currency, existing.amount),
        category: String(existing.category || ''),
        paidBy: String(existing.paidByName || ''),
        description: 'Sender confirmed the file is the same as an existing entry.',
        inboundEventId: eventId || undefined,
      }).catch(() => undefined);
    }
    htmlRes(res, 200, decisionPage(
      'Same receipt — nothing extra was added',
      rolledBack
        ? 'You confirmed this is the same receipt. The extra ledger line has been rolled back.'
        : 'You confirmed this is the same receipt. Byjan did not add another entry.',
      [
        { label: 'Ledger', value: mailbox?.name || '' },
        { label: 'Existing category', value: String(existing.category || '') },
        { label: 'Paid by', value: String(existing.paidByName || '') },
        { label: 'Amount', value: mailbox ? moneyLabel(mailbox.currency, existing.amount) : '' },
      ],
      true,
    ));
    return;
  }

  const saved = await saveExpenseRecord(bookId, {
    ...expense,
    id: String(expense.id || newId()),
    status: Number(expense.amount || 0) > 0 ? 'recorded' : 'draft',
    duplicateOf: String(pending.existingExpenseId || existing.id || ''),
    duplicateConfirmedDifferent: true,
  });
  const hash = String(pending.hash || '');
  if (hash) await storeFileHash(bookId, hash, saved).catch(() => undefined);
  await docSet(`inbound_pending/${pendingId}`, {
    ...pending,
    status: 'new',
    decidedAt: new Date().toISOString(),
    expenseId: saved.id,
  });
  if (eventId) {
    const current = await docGet(`books/${bookId}/inbound_events/${eventId}`);
    if (current) {
      await docSet(`books/${bookId}/inbound_events/${eventId}`, {
        ...current,
        status: 'duplicate_new',
        decided: 'new',
        expenseId: saved.id,
        flow: [...(Array.isArray(current.flow) ? current.flow : []), 'sender_confirmed_different', 'entry_saved'],
      }).catch(() => undefined);
    }
  }
  if (mailbox) {
    await notifyMembers(mailbox, bookId, {
      kind: 'duplicate_added',
      sender: sender || 'Sender',
      subjectLine: String(pending.subject || ''),
      amount: moneyLabel(mailbox.currency, saved['amount']),
      category: String(saved['category'] || ''),
      paidBy: String(saved['paidByName'] || ''),
      description: String(saved['description'] || ''),
      inboundEventId: eventId || undefined,
    }).catch(() => undefined);
  }
  htmlRes(res, 200, decisionPage(
    'Different entry — saved to the ledger',
    Number(saved['amount'] || 0) > 0
      ? 'You confirmed this is a different entry. Byjan has recorded it. Your ledger team has been notified.'
      : 'You confirmed this is a different entry. It was saved as a draft because no amount was found — the Needs review badge will clear after someone edits in the amount.',
    [
      { label: 'Ledger', value: mailbox?.name || '' },
      { label: 'Category', value: String(saved['category'] || '') },
      { label: 'Paid by', value: String(saved['paidByName'] || '') },
      { label: 'Amount', value: mailbox ? moneyLabel(mailbox.currency, saved['amount']) : '' },
    ],
    true,
  ));
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

async function holdAsDuplicate(opts: {
  mailbox: Mailbox;
  bookId: string;
  seenKey: string;
  eventId: string;
  hash: string;
  member: { uid: string; email: string };
  subject: string;
  match: { expenseId: string; expense: Record<string, unknown> };
  parsed: { amount?: number; category?: string; description?: string; entryType?: string; date?: string };
  receipt: { path: string; name: string; contentType: string; bytes: Buffer } | null;
  messageId: string;
}) {
  let existingExpense = opts.match.expense || {};
  if (opts.match.expenseId) {
    const full = await docGet(`books/${opts.bookId}/expenses/${opts.match.expenseId}`);
    if (full && full.deleted !== true && !full.deletedAt) {
      existingExpense = { id: opts.match.expenseId, ...full };
    }
  }
  const pendingId = newId();
  const expense = {
    id: newId(),
    amount: opts.parsed.amount || existingExpense.amount || 0,
    description: opts.parsed.description || existingExpense.description || 'Receipt',
    category: opts.parsed.category || existingExpense.category || 'Uncategorized',
    entryType: opts.parsed.entryType || 'out',
    date: opts.parsed.date || existingExpense.date || new Date().toISOString().slice(0, 10),
    paidByName: opts.member.email,
    enteredBy: opts.member.email,
    enteredByUid: opts.member.uid,
    enteredByEmail: opts.member.email,
    createdAt: new Date().toISOString(),
    status: Number(opts.parsed.amount || 0) > 0 ? 'recorded' : 'draft',
    source: 'email',
    emailMessageId: opts.messageId,
    receiptPath: opts.receipt?.path || null,
    receiptName: opts.receipt?.name || null,
    receiptHash: opts.hash || null,
  };
  await docSet(`inbound_pending/${pendingId}`, {
    id: pendingId,
    status: 'pending',
    bookId: opts.bookId,
    hash: opts.hash,
    fromEmail: opts.member.email,
    subject: opts.subject || '(no subject)',
    existingExpenseId: opts.match.expenseId,
    existing: {
      id: opts.match.expenseId,
      amount: existingExpense.amount,
      category: existingExpense.category,
      paidByName: existingExpense.paidByName,
      enteredBy: existingExpense.enteredBy,
      enteredByEmail: existingExpense.enteredByEmail,
      description: existingExpense.description,
      date: existingExpense.date,
    },
    expense,
    inboundEventId: opts.eventId,
    createdAt: new Date().toISOString(),
  });
  await docSet(opts.seenKey, { bookId: opts.bookId, at: new Date().toISOString(), status: 'duplicate_pending', pendingId });
  await markFlow(opts.bookId, opts.eventId, 'duplicate_detected', {
    status: 'duplicate_pending',
    pendingId,
    existingExpenseId: opts.match.expenseId,
  });
  const payload = {
    sender: opts.member.email,
    subjectLine: opts.subject,
    existing: { id: opts.match.expenseId, ...existingExpense },
    parsedAmount: Number(opts.parsed.amount || 0),
    parsedCategory: String(opts.parsed.category || existingExpense.category || ''),
    fileName: opts.receipt?.name,
    inboundEventId: opts.eventId,
  };
  try {
    await sendDuplicateConfirmToSender(opts.mailbox, opts.bookId, pendingId, payload);
  } catch {
    await sendDuplicateConfirmToSender(opts.mailbox, opts.bookId, pendingId, payload).catch(() => undefined);
  }
  await markFlow(opts.bookId, opts.eventId, 'awaiting_sender_confirm', { senderNotified: true });
  return { pending: true, bookId: opts.bookId, pendingId, existingExpenseId: opts.match.expenseId };
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
      currentStep: 'not_posted',
    });
    await markFlow(bookId, eventId, 'not_posted');
    await notifyMembers(mailbox, bookId, {
      kind: 'rejected',
      sender: fromEmail || 'Unknown sender',
      subjectLine: subject,
      reason: fromEmail
        ? 'This sender is not a member of the ledger, so no entry was created.'
        : 'The message had no From address, so no entry was created.',
      inboundEventId: eventId,
    }).catch(() => undefined);
    await markFlow(bookId, eventId, 'team_notified', { teamNotified: true });
    return { skipped: 'sender is not a member', bookId, from: fromEmail };
  }

  const eventId = await logInboundEvent(bookId, {
    status: 'processing',
    fromEmail: member.email,
    subject: subject || '(no subject)',
    currentStep: 'received',
  });
  await markFlow(bookId, eventId, 'member_ok');

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

  await markFlow(bookId, eventId, 'reading', { hasFile: Boolean(receipt?.path), receiptName: receipt?.name || null });
  const hash = receipt?.bytes ? fileHash(receipt.bytes) : '';
  let match = await findMatchingReceipt(bookId, hash);
  if (!match && hash) {
    const reserved = await reserveReceiptHash(bookId, hash, {
      fromEmail: member.email,
      inboundEventId: eventId,
    });
    if (!reserved) match = await findMatchingReceipt(bookId, hash);
  }
  if (match) {
    if (match.expenseId) {
      return holdAsDuplicate({
        mailbox, bookId, seenKey, eventId, hash, member, subject, match, parsed: {}, receipt, messageId,
      });
    }
    await docSet(seenKey, { bookId, at: new Date().toISOString(), status: 'duplicate_pending' });
    await markFlow(bookId, eventId, 'duplicate_detected', { status: 'duplicate_pending' });
    await notifySender(mailbox, bookId, {
      to: member.email,
      subject: `This receipt is already being recorded · ${mailbox.name}`,
      kicker: 'Already in progress',
      title: 'Byjan is already recording this file',
      intro: 'The same attachment is already being processed for this ledger. No second entry will be created. You will receive the usual notice when it is saved.',
      rows: [
        { label: 'Ledger', value: mailbox.name },
        { label: 'File', value: receipt?.name || 'Attachment' },
      ],
      action: 'Sender told duplicate is already in progress',
      inboundEventId: eventId,
    }).catch(() => undefined);
    await markFlow(bookId, eventId, 'sender_notified', { senderNotified: true });
    return { skipped: 'duplicate in flight', bookId };
  }

  let parsed = parseReceiptFields(body, { subject, fileName: receipt?.name || attachments[0]?.Name || '' });
  let ocrPreview = '';
  let parseEngine = 'text';
  if (receipt?.bytes) {
    const enriched = await enrichFromDocument(
      receipt.bytes,
      receipt.contentType,
      receipt.name,
      body,
      subject,
      parsed,
    );
    parsed = enriched.parsed;
    ocrPreview = enriched.preview;
    parseEngine = enriched.engine || parseEngine;
  }
  await markFlow(bookId, eventId, 'parsed', { parseEngine });

  if (isUnusableDocument(parsed, body, ocrPreview, parseEngine, Boolean(receipt?.path))) {
    await docSet(seenKey, { bookId, at: new Date().toISOString(), status: 'unreadable' });
    await markFlow(bookId, eventId, 'not_posted', {
      status: 'unreadable',
      reason: 'Attachment was not a readable receipt, bill, or invoice',
    });
    await sendAmountMissingToSender(mailbox, bookId, {
      sender: member.email,
      subjectLine: subject,
      fileName: receipt?.name,
      receipt,
      inboundEventId: eventId,
      savedAsDraft: false,
    }).catch(() => undefined);
    await markFlow(bookId, eventId, 'sender_notified', { senderNotified: true });
    await notifyMembers(mailbox, bookId, {
      kind: 'unreadable',
      sender: member.email,
      subjectLine: subject,
      fileName: receipt?.name || '',
      reason: 'The file had no usable amount, merchant, or invoice data. It was not posted. The sender was asked to resend a clearer document.',
      inboundEventId: eventId,
    }).catch(() => undefined);
    await markFlow(bookId, eventId, 'team_notified', { teamNotified: true });
    return { skipped: 'unreadable document', bookId, from: member.email };
  }

  match = await findMatchingReceipt(bookId, hash, parsed, member.email);
  if (!match) {
    const fingerprint = billFingerprint(parsed, member.email);
    if (fingerprint) {
      const reservedBill = await docInsertIfNew(`inbound_bills/${bookId}/${fingerprint}`, {
        bookId,
        fingerprint,
        inboundEventId: eventId,
        reserved: true,
        at: new Date().toISOString(),
      });
      if (!reservedBill) {
        match = await findMatchingReceipt(bookId, hash, parsed, member.email);
        if (!match) {
          const bill = await docGet(`inbound_bills/${bookId}/${fingerprint}`);
          const expenseId = String(bill?.expenseId || '').trim();
          if (expenseId) {
            const expense = await docGet(`books/${bookId}/expenses/${expenseId}`);
            if (expense) match = { hash, expenseId, expense: { id: expenseId, ...expense }, reason: 'same_bill' as const };
          }
        }
        if (!match?.expenseId) {
          await docSet(seenKey, { bookId, at: new Date().toISOString(), status: 'duplicate_pending' });
          await markFlow(bookId, eventId, 'duplicate_detected', { status: 'duplicate_pending' });
          await notifySender(mailbox, bookId, {
            to: member.email,
            subject: `This receipt is already being recorded · ${mailbox.name}`,
            kicker: 'Already in progress',
            title: 'Byjan is already recording this file',
            intro: 'The same bill is already being processed for this ledger. No second entry will be created. You will receive the usual notice when it is saved.',
            rows: [
              { label: 'Ledger', value: mailbox.name },
              { label: 'File', value: receipt?.name || 'Attachment' },
            ],
            action: 'Sender told duplicate is already in progress',
            inboundEventId: eventId,
          }).catch(() => undefined);
          await markFlow(bookId, eventId, 'sender_notified', { senderNotified: true });
          return { skipped: 'duplicate in flight', bookId };
        }
      }
    }
  }
  if (match) {
    if (match.expenseId) {
      return holdAsDuplicate({
        mailbox, bookId, seenKey, eventId, hash, member, subject, match, parsed, receipt, messageId,
      });
    }
    await docSet(seenKey, { bookId, at: new Date().toISOString(), status: 'duplicate_pending' });
    await markFlow(bookId, eventId, 'duplicate_detected', { status: 'duplicate_pending' });
    await notifySender(mailbox, bookId, {
      to: member.email,
      subject: `This receipt is already being recorded · ${mailbox.name}`,
      kicker: 'Already in progress',
      title: 'Byjan is already recording this file',
      intro: 'The same attachment is already being processed for this ledger. No second entry will be created. You will receive the usual notice when it is saved.',
      rows: [
        { label: 'Ledger', value: mailbox.name },
        { label: 'File', value: receipt?.name || 'Attachment' },
      ],
      action: 'Sender told duplicate is already in progress',
      inboundEventId: eventId,
    }).catch(() => undefined);
    await markFlow(bookId, eventId, 'sender_notified', { senderNotified: true });
    return { skipped: 'duplicate in flight', bookId };
  }

  const amountMissing = !(Number(parsed.amount) > 0);
  await markFlow(bookId, eventId, amountMissing ? 'amount_missing' : 'amount_found', { amount: parsed.amount, category: parsed.category });

  const expense = {
    id: newId(),
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
    taxAmount: parsed.taxAmount || 0,
    invoiceNumber: parsed.invoiceNumber || null,
    paymentMethod: parsed.paymentMethod || null,
    notes: parsed.notes || null,
    currencyHint: parsed.currency || null,
    parseSource: parsed.parseSource,
    parseEngine,
    parseError: ocrPreview.startsWith('gemini_error:') ? ocrPreview.slice(0, 400) : null,
    emailMessageId: messageId,
    receiptPath: receipt?.path || null,
    receiptName: receipt?.name || null,
    receiptHash: hash || null,
    ocrPreview: ocrPreview || null,
  };

  const saved = await saveExpenseRecord(bookId, expense);
  if (hash) await storeFileHash(bookId, hash, saved).catch(() => undefined);
  const fingerprint = billFingerprint(parsed, member.email);
  if (fingerprint) {
    await docSet(`inbound_bills/${bookId}/${fingerprint}`, {
      bookId,
      fingerprint,
      reserved: false,
      expenseId: saved.id,
      amount: saved.amount,
      description: saved.description,
      category: saved.category,
      date: saved.date,
      at: new Date().toISOString(),
    }).catch(() => undefined);
  }
  await docSet(seenKey, { id: saved.id, bookId, at: new Date().toISOString(), status: 'accepted' });
  await markFlow(bookId, eventId, amountMissing ? 'draft' : 'recorded', {
    status: amountMissing ? 'amount_missing' : 'accepted',
    expenseId: saved.id,
    amount: parsed.amount,
    category: parsed.category,
    description: parsed.description,
    parseError: expense.parseError || null,
  });
  if (amountMissing) {
    await sendAmountMissingToSender(mailbox, bookId, {
      sender: member.email,
      subjectLine: subject,
      fileName: receipt?.name,
      receipt,
      inboundEventId: eventId,
      savedAsDraft: true,
    }).catch(() => undefined);
    await markFlow(bookId, eventId, 'sender_notified', { senderNotified: true });
  }
  await notifyMembers(mailbox, bookId, {
    kind: 'added',
    sender: member.email,
    subjectLine: subject,
    amount: amountMissing ? 'Not found — saved as draft for review' : moneyLabel(mailbox.currency, parsed.amount),
    category: parsed.category,
    description: parsed.description,
    paidBy: member.email,
    fileName: receipt?.name || '',
    inboundEventId: eventId,
  }).catch(() => undefined);
  await markFlow(bookId, eventId, 'team_notified', { teamNotified: true });
  return {
    ok: true,
    bookId,
    expenseId: saved.id,
    amount: parsed.amount,
    category: parsed.category,
    date: parsed.date,
    parseEngine,
    parseError: expense.parseError || null,
    hasFile: Boolean(receipt?.path),
    amountMissing,
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method === 'OPTIONS') {
      res.statusCode = 204;
      res.end();
      return;
    }
    if (req.method === 'GET' || req.method === 'HEAD') {
      const url = new URL(req.url || '/', 'https://local.invalid');
      if (url.searchParams.get('confirm')) {
        await handleConfirmDecision(req, res);
        return;
      }
      const wantsProbe = url.searchParams.get('probe') === 'gemini';
      if (wantsProbe) {
        if (!authorized(req) && !secretsMatch(String(url.searchParams.get('secret') || ''), inboundSecret())) {
          json(res, 401, { error: 'Invalid inbound secret' });
          return;
        }
        json(res, 200, { ok: true, probe: await probeGemini() });
        return;
      }
      json(res, 200, {
        ok: true,
        service: 'inbound-email',
        accepts: 'POST',
        secretConfigured: Boolean(inboundSecret()),
        docAiConfigured: Boolean(geminiKey()),
        slowOcrEnabled: allowSlowOcr(),
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

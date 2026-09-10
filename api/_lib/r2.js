import { createHash, createHmac } from 'node:crypto';

const REGION = 'auto';
const SERVICE = 's3';

export function r2Ready() {
  return Boolean(
    process.env.R2_ACCESS_KEY_ID &&
    process.env.R2_SECRET_ACCESS_KEY &&
    process.env.R2_ENDPOINT &&
    process.env.R2_BUCKET_NAME,
  );
}

function cfg() {
  const accessKeyId = process.env.R2_ACCESS_KEY_ID || '';
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY || '';
  const endpoint = (process.env.R2_ENDPOINT || '').replace(/\/+$/, '');
  const bucket = process.env.R2_BUCKET_NAME || '';
  if (!accessKeyId || !secretAccessKey || !endpoint || !bucket) {
    throw new Error('Cloudflare R2 is not configured. Set R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_ENDPOINT, and R2_BUCKET_NAME.');
  }
  return { accessKeyId, secretAccessKey, endpoint, bucket, host: new URL(endpoint).host };
}

function sha256Hex(data) {
  return createHash('sha256').update(data).digest('hex');
}

function hmac(key, data) {
  return createHmac('sha256', key).update(data, 'utf8').digest();
}

function awsEncode(value) {
  return encodeURIComponent(value).replace(/[!'()*]/g, (ch) => `%${ch.charCodeAt(0).toString(16).toUpperCase()}`);
}

function encodePath(key) {
  return key.split('/').filter(Boolean).map(awsEncode).join('/');
}

function amzNow() {
  return new Date().toISOString().replace(/[:-]|\.\d{3}/g, '');
}

function signingKey(secret, dateStamp) {
  const kDate = hmac(`AWS4${secret}`, dateStamp);
  const kRegion = hmac(kDate, REGION);
  const kService = hmac(kRegion, SERVICE);
  return hmac(kService, 'aws4_request');
}

function xmlText(value) {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

async function r2Fetch(method, key, opts) {
  const { accessKeyId, secretAccessKey, endpoint, bucket, host } = cfg();
  const queryPairs = Object.entries((opts && opts.query) || {})
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, value]) => `${awsEncode(name)}=${awsEncode(value)}`);
  const canonicalQuery = queryPairs.join('&');
  const objectPath = key ? `/${bucket}/${encodePath(key)}` : `/${bucket}`;
  const href = `${endpoint}${objectPath}${canonicalQuery ? `?${canonicalQuery}` : ''}`;
  const amzDate = amzNow();
  const dateStamp = amzDate.slice(0, 8);
  const payload = opts && opts.body && opts.body.length ? opts.body : Buffer.alloc(0);
  const payloadHash = sha256Hex(payload);
  const headers = {
    host,
    'x-amz-content-sha256': payloadHash,
    'x-amz-date': amzDate,
  };
  if (opts && opts.contentType) headers['content-type'] = opts.contentType;
  const signed = Object.keys(headers).sort();
  const canonicalHeaders = signed.map((name) => `${name}:${headers[name]}\n`).join('');
  const signedHeaders = signed.join(';');
  const canonicalRequest = [method, objectPath, canonicalQuery, canonicalHeaders, signedHeaders, payloadHash].join('\n');
  const scope = `${dateStamp}/${REGION}/${SERVICE}/aws4_request`;
  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, scope, sha256Hex(canonicalRequest)].join('\n');
  const signature = createHmac('sha256', signingKey(secretAccessKey, dateStamp)).update(stringToSign, 'utf8').digest('hex');
  headers.authorization = `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
  return fetch(href, {
    method,
    headers,
    body: method === 'GET' || method === 'HEAD' || method === 'DELETE' ? undefined : payload,
  });
}

export function r2FileKey(target) {
  const raw = String(target || '').trim();
  if (!raw) throw new Error('Invalid file');
  if (raw.startsWith('erp_workspaces/')) return raw.replace(/^\/+/, '');
  try {
    const url = new URL(raw);
    const path = decodeURIComponent(url.pathname.replace(/^\/+/, ''));
    const idx = path.indexOf('erp_workspaces/');
    if (idx >= 0) return path.slice(idx);
  } catch {
    // Not a URL; fall through.
  }
  throw new Error('Invalid file');
}

export async function r2GetBytes(key) {
  const res = await r2Fetch('GET', key);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`R2 read failed (${res.status})`);
  return {
    body: Buffer.from(await res.arrayBuffer()),
    contentType: res.headers.get('content-type') || 'application/octet-stream',
  };
}

export async function r2GetJson(key) {
  const file = await r2GetBytes(key);
  if (!file) return null;
  try {
    const parsed = JSON.parse(file.body.toString('utf8'));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export async function r2PutBytes(key, body, contentType) {
  const res = await r2Fetch('PUT', key, { body, contentType });
  if (!res.ok) throw new Error(`R2 write failed (${res.status})`);
}

export async function r2PutJson(key, data) {
  await r2PutBytes(key, Buffer.from(JSON.stringify(data ?? {}), 'utf8'), 'application/json');
}

export async function r2Del(key) {
  const res = await r2Fetch('DELETE', key);
  if (!res.ok && res.status !== 404) throw new Error(`R2 delete failed (${res.status})`);
}

export async function r2ListKeys(prefix) {
  const keys = [];
  let token = '';
  do {
    const query = {
      'list-type': '2',
      'max-keys': '1000',
      prefix,
    };
    if (token) query['continuation-token'] = token;
    const res = await r2Fetch('GET', '', { query });
    if (!res.ok) throw new Error(`R2 list failed (${res.status})`);
    const xml = await res.text();
    for (const match of xml.matchAll(/<Key>([^<]+)<\/Key>/g)) keys.push(xmlText(match[1]));
    const trunc = /<IsTruncated>true<\/IsTruncated>/i.test(xml);
    const next = xml.match(/<NextContinuationToken>([^<]+)<\/NextContinuationToken>/);
    token = trunc && next ? xmlText(next[1]) : '';
  } while (token);
  return keys;
}

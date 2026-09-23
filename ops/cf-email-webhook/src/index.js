import PostalMime from 'postal-mime';

const APEX_SUFFIX = '@easypado.com';
const LEGACY_INBOUND_SUFFIXES = ['@in.easypado.com', '@inbound.easypado.com'];

function addrList(value) {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value
      .map((row) => String(row?.address || row?.email || row || '').trim().toLowerCase())
      .filter(Boolean);
  }
  if (typeof value === 'object') {
    const one = String(value.address || value.email || '').trim().toLowerCase();
    return one ? [one] : [];
  }
  return String(value)
    .split(',')
    .map((part) => part.replace(/.*<|>.*/g, '').trim().toLowerCase())
    .filter((part) => part.includes('@'));
}

function isByjanAddress(addr) {
  const value = String(addr || '').toLowerCase();
  return value.endsWith(APEX_SUFFIX) || LEGACY_INBOUND_SUFFIXES.some((suffix) => value.endsWith(suffix));
}

function pickTo(email, messageTo) {
  const fromParsed = [
    ...addrList(email.to),
    ...addrList(email.cc),
    ...addrList(messageTo),
  ];
  const preferred = fromParsed.find((addr) => isByjanAddress(addr));
  return preferred || fromParsed[0] || String(messageTo || '');
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function shouldRetryStatus(status) {
  return status === 408 || status === 413 || status === 425 || status === 429 || status >= 500;
}

function toBase64(content) {
  if (!content) return '';
  if (typeof content === 'string') {
    const trimmed = content.trim();
    if (!trimmed) return '';
    return trimmed.replace(/^data:[^;]+;base64,/, '');
  }
  let bytes = content;
  if (content instanceof ArrayBuffer) bytes = new Uint8Array(content);
  if (ArrayBuffer.isView(bytes)) {
    const view = new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let bin = '';
    const step = 0x8000;
    for (let i = 0; i < view.length; i += step) {
      bin += String.fromCharCode(...view.subarray(i, i + step));
    }
    return btoa(bin);
  }
  return '';
}

function isReceiptPart(att) {
  const mime = String(att.mimeType || att.contentType || att.type || '').toLowerCase();
  const name = String(att.filename || att.fileName || '');
  if (/^image\/(png|jpe?g|jpg|webp|gif|heic|heif)/i.test(mime) || mime === 'application/pdf') return true;
  if (/\.(png|jpe?g|jpg|webp|gif|pdf|heic|heif|xlsx|xls|csv|doc|docx)$/i.test(name)) return true;
  if (mime.includes('spreadsheet') || mime.includes('excel') || mime === 'text/csv' || mime.includes('msword') || mime.includes('wordprocessingml')) return true;
  return false;
}

function packAttachments(email) {
  const maxBytes = 1_600_000;
  const maxTotal = 2_400_000;
  const out = [];
  let total = 0;
  try {
    for (const att of email.attachments || []) {
      const mime = String(att.mimeType || att.contentType || att.type || 'application/octet-stream');
      const rawName = String(att.filename || att.fileName || '').trim();
      const named = { mimeType: mime, filename: rawName };
      if (!isReceiptPart(named) && !/^application\/octet-stream$/i.test(mime)) continue;
      const contentBase64 = toBase64(att.content);
      if (!contentBase64) continue;
      const size = Math.floor((contentBase64.length * 3) / 4);
      if (size < 80 || size > maxBytes) continue;
      if (total + size > maxTotal) continue;
      const name = rawName || (mime.includes('pdf') ? 'receipt.pdf' : 'receipt.jpg');
      out.push({
        filename: name,
        mimeType: mime,
        size,
        contentBase64,
      });
      total += size;
      if (out.length >= 2) break;
    }
  } catch (err) {
    console.error('packAttachments failed', err);
  }
  return out;
}

async function postWebhook(env, payload) {
  const webhookUrl = String(env.WEBHOOK_URL || '').trim();
  const webhookSecret = String(env.WEBHOOK_SECRET || '').trim();
  if (!webhookUrl) {
    console.error('WEBHOOK_URL secret is not set');
    return;
  }
  const headers = { 'content-type': 'application/json' };
  if (webhookSecret) {
    headers['x-webhook-secret'] = webhookSecret;
    headers['x-inbound-secret'] = webhookSecret;
  }
  const body = JSON.stringify(payload);
  const delaysMs = [0, 400, 1200, 3000];
  let lastError = '';

  for (let attempt = 0; attempt < delaysMs.length; attempt += 1) {
    if (delaysMs[attempt]) await sleep(delaysMs[attempt]);
    try {
      const res = await fetch(webhookUrl, { method: 'POST', headers, body });
      if (res.ok) {
        console.log('Forwarded inbound mail to webhook', {
          to: payload.to,
          from: payload.from,
          status: res.status,
          attempt: attempt + 1,
        });
        return;
      }
      lastError = `${res.status} ${(await res.text().catch(() => '')).slice(0, 500)}`;
      if (!shouldRetryStatus(res.status)) {
        console.error('Webhook rejected', lastError);
        return;
      }
      console.error('Webhook failed, retrying', lastError, 'attempt', attempt + 1);
    } catch (err) {
      lastError = String(err?.message || err);
      console.error('Webhook fetch error, retrying', lastError, 'attempt', attempt + 1);
    }
  }
  console.error('Webhook gave up after retries', lastError);
}

export default {
  async email(message, env, ctx) {
    let email;
    try {
      email = await PostalMime.parse(message.raw, { attachmentEncoding: 'base64' });
    } catch (err) {
      console.error('postal-mime parse failed', err);
      // Accept the message anyway so Gmail does not bounce "address not found".
      return;
    }

    const to = pickTo(email, message.to);
    const from =
      email.from?.address ||
      addrList(message.from)[0] ||
      String(message.from || '');

    let attachments = [];
    try {
      attachments = packAttachments(email);
    } catch (err) {
      console.error('packAttachments threw', err);
    }
    const payload = {
      source: 'cloudflare-email',
      from,
      to,
      subject: email.subject || '',
      text: email.text || '',
      html: email.html || '',
      messageId: email.messageId || '',
      receivedAt: new Date().toISOString(),
      attachments,
    };
    console.log('inbound mail parsed', {
      to: payload.to,
      from: payload.from,
      attachmentCount: payload.attachments.length,
      attachmentBytes: payload.attachments.reduce((n, row) => n + (row.size || 0), 0),
    });

    // Return immediately so Cloudflare accepts the mailbox. Do not setReject —
    // that makes Gmail show "address not found".
    ctx.waitUntil(postWebhook(env, payload));
  },
};

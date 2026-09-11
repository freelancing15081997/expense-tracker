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
  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    console.error('Webhook failed', res.status, body.slice(0, 500));
    return;
  }
  console.log('Forwarded inbound mail to webhook', {
    to: payload.to,
    from: payload.from,
    status: res.status,
  });
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

    const payload = {
      source: 'cloudflare-email',
      from,
      to,
      subject: email.subject || '',
      text: email.text || '',
      html: email.html || '',
      messageId: email.messageId || '',
      receivedAt: new Date().toISOString(),
      attachments: (email.attachments || []).map((att) => ({
        filename: att.filename || 'attachment',
        mimeType: att.mimeType || 'application/octet-stream',
        size: typeof att.content === 'string' ? Math.floor((att.content.length * 3) / 4) : 0,
        contentBase64: typeof att.content === 'string' ? att.content : '',
      })),
    };

    // Return immediately so Cloudflare accepts the mailbox. Do not setReject —
    // that makes Gmail show "address not found".
    ctx.waitUntil(postWebhook(env, payload));
  },
};

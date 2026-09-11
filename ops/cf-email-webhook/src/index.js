import PostalMime from 'postal-mime';

const INBOUND_SUFFIX = '@in.easypado.com';

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

function isInboundRecipient(toHeader, messageTo) {
  const recipients = [...addrList(toHeader), ...addrList(messageTo)];
  return recipients.some((addr) => addr.endsWith(INBOUND_SUFFIX));
}

function pickTo(email, messageTo) {
  const fromParsed = [
    ...addrList(email.to),
    ...addrList(email.cc),
    ...addrList(messageTo),
  ];
  const inbound = fromParsed.find((addr) => addr.endsWith(INBOUND_SUFFIX));
  return inbound || fromParsed[0] || String(messageTo || '');
}

export default {
  async email(message, env, ctx) {
    const fallback = String(env.FORWARD_FALLBACK || 'byjanbooks@gmail.com').trim();
    const webhookUrl = String(env.WEBHOOK_URL || '').trim();
    const webhookSecret = String(env.WEBHOOK_SECRET || '').trim();

    let email;
    try {
      email = await PostalMime.parse(message.raw, { attachmentEncoding: 'base64' });
    } catch (err) {
      console.error('postal-mime parse failed', err);
      if (fallback) await message.forward(fallback);
      return;
    }

    const to = pickTo(email, message.to);
    const forLedger = isInboundRecipient(email.to, message.to) || String(to).toLowerCase().endsWith(INBOUND_SUFFIX);

    if (!forLedger) {
      if (fallback) await message.forward(fallback);
      return;
    }

    if (!webhookUrl) {
      console.error('WEBHOOK_URL secret is not set');
      message.setReject('Inbound webhook is not configured');
      return;
    }

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
      message.setReject(`Webhook failed (${res.status})`);
      return;
    }

    console.log('Forwarded inbound mail to webhook', { to, from, status: res.status });
  },
};

'use strict';

/**
 * Haraka plugin: byjan_webhook
 * Receives mail for *@in.easypado.com and POSTs JSON to Byjan /api/email/inbound.
 *
 * Env (set on the Haraka host):
 *   BYJAN_INBOUND_URL=https://www.easypado.com/api/email/inbound
 *   BYJAN_INBOUND_SECRET=your-long-secret
 *   BYJAN_INBOUND_MAX_ATTACH_BYTES=3500000   (optional, default ~3.5MB for Vercel body limits)
 */

const { simpleParser } = require('mailparser');

exports.register = function () {
  this.register_hook('data_post', 'byjan_webhook');
};

exports.byjan_webhook = function (next, connection) {
  const plugin = this;
  const txn = connection?.transaction;
  if (!txn) return next();

  const url = String(process.env.BYJAN_INBOUND_URL || '').trim();
  const secret = String(process.env.BYJAN_INBOUND_SECRET || '').trim();
  if (!url || !secret) {
    plugin.logerror('byjan_webhook: set BYJAN_INBOUND_URL and BYJAN_INBOUND_SECRET');
    return next();
  }

  const maxAttach = Number(process.env.BYJAN_INBOUND_MAX_ATTACH_BYTES || 3_500_000);
  const started = Date.now();

  // Copy stream to a buffer quickly, then ACK SMTP after webhook (or after parse fail).
  const chunks = [];
  txn.message_stream.on('data', (chunk) => chunks.push(chunk));
  txn.message_stream.on('error', (err) => {
    plugin.logerror(`byjan_webhook stream error: ${err.message}`);
    next();
  });
  txn.message_stream.on('end', async () => {
    try {
      const raw = Buffer.concat(chunks);
      const parsed = await simpleParser(raw);
      const toList = []
        .concat(parsed.to?.value || [])
        .concat(parsed.cc?.value || [])
        .map((row) => row.address)
        .filter(Boolean);

      const attachments = [];
      for (const att of parsed.attachments || []) {
        const content = att.content;
        if (!Buffer.isBuffer(content) || !content.length) continue;
        if (content.length > maxAttach) {
          plugin.loginfo(`byjan_webhook: skip oversized attachment ${att.filename} (${content.length} bytes)`);
          continue;
        }
        const type = String(att.contentType || '');
        if (!/^(image\/(png|jpe?g|webp)|application\/pdf)/i.test(type) && !/\.(png|jpe?g|webp|pdf)$/i.test(att.filename || '')) {
          continue;
        }
        attachments.push({
          filename: att.filename || 'receipt',
          contentType: type || 'application/octet-stream',
          content: content.toString('base64'),
        });
        // First usable receipt file is enough for speed.
        break;
      }

      const payload = {
        source: 'haraka',
        messageId: parsed.messageId || `${Date.now()}@haraka`,
        from: parsed.from?.value?.[0]?.address || '',
        to: toList,
        subject: parsed.subject || '',
        text: parsed.text || '',
        html: typeof parsed.html === 'string' ? parsed.html : '',
        attachments,
      };

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 12_000);
      const res = await fetch(`${url}?secret=${encodeURIComponent(secret)}`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-inbound-secret': secret,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      }).finally(() => clearTimeout(timer));

      const body = await res.text();
      plugin.loginfo(`byjan_webhook ${res.status} in ${Date.now() - started}ms :: ${body.slice(0, 200)}`);
    } catch (err) {
      plugin.logerror(`byjan_webhook failed: ${err.message}`);
    }
    next();
  });
};

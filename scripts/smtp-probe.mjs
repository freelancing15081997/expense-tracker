/**
 * Probe production SMTP without printing secrets.
 * Run: npx vercel env run --environment production -- node scripts/smtp-probe.mjs
 */
import nodemailer from 'nodemailer';

const user = String(process.env.SMTP_USER || process.env.BREVO_SMTP_USER || '').trim();
const pass = String(process.env.SMTP_PASS || process.env.BREVO_SMTP_KEY || process.env.BREVO_SMTP_PASS || '').trim();
const host = String(process.env.SMTP_HOST || 'smtp-relay.brevo.com').trim();
const port = Number(process.env.SMTP_PORT || 587);
const from = String(process.env.MAIL_FROM || 'byjanbooks@easypado.com').trim();
const to = String(process.env.SMTP_PROBE_TO || 'byjanbooks@easypado.com').trim();

function mask(v) {
  if (!v) return '(empty)';
  if (v.includes('@')) {
    const [a, b] = v.split('@');
    return `${a.slice(0, 2)}…@${b}`;
  }
  return `len=${v.length}`;
}

const report = {
  host,
  port,
  user: mask(user),
  pass: mask(pass),
  from,
  to,
  configured: Boolean(user && pass),
};

if (!user || !pass) {
  console.log(JSON.stringify({ ...report, ok: false, error: 'smtp-not-configured' }));
  process.exit(1);
}

const transporter = nodemailer.createTransport({
  host,
  port,
  secure: port === 465,
  auth: { user, pass },
  connectionTimeout: 20000,
  greetingTimeout: 20000,
  socketTimeout: 25000,
});

try {
  await transporter.verify();
  report.verify = true;
} catch (err) {
  report.verify = false;
  report.verifyError = String(err?.message || err).replace(pass, '[pass]').slice(0, 400);
}

if (!report.verify) {
  console.log(JSON.stringify({ ...report, ok: false }));
  process.exit(1);
}

try {
  const info = await transporter.sendMail({
    from: `"Byjan" <${from}>`,
    to,
    subject: 'Byjan SMTP probe',
    text: 'SMTP probe from Byjan. You can delete this message.',
  });
  console.log(JSON.stringify({
    ...report,
    ok: true,
    messageId: info.messageId,
    response: String(info.response || '').slice(0, 180),
  }));
} catch (err) {
  console.log(JSON.stringify({
    ...report,
    ok: false,
    sendError: String(err?.message || err).replace(pass, '[pass]').slice(0, 400),
  }));
  process.exit(1);
}

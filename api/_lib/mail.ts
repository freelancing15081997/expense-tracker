const DEFAULT_FROM = 'byjanbooks@easypado.com';

export function mailFrom() {
  const raw = String(process.env.MAIL_FROM || DEFAULT_FROM).trim();
  if (!raw || /gmail\.com$/i.test(raw)) return DEFAULT_FROM;
  return raw;
}

export function smtpConfig() {
  const user = String(process.env.SMTP_USER || process.env.BREVO_SMTP_USER || process.env.SMTP_LOGIN || '').trim();
  const pass = String(process.env.SMTP_PASS || process.env.BREVO_SMTP_KEY || process.env.BREVO_SMTP_PASS || '').trim();
  if (!user || !pass) {
    throw new Error('SMTP is not configured. Set SMTP_USER and SMTP_PASS in the server environment.');
  }
  return {
    host: process.env.SMTP_HOST || 'smtp-relay.brevo.com',
    port: Number(process.env.SMTP_PORT || 2525),
    secure: false,
    auth: { user, pass },
  };
}

export async function writeMailTrace(kind: string, detail: Record<string, unknown>) {
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

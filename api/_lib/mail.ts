import { mailFromAddress, smtpSettings } from './smtp-mail.js';

const DEFAULT_FROM = 'byjanbooks@easypado.com';

export function mailFrom() {
  return mailFromAddress(DEFAULT_FROM);
}

export function smtpConfig() {
  return smtpSettings();
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

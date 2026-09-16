/** Real UPI URI helpers + VPA validation. Never marks payment success. */

export const UPI_VPA_RE = /^[a-zA-Z0-9.\-_]{1,256}@[a-zA-Z]{2,64}$/;

export const PAYMENT_LIFECYCLE = [
  'UNPAID',
  'PAYMENT_STARTED',
  'AWAITING_CONFIRMATION',
  'PAID',
  'FAILED',
  'CANCELLED',
  'EXPIRED',
  'REVIEW_REQUIRED',
  'UNKNOWN',
] as const;

export type PaymentLifecycle = (typeof PAYMENT_LIFECYCLE)[number];

export const UPI_PROFILE_STATUS = ['UNSET', 'FORMAT_OK', 'SELF_CONFIRMED'] as const;
export type UpiProfileStatus = (typeof UPI_PROFILE_STATUS)[number];

export type UpiPayParams = {
  pa: string;
  pn: string;
  am: string;
  cu?: string;
  tn?: string;
  tr?: string;
};

export function normalizeVpa(raw: string) {
  return String(raw || '').trim().toLowerCase().replace(/\s+/g, '');
}

export function isValidVpa(raw: string) {
  const vpa = normalizeVpa(raw);
  if (!vpa || vpa.includes(' ')) return false;
  if (!UPI_VPA_RE.test(vpa)) return false;
  // Phone numbers alone are not UPI IDs.
  if (/^\d{10}@/.test(vpa) === false && /^\d{10}$/.test(vpa)) return false;
  if (/^\d{10}$/.test(String(raw || '').trim())) return false;
  return true;
}

export function paiseToUpiAmount(paise: number) {
  const n = Math.max(0, Math.round(Number(paise) || 0));
  return (n / 100).toFixed(2);
}

/** Build NPCI-compatible upi://pay deep link. */
export function buildUpiPayUri(params: UpiPayParams) {
  const pa = normalizeVpa(params.pa);
  if (!isValidVpa(pa)) throw new Error('Recipient UPI ID is invalid');
  const q = new URLSearchParams();
  q.set('pa', pa);
  q.set('pn', String(params.pn || 'Byjan member').slice(0, 80));
  q.set('am', params.am);
  q.set('cu', params.cu || 'INR');
  if (params.tn) q.set('tn', String(params.tn).slice(0, 80));
  if (params.tr) q.set('tr', String(params.tr).slice(0, 35));
  return `upi://pay?${q.toString()}`;
}

export type UpiAppId = 'generic' | 'gpay' | 'phonepe' | 'paytm' | 'bhim' | 'cred' | 'whatsapp';

/** Android package names so Pay opens the chosen partner, not a random UPI app. */
export const UPI_APP_PACKAGES: Record<UpiAppId, string | null> = {
  generic: null,
  gpay: 'com.google.android.apps.nbu.paisa.user',
  phonepe: 'com.phonepe.app',
  paytm: 'net.one97.paytm',
  bhim: 'in.org.npci.upiapp',
  cred: 'com.dreamplug.androidapp',
  whatsapp: 'com.whatsapp',
};

export const UPI_PAY_APPS: Array<{ id: UpiAppId; label: string }> = [
  { id: 'phonepe', label: 'PhonePe' },
  { id: 'gpay', label: 'Google Pay' },
  { id: 'paytm', label: 'Paytm' },
  { id: 'cred', label: 'CRED' },
  { id: 'whatsapp', label: 'WhatsApp' },
  { id: 'bhim', label: 'BHIM' },
  { id: 'generic', label: 'Any UPI app' },
];

/** Optional app-specific intents. May be unsupported — callers must handle fallback. */
export function buildAppUpiUri(app: UpiAppId, params: UpiPayParams) {
  const base = buildUpiPayUri(params);
  const qs = base.replace(/^upi:\/\/pay\?/, '');
  if (app === 'gpay') return `tez://upi/pay?${qs}`;
  if (app === 'phonepe') return `phonepe://pay?${qs}`;
  if (app === 'paytm') return `paytmmp://pay?${qs}`;
  if (app === 'bhim') return `bhim://upi/pay?${qs}`;
  if (app === 'cred') return `upi://pay?${qs}`;
  if (app === 'whatsapp') return `upi://pay?${qs}`;
  return base;
}

export function paymentStatusLabel(status: string) {
  const s = String(status || 'UNPAID').toUpperCase();
  const map: Record<string, string> = {
    UNPAID: 'Unpaid',
    PAYMENT_STARTED: 'Payment started',
    AWAITING_CONFIRMATION: 'Awaiting confirmation',
    PAID: 'Paid',
    FAILED: 'Failed',
    CANCELLED: 'Cancelled',
    EXPIRED: 'Expired',
    REVIEW_REQUIRED: 'Needs review',
    UNKNOWN: 'Couldn’t verify yet',
    PENDING: 'Unpaid',
    REQUESTED: 'Requested',
    NOTIFIED: 'Notified',
  };
  return map[s] || s;
}

export function canStartPayment(status: string) {
  const s = String(status || 'UNPAID').toUpperCase();
  return ['UNPAID', 'FAILED', 'CANCELLED', 'EXPIRED', 'UNKNOWN', 'REVIEW_REQUIRED', 'PENDING', 'REQUESTED', 'NOTIFIED'].includes(s);
}

/** Open a UPI deep link (web / fallback). Does not report payment success. */
export async function launchUpiUri(uri: string): Promise<{ opened: boolean; error?: string }> {
  try {
    if (!uri || !/^([a-z][a-z0-9+.-]*):/i.test(uri)) {
      return { opened: false, error: 'Invalid UPI link' };
    }
    const a = document.createElement('a');
    a.href = uri;
    a.style.display = 'none';
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    return { opened: true };
  } catch (err) {
    return { opened: false, error: err instanceof Error ? err.message : 'Could not open UPI app' };
  }
}

/** Launch UPI pay and read native intent result when available (Android). */
export async function launchUpiPayNative(uri: string, packageName?: string | null): Promise<{
  ok: boolean;
  outcome: 'success' | 'failed' | 'cancelled' | 'submitted' | 'unknown';
  status?: string;
  responseCode?: string;
  txnRef?: string;
  approvalRefNo?: string;
  txnId?: string;
  raw?: Record<string, unknown>;
  message?: string;
} | null> {
  try {
    const { Capacitor, registerPlugin } = await import('@capacitor/core');
    if (!Capacitor.isNativePlatform()) return null;
    const UpiPay = registerPlugin<{
      pay: (opts: { uri: string; packageName?: string }) => Promise<Record<string, unknown>>;
    }>('UpiPay');
    const res = await UpiPay.pay({ uri, packageName: packageName || undefined });
    const outcome = String(res.outcome || 'unknown') as 'success' | 'failed' | 'cancelled' | 'submitted' | 'unknown';
    return {
      ok: Boolean(res.ok),
      outcome,
      status: res.status ? String(res.status) : undefined,
      responseCode: res.responseCode ? String(res.responseCode) : undefined,
      txnRef: res.txnRef ? String(res.txnRef) : undefined,
      approvalRefNo: res.approvalRefNo ? String(res.approvalRefNo) : undefined,
      txnId: res.txnId ? String(res.txnId) : undefined,
      raw: res.raw && typeof res.raw === 'object' ? res.raw as Record<string, unknown> : undefined,
      message: res.message ? String(res.message) : undefined,
    };
  } catch {
    return null;
  }
}

export async function copyText(value: string) {
  const text = String(value || '');
  if (!text) return false;
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch { /* fallback */ }
  try {
    const el = document.createElement('textarea');
    el.value = text;
    el.style.position = 'fixed';
    el.style.left = '-9999px';
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);
    return true;
  } catch {
    return false;
  }
}

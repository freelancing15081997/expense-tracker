/** Real UPI URI helpers + VPA validation. Never marks payment success. */

export const UPI_VPA_RE = /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z][a-zA-Z0-9.\-]{1,63}$/;

/** Common Indian UPI PSP / bank handles (not exhaustive — unknown handles still allowed if format is valid). */
export const KNOWN_UPI_HANDLES: Record<string, string> = {
  oksbi: 'State Bank of India (Google Pay)',
  okhdfcbank: 'HDFC Bank (Google Pay)',
  okicici: 'ICICI Bank (Google Pay)',
  okaxis: 'Axis Bank (Google Pay)',
  okbizaxis: 'Axis Bank business (Google Pay)',
  ybl: 'PhonePe / Yes Bank',
  ibl: 'PhonePe / IndusInd',
  axl: 'PhonePe / Axis',
  paytm: 'Paytm',
  ptyes: 'Paytm',
  ptsbi: 'Paytm / SBI',
  pthdfc: 'Paytm / HDFC',
  apl: 'Amazon Pay',
  amazonpay: 'Amazon Pay',
  bhim: 'BHIM',
  freecharge: 'Freecharge',
  mobikwik: 'MobiKwik',
  jkbank: 'J&K Bank',
  federal: 'Federal Bank',
  kotak: 'Kotak',
  barodampay: 'Bank of Baroda',
  UPI: 'UPI',
  upi: 'UPI',
  okidfcbank: 'IDFC First (Google Pay)',
  okyesbank: 'Yes Bank (Google Pay)',
  okbob: 'Bank of Baroda (Google Pay)',
  naviaxis: 'Navi / Axis',
  sliceaxis: 'Slice / Axis',
  pingpay: 'Samsung Pay',
  rbl: 'RBL Bank',
  idbi: 'IDBI Bank',
  cnrb: 'Canara Bank',
  kbl: 'Karnataka Bank',
  tjsb: 'TJSB',
  dbsc: 'DBS',
  hsbc: 'HSBC',
  indus: 'IndusInd',
  yesbankltd: 'Yes Bank',
};

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

export function upiHandleOf(raw: string) {
  const vpa = normalizeVpa(raw);
  const at = vpa.lastIndexOf('@');
  if (at < 1) return '';
  return vpa.slice(at + 1);
}

export function describeUpiHandle(raw: string): string | null {
  const handle = upiHandleOf(raw);
  if (!handle) return null;
  return KNOWN_UPI_HANDLES[handle] || null;
}

export function isValidVpa(raw: string) {
  const vpa = normalizeVpa(raw);
  if (!vpa || vpa.includes(' ')) return false;
  if (!UPI_VPA_RE.test(vpa)) return false;
  // Phone numbers alone are not UPI IDs.
  if (/^\d{10}$/.test(String(raw || '').trim())) return false;
  const [local, handle] = vpa.split('@');
  if (!local || !handle) return false;
  if (local.length < 2) return false;
  // Reject obvious junk
  if (/^test@|^asdf@|^xxx@/i.test(vpa)) return false;
  if (handle.length < 2 || handle.length > 64) return false;
  return true;
}

/** Format + known-handle check. Does NOT call NPCI — bank-registered name needs a PSP API. */
export function validateUpiId(raw: string): { ok: boolean; message: string; handleLabel?: string; knownHandle: boolean } {
  const vpa = normalizeVpa(raw);
  if (!vpa) return { ok: false, message: 'Enter your UPI ID.', knownHandle: false };
  if (/^\d{10}$/.test(String(raw || '').trim())) {
    return { ok: false, message: 'Enter a full UPI ID like name@oksbi — a phone number alone is not enough.', knownHandle: false };
  }
  if (!isValidVpa(vpa)) {
    return { ok: false, message: 'UPI ID must look like name@bank (for example you@oksbi or you@ybl).', knownHandle: false };
  }
  const label = describeUpiHandle(vpa);
  if (label) {
    return {
      ok: true,
      message: `Looks like a ${label} payment ID. Confirm the name matches your UPI app.`,
      handleLabel: label,
      knownHandle: true,
    };
  }
  return {
    ok: true,
    message: 'Format looks valid. We cannot look up the bank-registered name without a payment-provider API — confirm it in your UPI app.',
    knownHandle: false,
  };
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


export type UpiAppId = 'generic' | 'gpay' | 'phonepe' | 'paytm' | 'bhim' | 'cred' | 'whatsapp' | 'amazonpay' | 'mobikwik';

/** Android package names so Pay opens the chosen partner, not a random UPI app. */
export const UPI_APP_PACKAGES: Record<UpiAppId, string | null> = {
  generic: null,
  gpay: 'com.google.android.apps.nbu.paisa.user',
  phonepe: 'com.phonepe.app',
  paytm: 'net.one97.paytm',
  bhim: 'in.org.npci.upiapp',
  cred: 'com.dreamplug.androidapp',
  whatsapp: 'com.whatsapp',
  amazonpay: 'in.amazon.mShop.android.shopping',
  mobikwik: 'com.mobikwik_new',
};

export const UPI_PAY_APPS: Array<{ id: UpiAppId; label: string }> = [
  { id: 'phonepe', label: 'PhonePe' },
  { id: 'gpay', label: 'Google Pay' },
  { id: 'paytm', label: 'Paytm' },
  { id: 'cred', label: 'CRED' },
  { id: 'amazonpay', label: 'Amazon Pay' },
  { id: 'mobikwik', label: 'MobiKwik' },
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
  if (app === 'amazonpay') return `upi://pay?${qs}`;
  if (app === 'mobikwik') return `upi://pay?${qs}`;
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

export type UpiQrPayload = {
  /** Payee VPA */
  pa: string;
  /** Payee display name */
  pn: string;
  /** Fixed amount from QR (rupees, as string) — empty when the QR leaves it to the payer. */
  am: string;
  cu: string;
  tn: string;
  tr: string;
  mc: string;
  /** Merchant/static QRs often lock the amount; "sign"ed NPCI QRs carry a signature we simply pass through. */
  raw: string;
};

/**
 * Decode any UPI QR / intent string (upi://pay, upi://collect, gpay://, phonepe://, paytmmp://, or a bare VPA).
 * Returns null when the text is not a UPI payment target. Never throws.
 */
export function parseUpiQr(text: string): UpiQrPayload | null {
  const raw = String(text || '').trim();
  if (!raw) return null;
  // Bare VPA typed/pasted by the user
  if (!raw.includes('://') && isValidVpa(raw)) {
    return { pa: normalizeVpa(raw), pn: '', am: '', cu: 'INR', tn: '', tr: '', mc: '', raw };
  }
  const m = raw.match(/^([a-z][a-z0-9+.-]*):\/\/([^?]*)\??(.*)$/i);
  if (!m) return null;
  const scheme = m[1].toLowerCase();
  const query = m[3] || '';
  const known = ['upi', 'tez', 'gpay', 'phonepe', 'paytmmp', 'paytm', 'bhim', 'credpay', 'mobikwik', 'amazonpay'];
  if (!known.includes(scheme)) return null;
  let params: URLSearchParams;
  try { params = new URLSearchParams(query.replace(/\+/g, '%20')); } catch { return null; }
  const pa = normalizeVpa(params.get('pa') || '');
  if (!isValidVpa(pa)) return null;
  const amRaw = String(params.get('am') || '').trim();
  const am = /^\d+(\.\d{1,2})?$/.test(amRaw) && Number(amRaw) > 0 ? Number(amRaw).toFixed(2) : '';
  return {
    pa,
    pn: String(params.get('pn') || '').trim().slice(0, 80),
    am,
    cu: String(params.get('cu') || 'INR').toUpperCase().slice(0, 3) || 'INR',
    tn: String(params.get('tn') || '').trim().slice(0, 80),
    tr: String(params.get('tr') || '').trim().slice(0, 35),
    mc: String(params.get('mc') || '').trim().slice(0, 8),
    raw,
  };
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

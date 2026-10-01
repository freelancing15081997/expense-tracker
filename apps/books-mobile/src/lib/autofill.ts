import type { CapturePreview } from './money';
import { accountsOf, categoriesOf, KIND_OPTIONS, type Book, type Expense } from './books';
import { nowTime, todayIso, rupees } from './format';

/** Every field on the entry form. Capture fills all of these; the person can edit any of them. */
export type EntryDraft = {
  txType: string;
  entryType: 'in' | 'out' | 'transfer';
  amount: string;
  currency: string;
  date: string;
  time: string;
  merchant: string;
  description: string;
  category: string;
  paymentMethod: string;
  accountId: string;
  toAccountId: string;
  fundSource: string;
  upiRef: string;
  vpa: string;
  invoiceNumber: string;
  taxAmount: string;
  documentType: string;
  notes: string;
  adjustments: string;
  paidByUid: string;
  receiptPath: string;
  receiptName: string;
  receiptDataUrl: string;
  flagged: boolean;
  splitEqually: boolean;
  source: string;
  captureId: string;
};
export type DraftKey = keyof EntryDraft;

export const FIELD_LABELS: Partial<Record<DraftKey, string>> = {
  amount: 'Amount', txType: 'Type', date: 'Date', time: 'Time', merchant: 'Paid to', description: 'For what', category: 'Category',
  paymentMethod: 'Paid by', accountId: 'Account', fundSource: 'Paid from', upiRef: 'UPI ref', vpa: 'UPI ID', invoiceNumber: 'Bill no.',
  taxAmount: 'GST / tax', documentType: 'Document', notes: 'Notes', adjustments: 'Adjustments', receiptPath: 'Receipt',
};

export function blankDraft(book: Book | null, uid: string): EntryDraft {
  const acc = accountsOf(book)[0];
  return {
    txType: 'EXPENSE', entryType: 'out', amount: '', currency: book?.currency || 'INR', date: todayIso(), time: nowTime(),
    merchant: '', description: '', category: '', paymentMethod: '', accountId: acc?.id || '', toAccountId: '', fundSource: '',
    upiRef: '', vpa: '', invoiceNumber: '', taxAmount: '', documentType: '', notes: '', adjustments: '', paidByUid: uid,
    receiptPath: '', receiptName: '', receiptDataUrl: '', flagged: false, splitEqually: false, source: 'manual', captureId: '',
  };
}

export function draftFromExpense(e: Expense, book: Book | null, uid: string): EntryDraft {
  const b = blankDraft(book, uid);
  return {
    ...b,
    txType: e.txType || (e.entryType === 'in' ? 'INCOME' : e.entryType === 'transfer' ? 'TRANSFER' : 'EXPENSE'),
    entryType: (e.entryType as EntryDraft['entryType']) || 'out',
    amount: e.amount ? String(e.amount) : '', currency: e.currency || b.currency, date: e.date || b.date, time: e.time || '',
    merchant: e.merchant || '', description: e.description || '', category: e.category || '', paymentMethod: e.paymentMethod || '',
    accountId: e.accountId || b.accountId, toAccountId: e.toAccountId || '', fundSource: e.fundSource || '', upiRef: e.upiRef || '',
    vpa: e.vpa || '', invoiceNumber: e.invoiceNumber || '', taxAmount: e.taxAmount ? String(e.taxAmount) : '', documentType: e.documentType || '',
    notes: e.notes || '', adjustments: e.adjustments || '', paidByUid: e.paidByUid || uid, receiptPath: e.receiptPath || '',
    receiptName: e.receiptName || '', flagged: !!e.flagged, source: e.source || 'manual', captureId: e.captureId || '',
  };
}

export function draftToExpense(d: EntryDraft): Partial<Expense> {
  return {
    amount: Math.round(Number(d.amount.replace(/,/g, '')) * 100) / 100, currency: d.currency, date: d.date, time: d.time,
    entryType: d.entryType, txType: d.txType, merchant: d.merchant.trim(), description: d.description.trim(), category: d.category,
    paymentMethod: d.paymentMethod, accountId: d.accountId, toAccountId: d.entryType === 'transfer' ? d.toAccountId : undefined,
    fundSource: d.fundSource.trim(), upiRef: d.upiRef.trim(), vpa: d.vpa.trim(), invoiceNumber: d.invoiceNumber.trim(),
    taxAmount: d.taxAmount ? Number(d.taxAmount) : undefined, documentType: d.documentType || undefined, notes: d.notes.trim(),
    adjustments: d.adjustments.trim(), paidByUid: d.paidByUid, receiptPath: d.receiptPath || undefined, receiptName: d.receiptName || undefined,
    flagged: d.flagged, source: d.source, captureId: d.captureId || undefined,
  };
}

// ---------- Local extraction: runs on device so the form fills instantly, then server values win ----------
const UPI_APPS: Array<[RegExp, string]> = [[/phonepe/i, 'PhonePe'], [/google\s*pay|gpay|tez/i, 'Google Pay'], [/paytm/i, 'Paytm'], [/bhim/i, 'BHIM'], [/amazon\s*pay/i, 'Amazon Pay'], [/cred\b/i, 'CRED']];
const CAT_RULES: Array<[RegExp, string]> = [
  [/\b(petrol|diesel|fuel|cng|hpcl|iocl|bpcl|indian oil|fastag)\b/i, 'Fuel'],
  [/\b(hospital|pharmacy|medic|clinic|apollo|1mg|netmeds|doctor)\b/i, 'Health'],
  [/\b(grocery|supermarket|dmart|blinkit|zepto|bigbasket|kirana|instamart|reliance fresh)\b/i, 'Groceries'],
  [/\b(restaurant|cafe|swiggy|zomato|dining|lunch|dinner|breakfast|dominos|starbucks|kfc|pizza)\b/i, 'Meals'],
  [/\b(uber|ola|rapido|irctc|flight|airline|hotel|metro|taxi|cab|toll|parking|makemytrip|indigo)\b/i, 'Travel'],
  [/\b(electricity|water bill|broadband|wifi|internet|airtel|jio|recharge|bescom|tneb)\b/i, 'Utilities'],
  [/\b(rent|landlord|society|maintenance)\b/i, 'Housing'],
  [/\b(amazon|flipkart|myntra|ajio|nykaa|meesho|mall)\b/i, 'Shopping'],
  [/\b(movie|pvr|inox|bookmyshow|netflix|spotify|hotstar)\b/i, 'Entertainment'],
  [/\b(school|tuition|college|course|udemy)\b/i, 'Education'],
  [/\b(insurance|premium|lic|policybazaar)\b/i, 'Insurance'],
  [/\b(salary|payroll)\b/i, 'Salary'],
];

export function extractLocal(text: string): Partial<EntryDraft> & { _paid?: boolean } {
  const t = String(text || '').replace(/\r/g, '');
  const flat = t.replace(/\s+/g, ' ');
  const out: Partial<EntryDraft> = {};
  const amt = flat.match(/(?:grand\s*total|net\s*payable|total\s*amount|amount\s*paid|paid|debited(?:\s+by|\s+for)?|credited(?:\s+with)?|sent|received|total|amount)\s*[:\-]?\s*(?:₹|rs\.?|inr)?\s*([0-9]{1,3}(?:,[0-9]{2,3})+(?:\.[0-9]{1,2})?|[0-9]+(?:\.[0-9]{1,2})?)/i)
    || flat.match(/(?:₹|rs\.?\s*|inr\s*)([0-9]{1,3}(?:,[0-9]{2,3})+(?:\.[0-9]{1,2})?|[0-9]+(?:\.[0-9]{1,2})?)/i);
  if (amt) { const n = Number(amt[1].replace(/,/g, '')); if (n > 0 && n < 1e8) out.amount = String(n); }
  const iso = flat.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/);
  const dmy = flat.match(/\b(\d{1,2})[/-](\d{1,2})[/-](20\d{2}|\d{2})\b/);
  const named = flat.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?,?\s+(20\d{2})\b/i)
    || flat.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{1,2}),?\s+(20\d{2})\b/i);
  const MON: Record<string, string> = { jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06', jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12' };
  if (iso) out.date = `${iso[1]}-${iso[2]}-${iso[3]}`;
  else if (dmy && Number(dmy[2]) <= 12) out.date = `${dmy[3].length === 2 ? '20' + dmy[3] : dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
  else if (named) {
    const isDayFirst = /^\d/.test(named[1]);
    const day = isDayFirst ? named[1] : named[2]; const mon = isDayFirst ? named[2] : named[1];
    out.date = `${named[3]}-${MON[mon.toLowerCase().slice(0, 3)]}-${day.padStart(2, '0')}`;
  }
  const tm = flat.match(/\b(\d{1,2}):(\d{2})(?::\d{2})?\s*(am|pm)?\b/i);
  if (tm) {
    let h = Number(tm[1]); const ap = (tm[3] || '').toLowerCase();
    if (ap === 'pm' && h < 12) h += 12; if (ap === 'am' && h === 12) h = 0;
    if (h < 24) out.time = `${String(h).padStart(2, '0')}:${tm[2]}`;
  }
  const ref = flat.match(/(?:upi\s*(?:ref(?:erence)?|txn|transaction)\s*(?:id|no\.?|number)?|utr(?:\s*no\.?)?|ref(?:erence)?\s*(?:no\.?|id)|transaction\s*id)\s*[:\-#]?\s*([A-Z0-9]{10,22})/i);
  if (ref) out.upiRef = ref[1];
  else { const twelve = flat.match(/\b(\d{12})\b/); if (twelve) out.upiRef = twelve[1]; }
  const vpa = flat.match(/\b([a-z0-9._-]{2,64}@[a-z]{2,32})\b/i);
  if (vpa && !/\.(com|in|org|net)$/i.test(vpa[1])) out.vpa = vpa[1].toLowerCase();
  const merchant = flat.match(/(?:paid\s+to|sent\s+to|to\s*:|trf\s+to|transfer(?:red)?\s+to|merchant(?:\s*name)?\s*[:\-]|billed\s+by|received\s+from|from\s*:)\s*([A-Za-z0-9&.' -]{2,60}?)(?=\s+(?:on|upi|ref|via|for|txn|a\/c|₹|rs|\d{2})|[.,\n]|$)/i);
  if (merchant) out.merchant = merchant[1].trim();
  else {
    const first = t.split('\n').map((l) => l.trim()).find((l) => l.length >= 3 && l.length <= 60 && /[a-z]/i.test(l) && !/^(date|amount|total|invoice|receipt|bill|tax|gst|qty|thank)/i.test(l));
    if (first) out.merchant = first;
  }
  const inv = flat.match(/(?:invoice|bill|receipt)\s*(?:no\.?|number|#)\s*[:\-]?\s*([A-Z0-9/-]{3,24})/i);
  if (inv) out.invoiceNumber = inv[1];
  const gst = flat.match(/(?:total\s*gst|gst|cgst\s*\+\s*sgst|igst|tax)\s*(?:@\s*\d+%?)?\s*[:\-]?\s*(?:₹|rs\.?)?\s*([0-9]+(?:\.[0-9]{1,2})?)/i);
  if (gst && Number(gst[1]) > 0 && (!out.amount || Number(gst[1]) < Number(out.amount))) out.taxAmount = gst[1];
  const note = flat.match(/(?:message|note|remarks?|narration|purpose|for)\s*[:\-]\s*([^.\n]{3,80})/i);
  if (note) out.description = note[1].trim();
  if (/\b(credited|received|refund|cashback|money\s*in)\b/i.test(flat)) { out.entryType = 'in'; out.txType = /refund/i.test(flat) ? 'REFUND' : 'INCOME'; }
  else if (/\b(debited|paid|sent|spent|purchase|bill)\b/i.test(flat)) { out.entryType = 'out'; out.txType = 'EXPENSE'; }
  if (/\b(upi|vpa|@ok|@ybl|@paytm|@axl|@ibl|phonepe|gpay|google pay|bhim)\b/i.test(flat)) out.paymentMethod = 'upi';
  else if (/\b(card|visa|mastercard|rupay|pos)\b/i.test(flat)) out.paymentMethod = 'card';
  else if (/\b(neft|imps|rtgs|net\s*banking|a\/c)\b/i.test(flat)) out.paymentMethod = 'bank';
  else if (/\bcash\b/i.test(flat)) out.paymentMethod = 'cash';
  for (const [re, app] of UPI_APPS) if (re.test(flat)) { out.fundSource = app; break; }
  const bank = flat.match(/\b(hdfc|icici|sbi|axis|kotak|yes\s*bank|pnb|bob|canara|idfc|indusind|federal)\b[^.\n]{0,24}?(?:a\/c|ac|account)?\s*(?:x+|\*+)?(\d{3,4})?/i);
  if (bank) out.fundSource = `${bank[1].toUpperCase()}${bank[2] ? ' ••' + bank[2] : ''}${out.fundSource ? ' via ' + out.fundSource : ''}`;
  if (/\binvoice\b/i.test(flat)) out.documentType = 'invoice'; else if (/\bbill\b/i.test(flat)) out.documentType = 'bill'; else if (out.amount) out.documentType = 'receipt';
  for (const [re, c] of CAT_RULES) if (re.test(flat)) { out.category = c; break; }
  return out;
}

const DIR: Record<string, EntryDraft['entryType']> = { MONEY_OUT: 'out', MONEY_IN: 'in', TRANSFER: 'transfer' };

function pickAccount(book: Book | null, method: string, current: string) {
  const accs = accountsOf(book);
  const want = method === 'upi' ? ['upi'] : method === 'card' ? ['credit_card', 'debit_card'] : method === 'cash' ? ['cash'] : method === 'bank' ? ['bank'] : method === 'wallet' ? ['wallet'] : [];
  return accs.find((a) => want.includes(a.kind))?.id || current;
}

function closestCategory(book: Book | null, cat: string) {
  if (!cat) return '';
  const list = categoriesOf(book);
  return list.find((c) => c.toLowerCase() === cat.toLowerCase()) || list.find((c) => c.toLowerCase().includes(cat.toLowerCase()) || cat.toLowerCase().includes(c.toLowerCase())) || cat;
}

/**
 * Merge order: blank → local regex (instant) → server preview (authoritative).
 * Returns which fields were filled by capture and which are low-confidence so the form can highlight them.
 */
export function autofill(base: EntryDraft, book: Book | null, input: { text?: string; preview?: CapturePreview | null; receiptPath?: string; receiptName?: string; receiptDataUrl?: string; source?: string }) {
  const filled = new Set<DraftKey>();
  const low = new Set<DraftKey>();
  const d: EntryDraft = { ...base };
  const set = (k: DraftKey, v: unknown) => {
    if (v === undefined || v === null || v === '') return;
    (d as Record<string, unknown>)[k] = typeof base[k] === 'boolean' ? Boolean(v) : String(v);
    filled.add(k);
  };
  const local = input.text ? extractLocal(input.text) : {};
  (Object.keys(local) as DraftKey[]).forEach((k) => set(k, (local as Record<string, unknown>)[k]));
  const p = input.preview;
  if (p) {
    if (p.amountPaise) set('amount', String(rupees(p.amountPaise)));
    if (p.direction && DIR[p.direction]) {
      set('entryType', DIR[p.direction]);
      const kind = KIND_OPTIONS.find((k) => k.txType === p.txType) || KIND_OPTIONS.find((k) => k.entryType === DIR[p.direction]);
      if (kind) set('txType', kind.txType);
    }
    set('date', p.date); set('time', p.time); set('merchant', p.merchant); set('description', p.description);
    set('category', closestCategory(book, p.category || '')); set('paymentMethod', p.paymentMethod); set('fundSource', p.fundSource);
    set('upiRef', p.upiRef); set('vpa', p.vpa); set('invoiceNumber', p.invoiceNumber);
    if (p.taxAmount) set('taxAmount', String(p.taxAmount));
    set('documentType', p.documentType); set('notes', p.notes); set('adjustments', p.adjustments); set('currency', p.currency);
    set('receiptPath', p.receiptPath); set('receiptName', p.receiptName); set('captureId', p.id);
    if (p.accountId) set('accountId', p.accountId);
    if (p.items?.length && !d.notes) set('notes', p.items.map((i) => `${i.qty ? i.qty + ' × ' : ''}${i.name}${i.amount ? ' — ₹' + i.amount : ''}`).join('\n'));
    if (p.fieldConfidence) Object.entries(p.fieldConfidence).forEach(([k, c]) => { if (c < 0.7) low.add(k as DraftKey); });
    else if (p.confidence === 'low') ['amount', 'merchant', 'category'].forEach((k) => filled.has(k as DraftKey) && low.add(k as DraftKey));
  }
  if (!d.description && d.merchant) { d.description = d.merchant; filled.add('description'); }
  if (d.paymentMethod && !p?.accountId) { const a = pickAccount(book, d.paymentMethod, d.accountId); if (a !== d.accountId) { d.accountId = a; filled.add('accountId'); } }
  if (!d.category && d.merchant) { const c = extractLocal(d.merchant).category; if (c) set('category', closestCategory(book, c)); }
  set('receiptPath', input.receiptPath); set('receiptName', input.receiptName);
  if (input.receiptDataUrl) d.receiptDataUrl = input.receiptDataUrl;
  if (input.source) d.source = input.source;
  return { draft: d, filled, low };
}

export function validateDraft(d: EntryDraft) {
  const errors: Partial<Record<DraftKey, string>> = {};
  const n = Number(d.amount.replace(/,/g, ''));
  if (!d.amount || !Number.isFinite(n) || n <= 0) errors.amount = 'Enter an amount above ₹0';
  else if (n >= 1e8) errors.amount = 'Amount looks too large';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.date)) errors.date = 'Pick a date';
  if (d.time && !/^\d{2}:\d{2}$/.test(d.time)) errors.time = 'Use HH:MM';
  if (!d.accountId) errors.accountId = 'Choose an account';
  if (d.entryType === 'transfer' && (!d.toAccountId || d.toAccountId === d.accountId)) errors.toAccountId = 'Choose a different account to move money to';
  if (d.taxAmount && (Number(d.taxAmount) < 0 || Number(d.taxAmount) > n)) errors.taxAmount = 'Tax can’t be more than the amount';
  if (d.vpa && !/^[a-z0-9._-]{2,64}@[a-z]{2,32}$/i.test(d.vpa)) errors.vpa = 'UPI ID looks like name@bank';
  const warnings: Partial<Record<DraftKey, string>> = {};
  if (d.date > todayIso()) warnings.date = 'This date is in the future';
  if (!d.category) warnings.category = 'No category — reports will show it as Uncategorized';
  return { errors, warnings };
}

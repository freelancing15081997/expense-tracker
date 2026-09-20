import { isoDay, parseQuickLine, type ParsedLine } from './ledger-advanced';

/** Real India / GCC / SEA merchant map used at capture time — not a demo list. */
export const INDIA_MERCHANTS: Array<{ match: string; merchant: string; category: string; method?: string }> = [
  { match: 'swiggy', merchant: 'Swiggy', category: 'Food', method: 'upi' },
  { match: 'zomato', merchant: 'Zomato', category: 'Food', method: 'upi' },
  { match: 'blinkit', merchant: 'Blinkit', category: 'Groceries', method: 'upi' },
  { match: 'zepto', merchant: 'Zepto', category: 'Groceries', method: 'upi' },
  { match: 'bigbasket', merchant: 'BigBasket', category: 'Groceries', method: 'upi' },
  { match: 'dmart', merchant: 'DMart', category: 'Groceries' },
  { match: 'irctc', merchant: 'IRCTC', category: 'Travel', method: 'upi' },
  { match: 'uber', merchant: 'Uber', category: 'Travel', method: 'upi' },
  { match: 'ola', merchant: 'Ola', category: 'Travel', method: 'upi' },
  { match: 'rapido', merchant: 'Rapido', category: 'Travel', method: 'upi' },
  { match: 'fastag', merchant: 'FASTag', category: 'Travel', method: 'upi' },
  { match: 'irctc', merchant: 'IRCTC', category: 'Travel', method: 'upi' },
  { match: 'indigo', merchant: 'IndiGo', category: 'Travel' },
  { match: 'airtel', merchant: 'Airtel', category: 'Utilities', method: 'upi' },
  { match: 'jio', merchant: 'Jio', category: 'Utilities', method: 'upi' },
  { match: 'bescom', merchant: 'BESCOM', category: 'Utilities', method: 'upi' },
  { match: 'tata power', merchant: 'Tata Power', category: 'Utilities' },
  { match: 'adani', merchant: 'Adani Electricity', category: 'Utilities' },
  { match: 'mgl', merchant: 'Mahanagar Gas', category: 'Utilities' },
  { match: 'society', merchant: 'Society', category: 'Housing' },
  { match: 'maintenance', merchant: 'Maintenance', category: 'Housing' },
  { match: 'amazon', merchant: 'Amazon', category: 'Shopping' },
  { match: 'flipkart', merchant: 'Flipkart', category: 'Shopping' },
  { match: 'myntra', merchant: 'Myntra', category: 'Shopping' },
  { match: 'apollo', merchant: 'Apollo Pharmacy', category: 'Health', method: 'upi' },
  { match: 'indianoil', merchant: 'IndianOil', category: 'Fuel' },
  { match: 'indian oil', merchant: 'IndianOil', category: 'Fuel' },
  { match: 'hpcl', merchant: 'HPCL', category: 'Fuel' },
  { match: 'bpcl', merchant: 'BPCL', category: 'Fuel' },
  { match: 'breadfast', merchant: 'Breadfast', category: 'Groceries' },
  { match: 'tvscredit', merchant: 'TVS Credit', category: 'Bills' },
  { match: 'tvs credit', merchant: 'TVS Credit', category: 'Bills' },
  { match: 'lic', merchant: 'LIC', category: 'Insurance' },
  { match: 'policybazaar', merchant: 'Policybazaar', category: 'Insurance' },
  { match: 'school', merchant: 'School', category: 'Education' },
  { match: 'byju', merchant: 'BYJU\'S', category: 'Education' },
];

export function extractUtr(text: string) {
  const hit = String(text || '').match(/\b(?:UTR|UPI(?:\s*Ref(?:erence)?)?(?:\s*No\.?)?|Ref(?:erence)?(?:\s*No\.?)?)\s*[:#-]?\s*([A-Z0-9]{8,22})\b/i);
  return hit?.[1]?.toUpperCase() || '';
}

export function extractVpa(text: string) {
  const hit = String(text || '').match(/\b([a-z0-9._-]{2,40}@[a-z]{2,20})\b/i);
  return hit?.[1]?.toLowerCase() || '';
}

export function parseBankSms(text: string): (ParsedLine & { upiRef?: string; vpa?: string }) | null {
  const raw = String(text || '').replace(/\s+/g, ' ').trim();
  if (!raw) return null;
  const looksBank = /\b(debited|credited|paid to|sent to|received from|neft|imps|rtgs|upi|a\/c|acct)\b/i.test(raw);
  if (!looksBank) return parseQuickLine(raw);
  const parsed = parseQuickLine(raw);
  if (!parsed) return null;
  const upiRef = extractUtr(raw);
  const vpa = extractVpa(raw);
  const merchant = guessedMerchant(raw)?.merchant || parsed.merchant || vpa.split('@')[0] || '';
  const categoryHint = guessedMerchant(raw)?.category;
  return {
    ...parsed,
    merchant,
    paymentMethod: guessedMerchant(raw)?.method || parsed.paymentMethod,
    description: categoryHint && parsed.description === 'Entry' ? merchant : parsed.description,
    upiRef,
    vpa,
  };
}

export function parseCaptureLines(text: string) {
  return String(text || '')
    .split(/\r?\n/)
    .map((line) => parseBankSms(line))
    .filter((row): row is NonNullable<ReturnType<typeof parseBankSms>> => Boolean(row));
}

function merchantNeedleHits(hay: string, needle: string) {
  const n = String(needle || '').toLowerCase();
  if (!n) return false;
  if (n.includes(' ')) return hay.includes(n);
  // Word boundary so "ola" does not steal APOLLO, "jio" does not match "region".
  const escaped = n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?:^|[^a-z0-9])${escaped}(?:$|[^a-z0-9])`).test(hay);
}

export function guessedMerchant(text: string) {
  const hay = text.toLowerCase();
  // UPI success chrome always contains PhonePe/GPay/Paytm/CRED — that is the app, not the payee.
  const payeeScreen = /\b(?:paid\s+to|transaction\s+successful|payment\s+successful|debited\s+from)\b/i.test(hay);
  return INDIA_MERCHANTS.find((row) => {
    if (payeeScreen && /^(phonepe|gpay|paytm|cred)$/.test(row.match)) return false;
    return merchantNeedleHits(hay, row.match);
  }) || null;
}

/** Keyword / description → category when merchant map misses (receipts, snap, share). */
export const DESCRIPTION_CATEGORY_RULES: Array<{ match: RegExp; category: string }> = [
  { match: /\b(swiggy|zomato|restaurant|cafe|meal|food|lunch|dinner|breakfast|biryani|dominos|mcdonald|starbucks|barista|dining|catering|pizza|burger|kfc|subway)\b/i, category: 'Food' },
  { match: /\b(blinkit|zepto|bigbasket|dmart|grocer|kirana|supermarket|reliance fresh|more supermarket|instamart|nature.?s basket)\b/i, category: 'Groceries' },
  { match: /\b(uber|ola|rapido|irctc|makemytrip|indigo|flight|railway|metro|travel|taxi|cab|hotel|airbnb|booking\.com|goibibo|cleartrip)\b/i, category: 'Travel' },
  { match: /\b(fuel|petrol|diesel|hpcl|iocl|bpcl|shell|indian oil|indianoil|fastag|toll)\b/i, category: 'Fuel' },
  { match: /\b(apollo|pharma|hospital|clinic|medicals?|1mg|netmeds|pharmacy|doctor|health|dental|lab test)\b/i, category: 'Health' },
  { match: /\b(bescom|electricity|broadband|airtel|jio|vodafone|\bvi\b|water board|gas cylinder|utility|utilities|recharge|wifi|fiber)\b/i, category: 'Utilities' },
  { match: /\b(amazon|flipkart|myntra|ajio|shopping|mall|nykaa|meesho|tatacliq)\b/i, category: 'Shopping' },
  { match: /\b(netflix|spotify|prime|subscription|saas|software|chatgpt|notion|youtube|hotstar|disney)\b/i, category: 'Software Subscriptions' },
  { match: /\b(rent|society|maintenance|housing|landlord|pg\b|hostel)\b/i, category: 'Housing' },
  { match: /\b(school|tuition|college|course|byju|education|fees|udemy|coursera)\b/i, category: 'Education' },
  { match: /\b(lic|policybazaar|insurance|premium|hdfc life|max life)\b/i, category: 'Insurance' },
  { match: /\b(salary|payroll|stipend|income|credited|refund|freelance|invoice paid)\b/i, category: 'Income' },
  { match: /\b(neft|imps|rtgs|bank transfer|internal fund transfer)\b/i, category: 'Transfers' },
  { match: /\b(movie|pvr|inox|bookmyshow|entertainment|concert)\b/i, category: 'Entertainment' },
  { match: /\b(gym|cult\.?fit|fitness|yoga|sports)\b/i, category: 'Health' },
];

export function guessCategoryFromText(...parts: Array<string | undefined | null>) {
  const hay = parts.filter(Boolean).join(' ').trim();
  if (!hay) return '';
  const merchantHit = guessedMerchant(hay);
  if (merchantHit?.category) return merchantHit.category;
  for (const rule of DESCRIPTION_CATEGORY_RULES) {
    if (rule.match.test(hay)) return rule.category;
  }
  return '';
}

export function enrichCapture(payload: Record<string, unknown>, expenses: Array<Record<string, unknown>>) {
  const hay = `${payload.description || ''} ${payload.merchant || ''} ${payload.notes || ''} ${payload.raw || ''}`;
  const guess = guessedMerchant(hay);
  const upiRef = String(payload.upiRef || extractUtr(hay) || '');
  const vpa = String(payload.vpa || extractVpa(hay) || '');
  const next: Record<string, unknown> = { ...payload };
  if (guess) {
    if (!String(next.merchant || '').trim()) next.merchant = guess.merchant;
    const cat = String(next.category || '').toLowerCase();
    if (!cat || cat === 'uncategorized') next.category = guess.category;
    if (!payload.paymentMethod && guess.method) next.paymentMethod = guess.method;
  }
  {
    const cat = String(next.category || '').toLowerCase();
    if (!cat || cat === 'uncategorized') {
      const fromText = guessCategoryFromText(String(next.description || ''), String(next.merchant || ''), String(next.notes || ''), String(next.raw || ''));
      if (fromText) next.category = fromText;
    }
  }
  if (upiRef) next.upiRef = upiRef;
  if (vpa) next.vpa = vpa;
  if (upiRef && expenses.some((exp) => String(exp.upiRef || '') === upiRef && exp.id !== payload.id)) {
    next.flagged = true;
    next.flagReason = 'Same UPI / UTR already on this ledger';
  }
  const tds = tdsHint(next);
  if (tds) {
    next.tdsSection = tds.section;
    next.tdsRate = tds.rate;
    next.tdsWatch = true;
    if (!next.flagged) next.flagged = true;
    if (!next.flagReason) next.flagReason = tds.reason;
  }
  return next;
}

export function gstSplit(amount: number, rate: 0 | 5 | 12 | 18 | 28) {
  const total = Number(amount || 0);
  if (!total || !rate) return { taxableAmount: total, gstAmount: 0, gstRate: 0 };
  const taxableAmount = Math.round((total / (1 + rate / 100)) * 100) / 100;
  const gstAmount = Math.round((total - taxableAmount) * 100) / 100;
  return { taxableAmount, gstAmount, gstRate: rate };
}

export function tdsHint(exp: Record<string, unknown>) {
  if (String(exp.entryType || 'out') !== 'out') return null;
  const amount = Number(exp.amount || 0);
  const hay = `${exp.category || ''} ${exp.description || ''} ${exp.merchant || ''}`.toLowerCase();
  if (amount < 30000) return null;
  if (/\brent|society|maintenance|lease\b/.test(hay) && amount >= 240000) {
    return { section: '194I', rate: 10, reason: 'Rent / property over the 194I watch amount.' };
  }
  if (/\b(professional|consultant|lawyer|ca |doctor|design)\b/.test(hay) && amount >= 30000) {
    return { section: '194J', rate: 10, reason: 'Professional fee over ₹30,000 — 194J watch.' };
  }
  if (/\b(contract|contractor|labour|repair|civil)\b/.test(hay) && amount >= 30000) {
    return { section: '194C', rate: 1, reason: 'Contractor payment over ₹30,000 — 194C watch.' };
  }
  return null;
}

export function formatIndianAmount(amount: number, symbol = '₹') {
  const n = Math.abs(Number(amount) || 0);
  const sign = amount < 0 ? '−' : '';
  // Always show the full amount (en-IN grouping). Never abbreviate as L / Cr —
  // users need to read the real figure at a glance.
  const body = n.toLocaleString('en-IN', {
    minimumFractionDigits: Number.isInteger(n) ? 0 : 2,
    maximumFractionDigits: 2,
  });
  return `${sign}${symbol}${body}`;
}

export function cashVsDigital(expenses: Array<Record<string, unknown>>, month = isoDay().slice(0, 7)) {
  let cash = 0;
  let digital = 0;
  for (const exp of expenses) {
    if (String(exp.entryType || 'out') !== 'out') continue;
    if (!String(exp.date || '').startsWith(month)) continue;
    const amt = Number(exp.amount || 0);
    if (String(exp.paymentMethod || 'cash') === 'cash') cash += amt;
    else digital += amt;
  }
  return { cash, digital, cashShare: cash + digital ? Math.round((cash / (cash + digital)) * 100) : 0 };
}

export function salaryCredits(expenses: Array<Record<string, unknown>>, month = isoDay().slice(0, 7)) {
  return expenses.filter((exp) => {
    if (String(exp.entryType) !== 'in') return false;
    if (!String(exp.date || '').startsWith(month)) return false;
    const day = Number(String(exp.date || '').slice(8, 10));
    const amt = Number(exp.amount || 0);
    const hay = `${exp.description || ''} ${exp.category || ''}`.toLowerCase();
    return amt >= 15000 && (day <= 5 || day >= 27 || /\bsalary|payroll|credit\b/.test(hay));
  });
}

export function festivalWindow(now = new Date()) {
  const y = now.getFullYear();
  const windows = [
    { name: 'Holi week', from: `${y}-03-01`, to: `${y}-03-08` },
    { name: 'Eid window', from: `${y}-03-18`, to: `${y}-03-26` },
    { name: 'Onam week', from: `${y}-08-24`, to: `${y}-09-06` },
    { name: 'Navratri / Dussehra', from: `${y}-09-21`, to: `${y}-10-12` },
    { name: 'Diwali fortnight', from: `${y}-10-20`, to: `${y}-11-12` },
    { name: 'Christmas / NY', from: `${y}-12-20`, to: `${y}-12-31` },
    { name: 'Payday week', from: `${isoDay().slice(0, 8)}01`, to: `${isoDay().slice(0, 8)}05` },
  ];
  const today = isoDay(now);
  return windows.find((row) => today >= row.from && today <= row.to) || null;
}

export function householdDues(expenses: Array<Record<string, unknown>>) {
  const month = isoDay().slice(0, 7);
  const needles = ['rent', 'maid', 'driver', 'society', 'electricity', 'gas', 'broadband', 'wifi', 'school'];
  return needles.filter((name) => !expenses.some((exp) => {
    if (!String(exp.date || '').startsWith(month)) return false;
    return `${exp.description || ''} ${exp.merchant || ''} ${exp.category || ''}`.toLowerCase().includes(name);
  }));
}

export function duplicateUtrIds(expenses: Array<Record<string, unknown>>) {
  const seen = new Map<string, string[]>();
  for (const exp of expenses) {
    const ref = String(exp.upiRef || '').trim();
    if (!ref) continue;
    const list = seen.get(ref) || [];
    list.push(String(exp.id || ''));
    seen.set(ref, list);
  }
  return new Set([...seen.values()].filter((ids) => ids.length > 1).flat());
}

export function gstClaimGaps(expenses: Array<Record<string, unknown>>) {
  return expenses.filter((exp) => Number(exp.gstRate || 0) > 0 && !exp.receiptPath && !exp.receiptUrl && String(exp.entryType || 'out') === 'out');
}

export function workspaceBridges(expenses: Array<Record<string, unknown>>) {
  const mix = cashVsDigital(expenses);
  const salary = salaryCredits(expenses);
  const fest = festivalWindow();
  const dues = householdDues(expenses);
  const tds = expenses.filter((exp) => exp.tdsWatch && !exp.tdsSettled).length;
  const gstGaps = gstClaimGaps(expenses).length;
  const dupUtr = duplicateUtrIds(expenses).size;
  return { mix, salary, fest, dues, tds, gstGaps, dupUtr };
}

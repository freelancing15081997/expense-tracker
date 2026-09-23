/**
 * Deterministic receipt / email field mapper (no model call).
 * Shared by inbound email (cloud) and local share / attach (device).
 */

export type ParsedReceipt = {
  amount: number;
  date: string;
  merchant: string;
  description: string;
  category: string;
  entryType: 'in' | 'out';
  documentType: 'receipt' | 'bill' | 'invoice';
  parseSource: 'text' | 'image' | 'mixed' | 'ocr' | 'ai';
  taxAmount?: number;
  currency?: string;
  invoiceNumber?: string;
  paymentMethod?: string;
  notes?: string;
  fundSource?: string;
  adjustments?: string;
};

export const CATEGORY_RULES: Array<{ category: string; pattern: RegExp }> = [
  { category: 'Fuel', pattern: /\b(petrol|diesel|fuel|cng|hpcl|iocl|bpcl|nayara|indian oil|bharat petroleum|hindustan petroleum|shell|indianOil|pump)\b/i },
  { category: 'Groceries', pattern: /\b(grocery|groceries|supermarket|dmart|d-mart|big bazaar|reliance fresh|more supermarket|foodgrain)\b/i },
  { category: 'Meals', pattern: /\b(restaurant|cafe|swiggy|zomato|dining|meal|food|lunch|dinner|breakfast)\b/i },
  { category: 'Travel', pattern: /\b(uber|ola|rapido|irctc|flight|airline|hotel|metro|taxi|cab|toll|parking)\b/i },
  { category: 'Utilities', pattern: /\b(electricity|water bill|gas bill|broadband|wifi|internet|rent|maintenance)\b/i },
  { category: 'Health', pattern: /\b(hospital|pharmacy|medicine|clinic|apollo|diagnostic)\b/i },
  { category: 'Shopping', pattern: /\b(amazon|flipkart|myntra|ajio|store|mall)\b/i },
  { category: 'Software Subscriptions', pattern: /\b(subscription|saas|aws|github|google workspace|microsoft 365)\b/i },
];

export function toNumber(raw: string) {
  const amount = Number(String(raw || '').replace(/,/g, ''));
  return Number.isFinite(amount) && amount > 0 && amount < 100_000_000 ? amount : 0;
}

export function parseIsoDate(value: string) {
  const raw = String(value || '').trim();
  const iso = raw.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const dmy = raw.match(/\b(\d{1,2})[/-](\d{1,2})[/-](20\d{2})\b/);
  if (dmy) {
    const day = dmy[1].padStart(2, '0');
    const month = dmy[2].padStart(2, '0');
    if (Number(month) <= 12) return `${dmy[3]}-${month}-${day}`;
  }
  const named = raw.match(/\b(\d{1,2})\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?,?\s+(20\d{2})\b/i);
  if (named) {
    const months: Record<string, string> = { jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06', jul: '07', aug: '08', sep: '09', sept: '09', oct: '10', nov: '11', dec: '12' };
    const month = months[named[2].toLowerCase().slice(0, 4)] || months[named[2].toLowerCase().slice(0, 3)];
    if (month) return `${named[3]}-${month}-${named[1].padStart(2, '0')}`;
  }
  return '';
}

export function clipQuoted(text: string) {
  const cut = String(text || '')
    .replace(/\r/g, '')
    .split(/\nOn .+wrote:|\nFrom: .+(\nSent:)?|\n-{2,}\s*Original Message\s*-{2,}|\n-- \n/i)[0];
  return cut.replace(/\s+/g, ' ').trim().slice(0, 8000);
}

export function stripHtml(value: string) {
  return String(value || '').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&');
}

export function cleanSubject(subject: string) {
  return String(subject || '').replace(/^(fwd:|fw:|re:)\s*/ig, '').replace(/\.(jpg|jpeg|png|webp|pdf|xlsx?|csv|docx?)$/i, '').trim();
}

export function parseAmount(text: string) {
  const hay = String(text || '')
    .replace(/[|]/g, ' ')
    .replace(/\b(totai|tota1|tota!)\b/gi, 'total')
    .replace(/\b(arnount|arnout|arnunt)\b/gi, 'amount');
  const labeled = hay.match(/(?:grand\s*total|net\s*(?:payable|amount|total)|amount(?:\s*\([^)]{0,12}\))?\s*(?:paid|due)?|total\s*amount|total|paid(?:\s+for)?)\s*[:\-–]?\s*(?:₹|rs\.?|inr|usd|eur|gbp|\$)?\s*([0-9]{1,3}(?:[,\s][0-9]{2,3})+(?:\.[0-9]{1,2})?|[0-9]+(?:\.[0-9]{1,2})?)/i);
  if (labeled) {
    const amount = toNumber(labeled[1].replace(/\s/g, ''));
    if (amount) return amount;
  }
  const bareAmount = hay.match(/\b(?:amount|amt|total|paid)\s*[:\-–]?\s*([0-9]{1,3}(?:,[0-9]{2,3})+(?:\.[0-9]{1,2})?|[0-9]+(?:\.[0-9]{1,2})?)\b/i);
  if (bareAmount) {
    const amount = toNumber(bareAmount[1].replace(/\s/g, ''));
    if (amount) return amount;
  }
  const currency = hay.match(/(?:₹|rs\.?\s*|inr\s*)([0-9]{1,3}(?:[,\s][0-9]{2,3})+(?:\.[0-9]{1,2})?|[0-9]+(?:\.[0-9]{1,2})?)/i)
    || hay.match(/\$\s*([0-9]+(?:,[0-9]{3})*(?:\.[0-9]{1,2})?)/);
  if (currency) {
    const amount = toNumber(currency[1].replace(/\s/g, ''));
    if (amount) return amount;
  }
  return 0;
}

export function categoryFromText(text: string) {
  const hay = String(text || '');
  for (const rule of CATEGORY_RULES) {
    if (rule.pattern.test(hay)) return rule.category;
  }
  return 'Uncategorized';
}

export function merchantFrom(text: string) {
  const hay = String(text || '');
  const match =
    hay.match(/paid to\s+([^\n,]+)/i) ||
    hay.match(/merchant(?:\s*name)?\s*[:\-]\s*([^\n]+)/i) ||
    hay.match(/billed by\s*[:\-]?\s*([^\n]+)/i) ||
    hay.match(/vendor\s*[:\-]\s*([^\n]+)/i) ||
    hay.match(/sold by\s*[:\-]\s*([^\n]+)/i);
  const labeled = String(match?.[1] || '').replace(/\s+/g, ' ').trim();
  if (labeled) return labeled.slice(0, 80);
  const first = hay
    .split(/\n/)
    .map((line) => line.trim())
    .find((line) => line.length >= 3 && line.length <= 80 && !/^(date|amount|total|volume|qty|invoice|receipt|bill|fwd:|fw:|re:)/i.test(line));
  return String(first || '').slice(0, 80);
}

export function entryTypeFrom(text: string) {
  const hay = String(text || '');
  if (/\b(return(?:ed|ing)?|refund(?:ed|s)?|money\s*back|cash\s*back|credited|received|money\s*in|incoming|reimbursed|reimbursement\s*received)\b/i.test(hay)) {
    if (/\b(return(?:ed|ing)?\s+to\s+(?:vendor|supplier)|returned\s+purchase\s+without\s+refund)\b/i.test(hay)) {
      return 'out' as const;
    }
    return 'in' as const;
  }
  return 'out' as const;
}

export function documentTypeFrom(text: string) {
  if (/\binvoice\b/i.test(text)) return 'invoice' as const;
  if (/\bbill\b/i.test(text)) return 'bill' as const;
  return 'receipt' as const;
}

export function paymentMethodFrom(text: string) {
  const hay = String(text || '');
  if (/\b(upi|gpay|google\s*pay|phonepe|paytm|bhim)\b/i.test(hay)) return 'upi';
  if (/\b(card|visa|mastercard|rupay|debit\s*card|credit\s*card)\b/i.test(hay)) return 'card';
  if (/\b(wallet|amazon\s*pay|mobikwik)\b/i.test(hay)) return 'wallet';
  if (/\b(neft|rtgs|imps|bank\s*transfer|net\s*banking|from\s+(?:my\s+)?(?:hdfc|icici|sbi|axis|kotak|yes\s*bank)|account)\b/i.test(hay)) return 'bank';
  if (/\bcash\b/i.test(hay)) return 'cash';
  return '';
}

export function fundSourceFrom(text: string) {
  const hay = String(text || '');
  const labeled =
    hay.match(/(?:paid\s+from|from\s+(?:my\s+)?(?:account|a\/c|wallet)|amount\s+from|money\s+from|via|using)\s*[:\-–]?\s*([^\n.,;]{2,80})/i) ||
    hay.match(/\bfrom\s+((?:hdfc|icici|sbi|axis|kotak|yes\s*bank|upi|gpay|phonepe|paytm|cash|card)[^\n.,;]{0,60})/i);
  const raw = String(labeled?.[1] || '').replace(/\s+/g, ' ').trim();
  return raw.slice(0, 80);
}

export function paidForFrom(text: string) {
  const hay = String(text || '').replace(/\s+/g, ' ').trim();
  const patterns = [
    /(?:paid\s+for|payment\s+for|expense\s+for|spent\s+on|bought|purchase(?:d)?\s+for|towards|regarding|for)\s*[:\-–]?\s*([^\n.!?]{3,120})/i,
    /(?:this\s+is\s+for|description|message|note|notes)\s*[:\-–]?\s*([^\n.!?]{3,120})/i,
    /(?:return(?:ed)?|refund(?:ed)?)\s+(?:for|of|against)\s*[:\-–]?\s*([^\n.!?]{3,120})/i,
  ];
  for (const pattern of patterns) {
    const match = hay.match(pattern);
    const value = String(match?.[1] || '')
      .replace(/\b(?:rs\.?|inr|₹)?\s*[0-9][0-9,]*(?:\.[0-9]+)?\b/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/[.,;:\-–]+$/, '');
    if (value.length >= 3 && !/^(the|a|an|this|that|from|with|and)$/i.test(value)) {
      return value.slice(0, 140);
    }
  }
  return '';
}

export function adjustmentsFrom(text: string) {
  const hay = String(text || '');
  const chunks: string[] = [];
  const patterns = [
    /(?:adjust(?:ment)?|allocate|split|of\s+which|out\s+of\s+this|please\s+adjust|mark\s+[0-9].{0,40}as)\s*[:\-–]?\s*([^\n]{5,200})/gi,
    /([0-9][0-9,]*(?:\.[0-9]+)?\s*(?:is|for)\s+(?:personal|office|client|other|reimbursable)[^\n]{0,80})/gi,
  ];
  for (const pattern of patterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(hay))) {
      const piece = String(match[0] || '').replace(/\s+/g, ' ').trim();
      if (piece.length >= 5) chunks.push(piece.slice(0, 200));
    }
  }
  return [...new Set(chunks)].slice(0, 4).join(' · ').slice(0, 400);
}

export function composeNotes(parts: Array<string | undefined | null>) {
  return [...new Set(parts.map((row) => String(row || '').trim()).filter(Boolean))].join('\n').slice(0, 800);
}

/**
 * Fast, deterministic summary of the sender's intent (no model call).
 * Captures what was paid for, where funds came from, returns, and adjustments.
 */
export function summarizeEmailIntent(body: string, subject = ''): ParsedReceipt {
  const cleanBody = clipQuoted(body);
  const subjectClean = cleanSubject(subject);
  const hay = `${subjectClean}\n${cleanBody}`;
  const paidFor = paidForFrom(hay);
  const fundSource = fundSourceFrom(hay);
  const adjustments = adjustmentsFrom(hay);
  const merchant = merchantFrom(cleanBody) || merchantFrom(subjectClean);
  const paymentMethod = paymentMethodFrom(hay) || paymentMethodFrom(fundSource);
  const amount = parseAmount(hay);
  const date = parseIsoDate(hay) || new Date().toISOString().split('T')[0];
  const category = categoryFromText(hay);
  const entryType = entryTypeFrom(hay);
  const description = (paidFor || subjectClean || merchant || 'Inbound email')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 140);
  const notes = composeNotes([
    fundSource ? `Paid from: ${fundSource}` : '',
    adjustments ? `Adjustment: ${adjustments}` : '',
    paidFor && paidFor !== description ? paidFor : '',
  ]);
  return {
    amount,
    date,
    merchant,
    description,
    category,
    entryType,
    documentType: documentTypeFrom(hay),
    parseSource: 'text',
    paymentMethod: paymentMethod || undefined,
    fundSource: fundSource || undefined,
    adjustments: adjustments || undefined,
    notes: notes || undefined,
  };
}

export function parseReceiptFields(text: string, extras?: { subject?: string; fileName?: string }): ParsedReceipt {
  const subject = cleanSubject(extras?.subject || '');
  const fileName = String(extras?.fileName || '').replace(/[_-]+/g, ' ');
  const intent = summarizeEmailIntent(text, subject);
  const hay = `${subject}\n${fileName}\n${text}`;
  const merchant = intent.merchant || merchantFrom(text) || merchantFrom(fileName);
  const category = intent.category !== 'Uncategorized' ? intent.category : categoryFromText(hay);
  const amount = intent.amount || parseAmount(hay);
  const date = intent.date || parseIsoDate(hay) || new Date().toISOString().split('T')[0];
  const fallback = subject || merchant || cleanSubject(fileName) || 'Inbound document';
  const description = (intent.description && intent.description !== 'Inbound email'
    ? intent.description
    : [merchant, subject && subject.toLowerCase() !== merchant.toLowerCase() ? subject : '']
        .filter(Boolean)
        .join(' · ')
        .slice(0, 140) || fallback.slice(0, 140));
  return {
    amount,
    date,
    merchant,
    description,
    category,
    entryType: intent.entryType || entryTypeFrom(hay),
    documentType: documentTypeFrom(hay),
    parseSource: 'text',
    paymentMethod: intent.paymentMethod || paymentMethodFrom(hay) || undefined,
    fundSource: intent.fundSource,
    adjustments: intent.adjustments,
    notes: intent.notes,
  };
}

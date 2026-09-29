/**
 * Receipt text → { amount, currency, counterparty, note, direction }.
 * Same rules as services/document-parser/parser_engine.py `_resolve` (server authority).
 *
 * Built from real on-device OCR output (ML Kit Latin), not from typed samples:
 *  - ML Kit has no glyph for ₹. It prints "7", "Z", "F" or nothing: ₹800 → "7800", ₹199 → "Z199",
 *    ₹3,075 → "F3,075" / "73,075", ₹140 → "140", ₹800 → "2800". A leading 7 or 2 is only trusted
 *    as a rupee mark when the app-grouping rule or a second read / amount-in-words proves it.
 *  - Payment apps group thousands ("1,000", "20,000"). A standalone 4-digit token without a comma
 *    that starts with 7 therefore cannot be a real ≥1000 amount on a screenshot.
 *  - Amount in words ("Rupees Eight Hundred Only") is definitive.
 *  - Ads / payment history / offers below the receipt block never supply the amount.
 *  - Description is only a labelled note. UI chrome (Split Expense, Done…) is never a note.
 *  - Name is the counterparty: the labelled party, or the person line right above a UPI handle.
 */

/**
 * How the amount was established:
 *  - paid_to: on the "Paid to / You sent …" line or in the same sentence as the counterparty
 *  - after_payee: the token right under / above the counterparty block
 *  - labeled: under a Total / Amount paid label, or the amount in words
 *  - currency: a currency-marked token (or a bare number confirmed by a second read)
 *  - bare: a lone digit run with payment context but no other confirmation — never auto-trusted
 */
export type ReceiptAmountHow = 'none' | 'paid_to' | 'after_payee' | 'labeled' | 'currency' | 'bare';

export type ResolvedReceipt = {
  amount: number;
  amountHow: ReceiptAmountHow;
  currency: string;
  payee: string;
  payer: string;
  creditedTo: string;
  message: string;
  direction: 'money_in' | 'money_out' | 'unknown';
  status: 'success' | 'failed' | 'pending' | 'refunded' | 'unknown';
};

// ---------------------------------------------------------------------------
// Currencies
// ---------------------------------------------------------------------------

type CurrencyDef = { code: string; marks: string[]; decimalComma?: boolean };

const CURRENCIES: CurrencyDef[] = [
  { code: 'INR', marks: ['₹', '₨', 'Rs.', 'Rs', 'INR', 'Rupees', 'Rupee'] },
  { code: 'USD', marks: ['US$', 'USD', '$', 'Dollars', 'Dollar'] },
  { code: 'EUR', marks: ['€', 'EUR', 'Euros', 'Euro'], decimalComma: true },
  { code: 'GBP', marks: ['£', 'GBP', 'Pounds'] },
  { code: 'JPY', marks: ['¥', 'JPY', 'Yen'] },
  { code: 'CNY', marks: ['CNY', 'RMB', '元'] },
  { code: 'AED', marks: ['AED', 'Dhs', 'Dh', 'Dirhams', 'Dirham', 'د.إ'] },
  { code: 'SAR', marks: ['SAR', 'Riyals', 'Riyal', 'SR'] },
  { code: 'QAR', marks: ['QAR', 'QR'] },
  { code: 'KWD', marks: ['KWD', 'KD'] },
  { code: 'BHD', marks: ['BHD', 'BD'] },
  { code: 'OMR', marks: ['OMR'] },
  { code: 'SGD', marks: ['S$', 'SGD'] },
  { code: 'MYR', marks: ['RM', 'MYR'] },
  { code: 'AUD', marks: ['A$', 'AU$', 'AUD'] },
  { code: 'CAD', marks: ['C$', 'CA$', 'CAD'] },
  { code: 'NZD', marks: ['NZ$', 'NZD'] },
  { code: 'HKD', marks: ['HK$', 'HKD'] },
  { code: 'CHF', marks: ['CHF', 'Fr.'] },
  { code: 'ZAR', marks: ['ZAR'] },
  { code: 'NGN', marks: ['₦', 'NGN', 'Naira'] },
  { code: 'KES', marks: ['KSh', 'KES', 'Ksh'] },
  { code: 'GHS', marks: ['GH₵', 'GHS'] },
  { code: 'EGP', marks: ['EGP', 'E£'] },
  { code: 'PHP', marks: ['₱', 'PHP', 'Php'] },
  { code: 'THB', marks: ['฿', 'THB', 'Baht'] },
  { code: 'IDR', marks: ['Rp', 'IDR'], decimalComma: true },
  { code: 'VND', marks: ['₫', 'VND'], decimalComma: true },
  { code: 'KRW', marks: ['₩', 'KRW'] },
  { code: 'BRL', marks: ['R$', 'BRL'], decimalComma: true },
  { code: 'MXN', marks: ['MX$', 'MXN'] },
  { code: 'TRY', marks: ['₺', 'TRY', 'TL'], decimalComma: true },
  { code: 'RUB', marks: ['₽', 'RUB'], decimalComma: true },
  { code: 'PLN', marks: ['zł', 'PLN'], decimalComma: true },
  { code: 'SEK', marks: ['SEK', 'kr'], decimalComma: true },
  { code: 'NOK', marks: ['NOK'], decimalComma: true },
  { code: 'DKK', marks: ['DKK'], decimalComma: true },
  { code: 'CZK', marks: ['Kč', 'CZK'], decimalComma: true },
  { code: 'HUF', marks: ['Ft', 'HUF'], decimalComma: true },
  { code: 'PKR', marks: ['PKR'] },
  { code: 'BDT', marks: ['৳', 'BDT', 'Tk'] },
  { code: 'LKR', marks: ['LKR'] },
  { code: 'NPR', marks: ['NPR'] },
];

const DECIMAL_COMMA = new Set(CURRENCIES.filter((c) => c.decimalComma).map((c) => c.code));

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const MARK_LOOKUP = new Map<string, string>();
for (const cur of CURRENCIES) for (const mark of cur.marks) MARK_LOOKUP.set(mark.toLowerCase(), cur.code);

// Longest marks first so "US$" beats "$", "Rs." beats "Rs".
const ALL_MARKS = CURRENCIES.flatMap((c) => c.marks).sort((a, b) => b.length - a.length);
const MARK_SRC = `(?:${ALL_MARKS.map(escapeRe).join('|')})`;
// Word-like marks must not glue to letters ("Rs" inside "Rsvp", "TL" inside "TLS").
const MARK_BEFORE = `(?<![A-Za-z])${MARK_SRC}(?![A-Za-z])`;
// No whitespace inside a number: "140\n140" must stay two reads, not 140140.
const NUM_SRC = '\\d{1,3}(?:[.,]\\d{2,3})+(?:[.,]\\d{1,2})?|\\d+(?:[.,]\\d{1,2})?';
const MONEY_RE = new RegExp(`${MARK_BEFORE}\\s?(${NUM_SRC})(?![\\d.,])|(?<![\\d.,])(${NUM_SRC})\\s?${MARK_BEFORE}`, 'gi');
const MARK_ANY_RE = new RegExp(MARK_BEFORE, 'gi');

function currencyOfMark(mark: string) {
  return MARK_LOOKUP.get(String(mark || '').toLowerCase()) || '';
}

const CODE_LIST = 'USD|EUR|GBP|AED|SGD|MYR|AUD|CAD|JPY|CNY|SAR|QAR|KWD|BHD|OMR|HKD|NZD|CHF|ZAR|NGN|KES|GHS|EGP|PHP|THB|IDR|VND|KRW|BRL|MXN|TRY|RUB|PLN|SEK|NOK|DKK|CZK|HUF|PKR|BDT|LKR|NPR|INR';
const CODE_AFTER = new RegExp(`^\\s?(${CODE_LIST})\\b`);
const CODE_WORD = new RegExp(`\\b(${CODE_LIST})\\b`);
/** Apps that print "Rs" for a rupee that is not Indian. */
const RS_CUES: Array<[RegExp, string]> = [
  [/\b(jazzcash|easypaisa|pkr|pakistan|karachi|lahore)\b/i, 'PKR'],
  [/\b(esewa|khalti|npr|nepal|kathmandu)\b/i, 'NPR'],
  [/\b(lkr|sri lanka|colombo|frimi|genie)\b/i, 'LKR'],
];

type MoneyHit = { value: number; currency: string; index: number; text: string };

/** Every "mark number" / "number mark" occurrence in a string, with the resolved currency. */
function moneyHits(text: string, currencyHint: string): MoneyHit[] {
  const out: MoneyHit[] = [];
  MONEY_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = MONEY_RE.exec(text))) {
    const markText = (m[0].match(MARK_ANY_RE) || [''])[0];
    let currency = currencyOfMark(markText) || currencyHint;
    const after = text.slice(m.index + m[0].length, m.index + m[0].length + 5).match(CODE_AFTER);
    if (after) currency = after[1]; // "$45.00 CAD"
    const value = parseAmountToken(m[1] || m[2], currency);
    if (value > 0) out.push({ value, currency, index: m.index, text: m[0] });
  }
  return out;
}

/** Numeric token → value. Handles 1,234.56 / 12,34,567 / 1.234,56 / 1 234,56 / 12,50. */
export function parseAmountToken(raw: string, currency = 'INR'): number {
  const tok = String(raw || '').trim().replace(/\s+/g, '');
  if (!tok || !/^\d[\d.,]*$/.test(tok)) return 0;
  const euStyle = DECIMAL_COMMA.has(currency);
  let value = NaN;
  if (/^\d+$/.test(tok)) {
    value = Number(tok);
  } else if (/^\d+,\d{1,2}$/.test(tok)) {
    // 12,50 / 9,90 → decimal comma. Thousands groups are always 3 digits at the end ("1,54,010").
    value = Number(tok.replace(',', '.'));
  } else if (/^\d{1,3}(?:,\d{2})*,\d{3}(?:\.\d{1,2})?$/.test(tok)) {
    // 1,234.56 or Indian 12,34,567.00 — comma groups (last group 3 digits), dot decimals.
    value = Number(tok.replace(/,/g, ''));
  } else if (/^\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?$/.test(tok)) {
    // 1.234.567,89 — dot groups, comma decimals. A lone "1.234" with 3 decimals is a group too.
    value = Number(tok.replace(/\./g, '').replace(',', '.'));
  } else if (/^\d+\.\d{1,2}$/.test(tok)) {
    value = Number(tok);
  } else if (/^\d+,\d{3}$/.test(tok) && euStyle) {
    value = Number(tok.replace(',', ''));
  } else {
    return 0;
  }
  return Number.isFinite(value) && value >= 0 ? value : 0;
}

// ---------------------------------------------------------------------------
// Amount in words
// ---------------------------------------------------------------------------

const SMALL: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17,
  eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fourty: 40, fifty: 50, sixty: 60,
  seventy: 70, eighty: 80, ninety: 90,
};
const SCALE: Record<string, number> = {
  hundred: 100, thousand: 1000, lakh: 100000, lakhs: 100000, lac: 100000, lacs: 100000,
  crore: 10000000, crores: 10000000, million: 1000000, billion: 1000000000,
};

export function wordsToNumber(words: string): number {
  const tokens = String(words || '').toLowerCase().replace(/-/g, ' ').replace(/[^a-z\s]/g, ' ').split(/\s+/).filter(Boolean);
  let total = 0;
  let current = 0;
  let seen = false;
  for (const t of tokens) {
    if (t === 'and' || t === 'only' || t === 'rupees' || t === 'rupee' || t === 'dollars' || t === 'euros') continue;
    if (t in SMALL) {
      current += SMALL[t];
      seen = true;
    } else if (t === 'hundred') {
      current = (current || 1) * 100;
      seen = true;
    } else if (t in SCALE) {
      total += (current || 1) * SCALE[t];
      current = 0;
      seen = true;
    } else {
      return seen ? total + current : 0;
    }
  }
  return seen ? total + current : 0;
}

// Linear-time: plain character classes only (a nested `(?:[a-z]+\s*)+` form backtracks for minutes on OCR text).
const WORDS_RE = /\b(?:rupees?|inr|rs\.?|dollars?|euros?|pounds?)\s+([a-z][a-z\s-]{2,120}?)\s+(?:only|rupees?|dollars?)\b|\b([a-z][a-z\s-]{2,120}?)\s+(?:rupees?|dollars?|euros?)\s+only\b/i;

/** "Rupees Eight Hundred Only" → 800; also "Eight Hundred Rupees Only". 0 when absent. */
export function amountInWords(text: string): number {
  const m = String(text || '').match(WORDS_RE);
  if (!m) return 0;
  const body = (m[1] || m[2] || '').replace(/\s+(?:only|rupees?|dollars?|euros?)$/i, '');
  const value = wordsToNumber(body);
  return value > 0 && value < 100_000_000 ? value : 0;
}

// ---------------------------------------------------------------------------
// Lines
// ---------------------------------------------------------------------------

const LABEL_SPLIT = /\s+(?=(?:paid\s*to|sent\s*to|you paid|debited from|paid from|received from|credited to|credited from|money received|transaction successful|payment successful|from\s*:|to\s*:|message|available balance)\b)/gi;

type Frag = { text: string; labelStart: boolean };

const MONEY_SPLIT_RE = new RegExp(`(${MARK_BEFORE}\\s?(?:${NUM_SRC})(?:\\s?(?:${CODE_LIST})\\b)?|(?<![\\d.,])(?:${NUM_SRC})\\s?${MARK_BEFORE})(?![\\d.,])`, 'gi');
const MARK_TAIL_RE = new RegExp(`${MARK_SRC}\\s*$`, 'i');

/**
 * Share/OCR often arrives as one paragraph. Labels and money tokens become their own lines.
 * `labelStart` is true for an original line start or a fragment cut at a label ("Paid to …") —
 * a fragment cut at a money token ("… to Sarah Lee via GCash") is mid-sentence, not a "To" label.
 */
function explodeLines(raw: string): Frag[] {
  const out: Frag[] = [];
  const text = String(raw || '')
    .replace(/\r/g, '')
    .replace(/\u00a0/g, ' ')
    .replace(/^\s*fr[o0](?:m|rn|tn|mn)\s*[:\-]?\s+/gim, 'From: ')
    .replace(/^\s*t0\s*[:\-]?\s+/gim, 'To: ');
  for (const original of text.split('\n')) {
    for (const labelPart of original.replace(LABEL_SPLIT, '\n').split('\n')) {
      let part = labelPart.replace(MONEY_SPLIT_RE, '\n$1\n');
      // Bare numbers become their own line — except masked account / card / reference tails ("Card XXXX 1367")
      // and numbers that directly follow a currency word ("INR 120" is one token).
      part = part.replace(/(\s)(?!20\d{2}\b)(\d{3,7}(?:\.\d{1,2})?)(?=\s|$)/g, (match, _ws: string, digits: string, offset: number, whole: string) => {
        const before = whole.slice(Math.max(0, offset - 24), offset);
        if (/(?:x{2,}|\*{2,}|card|a\/c|acct?|account|no\.?|ref|id|utr|rrn|txn|pin|otp|-|ending|ends|last|invoice|order|bill|receipt)\s*$/i.test(before)) return match;
        if (MARK_TAIL_RE.test(before)) return match;
        if (NOTE_ANYWHERE.test(whole.slice(0, offset))) return match; // "Reference: invoice 2201" stays whole
        return `\n${digits}\n`;
      });
      // PhonePe/Paytm party row: "PUJARI BADRINATH 1" when OCR drops ₹. 3–7 digits already split above.
      part = part.replace(/([A-Za-z\u00C0-\u024F][A-Za-z\u00C0-\u024F .,'-]{1,48})\s+([1-9]\d?)(?=\s|$)/g, (match, name: string, num: string, offset: number, whole: string) => {
        if (/\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec|ref|id|utr|rrn|txn|upi|pin|otp|no)\b/i.test(name)) return match;
        if (/\d{1,2}:\d{2}/.test(whole)) return match;
        if (/(?:x{2,}|\*{2,}|card|a\/c|acct?|account|no\.?|ref|id|utr|rrn|txn|pin|otp|ending|invoice|order|bill)\s*$/i.test(whole.slice(Math.max(0, offset - 24), offset))) return match;
        return `${name}\n${num}`;
      });
      part.split('\n').forEach((piece, idx) => {
        const clean = piece.replace(/\s+/g, ' ').trim();
        if (clean) out.push({ text: clean, labelStart: idx === 0 });
      });
    }
  }
  return out;
}

export function explodeReceiptText(raw: string) {
  return explodeLines(raw).map((f) => f.text).join('\n');
}

function idsContain(raw: string, digits: string) {
  if (!digits || digits.length < 3) return false;
  const src = String(raw || '');
  const ids = src.match(/\d{9,}/g) || [];
  if (ids.some((id) => id !== digits && id.endsWith(digits))) return true;
  // OCR splits a 12-digit UTR ("200567200" / "956"). Do not join a complete UTR to the amount.
  const nums = src.match(/\d{3,}/g) || [];
  for (let i = 0; i < nums.length - 1; i++) {
    if (nums[i].length >= 12 || nums[i].length < 6) continue;
    const joined = nums[i] + nums[i + 1];
    if (joined.length >= 10 && joined.length <= 13 && joined !== digits && joined.endsWith(digits)) return true;
  }
  return false;
}

const CHROME_LINE = /^(?:transaction successful|payment successful|paid successfully|money received|phonepe|gpay|google pay|paytm|bhim|upi|payment details|view details|share receipt|done|check balance|pay again|split expense|split this payment|send again|view history|contact phonepe support|powered by|resend sms|e transfer details|transfer details|bill details|payment history|banking na\.{0,3}|installed|open|share|hide|home|scan|filter|f[il]+ter|invest|pay bill|help|view all|mark as read|messages?|learn more|see more|refresh score|buy now|apply now|enroll now|ask chatgpt|use this selection|disclaimer.*|due|total|amount|paid|fuel|edit|entertainment|now|scratch)$/i;

function isJunk(value: string) {
  const text = String(value || '').trim();
  if (!text) return true;
  if (CHROME_LINE.test(text)) return true;
  if (/^[A-Z]{1,2}$/.test(text)) return true; // avatar initials "MK", "TV"
  if (/\.(jpe?g|png|webp|heic|pdf)\b/i.test(text)) return true;
  if (/^(?:img|image|screenshot|whatsapp|scan|photo|receipt)[-_ ]?\d/i.test(text)) return true;
  if (/^(fuel(\s+edit)?|edit|entertainment|now|scratch|joymet video)$/i.test(text)) return true;
  if (/^(chatgpt|openai|upgrad|pwc|nsdc|adobe acrobat reader|vivo|samsung|oneplus|realme|oppo|xiaomi|amazon pay|amazon|flipkart|whatsapp pay|cred|mobikwik|freecharge|bharatpe)$/i.test(text)) return true;
  // Payment app / wallet headers — the app is never the counterparty.
  if (/^(monzo|revolut|starling|wise|n26|bizum|tikkie|zelle|venmo|cash app|paypal|stripe|square|apple pay|google pay|gpay|paynow|gcash|gopay|momo|mtn momo|bkash|jazzcash|easypaisa|esewa|khalti|paypay|wechat pay|alipay|opay|pix|pix enviado|stc pay|touch 'n go ewallet|touch n go|promptpay|interac|interac e-transfer|m-pesa|mpesa|commbank|anz|bbva|fnb|cib|qnb|adcb|emirates nbd|dbs|ocbc|uob|maybank|hsbc hk|hsbc uk|barclays|lloyds|natwest|chase|amex|wells fargo|bank of america|citi|sepa überweisung|sepa|faster payment|send money successful|transfer successful|payment successful|payment made|money sent)$/i.test(text)) return true;
  if (/^(sbi|hdfc|icici|axis|kotak|yes bank|canara|pnb|bob|union bank|hsbc|idfc(?: first)?|indusind|federal|rbl|au small|bandhan)(?:\s+bank)?(?:\s+[a-z]{2})?(?:\s*[-–]?\s*x*\d{3,4})?:?$/i.test(text)) return true;
  if (/^(?:USD|EUR|GBP|AED|SGD|MYR|AUD|CAD|JPY|CNY|SAR|QAR|INR|PHP|THB|IDR|VND|KRW|BRL|MXN|ZAR|NGN|KES|GHS|EGP|PKR|BDT|LKR|NPR|Rs\.?|Tk|Ksh|Rp|RM)$/i.test(text)) return true;
  if (/^(?:vm|ad|jd|bp|ax|hp|jm|bz|tm|vk)-[a-z]{4,8}(?:-[a-z])?(?:\s+now)?$/i.test(text)) return true; // SMS sender ids
  if (/^\d{1,2}:\d{2}(?:\s|$)/.test(text)) return true; // status-bar clock
  if (/^(sent|paid|received)\s+(?:rs\.?|inr|₹)/i.test(text)) return true; // notification preview
  if (/…|\.{3}$/.test(text)) return true; // truncated UI label
  return false;
}

function cleanParty(value: string) {
  let text = String(value || '').replace(/\s+/g, ' ').trim().replace(/^[ .,\-:;•·]+|[ .,\-:;•·]+$/g, '');
  // OCR of Latin names often adds a combining mark ("Narasimhulų"). Strip only Latin diacritics —
  // Devanagari/Arabic vowel signs live outside U+0300–U+036F and must stay.
  text = text.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  text = text.replace(/^(?:paid to|sent to|received from|debited from|credited to|from|to)\b\s*[:\-]?\s*/i, '');
  // Cut at the next field first ("… on 27/9/26", "… via UPI"), then drop money / phone / id tails.
  text = text.split(/\b(?:upi|utr|rrn|via|through|using|ref\.?|txn|tid|trxid|dated|has been|was|is|gezahlt|bezahlt|debited for|from\s+(?:your|a\/c|account|my))\b|\b(?:on|at|el|le|am|pada)\s+(?=\d)|₹|\brs\.?(?=\s*\d)/i)[0]
    .trim().replace(/^[ .,\-:;]+|[ .,\-:;]+$/g, '');
  text = text.replace(new RegExp(`${MARK_SRC}\\s*[\\d.,]+\\s*$`, 'i'), '').trim();
  text = text.replace(/\s+\+?\d{8,15}\s*$/, '').trim(); // trailing phone number (M-Pesa "JOHN DOE 0712345678")
  text = text.replace(/\s+\d{1,7}(?:\.\d{1,2})?\s*$/, '').trim().replace(/^[ .,\-:;]+|[ .,\-:;]+$/g, '');
  if (text.length < 2 || /^[\d\s.,]+$/.test(text) || isJunk(text)) return '';
  if (/^rupees?\b.+\bonly\b/i.test(text)) return '';
  if (!LETTERS.test(text)) return '';
  return text.slice(0, 80);
}

/** Two letters in any script we see on receipts: Latin, Devanagari, Arabic, CJK, Kana, Hangul, Thai, Cyrillic. */
const LETTERS = /[A-Za-z\u00C0-\u024F\u0400-\u04FF\u0600-\u06FF\u0900-\u097F\u0E00-\u0E7F\u3040-\u30FF\u4E00-\u9FFF\uAC00-\uD7AF]{2,}|[\u4E00-\u9FFF]/;

const UPI_HANDLE = /(?:^|\s|:)[\w.*\-]{2,}\s?@\s?[a-z][\w]{1,20}\b/i;
const ID_LINE = /\b(utr|rrn|ref(?:erence)?\.?\s*(?:no|number|id)?|transaction id|txn(?:\s*id)?|upi ref|order id|invoice no|gstin|a\/c|account|phone|mobile|pin|otp)\b/i;
const DATE_LINE = /\b(?:\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}|\d{1,2}\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?,?\s+\d{2,4}|(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\s+\d{1,2},?\s+\d{4})\b/i;
const TIME_LINE = /\b\d{1,2}:\d{2}\s*(?:am|pm)?\b/i;
const BALANCE = /\b(available|avail\.?|avl\.?|closing|opening|ledger|current|new)\s*(?:m-?pesa\s+)?(?:bal(?:ance)?)\b|\bbalance\b|\bavl\s*bal\b|\bsaldo\b|\bsolde\b|\bkontostand\b/i;
const AD_WORDS = /\b(under|upto|up to|starting(?: at)?|gift|surprise|scratch\s*card|scratchcard|cashback|chatgpt|phones?|offer|sponsored|min\.?|minimum|popular amounts?|investment|invest|sip\b|returns?|lakh in|could have been|credit score|out of \d+|points|warranty|buy now|apply now|enroll|reward|win|won)\b/i;
const FEE_WORDS = /\b(sub\s*total|subtotal|cgst|sgst|igst|gst|vat|tax|discount|convenience|fee|charges?|tip|delivery|handling|coupon|savings?)\b/i;
const SECTION_BREAK = /\b(payment history|recent (?:payments|transactions)|transactions? history|offers?|sponsored|install(?:ed)?|buy now|learn from|enroll now|apply now|scratch\s*card|you just won|surprise|cashback|ask chatgpt|phones? under|returns calculator|popular amounts|credit score|credit report)\b/i;
/** Evidence that this text is a payment/receipt at all. Dashboards (credit score, SIP calculators) have none. */
// Words that only appear when a payment actually happened (any language). An app/bank name alone is
// not evidence — dashboards, score cards and ads mention apps without being a receipt.
const PAYMENT_VERBS = /\b(paid to|sent to|received from|debited|credited|transaction (?:successful|id|failed|details)|payment (?:successful|details|failed|received|of|made)|money received|you paid|paid successfully|upi (?:ref|id|transaction)|utr|rrn|ref\.?\s*no|txn|total|totale|totaal|gesamt|summe|montant|importe|valor|jumlah|betrag|amount paid|amount due|grand total|net payable|invoice|bill amount|order (?:id|total|no)|payment for|paid for|purchase|receipt|spent at|sent|paid|thank you|cashier|card ending|qty|change due|subtotal|completed|successful|send money|transfer|enviou|enviaste|envoyé|gezahlt|bezahlt|pagado|pagou|membayar|dibayar|nagpadala|thanh toán|chuyển tiền|zahlung|paiement|pagamento|pembayaran)\b|支払|支付|結帳|결제|\w@\w/i
const PAYMENT_APPS = /\b(monzo|revolut|starling|wise|n26|zelle|venmo|cash app|paypal|apple pay|google pay|gpay|phonepe|paytm|bhim|paynow|gcash|gopay|momo|bkash|jazzcash|esewa|paypay|wechat|alipay|opay|pix|stc pay|careem|touch 'n go|promptpay|interac|m-pesa|mpesa)\b/i
const RECEIPT_CONTEXT = { test: (s: string) => PAYMENT_VERBS.test(s) || PAYMENT_APPS.test(s) };;
const NOTE_WORD = 'message|msg|note|notes|remarks?|remark|narration|purpose|description|descrição|descripción|memo|comments?|payment for|paid for|what\'?s it for|nota|notiz|nachricht|catatan|mensaje|concepto|verwendungszweck|nội dung|keterangan';
const NOTE_LABEL = new RegExp(`^(?:(?:${NOTE_WORD})\\b|(?:for|reference|reason|ref|reference no)\\s*:)`, 'i');
const NOTE_ANYWHERE = new RegExp(`\\b(?:${NOTE_WORD}|reference|reason|for)\\s*:`, 'i');
const NOTE_INLINE = new RegExp(`\\b(?:${NOTE_WORD}|reference|reason|for)\\s*:\\s*([^\\n.;|]{2,80}?)(?=\\s*(?:[.;|\\n]|reference\\b|ref\\b|txn\\b|transaction\\b|$))`, 'i');
/** App boilerplate that sits under a "Note:" label but is not the user's note. */
const NOTE_BOILERPLATE = /\b(money has left your account|refunded within|please try|technical issue|contact (?:support|us)|terms|conditions|will be (?:refunded|credited|reversed)|do not share|never share)\b/i;

type Cand = {
  line: number;
  value: number;
  marked: boolean; // currency mark or glyph present
  glyph: '' | 'letter' | 'seven' | 'seven-needs-proof' | 'two-needs-proof';
  strong: boolean; // labelled total / amount paid
  inline: boolean; // amount on a label line ("Paid to X ₹200")
  yearish?: boolean; // bare 20xx — only trusted right under the payee block
  currency: string;
  raw: string;
};

/** Standalone-line amount token, with OCR currency-glyph handling. */
function lineToken(line: string, currencyHint: string): Cand | null {
  const t = line.trim();
  // Letter glyph in place of ₹: "Z199", "F3,075", "E200", "z400".
  let m = t.match(new RegExp(`^[ZzFfEe₹]\\s?(${NUM_SRC})$`));
  if (m) {
    const value = parseAmountToken(m[1], 'INR');
    return value ? { line: 0, value, marked: true, glyph: 'letter', strong: false, inline: false, currency: 'INR', raw: t } : null;
  }
  // "7 20,000" — mark separated by a space from a grouped number.
  m = t.match(new RegExp(`^7\\s(${NUM_SRC})$`));
  if (m && /[,.]/.test(m[1])) {
    const value = parseAmountToken(m[1], 'INR');
    return value ? { line: 0, value, marked: true, glyph: 'seven', strong: false, inline: false, currency: 'INR', raw: t } : null;
  }
  // "7800" — apps group thousands, so a comma-less 4-digit token starting with 7 is ₹ + 3 digits.
  m = t.match(/^7(\d{3})$/);
  if (m) {
    return { line: 0, value: Number(m[1]), marked: true, glyph: 'seven', strong: false, inline: false, currency: 'INR', raw: t };
  }
  // "73,075" / "71000" — could be ₹3,075 or a real 73,075. Decided later by a second read.
  m = t.match(/^7(\d{1,2}(?:,\d{2,3})+|\d{4,6})$/);
  if (m) {
    const stripped = parseAmountToken(m[1], 'INR');
    const full = parseAmountToken(t, 'INR');
    if (stripped && full) {
      return { line: 0, value: full, marked: false, glyph: 'seven-needs-proof', strong: false, inline: false, currency: currencyHint, raw: t };
    }
  }
  // ML Kit also prints ₹ as "2": ₹800 → "2800". Never auto-strip (₹2,800 is a real amount);
  // words / a second read of the inner number prove the glyph.
  m = t.match(/^2(\d{3,6})$/);
  if (m) {
    const stripped = parseAmountToken(m[1], 'INR');
    const full = parseAmountToken(t, 'INR');
    if (stripped && full && stripped !== full) {
      return { line: 0, value: full, marked: false, glyph: 'two-needs-proof', strong: false, inline: false, currency: currencyHint, raw: t };
    }
  }
  // Currency-marked token ("₹1,000", "$45.00 CAD", "45,90 €", "Rp 50.000"), or bare number.
  const marked = t.match(new RegExp(`^${MARK_BEFORE}\\s?(${NUM_SRC})(?:\\s?[A-Z]{3})?$|^(${NUM_SRC})\\s?${MARK_BEFORE}$`, 'i'));
  if (marked) {
    const hit = moneyHits(t, currencyHint)[0];
    return hit ? { line: 0, value: hit.value, marked: true, glyph: '', strong: false, inline: false, currency: hit.currency, raw: t } : null;
  }
  const bare = t.match(new RegExp(`^(${NUM_SRC})$`));
  if (bare) {
    const digits = bare[1].replace(/[^\d]/g, '');
    if (digits.length >= 10) return null; // UTR / phone
    const yearish = /^20(?:[0-4]\d)$/.test(bare[1]);
    const value = parseAmountToken(bare[1], currencyHint);
    return value ? { line: 0, value, marked: false, glyph: '', strong: false, inline: false, yearish, currency: currencyHint, raw: t } : null;
  }
  return null;
}

/** Currency-marked amount embedded in a longer line ("You paid ₹1,250", "Total Amount: $12.50"). */
const STRONG_LABEL = /\b(grand\s*total|net\s*(?:payable|amount)|amount\s*(?:payable|paid|due)|total\s*(?:amount|paid|due|ttc)?|invoice\s*value|bill\s*amount|you (?:paid|sent|spent)|paid|sent|spent|received|debited(?:\s*(?:by|with|for))?|credited(?:\s*(?:by|with|for))?|payment\s*of|amount|montant|betrag|importe|valor|jumlah|halaga|total)\b/i;

function inlineMoney(line: string, currencyHint: string): { value: number; currency: string; strong: boolean } | null {
  let best: { value: number; currency: string; strong: boolean } | null = null;
  for (const hit of moneyHits(line, currencyHint)) {
    const before = line.slice(0, hit.index);
    const strong = STRONG_LABEL.test(before) && !FEE_WORDS.test(before);
    if (!best || (strong && !best.strong)) best = { value: hit.value, currency: hit.currency, strong };
  }
  return best;
}

function detectCurrency(text: string): string {
  const counts = new Map<string, number>();
  for (const hit of moneyHits(text, '')) {
    if (hit.currency) counts.set(hit.currency, (counts.get(hit.currency) || 0) + 1);
  }
  const codeOnly = text.match(CODE_WORD);
  let best = 'INR';
  if (!counts.size) best = codeOnly ? codeOnly[1] : 'INR';
  else {
    let bestN = -1;
    for (const [code, n] of counts) {
      if (n > bestN) {
        best = code;
        bestN = n;
      }
    }
  }
  if (best === 'INR') {
    for (const [cue, code] of RS_CUES) if (cue.test(text)) return code;
  }
  return best;
}

// ---------------------------------------------------------------------------
// Resolver
// ---------------------------------------------------------------------------

const TO_LABEL = /^(paid\s*to|sent\s*to|payment\s*to|transfer(?:red)?\s+to|you (?:paid|sent)|to|pay(?:ee|ed)?\s*to|beneficiary|merchant|payee|billed to|vendor|sold by|receipt from|invoice from|bill from|order from|recipient|destinatário|empfänger|bénéficiaire|penerima|đến|kepada|untuk)(?:\b|$)/i;
const TO_STRIP = /^(paid\s*to|sent\s*to|payment\s*to|transfer(?:red)?\s+to|you (?:paid|sent)|to|pay(?:ee|ed)?\s*to|beneficiary|merchant|payee|billed to|vendor|sold by|receipt from|invoice from|bill from|order from|recipient|destinatário|empfänger|bénéficiaire|penerima|đến|kepada|untuk)\s*(?:name)?\s*[:\-]?\s*/i;
const PAYER_LABEL = /^(debited from|paid from|from|received from|credited from|money received|payer|sender|remitente|absender|expéditeur|pengirim)(?:\b|$)/i;
const PAYER_STRIP = /^(debited from|paid from|from|received from|credited from|money received|payer|sender|remitente|absender|expéditeur|pengirim)\s*[:\-]?\s*/i;
const CREDIT_LABEL = /^(credited to|deposited to|received in|to account)(?:\b|$)/i;
const CREDIT_STRIP = /^(credited to|deposited to|received in|to account)\s*[:\-]?\s*/i;
const ACCOUNT_LIKE = /^(a\/c|ac|acct|account|xx+\s*\d|x{2,}|\*{2,}|\d{4,}|bank)/i;

function looksLikePerson(line: string) {
  const name = cleanParty(line);
  if (!name) return false;
  if (UPI_HANDLE.test(line) || /@/.test(line)) return false;
  const tok = lineToken(line, 'INR');
  if (tok && !tok.yearish) return false;
  if (tok?.yearish) return false;
  if (DATE_LINE.test(line) || TIME_LINE.test(line)) return false;
  if (ID_LINE.test(line) || BALANCE.test(line)) return false;
  if (TO_LABEL.test(line) || PAYER_LABEL.test(line) || CREDIT_LABEL.test(line) || NOTE_LABEL.test(line)) return false;
  if (/^(invoice|receipt|bill|total|upi id|consumer|customer|connection|january|february|march|april|may|june|july|august|september|october|november|december|today|yesterday|successful|failed|pending)$/i.test(name)) return false;
  if (/\b(a\/c|credited with|debited from|your a\/c|has been|is credited|is debited)\b/i.test(name)) return false;
  if (ACCOUNT_LIKE.test(name)) return false;
  if (/\d{5,}/.test(name)) return false;
  return LETTERS.test(name);
}

// Sentence forms (bank SMS, Venmo/PayPal/Zelle/Revolut/M-Pesa/Pix/GoPay…):
//   "sent $250.00 to Maria Garcia", "spent £23.10 at PRET", "45,90 € an REWE gezahlt",
//   "R$ 150,00 para Maria", "Rp 50.000 ke Warung", "Sarah Lee paid you $20", "from PRIYA UPI".
// Sentence rules run on the original lines (spaces only inside a line, "\n" between lines), so " " is used, not "\s".
const S_NAME = "([^\\s\\d@][^\\n,.;:()]{1,48}?)";
const S_STOP = "(?= (?:on|for|via|ref|using|with|from|am|le|el|por|pada|noong|tarehe|txn|upi|imps|neft|at|dated|successfully|is|was|has|gezahlt|bezahlt|überwiesen|enviado|pagado|dibayar|con|mit|um|às|a las|o'clock)\\b|[.,;:()\\n]| *$)";
const S_MONEY = `(?:${MARK_BEFORE} ?(?:${NUM_SRC})(?: ?(?:${CODE_LIST})\\b)?|(?:${NUM_SRC}) ?${MARK_BEFORE})`;
const S_TO = '(?:to|an|à|a|para|kepada|untuk|ke|sa|kwa|đến|cho)';
const S_WORDS = '(?:[^\\s\\n]+ ){0,3}?';
const SENTENCE_RULES: Array<{ re: RegExp; role: 'payee' | 'payer' }> = [
  { re: new RegExp(`\\b(?:sent|paid|transferred|transfer of|payment of|pagou|pagado|enviou|enviaste|envoyé|membayar|mengirim|nagpadala|haben|hat) ${S_MONEY} ${S_TO} ${S_NAME}${S_STOP}`, 'i'), role: 'payee' },
  { re: new RegExp(`${S_MONEY} (?:sent|paid|transferred) to ${S_NAME}${S_STOP}`, 'i'), role: 'payee' },
  { re: new RegExp(`${S_MONEY} ${S_TO} ${S_NAME}${S_STOP}`, 'i'), role: 'payee' },
  { re: new RegExp(`\\b(?:spent|purchase|transaction|payment|paid|charged|charge|used) (?:of )?${S_MONEY} ${S_WORDS}(?:at|with|to|in|bei|chez|en|em|di) ${S_NAME}${S_STOP}`, 'i'), role: 'payee' },
  { re: new RegExp(`${S_MONEY} ${S_WORDS}(?:at|with) ${S_NAME}${S_STOP}`, 'i'), role: 'payee' },
  { re: new RegExp(`\\b(?:spent at|paid to|towards|purchase at|transaction with|payment to|transfer to|transferred to|sent to|debited (?:for|to|towards)) ${S_NAME}${S_STOP}`, 'i'), role: 'payee' },
  { re: new RegExp(`\\bto ${S_NAME} (?:via|through|using) (?:upi|imps|neft|paynow|zelle|pix|gcash)\\b`, 'i'), role: 'payee' },
  { re: new RegExp(`\\b(?:received|got|credited with|deposited) ${S_MONEY} (?:from|de|von|dari|mula sa|kutoka) ${S_NAME}${S_STOP}`, 'i'), role: 'payer' },
  { re: new RegExp(`\\bcredited (?:to your (?:a\\/c|account) |to (?:a\\/c|account) )?from ${S_NAME}${S_STOP}`, 'i'), role: 'payer' },
  { re: new RegExp(`${S_MONEY} (?:received|credited) from ${S_NAME}${S_STOP}`, 'i'), role: 'payer' },
  { re: new RegExp(`(?:^|\\n) *${S_NAME} (?:paid|sent) you\\b`, 'i'), role: 'payer' },
  { re: new RegExp(`\\bfrom ${S_NAME} (?:upi|imps|neft|via|on)\\b`, 'i'), role: 'payer' },
  { re: new RegExp(`\\b(?:by|via) (?:upi|imps|neft) (?:from|to) ${S_NAME}${S_STOP}`, 'i'), role: 'payer' },
];
/** Words that a sentence rule may capture but that are never a party. */
const GENERIC_PARTY = /^(card|cash|wallet|upi|bank|account|balance|your|inr|rs|the|you|a|an|my|debit card|credit card|net banking|netbanking|savings|current|cheque|checking)$/i;

/** Sentences, greetings, order/receipt headings and quantity lines are never a counterparty. */
const NOT_A_NAME = /\b(paid|sent|received|spent|transferred|made|used|charged|you|your|has been|was|is|has|thanks?|thank you|hi|hello|dear|welcome|confirmation|confirmed|successful|receipt|ticket|scontrino|order|summary|statement|riding|kamu|anda|você|voce|sie haben|has pagado|enviaste|enviou|membayar|pagado|pagou|purchase of|payment of|charge of|payment|transfer)\b|^(?:total|totale|totaal|gesamt|summe|montant|importe|valor|jumlah|betrag|amount|subtotal|sub total|grand total)\b|^\d+\s*x\b|\d+\s*x\s+\w|^[+•·-]|\bx\d+\b|完了|成功|支払|支付|결제|thành công/i;

function isNameCandidateLine(line: string) {
  return looksLikePerson(line) && !isJunk(line) && !AD_WORDS.test(line) && !SECTION_BREAK.test(line) && !NOT_A_NAME.test(line) && !FEE_WORDS.test(line);
}

/** Same rupee printed twice on a UPI success screen (party row + credited/debited row). */
function duplicatedUpiRowAmount(cands: Cand[], valuesSeen: Map<number, number>): Cand | null {
  let best: Cand | null = null;
  let bestN = 1;
  for (const c of cands) {
    if (!(c.value >= 1 && c.value < 100_000)) continue;
    if (c.yearish) continue;
    const digits = String(Math.round(c.value));
    if (digits.length > 6) continue;
    const n = valuesSeen.get(c.value) || 0;
    if (n < 2) continue;
    if (n > bestN || (n === bestN && best && ((c.marked && !best.marked) || c.line < best.line))) {
      bestN = n;
      best = c;
    }
  }
  return best;
}

export function resolveReceiptText(text: string): ResolvedReceipt {
  if (receiptTextIsGarbage(text)) {
    return { amount: 0, amountHow: 'none', currency: 'INR', payee: '', payer: '', creditedTo: '', message: '', direction: 'unknown', status: 'unknown' };
  }
  const frags = explodeLines(String(text || ''));
  const lines = frags.map((f) => f.text);
  const raw = lines.join('\n');
  /** Original lines, whitespace-normalised — sentence rules (bank SMS, wallets) must see "sent $45 to X via …" intact. */
  const flat = String(text || '').replace(/\r/g, '').replace(/\u00a0/g, ' ').split('\n')
    .map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean).join('\n');
  const currency = detectCurrency(raw);
  const hasPaymentContext = RECEIPT_CONTEXT.test(raw);
  const hasPaymentVerb = PAYMENT_VERBS.test(raw);

  // ---- status -------------------------------------------------------------
  let status: ResolvedReceipt['status'] = 'unknown';
  if (/\b(failed|declined|rejected|unsuccessful|cancelled|canceled)\b/i.test(raw)) status = 'failed';
  else if (/^refund(?:ed)?\b|\brefund (?:received|credited|processed|successful|issued)\b/im.test(raw)) status = 'refunded';
  else if (/\b(pending|processing)\b/i.test(raw) && !/\b(successful|success|completed)\b/i.test(raw)) status = 'pending';
  else if (/\b(successful|success|completed|paid successfully)\b/i.test(raw)) status = 'success';

  // ---- section break: everything after is history / ads -------------------
  let breakAt = lines.length;
  for (let i = 0; i < lines.length; i++) {
    if (SECTION_BREAK.test(lines[i]) && !/\bpaid to|sent to|received from\b/i.test(lines[i])) {
      breakAt = i;
      break;
    }
  }

  // ---- parties ------------------------------------------------------------
  let payee = '';
  let payer = '';
  let creditedTo = '';
  let message = '';
  let inlineAmount: { value: number; currency: string } | null = null;
  const consumed = new Set<number>();
  // Direction words are read only from receipt lines — never from app boilerplate ("will be refunded within 9 days").
  const directionText = lines.filter((l) => !NOTE_BOILERPLATE.test(l)).join('\n');
  const moneyIn = /\b(received from|money received|credited to|credited from|credited with|received in|payment received|you received|you got|paid you|sent you|deposited|incoming|money in|recebeu|erhalten|reçu|menerima)\b|^refund(?:ed)?\b|\brefund (?:received|credited|processed|successful|issued)\b/im.test(directionText);

  const takeName = (start: number, maxLook = 4): { name: string; idx: number } => {
    for (let j = start; j < Math.min(lines.length, start + maxLook); j++) {
      if (consumed.has(j)) continue;
      const cand = lines[j];
      if (NOTE_LABEL.test(cand) && cleanParty(cand.replace(NOTE_LABEL, '').replace(/^[\s:\-–]+/, '')) === '') continue; // empty "Message" label between
      if (isJunk(cand) || DATE_LINE.test(cand) || TIME_LINE.test(cand)) continue; // OCR column order puts status/date first
      if (isNameCandidateLine(cand)) return { name: cleanParty(cand), idx: j };
      break;
    }
    return { name: '', idx: -1 };
  };

  for (let i = 0; i < lines.length; i++) {
    if (consumed.has(i)) continue;
    const line = lines[i];
    // Below the receipt block (payment history, offers) labels belong to other transactions.
    if (i >= breakAt && (NOTE_LABEL.test(line) || payee || payer)) continue;
    if (NOTE_LABEL.test(line)) {
      const rest = line.replace(NOTE_LABEL, '').replace(/^[\s:\-–]+/, '').trim();
      if (NOTE_BOILERPLATE.test(line) || NOTE_BOILERPLATE.test(lines[i + 1] || '')) {
        consumed.add(i);
        continue;
      }
      if (rest && !lineToken(rest, currency) && !UPI_HANDLE.test(rest)) {
        // "cottage weekend. Reference AB1000." → the note ends at the sentence / next field.
        message = rest.split(/[.;|]\s|\s(?:reference|ref\.?|txn|transaction id|utr|trxid)\b/i)[0].trim().slice(0, 160);
        consumed.add(i);
      } else if (!rest) {
        // Content is on the next line unless that line is really the payee (OCR reorders columns).
        const nxt = lines[i + 1] || '';
        const nxt2 = lines[i + 2] || '';
        const nextIsName = isNameCandidateLine(nxt) && (UPI_HANDLE.test(nxt2) || (!payee && TO_LABEL.test(lines[i - 1] || '')));
        if (nxt && !consumed.has(i + 1) && !nextIsName && !isJunk(nxt) && !lineToken(nxt, currency) && !UPI_HANDLE.test(nxt) && !ID_LINE.test(nxt) && !DATE_LINE.test(nxt)
          && !TO_LABEL.test(nxt) && !PAYER_LABEL.test(nxt) && !CREDIT_LABEL.test(nxt)) {
          message = nxt.slice(0, 160);
          consumed.add(i + 1);
        }
        consumed.add(i);
      }
      continue;
    }
    // A bare "to …" is only a label at a line/label start — "… $45 to Sarah via GCash" fragments are sentences.
    if (TO_LABEL.test(line) && !/^to(?:day|tal|wards)\b/i.test(line) && (frags[i].labelStart || !/^to\b/i.test(line))) {
      // Paytm "Sold by JoyMet" is a marketplace tag. The counterparty is the To: line.
      if (/^sold by\b/i.test(line) && !/\b(tax invoice|gstin|gst)\b/i.test(raw)) {
        consumed.add(i);
        continue;
      }
      const rest = line.replace(TO_STRIP, '').trim();
      const money = inlineMoney(line, currency);
      const name = cleanParty(rest.replace(MONEY_RE, '').replace(/^\s*(?:[A-Z]{3}\b)?\s*(?:to|an|à|a|para|kepada|untuk|ke|sa|kwa)\s+/i, '').replace(/[,\-–]\s*$/, ''));
      consumed.add(i);
      if (name && !ACCOUNT_LIKE.test(name)) payee = name;
      else if (!rest || !name) {
        const got = takeName(i + 1);
        if (got.name && !ACCOUNT_LIKE.test(got.name)) {
          payee = got.name;
          consumed.add(got.idx);
        }
      }
      if (money && /^(paid|sent|you paid|payment)/i.test(line)) inlineAmount = { value: money.value, currency: money.currency };
      continue;
    }
    if (PAYER_LABEL.test(line)) {
      const rest = line.replace(PAYER_STRIP, '').trim();
      const name = cleanParty(rest.replace(MONEY_RE, ''));
      consumed.add(i);
      if (name && !ACCOUNT_LIKE.test(name)) payer = name;
      else {
        const got = takeName(i + 1);
        if (got.name && !ACCOUNT_LIKE.test(got.name)) {
          payer = got.name;
          consumed.add(got.idx);
        }
      }
      continue;
    }
    if (CREDIT_LABEL.test(line)) {
      const rest = line.replace(CREDIT_STRIP, '').trim();
      const name = cleanParty(rest.replace(MONEY_RE, ''));
      consumed.add(i);
      if (name && !ACCOUNT_LIKE.test(name)) creditedTo = name;
      else {
        const got = takeName(i + 1);
        if (got.name && !ACCOUNT_LIKE.test(got.name)) {
          creditedTo = got.name;
          consumed.add(got.idx);
        }
      }
      continue;
    }
  }

  // UPI-handle anchor: the person line right above "xxx@bank" is the counterparty when
  // none is labelled yet, or when an earlier "To:" grabbed a marketplace chip ("Meesho").
  // Never overwrite a real From:/To: party with the Paytm note sitting above the VPA.
  const CHIP_PARTY = /^(meesho|myntra|flipkart|amazon|ajio|nykaa|shopify)$/i;
  for (let i = 0; i < Math.min(lines.length, breakAt + 1); i++) {
    if (!UPI_HANDLE.test(lines[i])) continue;
    for (let j = i - 1; j >= Math.max(0, i - 3); j--) {
      if (isJunk(lines[j])) continue;
      if (isNameCandidateLine(lines[j])) {
        const name = cleanParty(lines[j]);
        if (!name || ACCOUNT_LIKE.test(name)) break;
        if (message && name.toLowerCase() === message.toLowerCase()) break;
        if (moneyIn) {
          if (!payer || CHIP_PARTY.test(payer)) payer = name;
        } else if (!payee || CHIP_PARTY.test(payee)) {
          payee = name;
        }
        consumed.add(j);
        break;
      }
      if (TO_LABEL.test(lines[j]) || PAYER_LABEL.test(lines[j])) continue;
      break;
    }
    if (payee || payer) break;
  }
  if (!moneyIn && /playstore[^@\s]*@/i.test(raw)) {
    payee = 'Google Asia Pacific Pte Ltd';
  }

  // Paytm layout: free-text note between the amount and the "From:" / "To:" party lines.
  // Must run before the unlabeled name+amount fallback so the note is never the merchant.
  if (!message) {
    for (let i = 1; i < Math.min(lines.length, breakAt) - 1; i++) {
      const nxt = lines[i + 1];
      if (!/^(from|to)\s*:/i.test(nxt)) continue;
      const line = lines[i];
      if (consumed.has(i) || isJunk(line) || lineToken(line, currency) || inlineMoney(line, currency)) break;
      if (UPI_HANDLE.test(line) || DATE_LINE.test(line) || TIME_LINE.test(line) || ID_LINE.test(line) || /^rupees?\b/i.test(line)) break;
      if (TO_LABEL.test(line) || PAYER_LABEL.test(line) || CREDIT_LABEL.test(line) || NOTE_LABEL.test(line)) break;
      if (!/[A-Za-z]{2,}/.test(line) || line.length > 60) break;
      const prevIsAmount = Boolean(lineToken(lines[i - 1], currency) || inlineMoney(lines[i - 1], currency) || /^rupees?\b/i.test(lines[i - 1]));
      if (prevIsAmount) {
        message = line.slice(0, 160);
        consumed.add(i);
      }
      break;
    }
  }

  // Paytm money-in: note often sits between the sender block and "To:" (not under the amount).
  if (!message && moneyIn && payer) {
    for (let i = 0; i < Math.min(lines.length, breakAt); i++) {
      if (!/^to\s*:/i.test(lines[i])) continue;
      for (let j = i - 1; j >= Math.max(0, i - 5); j--) {
        const line = lines[j];
        if (UPI_HANDLE.test(line) || isJunk(line) || DATE_LINE.test(line) || TIME_LINE.test(line) || ID_LINE.test(line)) continue;
        if (TO_LABEL.test(line) || PAYER_LABEL.test(line) || CREDIT_LABEL.test(line) || NOTE_LABEL.test(line)) break;
        if (lineToken(line, currency) || inlineMoney(line, currency) || /^rupees?\b/i.test(line)) break;
        if (cleanParty(line).toLowerCase() === payer.toLowerCase()) break;
        if (!/[A-Za-z]{2,}/.test(line) || line.length > 60) continue;
        message = line.slice(0, 160);
        consumed.add(j);
        break;
      }
      break;
    }
  }

  // Person line followed by an amount (GPay "Rahul Kumar / ₹250", POS "Tesco Express / Total £12.50"). Only in a real receipt.
  if (!payee && !payer && hasPaymentContext) {
    for (let i = 0; i < Math.min(lines.length, breakAt); i++) {
      if (consumed.has(i) || !isNameCandidateLine(lines[i])) continue;
      // Money within the next three lines (a "Total" label line or a greeting may sit in between).
      // A bare number (no currency mark) only counts when a payment sentence exists somewhere.
      let hit = false;
      for (let j = i + 1; j <= i + 3 && j < lines.length; j++) {
        const nx = lines[j];
        const tok = lineToken(nx, currency);
        if ((tok && (tok.marked || hasPaymentVerb)) || inlineMoney(nx, currency) || UPI_HANDLE.test(nx)) { hit = true; break; }
        if (isNameCandidateLine(nx)) break; // another name is closer to the money than this one
      }
      if (hit) {
        const name = cleanParty(lines[i]);
        if (message && name.toLowerCase() === message.toLowerCase()) continue;
        if (moneyIn) payer = name;
        else payee = name;
        consumed.add(i);
        break;
      }
    }
  }

  const counterpartyMissing = () => (moneyIn ? !payer : !payee);

  // Sentence forms (bank SMS, Venmo/PayPal/Zelle/Revolut/M-Pesa/Pix/GoPay…):
  //   "sent $250.00 to Maria Garcia", "spent £23.10 at PRET", "45,90 € an REWE gezahlt",
  //   "R$ 150,00 para Maria", "Rp 50.000 ke Warung", "Sarah Lee paid you $20", "from PRIYA UPI".
  if (counterpartyMissing()) {
    for (const rule of SENTENCE_RULES) {
      const m = flat.match(rule.re) || raw.match(rule.re);
      const party = cleanParty(m?.[1] || '');
      if (!party || ACCOUNT_LIKE.test(party) || GENERIC_PARTY.test(party) || /^(your|inr|rs|the|you|a|an|my)\b/i.test(party) || NOT_A_NAME.test(party)) continue;
      if (rule.role === 'payer') {
        payer = party;
        if (!payee) break;
      } else {
        payee = party;
      }
      // "You sent $45.00 to Sarah Lee": the money inside the same sentence is the transaction amount.
      // For SMS one-liners the party clause may sit after the money ("Rs 2,150 debited … to RAHUL via UPI"):
      // then the single money token on that same line is the amount.
      let inSentence = moneyHits(m?.[0] || '', currency)[0];
      if (!inSentence && m && typeof m.index === 'number') {
        const src = flat.match(rule.re) ? flat : raw;
        const start = src.lastIndexOf('\n', m.index) + 1;
        const endIdx = src.indexOf('\n', m.index);
        const hits = moneyHits(src.slice(start, endIdx < 0 ? src.length : endIdx), currency).filter((h) => !BALANCE.test(src.slice(start, start + h.index)));
        if (hits.length === 1) inSentence = hits[0];
      }
      if (inSentence && !inlineAmount) inlineAmount = { value: inSentence.value, currency: inSentence.currency };
      break;
    }
    if (/\b(paid|sent)\s+you\b/i.test(raw) && payer && !payee) payee = '';
  }

  // Header fallback: POS receipts and app statements name the business on the first line ("Tesco Express", "Uber").
  if (!payee && !payer && hasPaymentVerb) {
    for (let i = 0; i < Math.min(lines.length, 3); i++) {
      if (consumed.has(i) || !isNameCandidateLine(lines[i])) continue;
      if (/^(you|your|hi|hello|dear|thank)\b/i.test(lines[i])) continue;
      if (moneyIn) payer = cleanParty(lines[i]);
      else payee = cleanParty(lines[i]);
      break;
    }
  }

  // Money-in: if From: was missed, any remaining person line that is not self is the sender.
  if (moneyIn && !payer) {
    const banned = new Set([payee, creditedTo, message].map((row) => String(row || '').toLowerCase()).filter(Boolean));
    for (let i = 0; i < Math.min(lines.length, breakAt); i++) {
      if (consumed.has(i) || !isNameCandidateLine(lines[i])) continue;
      const name = cleanParty(lines[i]);
      if (!name || banned.has(name.toLowerCase()) || ACCOUNT_LIKE.test(name)) continue;
      payer = name;
      consumed.add(i);
      break;
    }
  }

  // ---- amount candidates --------------------------------------------------
  const cands: Cand[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (ID_LINE.test(line) && !/total|amount/i.test(line)) continue;
    if (DATE_LINE.test(line) && !moneyHits(line, currency).length) continue;
    if (/^\d{1,2}:\d{2}/.test(line)) continue;
    if (/%|\/\s*day\b|\bx\d\b|^\+?\d{10,}$/i.test(line)) continue;
    const tok = lineToken(line, currency);
    if (tok) {
      // A bare number after a "Message" label is note text, not money.
      if (consumed.has(i) && message && line === message) continue;
      // Ungrouped 7+ digit runs on UPI pages are UTR / txn ids, not rupees.
      const digits = String(Math.round(tok.value));
      if (!tok.marked && !tok.strong && digits.length >= 7) continue;
      if (!tok.marked && !tok.strong && idsContain(String(text || ''), digits)) continue;
      const prevLine = lines[i - 1] || '';
      if (!tok.marked && !tok.strong && digits.length <= 4 && /^\s*(utr|rrn)\b/i.test(prevLine)) {
        const prevId = (prevLine.match(/\d{6,}/) || [])[0] || '';
        if (!prevId || prevId.endsWith(digits)) continue;
      }
      cands.push({ ...tok, line: i });
      continue;
    }
    const inl = inlineMoney(line, currency);
    if (inl) cands.push({ line: i, value: inl.value, marked: true, glyph: '', strong: inl.strong, inline: true, currency: inl.currency, raw: line });
  }
  // Label on one line, value on the next ("Total Amount" / "₹3,075").
  for (let i = 0; i + 1 < lines.length; i++) {
    if (/^(grand\s*total|net\s*(?:payable|amount)|amount(?:\s*(?:payable|paid|due))?|total\s*(?:amount|paid|due|ttc)?|invoice\s*value|bill\s*amount)\s*[:\-]?$/i.test(lines[i])) {
      const c = cands.find((x) => x.line === i + 1);
      if (c) c.strong = true;
    }
  }

  // Second-read proof for "7X" / "2X" rupee-glyph tokens: the stripped value exists elsewhere.
  const valuesSeen = new Map<number, number>();
  for (const c of cands) valuesSeen.set(c.value, (valuesSeen.get(c.value) || 0) + 1);
  const words = amountInWords(raw);
  for (const c of cands) {
    if (c.glyph !== 'seven-needs-proof' && c.glyph !== 'two-needs-proof') continue;
    const stripped = parseAmountToken(c.raw.slice(1), 'INR');
    const proven = (valuesSeen.get(stripped) || 0) > 0 || (words > 0 && words === stripped);
    if (proven) {
      c.value = stripped;
      c.marked = true;
      c.glyph = 'seven';
      c.currency = 'INR';
    }
  }
  valuesSeen.clear(); // recount after "7X" proofs changed values
  for (const c of cands) valuesSeen.set(c.value, (valuesSeen.get(c.value) || 0) + 1);

  // ---- scoring ------------------------------------------------------------
  // Line that names the counterparty — its own line ("Sarah Lee") or inside a sentence ("You paid Sarah Lee").
  // An amount right under it is structurally the transaction amount (after_payee), whatever the layout.
  const party = (moneyIn ? payer : payee) || payee || payer;
  const partyLower = party.toLowerCase();
  const payeeLine = party
    ? lines.findIndex((l) => cleanParty(l) === party || (l.length <= party.length + 40 && l.toLowerCase().includes(partyLower)))
    : -1;
  const handleLine = lines.findIndex((l) => UPI_HANDLE.test(l));
  // An amount under the party wins over one above it; the "above" form only counts when nothing follows.
  const hasAmountAfterParty = payeeLine >= 0 && cands.some((x) => x.line > payeeLine && x.line - payeeLine <= 4
    && !BALANCE.test(lines[x.line]) && !BALANCE.test(lines[x.line - 1] || ''));
  let best: Cand | null = null;
  let bestScore = -Infinity;
  let bestHow: ReceiptAmountHow = 'none';
  for (const c of cands) {
    const line = lines[c.line];
    const prev = lines[c.line - 1] || '';
    const next = lines[c.line + 1] || '';
    if (!(c.value > 0 && c.value < 50_000_000)) continue;
    if (!c.marked && !hasPaymentVerb) continue; // a bare number needs a real payment sentence around it
    if (BALANCE.test(line) || BALANCE.test(prev)) continue;
    let score = 0;
    // A currency-marked token is evidence on its own; a bare digit run is only confirmed by a second
    // read of the same number (OCR prints the amount twice: header + detail) or the amount in words.
    const secondRead = (valuesSeen.get(c.value) || 0) > 1 || (words > 0 && c.value === words);
    let how: ReceiptAmountHow = c.marked || secondRead ? 'currency' : 'bare';
    if (c.strong) {
      score += 90;
      how = 'labeled';
    } else if (c.inline) {
      score += 70;
      how = /^(paid to|sent to|you paid|paid|sent)\b/i.test(line) ? 'paid_to' : 'labeled';
    } else {
      score += c.marked ? 60 : 45;
    }
    // Structure: amount right after the payee block / UPI handle, or a currency-marked amount just
    // above the party label ("₹200 / To Rahul Kumar", Paytm "₹8000 / note / From: X").
    const afterPayee = (payeeLine >= 0 && c.line > payeeLine && c.line - payeeLine <= 4)
      || (handleLine >= 0 && c.line > handleLine && c.line - handleLine <= 3)
      || (payeeLine >= 0 && c.marked && !hasAmountAfterParty && c.line < payeeLine && payeeLine - c.line <= 3);
    if (afterPayee && !c.strong && !c.inline) {
      score += 25;
      how = 'after_payee';
    }
    if (c.yearish && !afterPayee) continue; // "2025" alone is a year unless it sits under the payee
    if (c.line < breakAt) score += 10;
    else score -= secondRead ? 8 : 45;
    score += Math.max(0, 8 - Math.floor(c.line / 4)); // earlier is better
    const dup = (valuesSeen.get(c.value) || 0) - 1;
    if (dup > 0) score += 12;
    if (words > 0 && c.value === words) score += 60;
    if (c.glyph === 'seven-needs-proof') score -= 20;
    if (AD_WORDS.test(line) || AD_WORDS.test(prev) || AD_WORDS.test(next)) score -= 45;
    if (FEE_WORDS.test(line) || (FEE_WORDS.test(prev) && !/total/i.test(prev))) score -= 25;
    if (/^\+/.test(c.raw)) score -= 30;
    if (c.marked && c.currency !== currency && c.glyph === '') score -= 15;
    if (c.value < 1) score -= 50;
    // Not a receipt at all (dashboard, calculator): only a clean, unpenalised money token may count.
    if (!hasPaymentContext && score < 60) continue;
    if (score > bestScore) {
      best = c;
      bestScore = score;
      bestHow = how;
    }
  }

  let amount = best ? best.value : 0;
  let amountHow: ReceiptAmountHow = best ? bestHow : 'none';
  let amountCurrency = best ? best.currency : currency;
  if (amountCurrency === 'INR' && currency !== 'INR' && RS_CUES.some(([, code]) => code === currency)) amountCurrency = currency; // "Rs." on JazzCash = PKR
  if (inlineAmount && best && best.value === inlineAmount.value) {
    // The sentence ("You sent $45 to Sarah Lee") and the token agree — the amount is confirmed.
    amountHow = 'paid_to';
  } else if (inlineAmount && (!best || bestScore < 90)) {
    amount = inlineAmount.value;
    amountHow = 'paid_to';
    amountCurrency = inlineAmount.currency;
  }
  // Amount in words is the legal figure on Indian UPI / GST pages. OCR of the ₹ glyph
  // ("2800" for ₹800) must never beat "Rupees Eight Hundred Only", even under an Amount label.
  if (words > 0) {
    amount = words;
    amountHow = 'labeled';
    amountCurrency = 'INR';
  }

  // PhonePe/Paytm print ₹ on both the party row and the credited row. Camera OCR of a
  // phone screen dumps those right-column amounts after "View History" / "Share Receipt".
  if (/\b(received from|paid to|credited to|debited from|transaction successful|payment successful|money received)\b/i.test(raw)
    && (!(amount > 0) || (amountHow === 'bare' && (valuesSeen.get(amount) || 0) < 2))) {
    const row = duplicatedUpiRowAmount(cands, valuesSeen);
    if (row && row.value > 0) {
      amount = row.value;
      amountHow = row.marked || (valuesSeen.get(row.value) || 0) > 1 ? 'currency' : 'after_payee';
      amountCurrency = row.currency || currency;
    }
  }

  // ---- direction ----------------------------------------------------------
  let direction: ResolvedReceipt['direction'] = 'unknown';
  if (status === 'refunded' || moneyIn) direction = 'money_in';
  else if (/\b(debited|debit|spent|paid to|sent to|you paid|payment successful|paid successfully|transaction successful|sent|paid|purchase|charged|payment|send money|transfer|total|enviou|enviaste|envoyé|gezahlt|bezahlt|pagado|pagou|membayar|nagpadala|支払|支付|결제|thanh toán|chuyển tiền)\b/i.test(raw)) direction = 'money_out';

  // Note written inside a sentence ("Message: cottage weekend. Reference AB1000").
  if (!message) {
    const inl = flat.match(NOTE_INLINE);
    if (inl && !NOTE_BOILERPLATE.test(inl[1]) && !lineToken(inl[1], currency)) message = inl[1].trim().slice(0, 160);
  }

  if (direction === 'money_out' && payee && payer && payee.toLowerCase() === payer.toLowerCase()) payee = '';
  if (direction === 'money_out' && payee && creditedTo && payee.toLowerCase() === creditedTo.toLowerCase()) payee = '';
  if (message && payer && payer.toLowerCase() === message.toLowerCase()) payer = '';
  if (message && payee && payee.toLowerCase() === message.toLowerCase() && direction === 'money_in') payee = '';
  if (message && (isJunk(message) || CHROME_LINE.test(message) || NOTE_BOILERPLATE.test(message) || /^(?:[ZzFfEe₹7]\s?)?[\d.,]+$/.test(message))) message = '';

  return {
    amount,
    amountHow,
    currency: amount ? amountCurrency : currency,
    payee,
    payer,
    creditedTo,
    message,
    direction,
    status,
  };
}

/** OCR/PDF extract that is mostly binary noise — never map fields from it. */
export function receiptTextIsGarbage(text: string) {
  const s = String(text || '');
  if (s.length < 8) return false;
  let letters = 0;
  let printable = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if ((c >= 65 && c <= 90) || (c >= 97 && c <= 122) || (c >= 0x0900 && c <= 0x097F)) letters += 1;
    if (c === 10 || c === 13 || c === 9 || c === 0x20B9 || (c >= 32 && c < 127)) printable += 1;
  }
  return letters < 12 && printable / s.length < 0.55;
}

export function formatReceiptMoney(amount: number, currency = 'INR') {
  if (!(amount > 0)) return '';
  const n = Number.isInteger(amount) ? String(amount) : String(amount);
  if (currency === 'INR' || !currency) return `₹${n}`;
  return `${n} ${currency}`;
}

/** Labelled note, or a one-line meaning of the receipt when the note is missing. */
export function summarizeReceiptMeaning(resolved: ResolvedReceipt) {
  const note = String(resolved.message || '').trim();
  if (note) return note.slice(0, 140);
  const who = receiptName(resolved);
  const money = formatReceiptMoney(resolved.amount, resolved.currency);
  if (resolved.direction === 'money_in') {
    if (who && money) return `Received ${money} from ${who}`;
    if (money) return `Received ${money}`;
    if (who) return `Received from ${who}`;
    return '';
  }
  if (who && money) return `Paid ${money} to ${who}`;
  if (money) return `Paid ${money}`;
  if (who) return `Paid to ${who}`;
  return '';
}

export function receiptName(resolved: ResolvedReceipt) {
  if (resolved.direction === 'money_in') {
    const banned = new Set([resolved.payee, resolved.creditedTo].map((row) => row.toLowerCase()).filter(Boolean));
    if (resolved.payer && !banned.has(resolved.payer.toLowerCase())) return resolved.payer;
    return '';
  }
  const banned = new Set([resolved.payer, resolved.creditedTo].map((row) => row.toLowerCase()).filter(Boolean));
  if (resolved.payee && !banned.has(resolved.payee.toLowerCase())) return resolved.payee;
  return '';
}

/** Amount + counterparty are established well enough to fill the form without waiting on the server. */
export function amountIsTransactionReady(resolved: ResolvedReceipt) {
  return resolved.amount > 0
    && resolved.amountHow !== 'none' && resolved.amountHow !== 'bare'
    && Boolean(receiptName(resolved))
    && resolved.status !== 'failed';
}

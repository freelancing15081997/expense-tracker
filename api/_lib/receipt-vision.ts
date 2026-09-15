/**
 * Receipt image vision for Money share / capture.
 * Uses the same Gemini models as inbound email for reliability.
 */

export type VisionReceipt = {
  amount: number;
  date: string;
  merchant: string;
  description: string;
  category: string;
  entryType: 'in' | 'out';
  paymentMethod: string;
  notes?: string;
  engine: string;
};

function geminiKey() {
  return String(
    process.env.GEMINI_API_KEY
    || process.env.GOOGLE_GENAI_API_KEY
    || process.env.GOOGLE_API_KEY
    || process.env.GOOGLE_GENERATIVE_AI_API_KEY
    || '',
  ).trim();
}

function geminiModels() {
  const preferred = String(process.env.GEMINI_MODEL || '').trim();
  // Same list as inbound email — new AI Studio keys need 3.x Flash.
  const defaults = ['gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-flash-latest'];
  return [...new Set([preferred, ...defaults].filter(Boolean))];
}

function extractGeminiText(payload: any) {
  if (!payload) return '';
  if (typeof payload.text === 'string' && payload.text.trim()) return payload.text.trim();
  const parts = payload?.candidates?.[0]?.content?.parts;
  return (Array.isArray(parts) ? parts : [])
    .map((part: any) => String(part?.text || ''))
    .join('\n')
    .trim();
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function toAmount(raw: unknown) {
  if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0 && raw < 100_000_000) return raw;
  const cleaned = String(raw ?? '')
    .replace(/[₹$€£]/g, '')
    .replace(/\b(rs\.?|inr|usd|eur|gbp)\b/gi, '')
    .replace(/,/g, '')
    .replace(/\s+/g, '')
    .trim();
  const n = Number(cleaned);
  return Number.isFinite(n) && n > 0 && n < 100_000_000 ? n : 0;
}

function pickAmount(raw: Record<string, unknown>) {
  const candidates = [
    raw.amount,
    raw.total,
    raw.grandTotal,
    raw.grand_total,
    raw.amountPaid,
    raw.amount_paid,
    raw.netPayable,
    raw.net_payable,
  ];
  const parsed = candidates.map((c) => toAmount(c)).filter((n) => n > 0);
  if (!parsed.length) return 0;
  // If one candidate looks like a calendar day (1–31) and another is a real total, prefer the total.
  const dayish = parsed.filter((n) => Number.isInteger(n) && n <= 31);
  const solid = parsed.filter((n) => !(Number.isInteger(n) && n <= 31));
  if (dayish.length && solid.length) return solid[0];
  return parsed[0];
}

function asVision(raw: Record<string, unknown>, fallback: VisionReceipt): VisionReceipt {
  const amount = pickAmount(raw);
  const entry = String(raw.entryType || 'out').toLowerCase() === 'in' ? 'in' : 'out';
  const date = String(raw.date || '').match(/^\d{4}-\d{2}-\d{2}$/) ? String(raw.date) : fallback.date;
  const merchant = String(raw.merchant || fallback.merchant || '').trim().slice(0, 120);
  const description = String(raw.description || raw.paidFor || merchant || fallback.description || 'Shared receipt').trim().slice(0, 200);
  const category = String(raw.category || fallback.category || 'Uncategorized').trim().slice(0, 80) || 'Uncategorized';
  const paymentMethod = String(raw.paymentMethod || fallback.paymentMethod || 'cash').toLowerCase().slice(0, 32) || 'cash';
  const notes = String(raw.notes || '').trim();
  if (notes.toLowerCase() === 'not_a_receipt') {
    return { ...fallback, amount: 0, merchant: '', description: 'Shared image', notes, engine: fallback.engine };
  }
  return {
    amount,
    date,
    merchant,
    description,
    category,
    entryType: entry,
    paymentMethod: /^(cash|card|upi|bank|wallet)$/i.test(paymentMethod) ? paymentMethod : 'cash',
    notes: notes || undefined,
    engine: fallback.engine,
  };
}

async function geminiGenerate(model: string, key: string, body: Record<string, unknown>, timeoutMs: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify(body),
      },
    );
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false as const, error: String((payload as any)?.error?.message || `http_${res.status}`) };
    }
    return { ok: true as const, payload };
  } catch (err: any) {
    return {
      ok: false as const,
      error: err?.name === 'AbortError' ? 'timeout' : String(err?.message || 'request_failed'),
    };
  } finally {
    clearTimeout(timer);
  }
}

function normalizeMime(mimeType?: string, fileName?: string) {
  const mime = String(mimeType || 'image/jpeg').split(';')[0].trim().toLowerCase();
  const name = String(fileName || '').toLowerCase();
  if (mime.startsWith('image/')) return mime === 'image/jpg' ? 'image/jpeg' : mime;
  if (mime === 'application/pdf' || name.endsWith('.pdf')) return 'application/pdf';
  return 'image/jpeg';
}

/**
 * Parse a receipt / UPI / bill / handwritten note / PDF photo or document.
 * Never invents amounts — returns amount 0 if unclear.
 */
export async function parseReceiptImage(input: {
  base64: string;
  mimeType?: string;
  fileName?: string;
  hintText?: string;
  timeoutMs?: number;
}): Promise<VisionReceipt> {
  const fallback: VisionReceipt = {
    amount: 0,
    date: todayIso(),
    merchant: '',
    description: String(input.fileName || 'Shared receipt').replace(/\.[a-z0-9]+$/i, '').slice(0, 120) || 'Shared receipt',
    category: 'Uncategorized',
    entryType: 'out',
    paymentMethod: 'cash',
    engine: 'none',
  };

  const key = geminiKey();
  const rawB64 = String(input.base64 || '').replace(/^data:[^;]+;base64,/i, '').replace(/\s+/g, '');
  if (!key) {
    return { ...fallback, engine: 'missing_key', notes: 'GEMINI_API_KEY not configured on server' };
  }
  if (!rawB64 || rawB64.length < 64) {
    return { ...fallback, engine: 'empty_image' };
  }
  if (rawB64.length > 2.8 * 1024 * 1024) {
    return { ...fallback, engine: 'too_large', notes: 'File too large for vision' };
  }

  const mime = normalizeMime(input.mimeType, input.fileName);
  const hint = String(input.hintText || '').trim().slice(0, 1200);
  const timeoutMs = Math.max(12_000, Number(input.timeoutMs || 22_000));

  // Same clerk prompt style as inbound email attachments.
  const prompt = `You are Byjan's ledger clerk. Read this receipt, bill, invoice, tax invoice, UPI screenshot, bank slip, or photo.
Also use any share / OCR text context (may describe what was paid for or the amount).
Share context (may be empty): ${hint || '(none)'}
Return JSON only with keys:
amount (number), total (number), taxAmount (number), date (YYYY-MM-DD), merchant, description, paidFor, category
(Fuel, Groceries, Meals, Travel, Utilities, Health, Shopping, Software Subscriptions, or Uncategorized),
entryType (out|in), paymentMethod (cash|card|upi|bank|wallet), notes.
Rules:
- amount/total = grand total / amount paid / net payable / Paid / Sent / Debited / You paid only (the large ₹ total on UPI screens).
- NEVER use calendar day/month/year digits as amount (e.g. 26 from 26 Sep is NOT money).
- NEVER use battery %, ratings, time, UPI ref / UTR / txn id digits, order ids, or “Pay ₹5” suggestion chips.
- NEVER use masked UPI ID / VPA / account / card tails as amount (e.g. XXXXX112@oksbi, ******112, ending 112, xx112@ybl are NOT money).
- If Paid ₹X / You paid ₹X / Debited ₹X / ₹X.00 hero total is visible, amount must be X exactly.
- Prefer context wording for description when present.
- entryType=in for refunds/returns/money received; otherwise out.
- UPI apps → paymentMethod=upi.
- Never invent amounts. If no total is visible, set amount to 0.
- If this is not a financial document, set amount to 0, merchant empty, notes to "not_a_receipt".`;

  const requestBody = {
    contents: [{
      parts: [
        { text: prompt },
        { inline_data: { mime_type: mime, data: rawB64 } },
      ],
    }],
    generationConfig: {
      temperature: 0,
      responseMimeType: 'application/json',
    },
  };

  const errors: string[] = [];
  const models = geminiModels().slice(0, 3);
  let bestZero: VisionReceipt | null = null;

  for (let i = 0; i < models.length; i += 1) {
    const model = models[i];
    const perTry = Math.min(timeoutMs, i === 0 ? 22_000 : 18_000);
    const result = await geminiGenerate(model, key, requestBody, perTry);
    if (!result.ok) {
      errors.push(`${model}:${result.error}`);
      continue;
    }
    const raw = extractGeminiText(result.payload).replace(/^```json\s*|\s*```$/g, '').trim();
    if (!raw) {
      errors.push(`${model}:empty_response`);
      continue;
    }
    const jsonSlice = raw.includes('{') ? raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1) : raw;
    try {
      const parsed = asVision(JSON.parse(jsonSlice), { ...fallback, engine: `gemini:${model}` });
      if (parsed.amount > 0 || parsed.notes === 'not_a_receipt') return parsed;
      if ((parsed.merchant || parsed.description) && !bestZero) bestZero = parsed;
      errors.push(`${model}:amount_0`);
      continue;
    } catch {
      errors.push(`${model}:bad_json`);
    }
  }

  if (bestZero) return bestZero;
  return { ...fallback, engine: 'gemini-failed', notes: errors.slice(0, 4).join(' | ') };
}

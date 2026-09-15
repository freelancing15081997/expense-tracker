/**
 * Fast receipt image vision for Money share / capture.
 * Same Gemini env keys + multimodal path as inbound email.
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
  // Prefer one fast flash model first; second model only on timeout/empty.
  const defaults = ['gemini-2.0-flash', 'gemini-flash-latest', 'gemini-3.5-flash', 'gemini-3.6-flash'];
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
  for (const c of candidates) {
    const n = toAmount(c);
    if (n) return n;
  }
  return 0;
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
  const hint = String(input.hintText || '').trim().slice(0, 800);
  // Share path: one fast attempt (~8s). Second model only if first times out / empties.
  const timeoutMs = Math.max(5_000, Number(input.timeoutMs || 8_000));

  const prompt = `Extract receipt fields as JSON only:
{"amount":number,"date":"YYYY-MM-DD","merchant":"","description":"","category":"Uncategorized","entryType":"out","paymentMethod":"cash","notes":""}
${hint ? `Hint: ${hint}\n` : ''}
Rules: amount = grand total if visible else 0. Never invent. entryType=in only for refunds. notes="not_a_receipt" if not financial.`;

  const requestBody = {
    contents: [{
      parts: [
        { text: prompt },
        { inline_data: { mime_type: mime, data: rawB64 } },
      ],
    }],
    generationConfig: {
      temperature: 0,
      maxOutputTokens: 256,
      responseMimeType: 'application/json',
    },
  };

  const errors: string[] = [];
  const models = geminiModels();
  const tryModel = async (model: string, ms: number) => {
    const result = await geminiGenerate(model, key, requestBody, ms);
    if (!result.ok) {
      errors.push(`${model}:${result.error}`);
      return { retry: result.error === 'timeout' || /429|503|500/.test(result.error), parsed: null as VisionReceipt | null };
    }
    const raw = extractGeminiText(result.payload).replace(/^```json\s*|\s*```$/g, '').trim();
    if (!raw) {
      errors.push(`${model}:empty_response`);
      return { retry: true, parsed: null };
    }
    const jsonSlice = raw.includes('{') ? raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1) : raw;
    try {
      const parsed = asVision(JSON.parse(jsonSlice), { ...fallback, engine: `gemini:${model}` });
      if (parsed.amount > 0 || parsed.merchant || parsed.notes === 'not_a_receipt') {
        return { retry: false, parsed };
      }
      errors.push(`${model}:amount_0`);
      return { retry: false, parsed };
    } catch {
      errors.push(`${model}:bad_json`);
      return { retry: true, parsed: null };
    }
  };

  const first = await tryModel(models[0], Math.min(timeoutMs, 8_000));
  if (first.parsed && (first.parsed.amount > 0 || first.parsed.merchant || first.parsed.notes === 'not_a_receipt')) {
    return first.parsed;
  }
  if (first.retry && models[1]) {
    const second = await tryModel(models[1], Math.min(timeoutMs, 8_000));
    if (second.parsed) return second.parsed;
  }
  if (first.parsed) return first.parsed;

  return { ...fallback, engine: 'gemini-failed', notes: errors.slice(0, 4).join(' | ') };
}

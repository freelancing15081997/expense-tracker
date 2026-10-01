// New /api/money ops (listInbox, dismissInbox, insights, learnCorrection) and the quota/feature gate
// that wraps the existing handleMoney for processReceipt / parseCapture / nlSearch.
import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  ApiError, apiJson, withDomainApi, verifyFirebaseUser, ledgerRequireMember, ledgerListBooksForUser, ledgerListLiveExpenses, ledgerGet,
} from '../_pg-tables.js';
import { saasSql } from './saas-schema.js';
import { gateMeter, rateLimit, requireFeature, newId, refund } from './entitlements.js';

export const EXTRA_MONEY_OPS = new Set(['listInbox', 'dismissInbox', 'insights', 'learnCorrection']);
const merchantKey = (s: unknown) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().slice(0, 60);

export async function handleMoneyExtras(req: VercelRequest, res: VercelResponse) {
  await withDomainApi(req as any, res as any, async (user: { uid: string; email: string }, body: Record<string, any>) => {
    const op = String(body.op || '');
    const sql = await saasSql();

    if (op === 'listInbox') {
      const books = await ledgerListBooksForUser(user.uid);
      const visible = books.filter((b: any) => b.isMember !== false);
      const ids = visible.map((b: any) => String(b.id));
      const names = Object.fromEntries(visible.map((b: any) => [String(b.id), String(b.name || 'Book')]));
      const rows = ids.length
        ? await sql`SELECT * FROM inbox_items WHERE dismissed_at IS NULL AND done_at IS NULL AND (uid = ${user.uid} OR book_id = ANY(${ids})) ORDER BY at DESC LIMIT 100`
        : await sql`SELECT * FROM inbox_items WHERE dismissed_at IS NULL AND done_at IS NULL AND uid = ${user.uid} ORDER BY at DESC LIMIT 100`;
      apiJson(res as any, 200, { items: rows.map((r: any) => ({ id: r.id, bookId: r.book_id, bookName: names[r.book_id] || '', preview: r.preview || {}, kind: r.kind, at: new Date(r.at).toISOString() })) });
      return;
    }

    if (op === 'dismissInbox') {
      const id = String(body.id || '');
      const rows = await sql`SELECT * FROM inbox_items WHERE id = ${id}`;
      if (!rows[0]) throw new ApiError(404, 'That item is already gone.', { code: 'NOT_FOUND' });
      if (rows[0].uid !== user.uid) await ledgerRequireMember(rows[0].book_id, user.uid);
      await sql`UPDATE inbox_items SET dismissed_at = now() WHERE id = ${id}`;
      apiJson(res as any, 200, { ok: true });
      return;
    }

    if (op === 'learnCorrection') {
      const bookId = String(body.bookId || '');
      await ledgerRequireMember(bookId, user.uid);
      const before = body.before && typeof body.before === 'object' ? body.before : {};
      const after = body.after && typeof body.after === 'object' ? body.after : {};
      const key = merchantKey(after.merchant || before.merchant);
      if (key) {
        await sql`INSERT INTO capture_corrections (id, uid, book_id, capture_id, merchant_key, before, after)
          VALUES (${newId('cc_')}, ${user.uid}, ${bookId}, ${String(body.captureId || '')}, ${key}, ${JSON.stringify(before)}::jsonb, ${JSON.stringify(after)}::jsonb)`;
      }
      apiJson(res as any, 200, { ok: true });
      return;
    }

    if (op === 'insights') {
      await rateLimit(`insights:${user.uid}`, 30);
      const bookIds: string[] = Array.isArray(body.bookIds) ? body.bookIds.map(String).slice(0, 50) : [];
      for (const id of bookIds) await ledgerRequireMember(id, user.uid);
      const from = String(body.from || '').slice(0, 10); const to = String(body.to || '').slice(0, 10);
      const rows: any[] = [];
      for (const id of bookIds) for (const e of await ledgerListLiveExpenses(id)) {
        const d = String((e as any).date || (e as any).paidAt || '').slice(0, 10);
        if ((!from || d >= from) && (!to || d <= to)) rows.push(e);
      }
      if (rows.length < 3) { apiJson(res as any, 200, { insights: ['Add a few more entries and I’ll spot patterns for you.'] }); return; }
      const gate = await gateMeter(user.uid, user.email, 'ai_insights');
      try {
        const insights = await explainSpending(rows, from, to);
        apiJson(res as any, 200, { insights, usage: gate.usage });
      } catch (e) {
        await gate.undo();
        throw new ApiError(502, 'Couldn’t read your spending right now. Your count was not used.', { code: 'INSIGHTS_FAILED' });
      }
      return;
    }

    throw new ApiError(400, 'Unknown money operation');
  });
}

/** Deterministic summary → Gemini for 3–5 plain sentences. Falls back to the summary if no key. */
async function explainSpending(rows: any[], from: string, to: string) {
  const out = rows.filter((e) => String(e.entryType || e.direction || 'OUT').toUpperCase().includes('OUT') || !e.entryType);
  const byCat: Record<string, number> = {}; const byMerchant: Record<string, number> = {}; const byMethod: Record<string, number> = {};
  let total = 0;
  for (const e of out) {
    const a = Number(e.amount || 0); total += a;
    byCat[e.category || 'Other'] = (byCat[e.category || 'Other'] || 0) + a;
    byMerchant[e.merchant || 'Unknown'] = (byMerchant[e.merchant || 'Unknown'] || 0) + a;
    byMethod[e.paymentMethod || 'other'] = (byMethod[e.paymentMethod || 'other'] || 0) + a;
  }
  const top = (m: Record<string, number>, n = 5) => Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, n);
  const fmt = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;
  const fallback = [
    `You spent ${fmt(total)} across ${out.length} entries${from ? ` from ${from}` : ''}${to ? ` to ${to}` : ''}.`,
    ...top(byCat, 2).map(([c, v]) => `${c} was ${Math.round((v / Math.max(1, total)) * 100)}% of spending (${fmt(v)}).`),
    top(byMerchant, 1)[0] ? `Your biggest payee was ${top(byMerchant, 1)[0][0]} at ${fmt(top(byMerchant, 1)[0][1])}.` : '',
  ].filter(Boolean);
  const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENAI_API_KEY || process.env.GOOGLE_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!key) return fallback;
  const { GoogleGenAI } = await import('@google/genai');
  const ai = new GoogleGenAI({ apiKey: key });
  const prompt = `You are a friendly Indian personal-finance assistant. Write 3 to 5 short, plain sentences (no bullets, no markdown) about this spending. Use ₹ and Indian number format. Mention one practical suggestion.
Total out: ${fmt(total)} over ${out.length} entries. Period: ${from || 'start'} to ${to || 'today'}.
Top categories: ${top(byCat).map(([k, v]) => `${k} ${fmt(v)}`).join(', ')}.
Top payees: ${top(byMerchant).map(([k, v]) => `${k} ${fmt(v)}`).join(', ')}.
Payment methods: ${top(byMethod).map(([k, v]) => `${k} ${fmt(v)}`).join(', ')}.
Return JSON: {"insights":["...","..."]}`;
  const r: any = await ai.models.generateContent({ model: process.env.GEMINI_MODEL || 'gemini-2.5-flash', contents: prompt, config: { responseMimeType: 'application/json' } });
  const text = String(r?.text || '');
  const parsed = JSON.parse(text);
  const list = (Array.isArray(parsed?.insights) ? parsed.insights : []).map((s: unknown) => String(s).trim()).filter(Boolean).slice(0, 5);
  return list.length ? list : fallback;
}

// ---------- gate around existing handleMoney ----------
const METER_FOR: Record<string, (body: any) => 'receipt_scans' | 'voice_entries' | 'smart_search' | null> = {
  processReceipt: () => 'receipt_scans',
  parseCapture: (b) => (String(b.source || '') === 'voice' ? 'voice_entries' : 'receipt_scans'),
  nlSearch: () => 'smart_search',
};
const FEATURE_FOR: Record<string, string> = {
  saveSplit: 'money_split', startUpiPayment: 'money_settle', reportUpiReturn: 'money_settle', confirmSettlementReceived: 'money_settle',
};

/** Returns true if it fully handled the request (error), else runs `inner` with metering + response post-processing. */
export async function gatedMoney(req: VercelRequest, res: VercelResponse, inner: (req: VercelRequest, res: VercelResponse) => Promise<unknown>) {
  const body = (req.body && typeof req.body === 'object' ? req.body : {}) as Record<string, any>;
  const op = String(body.op || '');
  const meterFn = METER_FOR[op];
  if (!meterFn && !FEATURE_FOR[op]) return inner(req, res);

  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const user = token ? await verifyFirebaseUser(token).catch(() => null) : null;
  if (!user) return inner(req, res); // inner returns the normal 401

  let undo: (() => Promise<unknown>) | null = null; let usage: unknown;
  try {
    if (FEATURE_FOR[op]) await requireFeature(user.uid, user.email, FEATURE_FOR[op]);
    const meter = meterFn ? meterFn(body) : null;
    if (meter) {
      await rateLimit(`${op}:${user.uid}`, 30);
      const n = op === 'processReceipt' && Array.isArray(body.files) ? Math.max(1, body.files.length) : 1;
      const g = await gateMeter(user.uid, user.email, meter, n);
      undo = g.undo; usage = g.usage;
    }
  } catch (e: any) {
    apiJson(res as any, e?.status || 500, { error: e?.message || 'Request failed', ...(e?.extra || {}) });
    return;
  }

  // Intercept the JSON response: refund on failure; enrich previews on success.
  const origEnd = (res as any).end.bind(res);
  let done = false;
  (res as any).end = (chunk?: any, ...rest: any[]) => {
    if (done) return origEnd(chunk, ...rest);
    done = true;
    const status = Number((res as any).statusCode || 200);
    if (status >= 400) { undo?.(); return origEnd(chunk, ...rest); }
    let payload: any = null;
    try { payload = chunk ? JSON.parse(Buffer.isBuffer(chunk) ? chunk.toString('utf8') : String(chunk)) : null; } catch { return origEnd(chunk, ...rest); }
    postProcess(user.uid, body, payload).then((p) => {
      if (p && usage && !p.usage) p.usage = usage;
      origEnd(JSON.stringify(p ?? payload), ...rest);
    }).catch(() => origEnd(chunk, ...rest));
    return res;
  };
  try {
    await inner(req, res);
  } catch (e) {
    await undo?.();
    throw e;
  }
}

async function postProcess(uid: string, body: any, payload: any) {
  if (!payload || (body.op !== 'processReceipt' && body.op !== 'parseCapture')) return payload;
  const sql = await saasSql();
  const bookId = String(body.bookId || payload.autoSelectBookId || '');
  const list = [payload.preview, ...(Array.isArray(payload.previews) ? payload.previews : [])].filter(Boolean);
  const book = bookId ? await ledgerGet(`books/${bookId}`).catch(() => null) as any : null;
  const cats: string[] = Array.isArray(book?.categories) ? book.categories.map(String) : [];
  const accounts: any[] = Array.isArray(book?.moneyAccounts) ? book.moneyAccounts : [];
  for (const p of list) {
    p.fieldConfidence = p.fieldConfidence || {};
    // learned merchant → category
    const key = merchantKey(p.merchant);
    if (key) {
      const hit = await sql`SELECT after FROM capture_corrections WHERE uid = ${uid} AND merchant_key = ${key} AND after ? 'category' ORDER BY at DESC LIMIT 1`;
      const cat = hit[0]?.after?.category;
      if (cat) { p.category = cat; p.fieldConfidence.category = 0.9; p.reasons = [...(p.reasons || []), 'Category learned from your earlier fix']; }
    }
    // map to the book's category list
    if (p.category && cats.length && !cats.includes(p.category)) {
      const lc = String(p.category).toLowerCase();
      const m = cats.find((c) => c.toLowerCase() === lc) || cats.find((c) => c.toLowerCase().includes(lc) || lc.includes(c.toLowerCase()));
      if (m) p.category = m;
    }
    // account from payment method
    if (!p.accountId && p.paymentMethod && accounts.length) {
      const a = accounts.find((x) => String(x.kind || '').toLowerCase() === String(p.paymentMethod).toLowerCase() && !x.archived);
      if (a) { p.accountId = a.id; p.fieldConfidence.accountId = p.fieldConfidence.accountId ?? 0.5; }
    }
    // inbox for low confidence / duplicate
    const kind = p.duplicateOf ? 'duplicate' : (p.confidence === 'low' ? 'review' : '');
    if (kind && bookId) {
      const id = String(p.id || newId('ib_'));
      await sql`INSERT INTO inbox_items (id, uid, book_id, kind, preview) VALUES (${id}, ${uid}, ${bookId}, ${kind}, ${JSON.stringify(p)}::jsonb)
        ON CONFLICT (id) DO UPDATE SET preview = EXCLUDED.preview, kind = EXCLUDED.kind`;
    }
  }
  return payload;
}

/** Call from expenses.create after save: closes the inbox item for this capture. */
export async function closeCapture(captureId?: string) {
  if (!captureId) return;
  const sql = await saasSql();
  await sql`UPDATE inbox_items SET done_at = now() WHERE id = ${captureId}`;
}

export { refund };

/**
 * Client-side financial memory helpers — search & grouping over authorized rows.
 * Server always enforces book permissions; this never bypasses auth.
 */

import { toPaise } from './money-core';
import type { ExpenseRow } from './money-reports';

export type MemoryHit = {
  id: string;
  bookId?: string;
  title: string;
  amount: number;
  date: string;
  merchant: string;
  category: string;
  hasReceipt: boolean;
  score: number;
};

function hay(row: ExpenseRow): string {
  return [
    row.description,
    row.merchant,
    row.category,
    row.notes,
    row.paymentMethod,
    row.bookName,
  ]
    .map((x) => String(x || '').toLowerCase())
    .join(' ');
}

export function searchFinancialMemory(
  expenses: ExpenseRow[],
  query: string,
  opts?: { limit?: number },
): MemoryHit[] {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return [];
  const tokens = q.split(/\s+/).filter(Boolean);
  const amountMatch = q.match(/(?:₹|rs\.?\s*)?(\d[\d,]*(?:\.\d+)?)/i);
  const amountPaise = amountMatch ? Math.round(Number(amountMatch[1].replace(/,/g, '')) * 100) : null;

  const scored: MemoryHit[] = [];
  for (const e of expenses) {
    const text = hay(e);
    let score = 0;
    for (const t of tokens) {
      if (text.includes(t)) score += t.length > 3 ? 12 : 6;
    }
    if (amountPaise != null) {
      const paise = toPaise(e.amount);
      if (Math.abs(paise - amountPaise) <= 100) score += 40;
      else if (Math.abs(paise - amountPaise) <= 500) score += 15;
    }
    if (/receipt|bill|invoice/.test(q) && (e.receiptPath || e.receiptUrl || e.receiptHash)) score += 20;
    if (score <= 0) continue;
    scored.push({
      id: String(e.id),
      bookId: e.bookId ? String(e.bookId) : undefined,
      title: String(e.description || e.merchant || 'Entry').slice(0, 80),
      amount: Number(e.amount || 0),
      date: String(e.date || ''),
      merchant: String(e.merchant || ''),
      category: String(e.category || ''),
      hasReceipt: Boolean(e.receiptPath || e.receiptUrl || e.receiptHash),
      score,
    });
  }
  return scored.sort((a, b) => b.score - a.score).slice(0, opts?.limit ?? 40);
}

export type LifeEventSuggestion = {
  id: string;
  label: string;
  kind: 'trip' | 'home' | 'wedding' | 'purchase' | 'other';
  expenseIds: string[];
  total: number;
  from: string;
  to: string;
  confidence: 'medium' | 'low';
  reason: string;
};

/** Cluster related spend into possible life events (suggestion only). */
export function detectLifeEvents(expenses: ExpenseRow[]): LifeEventSuggestion[] {
  const outs = expenses.filter((e) => String(e.entryType || 'out') === 'out');
  const byMonth = new Map<string, ExpenseRow[]>();
  for (const e of outs) {
    const m = String(e.date || '').slice(0, 7);
    if (!m) continue;
    const list = byMonth.get(m) || [];
    list.push(e);
    byMonth.set(m, list);
  }

  const out: LifeEventSuggestion[] = [];
  for (const [month, rows] of byMonth) {
    if (rows.length < 4) continue;
    const cats = new Set(rows.map((r) => String(r.category || '').toLowerCase()));
    const text = rows.map((r) => `${r.description} ${r.merchant} ${r.category}`).join(' ').toLowerCase();
    let kind: LifeEventSuggestion['kind'] = 'other';
    let label = `Activity · ${month}`;
    let reason = 'Clustered from Recent entries';

    if ((cats.has('travel') || cats.has('hotel') || /hotel|flight|fuel|parking/.test(text)) && rows.length >= 5) {
      kind = 'trip';
      label = `Possible trip · ${month}`;
      reason = 'Travel, hotel, or fuel activity clustered together';
    } else if (/wedding|shaadi|venue|catering/.test(text)) {
      kind = 'wedding';
      label = `Possible wedding · ${month}`;
      reason = 'Wedding-related merchants or categories';
    } else if (/furniture|appliance|renovation|cement|labour/.test(text)) {
      kind = 'home';
      label = `Possible home setup · ${month}`;
      reason = 'Home / renovation-related spend cluster';
    } else if (rows.some((r) => Number(r.amount || 0) > 20000) && /laptop|phone|electronics|tv/.test(text)) {
      kind = 'purchase';
      label = `Major purchase · ${month}`;
      reason = 'Large electronics-style purchase with related spend';
    } else {
      continue;
    }

    const dates = rows.map((r) => String(r.date || '')).filter(Boolean).sort();
    const total = rows.reduce((s, r) => s + Number(r.amount || 0), 0);
    out.push({
      id: `life:${kind}:${month}`,
      label,
      kind,
      expenseIds: rows.map((r) => String(r.id)),
      total,
      from: dates[0] || month,
      to: dates[dates.length - 1] || month,
      confidence: rows.length >= 8 ? 'medium' : 'low',
      reason,
    });
  }
  return out.slice(0, 8);
}

export type AttentionItem = {
  id: string;
  kind:
    | 'receipt_review'
    | 'categorize'
    | 'duplicate'
    | 'recurring'
    | 'commitment'
    | 'split'
    | 'outlier'
    | 'warranty';
  title: string;
  detail: string;
  href: string;
  priority: number;
  amount?: number;
  action?: string;
  /** Plain-language reason shown under the detail (outliers). */
  why?: string;
  severity?: 'low' | 'medium' | 'high';
};

export function buildAttentionInbox(input: {
  drafts?: ExpenseRow[];
  uncategorized?: ExpenseRow[];
  outliers?: Array<{ id: string; message: string; severity?: 'low' | 'medium' | 'high'; bookId?: string; amount?: number; label?: string }>;
  duplicates?: Array<{ id: string; message: string; bookId?: string }>;
  recurring?: Array<{ id: string; label: string; amount: number }>;
  commitments?: Array<{ id: string; label: string; nextEstimate: string; amount: number }>;
  pendingSplits?: number;
}): AttentionItem[] {
  const items: AttentionItem[] = [];
  for (const d of input.drafts || []) {
    items.push({
      id: `draft:${d.id}`,
      kind: 'receipt_review',
      title: 'Receipt needs review',
      detail: String(d.description || d.merchant || 'Draft entry'),
      href: d.bookId ? `/book/${d.bookId}?entry=${encodeURIComponent(String(d.id))}` : '/expenses',
      amount: Number(d.amount || 0) || undefined,
      action: 'Open',
      priority: 90,
    });
  }
  for (const u of (input.uncategorized || []).slice(0, 5)) {
    items.push({
      id: `cat:${u.id}`,
      kind: 'categorize',
      title: 'Needs a category',
      detail: String(u.description || u.merchant || 'Entry'),
      href: u.bookId ? `/book/${u.bookId}?entry=${encodeURIComponent(String(u.id))}` : '/reports',
      amount: Number(u.amount || 0) || undefined,
      action: 'Edit',
      priority: 70,
    });
  }
  for (const o of (input.outliers || []).slice(0, 6)) {
    items.push({
      id: `out:${o.id}`,
      kind: 'outlier',
      title: o.severity === 'high' ? 'Much bigger than usual' : 'Bigger than usual',
      detail: String(o.label || 'Entry'),
      why: o.message,
      severity: o.severity || 'medium',
      href: o.bookId ? `/book/${o.bookId}?entry=${encodeURIComponent(String(o.id))}` : '/expenses',
      amount: Number(o.amount || 0) || undefined,
      action: 'Check',
      priority: o.severity === 'high' ? 85 : 65,
    });
  }
  for (const dup of (input.duplicates || []).slice(0, 5)) {
    items.push({
      id: `dup:${dup.id}`,
      kind: 'duplicate',
      title: 'Possible duplicate',
      detail: dup.message,
      href: dup.bookId ? `/book/${dup.bookId}?entry=${encodeURIComponent(String(dup.id))}` : '/reports',
      action: 'Review',
      priority: 80,
    });
  }
  for (const r of (input.recurring || []).slice(0, 4)) {
    items.push({
      id: `rec:${r.id}`,
      kind: 'recurring',
      title: 'Repeats every month',
      detail: `${r.label} · ~₹${Math.round(r.amount)}`,
      href: '/regular-payments',
      amount: Number(r.amount || 0) || undefined,
      action: 'Open',
      priority: 55,
    });
  }
  for (const c of (input.commitments || []).slice(0, 4)) {
    items.push({
      id: `com:${c.id}`,
      kind: 'commitment',
      title: 'Payment coming up',
      detail: `${c.label} · ${c.nextEstimate || 'soon'}`,
      href: '/regular-payments',
      amount: Number(c.amount || 0) || undefined,
      action: 'Pay',
      priority: 60,
    });
  }
  if ((input.pendingSplits || 0) > 0) {
    items.push({
      id: 'splits',
      kind: 'split',
      title: `${input.pendingSplits} split request${input.pendingSplits === 1 ? '' : 's'}`,
      detail: 'Money owed between people on your books',
      href: '/expenses',
      action: 'Settle',
      priority: 75,
    });
  }
  return items.sort((a, b) => b.priority - a.priority).slice(0, 18);
}

import { applyCategoryRules, type CategoryRule } from './ledger-advanced';
import { guessedMerchant } from './bridge-automations';
import { toPaise, type UserMoneyRule } from './money-core';
import type { ExpenseRow } from './money-reports';

export type AnomalyHit = {
  id: string;
  kind: 'amount' | 'merchant' | 'frequency' | 'duplicate';
  message: string;
  severity: 'low' | 'medium' | 'high';
};

export type CommitmentHit = {
  id: string;
  label: string;
  cadence: 'weekly' | 'monthly' | 'yearly';
  amount: number;
  nextEstimate: string;
  occurrences: number;
};

export function applyUserRules(
  draft: Record<string, unknown>,
  rules: UserMoneyRule[],
): Record<string, unknown> {
  const hay = `${draft.description || ''} ${draft.merchant || ''}`.toLowerCase();
  let next = { ...draft };
  for (const rule of rules) {
    const match = rule.match.trim().toLowerCase();
    if (!match) continue;
    const fieldHay = rule.field === 'merchant'
      ? String(draft.merchant || '').toLowerCase()
      : rule.field === 'description'
        ? String(draft.description || '').toLowerCase()
        : hay;
    if (!fieldHay.includes(match)) continue;
    if (rule.category) next.category = rule.category;
    if (rule.merchant) next.merchant = rule.merchant;
    if (rule.paymentMethod) next.paymentMethod = rule.paymentMethod;
    next.ruleApplied = rule.id;
  }
  return next;
}

export function classifyCapture(
  draft: Record<string, unknown>,
  bookRules: CategoryRule[],
  userRules: UserMoneyRule[],
  history: ExpenseRow[],
): { draft: Record<string, unknown>; reasons: string[] } {
  const reasons: string[] = [];
  let next = { ...draft };

  const guess = guessedMerchant(`${next.description || ''} ${next.merchant || ''}`);
  if (guess) {
    if (!next.merchant) next.merchant = guess.merchant;
    if (!next.category || String(next.category).toLowerCase() === 'uncategorized') {
      next.category = guess.category;
      reasons.push(`Merchant map: ${guess.merchant} → ${guess.category}`);
    }
    if (!next.paymentMethod && guess.method) next.paymentMethod = guess.method;
  }

  const bookCat = applyCategoryRules(String(next.description || ''), String(next.merchant || ''), bookRules);
  if (bookCat) {
    next.category = bookCat;
    reasons.push(`Book rule → ${bookCat}`);
  }

  next = applyUserRules(next, userRules);
  if (next.ruleApplied) reasons.push('Your saved rule applied');

  const merchant = String(next.merchant || '').toLowerCase();
  if (merchant) {
    const prior = history.filter((e) => String(e.merchant || '').toLowerCase() === merchant).length;
    if (prior >= 3 && next.category) reasons.push(`${prior} prior confirmed at this merchant`);
  }

  return { draft: next, reasons };
}

export function detectAnomalies(expenses: ExpenseRow[]): AnomalyHit[] {
  const hits: AnomalyHit[] = [];
  const outs = expenses.filter((e) => String(e.entryType || 'out') === 'out');
  const amounts = outs.map((e) => toPaise(e.amount)).filter((n) => n > 0);
  if (amounts.length >= 4) {
    const sorted = [...amounts].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)] || 0;
    const cutoff = median * 2.5;
    for (const exp of outs) {
      const paise = toPaise(exp.amount);
      if (paise > cutoff) {
        hits.push({
          id: String(exp.id),
          kind: 'amount',
          message: `Unusually high vs your usual spend (median ₹${(median / 100).toFixed(0)})`,
          severity: paise > cutoff * 2 ? 'high' : 'medium',
        });
      }
    }
  }

  const merchantCounts = new Map<string, number>();
  for (const exp of outs) {
    const m = String(exp.merchant || '').trim().toLowerCase();
    if (!m) continue;
    merchantCounts.set(m, (merchantCounts.get(m) || 0) + 1);
  }
  for (const [merchant, count] of merchantCounts) {
    if (count >= 8) {
      hits.push({
        id: `merchant:${merchant}`,
        kind: 'frequency',
        message: `${merchant} appears ${count} times — check for duplicates or subscription`,
        severity: count >= 15 ? 'high' : 'low',
      });
    }
  }

  const clusters = new Map<string, string[]>();
  for (const exp of outs) {
    const key = `${String(exp.date || '').slice(0, 10)}|${toPaise(exp.amount)}|${String(exp.description || '').toLowerCase()}`;
    const list = clusters.get(key) || [];
    list.push(String(exp.id));
    clusters.set(key, list);
  }
  for (const ids of clusters.values()) {
    if (ids.length > 1) {
      for (const id of ids) {
        hits.push({
          id,
          kind: 'duplicate',
          message: 'Possible duplicate on same day, amount, and description',
          severity: 'medium',
        });
      }
    }
  }

  return hits;
}

export function detectCommitments(expenses: ExpenseRow[]): CommitmentHit[] {
  const outs = expenses.filter((e) => String(e.entryType || 'out') === 'out');
  const byKey = new Map<string, { amounts: number[]; dates: string[]; label: string }>();

  for (const exp of outs) {
    const label = String(exp.merchant || exp.description || '').trim().toLowerCase();
    if (!label || label.length < 3) continue;
    const bucket = byKey.get(label) || { amounts: [], dates: [], label: String(exp.merchant || exp.description || label) };
    bucket.amounts.push(toPaise(exp.amount));
    bucket.dates.push(String(exp.date || '').slice(0, 10));
    byKey.set(label, bucket);
  }

  const hits: CommitmentHit[] = [];
  for (const [key, bucket] of byKey) {
    if (bucket.dates.length < 3) continue;
    const sortedDates = [...bucket.dates].sort();
    const gaps: number[] = [];
    for (let i = 1; i < sortedDates.length; i += 1) {
      gaps.push(Math.round((Date.parse(sortedDates[i]) - Date.parse(sortedDates[i - 1])) / 86400000));
    }
    const avgGap = gaps.reduce((a, b) => a + b, 0) / Math.max(1, gaps.length);
    let cadence: CommitmentHit['cadence'] = 'monthly';
    if (avgGap <= 10) cadence = 'weekly';
    else if (avgGap >= 300) cadence = 'yearly';

    const avgAmount = bucket.amounts.reduce((a, b) => a + b, 0) / bucket.amounts.length;
    const last = sortedDates[sortedDates.length - 1];
    const next = new Date(`${last}T12:00:00`);
    if (cadence === 'weekly') next.setDate(next.getDate() + 7);
    else if (cadence === 'yearly') next.setFullYear(next.getFullYear() + 1);
    else next.setMonth(next.getMonth() + 1);

    hits.push({
      id: key,
      label: bucket.label,
      cadence,
      amount: Math.round(avgAmount) / 100,
      nextEstimate: next.toISOString().slice(0, 10),
      occurrences: bucket.dates.length,
    });
  }

  return hits.sort((a, b) => b.amount - a.amount).slice(0, 12);
}

type NlQuery = {
  text?: string;
  category?: string;
  merchant?: string;
  method?: string;
  minAmount?: number;
  maxAmount?: number;
  from?: string;
  to?: string;
  entryType?: string;
};

export function parseNaturalLanguageSearch(input: string): NlQuery {
  const q = String(input || '').trim().toLowerCase();
  const out: NlQuery = { text: q };

  const above = q.match(/above\s+₹?\s*([\d,]+(?:\.\d+)?)/i) || q.match(/over\s+₹?\s*([\d,]+(?:\.\d+)?)/i);
  if (above) out.minAmount = Number(above[1].replace(/,/g, ''));

  const below = q.match(/below\s+₹?\s*([\d,]+(?:\.\d+)?)/i) || q.match(/under\s+₹?\s*([\d,]+(?:\.\d+)?)/i);
  if (below) out.maxAmount = Number(below[1].replace(/,/g, ''));

  if (/\bfood\b/.test(q)) out.category = 'Food';
  if (/\btravel\b/.test(q)) out.category = 'Travel';
  if (/\bgrocer/.test(q)) out.category = 'Groceries';
  if (/\bphonepe\b/.test(q)) { out.method = 'upi'; out.merchant = 'PhonePe'; }
  if (/\bgpay|google pay\b/.test(q)) { out.method = 'upi'; out.merchant = 'Google Pay'; }
  if (/\bupi\b/.test(q)) out.method = 'upi';
  if (/\bcash\b/.test(q)) out.method = 'cash';
  if (/\bmoney in|income|received\b/.test(q)) out.entryType = 'in';
  if (/\bmoney out|spent|expense\b/.test(q)) out.entryType = 'out';
  if (/\btransfer\b/.test(q)) out.entryType = 'transfer';

  if (/last month/.test(q)) {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    out.from = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
    out.to = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-31`;
  } else if (/this month/.test(q)) {
    const d = new Date();
    out.from = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
    out.to = d.toISOString().slice(0, 10);
  } else if (/this year/.test(q)) {
    out.from = `${new Date().getFullYear()}-01-01`;
    out.to = new Date().toISOString().slice(0, 10);
  }

  if (/where did i spend more/.test(q)) out.text = '__compare__';
  return out;
}

export function runNaturalLanguageSearch(expenses: ExpenseRow[], input: string) {
  const query = parseNaturalLanguageSearch(input);
  if (query.text === '__compare__') {
    const thisKey = new Date().toISOString().slice(0, 7);
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    const lastKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const byCat = new Map<string, { this: number; last: number }>();
    for (const exp of expenses) {
      if (String(exp.entryType || 'out') !== 'out') continue;
      const day = String(exp.date || '');
      const cat = String(exp.category || 'Uncategorized');
      const slot = byCat.get(cat) || { this: 0, last: 0 };
      const amt = Number(exp.amount || 0);
      if (day.startsWith(thisKey)) slot.this += amt;
      if (day.startsWith(lastKey)) slot.last += amt;
      byCat.set(cat, slot);
    }
    const rows = [...byCat.entries()]
      .map(([category, v]) => ({ category, delta: v.this - v.last, thisMonth: v.this, lastMonth: v.last }))
      .sort((a, b) => b.delta - a.delta);
    return { query, rows, expenses: [] as ExpenseRow[] };
  }

  const filtered = expenses.filter((exp) => {
    if (query.entryType && String(exp.entryType || 'out') !== query.entryType) return false;
    if (query.category && String(exp.category || '').toLowerCase() !== query.category.toLowerCase()) return false;
    if (query.merchant && !`${exp.merchant || ''} ${exp.description || ''}`.toLowerCase().includes(query.merchant.toLowerCase())) return false;
    if (query.method && String(exp.paymentMethod || '').toLowerCase() !== query.method.toLowerCase()) return false;
    const amt = Number(exp.amount || 0);
    if (query.minAmount != null && amt < query.minAmount) return false;
    if (query.maxAmount != null && amt > query.maxAmount) return false;
    const day = String(exp.date || '').slice(0, 10);
    if (query.from && day < query.from) return false;
    if (query.to && day > query.to) return false;
    if (query.text && query.text !== '__compare__') {
      const hay = `${exp.description || ''} ${exp.merchant || ''} ${exp.category || ''} ${exp.notes || ''}`.toLowerCase();
      const tokens = query.text.split(/\s+/).filter((t) => t.length > 2 && !['the', 'and', 'for', 'last', 'this', 'month', 'year', 'spending'].includes(t));
      if (tokens.length && !tokens.some((t) => hay.includes(t))) return false;
    }
    return true;
  });

  return { query, rows: [] as Array<Record<string, unknown>>, expenses: filtered };
}

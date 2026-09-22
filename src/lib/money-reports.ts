import { fromPaise, toPaise, type TxType, entryTypeToTx } from './money-core';

export type ExpenseRow = Record<string, unknown>;

export type ReportPeriod = 'week' | 'month' | 'quarter' | 'year' | 'custom';

export type ReportFilters = {
  from?: string;
  to?: string;
  bookIds?: string[];
  categories?: string[];
  merchants?: string[];
  accountId?: string;
  entryTypes?: string[];
};

function inRange(day: string, from?: string, to?: string) {
  if (from && day < from) return false;
  if (to && day > to) return false;
  return true;
}

function isOut(exp: ExpenseRow) {
  const tx = entryTypeToTx(String(exp.entryType || 'out'));
  return tx === 'EXPENSE' || tx === 'CASH_WITHDRAWAL';
}

function isIn(exp: ExpenseRow) {
  const tx = entryTypeToTx(String(exp.entryType || 'out'));
  return tx === 'INCOME' || tx === 'REFUND' || tx === 'CASH_DEPOSIT';
}

function isTransfer(exp: ExpenseRow) {
  return entryTypeToTx(String(exp.entryType || 'out')) === 'TRANSFER'
    || entryTypeToTx(String(exp.entryType || 'out')) === 'CREDIT_CARD_PAYMENT';
}

export function periodBounds(period: ReportPeriod, anchor = new Date()) {
  const y = anchor.getFullYear();
  const m = anchor.getMonth();
  const d = anchor.getDate();
  // Local calendar dates (entries are stored as local YYYY-MM-DD); UTC would shift "today" after 18:30 UTC in IST.
  const today = iso(anchor);
  if (period === 'week') {
    const start = new Date(anchor);
    start.setDate(d - 6);
    return { from: iso(start), to: today };
  }
  if (period === 'month') {
    return { from: `${y}-${pad(m + 1)}-01`, to: today };
  }
  if (period === 'quarter') {
    const qStart = m - (m % 3);
    return { from: `${y}-${pad(qStart + 1)}-01`, to: today };
  }
  if (period === 'year') {
    return { from: `${y}-01-01`, to: today };
  }
  return { from: '', to: '' };
}

/** Bounds of the period immediately before `period` (same length), for delta comparisons. */
export function previousPeriodBounds(period: ReportPeriod, anchor = new Date()) {
  const cur = periodBounds(period, anchor);
  if (!cur.from) return { from: '', to: '' };
  const start = new Date(`${cur.from}T00:00:00`);
  const prevEnd = new Date(start);
  prevEnd.setDate(start.getDate() - 1);
  if (period === 'week') {
    const prevStart = new Date(prevEnd);
    prevStart.setDate(prevEnd.getDate() - 6);
    return { from: iso(prevStart), to: iso(prevEnd) };
  }
  if (period === 'month') {
    return { from: `${prevEnd.getFullYear()}-${pad(prevEnd.getMonth() + 1)}-01`, to: iso(prevEnd) };
  }
  if (period === 'quarter') {
    const m = prevEnd.getMonth();
    const qStart = m - (m % 3);
    return { from: `${prevEnd.getFullYear()}-${pad(qStart + 1)}-01`, to: iso(prevEnd) };
  }
  return { from: `${prevEnd.getFullYear()}-01-01`, to: iso(prevEnd) };
}

/** Percent change from `prev` to `cur`; null when there is nothing to compare against. */
export function percentDelta(cur: number, prev: number): number | null {
  if (!Number.isFinite(cur) || !Number.isFinite(prev)) return null;
  if (prev === 0) return cur === 0 ? 0 : null;
  return Math.round(((cur - prev) / Math.abs(prev)) * 100);
}

function iso(d: Date) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function pad(n: number) { return String(n).padStart(2, '0'); }

export function filterExpenses(expenses: ExpenseRow[], filters: ReportFilters = {}) {
  return expenses.filter((exp) => {
    const day = String(exp.date || '').slice(0, 10);
    if (!day) return false;
    if (!inRange(day, filters.from, filters.to)) return false;
    if (filters.bookIds?.length && !filters.bookIds.includes(String(exp.bookId || ''))) return false;
    if (filters.categories?.length && !filters.categories.some((c) => c.toLowerCase() === String(exp.category || '').toLowerCase())) return false;
    if (filters.merchants?.length && !filters.merchants.some((m) => String(exp.merchant || '').toLowerCase().includes(m.toLowerCase()))) return false;
    if (filters.accountId && String(exp.accountId || '') !== filters.accountId) return false;
    if (filters.entryTypes?.length && !filters.entryTypes.includes(String(exp.entryType || 'out'))) return false;
    return true;
  });
}

export function summarizeExpenses(expenses: ExpenseRow[]) {
  let moneyOutPaise = 0;
  let moneyInPaise = 0;
  let transferPaise = 0;
  const byCategory = new Map<string, number>();
  const byMerchant = new Map<string, number>();
  const byMethod = new Map<string, number>();
  const byDay = new Map<string, { out: number; in: number }>();
  const byBook = new Map<string, number>();

  for (const exp of expenses) {
    const paise = toPaise(exp.amount);
    const day = String(exp.date || '').slice(0, 10);
    const cat = String(exp.category || 'Uncategorized');
    const merchant = String(exp.merchant || exp.description || 'Unknown').trim() || 'Unknown';
    const method = String(exp.paymentMethod || 'cash');
    const book = String(exp.bookName || exp.bookId || 'Book');

    if (isTransfer(exp)) {
      transferPaise = addPaise(transferPaise, paise);
      continue;
    }
    if (isIn(exp)) {
      moneyInPaise = addPaise(moneyInPaise, paise);
      const slot = byDay.get(day) || { out: 0, in: 0 };
      slot.in = addPaise(slot.in, paise);
      byDay.set(day, slot);
      continue;
    }
    if (isOut(exp)) {
      moneyOutPaise = addPaise(moneyOutPaise, paise);
      byCategory.set(cat, addPaise(byCategory.get(cat) || 0, paise));
      byMerchant.set(merchant, addPaise(byMerchant.get(merchant) || 0, paise));
      byMethod.set(method, addPaise(byMethod.get(method) || 0, paise));
      byBook.set(book, addPaise(byBook.get(book) || 0, paise));
      const slot = byDay.get(day) || { out: 0, in: 0 };
      slot.out = addPaise(slot.out, paise);
      byDay.set(day, slot);
    }
  }

  const netPaise = subPaise(moneyInPaise, moneyOutPaise);
  const trend = [...byDay.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([date, v]) => ({
    date,
    out: fromPaise(v.out),
    in: fromPaise(v.in),
  }));

  const topCategories = [...byCategory.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([name, paise]) => ({ name, amount: fromPaise(paise), paise }));

  const topMerchants = [...byMerchant.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([name, paise]) => ({ name, amount: fromPaise(paise), paise }));

  return {
    moneyOut: fromPaise(moneyOutPaise),
    moneyIn: fromPaise(moneyInPaise),
    net: fromPaise(netPaise),
    transfers: fromPaise(transferPaise),
    count: expenses.length,
    topCategories,
    topMerchants,
    byMethod: [...byMethod.entries()].map(([name, paise]) => ({ name, amount: fromPaise(paise) })),
    byBook: [...byBook.entries()].map(([name, paise]) => ({ name, amount: fromPaise(paise) })),
    trend,
  };
}

function addPaise(a: number, b: number) { return Math.round(a) + Math.round(b); }
function subPaise(a: number, b: number) { return Math.round(a) - Math.round(b); }

export function budgetPerformance(
  expenses: ExpenseRow[],
  monthlyBudgetPaise: number,
  categoryBudgets: Array<{ category: string; monthlyPaise: number }> = [],
) {
  const monthKey = iso(new Date()).slice(0, 7);
  const monthOut = expenses
    .filter((e) => isOut(e) && String(e.date || '').startsWith(monthKey))
    .reduce((sum, e) => addPaise(sum, toPaise(e.amount)), 0);

  const byCat = new Map<string, number>();
  for (const exp of expenses) {
    if (!isOut(exp) || !String(exp.date || '').startsWith(monthKey)) continue;
    const cat = String(exp.category || 'Uncategorized');
    byCat.set(cat, addPaise(byCat.get(cat) || 0, toPaise(exp.amount)));
  }

  const categoryRows = categoryBudgets.map((row) => {
    const spent = byCat.get(row.category) || 0;
    return {
      category: row.category,
      budget: fromPaise(row.monthlyPaise),
      spent: fromPaise(spent),
      remaining: fromPaise(subPaise(row.monthlyPaise, spent)),
      over: spent > row.monthlyPaise,
    };
  });

  return {
    monthlyBudget: fromPaise(monthlyBudgetPaise),
    monthSpent: fromPaise(monthOut),
    remaining: fromPaise(subPaise(monthlyBudgetPaise, monthOut)),
    over: monthOut > monthlyBudgetPaise,
    categories: categoryRows,
  };
}

export function recurringSummary(expenses: ExpenseRow[]) {
  const recurring = expenses.filter((e) => e.recurringRuleId && isOut(e));
  const byRule = new Map<string, { count: number; totalPaise: number; lastDate: string; description: string }>();
  for (const exp of recurring) {
    const id = String(exp.recurringRuleId);
    const cur = byRule.get(id) || { count: 0, totalPaise: 0, lastDate: '', description: String(exp.description || '') };
    cur.count += 1;
    cur.totalPaise = addPaise(cur.totalPaise, toPaise(exp.amount));
    const day = String(exp.date || '');
    if (day > cur.lastDate) cur.lastDate = day;
    byRule.set(id, cur);
  }
  return [...byRule.values()].map((row) => ({
    ...row,
    total: fromPaise(row.totalPaise),
    monthlyEstimate: fromPaise(Math.round(row.totalPaise / Math.max(1, row.count))),
  }));
}

export function whereDidMoneyGo(expenses: ExpenseRow[]) {
  const summary = summarizeExpenses(expenses);
  const savings = subPaise(toPaise(summary.moneyIn), toPaise(summary.moneyOut));
  return {
    income: summary.moneyIn,
    spent: summary.moneyOut,
    saved: fromPaise(savings),
    transfers: summary.transfers,
    topCategories: summary.topCategories.slice(0, 5),
    narrative: savings >= 0
      ? `You kept ${fromPaise(savings).toLocaleString()} after spending this period.`
      : `Spending exceeded income by ${fromPaise(Math.abs(savings)).toLocaleString()} this period.`,
  };
}

export function whatIfReduceCategory(
  expenses: ExpenseRow[],
  category: string,
  reducePercent: number,
) {
  const pct = Math.min(100, Math.max(0, reducePercent));
  const monthKey = iso(new Date()).slice(0, 7);
  const catSpend = expenses
    .filter((e) => isOut(e) && String(e.category || '').toLowerCase() === category.toLowerCase() && String(e.date || '').startsWith(monthKey))
    .reduce((sum, e) => addPaise(sum, toPaise(e.amount)), 0);
  const saved = Math.round(catSpend * (pct / 100));
  return {
    category,
    currentMonthly: fromPaise(catSpend),
    reducePercent: pct,
    projectedSaving: fromPaise(saved),
    note: 'Estimate based on this month\'s category spend.',
  };
}

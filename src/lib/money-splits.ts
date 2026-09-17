/** Shared expense split + settlement helpers. */

import { fromPaise, newMoneyId, toPaise, type ExpenseSplit, type Settlement } from './money-core';
import type { MoneySplit, SplitMethod, SplitParticipant } from './money-flow';
import { equalSplitShares, settlementBalances } from './money-helpers';

export function peopleFromBook(book: Record<string, unknown> | null | undefined) {
  const roles = book?.roles;
  if (!roles || typeof roles !== 'object' || Array.isArray(roles)) return [] as Array<{ uid: string; name: string; email: string }>;
  return Object.entries(roles as Record<string, { email?: string; role?: string }>).map(([uid, row]) => ({
    uid,
    email: String(row.email || ''),
    name: String(row.email || uid).split('@')[0] || uid,
  }));
}

export function buildEqualPersonSplits(amount: number, book: Record<string, unknown> | null | undefined): ExpenseSplit[] {
  const people = peopleFromBook(book);
  return equalSplitShares(toPaise(amount), people);
}

export type SplitFillMode = 'automatic' | 'partial' | 'manual';

/** Equalize remaining after some members are locked (e.g. ₹50 of ₹900, rest split). */
export function fillLockedAmounts(
  totalPaise: number,
  rows: Array<{ amountPaise?: number; locked?: boolean }>,
  mode: SplitFillMode,
): { amounts: number[]; ok: boolean; error?: string } {
  const total = Math.round(totalPaise);
  const n = rows.length;
  if (!n) return { amounts: [], ok: false, error: 'Add at least one participant' };
  if (total <= 0) return { amounts: rows.map(() => 0), ok: false, error: 'Expense total must be greater than zero' };

  if (mode === 'automatic') {
    const base = Math.floor(total / n);
    const amounts = rows.map(() => base);
    amounts[0] += total - base * n;
    return { amounts, ok: true };
  }

  if (mode === 'manual') {
    const amounts = rows.map((r) => Math.max(0, Math.round(Number(r.amountPaise || 0))));
    const sum = amounts.reduce((s, a) => s + a, 0);
    if (sum !== total) {
      return { amounts, ok: false, error: `Allocated ${fromPaise(sum)} of ${fromPaise(total)}. Remaining ${fromPaise(total - sum)}` };
    }
    return { amounts, ok: true };
  }

  const amounts = rows.map((r) => (r.locked ? Math.max(0, Math.round(Number(r.amountPaise || 0))) : 0));
  const freeIdx = rows.map((r, i) => (r.locked ? -1 : i)).filter((i) => i >= 0);
  const lockedSum = amounts.reduce((s, a) => s + a, 0);
  if (lockedSum > total) return { amounts, ok: false, error: 'Locked amounts are more than the total' };
  if (!freeIdx.length) {
    if (lockedSum !== total) return { amounts, ok: false, error: 'Unlock a member so the rest can fill automatically' };
    return { amounts, ok: true };
  }
  const rest = total - lockedSum;
  const base = Math.floor(rest / freeIdx.length);
  freeIdx.forEach((i) => { amounts[i] = base; });
  amounts[freeIdx[0]] += rest - base * freeIdx.length;
  return { amounts, ok: true };
}

export function allocateSplit(
  totalPaise: number,
  method: SplitMethod,
  participants: SplitParticipant[],
): { allocations: Array<{ participantKey: string; amountPaise: number }>; ok: boolean; error?: string } {
  const total = Math.round(totalPaise);
  if (!participants.length) return { allocations: [], ok: false, error: 'Add at least one participant' };
  if (total <= 0) return { allocations: [], ok: false, error: 'Expense total must be greater than zero' };

  const keyOf = (p: SplitParticipant, i: number) => p.uid || p.email || `p${i}`;
  let raw: number[] = [];

  if (method === 'equal') {
    const base = Math.floor(total / participants.length);
    raw = participants.map(() => base);
    raw[0] += total - base * participants.length;
  } else if (method === 'exact') {
    raw = participants.map((p) => Math.round(Number(p.amountPaise || 0)));
  } else if (method === 'percentage') {
    const pctSum = participants.reduce((s, p) => s + Number(p.percent || 0), 0);
    if (Math.abs(pctSum - 100) > 0.05) return { allocations: [], ok: false, error: 'Percentages must total 100%' };
    raw = participants.map((p) => Math.round((total * Number(p.percent || 0)) / 100));
    const drift = total - raw.reduce((s, n) => s + n, 0);
    raw[0] += drift;
  } else if (method === 'shares') {
    const shareSum = participants.reduce((s, p) => s + Number(p.share || 0), 0);
    if (shareSum <= 0) return { allocations: [], ok: false, error: 'Shares must be greater than zero' };
    raw = participants.map((p) => Math.floor((total * Number(p.share || 0)) / shareSum));
    const drift = total - raw.reduce((s, n) => s + n, 0);
    raw[0] += drift;
  } else {
    raw = participants.map((p) => Math.round(Number(p.amountPaise || 0)));
  }

  const sum = raw.reduce((s, n) => s + n, 0);
  if (sum !== total) {
    return { allocations: [], ok: false, error: `Allocations (${fromPaise(sum)}) must equal expense total (${fromPaise(total)})` };
  }

  return {
    ok: true,
    allocations: participants.map((p, i) => ({ participantKey: keyOf(p, i), amountPaise: raw[i] })),
  };
}

export function buildMoneySplit(opts: {
  expenseId: string;
  bookId: string;
  totalPaise: number;
  method: SplitMethod;
  participants: SplitParticipant[];
  currency?: string;
}): MoneySplit | null {
  const allocated = allocateSplit(opts.totalPaise, opts.method, opts.participants);
  if (!allocated.ok) return null;
  const now = new Date().toISOString();
  return {
    id: newMoneyId('split'),
    expenseId: opts.expenseId,
    bookId: opts.bookId,
    method: opts.method,
    totalPaise: Math.round(opts.totalPaise),
    currency: opts.currency,
    participants: opts.participants.map((p, i) => ({
      ...p,
      amountPaise: allocated.allocations[i]?.amountPaise,
      settlementStatus: p.settlementStatus || 'PENDING',
    })),
    allocations: allocated.allocations,
    createdAt: now,
    updatedAt: now,
  };
}

export function moneySplitToPersonSplits(split: MoneySplit): ExpenseSplit[] {
  return split.participants.map((p, i) => ({
    uid: p.uid || split.allocations[i]?.participantKey || `p${i}`,
    name: p.name,
    sharePaise: split.allocations[i]?.amountPaise || p.amountPaise || 0,
    paidPaise: 0,
    settled: p.settlementStatus === 'PAID',
  }));
}

export function suggestSettlements(
  expenses: Array<Record<string, unknown>>,
  existing: Settlement[],
  people: Array<{ uid: string; name: string }>,
): Settlement[] {
  const balances = settlementBalances(expenses, existing);
  const debtors = balances.filter((b) => b.paise < 0).map((b) => ({ ...b, paise: Math.abs(b.paise) }));
  const creditors = balances.filter((b) => b.paise > 0).map((b) => ({ ...b }));
  const out: Settlement[] = [];
  let i = 0;
  let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const pay = Math.min(debtors[i].paise, creditors[j].paise);
    if (pay > 0) {
      const from = people.find((p) => p.uid === debtors[i].uid);
      const to = people.find((p) => p.uid === creditors[j].uid);
      out.push({
        id: newMoneyId('set'),
        fromUid: debtors[i].uid,
        toUid: creditors[j].uid,
        amountPaise: pay,
        date: new Date().toISOString().slice(0, 10),
        note: `${from?.name || 'Someone'} → ${to?.name || 'Someone'}`,
      });
      debtors[i].paise -= pay;
      creditors[j].paise -= pay;
    }
    if (debtors[i].paise <= 0) i += 1;
    if (creditors[j].paise <= 0) j += 1;
  }
  return out;
}

export function formatSettlementLine(row: Settlement, people: Array<{ uid: string; name: string }>, symbol = '₹') {
  const from = people.find((p) => p.uid === row.fromUid)?.name || row.fromUid;
  const to = people.find((p) => p.uid === row.toUid)?.name || row.toUid;
  return `${from} pays ${to} ${symbol}${fromPaise(row.amountPaise).toLocaleString()}`;
}

/** Shared expense split + settlement helpers. */

import { fromPaise, newMoneyId, toPaise, type ExpenseSplit, type Settlement } from './money-core';
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

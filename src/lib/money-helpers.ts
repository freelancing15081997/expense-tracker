/** Pure receipt / learning / category helpers (no Vite/API imports). */

import { newMoneyId, type UserMoneyRule } from './money-core';

export function learnRuleFromCorrection(input: {
  beforeCategory?: string;
  afterCategory: string;
  merchant?: string;
  description?: string;
  existing: UserMoneyRule[];
}): UserMoneyRule[] {
  const after = String(input.afterCategory || '').trim();
  if (!after) return input.existing;
  const merchant = String(input.merchant || '').trim();
  const description = String(input.description || '').trim();
  const match = (merchant || description.split(/\s+/).slice(0, 2).join(' ')).trim().toLowerCase();
  if (!match || match.length < 3) return input.existing;
  const without = input.existing.filter((r) => r.match.toLowerCase() !== match);
  return [
    {
      id: newMoneyId('rule'),
      match,
      field: merchant ? ('merchant' as const) : ('any' as const),
      category: after,
      merchant: merchant || undefined,
      createdAt: new Date().toISOString(),
    },
    ...without,
  ].slice(0, 80);
}

export type CategoryNode = {
  id: string;
  name: string;
  parentId?: string;
  archived?: boolean;
  order?: number;
};

export function readCategoryTree(book: Record<string, unknown> | null | undefined): CategoryNode[] {
  if (Array.isArray(book?.categoryTree)) return book.categoryTree as CategoryNode[];
  const flat = Array.isArray(book?.categories) ? book.categories.map(String) : [];
  return flat.map((name, i) => ({ id: `cat_${i}_${name.toLowerCase().replace(/\s+/g, '_')}`, name, order: i }));
}

export function flattenCategoryNames(tree: CategoryNode[]) {
  return tree.filter((n) => !n.archived).sort((a, b) => (a.order || 0) - (b.order || 0)).map((n) => n.name);
}

export function buildEvidenceTrail(exp: Record<string, unknown>) {
  const steps: Array<{ label: string; detail: string }> = [];
  const source = String(exp.captureSource || exp.source || 'manual');
  if (source === 'share') steps.push({ label: 'Source', detail: 'Shared receipt' });
  else if (source === 'email') steps.push({ label: 'Source', detail: 'Email' });
  else if (source !== 'manual') steps.push({ label: 'Source', detail: source });
  if (exp.upiRef) steps.push({ label: 'UPI / UTR', detail: String(exp.upiRef) });
  if (exp.vpa) steps.push({ label: 'VPA', detail: String(exp.vpa) });
  if (exp.ruleApplied) steps.push({ label: 'User rule', detail: String(exp.ruleApplied) });
  if (exp.receiptPath) steps.push({ label: 'Evidence', detail: 'Receipt attached' });
  if (exp.emailMessageId) steps.push({ label: 'Evidence', detail: 'Email message' });
  return steps;
}

export function equalSplitShares(totalPaise: number, people: Array<{ uid: string; name: string }>) {
  if (!people.length) return [];
  const base = Math.floor(totalPaise / people.length);
  let rem = totalPaise - base * people.length;
  return people.map((person, i) => {
    const share = base + (i < rem ? 1 : 0);
    return { uid: person.uid, name: person.name, sharePaise: share, paidPaise: 0, settled: false };
  });
}

export function settlementBalances(
  expenses: Array<Record<string, unknown>>,
  settlements: Array<{ fromUid: string; toUid: string; amountPaise: number }>,
) {
  const bal = new Map<string, number>();
  for (const exp of expenses) {
    const splits = Array.isArray(exp.personSplits) ? exp.personSplits as Array<{ uid: string; sharePaise: number; paidPaise?: number }> : [];
    if (!splits.length) continue;
    for (const split of splits) {
      const paid = Number(split.paidPaise || 0);
      const share = Number(split.sharePaise || 0);
      bal.set(split.uid, (bal.get(split.uid) || 0) + paid - share);
    }
  }
  for (const s of settlements) {
    bal.set(s.fromUid, (bal.get(s.fromUid) || 0) - Number(s.amountPaise || 0));
    bal.set(s.toUid, (bal.get(s.toUid) || 0) + Number(s.amountPaise || 0));
  }
  return [...bal.entries()].map(([uid, paise]) => ({ uid, paise })).sort((a, b) => a.paise - b.paise);
}

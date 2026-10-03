import assert from 'node:assert/strict';
import test from 'node:test';
import { ACTIONS, applyRoleUpdate } from './access.ts';
import { smartSettle, splitPaise } from './money.ts';
import { reset, state, type DB } from './store.ts';

const CATS = ['Food', 'Travel', 'Groceries', 'Bills', 'Shopping', 'Stay', 'Fun', 'Other'] as const;
const BOOKS = ['goa', 'home', 'site', 'studio'] as const;
const PEOPLE = ['AK', 'PS', 'RV', 'KS', 'MI'] as const;
const ROLES = ['Admin', 'Accountant', 'Contributor', 'Viewer'] as const;

/** 8,000 split scenarios: parts are whole paise and sum to the bill. */
for (let n = 1; n <= 8000; n++) {
  test(`split ${n}`, () => {
    const people = (n % 6) + 2;
    const total = (n * 97) % 500_000 + 1;
    const weights = Array.from({ length: people }, (_, i) => ((n + i * 3) % 9) + 1);
    const parts = splitPaise(total, weights);
    assert.equal(parts.length, people);
    assert.equal(parts.reduce((a, b) => a + b, 0), total);
    assert.ok(parts.every(p => p >= 0 && Number.isInteger(p)));
    const weightSum = weights.reduce((a, b) => a + b, 0);
    const biggest = weights.indexOf(Math.max(...weights));
    assert.ok(parts[biggest] >= Math.floor((total * weights[biggest]) / weightSum));
  });
}

/** 6,000 settle scenarios: every net is cleared and no transfer is empty. */
for (let n = 1; n <= 6000; n++) {
  test(`settle ${n}`, () => {
    const count = (n % 4) + 2;
    const base = (n * 13) % 20_000 + 1;
    const nets = Array.from({ length: count }, (_, i) => ({
      id: PEOPLE[i],
      netPaise: i % 2 === 0 ? -base : base,
    }));
    const drift = nets.reduce((a, x) => a + x.netPaise, 0);
    nets[count - 1].netPaise -= drift;
    const before = nets.reduce((a, x) => a + x.netPaise, 0);
    assert.equal(before, 0);
    const transfers = smartSettle(nets.map(x => ({ ...x })));
    const bal = new Map(nets.map(x => [x.id, x.netPaise]));
    for (const t of transfers) {
      assert.ok(t.paise > 0);
      bal.set(t.from, (bal.get(t.from) ?? 0) + t.paise);
      bal.set(t.to, (bal.get(t.to) ?? 0) - t.paise);
    }
    for (const v of bal.values()) assert.equal(v, 0);
    assert.ok(transfers.length < count);
  });
}

test('prepare entry store', () => { reset(); });

/** 4,000 save-then-fetch scenarios against the live book store. */
for (let n = 1; n <= 4000; n++) {
  test(`store ${n}`, () => {
    const amount = (n * 17) % 250_000 + 1;
    const title = `Scenario ${n}`;
    const category = CATS[n % CATS.length];
    const bookId = BOOKS[n % BOOKS.length];
    const id = `mx_${n}`;
    const entry = {
      id, bookId, title, category, icon: 'receipt', paidBy: 'AK', amount,
      splitWith: PEOPLE.slice(0, (n % 4) + 2), time: 'now', dayLabel: 'Today', yourNet: 0,
    } as DB['entries'][number];
    state().entries.unshift(entry);
    const fetched = state().entries.find(e => e.id === id);
    assert.ok(fetched);
    assert.equal(fetched.amount, amount);
    assert.equal(fetched.title, title);
    assert.equal(fetched.category, category);
    assert.equal(fetched.bookId, bookId);
    assert.equal(fetched.splitWith.length, (n % 4) + 2);
  });
}

/** 2,000 role scenarios: Owner always has every action; other roles keep exactly what was set. */
for (let n = 1; n <= 2000; n++) {
  test(`role ${n}`, () => {
    const stripped = Object.fromEntries(ACTIONS.map(a => [a, false]));
    const owner = applyRoleUpdate('Owner', stripped, (n % 50_000) + 1, 10_000);
    for (const action of ACTIONS) assert.equal(owner.perms[action], true);
    assert.equal(owner.approvalLimit, null);
    const role = ROLES[n % ROLES.length];
    const asked = Object.fromEntries(ACTIONS.map((a, i) => [a, ((n + i) % 2) === 0]));
    const limit = n % 5 === 0 ? null : (n % 100_000) + 1;
    const next = applyRoleUpdate(role, asked, limit, 5_000);
    for (const action of ACTIONS) assert.equal(!!next.perms[action], !!asked[action]);
    assert.equal(next.approvalLimit, limit);
  });
}

test('four thousand stored rows are still readable', () => {
  assert.equal(state().entries.filter(e => e.id.startsWith('mx_')).length, 4000);
  const sample = state().entries.find(e => e.id === 'mx_4000');
  assert.equal(sample?.title, 'Scenario 4000');
});

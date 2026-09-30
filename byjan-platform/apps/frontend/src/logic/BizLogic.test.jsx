import { describe, it, expect } from 'vitest';
import BizLogic from './BizLogic.js';
import { calc, DOC_T } from './constants.js';

// Pure/state-reading methods on the unmounted class instance.
const logic = () => new BizLogic({});

describe('BizLogic initial state', () => {
  it('boots clean by default — no demo data for a new user (E2E contract)', () => {
    const l = logic();
    // VITE_DEMO_SEED unset → every seeded collection must be empty
    for (const key of ['docs', 'parties', 'log', 'feed', 'periods', 'stock', 'assets',
      'projects', 'budgets', 'deals', 'leases', 'returns', 'mism', 'ents', 'cos',
      'queries', 'inbox', 'aprs', 'alerts', 'coa', 'users', 'org', 'clients',
      'tasks', 'rq', 'dr', 'cq', 'time', 'comp']) {
      expect(l.state[key], key).toEqual([]);
    }
    expect(l.state.matched).toBe(0);
    expect(l.state.set.name).toBe('');
    expect(l.state.set.g).toBe('');
    expect(l.state.set.invNext).toBe('1');
    expect(l.state.mod).toBeTruthy();
    expect(l.state.boot).toBe(true);
  });

  it('falls back to home module', () => {
    const l = logic();
    expect(l.state.open[l.state.mod] || l.state.open).toBeTruthy();
  });
});

describe('BizLogic.words() amount in words', () => {
  const w = n => logic().words(n);

  it('handles zero and small numbers', () => {
    expect(w(0)).toBe('Zero');
    expect(w(5)).toBe('Five');
    expect(w(19)).toBe('Nineteen');
  });

  it('Indian grouping: thousands, lakhs, crores', () => {
    expect(w(1000)).toBe('One Thousand');
    expect(w(100000)).toBe('One Lakh');
    expect(w(10000000)).toBe('One Crore');
    expect(w(123456)).toContain('Lakh');
    expect(w(123456)).toContain('Thousand');
  });

  it('compound words', () => {
    expect(w(42)).toBe('Forty Two');
    expect(w(999)).toContain('Hundred');
  });

  it('rounds before converting', () => {
    expect(w(99.6)).toBe('One Hundred');
  });
});

describe('BizLogic.effLine() effective line pricing', () => {
  const l = logic();
  const line = { item: 'i1', q: '2', r: '100', g: '18', disc: '10' };

  it('exclusive mode: applies line discount, keeps gst', () => {
    const e = l.effLine(line, 'excl');
    expect(e.r).toBe(90);
    expect(e.g).toBe(18);
    expect(e.q).toBe(2);
  });

  it('inclusive mode: strips gst from rate', () => {
    const e = l.effLine({ item: 'i1', q: '1', r: '118', g: '18' }, 'incl');
    expect(e.r).toBe(100);
    expect(e.g).toBe(18);
  });

  it('none mode: zeroes gst', () => {
    const e = l.effLine(line, 'none');
    expect(e.g).toBe(0);
    expect(e.r).toBe(90);
  });

  it('discount clamped at 100%', () => {
    const e = l.effLine({ ...line, disc: '150' }, 'excl');
    expect(e.r).toBe(0);
  });

  it('missing fields default safely', () => {
    const e = l.effLine({}, 'excl');
    expect(e.r).toBe(0);
    expect(e.q).toBe(0);
    expect(e.g).toBe(0);
  });
});

describe('BizLogic document helpers', () => {
  it('bal() = total minus paid, floored at 0', () => {
    const l = logic();
    const d = { tk: 'invoices', party: 'c1', paid: 500, lines: [{ q: 1, r: 1000, g: 0 }] };
    expect(l.bal(d)).toBe(500);
    expect(l.bal({ ...d, paid: 99999 })).toBe(0);
  });

  it('nextNo() starts at 1 on a clean workspace, then continues from the max', () => {
    const l = logic();
    expect(l.nextNo('invoices')).toBe('INV-1');
    l.state.docs = [{ tk: 'invoices', no: 'INV-1041' }];
    expect(l.nextNo('invoices')).toBe('INV-1042');
  });

  it('POST_TO maps every doc type to a status it supports', () => {
    const l = logic();
    for (const [tk, st] of Object.entries(l.POST_TO)) {
      expect(DOC_T[tk]).toBeTruthy();
      expect(DOC_T[tk].sts).toContain(st);
    }
  });

  it('P()/pn() resolve party by id', () => {
    const l = logic();
    l.state.parties = [{ id: 'c1', k: 'c', n: 'Test Party' }];
    const p = l.P('c1');
    expect(p).toBeTruthy();
    expect(l.pn('c1')).toBe(p.n);
    expect(l.P('nope')).toBeNull();
    expect(l.pn('nope')).toBe('');
  });

  it('aging() buckets balances 0/30/60/90/90+', () => {
    const l = logic();
    const buckets = l.aging('invoices');
    expect(buckets).toHaveLength(5);
    for (const v of buckets) expect(v).toBeGreaterThanOrEqual(0);
  });

  it('verbs() returns a list of verb keys for a doc', () => {
    const l = logic();
    const vs = l.verbs({ tk: 'invoices', st: 'Draft' });
    expect(Array.isArray(vs)).toBe(true);
    expect(vs.length).toBeGreaterThan(0);
  });
});

describe('BizLogic.passF() document filter', () => {
  const mkDoc = (r) => ({ tk: 'invoices', party: '', dt: 0, lines: [{ q: 1, r, g: 0 }] });

  it('passes everything with empty filter', () => {
    const l = logic();
    l.state.flt = {};
    expect(l.passF(mkDoc(1000))).toBe(true);
  });

  it('filters by amount band', () => {
    const l = logic();
    l.state.flt = { amt: 'Over ₹2L' };
    for (const d of [mkDoc(50000), mkDoc(300000)]) {
      const passes = l.passF(d);
      const total = calc(d).total;
      expect(passes).toBe(total > 200000);
    }
  });
});

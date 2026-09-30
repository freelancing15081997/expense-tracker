import { describe, it, expect } from 'vitest';
import {
  calc, genDocs, inr, inr2, inrS, fd, DOC_T, DIST, STC, NAV, MOD,
  PARTIES, PBY, ITEMS, IBY, ICO,
} from './constants.js';

// ---------------------------------------------------------------------------
// calc() — GST document totals
// ---------------------------------------------------------------------------
describe('calc() document totals', () => {
  const doc = (lines, extra = {}) => ({ tk: 'invoices', party: 'c1', ...extra, lines });

  it('computes subtotal from qty×rate', () => {
    const r = calc(doc([{ q: 2, r: 100, g: 0 }]));
    expect(r.sub).toBe(200);
    expect(r.total).toBe(200);
  });

  it('splits GST into CGST+SGST for same-state party', () => {
    // c1 (Maharashtra) + CO (Maharashtra) → intra-state
    const r = calc(doc([{ q: 1, r: 1000, g: 18 }]));
    expect(r.inter).toBe(false);
    expect(r.cg).toBe(90);
    expect(r.sg).toBe(90);
    expect(r.ig).toBe(0);
    expect(r.tax).toBe(180);
    expect(r.total).toBe(1180);
  });

  it('routes all GST to IGST for inter-state party', () => {
    // c4 is Karnataka (29), CO is Maharashtra (27)
    const r = calc(doc([{ q: 1, r: 1000, g: 18 }], { party: 'c4' }));
    expect(r.inter).toBe(true);
    expect(r.ig).toBe(180);
    expect(r.cg).toBe(0);
    expect(r.sg).toBe(0);
  });

  it('discount scales taxable and tax proportionally', () => {
    const r = calc(doc([{ q: 1, r: 1000, g: 18 }], { disc: 250 }));
    expect(r.disc).toBe(250);
    expect(r.taxable).toBe(750);
    expect(r.tax).toBe(135); // 180 * 0.75
  });

  it('discount caps at subtotal', () => {
    const r = calc(doc([{ q: 1, r: 100, g: 18 }], { disc: 999 }));
    expect(r.disc).toBe(100);
    expect(r.total).toBe(0);
  });

  it('handles multiple lines with mixed rates', () => {
    const r = calc(doc([{ q: 1, r: 1000, g: 18 }, { q: 2, r: 500, g: 12 }]));
    expect(r.sub).toBe(2000);
    expect(r.tax).toBe(180 + 120);
    expect(r.cg + r.sg).toBe(300);
  });

  it('journal docs sum dr/cr and carry no tax', () => {
    const r = calc({
      tk: 'journals', party: null,
      lines: [{ dr: 5000, cr: 0 }, { dr: 0, cr: 5000 }],
    });
    expect(r.dr).toBe(5000);
    expect(r.cr).toBe(5000);
    expect(r.tax).toBe(0);
    expect(r.total).toBe(5000);
    expect(r.inter).toBe(false);
  });

  it('total is the rounded raw amount, ro is the difference', () => {
    const r = calc(doc([{ q: 1, r: 33.33, g: 5 }]));
    expect(r.total).toBe(Math.round(r.taxable + r.tax));
    expect(r.ro).toBeCloseTo(r.total - (r.taxable + r.tax), 10);
  });

  it('missing qty/rate/g fields default to zero', () => {
    const r = calc(doc([{}]));
    expect(r.sub).toBe(0);
    expect(r.total).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// genDocs() — seeded fixture data
// ---------------------------------------------------------------------------
describe('genDocs() generated dataset', () => {
  it('generates every document type', () => {
    const docs = genDocs();
    const kinds = new Set(docs.map(d => d.tk));
    for (const tk of Object.keys(DOC_T)) expect(kinds.has(tk)).toBe(true);
  });

  it('is deterministic (same seed → same docs)', () => {
    const a = genDocs(), b = genDocs();
    expect(a.length).toBe(b.length);
    expect(a.map(d => d.id)).toEqual(b.map(d => d.id));
    expect(a.map(d => calc(d).total)).toEqual(b.map(d => calc(d).total));
  });

  it('every doc has required fields', () => {
    for (const d of genDocs()) {
      expect(d.id).toBeTruthy();
      expect(DOC_T[d.tk]).toBeTruthy();
      expect(d.no).toMatch(new RegExp(`^${DOC_T[d.tk].pre}`));
      expect(typeof d.st).toBe('string');
      expect(Array.isArray(d.lines)).toBe(true);
      expect(Array.isArray(d.act)).toBe(true);
      expect(d.act.length).toBeGreaterThan(0);
    }
  });

  it('paid docs are fully settled, drafts unpaid', () => {
    for (const d of genDocs()) {
      const total = calc(d).total;
      if (['Paid', 'Reimbursed'].includes(d.st)) expect(d.paid).toBe(total);
      if (d.st === 'Draft') expect(d.paid).toBe(0);
    }
  });

  it('party references resolve', () => {
    for (const d of genDocs()) {
      if (d.party) expect(PBY[d.party]).toBeTruthy();
    }
  });
});

// ---------------------------------------------------------------------------
// Currency/date formatting
// ---------------------------------------------------------------------------
describe('INR formatting', () => {
  it('inr() formats with Indian digit grouping', () => {
    expect(inr(0)).toBe('₹0');
    expect(inr(123456)).toBe('₹1,23,456');
    expect(inr(1000)).toBe('₹1,000');
  });

  it('inr() shows unicode minus for negatives', () => {
    expect(inr(-500)).toBe('−₹500');
  });

  it('inr2() keeps two decimals', () => {
    expect(inr2(1234.5)).toBe('₹1,234.50');
    expect(inr2(-9.9)).toBe('−₹9.90');
  });

  it('inrS() uses lakh/crore shorthand', () => {
    expect(inrS(150000)).toBe('₹1.50 L');
    expect(inrS(25000000)).toBe('₹2.50 Cr');
    expect(inrS(-150000)).toBe('−₹1.50 L');
    expect(inrS(5000)).toBe('₹5,000');
  });
});

describe('fd() date formatting', () => {
  it('formats offset days', () => {
    expect(fd(0)).toBe('24 Sep');
    expect(fd(0, true)).toBe('24 Sep 2026');
    expect(fd(-1)).toBe('23 Sep');
  });
});

// ---------------------------------------------------------------------------
// Lookup-table integrity
// ---------------------------------------------------------------------------
describe('lookup table integrity', () => {
  it('every NAV item maps into MOD with its bucket', () => {
    for (const b of NAV) {
      for (const [, key] of b.items) {
        expect(MOD[key]).toBeTruthy();
        expect(MOD[key].b).toBe(b);
      }
    }
  });

  it('every doc type in DIST has a DOC_T entry and status colors', () => {
    for (const tk of Object.keys(DIST)) {
      expect(DOC_T[tk]).toBeTruthy();
      for (const st of DIST[tk]) {
        expect(STC[st], `missing badge colors for "${st}" (${tk})`).toBeTruthy();
      }
    }
  });

  it('every DOC_T status has a badge color', () => {
    for (const [tk, T] of Object.entries(DOC_T)) {
      for (const st of T.sts) {
        expect(STC[st], `missing STC for "${st}"`).toBeTruthy();
      }
      expect(T.pre).toMatch(/^[A-Z]+-$/);
      expect(T.ic).toBeTruthy();
    }
  });

  it('all statuses used anywhere have badge colors', () => {
    for (const [k, v] of Object.entries(STC)) {
      expect(v).toHaveLength(2);
      expect(v[0]).toMatch(/^#/);
      expect(v[1]).toMatch(/^#/);
    }
  });

  it('parties have valid 15-char GSTINs', () => {
    for (const p of PARTIES) {
      expect(p.g).toHaveLength(15);
      expect(p.k).toMatch(/^[cv]$/);
      expect(p.terms).toBeGreaterThan(0);
    }
  });

  it('items have required commerce fields', () => {
    for (const i of ITEMS) {
      expect(i.n).toBeTruthy();
      expect(i.r).toBeGreaterThan(0);
      expect([0, 5, 12, 18, 28]).toContain(i.g);
      expect(i.hsn).toBeTruthy();
      expect(IBY[i.id]).toBe(i);
    }
  });

  it('icon CDN base is https', () => {
    expect(ICO).toMatch(/^https:\/\//);
  });
});

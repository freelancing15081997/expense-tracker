import {
  detectRegularPayments,
  buildMoneyInsights,
  summarizeRegularPayments,
  normalizeMerchant,
  patternToRecurringRule,
  type TxRow,
} from '../src/lib/recurrence-engine';

let passed = 0;
let failed = 0;

function assert(cond: boolean, label: string) {
  if (cond) { passed += 1; console.log(`  ✓ ${label}`); }
  else { failed += 1; console.error(`  ✗ ${label}`); }
}

function monthlySeries(merchant: string, amounts: number[], start = '2025-10-05'): TxRow[] {
  const out: TxRow[] = [];
  let d = new Date(`${start}T12:00:00`);
  amounts.forEach((amount, i) => {
    out.push({
      id: `${merchant}_${i}`,
      merchant,
      description: `${merchant} UPI`,
      amount,
      date: d.toISOString().slice(0, 10),
      category: merchant === 'Netflix' ? 'Entertainment' : 'Utilities',
      entryType: 'out',
      paymentMethod: 'upi',
      bookId: 'book1',
    });
    d = new Date(d);
    d.setMonth(d.getMonth() + 1);
  });
  return out;
}

console.log('Merchant normalize');
assert(normalizeMerchant('NETFLIX INDIA UPI') === 'netflix india', 'normalizes Netflix UPI noise');

console.log('Indian fixtures — monthly / variable / yearly');
const fixtures: TxRow[] = [
  ...monthlySeries('Netflix', [649, 649, 699, 699, 699]),
  ...monthlySeries('BESCOM Electricity', [2100, 2450, 2300, 3150, 2980], '2025-09-12'),
  ...monthlySeries('Airtel Internet', [999, 999, 999, 999], '2025-10-01'),
  { id: 'rent1', merchant: 'House Rent', amount: 25000, date: '2025-11-01', entryType: 'out', category: 'Rent', bookId: 'book1' },
  { id: 'rent2', merchant: 'House Rent', amount: 25000, date: '2025-12-01', entryType: 'out', category: 'Rent', bookId: 'book1' },
  { id: 'rent3', merchant: 'House Rent', amount: 25000, date: '2026-01-01', entryType: 'out', category: 'Rent', bookId: 'book1' },
  { id: 'rent4', merchant: 'House Rent', amount: 25000, date: '2026-02-01', entryType: 'out', category: 'Rent', bookId: 'book1' },
  { id: 'ins1', merchant: 'LIC Insurance', amount: 18500, date: '2023-06-15', entryType: 'out', category: 'Health', bookId: 'book1' },
  { id: 'ins2', merchant: 'LIC Insurance', amount: 18500, date: '2024-06-14', entryType: 'out', category: 'Health', bookId: 'book1' },
  { id: 'ins3', merchant: 'LIC Insurance', amount: 19200, date: '2025-06-16', entryType: 'out', category: 'Health', bookId: 'book1' },
  { id: 'sal1', merchant: 'Acme Payroll', amount: 85000, date: '2025-12-01', entryType: 'in', category: 'Salary', bookId: 'book1' },
  { id: 'sal2', merchant: 'Acme Payroll', amount: 85000, date: '2026-01-01', entryType: 'in', category: 'Salary', bookId: 'book1' },
  { id: 'sal3', merchant: 'Acme Payroll', amount: 87000, date: '2026-02-01', entryType: 'in', category: 'Salary', bookId: 'book1' },
  { id: 'gpay1', merchant: 'Swiggy', amount: 320, date: '2026-02-01', entryType: 'out', category: 'Food', bookId: 'book1' },
  { id: 'gpay2', merchant: 'Swiggy', amount: 410, date: '2026-02-08', entryType: 'out', category: 'Food', bookId: 'book1' },
  { id: 'once', merchant: 'Airport Taxi', amount: 1800, date: '2026-01-20', entryType: 'out', category: 'Travel', bookId: 'book1' },
];

const today = '2026-03-20';
const patterns = detectRegularPayments(fixtures, [], { today });
assert(patterns.some((p) => /netflix/i.test(p.merchant) && p.frequency === 'monthly'), 'detects Netflix monthly');
assert(patterns.some((p) => /bescom|electricity/i.test(p.merchant)), 'detects variable electricity');
assert(patterns.some((p) => /lic|insurance/i.test(p.merchant) && p.frequency === 'yearly'), 'detects yearly insurance');
assert(patterns.some((p) => /rent/i.test(p.merchant)), 'detects rent');
assert(patterns.some((p) => /payroll|acme/i.test(p.merchant) && p.entryType === 'in'), 'detects recurring income');
assert(!patterns.some((p) => /airport taxi/i.test(p.merchant)), 'ignores one-off taxi');

const netflix = patterns.find((p) => /netflix/i.test(p.merchant))!;
assert(Boolean(netflix && netflix.band !== 'NOT_RECURRING'), 'Netflix confidence band usable');
assert(Boolean(netflix && netflix.yearlyEstimate > 0), 'yearly estimate present');
assert(Boolean(netflix && netflix.explanation.includes('times')), 'explainable reason');

console.log('Amount increase / missed');
const power = patterns.find((p) => /bescom|electricity/i.test(p.merchant));
assert(Boolean(power && (power.amountTrend === 'up' || power.maxAmount > power.minAmount)), 'electricity amount variation tracked');

console.log('User confirmation overrides');
const confirmed = detectRegularPayments(fixtures, [{
  id: netflix.id,
  merchantKey: netflix.merchantKey,
  userConfirmed: true,
  status: 'active',
  expectedAmount: 699,
  frequencyOverride: 'monthly',
}], { today });
const conf = confirmed.find((p) => p.id === netflix.id);
assert(conf?.band === 'CONFIRMED', 'user confirm → CONFIRMED');
assert(conf?.avgAmount === 699, 'expected amount override');

const ignored = detectRegularPayments(fixtures, [{
  id: netflix.id,
  merchantKey: netflix.merchantKey,
  status: 'ignored',
}], { today });
assert(!ignored.some((p) => p.id === netflix.id), 'ignored patterns hidden');

console.log('Insights');
const insights = buildMoneyInsights(patterns, fixtures, { today });
assert(insights.length > 0, 'builds insights');
assert(insights.every((i) => i.title && i.detail && i.actionLabel), 'insights user-friendly');

console.log('Summary + rule mapping');
const summary = summarizeRegularPayments(patterns, today);
assert(summary.yearlyEstimate > 0, 'summary yearly estimate');
const rule = patternToRecurringRule(netflix);
assert(rule.active && rule.nextDate && rule.amount > 0, 'maps to legacy recurring rule');

console.log('False positives — random Food');
const randomFood: TxRow[] = [
  { id: 'f1', merchant: 'Cafe A', amount: 120, date: '2026-01-02', entryType: 'out' },
  { id: 'f2', merchant: 'Cafe B', amount: 340, date: '2026-01-09', entryType: 'out' },
  { id: 'f3', merchant: 'Cafe C', amount: 90, date: '2026-01-20', entryType: 'out' },
];
assert(detectRegularPayments(randomFood, [], { today }).length === 0, 'no false positive on random cafes');

console.log(`\nRecurrence tests: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);

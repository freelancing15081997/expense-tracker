import { toPaise, fromPaise, addPaise, entryTypeToTx, txToEntryType, MONEY_KIND_OPTIONS } from '../src/lib/money-core';
import { summarizeExpenses, whatIfReduceCategory } from '../src/lib/money-reports';
import { parseNaturalLanguageSearch, detectAnomalies, applyUserRules } from '../src/lib/money-intelligence';
import { buildCapturePreview } from '../src/lib/money-capture';
import { parseBankSms } from '../src/lib/bridge-automations';
import { buildEqualPersonSplits, suggestSettlements } from '../src/lib/money-splits';
import { learnRuleFromCorrection, buildEvidenceTrail, equalSplitShares } from '../src/lib/money-helpers';

let passed = 0;
let failed = 0;

function assert(cond: boolean, label: string) {
  if (cond) { passed += 1; console.log(`  ✓ ${label}`); }
  else { failed += 1; console.error(`  ✗ ${label}`); }
}

console.log('Money core');
assert(toPaise(349.99) === 34999, 'toPaise rounds correctly');
assert(fromPaise(34999) === 349.99, 'fromPaise converts back');
assert(addPaise(100, 250) === 350, 'addPaise integer safe');
assert(entryTypeToTx('in') === 'INCOME', 'entry in → INCOME');
assert(txToEntryType('TRANSFER') === 'transfer', 'TRANSFER → transfer entry');
assert(MONEY_KIND_OPTIONS.length === 8, '8 money kind options');

console.log('UPI / SMS parsing');
const sms = parseBankSms('Rs.499 debited from A/c **1234 on 14-09-26 UPI/Swiggy swiggy@ybl UTR 123456789012');
assert(Boolean(sms && sms.amount === 499), 'PhonePe-style SMS amount');
const cap = buildCapturePreview('Swiggy 349 upi', 'sms', [], [], []);
assert(cap.amountPaise === 34900, 'quick line capture amount');
assert(cap.direction === 'MONEY_OUT', 'quick line direction out');

console.log('Reports');
const sample = [
  { id: '1', amount: 500, entryType: 'out', category: 'Food', date: '2026-09-10', merchant: 'Swiggy' },
  { id: '2', amount: 20000, entryType: 'in', category: 'Salary', date: '2026-09-01' },
  { id: '3', amount: 500, entryType: 'out', category: 'Food', date: '2026-09-12', merchant: 'Zomato' },
];
const summary = summarizeExpenses(sample);
assert(summary.moneyOut === 1000, 'summary money out');
assert(summary.moneyIn === 20000, 'summary money in');
assert(summary.topCategories[0]?.name === 'Food', 'top category Food');

console.log('Natural language search');
const nl = parseNaturalLanguageSearch('Food spending above ₹400');
assert(nl.category === 'Food', 'NL food category');
assert(nl.minAmount === 400, 'NL min amount');

console.log('User rules');
const ruled = applyUserRules({ description: 'amazon order', merchant: 'Amazon' }, [{
  id: 'r1', match: 'amazon', field: 'any', category: 'Household',
}]);
assert(ruled.category === 'Household', 'user rule overrides category');
const learned = learnRuleFromCorrection({
  beforeCategory: 'Shopping',
  afterCategory: 'Household',
  merchant: 'Amazon',
  existing: [],
});
assert(learned[0]?.category === 'Household', 'learns from correction');

console.log('Anomaly detection');
const big = [
  ...sample,
  { id: '4', amount: 50000, entryType: 'out', category: 'Travel', date: '2026-09-11' },
  { id: '5', amount: 120, entryType: 'out', category: 'Food', date: '2026-09-08' },
  { id: '6', amount: 90, entryType: 'out', category: 'Food', date: '2026-09-07' },
];
assert(detectAnomalies(big).some((a) => a.kind === 'amount'), 'flags high amount');

console.log('Splits / settlements');
const splits = equalSplitShares(10000, [{ uid: 'a', name: 'A' }, { uid: 'b', name: 'B' }]);
assert(splits[0].sharePaise + splits[1].sharePaise === 10000, 'equal split totals');
const book = { roles: { a: { email: 'a@x.com' }, b: { email: 'b@x.com' } } };
const personSplits = buildEqualPersonSplits(100, book).map((s, i) => ({ ...s, paidPaise: i === 0 ? 10000 : 0 }));
const suggested = suggestSettlements([{ id: '1', personSplits }], [], [{ uid: 'a', name: 'A' }, { uid: 'b', name: 'B' }]);
assert(suggested.length >= 1, 'suggests settlement');

console.log('Evidence trail');
const trail = buildEvidenceTrail({ source: 'email', upiRef: 'UTR123', category: 'Food', entryType: 'out' });
assert(trail.some((s) => s.label === 'Source'), 'evidence has source');

console.log('What-if');
const wi = whatIfReduceCategory(sample, 'Food', 20);
assert(wi.projectedSaving > 0, 'what-if saving > 0');

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);

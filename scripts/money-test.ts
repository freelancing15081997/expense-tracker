import { toPaise, fromPaise, addPaise, entryTypeToTx, txToEntryType, MONEY_KIND_OPTIONS } from '../src/lib/money-core';
import { summarizeExpenses, whatIfReduceCategory } from '../src/lib/money-reports';
import { parseNaturalLanguageSearch, detectAnomalies, applyUserRules } from '../src/lib/money-intelligence';
import { buildCapturePreview } from '../src/lib/money-capture';
import { parseBankSms } from '../src/lib/bridge-automations';
import { buildEqualPersonSplits, fillLockedAmounts, suggestSettlements } from '../src/lib/money-splits';
import { learnRuleFromCorrection, buildEvidenceTrail, equalSplitShares } from '../src/lib/money-helpers';
import { nearDupeIds } from '../src/lib/ledger-advanced';
import { matchDuplicateExpenses } from '../src/lib/duplicate-match';

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
const locked = fillLockedAmounts(90000, [
  { amountPaise: 5000, locked: true },
  { amountPaise: 0, locked: false },
  { amountPaise: 0, locked: false },
], 'partial');
assert(locked.ok && locked.amounts[0] === 5000 && locked.amounts[1] === 42500 && locked.amounts[2] === 42500, '₹50 of ₹900 remaining equalizes');
const auto3 = fillLockedAmounts(90000, [{}, {}, {}], 'automatic');
assert(auto3.ok && auto3.amounts.reduce((s, n) => s + n, 0) === 90000, 'automatic 3-way totals 900');

console.log('Evidence trail');
const trail = buildEvidenceTrail({ source: 'email', upiRef: 'UTR123', category: 'Food', entryType: 'out' });
assert(trail.some((s) => s.label === 'Source'), 'evidence has source');

console.log('What-if');
const wi = whatIfReduceCategory(sample, 'Food', 20);
assert(wi.projectedSaving > 0, 'what-if saving > 0');

console.log('Duplicates');
{
  const ledger = [
    { id: 'e1', amount: 182961, date: '2026-09-14', description: 'CRED bill', merchant: 'CRED', receiptHash: 'abc123', upiRef: 'UTR998877', invoiceNumber: 'INV-4401', entryType: 'out' },
    { id: 'e2', amount: 400, date: '2026-09-14', description: 'Swiggy', merchant: 'Swiggy', receiptHash: 'zzz', entryType: 'out' },
  ];
  const byHash = matchDuplicateExpenses(ledger, { receiptHash: 'abc123', amount: 0 });
  assert(byHash[0]?.id === 'e1' && byHash[0].reason === 'receipt_hash', 'same file hash is a duplicate');
  const byUpi = matchDuplicateExpenses(ledger, { upiRef: 'UTR998877' });
  assert(byUpi[0]?.reason === 'upi_ref', 'same UPI ref is a duplicate');
  const byInv = matchDuplicateExpenses(ledger, { amount: 182961, invoiceNumber: 'INV-4401' });
  assert(byInv[0]?.reason === 'invoice', 'same invoice + amount is a duplicate');
  const exact = matchDuplicateExpenses(ledger, { amount: 182961, date: '2026-09-14', description: 'CRED bill' });
  assert(exact[0]?.reason === 'exact', 'same amount+date+description is a duplicate');
  const soft = matchDuplicateExpenses(ledger, { date: '2026-09-14', merchant: 'CRED', amount: 4, allowSoft: true });
  assert(soft[0]?.reason === 'soft_merchant', 're-parse with drifted amount still flags same merchant');
  const skipSelf = matchDuplicateExpenses(ledger, { receiptHash: 'abc123', exceptId: 'e1' });
  assert(skipSelf.length === 0, 'exceptId is not treated as a duplicate of itself');
  const fresh = matchDuplicateExpenses(ledger, { amount: 99, date: '2026-09-15', description: 'New cafe', merchant: 'Cafe' });
  assert(fresh.length === 0, 'different receipt is not a duplicate');
  const near = nearDupeIds([
    { id: 'a', amount: 500, date: '2026-09-10', description: 'Swiggy lunch', entryType: 'out' },
    { id: 'b', amount: 500, date: '2026-09-11', description: 'Swiggy', entryType: 'out' },
    { id: 'c', amount: 120, date: '2026-09-11', description: 'Uber', entryType: 'out' },
  ]);
  assert(near.has('a') && near.has('b') && !near.has('c'), 'near-dupe flags same amount in 3-day window');
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);

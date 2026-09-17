/**
 * Unit tests for purpose detection, confidence, and financial memory.
 * Run: npx tsx scripts/purpose-intelligence-test.ts
 */
import {
  detectPurposeFromName,
  getPurposeTemplate,
  suggestCustomPurposeConfig,
  PURPOSE_TEMPLATES,
} from '../src/lib/purpose-templates';
import { buildConfidence, mayAutoProcess, needsConfirmation, levelFromScore } from '../src/lib/confidence-engine';
import { searchFinancialMemory, detectLifeEvents, buildAttentionInbox } from '../src/lib/financial-memory';
import { classifyCapture } from '../src/lib/money-intelligence';
import { extractWarrantyHints } from '../src/lib/warranty-extract';

let passed = 0;
let failed = 0;

function assert(cond: boolean, msg: string) {
  if (cond) {
    passed += 1;
    console.log(`  ✓ ${msg}`);
  } else {
    failed += 1;
    console.error(`  ✗ ${msg}`);
  }
}

console.log('\nPurpose templates');
assert(PURPOSE_TEMPLATES.some((t) => t.id === 'default'), 'default template exists');
assert(PURPOSE_TEMPLATES.some((t) => t.id === 'trip'), 'trip template exists');
assert(getPurposeTemplate('trip').quickActions.includes('split'), 'trip has split action');
assert(getPurposeTemplate('unknown').id === 'default', 'unknown purpose falls back to default');

console.log('\nPurpose name detection');
const goa = detectPurposeFromName('Goa Trip 2026');
assert(!!goa && goa.purposeId === 'trip' && goa.confidence === 'high', 'Goa Trip → trip high');
const wedding = detectPurposeFromName('My Wedding');
assert(!!wedding && wedding.purposeId === 'wedding', 'My Wedding → wedding');
const bike = detectPurposeFromName('Bike Expenses');
assert(!!bike && bike.purposeId === 'vehicle', 'Bike Expenses → vehicle');
assert(detectPurposeFromName('Random XYZ') === null, 'unrelated name → null');

console.log('\nCustom purpose suggestion');
const cricket = suggestCustomPurposeConfig('Cricket tournament');
assert(cricket.categories.includes('Teams') && cricket.categories.includes('Ground'), 'cricket suggests teams/ground');
assert(cricket.isAiStyle === true, 'custom marked as suggested config');

console.log('\nConfidence engine');
assert(levelFromScore(90) === 'high', 'score 90 → high');
assert(levelFromScore(55) === 'medium', 'score 55 → medium');
assert(levelFromScore(20) === 'low', 'score 20 → low');
const high = buildConfidence(['rule', 'history', 'merchant'], [40, 20]);
assert(mayAutoProcess(high), 'high confidence may auto-process');
const low = buildConfidence(['weak']);
assert(needsConfirmation(low), 'low confidence needs confirmation');

console.log('\nClassify capture confidence');
const classified = classifyCapture(
  { description: 'Swiggy lunch', merchant: '', amount: 320, date: '2026-03-01' },
  [],
  [],
  [{ id: '1', merchant: 'Swiggy', category: 'Food & Dining', amount: 300, date: '2026-02-01', entryType: 'out' }],
);
assert(Boolean(classified.confidence), 'classify returns confidence');
assert(typeof classified.draft.confidenceScore === 'number', 'draft has confidenceScore');

console.log('\nFinancial memory search');
const hits = searchFinancialMemory(
  [
    { id: 'a', description: 'Laptop from Amazon', merchant: 'Amazon', amount: 52000, date: '2025-11-01', category: 'Shopping', receiptHash: 'x' },
    { id: 'b', description: 'Coffee', merchant: 'CCD', amount: 180, date: '2026-01-02', category: 'Food' },
  ],
  'laptop amazon receipt',
);
assert(hits.length >= 1 && hits[0].id === 'a', 'finds laptop purchase');

console.log('\nLife events');
const events = detectLifeEvents([
  { id: '1', date: '2026-01-05', entryType: 'out', category: 'Travel', amount: 8000, description: 'flight' },
  { id: '2', date: '2026-01-06', entryType: 'out', category: 'Hotel', amount: 6000, description: 'hotel' },
  { id: '3', date: '2026-01-06', entryType: 'out', category: 'Fuel', amount: 2000, description: 'petrol' },
  { id: '4', date: '2026-01-07', entryType: 'out', category: 'Food & Dining', amount: 1500, description: 'dinner' },
  { id: '5', date: '2026-01-08', entryType: 'out', category: 'Travel', amount: 900, description: 'parking' },
]);
assert(events.some((e) => e.kind === 'trip'), 'detects possible trip cluster');

console.log('\nAttention inbox');
const inbox = buildAttentionInbox({
  drafts: [{ id: 'd1', description: 'Draft', bookId: 'b1' }],
  pendingSplits: 2,
});
assert(inbox.some((i) => i.kind === 'receipt_review'), 'draft → receipt review');
assert(inbox.some((i) => i.kind === 'split'), 'pending splits item');
assert(buildAttentionInbox({}).length === 0, 'empty inbox when nothing pending');

console.log('\nWarranty extract');
const w = extractWarrantyHints({
  text: 'Warranty 1 year. Return within 7 days.',
  purchaseDate: '2026-01-01',
  merchant: 'Store',
});
assert(!!w && w.warrantyDays === 365 && w.returnDays === 7, 'parses warranty and return');
assert(extractWarrantyHints({ text: 'Thank you for shopping' }) === null, 'no invent when absent');

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);

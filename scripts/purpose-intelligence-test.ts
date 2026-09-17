/**
 * Unit tests for purpose detection, confidence, and financial memory.
 * Run: npx tsx scripts/purpose-intelligence-test.ts
 */
import {
  detectPurposeFromName,
  getPurposeTemplate,
  purposeFieldMeta,
  categoryForQuickAction,
  suggestCustomPurposeConfig,
  PURPOSE_TEMPLATES,
} from '../src/lib/purpose-templates';
import { FEATURE_CATALOG, applyFeatureToggle, appRoleFromBooks, buildFeatureTree, hrefFeature, normalizeFeatures, resolveFeatures, MEMBER_FEATURES } from '../src/lib/features';
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

console.log('\nPurpose entry fields');
const tripFields = purposeFieldMeta(getPurposeTemplate('trip'));
assert(tripFields.categoryLabel.toLowerCase().includes('trip'), 'trip category label');
assert(/hotel/i.test(tripFields.merchantLabel), 'trip merchant label uses Hotel');
assert(tripFields.entities.includes('Hotel'), 'trip entities include Hotel');
assert(categoryForQuickAction('fuel', getPurposeTemplate('vehicle').categories) === 'Fuel', 'vehicle fuel action → Fuel');
assert(categoryForQuickAction('material', getPurposeTemplate('construction').categories) === 'Material', 'construction material → Material');

console.log('\nAccess feature tree');
assert(FEATURE_CATALOG.some((row) => row.key === 'money_email_tab'), 'email tab is a controllable feature');
assert(FEATURE_CATALOG.some((row) => row.key === 'money_split_tab'), 'splits tab is a controllable feature');
assert(FEATURE_CATALOG.some((row) => row.key === 'money_book_analytics'), 'book reports tab is a controllable feature');
assert(FEATURE_CATALOG.some((row) => row.key === 'money_announce'), 'announce is a controllable action');
assert(FEATURE_CATALOG.some((row) => row.key === 'act_books_invoices_create'), 'invoice create is a controllable action');
assert(buildFeatureTree('Money').some((n) => n.key === 'money' && n.children.some((c) => c.key === 'money_email' && c.children.some((a) => a.key === 'money_email_tab'))), 'money → email → email tab');
assert(FEATURE_CATALOG.some((row) => row.href === '/books/customers'), 'customers is a business action');
assert(buildFeatureTree('Business').some((n) => n.key === 'business' && n.children.some((c) => c.key === 'sales' && c.children.length > 0)), 'business → sales → actions');
assert(hrefFeature('/books/invoices')?.startsWith('act_'), 'invoice href maps to action key');
const inherited = normalizeFeatures({ sales: true }, MEMBER_FEATURES);
assert(inherited.sales === true && inherited.business === true, 'sales on inherits business parent');
assert(inherited[hrefFeature('/books/customers') || ''] === true, 'sales on inherits customer action');
const offMoney = applyFeatureToggle({ ...MEMBER_FEATURES, money: true, money_add: true }, 'money');
assert(offMoney.money === false && offMoney.money_add === false, 'turning money off hides add');

console.log('\nRole defaults apply to default users');
const roleOffScan = resolveFeatures('u1', false, [], undefined, 'DEFAULT_USER', {
  DEFAULT_USER: { ...MEMBER_FEATURES, money_scan: false, money_reports: false },
});
assert(roleOffScan.money_scan === false, 'DEFAULT_USER can disable scan');
assert(roleOffScan.money_reports === false, 'DEFAULT_USER can disable reports');
assert(roleOffScan.money_add === true, 'untoggled DEFAULT_USER keys stay on');
const personOverride = resolveFeatures('u1', false, [], { money_scan: true }, 'DEFAULT_USER', {
  DEFAULT_USER: { ...MEMBER_FEATURES, money_scan: false },
});
assert(personOverride.money_scan === true, 'person override wins over DEFAULT_USER');
const noOverride = resolveFeatures('u1', false, [], undefined, 'DEFAULT_USER', {
  DEFAULT_USER: { ...MEMBER_FEATURES, money_scan: false },
});
assert(noOverride.money_scan === false, 'missing profile features uses role');
assert(appRoleFromBooks('u1', [{ ownerId: 'u1', roles: { u1: { role: 'owner' } } }]) === 'DEFAULT_USER', 'book owner uses DEFAULT_USER features');
assert(appRoleFromBooks('u2', [{ ownerId: 'u1', roles: { u2: { role: 'viewer' } } }]) === 'viewer', 'book viewer maps to viewer role');
assert(appRoleFromBooks('u1', [
  { ownerId: 'u1', roles: { u1: { role: 'owner' } } },
  { ownerId: 'u9', roles: { u1: { role: 'viewer' } } },
]) === 'DEFAULT_USER', 'owning any book keeps DEFAULT_USER');
assert(appRoleFromBooks('u3', [{ ownerId: 'u1', roles: { u3: { role: 'contributor' } } }]) === 'contributor', 'can-add member maps to contributor');

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);

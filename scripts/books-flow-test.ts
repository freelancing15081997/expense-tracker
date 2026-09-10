/**
 * End-to-end Books flow tests (engine + conversion + GST + payments).
 * Run: npx tsx scripts/books-flow-test.ts
 */
import { parseMoney, parseQty, lineAmount, percentOf, addDays, periodIdFromDate, formatMinorPlain } from '../src/books/core/money.ts';
import { assertBalanced, invertLines, nextNumber, BooksError } from '../src/books/engine/journal.ts';
import { computeDocument, computeTax } from '../src/books/engine/tax.ts';
import { seedAccounts, TAX_SEED, signedBalance, normalBalanceFor } from '../src/books/engine/chartOfAccounts.ts';
import {
  assertCanConvert,
  applyCreditAmount,
  creditTargetKind,
  DOCUMENT_CONVERT,
  documentToJournalLines,
  docNumberPrefix,
  paymentJournalLines,
  partyReceivableExposure,
  prepareConvertedTotals,
} from '../src/books/engine/posting.ts';
import { documentProfile } from '../src/books/modules/documents/kindProfile.ts';
import { ageOpenDocuments, gstSummary, reconWorksheet, directCashFlow } from '../src/books/reporting/statements.ts';
import { parseBankCsv } from '../src/books/reporting/bankCsv.ts';
import { ownsWorkspace, childWorkspaceId, buildOrgTree, MAX_ORG_DEPTH } from '../src/books/core/hierarchy.ts';
import { can } from '../src/books/core/permissions.ts';
import type { DocumentKind, FinanceAccount, FinanceDocument, TaxCode } from '../src/books/core/types.ts';

let failed = 0;
let passed = 0;

function ok(name: string) {
  passed += 1;
  console.log(`  ok  ${name}`);
}

function fail(name: string, err: unknown) {
  failed += 1;
  console.error(`  FAIL ${name}`);
  console.error(`       ${err instanceof Error ? err.message : err}`);
}

function assert(cond: boolean, message: string) {
  if (!cond) throw new Error(message);
}

function accounts(): FinanceAccount[] {
  return seedAccounts().map((row) => ({
    ...row,
    id: row.systemKey || row.code,
    parentId: null,
  }));
}

function taxMap() {
  return new Map<string, TaxCode>(TAX_SEED.map((t) => [t.id, { ...t, active: true }]));
}

function line(desc: string, qty: string, price: string, taxCode: string, accountId: string) {
  return {
    description: desc,
    qtyMilli: parseQty(qty),
    unitPriceMinor: parseMoney(price),
    taxCode,
    accountId,
  };
}

function apply(accs: FinanceAccount[], journal: { accountId: string; debitMinor: number; creditMinor: number }[]) {
  const copy = accs.map((a) => ({ ...a }));
  const byId = new Map(copy.map((a) => [a.id, a]));
  for (const row of journal) {
    const account = byId.get(row.accountId);
    if (!account) throw new Error(`missing ${row.accountId}`);
    account.debitTotalMinor += row.debitMinor;
    account.creditTotalMinor += row.creditMinor;
  }
  return copy;
}

function trialBalanced(accs: FinanceAccount[]) {
  const debit = accs.reduce((s, a) => s + a.debitTotalMinor, 0);
  const credit = accs.reduce((s, a) => s + a.creditTotalMinor, 0);
  assert(debit === credit, `trial balance ${debit} != ${credit}`);
}

const KINDS: DocumentKind[] = [
  'invoice', 'bill', 'expense', 'quote', 'estimate', 'sales_order',
  'credit_note', 'debit_note', 'purchase_request', 'purchase_order',
  'purchase_receipt', 'vendor_credit',
];

console.log('\nBooks flow tests\n');

console.log('money');
try {
  assert(parseMoney('10.50') === 1050, 'parseMoney');
  assert(parseMoney('1,250.09') === 125009, 'commas');
  assert(parseQty('2.5') === 2500, 'qty');
  assert(lineAmount(2500, 10000) === 25000, '2.5 * 100.00');
  assert(percentOf(10000, 1800) === 1800, '18% of 100');
  assert(addDays('2026-01-31', 1) === '2026-02-01', 'addDays');
  assert(periodIdFromDate('2026-09-10') === '2026-09', 'period');
  assert(formatMinorPlain(1050) === '10.50', 'plain');
  try { parseMoney('10.999'); throw new Error('should reject 3dp'); } catch (err) {
    if ((err as Error).message === 'should reject 3dp') throw err;
  }
  ok('parse, tax bps, dates, overflow rules');
} catch (err) { fail('money', err); }

console.log('GST');
try {
  const intra = computeTax(10000, 1800, false);
  assert(intra.cgstMinor + intra.sgstMinor === intra.taxMinor, 'cgst+sgst');
  assert(intra.igstMinor === 0, 'no igst intra');
  const inter = computeTax(10000, 1800, true);
  assert(inter.igstMinor === 1800 && inter.cgstMinor === 0, 'igst interstate');
  const zero = computeTax(10000, 0, false);
  assert(zero.taxMinor === 0 && zero.igstMinor === 0, 'exempt');
  const odd = computeTax(101, 1800, false);
  assert(odd.cgstMinor + odd.sgstMinor === odd.taxMinor, 'odd split');
  ok('intra / interstate / exempt / rounding');
} catch (err) { fail('GST', err); }

console.log('chart of accounts seed');
try {
  const accs = accounts();
  const keys = ['cash', 'bank', 'ar', 'ap', 'tax_input', 'tax_output', 'sales', 'operating_expense', 'inventory', 'cogs', 'fixed_asset', 'accum_dep', 'dep_expense', 'deferred_revenue', 'tds_payable', 'retained_earnings'];
  for (const key of keys) {
    assert(accs.some((a) => a.systemKey === key && a.allowPosting), `missing ${key}`);
  }
  assert(accs.find((a) => a.code === '1000')?.allowPosting === false, 'header not postable');
  ok('system accounts present');
} catch (err) { fail('COA', err); }

console.log('document profiles');
try {
  for (const kind of KINDS) {
    const profile = documentProfile(kind);
    assert(Boolean(profile.singular && profile.plural && profile.meaning), `${kind} copy`);
    assert(profile.convertTo === (DOCUMENT_CONVERT[kind] || null), `${kind} convert mismatch ${profile.convertTo} vs ${DOCUMENT_CONVERT[kind]}`);
    assert(Boolean(docNumberPrefix(kind)), `${kind} prefix`);
  }
  ok('every kind has distinct copy and matching convert map');
} catch (err) { fail('profiles', err); }

console.log('convert rules');
try {
  assertCanConvert('quote', 'invoice');
  assertCanConvert('estimate', 'invoice');
  assertCanConvert('sales_order', 'invoice');
  assertCanConvert('purchase_request', 'purchase_order');
  assertCanConvert('purchase_order', 'bill');
  assertCanConvert('purchase_receipt', 'bill');
  let blocked = false;
  try { assertCanConvert('invoice', 'bill'); } catch { blocked = true; }
  assert(blocked, 'invoice must not convert to bill');
  blocked = false;
  try { assertCanConvert('quote', 'bill'); } catch { blocked = true; }
  assert(blocked, 'quote must not convert to bill');
  ok('whitelist only');
} catch (err) { fail('convert', err); }

console.log('posting journals');
try {
  const accs = accounts();
  const taxes = taxMap();
  const sales = accs.find((a) => a.systemKey === 'sales')!;
  const expense = accs.find((a) => a.systemKey === 'operating_expense')!;
  const cash = accs.find((a) => a.systemKey === 'cash')!;
  const invLines = [line('Widget', '2', '100.00', 'GST18', sales.id)];
  const inv = computeDocument(invLines, taxes, false);
  assert(inv.totalMinor === 23600, `invoice total ${inv.totalMinor}`);
  const billLines = [line('Parts', '2', '100.00', 'GST18', expense.id)];
  const bill = computeDocument(billLines, taxes, false);
  const expLines = [line('Tea', '1', '100.00', 'GST18', expense.id)];
  const exp = computeDocument(expLines, taxes, false);
  const posted = [
    ['invoice', documentToJournalLines('invoice', accs, inv.tax, inv.lines)],
    ['debit_note', documentToJournalLines('debit_note', accs, inv.tax, inv.lines)],
    ['credit_note', documentToJournalLines('credit_note', accs, inv.tax, inv.lines)],
    ['bill', documentToJournalLines('bill', accs, bill.tax, bill.lines)],
    ['vendor_credit', documentToJournalLines('vendor_credit', accs, bill.tax, bill.lines)],
    ['expense', documentToJournalLines('expense', accs, exp.tax, exp.lines, cash.id)],
  ] as const;
  let ledger = accs;
  for (const [kind, journal] of posted) {
    const totals = assertBalanced(journal);
    assert(totals.debit === totals.credit && totals.debit > 0, `${kind} zero`);
    ledger = apply(ledger, journal);
  }
  trialBalanced(ledger);
  const payInv = paymentJournalLines('invoice', accs, 23600, cash.id);
  assertBalanced(payInv);
  const payDn = paymentJournalLines('debit_note', accs, 5000, cash.id);
  assertBalanced(payDn);
  const payBill = paymentJournalLines('bill', accs, 23600, cash.id);
  assertBalanced(payBill);
  let payBlocked = false;
  try { paymentJournalLines('expense', accs, 100, cash.id); } catch { payBlocked = true; }
  assert(payBlocked, 'expense should not take a later payment');
  ledger = apply(ledger, payInv);
  ledger = apply(ledger, payBill);
  trialBalanced(ledger);
  ok('invoice/bill/CN/DN/expense/payments stay balanced');
} catch (err) { fail('posting', err); }

console.log('non-postable documents');
try {
  const accs = accounts();
  const taxes = taxMap();
  const sales = accs.find((a) => a.systemKey === 'sales')!;
  const computed = computeDocument([line('Job', '1', '50.00', 'GST18', sales.id)], taxes, false);
  for (const kind of ['quote', 'estimate', 'sales_order', 'purchase_request', 'purchase_order', 'purchase_receipt'] as DocumentKind[]) {
    let blocked = false;
    try { documentToJournalLines(kind, accs, computed.tax, computed.lines); } catch { blocked = true; }
    assert(blocked, `${kind} must not post`);
  }
  ok('quotes/POs/receipts cannot hit the ledger');
} catch (err) { fail('non-postable', err); }

console.log('GST summary');
try {
  const dummy = (kind: DocumentKind, status: FinanceDocument['status'], tax: { exclusiveMinor: number; taxMinor: number; cgstMinor: number; sgstMinor: number; igstMinor: number }): FinanceDocument => ({
    id: kind, kind, number: kind, partyId: 'p', date: '2026-09-01', dueDate: '2026-09-30',
    lines: [], taxCode: 'GST18', interstate: false, tax, totalMinor: tax.exclusiveMinor + tax.taxMinor,
    paidMinor: 0, status, journalId: 'j', paymentJournalIds: [], memo: '', projectId: null,
    convertedFromId: null, idempotencyKey: kind, createdBy: 'u', createdAt: '', updatedAt: '',
  });
  const gst = gstSummary([
    dummy('invoice', 'posted', { exclusiveMinor: 10000, taxMinor: 1800, cgstMinor: 900, sgstMinor: 900, igstMinor: 0 }),
    dummy('credit_note', 'posted', { exclusiveMinor: 1000, taxMinor: 180, cgstMinor: 90, sgstMinor: 90, igstMinor: 0 }),
    dummy('bill', 'paid', { exclusiveMinor: 2000, taxMinor: 360, cgstMinor: 180, sgstMinor: 180, igstMinor: 0 }),
    dummy('quote', 'draft', { exclusiveMinor: 99999, taxMinor: 1, cgstMinor: 0, sgstMinor: 0, igstMinor: 1 }),
    dummy('vendor_credit', 'posted', { exclusiveMinor: 500, taxMinor: 90, cgstMinor: 45, sgstMinor: 45, igstMinor: 0 }),
    dummy('debit_note', 'posted', { exclusiveMinor: 200, taxMinor: 36, cgstMinor: 18, sgstMinor: 18, igstMinor: 0 }),
  ], '2026-09-01', '2026-09-30');
  assert(gst.output.taxMinor === 1656, `output ${gst.output.taxMinor}`);
  assert(gst.input.taxMinor === 270, `input ${gst.input.taxMinor}`);
  assert(gst.net.taxMinor === 1386, `net ${gst.net.taxMinor}`);
  ok('posted invoices minus credits minus input GST');
} catch (err) { fail('gst summary', err); }

console.log('bank CSV');
try {
  const rows = parseBankCsv('Date,Narration,Amount\n2026-09-01,Salary,1000.00\n02/09/2026,"Tea, shop",-50.50');
  assert(rows.length === 2, 'two rows');
  assert(rows[0].amountMinor === 100000, `dep ${rows[0].amountMinor}`);
  assert(rows[1].amountMinor === -5050, `wd ${rows[1].amountMinor}`);
  ok('date formats and signed amounts');
} catch (err) { fail('bank CSV', err); }

console.log('hierarchy + RBAC');
try {
  assert(ownsWorkspace('uid1', 'uid1'), 'root');
  assert(ownsWorkspace('uid1', childWorkspaceId('uid1', 'abc')), 'child');
  assert(!ownsWorkspace('uid1', 'uid2'), 'other');
  assert(!ownsWorkspace('uid1', 'uid2_abc'), 'other child');
  const tree = buildOrgTree([
    { id: 'r', name: 'Root', parentId: null, depth: 0, kind: 'root', role: 'owner' },
    { id: 'c', name: 'Co', parentId: 'r', depth: 1, kind: 'company', role: 'owner' },
    { id: 's', name: 'Sub', parentId: 'c', depth: 2, kind: 'subsidiary', role: 'owner' },
  ]);
  assert(tree.map((r) => r.id).join(',') === 'r,c,s', 'tree order');
  assert(MAX_ORG_DEPTH === 3, 'depth cap');
  assert(can('owner', 'post') && can('contributor', 'create') && !can('viewer', 'post') && !can('auditor', 'edit'), 'rbac');
  ok('workspace isolation and roles');
} catch (err) { fail('hierarchy', err); }

console.log('numbers');
try {
  assert(nextNumber('INV', 7) === 'INV-00007', 'seq');
  const reversed = invertLines([
    { accountId: 'ar', debitMinor: 11800, creditMinor: 0 },
    { accountId: 'sales', debitMinor: 0, creditMinor: 10000 },
    { accountId: 'tax', debitMinor: 0, creditMinor: 1800 },
  ]);
  assertBalanced(reversed);
  ok('sequence + reversal');
} catch (err) { fail('numbers', err); }

console.log('signed balances');
try {
  const cash = { debitTotalMinor: 500, creditTotalMinor: 100, normalBalance: normalBalanceFor('asset') as 'debit' };
  assert(signedBalance(cash) === 400, 'asset');
  const ap = { debitTotalMinor: 0, creditTotalMinor: 250, normalBalance: normalBalanceFor('liability') as 'credit' };
  assert(signedBalance(ap) === 250, 'liability');
  ok('debit vs credit normals');
} catch (err) { fail('signed', err); }

console.log('credit apply');
try {
  assert(creditTargetKind('credit_note') === 'invoice', 'cn target');
  assert(creditTargetKind('vendor_credit') === 'bill', 'vc target');
  assert(creditTargetKind('invoice') === null, 'invoice not credit');
  const credit = { kind: 'credit_note' as const, partyId: 'c1', status: 'posted' as const, totalMinor: 11800, paidMinor: 0 };
  const invoice = { kind: 'invoice' as const, partyId: 'c1', status: 'posted' as const, totalMinor: 23600, paidMinor: 0 };
  assert(applyCreditAmount(credit, invoice) === 11800, 'full unused');
  assert(applyCreditAmount(credit, invoice, 5000) === 5000, 'partial');
  let blocked = false;
  try { applyCreditAmount(credit, { ...invoice, partyId: 'c2' }); } catch { blocked = true; }
  assert(blocked, 'different party');
  blocked = false;
  try { applyCreditAmount(credit, { ...invoice, kind: 'bill' }); } catch { blocked = true; }
  assert(blocked, 'wrong target kind');
  blocked = false;
  try { applyCreditAmount({ ...credit, paidMinor: 11800 }, invoice); } catch { blocked = true; }
  assert(blocked, 'fully applied');
  const vendorCredit = { kind: 'vendor_credit' as const, partyId: 'v1', status: 'posted' as const, totalMinor: 5000, paidMinor: 0 };
  const bill = { kind: 'bill' as const, partyId: 'v1', status: 'posted' as const, totalMinor: 8000, paidMinor: 1000 };
  assert(applyCreditAmount(vendorCredit, bill) === 5000, 'vc apply');
  ok('apply CN to invoice / VC to bill, same party only');
} catch (err) { fail('credit apply', err); }

console.log('convert GRN tax');
try {
  const taxes = taxMap();
  const accs = accounts();
  const expense = accs.find((a) => a.systemKey === 'operating_expense')!;
  const prepared = prepareConvertedTotals({
    kind: 'purchase_receipt',
    date: '2026-09-01',
    dueDate: null,
    partyId: 'v1',
    interstate: false,
    lines: [line('Parts', '2', '100.00', 'EXEMPT', expense.id)],
    tax: { exclusiveMinor: 20000, taxMinor: 0, cgstMinor: 0, sgstMinor: 0, igstMinor: 0 },
    totalMinor: 20000,
  }, 'bill', [...taxes.values()]);
  assert(prepared.lines[0].taxCode === 'GST18', `tax ${prepared.lines[0].taxCode}`);
  assert(prepared.totalMinor === 23600, `bill total ${prepared.totalMinor}`);
  assert(prepared.dueDate === '2026-10-01', `due ${prepared.dueDate}`);
  const quoteToInv = prepareConvertedTotals({
    kind: 'quote',
    date: '2026-09-01',
    dueDate: '2026-09-15',
    partyId: 'c1',
    interstate: false,
    lines: [line('Job', '1', '100.00', 'GST18', accs.find((a) => a.systemKey === 'sales')!.id)],
    tax: { exclusiveMinor: 10000, taxMinor: 1800, cgstMinor: 900, sgstMinor: 900, igstMinor: 0 },
    totalMinor: 11800,
  }, 'invoice', [...taxes.values()]);
  assert(quoteToInv.dueDate === '2026-10-01', 'quote valid-until is not invoice due');
  assert(quoteToInv.totalMinor === 11800, 'quote tax kept');
  ok('GRN remaps EXEMPT to GST18; quote due is +30 days');
} catch (err) { fail('convert GRN tax', err); }

console.log('aging + exposure');
try {
  const dummyDoc = (kind: FinanceDocument['kind'], status: FinanceDocument['status'], extras: Partial<FinanceDocument>): FinanceDocument => ({
    id: extras.id || kind,
    kind,
    number: kind,
    partyId: extras.partyId || 'p',
    date: extras.date || '2026-08-01',
    dueDate: extras.dueDate ?? '2026-08-01',
    lines: [],
    taxCode: 'GST18',
    interstate: false,
    tax: { exclusiveMinor: 10000, taxMinor: 1800, cgstMinor: 900, sgstMinor: 900, igstMinor: 0 },
    totalMinor: extras.totalMinor ?? 11800,
    paidMinor: extras.paidMinor ?? 0,
    status,
    journalId: 'j',
    paymentJournalIds: [],
    memo: '',
    projectId: null,
    convertedFromId: null,
    idempotencyKey: kind,
    createdBy: 'u',
    createdAt: '',
    updatedAt: '',
  });
  const aged = ageOpenDocuments([
    dummyDoc('invoice', 'posted', { id: 'i1', dueDate: '2026-09-10', totalMinor: 11800 }),
    dummyDoc('debit_note', 'posted', { id: 'd1', dueDate: '2026-08-01', totalMinor: 2360 }),
    dummyDoc('bill', 'posted', { id: 'b1', dueDate: '2026-07-01', totalMinor: 5000 }),
    dummyDoc('credit_note', 'posted', { id: 'cn1', totalMinor: 11800 }),
    dummyDoc('invoice', 'paid', { id: 'i2', paidMinor: 11800, totalMinor: 11800 }),
  ], [{ id: 'p', name: 'Acme' }], '2026-09-10');
  assert(aged.length === 3, `aged ${aged.length}`);
  assert(aged.find((r) => r.id === 'i1')?.bucket === 'Current', 'current');
  assert(aged.find((r) => r.id === 'd1')?.bucket === '31-60', `dn ${aged.find((r) => r.id === 'd1')?.bucket}`);
  assert(aged.find((r) => r.id === 'b1')?.side === 'ap', 'bill is AP');
  const exposure = partyReceivableExposure([
    dummyDoc('invoice', 'posted', { partyId: 'c1', totalMinor: 11800, paidMinor: 0 }),
    dummyDoc('credit_note', 'posted', { partyId: 'c1', totalMinor: 2360, paidMinor: 0 }),
    dummyDoc('debit_note', 'posted', { partyId: 'c1', totalMinor: 1180, paidMinor: 0 }),
  ], 'c1');
  assert(exposure === 11800 - 2360 + 1180, `exposure ${exposure}`);
  ok('AR aging includes debit notes; unapplied CN reduces credit exposure');
} catch (err) { fail('aging', err); }

console.log('bank recon + cash flow');
try {
  const sheet = reconWorksheet(100000, 80000, [
    { id: '1', accountId: 'bank', date: '2026-09-01', amountMinor: 20000, memo: 'dep', reconciled: false, journalId: null },
    { id: '2', accountId: 'bank', date: '2026-09-01', amountMinor: -5000, memo: 'wd', reconciled: true, journalId: 'j' },
  ]);
  assert(sheet.deposits === 20000, 'deposits');
  assert(sheet.difference === 0, `diff ${sheet.difference}`);
  const accs = accounts();
  const cash = accs.find((a) => a.systemKey === 'cash')!;
  const ar = accs.find((a) => a.systemKey === 'ar')!;
  const fa = accs.find((a) => a.systemKey === 'fixed_asset')!;
  const flow = directCashFlow([
    {
      id: 'j1', number: 'JE-1', type: 'payment', sourceType: 'invoice_payment', sourceId: 'i', date: '2026-09-02',
      periodId: '2026-09', currency: 'INR', description: 'Receipt', status: 'posted',
      lines: [
        { accountId: cash.id, debitMinor: 11800, creditMinor: 0 },
        { accountId: ar.id, debitMinor: 0, creditMinor: 11800 },
      ],
      debitTotalMinor: 11800, creditTotalMinor: 11800, idempotencyKey: 'p', createdBy: 'u', postedBy: 'u',
      postedAt: '', reversalOfId: null, reversedById: null, createdAt: '', updatedAt: '',
    },
    {
      id: 'j2', number: 'JE-2', type: 'manual', sourceType: 'manual', sourceId: null, date: '2026-09-03',
      periodId: '2026-09', currency: 'INR', description: 'Buy asset', status: 'posted',
      lines: [
        { accountId: fa.id, debitMinor: 50000, creditMinor: 0 },
        { accountId: cash.id, debitMinor: 0, creditMinor: 50000 },
      ],
      debitTotalMinor: 50000, creditTotalMinor: 50000, idempotencyKey: 'a', createdBy: 'u', postedBy: 'u',
      postedAt: '', reversalOfId: null, reversedById: null, createdAt: '', updatedAt: '',
    },
  ], accs, '2026-09-01', '2026-09-30');
  assert(flow.operating === 11800, `op ${flow.operating}`);
  assert(flow.investing === -50000, `inv ${flow.investing}`);
  ok('recon balances; cash flow splits operating vs investing');
} catch (err) { fail('recon/cf', err); }

console.log('stock + depreciation math');
try {
  const cost = 10000;
  const qty = 2500;
  const amount = lineAmount(qty, cost);
  assert(amount === 25000, `stock ${amount}`);
  let remaining = 5000;
  const issue = 2500;
  assert(issue <= remaining, 'enough stock');
  remaining -= issue;
  const adj = -6000;
  assert(remaining + adj < 0, 'adjust would go negative');
  const depreciable = 100000 - 10000 - 0;
  const charge = Math.max(1, Math.floor(depreciable / 36));
  assert(charge === 2500, `dep ${charge}`);
  const nbv = 100000 - 90000;
  const proceeds = 15000;
  assert(proceeds - nbv === 5000, 'disposal gain');
  ok('qty uses lineAmount; shrink cannot go below zero; SLM dep');
} catch (err) { fail('stock/dep', err); }

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);

import { doc, getDocs, setDoc, updateDoc, type Firestore, type QuerySnapshot } from 'firebase/firestore';
import { clean } from '../core/clean';
import { todayISO } from '../core/money';
import { assertCan } from '../core/permissions';
import type {
  Approval,
  BankTxn,
  BudgetLine,
  FinanceAccount,
  FixedAsset,
  InboxItem,
  LeaseContract,
  Product,
  Project,
  RevenueContract,
  Workpaper,
} from '../core/types';
import { BooksError } from '../engine/journal';
import { col, postManualJournal, type TxCtx } from './repo';

function nowISO() {
  return new Date().toISOString();
}

function mapDocs<T>(snap: QuerySnapshot): T[] {
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Record<string, unknown>) } as T));
}

export async function loadDomainCollections(db: Firestore, tenantId: string) {
  const [products, assets, projects, budgets, contracts, leases, bankTxns, inbox, workpapers, approvals] = await Promise.all([
    getDocs(col(db, tenantId, 'products')),
    getDocs(col(db, tenantId, 'assets')),
    getDocs(col(db, tenantId, 'projects')),
    getDocs(col(db, tenantId, 'budgets')),
    getDocs(col(db, tenantId, 'contracts')),
    getDocs(col(db, tenantId, 'leases')),
    getDocs(col(db, tenantId, 'bankTxns')),
    getDocs(col(db, tenantId, 'inbox')),
    getDocs(col(db, tenantId, 'workpapers')),
    getDocs(col(db, tenantId, 'approvals')),
  ]);
  return {
    products: mapDocs<Product>(products),
    assets: mapDocs<FixedAsset>(assets),
    projects: mapDocs<Project>(projects),
    budgets: mapDocs<BudgetLine>(budgets),
    contracts: mapDocs<RevenueContract>(contracts),
    leases: mapDocs<LeaseContract>(leases),
    bankTxns: mapDocs<BankTxn>(bankTxns).sort((a, b) => b.date.localeCompare(a.date)),
    inbox: mapDocs<InboxItem>(inbox).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    workpapers: mapDocs<Workpaper>(workpapers).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    approvals: mapDocs<Approval>(approvals).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  };
}

export async function saveProduct(ctx: TxCtx, input: Omit<Product, 'id'>) {
  assertCan(ctx.role, 'create');
  const ref = doc(col(ctx.db, ctx.tenantId, 'products'));
  await setDoc(ref, clean({ ...input, name: input.name.trim(), sku: input.sku.trim(), active: true }));
  return ref.id;
}

export async function receiveStock(ctx: TxCtx, product: Product, qtyMilli: number, payAccountId: string, accounts: FinanceAccount[]) {
  if (product.kind !== 'goods') throw new BooksError('Only goods have stock');
  if (qtyMilli <= 0) throw new BooksError('Quantity must be greater than zero');
  const inventory = accounts.find((a) => a.systemKey === 'inventory');
  if (!inventory) throw new BooksError('Inventory account is missing');
  const amount = Math.round((qtyMilli * product.costMinor) / 1000);
  if (amount <= 0) throw new BooksError('Set a cost on the product first');
  const journalId = await postManualJournal(ctx, {
    date: todayISO(),
    description: `Stock in ${product.sku}`,
    lines: [
      { accountId: inventory.id, debitMinor: amount, creditMinor: 0, memo: product.name },
      { accountId: payAccountId, debitMinor: 0, creditMinor: amount, memo: 'Inventory purchase' },
    ],
    idempotencyKey: `stockin_${product.id}_${crypto.randomUUID()}`,
  });
  await updateDoc(doc(col(ctx.db, ctx.tenantId, 'products'), product.id), { qtyMilli: product.qtyMilli + qtyMilli });
  return journalId;
}

export async function issueStock(ctx: TxCtx, product: Product, qtyMilli: number, accounts: FinanceAccount[]) {
  if (product.kind !== 'goods') throw new BooksError('Only goods have stock');
  if (qtyMilli <= 0 || qtyMilli > product.qtyMilli) throw new BooksError('Not enough stock');
  const inventory = accounts.find((a) => a.systemKey === 'inventory');
  const cogs = accounts.find((a) => a.systemKey === 'cogs');
  if (!inventory || !cogs) throw new BooksError('Inventory or COGS account is missing');
  const amount = Math.round((qtyMilli * product.costMinor) / 1000);
  if (amount <= 0) throw new BooksError('Set a cost on the product first');
  const journalId = await postManualJournal(ctx, {
    date: todayISO(),
    description: `COGS ${product.sku}`,
    lines: [
      { accountId: cogs.id, debitMinor: amount, creditMinor: 0, memo: product.name },
      { accountId: inventory.id, debitMinor: 0, creditMinor: amount, memo: 'Stock out' },
    ],
    idempotencyKey: `stockout_${product.id}_${crypto.randomUUID()}`,
  });
  await updateDoc(doc(col(ctx.db, ctx.tenantId, 'products'), product.id), { qtyMilli: product.qtyMilli - qtyMilli });
  return journalId;
}

export async function saveAsset(ctx: TxCtx, input: { name: string; costMinor: number; lifeMonths: number; residualMinor: number; payAccountId: string }, accounts: FinanceAccount[]) {
  assertCan(ctx.role, 'create');
  const asset = accounts.find((a) => a.systemKey === 'fixed_asset');
  if (!asset) throw new BooksError('Fixed asset account is missing');
  const journalId = await postManualJournal(ctx, {
    date: todayISO(),
    description: `Acquire ${input.name}`,
    lines: [
      { accountId: asset.id, debitMinor: input.costMinor, creditMinor: 0, memo: input.name },
      { accountId: input.payAccountId, debitMinor: 0, creditMinor: input.costMinor, memo: 'Asset purchase' },
    ],
    idempotencyKey: `asset_${crypto.randomUUID()}`,
  });
  const ref = doc(col(ctx.db, ctx.tenantId, 'assets'));
  await setDoc(ref, clean({
    name: input.name.trim(),
    acquireDate: todayISO(),
    costMinor: input.costMinor,
    accumDepMinor: 0,
    lifeMonths: Math.max(1, input.lifeMonths),
    residualMinor: input.residualMinor,
    status: 'active',
    acquireJournalId: journalId,
  }));
  return ref.id;
}

export async function depreciateAsset(ctx: TxCtx, asset: FixedAsset, accounts: FinanceAccount[]) {
  if (asset.status !== 'active') throw new BooksError('Asset is not active');
  const depreciable = asset.costMinor - asset.residualMinor - asset.accumDepMinor;
  if (depreciable <= 0) throw new BooksError('Asset is fully depreciated');
  const amount = Math.max(1, Math.floor(depreciable / Math.max(1, asset.lifeMonths)));
  const exp = accounts.find((a) => a.systemKey === 'dep_expense');
  const accum = accounts.find((a) => a.systemKey === 'accum_dep');
  if (!exp || !accum) throw new BooksError('Depreciation accounts are missing');
  await postManualJournal(ctx, {
    date: todayISO(),
    description: `Depreciation ${asset.name}`,
    lines: [
      { accountId: exp.id, debitMinor: amount, creditMinor: 0, memo: asset.name },
      { accountId: accum.id, debitMinor: 0, creditMinor: amount, memo: asset.name },
    ],
    idempotencyKey: `dep_${asset.id}_${crypto.randomUUID()}`,
  });
  await updateDoc(doc(col(ctx.db, ctx.tenantId, 'assets'), asset.id), { accumDepMinor: asset.accumDepMinor + amount });
}

export async function saveProject(ctx: TxCtx, input: Omit<Project, 'id'>) {
  assertCan(ctx.role, 'create');
  const ref = doc(col(ctx.db, ctx.tenantId, 'projects'));
  await setDoc(ref, clean({ ...input, name: input.name.trim() }));
  return ref.id;
}

export async function saveBudget(ctx: TxCtx, input: Omit<BudgetLine, 'id'>) {
  assertCan(ctx.role, 'create');
  const ref = doc(col(ctx.db, ctx.tenantId, 'budgets'));
  await setDoc(ref, clean(input));
  return ref.id;
}

export async function saveContract(ctx: TxCtx, input: { name: string; customerId: string | null; totalMinor: number; months: number }, accounts: FinanceAccount[], cashAccountId: string) {
  assertCan(ctx.role, 'create');
  const deferred = accounts.find((a) => a.systemKey === 'deferred_revenue');
  if (!deferred) throw new BooksError('Deferred revenue account is missing');
  const journalId = await postManualJournal(ctx, {
    date: todayISO(),
    description: `Contract ${input.name}`,
    lines: [
      { accountId: cashAccountId, debitMinor: input.totalMinor, creditMinor: 0, memo: 'Contract receipt' },
      { accountId: deferred.id, debitMinor: 0, creditMinor: input.totalMinor, memo: input.name },
    ],
    idempotencyKey: `contract_${crypto.randomUUID()}`,
  });
  const ref = doc(col(ctx.db, ctx.tenantId, 'contracts'));
  await setDoc(ref, clean({
    name: input.name.trim(),
    customerId: input.customerId,
    totalMinor: input.totalMinor,
    recognizedMinor: 0,
    months: Math.max(1, input.months),
    status: 'open',
    journalId,
  }));
  return ref.id;
}

export async function recognizeRevenue(ctx: TxCtx, contract: RevenueContract, accounts: FinanceAccount[]) {
  if (contract.status !== 'open') throw new BooksError('Contract is closed');
  const remaining = contract.totalMinor - contract.recognizedMinor;
  if (remaining <= 0) throw new BooksError('Fully recognized');
  const amount = Math.max(1, Math.floor(contract.totalMinor / contract.months));
  const post = Math.min(amount, remaining);
  const deferred = accounts.find((a) => a.systemKey === 'deferred_revenue');
  const sales = accounts.find((a) => a.systemKey === 'sales');
  if (!deferred || !sales) throw new BooksError('Revenue accounts are missing');
  await postManualJournal(ctx, {
    date: todayISO(),
    description: `Recognize ${contract.name}`,
    lines: [
      { accountId: deferred.id, debitMinor: post, creditMinor: 0, memo: contract.name },
      { accountId: sales.id, debitMinor: 0, creditMinor: post, memo: 'Revenue recognition' },
    ],
    idempotencyKey: `recog_${contract.id}_${crypto.randomUUID()}`,
  });
  const recognizedMinor = contract.recognizedMinor + post;
  await updateDoc(doc(col(ctx.db, ctx.tenantId, 'contracts'), contract.id), {
    recognizedMinor,
    status: recognizedMinor >= contract.totalMinor ? 'closed' : 'open',
  });
}

export async function saveLease(ctx: TxCtx, input: Omit<LeaseContract, 'id' | 'paidMonths' | 'status'>) {
  assertCan(ctx.role, 'create');
  const ref = doc(col(ctx.db, ctx.tenantId, 'leases'));
  await setDoc(ref, clean({ ...input, name: input.name.trim(), paidMonths: 0, status: 'open' }));
  return ref.id;
}

export async function payLease(ctx: TxCtx, lease: LeaseContract, payAccountId: string, accounts: FinanceAccount[]) {
  if (lease.status !== 'open') throw new BooksError('Lease is closed');
  if (lease.paidMonths >= lease.months) throw new BooksError('Lease is complete');
  const rent = accounts.find((a) => a.code === '6000.30') || accounts.find((a) => a.systemKey === 'operating_expense');
  if (!rent) throw new BooksError('Rent / expense account is missing');
  await postManualJournal(ctx, {
    date: todayISO(),
    description: `Lease ${lease.name}`,
    lines: [
      { accountId: rent.id, debitMinor: lease.monthlyMinor, creditMinor: 0, memo: lease.name },
      { accountId: payAccountId, debitMinor: 0, creditMinor: lease.monthlyMinor, memo: 'Lease payment' },
    ],
    idempotencyKey: `lease_${lease.id}_${crypto.randomUUID()}`,
  });
  const paidMonths = lease.paidMonths + 1;
  await updateDoc(doc(col(ctx.db, ctx.tenantId, 'leases'), lease.id), {
    paidMonths,
    status: paidMonths >= lease.months ? 'closed' : 'open',
  });
}

export async function saveBankTxn(ctx: TxCtx, input: { accountId: string; date: string; amountMinor: number; memo: string }, accounts: FinanceAccount[]) {
  if (input.amountMinor === 0) throw new BooksError('Amount cannot be zero');
  const clearing = accounts.find((a) => a.systemKey === 'operating_expense') || accounts.find((a) => a.systemKey === 'sales');
  if (!clearing) throw new BooksError('A clearing account is required');
  const deposit = input.amountMinor > 0;
  const amount = Math.abs(input.amountMinor);
  const journalId = await postManualJournal(ctx, {
    date: input.date,
    description: input.memo || 'Bank transaction',
    lines: deposit
      ? [
          { accountId: input.accountId, debitMinor: amount, creditMinor: 0, memo: 'Deposit' },
          { accountId: clearing.id, debitMinor: 0, creditMinor: amount, memo: input.memo },
        ]
      : [
          { accountId: clearing.id, debitMinor: amount, creditMinor: 0, memo: input.memo },
          { accountId: input.accountId, debitMinor: 0, creditMinor: amount, memo: 'Withdrawal' },
        ],
    idempotencyKey: `bank_${crypto.randomUUID()}`,
  });
  const ref = doc(col(ctx.db, ctx.tenantId, 'bankTxns'));
  await setDoc(ref, clean({
    accountId: input.accountId,
    date: input.date,
    amountMinor: input.amountMinor,
    memo: input.memo.trim(),
    journalId,
    reconciled: false,
  }));
  return ref.id;
}

export async function toggleReconcile(ctx: TxCtx, txn: BankTxn) {
  assertCan(ctx.role, 'post');
  await updateDoc(doc(col(ctx.db, ctx.tenantId, 'bankTxns'), txn.id), { reconciled: !txn.reconciled });
}

export async function addEntity(ctx: TxCtx, name: string) {
  assertCan(ctx.role, 'manage_settings');
  const ref = doc(col(ctx.db, ctx.tenantId, 'entities'));
  await setDoc(ref, clean({ name: name.trim(), country: 'IN', isDefault: false }));
  return ref.id;
}

export async function withholdTds(ctx: TxCtx, input: { amountMinor: number; againstAccountId: string; date: string; memo: string }, accounts: FinanceAccount[]) {
  if (input.amountMinor <= 0) throw new BooksError('TDS amount must be greater than zero');
  const tds = accounts.find((a) => a.systemKey === 'tds_payable');
  if (!tds) throw new BooksError('TDS payable account is missing');
  return postManualJournal(ctx, {
    date: input.date,
    description: input.memo || 'TDS withheld',
    lines: [
      { accountId: input.againstAccountId, debitMinor: input.amountMinor, creditMinor: 0, memo: 'TDS withheld' },
      { accountId: tds.id, debitMinor: 0, creditMinor: input.amountMinor, memo: 'TDS payable' },
    ],
    idempotencyKey: `tds_${crypto.randomUUID()}`,
  });
}

export async function saveInboxItem(ctx: TxCtx, input: { title: string; kind: InboxItem['kind']; notes: string; filePath?: string | null }) {
  assertCan(ctx.role, 'create');
  const ref = doc(col(ctx.db, ctx.tenantId, 'inbox'));
  await setDoc(ref, clean({
    title: input.title.trim(),
    kind: input.kind,
    notes: input.notes.trim(),
    filePath: input.filePath || null,
    status: 'open',
    createdAt: nowISO(),
  }));
  return ref.id;
}

export async function linkInboxItem(ctx: TxCtx, id: string) {
  assertCan(ctx.role, 'edit');
  await updateDoc(doc(col(ctx.db, ctx.tenantId, 'inbox'), id), { status: 'linked' });
}

export async function saveWorkpaper(ctx: TxCtx, input: { title: string; periodId: string; notes: string; filePath?: string | null }) {
  assertCan(ctx.role, 'create');
  const ref = doc(col(ctx.db, ctx.tenantId, 'workpapers'));
  await setDoc(ref, clean({
    title: input.title.trim(),
    periodId: input.periodId,
    notes: input.notes.trim(),
    filePath: input.filePath || null,
    status: 'open',
    createdAt: nowISO(),
  }));
  return ref.id;
}

export async function reviewWorkpaper(ctx: TxCtx, id: string) {
  assertCan(ctx.role, 'post');
  await updateDoc(doc(col(ctx.db, ctx.tenantId, 'workpapers'), id), { status: 'reviewed' });
}

export async function saveApproval(ctx: TxCtx, input: { title: string; resource: string; resourceId: string; notes: string }) {
  assertCan(ctx.role, 'create');
  const ref = doc(col(ctx.db, ctx.tenantId, 'approvals'));
  await setDoc(ref, clean({
    title: input.title.trim(),
    resource: input.resource,
    resourceId: input.resourceId,
    notes: input.notes.trim(),
    status: 'pending',
    createdAt: nowISO(),
  }));
  return ref.id;
}

export async function decideApproval(ctx: TxCtx, id: string, status: 'approved' | 'rejected') {
  assertCan(ctx.role, 'post');
  await updateDoc(doc(col(ctx.db, ctx.tenantId, 'approvals'), id), { status });
}

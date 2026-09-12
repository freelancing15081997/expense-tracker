import {
  collection,
  doc,
  getDoc,
  getDocs,
  getDocsMany,
  loadErpWorkspace,
  limit,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type Firestore,
  type QuerySnapshot,
  type Transaction,
} from '../../lib/store';
import { clean } from '../core/clean';
import { periodIdFromDate, todayISO, addDays } from '../core/money';
import { assertCan, type BooksAction } from '../core/permissions';
import { normalBalanceFor, seedAccounts, TAX_SEED } from '../engine/chartOfAccounts';
import { assertBalanced, assertPostable, invertLines, nextNumber, BooksError } from '../engine/journal';
import { computeDocument } from '../engine/tax';
import {
  applyCreditAmount,
  docNumberPrefix,
  documentJournalType,
  documentToJournalLines,
  paymentJournalLines,
  prepareConvertedTotals,
} from '../engine/posting';
import type {
  Approval,
  AuditEvent,
  BankRule,
  BankTxn,
  BooksFile,
  BooksRole,
  BooksTemplate,
  BudgetLine,
  DocumentKind,
  DocumentLineInput,
  FinanceAccount,
  FinanceDocument,
  FinanceEntity,
  FinanceJournal,
  FinanceParty,
  FinancePeriod,
  FinanceTenant,
  FixedAsset,
  InboxItem,
  JournalLineInput,
  JournalType,
  LeaseContract,
  PartyKind,
  Product,
  Project,
  RecurringTemplate,
  RevenueContract,
  TaxCode,
  Workpaper,
} from '../core/types';

const WORKSPACE = 'erp_workspaces';

export function tenantRef(db: Firestore, tenantId: string) {
  return doc(db, WORKSPACE, tenantId, 'meta', 'tenant');
}

export function col(db: Firestore, tenantId: string, name: string) {
  return collection(db, WORKSPACE, tenantId, name);
}

function movementCol(db: Firestore, tenantId: string, accountId: string) {
  return collection(db, WORKSPACE, tenantId, 'accounts', accountId, 'movements');
}

function nowISO() {
  return new Date().toISOString();
}

function persistLines(lines: JournalLineInput[]) {
  return lines.map((line) => clean({
    accountId: line.accountId,
    debitMinor: line.debitMinor,
    creditMinor: line.creditMinor,
    memo: line.memo || '',
    partyId: line.partyId || null,
  }));
}

function mapDocs<T>(snap?: QuerySnapshot | null): T[] {
  return (snap?.docs || []).map((d) => ({ id: d.id, ...(d.data() as Record<string, unknown>) } as T));
}

function byText(a?: string | number | null, b?: string | number | null) {
  return String(a ?? '').localeCompare(String(b ?? ''), undefined, { numeric: true });
}

function provisionCacheKey(uid: string) {
  return `byjan_books_ready_${uid}`;
}

export async function writeTenantMeta(
  db: Firestore,
  input: {
    tenantId: string;
    uid: string;
    email: string;
    name: string;
    parentId: string | null;
    depth: number;
    kind: FinanceTenant['kind'];
  },
) {
  await setDoc(tenantRef(db, input.tenantId), clean({
    name: input.name,
    ownerId: input.uid,
    rootOwnerId: input.uid,
    parentId: input.parentId,
    depth: input.depth,
    kind: input.kind,
    baseCurrency: 'INR',
    fiscalYearStartMonth: 4,
    memberIds: [input.uid],
    members: { [input.uid]: { role: 'owner', email: input.email || '' } },
    sequences: { journal: 0, invoice: 0, bill: 0, expense: 0 },
    postedCount: 0,
    version: 1,
    createdAt: serverTimestamp(),
  }));
}

export async function seedWorkspace(db: Firestore, tenantId: string, uid: string, entityName: string) {
  const sentinel = doc(col(db, tenantId, 'entities'), 'default');
  const alreadySeeded = await getDoc(sentinel);
  if (alreadySeeded.exists()) {
    await ensureExtendedWorkspace(db, tenantId);
    return;
  }
  await runTransaction(db, async (tx) => {
    const already = await tx.get(sentinel);
    if (already.exists()) return;
    const accounts = seedAccounts();
    const periodId = periodIdFromDate(todayISO());
    const [year, month] = periodId.split('-').map(Number);
    const codeToId = new Map<string, string>();
    tx.set(sentinel, clean({ name: entityName || 'Default entity', country: 'IN', isDefault: true }));
    for (const account of accounts) {
      const ref = doc(col(db, tenantId, 'accounts'));
      codeToId.set(account.code, ref.id);
      tx.set(ref, clean({ ...account, parentId: null, systemKey: account.systemKey || null }));
    }
    for (const account of accounts) {
      if (!account.parentId) continue;
      const id = codeToId.get(account.code);
      const parentId = codeToId.get(account.parentId);
      if (id && parentId) tx.update(doc(col(db, tenantId, 'accounts'), id), { parentId });
    }
    for (const tax of TAX_SEED) {
      tx.set(doc(col(db, tenantId, 'taxCodes'), tax.id), clean({ name: tax.name, rateBps: tax.rateBps, active: true }));
    }
    tx.set(doc(col(db, tenantId, 'periods'), periodId), clean({ year, month, status: 'open' }));
    tx.set(doc(col(db, tenantId, 'audit')), clean({
      actorId: uid,
      action: 'provision',
      resource: 'tenant',
      resourceId: tenantId,
      at: nowISO(),
    }));
  });
  await ensureExtendedWorkspace(db, tenantId);
}

export async function resolveTenantId(db: Firestore, uid: string, email: string, displayName: string): Promise<string> {
  try {
    if (sessionStorage.getItem(provisionCacheKey(uid)) === '1') return uid;
  } catch { /* private mode */ }
  const tenantId = uid;
  const tRef = tenantRef(db, tenantId);
  const existing = await getDoc(tRef);
  if (!existing.exists()) {
    await writeTenantMeta(db, {
      tenantId,
      uid,
      email,
      name: `${displayName || 'My'} Books`,
      parentId: null,
      depth: 0,
      kind: 'root',
    });
  } else {
    const data = existing.data() || {};
    const rawIds = data.memberIds;
    const memberIds = Array.isArray(rawIds)
      ? rawIds.map(String)
      : (rawIds && typeof rawIds === 'object' ? Object.keys(rawIds as object) : []);
    const members = (data.members && typeof data.members === 'object' ? data.members : {}) as Record<string, unknown>;
    const missingMember = !memberIds.includes(uid) || data.ownerId !== uid || !members[uid];
    if (missingMember) {
      await updateDoc(tRef, clean({
        rootOwnerId: data.rootOwnerId || uid,
        parentId: data.parentId ?? null,
        depth: Number(data.depth || 0),
        kind: data.kind || 'root',
        ownerId: uid,
        memberIds: [...new Set([...memberIds, uid])],
        members: { ...members, [uid]: { role: 'owner', email: email || '' } },
      }));
    }
  }
  await seedWorkspace(db, tenantId, uid, displayName || 'Default entity');
  try {
    sessionStorage.setItem(provisionCacheKey(uid), '1');
  } catch { /* private mode */ }
  return tenantId;
}

async function ensureExtendedWorkspace(db: Firestore, tenantId: string) {
  const [accountsSnap, taxSnap] = await Promise.all([
    getDocs(col(db, tenantId, 'accounts')),
    getDocs(col(db, tenantId, 'taxCodes')),
  ]);
  const codes = new Set(accountsSnap.docs.map((d) => String(d.data().code || '')));
  const keys = new Set(accountsSnap.docs.map((d) => String(d.data().systemKey || '')).filter(Boolean));
  for (const account of seedAccounts()) {
    if ((account.systemKey && keys.has(account.systemKey)) || codes.has(account.code)) continue;
    await setDoc(doc(col(db, tenantId, 'accounts')), clean({ ...account, parentId: null, systemKey: account.systemKey || null }));
  }
  const taxIds = new Set(taxSnap.docs.map((d) => d.id));
  for (const tax of TAX_SEED) {
    if (taxIds.has(tax.id)) continue;
    await setDoc(doc(col(db, tenantId, 'taxCodes'), tax.id), clean({ name: tax.name, rateBps: tax.rateBps, active: true }));
  }
}

const WORKSPACE_COLS = [
  'entities', 'accounts', 'parties', 'journals', 'documents', 'periods', 'taxCodes', 'recurring', 'audit',
  'products', 'assets', 'projects', 'budgets', 'contracts', 'leases', 'bankTxns', 'inbox', 'workpapers', 'approvals',
  'files', 'templates', 'bankRules',
] as const;

function emptySnap(): QuerySnapshot {
  return { docs: [], empty: true, forEach: () => undefined };
}

function workspaceFromPack(tenantId: string, pack: { tenant: Record<string, unknown> | null; collections: Record<string, QuerySnapshot> }) {
  const tenant = {
    parentId: null,
    depth: 0,
    kind: tenantId === pack.tenant?.ownerId ? 'root' : 'company',
    rootOwnerId: pack.tenant?.rootOwnerId || pack.tenant?.ownerId || tenantId,
    ...pack.tenant,
    id: tenantId,
  } as FinanceTenant;
  const grab = (name: string) => pack.collections[name] || emptySnap();
  return hydrateWorkspace(tenant, WORKSPACE_COLS.map(grab) as QuerySnapshot[]);
}

function hydrateWorkspace(tenant: FinanceTenant, packs: QuerySnapshot[]) {
  const [
    entities, accounts, parties, journals, documents, periods, taxCodes, recurring, audit,
    products, assets, projects, budgets, contracts, leases, bankTxns, inbox, workpapers, approvals,
    files, templates, bankRules,
  ] = packs;
  return {
    tenant,
    entities: mapDocs<FinanceEntity>(entities),
    accounts: mapDocs<FinanceAccount>(accounts).sort((a, b) => byText(a.code, b.code)),
    parties: mapDocs<FinanceParty>(parties),
    journals: mapDocs<FinanceJournal>(journals).sort((a, b) => byText(b.date, a.date) || byText(b.number, a.number)),
    documents: mapDocs<FinanceDocument>(documents).sort((a, b) => byText(b.date, a.date) || byText(b.number, a.number)),
    periods: mapDocs<FinancePeriod>(periods),
    taxCodes: mapDocs<TaxCode>(taxCodes),
    recurring: mapDocs<RecurringTemplate>(recurring),
    audit: mapDocs<AuditEvent>(audit).sort((a, b) => byText(b.at, a.at)),
    products: mapDocs<Product>(products),
    assets: mapDocs<FixedAsset>(assets),
    projects: mapDocs<Project>(projects),
    budgets: mapDocs<BudgetLine>(budgets),
    contracts: mapDocs<RevenueContract>(contracts),
    leases: mapDocs<LeaseContract>(leases),
    bankTxns: mapDocs<BankTxn>(bankTxns).sort((a, b) => byText(b.date, a.date)),
    inbox: mapDocs<InboxItem>(inbox).sort((a, b) => byText(b.createdAt, a.createdAt)),
    workpapers: mapDocs<Workpaper>(workpapers).sort((a, b) => byText(b.createdAt, a.createdAt)),
    approvals: mapDocs<Approval>(approvals).sort((a, b) => byText(b.createdAt, a.createdAt)),
    files: mapDocs<BooksFile>(files).filter((f) => f.status !== 'archived').sort((a, b) => byText(b.createdAt, a.createdAt)),
    templates: mapDocs<BooksTemplate>(templates).filter((t) => t.status !== 'archived').sort((a, b) => byText(b.createdAt, a.createdAt)),
    bankRules: mapDocs<BankRule>(bankRules),
  };
}

export async function loadWorkspace(db: Firestore, tenantId: string) {
  try {
    const pack = await loadErpWorkspace(tenantId);
    if (pack?.tenant) return workspaceFromPack(tenantId, pack);
  } catch {
    // Fall through to the collection query path.
  }
  const [tenantSnap, packs] = await Promise.all([
    getDoc(tenantRef(db, tenantId)),
    getDocsMany([
      col(db, tenantId, 'entities'),
      col(db, tenantId, 'accounts'),
      col(db, tenantId, 'parties'),
      query(col(db, tenantId, 'journals'), limit(200)),
      query(col(db, tenantId, 'documents'), limit(200)),
      col(db, tenantId, 'periods'),
      col(db, tenantId, 'taxCodes'),
      col(db, tenantId, 'recurring'),
      query(col(db, tenantId, 'audit'), limit(100)),
      col(db, tenantId, 'products'),
      col(db, tenantId, 'assets'),
      col(db, tenantId, 'projects'),
      col(db, tenantId, 'budgets'),
      col(db, tenantId, 'contracts'),
      col(db, tenantId, 'leases'),
      col(db, tenantId, 'bankTxns'),
      col(db, tenantId, 'inbox'),
      col(db, tenantId, 'workpapers'),
      col(db, tenantId, 'approvals'),
      col(db, tenantId, 'files'),
      col(db, tenantId, 'templates'),
      col(db, tenantId, 'bankRules'),
    ]),
  ]);
  if (!tenantSnap.exists()) throw new BooksError('Workspace not found');
  const raw = tenantSnap.data() as Record<string, unknown>;
  const tenant = {
    parentId: null,
    depth: 0,
    kind: tenantId === raw.ownerId ? 'root' : 'company',
    rootOwnerId: raw.rootOwnerId || raw.ownerId || tenantId,
    ...raw,
    id: tenantId,
  } as FinanceTenant;
  return hydrateWorkspace(tenant, packs);
}

export async function loadLedger(db: Firestore, tenantId: string, accountId: string) {
  const snap = await getDocs(movementCol(db, tenantId, accountId));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a: any, b: any) => String(a.date).localeCompare(String(b.date)) || String(a.journalNumber).localeCompare(String(b.journalNumber)));
}

export type TxCtx = {
  db: Firestore;
  tenantId: string;
  uid: string;
  role: BooksRole;
};

async function lockTenant(tx: Transaction, ctx: TxCtx, action: BooksAction) {
  assertCan(ctx.role, action);
  const snap = await tx.get(tenantRef(ctx.db, ctx.tenantId));
  if (!snap.exists()) throw new BooksError('Workspace not found');
  const tenant = { id: snap.id, ...snap.data() } as FinanceTenant;
  const allowed = ctx.tenantId === ctx.uid
    || tenant.ownerId === ctx.uid
    || (Array.isArray(tenant.memberIds) && tenant.memberIds.includes(ctx.uid))
    || Boolean(tenant.members?.[ctx.uid]);
  if (!allowed) throw new BooksError('Not a workspace member');
  return { ref: snap.ref, tenant };
}

async function readPeriod(tx: Transaction, ctx: TxCtx, date: string) {
  const id = periodIdFromDate(date);
  const ref = doc(col(ctx.db, ctx.tenantId, 'periods'), id);
  const snap = await tx.get(ref);
  if (snap.exists() && snap.data().status === 'closed') throw new BooksError(`Period ${id} is closed`);
  return { id, ref, exists: snap.exists() };
}

function writePeriodIfNeeded(tx: Transaction, ctx: TxCtx, date: string, period: { id: string; ref: ReturnType<typeof doc>; exists: boolean }) {
  if (period.exists) return;
  const [year, month] = period.id.split('-').map(Number);
  tx.set(period.ref, clean({ year, month, status: 'open' }));
}

async function loadAccountMap(tx: Transaction, ctx: TxCtx, ids: string[]) {
  const unique = [...new Set(ids)];
  const map = new Map<string, FinanceAccount>();
  for (const id of unique) {
    const snap = await tx.get(doc(col(ctx.db, ctx.tenantId, 'accounts'), id));
    if (!snap.exists()) throw new BooksError('Account not found');
    map.set(id, { id: snap.id, ...snap.data() } as FinanceAccount);
  }
  return map;
}

function applyBalances(
  tx: Transaction,
  ctx: TxCtx,
  accounts: Map<string, FinanceAccount>,
  lines: JournalLineInput[],
  sign: 1 | -1
) {
  for (const line of lines) {
    const account = accounts.get(line.accountId)!;
    const debit = account.debitTotalMinor + sign * line.debitMinor;
    const credit = account.creditTotalMinor + sign * line.creditMinor;
    tx.update(doc(col(ctx.db, ctx.tenantId, 'accounts'), account.id), {
      debitTotalMinor: debit,
      creditTotalMinor: credit,
    });
    account.debitTotalMinor = debit;
    account.creditTotalMinor = credit;
  }
}

function writeMovements(
  tx: Transaction,
  ctx: TxCtx,
  journalId: string,
  journalNumber: string,
  date: string,
  lines: JournalLineInput[]
) {
  lines.forEach((line, index) => {
    tx.set(doc(movementCol(ctx.db, ctx.tenantId, line.accountId)), clean({
      journalId,
      journalNumber,
      date,
      debitMinor: line.debitMinor,
      creditMinor: line.creditMinor,
      memo: line.memo || '',
      partyId: line.partyId || null,
      lineIndex: index,
    }));
  });
}

async function readIdempotency(tx: Transaction, ctx: TxCtx, key: string) {
  const ref = doc(col(ctx.db, ctx.tenantId, 'idempotency'), key);
  const snap = await tx.get(ref);
  return { ref, existingId: snap.exists() ? String(snap.data().resourceId || '') : null };
}

function writeAudit(tx: Transaction, ctx: TxCtx, action: string, resource: string, resourceId: string, meta?: Record<string, unknown>) {
  tx.set(doc(col(ctx.db, ctx.tenantId, 'audit')), clean({
    actorId: ctx.uid,
    action,
    resource,
    resourceId,
    meta: meta || null,
    at: nowISO(),
  }));
}

export async function postManualJournal(
  ctx: TxCtx,
  input: { date: string; description: string; lines: JournalLineInput[]; idempotencyKey: string }
) {
  const totals = assertBalanced(input.lines);
  return runTransaction(ctx.db, async (tx) => {
    const { ref, tenant } = await lockTenant(tx, ctx, 'post');
    const idem = await readIdempotency(tx, ctx, input.idempotencyKey);
    if (idem.existingId) return idem.existingId;
    const periodId = await readPeriod(tx, ctx, input.date);
    const accounts = await loadAccountMap(tx, ctx, input.lines.map((l) => l.accountId));
    assertPostable(accounts, input.lines);
    const seq = tenant.sequences.journal + 1;
    const journalRef = doc(col(ctx.db, ctx.tenantId, 'journals'));
    const number = nextNumber('JE', seq);
    writePeriodIfNeeded(tx, ctx, input.date, periodId);
    tx.set(journalRef, clean({
      number,
      type: 'manual',
      sourceType: 'manual',
      sourceId: null,
      date: input.date,
      periodId: periodId.id,
      currency: tenant.baseCurrency,
      description: input.description.trim() || number,
      status: 'posted',
      lines: persistLines(input.lines),
      debitTotalMinor: totals.debit,
      creditTotalMinor: totals.credit,
      idempotencyKey: input.idempotencyKey,
      createdBy: ctx.uid,
      postedBy: ctx.uid,
      postedAt: nowISO(),
      reversalOfId: null,
      reversedById: null,
      createdAt: nowISO(),
      updatedAt: nowISO(),
    }));
    tx.set(idem.ref, { resourceId: journalRef.id, at: nowISO(), actorId: ctx.uid });
    applyBalances(tx, ctx, accounts, input.lines, 1);
    writeMovements(tx, ctx, journalRef.id, number, input.date, input.lines);
    tx.update(ref, { 'sequences.journal': seq, postedCount: tenant.postedCount + 1, version: tenant.version + 1 });
    writeAudit(tx, ctx, 'post', 'journal', journalRef.id, { number });
    return journalRef.id;
  });
}

export async function reverseJournal(ctx: TxCtx, journalId: string) {
  const key = `reverse_${journalId}`;
  return runTransaction(ctx.db, async (tx) => {
    const { ref, tenant } = await lockTenant(tx, ctx, 'reverse');
    const idem = await readIdempotency(tx, ctx, key);
    if (idem.existingId) return idem.existingId;
    const srcRef = doc(col(ctx.db, ctx.tenantId, 'journals'), journalId);
    const srcSnap = await tx.get(srcRef);
    if (!srcSnap.exists()) throw new BooksError('Journal not found');
    const source = { id: srcSnap.id, ...srcSnap.data() } as FinanceJournal;
    if (source.status !== 'posted') throw new BooksError('Only posted journals can be reversed');
    const period = await readPeriod(tx, ctx, todayISO());
    const lines = invertLines(source.lines);
    const totals = assertBalanced(lines);
    const accounts = await loadAccountMap(tx, ctx, lines.map((l) => l.accountId));
    assertPostable(accounts, lines);
    const seq = tenant.sequences.journal + 1;
    const reversalRef = doc(col(ctx.db, ctx.tenantId, 'journals'));
    const number = nextNumber('JE', seq);
    writePeriodIfNeeded(tx, ctx, todayISO(), period);
    tx.set(reversalRef, clean({
      number,
      type: 'reversal',
      sourceType: 'reversal',
      sourceId: source.id,
      date: todayISO(),
      periodId: period.id,
      currency: tenant.baseCurrency,
      description: `Reversal of ${source.number}`,
      status: 'posted',
      lines: persistLines(lines),
      debitTotalMinor: totals.debit,
      creditTotalMinor: totals.credit,
      idempotencyKey: key,
      createdBy: ctx.uid,
      postedBy: ctx.uid,
      postedAt: nowISO(),
      reversalOfId: source.id,
      reversedById: null,
      createdAt: nowISO(),
      updatedAt: nowISO(),
    }));
    tx.update(srcRef, { status: 'reversed', reversedById: reversalRef.id, updatedAt: nowISO() });
    tx.set(idem.ref, { resourceId: reversalRef.id, at: nowISO(), actorId: ctx.uid });
    applyBalances(tx, ctx, accounts, lines, 1);
    writeMovements(tx, ctx, reversalRef.id, number, todayISO(), lines);
    tx.update(ref, { 'sequences.journal': seq, postedCount: tenant.postedCount + 1, version: tenant.version + 1 });
    writeAudit(tx, ctx, 'reverse', 'journal', source.id, { reversalId: reversalRef.id });
    return reversalRef.id;
  });
}

export async function saveParty(
  db: Firestore,
  tenantId: string,
  role: BooksRole,
  input: {
    id?: string;
    kind: PartyKind;
    name: string;
    email: string;
    taxId: string;
    paymentTermsDays: number;
    phone?: string;
    website?: string;
    contactName?: string;
    address?: string;
    city?: string;
    state?: string;
    pincode?: string;
    notes?: string;
    logoPath?: string | null;
    shippingAddress?: string;
    shippingCity?: string;
    shippingState?: string;
    shippingPincode?: string;
    creditLimitMinor?: number;
    gstTreatment?: string;
    pan?: string;
  }
) {
  assertCan(role, input.id ? 'edit' : 'create');
  const name = input.name.trim();
  if (name.length < 2) throw new BooksError('Name is required');
  const payload = {
    kind: input.kind,
    name,
    email: input.email.trim().toLowerCase(),
    phone: (input.phone || '').trim(),
    website: (input.website || '').trim(),
    contactName: (input.contactName || '').trim(),
    taxId: input.taxId.trim(),
    address: (input.address || '').trim(),
    city: (input.city || '').trim(),
    state: (input.state || '').trim(),
    pincode: (input.pincode || '').trim(),
    notes: (input.notes || '').trim(),
    logoPath: input.logoPath ?? null,
    paymentTermsDays: Math.max(0, Math.min(365, Math.floor(input.paymentTermsDays || 0))),
    shippingAddress: (input.shippingAddress || '').trim(),
    shippingCity: (input.shippingCity || '').trim(),
    shippingState: (input.shippingState || '').trim(),
    shippingPincode: (input.shippingPincode || '').trim(),
    creditLimitMinor: Math.max(0, Math.floor(input.creditLimitMinor || 0)),
    gstTreatment: (input.gstTreatment || '').trim(),
    pan: (input.pan || '').trim(),
    active: true,
    updatedAt: nowISO(),
  };
  const ref = input.id ? doc(col(db, tenantId, 'parties'), input.id) : doc(col(db, tenantId, 'parties'));
  if (input.id) await updateDoc(ref, clean(payload));
  else await setDoc(ref, clean({ ...payload, createdAt: nowISO() }));
  return ref.id;
}

export async function deactivateParty(db: Firestore, tenantId: string, role: BooksRole, partyId: string) {
  assertCan(role, 'edit');
  await updateDoc(doc(col(db, tenantId, 'parties'), partyId), clean({
    active: false,
    deletedAt: nowISO(),
  }));
}

export async function saveDocument(
  ctx: TxCtx,
  input: {
    id?: string;
    kind: DocumentKind;
    partyId: string | null;
    date: string;
    dueDate: string | null;
    lines: DocumentLineInput[];
    interstate: boolean;
    memo: string;
    projectId?: string | null;
    poNumber?: string;
    customerNotes?: string;
    terms?: string;
    placeOfSupply?: string;
    billTo?: string;
    shipTo?: string;
    taxCodes: TaxCode[];
  }
) {
  assertCan(ctx.role, input.id ? 'edit' : 'create');
  const computed = computeDocument(input.lines, new Map(input.taxCodes.map((t) => [t.id, t])), input.interstate);
  const ref = input.id ? doc(col(ctx.db, ctx.tenantId, 'documents'), input.id) : doc(col(ctx.db, ctx.tenantId, 'documents'));
  let convertedFromId: string | null = null;
  if (input.id) {
    const snap = await getDoc(ref);
    if (!snap.exists()) throw new BooksError('Document not found');
    const existing = snap.data() as FinanceDocument;
    if (existing.status !== 'draft') throw new BooksError('Only draft documents can be edited');
    convertedFromId = existing.convertedFromId || null;
  }
  const base = {
    kind: input.kind,
    partyId: input.kind === 'expense' ? input.partyId : input.partyId,
    date: input.date,
    dueDate: input.kind === 'expense' ? null : input.dueDate,
    lines: computed.lines,
    taxCode: computed.lines[0]?.taxCode || 'EXEMPT',
    interstate: input.interstate,
    tax: computed.tax,
    totalMinor: computed.totalMinor,
    paidMinor: 0,
    status: 'draft' as const,
    journalId: null,
    paymentJournalIds: [],
    memo: input.memo.trim(),
    projectId: input.projectId || null,
    poNumber: (input.poNumber || '').trim(),
    customerNotes: (input.customerNotes || '').trim(),
    terms: (input.terms || '').trim(),
    placeOfSupply: (input.placeOfSupply || '').trim(),
    billTo: (input.billTo || '').trim(),
    shipTo: (input.shipTo || '').trim(),
    convertedFromId,
    updatedAt: nowISO(),
  };
  if (input.id) await updateDoc(ref, clean(base));
  else {
    await runTransaction(ctx.db, async (tx) => {
      const tenantSnap = await tx.get(tenantRef(ctx.db, ctx.tenantId));
      const tenant = tenantSnap.data() as FinanceTenant;
      const seqKey = input.kind;
      const seq = (tenant.sequences[seqKey] || 0) + 1;
      const prefix = docNumberPrefix(input.kind);
      tx.set(ref, clean({
        ...base,
        number: nextNumber(prefix, seq),
        idempotencyKey: `${input.kind}_${ref.id}`,
        createdBy: ctx.uid,
        createdAt: nowISO(),
      }));
      tx.update(tenantRef(ctx.db, ctx.tenantId), { [`sequences.${seqKey}`]: seq });
    });
  }
  return ref.id;
}

export async function convertDocument(ctx: TxCtx, documentId: string, nextKind: DocumentKind, taxCodes?: TaxCode[]) {
  assertCan(ctx.role, 'create');
  const srcRef = doc(col(ctx.db, ctx.tenantId, 'documents'), documentId);
  const snap = await getDoc(srcRef);
  if (!snap.exists()) throw new BooksError('Document not found');
  const source = { id: snap.id, ...snap.data() } as FinanceDocument;
  if (source.status === 'voided') throw new BooksError('Cannot convert a voided document');
  let codes = taxCodes || [];
  if (!codes.length) {
    const taxSnap = await getDocs(col(ctx.db, ctx.tenantId, 'taxCodes'));
    codes = (taxSnap.docs || []).map((d) => ({ id: d.id, ...(d.data() as object) })) as TaxCode[];
  }
  const converted = prepareConvertedTotals(source, nextKind, codes);
  const ref = doc(col(ctx.db, ctx.tenantId, 'documents'));
  await runTransaction(ctx.db, async (tx) => {
    const tenantSnap = await tx.get(tenantRef(ctx.db, ctx.tenantId));
    const tenant = tenantSnap.data() as FinanceTenant;
    const seq = (tenant.sequences[nextKind] || 0) + 1;
    tx.set(ref, clean({
      kind: nextKind,
      number: nextNumber(docNumberPrefix(nextKind), seq),
      partyId: source.partyId,
      date: source.date,
      dueDate: converted.dueDate,
      lines: converted.lines,
      taxCode: converted.lines[0]?.taxCode || source.taxCode,
      interstate: source.interstate,
      tax: converted.tax,
      totalMinor: converted.totalMinor,
      paidMinor: 0,
      status: 'draft',
      journalId: null,
      paymentJournalIds: [],
      memo: source.memo,
      projectId: source.projectId || null,
      poNumber: source.poNumber || '',
      customerNotes: source.customerNotes || '',
      terms: source.terms || '',
      placeOfSupply: source.placeOfSupply || '',
      billTo: source.billTo || '',
      shipTo: source.shipTo || '',
      convertedFromId: source.id,
      idempotencyKey: `${nextKind}_${ref.id}`,
      createdBy: ctx.uid,
      createdAt: nowISO(),
      updatedAt: nowISO(),
    }));
    tx.update(tenantRef(ctx.db, ctx.tenantId), { [`sequences.${nextKind}`]: seq });
  });
  return ref.id;
}

async function postJournalInTx(
  tx: Transaction,
  ctx: TxCtx,
  tenant: FinanceTenant,
  tenantDocRef: ReturnType<typeof tenantRef>,
  input: {
    type: JournalType;
    sourceType: string;
    sourceId: string;
    date: string;
    description: string;
    lines: JournalLineInput[];
    idempotencyKey: string;
  }
) {
  const idem = await readIdempotency(tx, ctx, input.idempotencyKey);
  if (idem.existingId) return { journalId: idem.existingId, number: '', totals: { debit: 0, credit: 0 } };
  const totals = assertBalanced(input.lines);
  const period = await readPeriod(tx, ctx, input.date);
  const accounts = await loadAccountMap(tx, ctx, input.lines.map((l) => l.accountId));
  assertPostable(accounts, input.lines);
  const seq = tenant.sequences.journal + 1;
  tenant.sequences.journal = seq;
  tenant.postedCount += 1;
  tenant.version += 1;
  const journalRef = doc(col(ctx.db, ctx.tenantId, 'journals'));
  const number = nextNumber('JE', seq);
  writePeriodIfNeeded(tx, ctx, input.date, period);
  tx.set(journalRef, clean({
    number,
    type: input.type,
    sourceType: input.sourceType,
    sourceId: input.sourceId,
    date: input.date,
    periodId: period.id,
    currency: tenant.baseCurrency,
    description: input.description,
    status: 'posted',
    lines: persistLines(input.lines),
    debitTotalMinor: totals.debit,
    creditTotalMinor: totals.credit,
    idempotencyKey: input.idempotencyKey,
    createdBy: ctx.uid,
    postedBy: ctx.uid,
    postedAt: nowISO(),
    reversalOfId: null,
    reversedById: null,
    createdAt: nowISO(),
    updatedAt: nowISO(),
  }));
  tx.set(idem.ref, { resourceId: journalRef.id, at: nowISO(), actorId: ctx.uid });
  applyBalances(tx, ctx, accounts, input.lines, 1);
  writeMovements(tx, ctx, journalRef.id, number, input.date, input.lines);
  tx.update(tenantDocRef, {
    'sequences.journal': seq,
    postedCount: tenant.postedCount,
    version: tenant.version,
  });
  writeAudit(tx, ctx, 'post', 'journal', journalRef.id, { source: input.sourceType, sourceId: input.sourceId });
  return { journalId: journalRef.id, number, totals };
}

export async function postDocument(ctx: TxCtx, documentId: string, accounts: FinanceAccount[], payFromAccountId?: string) {
  return runTransaction(ctx.db, async (tx) => {
    const { ref, tenant } = await lockTenant(tx, ctx, 'post');
    const docRef = doc(col(ctx.db, ctx.tenantId, 'documents'), documentId);
    const snap = await tx.get(docRef);
    if (!snap.exists()) throw new BooksError('Document not found');
    const document = { id: snap.id, ...snap.data() } as FinanceDocument;
    if (document.status !== 'draft') throw new BooksError('Only drafts can be posted');
    if (document.kind !== 'expense' && !document.partyId) throw new BooksError('Select a customer or vendor');
    if (!document.lines[0]?.accountId) throw new BooksError('Document is missing an account');
    let lines = documentToJournalLines(document.kind, accounts, document.tax, document.lines, payFromAccountId);
    if (document.partyId) lines = lines.map((l) => ({ ...l, partyId: document.partyId || null }));
    const posted = await postJournalInTx(tx, ctx, tenant, ref, {
      type: documentJournalType(document.kind),
      sourceType: document.kind,
      sourceId: document.id,
      date: document.date,
      description: `${document.number} ${document.memo}`.trim(),
      lines,
      idempotencyKey: `post_${document.id}`,
    });
    tx.update(docRef, {
      status: document.kind === 'expense' ? 'paid' : 'posted',
      paidMinor: document.kind === 'expense' ? document.totalMinor : 0,
      journalId: posted.journalId,
      updatedAt: nowISO(),
    });
    writeAudit(tx, ctx, 'post', document.kind, document.id, { journalId: posted.journalId });
    return posted.journalId;
  });
}

export async function recordPayment(
  ctx: TxCtx,
  documentId: string,
  amountMinor: number,
  date: string,
  cashAccountId: string,
  accounts: FinanceAccount[]
) {
  return runTransaction(ctx.db, async (tx) => {
    const { ref, tenant } = await lockTenant(tx, ctx, 'post');
    const docRef = doc(col(ctx.db, ctx.tenantId, 'documents'), documentId);
    const snap = await tx.get(docRef);
    if (!snap.exists()) throw new BooksError('Document not found');
    const document = { id: snap.id, ...snap.data() } as FinanceDocument;
    if (document.kind === 'expense') throw new BooksError('Books expenses are paid at posting');
    if (document.status !== 'posted' && document.status !== 'paid') throw new BooksError('Post the document before recording payment');
    const outstanding = document.totalMinor - document.paidMinor;
    if (amountMinor <= 0 || amountMinor > outstanding) throw new BooksError('Payment exceeds the outstanding amount');
    const lines = paymentJournalLines(document.kind, accounts, amountMinor, cashAccountId).map((l) => ({
      ...l,
      partyId: document.partyId || null,
    }));
    const key = `pay_${document.id}_${document.paidMinor}_${amountMinor}`;
    const posted = await postJournalInTx(tx, ctx, tenant, ref, {
      type: 'payment',
      sourceType: `${document.kind}_payment`,
      sourceId: document.id,
      date,
      description: `Payment ${document.number}`,
      lines,
      idempotencyKey: key,
    });
    const paidMinor = document.paidMinor + amountMinor;
    tx.update(docRef, {
      paidMinor,
      status: paidMinor === document.totalMinor ? 'paid' : 'posted',
      paymentJournalIds: [...(document.paymentJournalIds || []), posted.journalId],
      updatedAt: nowISO(),
    });
    writeAudit(tx, ctx, 'payment', document.kind, document.id, { amountMinor, journalId: posted.journalId });
    return posted.journalId;
  });
}

export async function applyCredit(ctx: TxCtx, creditId: string, targetId: string, amountMinor?: number) {
  return runTransaction(ctx.db, async (tx) => {
    await lockTenant(tx, ctx, 'post');
    const creditRef = doc(col(ctx.db, ctx.tenantId, 'documents'), creditId);
    const targetRef = doc(col(ctx.db, ctx.tenantId, 'documents'), targetId);
    const creditSnap = await tx.get(creditRef);
    const targetSnap = await tx.get(targetRef);
    if (!creditSnap.exists() || !targetSnap.exists()) throw new BooksError('Document not found');
    const credit = { id: creditSnap.id, ...creditSnap.data() } as FinanceDocument;
    const target = { id: targetSnap.id, ...targetSnap.data() } as FinanceDocument;
    const amount = applyCreditAmount(credit, target, amountMinor);
    const creditPaid = credit.paidMinor + amount;
    const targetPaid = target.paidMinor + amount;
    tx.update(creditRef, {
      paidMinor: creditPaid,
      status: creditPaid === credit.totalMinor ? 'paid' : 'posted',
      updatedAt: nowISO(),
    });
    tx.update(targetRef, {
      paidMinor: targetPaid,
      status: targetPaid === target.totalMinor ? 'paid' : 'posted',
      updatedAt: nowISO(),
    });
    writeAudit(tx, ctx, 'payment', credit.kind, credit.id, { appliedTo: target.id, amountMinor: amount });
    return amount;
  });
}

export async function voidDocument(ctx: TxCtx, documentId: string) {
  return runTransaction(ctx.db, async (tx) => {
    await lockTenant(tx, ctx, 'void');
    const docRef = doc(col(ctx.db, ctx.tenantId, 'documents'), documentId);
    const snap = await tx.get(docRef);
    if (!snap.exists()) throw new BooksError('Document not found');
    const document = snap.data() as FinanceDocument;
    if (document.status !== 'draft') throw new BooksError('Posted documents must be reversed from the journal, not deleted');
    tx.update(docRef, { status: 'voided', updatedAt: nowISO() });
    writeAudit(tx, ctx, 'void', document.kind, documentId);
  });
}

export async function closePeriod(ctx: TxCtx, periodId: string) {
  assertCan(ctx.role, 'close_period');
  await updateDoc(doc(col(ctx.db, ctx.tenantId, 'periods'), periodId), { status: 'closed' });
}

export async function reopenPeriod(ctx: TxCtx, periodId: string) {
  assertCan(ctx.role, 'close_period');
  await updateDoc(doc(col(ctx.db, ctx.tenantId, 'periods'), periodId), { status: 'open' });
}

export async function saveAccount(
  db: Firestore,
  tenantId: string,
  role: BooksRole,
  input: { code: string; name: string; type: FinanceAccount['type']; parentId: string | null }
) {
  assertCan(role, 'create');
  const code = input.code.trim();
  const name = input.name.trim();
  if (!/^\d+(\.\d+)?$/.test(code)) throw new BooksError('Account code must be numeric, e.g. 6000.50');
  if (name.length < 2) throw new BooksError('Account name is required');
  const existing = await getDocs(query(col(db, tenantId, 'accounts'), where('code', '==', code), limit(1)));
  if (!existing.empty) throw new BooksError('Account code already exists');
  const ref = doc(col(db, tenantId, 'accounts'));
  await setDoc(ref, clean({
    code,
    name,
    type: input.type,
    parentId: input.parentId,
    normalBalance: normalBalanceFor(input.type),
    allowPosting: true,
    isSystem: false,
    systemKey: null,
    active: true,
    debitTotalMinor: 0,
    creditTotalMinor: 0,
  }));
  return ref.id;
}


export async function upsertTenantMember(
  db: Firestore,
  tenantId: string,
  role: BooksRole,
  input: { uid: string; email: string; memberRole: BooksRole; featureIds?: string[] },
) {
  assertCan(role, 'manage_settings');
  const ref = tenantRef(db, tenantId);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error('Books workspace not found');
    const data = snap.data() || {};
    const memberIds = Array.isArray(data.memberIds) ? [...data.memberIds] : [];
    if (!memberIds.includes(input.uid)) memberIds.push(input.uid);
    const members = { ...(data.members && typeof data.members === 'object' ? data.members : {}) } as Record<string, unknown>;
    members[input.uid] = {
      role: input.memberRole,
      email: input.email || '',
      featureIds: input.featureIds || [],
    };
    const pendingInvites = { ...(data.pendingInvites && typeof data.pendingInvites === 'object' ? data.pendingInvites : {}) } as Record<string, unknown>;
    delete pendingInvites[String(input.email || '').toLowerCase()];
    tx.update(ref, { memberIds, members, pendingInvites, updatedAt: Date.now() });
  });
}

export async function inviteTenantMemberByEmail(
  db: Firestore,
  tenantId: string,
  role: BooksRole,
  input: { email: string; memberRole: BooksRole; featureIds?: string[]; invitedBy: string },
) {
  assertCan(role, 'manage_settings');
  const email = String(input.email || '').trim().toLowerCase();
  if (!email || !email.includes('@')) throw new Error('Valid email required');
  const ref = tenantRef(db, tenantId);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error('Books workspace not found');
    const data = snap.data() || {};
    const pendingInvites = { ...(data.pendingInvites && typeof data.pendingInvites === 'object' ? data.pendingInvites : {}) } as Record<string, unknown>;
    pendingInvites[email] = {
      email,
      role: input.memberRole,
      featureIds: input.featureIds || [],
      invitedBy: input.invitedBy,
      createdAt: Date.now(),
    };
    tx.update(ref, { pendingInvites, updatedAt: Date.now() });
  });
}

export async function removeTenantMember(
  db: Firestore,
  tenantId: string,
  role: BooksRole,
  uid: string,
) {
  assertCan(role, 'manage_settings');
  const ref = tenantRef(db, tenantId);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error('Books workspace not found');
    const data = snap.data() || {};
    if (data.ownerId === uid) throw new Error('Cannot remove the Books company owner');
    const memberIds = (Array.isArray(data.memberIds) ? data.memberIds : []).filter((id: string) => id !== uid);
    const members = { ...(data.members && typeof data.members === 'object' ? data.members : {}) } as Record<string, unknown>;
    delete members[uid];
    tx.update(ref, { memberIds, members, updatedAt: Date.now() });
  });
}

export async function updateTenantName(
  db: Firestore,
  tenantId: string,
  role: BooksRole,
  name: string,
  logoPath?: string | null,
  profile?: {
    gstin?: string;
    address?: string;
    city?: string;
    state?: string;
    pincode?: string;
    phone?: string;
    email?: string;
    website?: string;
    invoiceFooter?: string;
  }
) {
  assertCan(role, 'manage_settings');
  const trimmed = name.trim();
  if (trimmed.length < 2) throw new BooksError('Workspace name is required');
  await updateDoc(tenantRef(db, tenantId), clean({
    name: trimmed,
    ...(logoPath !== undefined ? { logoPath } : {}),
    ...(profile ? {
      gstin: (profile.gstin || '').trim(),
      address: (profile.address || '').trim(),
      city: (profile.city || '').trim(),
      state: (profile.state || '').trim(),
      pincode: (profile.pincode || '').trim(),
      phone: (profile.phone || '').trim(),
      email: (profile.email || '').trim(),
      website: (profile.website || '').trim(),
      invoiceFooter: (profile.invoiceFooter || '').trim(),
    } : {}),
  }));
}

export async function transferFunds(
  ctx: TxCtx,
  input: { fromAccountId: string; toAccountId: string; amountMinor: number; date: string; memo: string }
) {
  if (input.fromAccountId === input.toAccountId) throw new BooksError('Choose two different accounts');
  if (input.amountMinor <= 0) throw new BooksError('Transfer amount must be greater than zero');
  return postManualJournal(ctx, {
    date: input.date,
    description: input.memo.trim() || 'Bank transfer',
    lines: [
      { accountId: input.toAccountId, debitMinor: input.amountMinor, creditMinor: 0, memo: 'Transfer in' },
      { accountId: input.fromAccountId, debitMinor: 0, creditMinor: input.amountMinor, memo: 'Transfer out' },
    ],
    idempotencyKey: `transfer_${crypto.randomUUID()}`,
  });
}

export async function saveRecurring(
  ctx: TxCtx,
  input: {
    name: string;
    description: string;
    lines?: JournalLineInput[];
    kind?: RecurringTemplate['kind'];
    partyId?: string | null;
    documentLines?: DocumentLineInput[];
    interstate?: boolean;
    dueDays?: number;
    autoPost?: boolean;
  }
) {
  assertCan(ctx.role, 'create');
  const kind = input.kind || 'journal';
  if (kind === 'journal') {
    if (!input.lines?.length) throw new BooksError('Add balanced journal lines');
    assertBalanced(input.lines);
  } else {
    if (!input.partyId) throw new BooksError('Select a customer or vendor');
    if (!input.documentLines?.length) throw new BooksError('Add at least one document line');
  }
  const ref = doc(col(ctx.db, ctx.tenantId, 'recurring'));
  await setDoc(ref, clean({
    name: input.name.trim(),
    description: input.description.trim(),
    lines: persistLines(input.lines || []),
    kind,
    partyId: input.partyId || null,
    documentLines: input.documentLines || [],
    interstate: Boolean(input.interstate),
    dueDays: Number(input.dueDays || 30),
    autoPost: Boolean(input.autoPost),
    active: true,
    lastRunAt: null,
  }));
  return ref.id;
}

export async function runRecurring(ctx: TxCtx, template: RecurringTemplate, date: string) {
  if (template.kind === 'invoice' || template.kind === 'bill') {
    throw new BooksError('This template creates a document, not a journal');
  }
  const id = await postManualJournal(ctx, {
    date,
    description: template.description || template.name,
    lines: template.lines,
    idempotencyKey: `recur_${template.id}_${date}_${crypto.randomUUID()}`,
  });
  await updateDoc(doc(col(ctx.db, ctx.tenantId, 'recurring'), template.id), { lastRunAt: nowISO() });
  return id;
}

export async function runRecurringDocument(
  ctx: TxCtx,
  template: RecurringTemplate,
  date: string,
  taxCodes: TaxCode[],
  accounts: FinanceAccount[],
) {
  if (template.kind !== 'invoice' && template.kind !== 'bill') throw new BooksError('Not a document template');
  const dueDays = template.dueDays || 30;
  const id = await saveDocument(ctx, {
    kind: template.kind,
    partyId: template.partyId || null,
    date,
    dueDate: addDays(date, dueDays),
    lines: template.documentLines || [],
    interstate: Boolean(template.interstate),
    memo: template.description || template.name,
    taxCodes,
  });
  if (template.autoPost) await postDocument(ctx, id, accounts);
  await updateDoc(doc(col(ctx.db, ctx.tenantId, 'recurring'), template.id), { lastRunAt: nowISO() });
  return id;
}

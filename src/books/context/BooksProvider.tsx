import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { db } from '../../lib/firebase';
import { isFirestoreQuota, FIRESTORE_QUOTA_MESSAGE } from '../../lib/quota';
import { useAuth } from '../../context/AuthContext';
import { can, type BooksAction } from '../core/permissions';
import type {
  Approval,
  BankRule,
  BankTxn,
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
  LeaseContract,
  PartyKind,
  Product,
  Project,
  RecurringTemplate,
  RevenueContract,
  TaxCode,
  AuditEvent,
  Workpaper,
  BooksFile,
  BooksTemplate,
} from '../core/types';
import {
  closePeriod,
  convertDocument,
  applyCredit,
  loadLedger,
  loadWorkspace,
  postDocument,
  postManualJournal,
  recordPayment,
  reopenPeriod,
  resolveTenantId,
  reverseJournal,
  runRecurring,
  runRecurringDocument,
  saveAccount,
  saveDocument,
  saveParty,
  saveRecurring,
  transferFunds,
  updateTenantName,
  voidDocument,
  deactivateParty as deactivatePartyRecord,
  type TxCtx,
} from '../data/repo';
import { createChildWorkspace, listOrgDirectory, syncOrgIndexName } from '../data/orgs';
import { BOOKS_WORKSPACE_EVENT, ownsWorkspace, readActiveWorkspace, selectWorkspace, writeActiveWorkspace, type OrgRecord } from '../core/hierarchy';
import { partyReceivableExposure } from '../engine/posting';
import {
  addEntity,
  adjustStock,
  decideApproval,
  depreciateAsset,
  disposeAsset,
  issueStock,
  linkInboxItem,
  payLease,
  receiveStock,
  recognizeRevenue,
  reviewWorkpaper,
  saveApproval,
  saveAsset,
  saveBankRule,
  saveBankTxn,
  saveBudget,
  saveContract,
  saveInboxItem,
  saveLease,
  saveProduct,
  saveProject,
  saveWorkpaper,
  toggleReconcile,
  withholdTds,
} from '../data/domains';
import { archiveTemplate as removeTemplate, archiveWorkspaceFile, loadFilesAndTemplates, saveTemplate, uploadWorkspaceFile } from '../data/files';
import { documentHref, setBooksSearchHits } from '../../lib/search-index';
import { useToast } from '../../context/ToastContext';
import { useAppPrefs } from '../../context/AppPrefsContext';

type BooksContextValue = {
  loading: boolean;
  error: string | null;
  tenant: FinanceTenant | null;
  tenantId: string | null;
  orgs: OrgRecord[];
  currency: string;
  role: TxCtx['role'] | null;
  accounts: FinanceAccount[];
  parties: FinanceParty[];
  journals: FinanceJournal[];
  documents: FinanceDocument[];
  periods: FinancePeriod[];
  taxCodes: TaxCode[];
  recurring: RecurringTemplate[];
  audit: AuditEvent[];
  entities: FinanceEntity[];
  products: Product[];
  assets: FixedAsset[];
  projects: Project[];
  budgets: BudgetLine[];
  contracts: RevenueContract[];
  leases: LeaseContract[];
  bankTxns: BankTxn[];
  bankRules: BankRule[];
  inbox: InboxItem[];
  workpapers: Workpaper[];
  approvals: Approval[];
  postingAccounts: FinanceAccount[];
  can: (action: BooksAction) => boolean;
  refresh: () => Promise<void>;
  switchWorkspace: (id: string) => Promise<void>;
  createCompany: (name: string, parentId?: string) => Promise<string>;
  ctx: () => TxCtx;
  createParty: (input: {
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
  }) => Promise<string>;
  deactivateParty: (id: string) => Promise<void>;
  createAccount: (input: { code: string; name: string; type: FinanceAccount['type']; parentId: string | null }) => Promise<string>;
  createDocument: (input: {
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
  }) => Promise<string>;
  postDoc: (id: string, payFromAccountId?: string) => Promise<void>;
  payDoc: (id: string, amountMinor: number, date: string, cashAccountId: string) => Promise<void>;
  applyDocCredit: (creditId: string, targetId: string, amountMinor?: number) => Promise<void>;
  voidDoc: (id: string) => Promise<void>;
  convertDoc: (id: string, nextKind: DocumentKind) => Promise<string>;
  postJournal: (input: { date: string; description: string; lines: JournalLineInput[] }) => Promise<void>;
  reverse: (journalId: string) => Promise<void>;
  close: (periodId: string) => Promise<void>;
  reopen: (periodId: string) => Promise<void>;
  rename: (name: string, logoPath?: string | null, profile?: {
    gstin?: string;
    address?: string;
    city?: string;
    state?: string;
    pincode?: string;
    phone?: string;
    email?: string;
    website?: string;
    invoiceFooter?: string;
  }) => Promise<void>;
  ledger: (accountId: string) => ReturnType<typeof loadLedger>;
  transfer: (input: { fromAccountId: string; toAccountId: string; amountMinor: number; date: string; memo: string }) => Promise<void>;
  createRecurring: (input: {
    name: string;
    description: string;
    lines?: JournalLineInput[];
    kind?: RecurringTemplate['kind'];
    partyId?: string | null;
    documentLines?: DocumentLineInput[];
    interstate?: boolean;
    dueDays?: number;
    autoPost?: boolean;
  }) => Promise<string>;
  runRecurringTemplate: (template: RecurringTemplate, date: string) => Promise<void>;
  createProduct: (input: Omit<Product, 'id'>) => Promise<string>;
  stockIn: (product: Product, qtyMilli: number, payAccountId: string) => Promise<void>;
  stockOut: (product: Product, qtyMilli: number) => Promise<void>;
  adjustProduct: (product: Product, qtyMilli: number) => Promise<void>;
  createAsset: (input: { name: string; costMinor: number; lifeMonths: number; residualMinor: number; payAccountId: string }) => Promise<string>;
  runDepreciation: (asset: FixedAsset) => Promise<void>;
  disposeFixedAsset: (asset: FixedAsset, proceedsMinor: number, cashAccountId: string) => Promise<void>;
  createProject: (input: Omit<Project, 'id'>) => Promise<string>;
  createBudget: (input: Omit<BudgetLine, 'id'>) => Promise<string>;
  createContract: (input: { name: string; customerId: string | null; totalMinor: number; months: number; cashAccountId: string }) => Promise<string>;
  recognize: (contract: RevenueContract) => Promise<void>;
  createLease: (input: Omit<LeaseContract, 'id' | 'paidMonths' | 'status'>) => Promise<string>;
  payLeaseMonth: (lease: LeaseContract, payAccountId: string) => Promise<void>;
  createBankTxn: (input: { accountId: string; date: string; amountMinor: number; memo: string; clearingAccountId?: string }) => Promise<string>;
  importBankTxns: (rows: Array<{ accountId: string; date: string; amountMinor: number; memo: string }>) => Promise<number>;
  reconcileTxn: (txn: BankTxn) => Promise<void>;
  createBankRule: (input: { contains: string; clearingAccountId: string }) => Promise<string>;
  createEntity: (name: string) => Promise<string>;
  createInbox: (input: { title: string; kind: InboxItem['kind']; notes: string; filePath?: string | null }) => Promise<string>;
  markInboxLinked: (id: string) => Promise<void>;
  createWorkpaper: (input: { title: string; periodId: string; notes: string; filePath?: string | null }) => Promise<string>;
  markWorkpaperReviewed: (id: string) => Promise<void>;
  createApproval: (input: { title: string; resource: string; resourceId: string; notes: string }) => Promise<string>;
  decide: (id: string, status: 'approved' | 'rejected') => Promise<void>;
  postTds: (input: { amountMinor: number; againstAccountId: string; date: string; memo: string }) => Promise<void>;
  files: BooksFile[];
  templates: BooksTemplate[];
  uploadFile: (input: { domain: string; resourceId?: string | null; file: File }) => Promise<{ id: string; path: string; url?: string; quotaBlocked?: boolean; message?: string }>;
  archiveFile: (file: BooksFile) => Promise<void>;
  createTemplate: (input: { domain: string; name: string; kind: BooksTemplate['kind']; payload: Record<string, unknown> }) => Promise<string>;
  archiveTemplate: (id: string) => Promise<void>;
};

const BooksContext = createContext<BooksContextValue | null>(null);

export function useBooks() {
  const value = useContext(BooksContext);
  if (!value) throw new Error('useBooks must be used within BooksProvider');
  return value;
}

function isWorkspaceMember(tenant: FinanceTenant, uid: string, tenantId: string) {
  if (tenantId === uid) return true;
  if (tenant.ownerId === uid) return true;
  const ids = tenant.memberIds as unknown;
  if (Array.isArray(ids) && ids.includes(uid)) return true;
  if (ids && typeof ids === 'object' && !Array.isArray(ids) && uid in (ids as object)) return true;
  if (tenant.members && typeof tenant.members === 'object' && uid in tenant.members) return true;
  return false;
}

export default function BooksProvider({ children }: { children: React.ReactNode }) {
  const { currentUser, userProfile } = useAuth();
  const { addToast } = useToast();
  const { prefs, confirmAction } = useAppPrefs();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [tenant, setTenant] = useState<FinanceTenant | null>(null);
  const [orgs, setOrgs] = useState<OrgRecord[]>([]);
  const [accounts, setAccounts] = useState<FinanceAccount[]>([]);
  const [parties, setParties] = useState<FinanceParty[]>([]);
  const [journals, setJournals] = useState<FinanceJournal[]>([]);
  const [documents, setDocuments] = useState<FinanceDocument[]>([]);
  const [periods, setPeriods] = useState<FinancePeriod[]>([]);
  const [taxCodes, setTaxCodes] = useState<TaxCode[]>([]);
  const [recurring, setRecurring] = useState<RecurringTemplate[]>([]);
  const [audit, setAudit] = useState<AuditEvent[]>([]);
  const [entities, setEntities] = useState<FinanceEntity[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [assets, setAssets] = useState<FixedAsset[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [budgets, setBudgets] = useState<BudgetLine[]>([]);
  const [contracts, setContracts] = useState<RevenueContract[]>([]);
  const [leases, setLeases] = useState<LeaseContract[]>([]);
  const [bankTxns, setBankTxns] = useState<BankTxn[]>([]);
  const [bankRules, setBankRules] = useState<BankRule[]>([]);
  const [inbox, setInbox] = useState<InboxItem[]>([]);
  const [workpapers, setWorkpapers] = useState<Workpaper[]>([]);
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [files, setFiles] = useState<BooksFile[]>([]);
  const [templates, setTemplates] = useState<BooksTemplate[]>([]);

  const role = tenant && currentUser
    ? tenant.members?.[currentUser.uid]?.role ?? (tenant.ownerId === currentUser.uid ? 'owner' : 'viewer')
    : null;

  const refresh = useCallback(async (knownTenantId?: string, silent = false) => {
    if (!currentUser) return;
    const firstOpen = !(knownTenantId || tenantId);
    if (firstOpen && !silent) setLoading(true);
    setError(null);
    try {
      let rootId = currentUser.uid;
      let provisioned = false;
      try { provisioned = sessionStorage.getItem(`byjan_books_ready_${currentUser.uid}`) === '1'; } catch { /* private mode */ }
      if (!provisioned) {
        rootId = await resolveTenantId(
          db,
          currentUser.uid,
          currentUser.email || userProfile?.email || '',
          userProfile?.displayName || currentUser.displayName || 'Byjan'
        );
      }
      let id = knownTenantId || readActiveWorkspace(currentUser.uid);
      if (!ownsWorkspace(currentUser.uid, id)) id = rootId;
      if (!silent && id !== tenantId) setLoading(true);
      setTenantId(id);
      writeActiveWorkspace(currentUser.uid, id);
      let workspace;
      try {
        workspace = await loadWorkspace(db, id);
      } catch (err: any) {
        if (!String(err?.message || '').includes('Workspace not found')) throw err;
        if (id !== rootId) {
          id = rootId;
          setTenantId(id);
          writeActiveWorkspace(currentUser.uid, id);
        } else {
          try { sessionStorage.removeItem(`byjan_books_ready_${currentUser.uid}`); } catch { /* private mode */ }
          await resolveTenantId(
            db,
            currentUser.uid,
            currentUser.email || userProfile?.email || '',
            userProfile?.displayName || currentUser.displayName || 'Byjan'
          );
        }
        workspace = await loadWorkspace(db, id);
      }
      if (!isWorkspaceMember(workspace.tenant, currentUser.uid, id)) {
        throw new Error('Not a member of this Books workspace');
      }
      setTenant(workspace.tenant);
      setAccounts(workspace.accounts);
      setParties(workspace.parties);
      setJournals(workspace.journals);
      setDocuments(workspace.documents);
      setPeriods(workspace.periods);
      setTaxCodes(workspace.taxCodes);
      setRecurring(workspace.recurring);
      setAudit(workspace.audit);
      setEntities(workspace.entities);
      setProducts(workspace.products);
      setAssets(workspace.assets);
      setProjects(workspace.projects);
      setBudgets(workspace.budgets);
      setContracts(workspace.contracts);
      setLeases(workspace.leases);
      setBankTxns(workspace.bankTxns);
      setBankRules(workspace.bankRules);
      setInbox(workspace.inbox);
      setWorkpapers(workspace.workpapers);
      setApprovals(workspace.approvals);
      setFiles(workspace.files);
      setTemplates(workspace.templates);
      try {
        setOrgs(await listOrgDirectory(db, currentUser.uid, workspace.tenant.name));
      } catch {
        setOrgs([{
          id,
          name: workspace.tenant.name,
          parentId: workspace.tenant.parentId || null,
          depth: Number(workspace.tenant.depth || 0),
          kind: workspace.tenant.kind || 'root',
          role: 'owner',
        }]);
      }
    } catch (err: any) {
      setError(isFirestoreQuota(err) ? FIRESTORE_QUOTA_MESSAGE : (err?.message || 'Failed to open Books'));
    } finally {
      setLoading(false);
    }
  }, [currentUser, tenantId, userProfile?.displayName, userProfile?.email]);

  const refreshFiles = useCallback(async () => {
    if (!tenantId) return;
    try {
      const extras = await loadFilesAndTemplates(db, tenantId);
      setFiles(extras.files);
      setTemplates(extras.templates);
    } catch (err) {
      if (isFirestoreQuota(err)) return;
      throw err;
    }
  }, [tenantId]);

  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refreshBusy = useRef(false);
  const scheduleRefresh = useCallback(() => {
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    refreshTimer.current = setTimeout(() => {
      refreshTimer.current = null;
      if (refreshBusy.current) return;
      refreshBusy.current = true;
      void refresh(undefined, true).catch((err) => {
        if (isFirestoreQuota(err)) return;
      }).finally(() => {
        refreshBusy.current = false;
      });
    }, 250);
  }, [refresh]);

  useEffect(() => () => {
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
  }, []);

  useEffect(() => {
    if (!currentUser) {
      setLoading(false);
      return;
    }
    void refresh();
  }, [currentUser?.uid]);

  useEffect(() => {
    const onSwitch = (event: Event) => {
      const id = String((event as CustomEvent).detail?.id || '');
      if (!currentUser || !ownsWorkspace(currentUser.uid, id) || id === tenantId) return;
      void refresh(id);
    };
    window.addEventListener(BOOKS_WORKSPACE_EVENT, onSwitch);
    return () => window.removeEventListener(BOOKS_WORKSPACE_EVENT, onSwitch);
  }, [currentUser, refresh, tenantId]);

  const switchWorkspace = useCallback(async (id: string) => {
    if (!currentUser) return;
    if (!ownsWorkspace(currentUser.uid, id)) throw new Error('Not allowed to open this company');
    writeActiveWorkspace(currentUser.uid, id);
    await refresh(id);
    selectWorkspace(currentUser.uid, id);
  }, [currentUser, refresh]);

  const createCompany = useCallback(async (name: string, parentId?: string) => {
    if (!currentUser || !role) throw new Error('Books workspace is not ready');
    const id = await createChildWorkspace(db, {
      uid: currentUser.uid,
      email: currentUser.email || userProfile?.email || '',
      displayName: userProfile?.displayName || currentUser.displayName || 'Byjan',
      parentId: parentId || tenantId || currentUser.uid,
      name,
      role,
    });
    writeActiveWorkspace(currentUser.uid, id);
    await refresh(id);
    selectWorkspace(currentUser.uid, id);
    return id;
  }, [currentUser, refresh, role, tenantId, userProfile?.displayName, userProfile?.email]);

  useEffect(() => {
    if (!tenant) {
      setBooksSearchHits([]);
      return;
    }
    const currency = tenant.baseCurrency || 'INR';
    setBooksSearchHits([
      ...documents.slice(0, 80).map((d) => ({
        id: `doc-${d.id}`,
        type: 'record' as const,
        href: documentHref(d.kind, d.id),
        description: `${d.number}${d.memo ? ` · ${d.memo}` : ''}`,
        hint: d.kind.replace('_', ' '),
        amount: d.totalMinor / 100,
        currency,
        date: d.date,
      })),
      ...parties.filter((p) => p.active !== false).slice(0, 80).map((p) => ({
        id: `party-${p.id}`,
        type: 'record' as const,
        href: `${p.kind === 'vendor' ? '/books/vendors' : '/books/customers'}?open=${p.id}`,
        description: p.name,
        hint: p.kind,
        category: p.taxId || p.email || undefined,
      })),
      ...accounts.filter((a) => a.active).slice(0, 80).map((a) => ({
        id: `acct-${a.id}`,
        type: 'record' as const,
        href: `/books/ledger/${a.id}`,
        description: `${a.code} ${a.name}`,
        hint: 'ledger',
      })),
      ...journals.slice(0, 40).map((j) => ({
        id: `jnl-${j.id}`,
        type: 'record' as const,
        href: `/books/journals?open=${j.id}`,
        description: `${j.number} · ${j.description}`,
        hint: 'journal',
        date: j.date,
      })),
    ]);
  }, [accounts, documents, journals, parties, tenant]);

  const ctx = useCallback((): TxCtx => {
    if (!currentUser || !tenantId || !role) throw new Error('Books workspace is not ready');
    return { db, tenantId, uid: currentUser.uid, role };
  }, [currentUser, tenantId, role]);

  const value = useMemo<BooksContextValue>(() => {
    const after = async <T,>(work: () => Promise<T>, ok?: string, gate?: 'post' | 'delete') => {
      if (gate) {
        const allowed = await confirmAction(
          gate === 'delete' ? (ok || 'Reverse or void this record?') : (ok ? `${ok}. Continue?` : 'Post this to the ledger?'),
          gate,
        );
        if (!allowed) {
          const err: Error & { name: string } = new Error('Cancelled');
          err.name = 'CancelledError';
          throw err;
        }
      }
      try {
        const result = await work();
        if (ok) addToast(ok, 'success');
        if (prefs.autoRefreshBooks) scheduleRefresh();
        return result;
      } catch (err: any) {
        if (err?.name !== 'CancelledError') addToast(err?.message || 'Could not save', 'error');
        throw err;
      }
    };
    return {
      loading,
      error,
      tenant,
      tenantId,
      orgs,
      currency: tenant?.baseCurrency || 'INR',
      role,
      accounts,
      parties,
      journals,
      documents,
      periods,
      taxCodes,
      recurring,
      audit,
      entities,
      products,
      assets,
      projects,
      budgets,
      contracts,
      leases,
      bankTxns,
      bankRules,
      inbox,
      workpapers,
      approvals,
      files,
      templates,
      postingAccounts: accounts.filter((a) => a.active && a.allowPosting),
      can: (action) => can(role, action),
      refresh,
      switchWorkspace,
      createCompany,
      ctx,
      createParty: (input) => after(() => saveParty(db, tenantId!, role!, input), 'Party saved'),
      deactivateParty: (id) => after(() => deactivatePartyRecord(db, tenantId!, role!, id), 'Party deactivated'),
      createAccount: (input) => after(() => saveAccount(db, tenantId!, role!, input), 'Account saved'),
      createDocument: (input) => after(() => saveDocument(ctx(), { ...input, taxCodes }), 'Draft saved'),
      postDoc: async (id, payFromAccountId) => {
        const row = documents.find((d) => d.id === id);
        if ((row?.kind === 'invoice' || row?.kind === 'debit_note') && row.partyId) {
          const party = parties.find((p) => p.id === row.partyId);
          if (party?.creditLimitMinor) {
            const used = partyReceivableExposure(documents, row.partyId);
            if (used + row.totalMinor > party.creditLimitMinor) {
              const message = `Credit limit exceeded for ${party.name}`;
              addToast(message, 'error');
              throw new Error(message);
            }
          }
        }
        return after(() => postDocument(ctx(), id, accounts, payFromAccountId), 'Posted to the ledger', 'post');
      },
      payDoc: (id, amountMinor, date, cashAccountId) => after(() => recordPayment(ctx(), id, amountMinor, date, cashAccountId, accounts), 'Payment posted', 'post'),
      applyDocCredit: (creditId, targetId, amountMinor) => after(() => applyCredit(ctx(), creditId, targetId, amountMinor), 'Credit applied', 'post'),
      voidDoc: (id) => after(() => voidDocument(ctx(), id), 'Voided', 'delete'),
      convertDoc: (id, nextKind) => after(() => convertDocument(ctx(), id, nextKind, taxCodes), 'Converted'),
      postJournal: (input) => after(() => postManualJournal(ctx(), { ...input, idempotencyKey: `manual_${crypto.randomUUID()}` }), 'Journal posted', 'post'),
      reverse: (journalId) => after(() => reverseJournal(ctx(), journalId), 'Journal reversed', 'delete'),
      close: (periodId) => after(() => closePeriod(ctx(), periodId), 'Period closed', 'post'),
      reopen: (periodId) => after(() => reopenPeriod(ctx(), periodId), 'Period reopened'),
      rename: async (name, logoPath, profile) => after(async () => {
        await updateTenantName(db, tenantId!, role!, name, logoPath, profile);
        if (currentUser) await syncOrgIndexName(db, currentUser.uid, tenantId!, name.trim());
      }, 'Settings saved'),
      ledger: (accountId) => loadLedger(db, tenantId!, accountId),
      transfer: (input) => after(() => transferFunds(ctx(), input), 'Transfer posted', 'post'),
      createRecurring: (input) => after(() => saveRecurring(ctx(), input), 'Template saved'),
      runRecurringTemplate: (template, date) => after(() => (
        template.kind === 'invoice' || template.kind === 'bill'
          ? runRecurringDocument(ctx(), template, date, taxCodes, accounts)
          : runRecurring(ctx(), template, date)
      ), template.autoPost || !template.kind || template.kind === 'journal' ? 'Posted' : 'Document created', 'post'),
      createProduct: (input) => after(() => saveProduct(ctx(), input), 'Saved'),
      stockIn: (product, qtyMilli, payAccountId) => after(() => receiveStock(ctx(), product, qtyMilli, payAccountId, accounts), 'Stock received'),
      stockOut: (product, qtyMilli) => after(() => issueStock(ctx(), product, qtyMilli, accounts), 'Stock issued'),
      adjustProduct: (product, qtyMilli) => after(() => adjustStock(ctx(), product, qtyMilli, accounts), 'Stock adjusted'),
      createAsset: (input) => after(() => saveAsset(ctx(), input, accounts), 'Asset acquired'),
      runDepreciation: (asset) => after(() => depreciateAsset(ctx(), asset, accounts), 'Depreciation posted'),
      disposeFixedAsset: (asset, proceedsMinor, cashAccountId) => after(() => disposeAsset(ctx(), asset, proceedsMinor, cashAccountId, accounts), 'Asset disposed'),
      createProject: (input) => after(() => saveProject(ctx(), input), 'Project saved'),
      createBudget: (input) => after(() => saveBudget(ctx(), input), 'Budget saved'),
      createContract: (input) => after(() => saveContract(ctx(), input, accounts, input.cashAccountId), 'Contract saved'),
      recognize: (contract) => after(() => recognizeRevenue(ctx(), contract, accounts), 'Revenue recognized'),
      createLease: (input) => after(() => saveLease(ctx(), input), 'Lease saved'),
      payLeaseMonth: (lease, payAccountId) => after(() => payLease(ctx(), lease, payAccountId, accounts), 'Lease payment posted'),
      createBankTxn: async (input) => {
        try {
          const hay = input.memo.toLowerCase();
          const rule = input.clearingAccountId
            ? null
            : bankRules.find((r) => r.active !== false && hay.includes(r.contains.toLowerCase()));
          const id = await saveBankTxn(ctx(), { ...input, clearingAccountId: input.clearingAccountId || rule?.clearingAccountId }, accounts);
          setBankTxns((prev) => [{ id, journalId: null, reconciled: false, ...input }, ...prev]);
          addToast(rule ? `Bank journal posted · matched “${rule.contains}”` : 'Bank journal posted', 'success');
          scheduleRefresh();
          return id;
        } catch (err: any) {
          addToast(err?.message || 'Bank journal failed', 'error');
          throw err;
        }
      },
      importBankTxns: async (rows) => {
        try {
          const created: BankTxn[] = [];
          for (const row of rows) {
            const hay = row.memo.toLowerCase();
            const rule = bankRules.find((r) => r.active !== false && hay.includes(r.contains.toLowerCase()));
            const id = await saveBankTxn(ctx(), { ...row, clearingAccountId: rule?.clearingAccountId }, accounts);
            created.push({ id, journalId: null, reconciled: false, ...row });
          }
          if (created.length) setBankTxns((prev) => [...created, ...prev]);
          addToast(`Posted ${created.length} statement row${created.length === 1 ? '' : 's'}`, 'success');
          scheduleRefresh();
          return created.length;
        } catch (err: any) {
          addToast(err?.message || 'CSV import failed', 'error');
          throw err;
        }
      },
      reconcileTxn: async (txn) => {
        setBankTxns((prev) => prev.map((row) => row.id === txn.id ? { ...row, reconciled: !row.reconciled } : row));
        await toggleReconcile(ctx(), txn);
        scheduleRefresh();
      },
      createBankRule: (input) => after(() => saveBankRule(ctx(), input), 'Matching rule saved'),
      createEntity: (name) => after(() => addEntity(ctx(), name), 'Entity saved'),
      createInbox: (input) => after(() => saveInboxItem(ctx(), input), 'Inbox item saved'),
      markInboxLinked: (id) => after(() => linkInboxItem(ctx(), id), 'Marked linked'),
      createWorkpaper: (input) => after(() => saveWorkpaper(ctx(), input), 'Workpaper saved'),
      markWorkpaperReviewed: (id) => after(() => reviewWorkpaper(ctx(), id), 'Reviewed'),
      createApproval: (input) => after(() => saveApproval(ctx(), input), 'Approval sent'),
      decide: (id, status) => after(() => decideApproval(ctx(), id, status), status === 'approved' ? 'Approved' : 'Rejected'),
      postTds: (input) => after(() => withholdTds(ctx(), input, accounts), 'TDS posted'),
      uploadFile: async (input) => {
        const result = await uploadWorkspaceFile(ctx(), input);
        setFiles((prev) => {
          if (prev.some((file) => file.id === result.id)) return prev;
          const name = input.file.name.replace(/[/\\]/g, '').trim();
          const ext = name.split('.').pop()?.toLowerCase() || '';
          return [{
            id: result.id,
            domain: input.domain,
            resourceId: input.resourceId || null,
            name,
            ext,
            size: input.file.size,
            contentType: input.file.type || '',
            path: result.path,
            url: result.url,
            status: 'active',
            createdAt: new Date().toISOString(),
            createdBy: currentUser?.uid || '',
          }, ...prev];
        });
        if (!result.quotaBlocked) void refreshFiles().catch(() => undefined);
        return result;
      },
      archiveFile: async (file) => {
        await archiveWorkspaceFile(ctx(), file);
        await refreshFiles();
      },
      createTemplate: (input) => after(() => saveTemplate(ctx(), input), 'Template saved'),
      archiveTemplate: (id) => after(() => removeTemplate(ctx(), id), 'Template archived'),
    };
  }, [accounts, addToast, approvals, assets, audit, bankRules, bankTxns, budgets, confirmAction, contracts, createCompany, ctx, currentUser, documents, entities, error, files, inbox, journals, leases, loading, orgs, parties, periods, prefs.autoRefreshBooks, products, projects, recurring, refresh, refreshFiles, role, scheduleRefresh, switchWorkspace, taxCodes, templates, tenant, tenantId, workpapers]);

  return <BooksContext.Provider value={value}><div className="h-full min-h-0">{children}</div></BooksContext.Provider>;
}

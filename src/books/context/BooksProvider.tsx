import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { db } from '../../lib/firebase';
import { useAuth } from '../../context/AuthContext';
import { can, type BooksAction } from '../core/permissions';
import type {
  Approval,
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
  loadLedger,
  loadWorkspace,
  postDocument,
  postManualJournal,
  recordPayment,
  reopenPeriod,
  resolveTenantId,
  reverseJournal,
  runRecurring,
  saveAccount,
  saveDocument,
  saveParty,
  saveRecurring,
  transferFunds,
  updateTenantName,
  voidDocument,
  type TxCtx,
} from '../data/repo';
import {
  addEntity,
  decideApproval,
  depreciateAsset,
  issueStock,
  linkInboxItem,
  loadDomainCollections,
  payLease,
  receiveStock,
  recognizeRevenue,
  reviewWorkpaper,
  saveApproval,
  saveAsset,
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

type BooksContextValue = {
  loading: boolean;
  error: string | null;
  tenant: FinanceTenant | null;
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
  inbox: InboxItem[];
  workpapers: Workpaper[];
  approvals: Approval[];
  postingAccounts: FinanceAccount[];
  can: (action: BooksAction) => boolean;
  refresh: () => Promise<void>;
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
  }) => Promise<string>;
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
  }) => Promise<string>;
  postDoc: (id: string, payFromAccountId?: string) => Promise<void>;
  payDoc: (id: string, amountMinor: number, date: string, cashAccountId: string) => Promise<void>;
  voidDoc: (id: string) => Promise<void>;
  convertDoc: (id: string, nextKind: DocumentKind) => Promise<string>;
  postJournal: (input: { date: string; description: string; lines: JournalLineInput[] }) => Promise<void>;
  reverse: (journalId: string) => Promise<void>;
  close: (periodId: string) => Promise<void>;
  reopen: (periodId: string) => Promise<void>;
  rename: (name: string, logoPath?: string | null) => Promise<void>;
  ledger: (accountId: string) => ReturnType<typeof loadLedger>;
  transfer: (input: { fromAccountId: string; toAccountId: string; amountMinor: number; date: string; memo: string }) => Promise<void>;
  createRecurring: (input: { name: string; description: string; lines: JournalLineInput[] }) => Promise<string>;
  runRecurringTemplate: (template: RecurringTemplate, date: string) => Promise<void>;
  createProduct: (input: Omit<Product, 'id'>) => Promise<string>;
  stockIn: (product: Product, qtyMilli: number, payAccountId: string) => Promise<void>;
  stockOut: (product: Product, qtyMilli: number) => Promise<void>;
  createAsset: (input: { name: string; costMinor: number; lifeMonths: number; residualMinor: number; payAccountId: string }) => Promise<string>;
  runDepreciation: (asset: FixedAsset) => Promise<void>;
  createProject: (input: Omit<Project, 'id'>) => Promise<string>;
  createBudget: (input: Omit<BudgetLine, 'id'>) => Promise<string>;
  createContract: (input: { name: string; customerId: string | null; totalMinor: number; months: number; cashAccountId: string }) => Promise<string>;
  recognize: (contract: RevenueContract) => Promise<void>;
  createLease: (input: Omit<LeaseContract, 'id' | 'paidMonths' | 'status'>) => Promise<string>;
  payLeaseMonth: (lease: LeaseContract, payAccountId: string) => Promise<void>;
  createBankTxn: (input: { accountId: string; date: string; amountMinor: number; memo: string }) => Promise<string>;
  reconcileTxn: (txn: BankTxn) => Promise<void>;
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
  uploadFile: (input: { domain: string; resourceId?: string | null; file: File }) => Promise<{ id: string; path: string }>;
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

export default function BooksProvider({ children }: { children: React.ReactNode }) {
  const { currentUser, userProfile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [tenant, setTenant] = useState<FinanceTenant | null>(null);
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
  const [inbox, setInbox] = useState<InboxItem[]>([]);
  const [workpapers, setWorkpapers] = useState<Workpaper[]>([]);
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [files, setFiles] = useState<BooksFile[]>([]);
  const [templates, setTemplates] = useState<BooksTemplate[]>([]);

  const role = tenant && currentUser
    ? tenant.members?.[currentUser.uid]?.role ?? (tenant.ownerId === currentUser.uid ? 'owner' : 'viewer')
    : null;

  const refresh = useCallback(async (knownTenantId?: string) => {
    if (!currentUser) return;
    const firstOpen = !(knownTenantId || tenantId);
    if (firstOpen) setLoading(true);
    setError(null);
    try {
      const id = knownTenantId || tenantId || await resolveTenantId(
        db,
        currentUser.uid,
        currentUser.email || userProfile?.email || '',
        userProfile?.displayName || currentUser.displayName || 'Byjan'
      );
      setTenantId(id);
      const [workspace, domains, extras] = await Promise.all([
        loadWorkspace(db, id),
        loadDomainCollections(db, id),
        loadFilesAndTemplates(db, id),
      ]);
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
      setProducts(domains.products);
      setAssets(domains.assets);
      setProjects(domains.projects);
      setBudgets(domains.budgets);
      setContracts(domains.contracts);
      setLeases(domains.leases);
      setBankTxns(domains.bankTxns);
      setInbox(domains.inbox);
      setWorkpapers(domains.workpapers);
      setApprovals(domains.approvals);
      setFiles(extras.files);
      setTemplates(extras.templates);
    } catch (err: any) {
      setError(err?.message || 'Failed to open Books');
    } finally {
      setLoading(false);
    }
  }, [currentUser, tenantId, userProfile?.displayName, userProfile?.email]);

  useEffect(() => {
    if (!currentUser) {
      setLoading(false);
      return;
    }
    void refresh();
  }, [currentUser?.uid]);

  const ctx = useCallback((): TxCtx => {
    if (!currentUser || !tenantId || !role) throw new Error('Books workspace is not ready');
    return { db, tenantId, uid: currentUser.uid, role };
  }, [currentUser, tenantId, role]);

  const value = useMemo<BooksContextValue>(() => {
    const after = async <T,>(work: () => Promise<T>) => {
      const result = await work();
      await refresh();
      return result;
    };
    return {
      loading,
      error,
      tenant,
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
      inbox,
      workpapers,
      approvals,
      files,
      templates,
      postingAccounts: accounts.filter((a) => a.active && a.allowPosting),
      can: (action) => can(role, action),
      refresh,
      ctx,
      createParty: (input) => after(() => saveParty(db, tenantId!, role!, input)),
      createAccount: (input) => after(() => saveAccount(db, tenantId!, role!, input)),
      createDocument: (input) => after(() => saveDocument(ctx(), { ...input, taxCodes })),
      postDoc: (id, payFromAccountId) => after(() => postDocument(ctx(), id, accounts, payFromAccountId)),
      payDoc: (id, amountMinor, date, cashAccountId) => after(() => recordPayment(ctx(), id, amountMinor, date, cashAccountId, accounts)),
      voidDoc: (id) => after(() => voidDocument(ctx(), id)),
      convertDoc: (id, nextKind) => after(() => convertDocument(ctx(), id, nextKind)),
      postJournal: (input) => after(() => postManualJournal(ctx(), { ...input, idempotencyKey: `manual_${crypto.randomUUID()}` })),
      reverse: (journalId) => after(() => reverseJournal(ctx(), journalId)),
      close: (periodId) => after(() => closePeriod(ctx(), periodId)),
      reopen: (periodId) => after(() => reopenPeriod(ctx(), periodId)),
      rename: (name, logoPath) => after(() => updateTenantName(db, tenantId!, role!, name, logoPath)),
      ledger: (accountId) => loadLedger(db, tenantId!, accountId),
      transfer: (input) => after(() => transferFunds(ctx(), input)),
      createRecurring: (input) => after(() => saveRecurring(ctx(), input)),
      runRecurringTemplate: (template, date) => after(() => runRecurring(ctx(), template, date)),
      createProduct: (input) => after(() => saveProduct(ctx(), input)),
      stockIn: (product, qtyMilli, payAccountId) => after(() => receiveStock(ctx(), product, qtyMilli, payAccountId, accounts)),
      stockOut: (product, qtyMilli) => after(() => issueStock(ctx(), product, qtyMilli, accounts)),
      createAsset: (input) => after(() => saveAsset(ctx(), input, accounts)),
      runDepreciation: (asset) => after(() => depreciateAsset(ctx(), asset, accounts)),
      createProject: (input) => after(() => saveProject(ctx(), input)),
      createBudget: (input) => after(() => saveBudget(ctx(), input)),
      createContract: (input) => after(() => saveContract(ctx(), input, accounts, input.cashAccountId)),
      recognize: (contract) => after(() => recognizeRevenue(ctx(), contract, accounts)),
      createLease: (input) => after(() => saveLease(ctx(), input)),
      payLeaseMonth: (lease, payAccountId) => after(() => payLease(ctx(), lease, payAccountId, accounts)),
      createBankTxn: (input) => after(() => saveBankTxn(ctx(), input, accounts)),
      reconcileTxn: (txn) => after(() => toggleReconcile(ctx(), txn)),
      createEntity: (name) => after(() => addEntity(ctx(), name)),
      createInbox: (input) => after(() => saveInboxItem(ctx(), input)),
      markInboxLinked: (id) => after(() => linkInboxItem(ctx(), id)),
      createWorkpaper: (input) => after(() => saveWorkpaper(ctx(), input)),
      markWorkpaperReviewed: (id) => after(() => reviewWorkpaper(ctx(), id)),
      createApproval: (input) => after(() => saveApproval(ctx(), input)),
      decide: (id, status) => after(() => decideApproval(ctx(), id, status)),
      postTds: (input) => after(() => withholdTds(ctx(), input, accounts)),
      uploadFile: (input) => after(() => uploadWorkspaceFile(ctx(), input)),
      archiveFile: (file) => after(() => archiveWorkspaceFile(ctx(), file)),
      createTemplate: (input) => after(() => saveTemplate(ctx(), input)),
      archiveTemplate: (id) => after(() => removeTemplate(ctx(), id)),
    };
  }, [accounts, approvals, assets, audit, bankTxns, budgets, contracts, ctx, documents, entities, error, files, inbox, journals, leases, loading, parties, periods, products, projects, recurring, refresh, role, taxCodes, templates, tenant, tenantId, workpapers]);

  return <BooksContext.Provider value={value}>{children}</BooksContext.Provider>;
}

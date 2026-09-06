export type BooksRole = 'owner' | 'admin' | 'contributor' | 'viewer' | 'auditor';

export type AccountType =
  | 'asset'
  | 'liability'
  | 'equity'
  | 'revenue'
  | 'cogs'
  | 'expense'
  | 'other_income'
  | 'other_expense';

export type NormalBalance = 'debit' | 'credit';
export type JournalStatus = 'draft' | 'posted' | 'reversed';
export type JournalType = 'manual' | 'invoice' | 'bill' | 'payment' | 'expense' | 'reversal' | 'transfer' | 'depreciation' | 'recognition' | 'inventory' | 'lease';
export type DocumentKind = 'invoice' | 'bill' | 'expense' | 'quote' | 'credit_note' | 'purchase_order' | 'vendor_credit';
export type DocumentStatus = 'draft' | 'posted' | 'paid' | 'voided';
export type PartyKind = 'customer' | 'vendor';
export type PeriodStatus = 'open' | 'closed';

export type SystemAccountKey =
  | 'cash'
  | 'bank'
  | 'ar'
  | 'ap'
  | 'tax_input'
  | 'tax_output'
  | 'sales'
  | 'operating_expense'
  | 'retained_earnings'
  | 'inventory'
  | 'cogs'
  | 'fixed_asset'
  | 'accum_dep'
  | 'dep_expense'
  | 'deferred_revenue'
  | 'tds_payable';

export interface FinanceTenant {
  id: string;
  name: string;
  ownerId: string;
  baseCurrency: string;
  fiscalYearStartMonth: number;
  memberIds: string[];
  members: Record<string, { role: BooksRole; email: string }>;
  sequences: Record<string, number>;
  postedCount: number;
  version: number;
  logoPath?: string | null;
}

export interface FinanceEntity {
  id: string;
  name: string;
  country: string;
  isDefault: boolean;
}

export interface FinanceAccount {
  id: string;
  code: string;
  name: string;
  type: AccountType;
  parentId: string | null;
  normalBalance: NormalBalance;
  allowPosting: boolean;
  isSystem: boolean;
  systemKey?: SystemAccountKey | null;
  active: boolean;
  debitTotalMinor: number;
  creditTotalMinor: number;
}

export interface JournalLineInput {
  accountId: string;
  debitMinor: number;
  creditMinor: number;
  memo?: string;
  partyId?: string | null;
}

export interface FinanceJournal {
  id: string;
  number: string;
  type: JournalType;
  sourceType: string;
  sourceId: string | null;
  date: string;
  periodId: string;
  currency: string;
  description: string;
  status: JournalStatus;
  lines: JournalLineInput[];
  debitTotalMinor: number;
  creditTotalMinor: number;
  idempotencyKey: string;
  createdBy: string;
  postedBy: string | null;
  postedAt: string | null;
  reversalOfId: string | null;
  reversedById: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface FinanceParty {
  id: string;
  kind: PartyKind;
  name: string;
  email: string;
  phone: string;
  website: string;
  contactName: string;
  taxId: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  notes: string;
  logoPath: string | null;
  paymentTermsDays: number;
  active: boolean;
}

export interface DocumentLineInput {
  description: string;
  qtyMilli: number;
  unitPriceMinor: number;
  taxCode: string;
  accountId: string;
}

export interface TaxBreakdown {
  exclusiveMinor: number;
  taxMinor: number;
  cgstMinor: number;
  sgstMinor: number;
  igstMinor: number;
}

export interface FinanceDocument {
  id: string;
  kind: DocumentKind;
  number: string;
  partyId: string | null;
  date: string;
  dueDate: string | null;
  lines: DocumentLineInput[];
  taxCode: string;
  interstate: boolean;
  tax: TaxBreakdown;
  totalMinor: number;
  paidMinor: number;
  status: DocumentStatus;
  journalId: string | null;
  paymentJournalIds: string[];
  memo: string;
  projectId: string | null;
  convertedFromId: string | null;
  idempotencyKey: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface FinancePeriod {
  id: string;
  year: number;
  month: number;
  status: PeriodStatus;
}

export interface TaxCode {
  id: string;
  name: string;
  rateBps: number;
  active: boolean;
}

export interface LedgerMovement {
  id: string;
  journalId: string;
  journalNumber: string;
  date: string;
  debitMinor: number;
  creditMinor: number;
  memo: string;
  partyId?: string;
}

export interface RecurringTemplate {
  id: string;
  name: string;
  description: string;
  lines: JournalLineInput[];
  active: boolean;
  lastRunAt: string | null;
}

export interface AuditEvent {
  id: string;
  actorId: string;
  action: string;
  resource: string;
  resourceId: string;
  meta: Record<string, unknown> | null;
  at: string;
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  kind: 'goods' | 'service';
  salePriceMinor: number;
  costMinor: number;
  qtyMilli: number;
  active: boolean;
}

export interface FixedAsset {
  id: string;
  name: string;
  acquireDate: string;
  costMinor: number;
  accumDepMinor: number;
  lifeMonths: number;
  residualMinor: number;
  status: 'active' | 'disposed';
  acquireJournalId: string | null;
}

export interface Project {
  id: string;
  name: string;
  customerId: string | null;
  status: 'open' | 'closed';
  budgetMinor: number;
}

export interface BudgetLine {
  id: string;
  periodId: string;
  accountId: string;
  amountMinor: number;
}

export interface RevenueContract {
  id: string;
  name: string;
  customerId: string | null;
  totalMinor: number;
  recognizedMinor: number;
  months: number;
  status: 'open' | 'closed';
}

export interface LeaseContract {
  id: string;
  name: string;
  vendorId: string | null;
  monthlyMinor: number;
  months: number;
  paidMonths: number;
  status: 'open' | 'closed';
}

export interface BankTxn {
  id: string;
  accountId: string;
  date: string;
  amountMinor: number;
  memo: string;
  journalId: string | null;
  reconciled: boolean;
}

export interface InboxItem {
  id: string;
  title: string;
  kind: 'receipt' | 'invoice' | 'bill' | 'contract' | 'other';
  notes: string;
  filePath?: string | null;
  status: 'open' | 'linked';
  createdAt: string;
}

export interface Workpaper {
  id: string;
  title: string;
  periodId: string;
  notes: string;
  filePath?: string | null;
  status: 'open' | 'reviewed';
  createdAt: string;
}

export interface Approval {
  id: string;
  title: string;
  resource: string;
  resourceId: string;
  status: 'pending' | 'approved' | 'rejected';
  notes: string;
  createdAt: string;
}

export interface BooksFile {
  id: string;
  domain: string;
  resourceId: string | null;
  name: string;
  ext: string;
  size: number;
  contentType: string;
  path: string;
  status: 'active' | 'archived';
  createdAt: string;
  createdBy: string;
}

export interface BooksTemplate {
  id: string;
  domain: string;
  name: string;
  kind: 'document' | 'journal' | 'report' | 'note';
  payload: Record<string, unknown>;
  status: 'active' | 'archived';
  createdAt: string;
}

export const DEBIT_TYPES: AccountType[] = ['asset', 'expense', 'cogs', 'other_expense'];

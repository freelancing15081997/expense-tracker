/** Canonical Money transaction model — integer paise math, no float drift. */

export const TX_TYPES = [
  'EXPENSE',
  'INCOME',
  'TRANSFER',
  'REFUND',
  'REVERSAL',
  'CREDIT_CARD_PAYMENT',
  'CASH_WITHDRAWAL',
  'CASH_DEPOSIT',
] as const;

export type TxType = (typeof TX_TYPES)[number];

export const FINANCIAL_STATUS = ['DRAFT', 'PENDING', 'CONFIRMED', 'VOIDED', 'REVERSED'] as const;
export type FinancialStatus = (typeof FINANCIAL_STATUS)[number];

export const PROCESSING_STATUS = [
  'INGESTED', 'NORMALIZING', 'VALIDATING', 'CLASSIFYING',
  'READY', 'REVIEW_REQUIRED', 'FAILED', 'RETRYING', 'COMPLETED',
  /* Receipt autonomous flow (issue_requirment) */
  'RECEIVED', 'BOOK_SELECTED', 'EXTRACTING', 'DUPLICATE_CHECK', 'CREATED', 'AWAITING_CONTEXT',
] as const;
export type ProcessingStatus = (typeof PROCESSING_STATUS)[number];

export type {
  ReceiptFlowState,
  SplitMethod,
  SplitParticipant,
  MoneySplit,
  SettlementStatus,
  MoneySettlement,
  ActivityEvent,
  MoneyContextOption,
} from './money-flow';

export {
  RECEIPT_FLOW_STATES,
  RECEIPT_FLOW_COPY,
  SPLIT_METHODS,
  SETTLEMENT_STATUS,
  ROLE_FEATURE_DEFAULTS,
} from './money-flow';

export const CAPTURE_DIRECTION = ['MONEY_OUT', 'MONEY_IN', 'TRANSFER', 'UNKNOWN'] as const;
export type CaptureDirection = (typeof CAPTURE_DIRECTION)[number];

export type MoneyAccount = {
  id: string;
  name: string;
  kind: 'cash' | 'bank' | 'upi' | 'debit_card' | 'credit_card' | 'wallet' | 'custom';
  currency?: string;
  openingBalancePaise?: number;
  archived?: boolean;
  notes?: string;
};

export type ExpenseSplit = {
  uid: string;
  name: string;
  sharePaise: number;
  paidPaise?: number;
  settled?: boolean;
};

export type Settlement = {
  id: string;
  fromUid: string;
  toUid: string;
  amountPaise: number;
  date: string;
  note?: string;
  expenseIds?: string[];
};

export type SavingsGoal = {
  id: string;
  name: string;
  targetPaise: number;
  savedPaise: number;
  deadline?: string;
  archived?: boolean;
};

export type CategoryBudget = {
  category: string;
  monthlyPaise: number;
};

export type UserMoneyRule = {
  id: string;
  match: string;
  field: 'merchant' | 'description' | 'any';
  category?: string;
  merchant?: string;
  paymentMethod?: string;
  createdAt?: string;
};

export type CapturePreview = {
  id?: string;
  source: 'manual' | 'sms' | 'share' | 'receipt' | 'email';
  direction: CaptureDirection;
  amountPaise: number;
  description: string;
  merchant?: string;
  category?: string;
  paymentMethod?: string;
  date?: string;
  upiRef?: string;
  vpa?: string;
  notes?: string;
  receiptPath?: string;
  receiptName?: string;
  processingStatus: ProcessingStatus;
  financialStatus: FinancialStatus;
  confidence: 'high' | 'medium' | 'low';
  reasons: string[];
  raw?: string;
};

export function toPaise(amount: unknown): number {
  const n = Number(amount);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

export function fromPaise(paise: number): number {
  return Math.round(Number(paise || 0)) / 100;
}

export function formatPaise(paise: number, symbol = '₹'): string {
  const n = fromPaise(paise);
  const abs = Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  return n < 0 ? `−${symbol}${abs}` : `${symbol}${abs}`;
}

export function addPaise(a: number, b: number) {
  return Math.round(a) + Math.round(b);
}

export function subPaise(a: number, b: number) {
  return Math.round(a) - Math.round(b);
}

export function entryTypeToTx(entryType?: string): TxType {
  const t = String(entryType || 'out').toLowerCase();
  if (t === 'in') return 'INCOME';
  if (t === 'transfer') return 'TRANSFER';
  return 'EXPENSE';
}

export function txToEntryType(tx: TxType): 'in' | 'out' | 'transfer' {
  if (tx === 'INCOME' || tx === 'REFUND' || tx === 'CASH_DEPOSIT') return 'in';
  if (tx === 'TRANSFER' || tx === 'CREDIT_CARD_PAYMENT' || tx === 'CASH_WITHDRAWAL') return 'transfer';
  return 'out';
}

/** UI options mapped onto stored entryType + txType */
export const MONEY_KIND_OPTIONS: Array<{
  entryType: 'in' | 'out' | 'transfer';
  txType: TxType;
  label: string;
  hint: string;
}> = [
  { entryType: 'out', txType: 'EXPENSE', label: 'Expense', hint: 'Money out' },
  { entryType: 'in', txType: 'INCOME', label: 'Income', hint: 'Money in' },
  { entryType: 'transfer', txType: 'TRANSFER', label: 'Transfer', hint: 'Between accounts' },
  { entryType: 'in', txType: 'REFUND', label: 'Refund', hint: 'Money returned' },
  { entryType: 'out', txType: 'REVERSAL', label: 'Reversal', hint: 'Void / reverse' },
  { entryType: 'transfer', txType: 'CREDIT_CARD_PAYMENT', label: 'Card payment', hint: 'Pay credit card' },
  { entryType: 'transfer', txType: 'CASH_WITHDRAWAL', label: 'Cash out', hint: 'ATM / cash withdrawal' },
  { entryType: 'in', txType: 'CASH_DEPOSIT', label: 'Cash in', hint: 'Deposit cash' },
];

export function newMoneyId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function defaultAccounts(currency = 'INR'): MoneyAccount[] {
  return [
    { id: 'cash', name: 'Cash', kind: 'cash', currency, openingBalancePaise: 0 },
    { id: 'bank', name: 'Bank', kind: 'bank', currency, openingBalancePaise: 0 },
    { id: 'upi', name: 'UPI', kind: 'upi', currency, openingBalancePaise: 0 },
  ];
}

export function readAccounts(book: Record<string, unknown> | null | undefined): MoneyAccount[] {
  const rows = Array.isArray(book?.moneyAccounts) ? book.moneyAccounts as MoneyAccount[] : [];
  return rows.length ? rows : defaultAccounts(String(book?.currency || 'INR'));
}

export function readSavingsGoals(book: Record<string, unknown> | null | undefined): SavingsGoal[] {
  return Array.isArray(book?.savingsGoals) ? book.savingsGoals as SavingsGoal[] : [];
}

export function readSettlements(book: Record<string, unknown> | null | undefined): Settlement[] {
  return Array.isArray(book?.settlements) ? book.settlements as Settlement[] : [];
}

export function readCategoryBudgets(book: Record<string, unknown> | null | undefined): CategoryBudget[] {
  return Array.isArray(book?.categoryBudgets) ? book.categoryBudgets as CategoryBudget[] : [];
}

export function readUserRules(book: Record<string, unknown> | null | undefined, uid: string): UserMoneyRule[] {
  const map = book?.userMoneyRules;
  if (!map || typeof map !== 'object' || Array.isArray(map)) return [];
  const rows = (map as Record<string, unknown>)[uid];
  return Array.isArray(rows) ? rows as UserMoneyRule[] : [];
}

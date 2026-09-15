/** Money receipt processing state machine + split/settlement architecture types. */

export const RECEIPT_FLOW_STATES = [
  'RECEIVED',
  'VALIDATING',
  'BOOK_SELECTED',
  'EXTRACTING',
  'CLASSIFYING',
  'DUPLICATE_CHECK',
  'READY',
  'CREATED',
  'COMPLETED',
  'FAILED',
  'RETRYING',
  'AWAITING_CONTEXT',
  'REVIEW_REQUIRED',
] as const;

export type ReceiptFlowState = (typeof RECEIPT_FLOW_STATES)[number];

export const RECEIPT_FLOW_COPY: Record<ReceiptFlowState, { title: string; detail: string }> = {
  RECEIVED: { title: 'Receipt received', detail: 'Let’s make sense of it.' },
  VALIDATING: { title: 'Checking the file', detail: 'Making sure this is a usable receipt.' },
  BOOK_SELECTED: { title: 'Money book ready', detail: 'Choosing where this belongs.' },
  EXTRACTING: { title: 'Reading your receipt', detail: 'Looking for merchant, amount and date…' },
  CLASSIFYING: { title: 'Understanding the expense', detail: 'Finding the best category…' },
  DUPLICATE_CHECK: { title: 'Checking for duplicates', detail: 'Making sure you don’t get charged twice.' },
  READY: { title: 'Ready to save', detail: 'Everything looks clear.' },
  CREATED: { title: 'Expense created', detail: 'Updating your Money data…' },
  COMPLETED: { title: 'All set', detail: 'Your Money book is up to date.' },
  FAILED: { title: 'Couldn’t finish', detail: 'Your receipt is safe. Nothing was added twice.' },
  RETRYING: { title: 'Trying again', detail: 'One more pass on this receipt.' },
  AWAITING_CONTEXT: { title: 'Choose a Money book', detail: 'Pick where this expense should live.' },
  REVIEW_REQUIRED: { title: 'Quick check needed', detail: 'Only the unclear fields — then you’re done.' },
};

export const SPLIT_METHODS = ['equal', 'exact', 'percentage', 'shares', 'custom'] as const;
export type SplitMethod = (typeof SPLIT_METHODS)[number];

export type SplitParticipant = {
  uid?: string;
  name: string;
  email?: string;
  mobile?: string;
  countryCode?: string;
  preferredPaymentMethod?: string;
  paymentProviderId?: string;
  notify?: boolean;
  share?: number;
  amountPaise?: number;
  percent?: number;
  settlementStatus?: SettlementStatus;
};

export type MoneySplit = {
  id: string;
  expenseId: string;
  bookId: string;
  method: SplitMethod;
  totalPaise: number;
  currency?: string;
  participants: SplitParticipant[];
  allocations: Array<{ participantKey: string; amountPaise: number }>;
  createdAt?: string;
  updatedAt?: string;
};

export const SETTLEMENT_STATUS = [
  'UNPAID',
  'PAYMENT_STARTED',
  'AWAITING_CONFIRMATION',
  'PAID',
  'FAILED',
  'CANCELLED',
  'EXPIRED',
  'REVIEW_REQUIRED',
  'UNKNOWN',
  // legacy aliases kept for older client rows
  'PENDING',
  'REQUESTED',
  'NOTIFIED',
  'PARTIALLY_PAID',
  'DISPUTED',
] as const;
export type SettlementStatus = (typeof SETTLEMENT_STATUS)[number];

export type MoneySettlement = {
  id: string;
  bookId: string;
  expenseId?: string;
  splitId?: string;
  fromUid: string;
  toUid: string;
  amountPaise: number;
  paidPaise?: number;
  status: SettlementStatus;
  date: string;
  note?: string;
  paymentProvider?: string;
  paymentMethod?: string;
  paymentRequestId?: string;
};

export type ActivityEvent = {
  id: string;
  at: string;
  kind: string;
  title: string;
  detail?: string;
};

export type MoneyContextOption = {
  id: string;
  name: string;
  currency?: string;
  score: number;
  reason: string;
  memberCount?: number;
};

export type RolePermissionMap = Record<string, Partial<Record<string, boolean>>>;

export const ROLE_FEATURE_DEFAULTS: RolePermissionMap = {
  DEFAULT_USER: {
    money: true,
    money_add: true,
    money_people: true,
    business: false,
    sales: false,
    buying: false,
    bank: false,
    accounts: false,
    operations: false,
    tax: false,
    reports: false,
    company_settings: false,
  },
  contributor: {
    money: true,
    money_add: true,
    money_people: false,
    business: false,
    reports: false,
    company_settings: false,
  },
  viewer: {
    money: true,
    money_add: false,
    money_people: false,
    business: false,
    reports: false,
  },
  admin: {
    money: true,
    money_add: true,
    money_people: true,
    business: false,
    reports: false,
  },
};

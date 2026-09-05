export type Category =
  | 'Food & Dining'
  | 'Groceries'
  | 'Rent & Housing'
  | 'Utilities'
  | 'Transportation'
  | 'Shopping'
  | 'Travel'
  | 'Entertainment'
  | 'Healthcare'
  | 'Work & Office'
  | 'Miscellaneous';

export type PaymentMode =
  | 'Cash'
  | 'Credit Card'
  | 'Debit Card'
  | 'UPI / GPay'
  | 'Apple Pay'
  | 'Net Banking'
  | 'Bank Transfer'
  | 'Other';

export interface Expense {
  id: string;
  rowNumber: number;
  date: string; // YYYY-MM-DD
  spenderName: string;
  spenderEmail: string;
  amount: number;
  currency: string;
  description: string; // "for what money spent" - optional
  category: Category | string; // optional
  paymentMode: PaymentMode | string; // optional
  receiptImage?: string; // base64 or URL proof of image
  notes?: string;
  createdAt: string;
  updatedAt: string;
  lastEditedBy: string;
}

export interface ConfiguredEmail {
  id: string;
  name: string;
  email: string;
  role: 'Admin' | 'Member' | 'Auditor';
  notifyOnAddEdit: boolean;
  notifyMonthlyDigest: boolean;
  notifyDailyBudget: boolean;
  active: boolean;
  addedAt: string;
}

export type NotificationType =
  | 'ADD_ALERT'
  | 'EDIT_ALERT'
  | 'DELETE_ALERT'
  | 'MONTHLY_DIGEST'
  | 'DAILY_BUDGET_REMINDER';

export interface SentNotification {
  id: string;
  type: NotificationType;
  recipients: string[];
  subject: string;
  htmlBody: string;
  summaryText: string;
  timestamp: string;
  triggeredBy: string;
  expenseId?: string;
  status: 'delivered' | 'simulated';
  deliveryNotes?: string;
}

export interface DailyBudgetSettings {
  dailyLimit: number;
  monthlyLimit: number;
  currency: string;
  reminderTime: string; // e.g. "20:00"
  enabled: boolean;
  pushNotificationsEnabled: boolean;
  alertThresholdPercent: number; // e.g. 80%
}

export interface ConfirmationModalState {
  isOpen: boolean;
  actionType: 'ADD' | 'EDIT' | 'DELETE';
  title: string;
  description: string;
  details?: {
    field?: string;
    oldValue?: any;
    newValue?: any;
    expense?: Partial<Expense>;
    summary?: string;
  };
  onConfirm: () => void;
  onCancel: () => void;
}

// --- ERP & BOOKKEEPING TYPES ---
export type AccountType = 'Asset' | 'Liability' | 'Equity' | 'Revenue' | 'Expense';

export interface Account {
  id: string;
  code: string;
  name: string;
  type: AccountType;
  subType?: string;
  balance: number; // For UI display purposes
  description?: string;
  isSystem?: boolean;
}

export interface JournalLine {
  id: string;
  accountId: string;
  description?: string;
  debit: number;
  credit: number;
}

export interface JournalEntry {
  id: string;
  date: string;
  reference: string;
  description: string;
  lines: JournalLine[];
  status: 'Draft' | 'Posted' | 'Voided';
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  date: string;
  dueDate: string;
  clientId: string;
  clientName: string;
  items: { description: string; quantity: number; unitPrice: number; amount: number }[];
  subtotal: number;
  tax: number;
  total: number;
  amountPaid: number;
  status: 'Draft' | 'Sent' | 'Paid' | 'Overdue' | 'Voided';
  journalEntryId?: string; // Link to the posted journal entry
}

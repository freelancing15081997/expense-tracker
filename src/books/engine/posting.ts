import { lineAmount } from '../core/money';
import type { DocumentKind, DocumentLineInput, FinanceAccount, JournalLineInput, SystemAccountKey, TaxBreakdown } from '../core/types';
import { BooksError, invertLines } from './journal';

function groupExclusive(lines: DocumentLineInput[]): Map<string, number> {
  const grouped = new Map<string, number>();
  for (const line of lines) {
    grouped.set(line.accountId, (grouped.get(line.accountId) || 0) + lineAmount(line.qtyMilli, line.unitPriceMinor));
  }
  return grouped;
}

function requireSystem(accounts: FinanceAccount[], key: SystemAccountKey): FinanceAccount {
  const found = accounts.find((a) => a.systemKey === key && a.active);
  if (!found) throw new BooksError(`System account "${key}" is missing`);
  return found;
}

export function invoiceJournalLines(
  accounts: FinanceAccount[],
  tax: TaxBreakdown,
  docLines: DocumentLineInput[]
): JournalLineInput[] {
  const ar = requireSystem(accounts, 'ar');
  const taxOut = requireSystem(accounts, 'tax_output');
  const lines: JournalLineInput[] = [
    { accountId: ar.id, debitMinor: tax.exclusiveMinor + tax.taxMinor, creditMinor: 0, memo: 'Accounts receivable' },
    ...[...groupExclusive(docLines)].map(([accountId, amount]) => ({
      accountId,
      debitMinor: 0,
      creditMinor: amount,
      memo: 'Sales',
    })),
  ];
  if (tax.taxMinor > 0) {
    lines.push({ accountId: taxOut.id, debitMinor: 0, creditMinor: tax.taxMinor, memo: 'GST output' });
  }
  return lines;
}

export function billJournalLines(
  accounts: FinanceAccount[],
  tax: TaxBreakdown,
  docLines: DocumentLineInput[]
): JournalLineInput[] {
  const ap = requireSystem(accounts, 'ap');
  const taxIn = requireSystem(accounts, 'tax_input');
  const lines: JournalLineInput[] = [
    ...[...groupExclusive(docLines)].map(([accountId, amount]) => ({
      accountId,
      debitMinor: amount,
      creditMinor: 0,
      memo: 'Purchase / expense',
    })),
  ];
  if (tax.taxMinor > 0) {
    lines.push({ accountId: taxIn.id, debitMinor: tax.taxMinor, creditMinor: 0, memo: 'GST input' });
  }
  lines.push({ accountId: ap.id, debitMinor: 0, creditMinor: tax.exclusiveMinor + tax.taxMinor, memo: 'Accounts payable' });
  return lines;
}

export function expenseJournalLines(
  accounts: FinanceAccount[],
  tax: TaxBreakdown,
  docLines: DocumentLineInput[],
  payFromAccountId: string
): JournalLineInput[] {
  const lines: JournalLineInput[] = [
    ...[...groupExclusive(docLines)].map(([accountId, amount]) => ({
      accountId,
      debitMinor: amount,
      creditMinor: 0,
      memo: 'Books expense',
    })),
  ];
  if (tax.taxMinor > 0) {
    const taxIn = requireSystem(accounts, 'tax_input');
    lines.push({ accountId: taxIn.id, debitMinor: tax.taxMinor, creditMinor: 0, memo: 'GST input' });
  }
  lines.push({ accountId: payFromAccountId, debitMinor: 0, creditMinor: tax.exclusiveMinor + tax.taxMinor, memo: 'Payment' });
  return lines;
}

export function paymentJournalLines(
  kind: DocumentKind,
  accounts: FinanceAccount[],
  amountMinor: number,
  cashAccountId: string
): JournalLineInput[] {
  if (amountMinor <= 0) throw new BooksError('Payment must be greater than zero');
  if (kind === 'invoice') {
    const ar = requireSystem(accounts, 'ar');
    return [
      { accountId: cashAccountId, debitMinor: amountMinor, creditMinor: 0, memo: 'Customer receipt' },
      { accountId: ar.id, debitMinor: 0, creditMinor: amountMinor, memo: 'Clear receivable' },
    ];
  }
  if (kind === 'bill') {
    const ap = requireSystem(accounts, 'ap');
    return [
      { accountId: ap.id, debitMinor: amountMinor, creditMinor: 0, memo: 'Clear payable' },
      { accountId: cashAccountId, debitMinor: 0, creditMinor: amountMinor, memo: 'Vendor payment' },
    ];
  }
  throw new BooksError('This document is already paid at posting');
}

export function documentJournalType(kind: DocumentKind) {
  if (kind === 'invoice' || kind === 'credit_note') return 'invoice';
  if (kind === 'bill' || kind === 'vendor_credit') return 'bill';
  return 'expense';
}

export function documentToJournalLines(
  kind: DocumentKind,
  accounts: FinanceAccount[],
  tax: TaxBreakdown,
  docLines: DocumentLineInput[],
  payFromAccountId?: string
): JournalLineInput[] {
  if (kind === 'quote' || kind === 'purchase_order') {
    throw new BooksError('Convert this document before posting');
  }
  if (kind === 'invoice') return invoiceJournalLines(accounts, tax, docLines);
  if (kind === 'bill') return billJournalLines(accounts, tax, docLines);
  if (kind === 'credit_note') return invertLines(invoiceJournalLines(accounts, tax, docLines));
  if (kind === 'vendor_credit') return invertLines(billJournalLines(accounts, tax, docLines));
  if (!payFromAccountId) throw new BooksError('Select the account this was paid from');
  return expenseJournalLines(accounts, tax, docLines, payFromAccountId);
}

export function docNumberPrefix(kind: DocumentKind) {
  const map: Record<DocumentKind, string> = {
    invoice: 'INV',
    bill: 'BILL',
    expense: 'EXP',
    quote: 'QUO',
    credit_note: 'CN',
    purchase_order: 'PO',
    vendor_credit: 'VC',
  };
  return map[kind];
}

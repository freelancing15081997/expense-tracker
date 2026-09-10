import { addDays, lineAmount } from '../core/money';
import type { DocumentKind, DocumentLineInput, FinanceAccount, FinanceDocument, JournalLineInput, SystemAccountKey, TaxBreakdown, TaxCode } from '../core/types';
import { BooksError, invertLines } from './journal';
import { computeDocument } from './tax';

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

export const DOCUMENT_CONVERT: Partial<Record<DocumentKind, DocumentKind>> = {
  estimate: 'invoice',
  quote: 'invoice',
  sales_order: 'invoice',
  purchase_request: 'purchase_order',
  purchase_order: 'bill',
  purchase_receipt: 'bill',
};

export function assertCanConvert(from: DocumentKind, to: DocumentKind) {
  if (DOCUMENT_CONVERT[from] !== to) {
    throw new BooksError(`A ${from.replace(/_/g, ' ')} cannot convert to a ${to.replace(/_/g, ' ')}`);
  }
}

const UNTAXED_SOURCE: DocumentKind[] = ['purchase_request', 'purchase_receipt'];

export function prepareConvertedTotals(
  source: Pick<FinanceDocument, 'kind' | 'date' | 'dueDate' | 'lines' | 'tax' | 'totalMinor' | 'interstate' | 'partyId'>,
  nextKind: DocumentKind,
  taxCodes: TaxCode[],
) {
  assertCanConvert(source.kind, nextKind);
  if ((nextKind === 'invoice' || nextKind === 'bill') && !source.partyId) {
    throw new BooksError(nextKind === 'invoice' ? 'Add a customer before converting' : 'Add a vendor before converting');
  }
  const dueDate = nextKind === 'invoice' || nextKind === 'bill' ? addDays(source.date, 30) : source.dueDate;
  let lines = source.lines;
  let tax = source.tax;
  let totalMinor = source.totalMinor;
  const destIsTaxed = nextKind === 'invoice' || nextKind === 'bill';
  if (UNTAXED_SOURCE.includes(source.kind) && destIsTaxed) {
    const gst = taxCodes.find((t) => t.active !== false && t.id === 'GST18') || taxCodes.find((t) => t.active !== false && t.rateBps === 1800);
    if (gst) {
      const byId = new Map(taxCodes.map((t) => [t.id, t]));
      lines = source.lines.map((line) => {
        const code = byId.get(line.taxCode);
        if (!code || code.rateBps === 0) return { ...line, taxCode: gst.id };
        return line;
      });
      const computed = computeDocument(lines, byId, source.interstate);
      lines = computed.lines;
      tax = computed.tax;
      totalMinor = computed.totalMinor;
    }
  }
  return { lines, tax, totalMinor, dueDate };
}

export function creditTargetKind(kind: DocumentKind): DocumentKind | null {
  if (kind === 'credit_note') return 'invoice';
  if (kind === 'vendor_credit') return 'bill';
  return null;
}

export function applyCreditAmount(
  credit: Pick<FinanceDocument, 'kind' | 'partyId' | 'status' | 'totalMinor' | 'paidMinor'>,
  target: Pick<FinanceDocument, 'kind' | 'partyId' | 'status' | 'totalMinor' | 'paidMinor'>,
  requestedMinor?: number,
) {
  const expected = creditTargetKind(credit.kind);
  if (!expected) throw new BooksError('Only credit notes and vendor credits can be applied');
  if (target.kind !== expected) {
    throw new BooksError(expected === 'invoice' ? 'Apply this credit note to an invoice' : 'Apply this vendor credit to a bill');
  }
  if (!credit.partyId || credit.partyId !== target.partyId) {
    throw new BooksError('Credit and target must be for the same customer or vendor');
  }
  if (credit.status !== 'posted' && credit.status !== 'paid') throw new BooksError('Post the credit before applying it');
  if (target.status !== 'posted' && target.status !== 'paid') throw new BooksError('Post the target document first');
  const unused = credit.totalMinor - credit.paidMinor;
  const outstanding = target.totalMinor - target.paidMinor;
  if (unused <= 0) throw new BooksError('This credit is fully applied');
  if (outstanding <= 0) throw new BooksError('This document has no outstanding balance');
  const amount = requestedMinor ?? Math.min(unused, outstanding);
  if (amount <= 0 || amount > unused || amount > outstanding) {
    throw new BooksError('Apply amount must be within the unused credit and outstanding balance');
  }
  return amount;
}

export function partyReceivableExposure(documents: Pick<FinanceDocument, 'kind' | 'partyId' | 'status' | 'totalMinor' | 'paidMinor'>[], partyId: string) {
  let exposure = 0;
  for (const doc of documents) {
    if (doc.partyId !== partyId) continue;
    if (doc.status !== 'posted' && doc.status !== 'paid') continue;
    const open = doc.totalMinor - doc.paidMinor;
    if (doc.kind === 'invoice' || doc.kind === 'debit_note') exposure += open;
    else if (doc.kind === 'credit_note') exposure -= open;
  }
  return exposure;
}

export function paymentJournalLines(
  kind: DocumentKind,
  accounts: FinanceAccount[],
  amountMinor: number,
  cashAccountId: string
): JournalLineInput[] {
  if (amountMinor <= 0) throw new BooksError('Payment must be greater than zero');
  if (kind === 'invoice' || kind === 'debit_note') {
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
  if (kind === 'invoice' || kind === 'credit_note' || kind === 'debit_note') return 'invoice';
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
  if (kind === 'quote' || kind === 'estimate' || kind === 'sales_order' || kind === 'purchase_request' || kind === 'purchase_order' || kind === 'purchase_receipt') {
    throw new BooksError('Convert this document before posting');
  }
  if (kind === 'invoice' || kind === 'debit_note') return invoiceJournalLines(accounts, tax, docLines);
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
    estimate: 'EST',
    sales_order: 'SO',
    credit_note: 'CN',
    debit_note: 'DN',
    purchase_request: 'PR',
    purchase_order: 'PO',
    purchase_receipt: 'GRN',
    vendor_credit: 'VC',
  };
  return map[kind];
}

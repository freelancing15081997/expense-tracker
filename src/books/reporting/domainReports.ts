import { signedBalance } from '../engine/chartOfAccounts';
import { formatMoney, todayISO } from '../core/money';
import type { FinanceAccount, FinanceDocument, FinanceJournal, Product } from '../core/types';

export type ReportRow = { cells: string[] };
export type DomainReport = { title: string; headers: string[]; rows: ReportRow[]; footnote?: string };

type BooksSlice = {
  currency: string;
  accounts: FinanceAccount[];
  documents: FinanceDocument[];
  journals: FinanceJournal[];
  products: Product[];
  parties: { id: string; name: string; kind?: string }[];
};

function money(minor: number, currency: string) {
  return formatMoney(minor, currency);
}

function partyName(parties: BooksSlice['parties'], id: string | null) {
  return parties.find((p) => p.id === id)?.name || '—';
}

export function reportsForDomain(domain: string, books: BooksSlice): DomainReport[] {
  const posted = books.documents.filter((d) => d.status === 'posted' || d.status === 'paid');
  const today = todayISO();

  if (domain === 'invoices' || domain === 'collections' || domain === 'statements') {
    const rows = posted.filter((d) => d.kind === 'invoice').map((d) => ({
      cells: [d.number, d.date, partyName(books.parties, d.partyId), money(d.totalMinor, books.currency), money(d.totalMinor - d.paidMinor, books.currency), d.dueDate && d.dueDate < today && d.paidMinor < d.totalMinor ? 'Overdue' : d.status],
    }));
    return [{ title: 'Invoice register', headers: ['Number', 'Date', 'Customer', 'Total', 'Due', 'Status'], rows, footnote: 'Posted invoices only.' }];
  }
  if (domain === 'bills' || domain === 'payment-run') {
    const rows = posted.filter((d) => d.kind === 'bill').map((d) => ({
      cells: [d.number, d.date, partyName(books.parties, d.partyId), money(d.totalMinor, books.currency), money(d.totalMinor - d.paidMinor, books.currency), d.status],
    }));
    return [{ title: 'Bill register', headers: ['Number', 'Date', 'Vendor', 'Total', 'Due', 'Status'], rows }];
  }
  if (domain === 'quotes' || domain === 'credit-notes' || domain === 'purchase-orders' || domain === 'vendor-credits' || domain === 'expenses') {
    const kind = domain === 'quotes' ? 'quote' : domain === 'credit-notes' ? 'credit_note' : domain === 'purchase-orders' ? 'purchase_order' : domain === 'vendor-credits' ? 'vendor_credit' : 'expense';
    const rows = books.documents.filter((d) => d.kind === kind && d.status !== 'voided').map((d) => ({
      cells: [d.number, d.date, partyName(books.parties, d.partyId), money(d.totalMinor, books.currency), d.status],
    }));
    return [{ title: 'Document register', headers: ['Number', 'Date', 'Party', 'Total', 'Status'], rows }];
  }
  if (domain === 'journals' || domain === 'ledger' || domain === 'chart-of-accounts' || domain === 'reports' || domain === 'dashboard') {
    return [{
      title: 'Trial balance',
      headers: ['Code', 'Account', 'Debit', 'Credit'],
      rows: books.accounts.filter((a) => a.allowPosting || a.debitTotalMinor || a.creditTotalMinor).map((a) => ({
        cells: [a.code, a.name, money(a.debitTotalMinor, books.currency), money(a.creditTotalMinor, books.currency)],
      })),
      footnote: 'Posted account totals.',
    }];
  }
  if (domain === 'banking') {
    return [{
      title: 'Cash and bank',
      headers: ['Account', 'Balance'],
      rows: books.accounts.filter((a) => a.systemKey === 'cash' || a.systemKey === 'bank').map((a) => ({
        cells: [`${a.code} ${a.name}`, money(signedBalance(a), books.currency)],
      })),
    }];
  }
  if (domain === 'inventory') {
    return [{
      title: 'Stock valuation',
      headers: ['SKU', 'Name', 'Qty', 'Cost', 'Value'],
      rows: books.products.filter((p) => p.kind === 'goods').map((p) => ({
        cells: [p.sku, p.name, (p.qtyMilli / 1000).toFixed(3), money(p.costMinor, books.currency), money(Math.round((p.qtyMilli * p.costMinor) / 1000), books.currency)],
      })),
      footnote: 'Value = qty milli × cost paise / 1000.',
    }];
  }
  if (domain === 'tax') {
    return [{
      title: 'GST on posted documents',
      headers: ['Number', 'Kind', 'Taxable', 'Tax'],
      rows: posted.map((d) => ({
        cells: [d.number, d.kind, money(d.tax.exclusiveMinor, books.currency), money(d.tax.taxMinor, books.currency)],
      })),
    }];
  }
  if (domain === 'customers' || domain === 'vendors') {
    const kind = domain === 'customers' ? 'customer' : 'vendor';
    const docKind = domain === 'customers' ? 'invoice' : 'bill';
    return [{
      title: `${kind === 'customer' ? 'Customer' : 'Vendor'} outstanding`,
      headers: ['Number', 'Party', 'Outstanding'],
      rows: posted.filter((d) => d.kind === docKind && d.paidMinor < d.totalMinor).map((d) => ({
        cells: [d.number, partyName(books.parties, d.partyId), money(d.totalMinor - d.paidMinor, books.currency)],
      })),
    }];
  }
  return [{
    title: 'Posted journals',
    headers: ['Number', 'Date', 'Description', 'Debit'],
    rows: books.journals.filter((j) => j.status === 'posted').slice(0, 50).map((j) => ({
      cells: [j.number, j.date, j.description, money(j.debitTotalMinor, books.currency)],
    })),
    footnote: 'Latest 50 posted journals.',
  }];
}

export function toCsv(report: DomainReport) {
  const lines = [report.headers.join(','), ...report.rows.map((r) => r.cells.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))];
  return lines.join('\n');
}

export function downloadText(filename: string, text: string, type = 'text/csv') {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

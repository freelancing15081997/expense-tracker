import type { AccountType, BankTxn, FinanceAccount, FinanceDocument, FinanceJournal } from '../core/types';
import { signedBalance } from '../engine/chartOfAccounts';

export function monthRange(iso: string): { start: string; end: string } {
  const [y, m] = iso.split('-');
  const last = new Date(Date.UTC(Number(y), Number(m), 0)).getUTCDate();
  return { start: `${y}-${m}-01`, end: `${y}-${m}-${String(last).padStart(2, '0')}` };
}

export function inRange(date: string, start: string, end: string) {
  return date >= start && date <= end;
}

export function activityByAccount(
  journals: FinanceJournal[],
  from: string,
  to: string,
) {
  const map = new Map<string, { debit: number; credit: number }>();
  for (const journal of journals) {
    if (journal.status !== 'posted') continue;
    if (!inRange(journal.date, from, to)) continue;
    for (const line of journal.lines || []) {
      const row = map.get(line.accountId) || { debit: 0, credit: 0 };
      row.debit += line.debitMinor || 0;
      row.credit += line.creditMinor || 0;
      map.set(line.accountId, row);
    }
  }
  return map;
}

export function withActivity(
  accounts: FinanceAccount[],
  activity: Map<string, { debit: number; credit: number }>,
) {
  return accounts.map((account) => {
    const row = activity.get(account.id);
    const debitTotalMinor = row?.debit || 0;
    const creditTotalMinor = row?.credit || 0;
    return { ...account, debitTotalMinor, creditTotalMinor };
  });
}

export function reconWorksheet(
  bookBalanceMinor: number,
  statementBalanceMinor: number,
  txns: BankTxn[],
) {
  const outstanding = txns.filter((t) => !t.reconciled);
  const deposits = outstanding.filter((t) => t.amountMinor > 0).reduce((s, t) => s + t.amountMinor, 0);
  const withdrawals = outstanding.filter((t) => t.amountMinor < 0).reduce((s, t) => s + t.amountMinor, 0);
  const outstandingSigned = deposits + withdrawals;
  const clearedBook = bookBalanceMinor - outstandingSigned;
  const difference = statementBalanceMinor - clearedBook;
  return { outstanding, deposits, withdrawals, outstandingSigned, clearedBook, difference };
}

const CASH_KEYS = new Set(['cash', 'bank']);
const OPERATING_LIAB = new Set(['ap', 'tax_output', 'deferred_revenue', 'tds_payable']);
const OPERATING_ASSET = new Set(['ar', 'tax_input', 'inventory']);

function classifyCashMove(contra: FinanceAccount | undefined): 'operating' | 'investing' | 'financing' {
  if (!contra) return 'operating';
  if (contra.systemKey && CASH_KEYS.has(contra.systemKey)) return 'operating';
  if (contra.type === 'equity') return 'financing';
  if (contra.type === 'liability' && !OPERATING_LIAB.has(contra.systemKey || '')) return 'financing';
  if (contra.type === 'asset' && !OPERATING_ASSET.has(contra.systemKey || '') && !CASH_KEYS.has(contra.systemKey || '')) return 'investing';
  return 'operating';
}

export function directCashFlow(
  journals: FinanceJournal[],
  accounts: FinanceAccount[],
  from: string,
  to: string,
) {
  const byId = new Map(accounts.map((a) => [a.id, a]));
  const cashIds = new Set(accounts.filter((a) => a.systemKey === 'cash' || a.systemKey === 'bank').map((a) => a.id));
  const totals = {
    operatingIn: 0,
    operatingOut: 0,
    investingIn: 0,
    investingOut: 0,
    financingIn: 0,
    financingOut: 0,
  };
  const rows: { date: string; number: string; memo: string; bucket: string; amount: number; href: string }[] = [];

  for (const journal of journals) {
    if (journal.status !== 'posted') continue;
    if (!inRange(journal.date, from, to)) continue;
    const cashLines = (journal.lines || []).filter((l) => cashIds.has(l.accountId));
    if (!cashLines.length) continue;
    const other = (journal.lines || []).filter((l) => !cashIds.has(l.accountId));
    const bothCash = cashLines.length >= 2 && other.length === 0;
    if (bothCash) continue;
    const contra = byId.get(other[0]?.accountId || '');
    const bucket = classifyCashMove(contra);
    const net = cashLines.reduce((s, l) => s + (l.debitMinor || 0) - (l.creditMinor || 0), 0);
    if (!net) continue;
    if (net > 0) {
      if (bucket === 'operating') totals.operatingIn += net;
      else if (bucket === 'investing') totals.investingIn += net;
      else totals.financingIn += net;
    } else {
      const out = -net;
      if (bucket === 'operating') totals.operatingOut += out;
      else if (bucket === 'investing') totals.investingOut += out;
      else totals.financingOut += out;
    }
    rows.push({
      date: journal.date,
      number: journal.number,
      memo: journal.description,
      bucket,
      amount: net,
      href: `/books/journals?open=${journal.id}`,
    });
  }

  const operating = totals.operatingIn - totals.operatingOut;
  const investing = totals.investingIn - totals.investingOut;
  const financing = totals.financingIn - totals.financingOut;
  return { totals, operating, investing, financing, net: operating + investing + financing, rows };
}

const OUTPUT = new Set(['invoice', 'debit_note']);
const INPUT = new Set(['bill', 'expense']);
const OUTPUT_REDUCE = new Set(['credit_note']);
const INPUT_REDUCE = new Set(['vendor_credit']);

export function gstSummary(documents: FinanceDocument[], from: string, to: string) {
  const zero = { exclusiveMinor: 0, taxMinor: 0, cgstMinor: 0, sgstMinor: 0, igstMinor: 0 };
  const add = (into: typeof zero, tax: typeof zero, sign: 1 | -1) => {
    into.exclusiveMinor += sign * (tax.exclusiveMinor || 0);
    into.taxMinor += sign * (tax.taxMinor || 0);
    into.cgstMinor += sign * (tax.cgstMinor || 0);
    into.sgstMinor += sign * (tax.sgstMinor || 0);
    into.igstMinor += sign * (tax.igstMinor || 0);
  };
  const output = { ...zero };
  const input = { ...zero };
  const rows: FinanceDocument[] = [];
  for (const doc of documents) {
    if (doc.status !== 'posted' && doc.status !== 'paid') continue;
    if (!inRange(doc.date, from, to)) continue;
    rows.push(doc);
    if (OUTPUT.has(doc.kind)) add(output, doc.tax, 1);
    else if (OUTPUT_REDUCE.has(doc.kind)) add(output, doc.tax, -1);
    else if (INPUT.has(doc.kind)) add(input, doc.tax, 1);
    else if (INPUT_REDUCE.has(doc.kind)) add(input, doc.tax, -1);
  }
  return {
    output,
    input,
    net: {
      exclusiveMinor: output.exclusiveMinor - input.exclusiveMinor,
      taxMinor: output.taxMinor - input.taxMinor,
      cgstMinor: output.cgstMinor - input.cgstMinor,
      sgstMinor: output.sgstMinor - input.sgstMinor,
      igstMinor: output.igstMinor - input.igstMinor,
    },
    rows,
  };
}

export function ageOpenDocuments(
  documents: FinanceDocument[],
  parties: { id: string; name: string }[],
  today: string,
) {
  return documents
    .filter((d) => (d.kind === 'invoice' || d.kind === 'bill' || d.kind === 'debit_note') && (d.status === 'posted' || d.status === 'paid') && d.paidMinor < d.totalMinor)
    .map((d) => {
      const due = d.dueDate || d.date;
      const days = Math.max(0, Math.floor((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${due}T00:00:00Z`)) / 86400000));
      const bucket = days <= 0 ? 'Current' : days <= 30 ? '1-30' : days <= 60 ? '31-60' : '61+';
      return {
        ...d,
        days,
        bucket,
        outstanding: d.totalMinor - d.paidMinor,
        party: parties.find((p) => p.id === d.partyId)?.name || '—',
        side: d.kind === 'bill' ? 'ap' : 'ar',
      };
    });
}

export function downloadCsv(filename: string, rows: Array<Array<string | number>>) {
  const body = rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([body], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function signedFromTotals(account: { debitTotalMinor: number; creditTotalMinor: number; normalBalance: 'debit' | 'credit'; type?: AccountType }) {
  return signedBalance(account);
}

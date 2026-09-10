import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useBooks } from '../../context/BooksProvider';
import { signedBalance } from '../../engine/chartOfAccounts';
import { Card, Field, inputClass, Money, PageShell } from '../../ui';
import type { AccountType } from '../../core/types';
import { todayISO } from '../../core/money';
import { documentHref } from '../../../lib/search-index';
import {
  activityByAccount,
  ageOpenDocuments,
  directCashFlow,
  downloadCsv,
  gstSummary,
  monthRange,
  withActivity,
} from '../../reporting/statements';

type Report = 'tb' | 'pl' | 'bs' | 'cf' | 'gst' | 'aging';

export default function Reports() {
  const { accounts, documents, parties, currency, journals } = useBooks();
  const [report, setReport] = useState<Report>('pl');
  const range0 = monthRange(todayISO());
  const [start, setStart] = useState(range0.start);
  const [end, setEnd] = useState(todayISO());

  const periodActivity = useMemo(() => activityByAccount(journals, start, end), [journals, start, end]);
  const asOfActivity = useMemo(() => activityByAccount(journals, '0000-01-01', end), [journals, end]);
  const periodAccounts = useMemo(() => withActivity(accounts, periodActivity), [accounts, periodActivity]);
  const asOfAccounts = useMemo(() => withActivity(accounts, asOfActivity), [accounts, asOfActivity]);

  const groupedPeriod = useMemo(() => groupAccounts(periodAccounts), [periodAccounts]);
  const groupedAsOf = useMemo(() => groupAccounts(asOfAccounts), [asOfAccounts]);

  const income = sumTypes(periodAccounts, ['revenue', 'other_income']);
  const expense = sumTypes(periodAccounts, ['expense', 'cogs', 'other_expense']);
  const assets = sumTypes(asOfAccounts, ['asset']);
  const liabilities = sumTypes(asOfAccounts, ['liability']);
  const equity = sumTypes(asOfAccounts, ['equity']) + (sumTypes(asOfAccounts, ['revenue', 'other_income']) - sumTypes(asOfAccounts, ['expense', 'cogs', 'other_expense']));

  const aging = useMemo(
    () => ageOpenDocuments(documents, parties, todayISO()),
    [documents, parties],
  );

  const gst = useMemo(() => gstSummary(documents, start, end), [documents, start, end]);
  const cash = useMemo(() => directCashFlow(journals, accounts, start, end), [journals, accounts, start, end]);
  const cashNow = accounts.filter((a) => a.systemKey === 'cash' || a.systemKey === 'bank').reduce((s, a) => s + signedBalance(a), 0);

  const exportCurrent = () => {
    if (report === 'tb') {
      downloadCsv('trial-balance.csv', [
        ['Account', 'Debit', 'Credit'],
        ...asOfAccounts.filter((a) => a.allowPosting || a.debitTotalMinor || a.creditTotalMinor).map((a) => [`${a.code} ${a.name}`, a.debitTotalMinor / 100, a.creditTotalMinor / 100]),
      ]);
      return;
    }
    if (report === 'pl') {
      downloadCsv('profit-loss.csv', [['Account', 'Amount'], ...listTypes(groupedPeriod, ['revenue', 'other_income', 'cogs', 'expense', 'other_expense']).map((r) => [r.name, r.amount / 100]), ['Net', (income - expense) / 100]]);
      return;
    }
    if (report === 'gst') {
      downloadCsv('gst.csv', [
        ['Document', 'Kind', 'Taxable', 'CGST', 'SGST', 'IGST'],
        ...gst.rows.map((d) => [d.number, d.kind, d.tax.exclusiveMinor / 100, d.tax.cgstMinor / 100, d.tax.sgstMinor / 100, d.tax.igstMinor / 100]),
        ['Net payable', '', '', gst.net.cgstMinor / 100, gst.net.sgstMinor / 100, gst.net.igstMinor / 100],
      ]);
      return;
    }
    if (report === 'cf') {
      downloadCsv('cash-flow.csv', [['Date', 'Journal', 'Bucket', 'Amount'], ...cash.rows.map((r) => [r.date, r.number, r.bucket, r.amount / 100])]);
      return;
    }
    if (report === 'bs') {
      downloadCsv('balance-sheet.csv', [
        ['Account', 'Amount'],
        ...listTypes(groupedAsOf, ['asset', 'liability', 'equity']).map((r) => [r.name, r.amount / 100]),
        ['Assets', assets / 100],
        ['Liabilities', liabilities / 100],
        ['Equity', equity / 100],
      ]);
      return;
    }
    if (report === 'aging') {
      downloadCsv('aging.csv', [
        ['Document', 'Kind', 'Party', 'Side', 'Due', 'Bucket', 'Outstanding'],
        ...aging.map((r) => [r.number, r.kind, r.party, r.side, r.dueDate || r.date, r.bucket, r.outstanding / 100]),
      ]);
    }
  };

  return (
    <PageShell
      title="Reports"
      subtitle="P&L and cash flow use the date range. Trial balance and balance sheet are as of the end date. Built from posted journals."
      actions={<button type="button" className="byjan-btn-ghost" onClick={exportCurrent}>Download CSV</button>}
    >
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Field label="From"><input type="date" className={inputClass} value={start} onChange={(e) => setStart(e.target.value)} /></Field>
        <Field label="To"><input type="date" className={inputClass} value={end} onChange={(e) => setEnd(e.target.value)} /></Field>
      </div>
      <div className="flex flex-wrap gap-2">
        {([
          ['pl', 'Profit & Loss'],
          ['bs', 'Balance Sheet'],
          ['tb', 'Trial Balance'],
          ['cf', 'Cash flow'],
          ['gst', 'GST'],
          ['aging', 'AR / AP Aging'],
        ] as const).map(([id, label]) => (
          <button key={id} type="button" onClick={() => setReport(id)} className={`h-9 px-3 rounded-lg text-sm font-semibold ${report === id ? 'bg-[#0B1F3A] text-white' : 'bg-white border border-slate-200 text-slate-700'}`}>{label}</button>
        ))}
      </div>
      {report === 'tb' && (
        <Card>
          <ReportTable currency={currency} rows={asOfAccounts.filter((a) => a.allowPosting || a.debitTotalMinor || a.creditTotalMinor).map((a) => ({
            label: `${a.code} ${a.name}`,
            href: `/books/ledger/${a.id}`,
            debit: a.debitTotalMinor,
            credit: a.creditTotalMinor,
          }))} totals />
        </Card>
      )}
      {report === 'pl' && (
        <Card className="p-4 space-y-4">
          <Section title="Income" rows={listTypes(groupedPeriod, ['revenue', 'other_income'])} currency={currency} />
          <Section title="Expenses" rows={listTypes(groupedPeriod, ['cogs', 'expense', 'other_expense'])} currency={currency} />
          <div className="flex justify-between font-semibold border-t border-slate-200 pt-3">
            <span>Net {income - expense >= 0 ? 'profit' : 'loss'}</span>
            <Money minor={income - expense} currency={currency} />
          </div>
        </Card>
      )}
      {report === 'bs' && (
        <Card className="p-4 space-y-4">
          <Section title="Assets" rows={listTypes(groupedAsOf, ['asset'])} currency={currency} />
          <Section title="Liabilities" rows={listTypes(groupedAsOf, ['liability'])} currency={currency} />
          <Section title="Equity (incl. result to end date)" rows={[...listTypes(groupedAsOf, ['equity']), { name: 'Current year result', amount: sumTypes(asOfAccounts, ['revenue', 'other_income']) - sumTypes(asOfAccounts, ['expense', 'cogs', 'other_expense']) }]} currency={currency} />
          <div className={`flex justify-between font-semibold border-t border-slate-200 pt-3 ${assets === liabilities + equity ? 'text-emerald-700' : 'text-rose-700'}`}>
            <span>Assets {assets === liabilities + equity ? '=' : '≠'} Liabilities + Equity</span>
            <span><Money minor={assets} currency={currency} /> / <Money minor={liabilities + equity} currency={currency} /></span>
          </div>
        </Card>
      )}
      {report === 'cf' && (
        <div className="space-y-3">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <Card className="p-4"><p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Cash now</p><p className="font-display text-xl mt-1"><Money minor={cashNow} currency={currency} /></p></Card>
            <Card className="p-4"><p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Operating</p><p className="font-display text-xl mt-1"><Money minor={cash.operating} currency={currency} /></p></Card>
            <Card className="p-4"><p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Investing</p><p className="font-display text-xl mt-1"><Money minor={cash.investing} currency={currency} /></p></Card>
            <Card className="p-4"><p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Financing</p><p className="font-display text-xl mt-1"><Money minor={cash.financing} currency={currency} /></p></Card>
          </div>
          <Card className="p-4 space-y-2 text-sm">
            <Row label="Operating receipts" amount={cash.totals.operatingIn} currency={currency} />
            <Row label="Operating payments" amount={-cash.totals.operatingOut} currency={currency} />
            <Row label="Investing receipts" amount={cash.totals.investingIn} currency={currency} />
            <Row label="Investing payments" amount={-cash.totals.investingOut} currency={currency} />
            <Row label="Financing receipts" amount={cash.totals.financingIn} currency={currency} />
            <Row label="Financing payments" amount={-cash.totals.financingOut} currency={currency} />
            <div className="flex justify-between font-semibold border-t border-slate-200 pt-2">
              <span>Net cash movement in range</span>
              <Money minor={cash.net} currency={currency} />
            </div>
            <p className="text-xs text-slate-500">Direct method from posted cash and bank journal lines. Internal bank transfers are excluded. This is not a bank-feed forecast.</p>
          </Card>
          <Card>
            {cash.rows.length === 0 ? <p className="p-4 text-sm text-slate-500">No cash movements in this range.</p> : (
              <table className="w-full text-sm">
                <thead className="text-left text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3 font-medium">Date</th>
                    <th className="px-4 py-3 font-medium">Journal</th>
                    <th className="px-4 py-3 font-medium">Bucket</th>
                    <th className="px-4 py-3 font-medium text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {cash.rows.slice(0, 80).map((row) => (
                    <tr key={`${row.number}-${row.date}-${row.amount}`} className="border-b border-slate-100">
                      <td className="px-4 py-2.5">{row.date}</td>
                      <td className="px-4 py-2.5"><Link to={row.href} className="hover:underline">{row.number}</Link> <span className="text-slate-500">{row.memo}</span></td>
                      <td className="px-4 py-2.5 capitalize">{row.bucket}</td>
                      <td className="px-4 py-2.5 text-right"><Money minor={row.amount} currency={currency} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        </div>
      )}
      {report === 'gst' && (
        <div className="space-y-3">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <Card className="p-4"><p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Output GST</p><p className="font-display text-xl mt-1"><Money minor={gst.output.taxMinor} currency={currency} /></p></Card>
            <Card className="p-4"><p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Input GST</p><p className="font-display text-xl mt-1"><Money minor={gst.input.taxMinor} currency={currency} /></p></Card>
            <Card className="p-4"><p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Net payable</p><p className="font-display text-xl mt-1"><Money minor={gst.net.taxMinor} currency={currency} /></p></Card>
            <Card className="p-4 text-sm space-y-1">
              <div className="flex justify-between"><span>CGST</span><Money minor={gst.net.cgstMinor} currency={currency} /></div>
              <div className="flex justify-between"><span>SGST</span><Money minor={gst.net.sgstMinor} currency={currency} /></div>
              <div className="flex justify-between"><span>IGST</span><Money minor={gst.net.igstMinor} currency={currency} /></div>
            </Card>
          </div>
          <p className="text-xs text-slate-500">Output from invoices and debit notes, less credit notes. Input from bills and expenses, less vendor credits. This is a books summary, not a GSTN filing.</p>
          <Card>
            <table className="w-full text-sm">
              <thead className="text-left text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 font-medium">Document</th>
                  <th className="px-4 py-3 font-medium">Kind</th>
                  <th className="px-4 py-3 font-medium text-right">Taxable</th>
                  <th className="px-4 py-3 font-medium text-right">CGST</th>
                  <th className="px-4 py-3 font-medium text-right">SGST</th>
                  <th className="px-4 py-3 font-medium text-right">IGST</th>
                </tr>
              </thead>
              <tbody>
                {gst.rows.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500">No posted tax documents in this range.</td></tr>
                ) : gst.rows.map((d) => (
                  <tr key={d.id} className="border-b border-slate-100">
                    <td className="px-4 py-2.5"><Link to={documentHref(d.kind, d.id)} className="font-medium text-teal-800 hover:underline">{d.number}</Link></td>
                    <td className="px-4 py-2.5 capitalize">{d.kind.replace('_', ' ')}</td>
                    <td className="px-4 py-2.5 text-right"><Money minor={d.tax.exclusiveMinor} currency={currency} /></td>
                    <td className="px-4 py-2.5 text-right"><Money minor={d.tax.cgstMinor} currency={currency} /></td>
                    <td className="px-4 py-2.5 text-right"><Money minor={d.tax.sgstMinor} currency={currency} /></td>
                    <td className="px-4 py-2.5 text-right"><Money minor={d.tax.igstMinor} currency={currency} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
      )}
      {report === 'aging' && (
        <Card>
          <table className="w-full text-sm">
            <thead className="text-left text-slate-500 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 font-medium">Doc</th>
                <th className="px-4 py-3 font-medium">Party</th>
                <th className="px-4 py-3 font-medium">Side</th>
                <th className="px-4 py-3 font-medium">Bucket</th>
                <th className="px-4 py-3 font-medium text-right">Outstanding</th>
              </tr>
            </thead>
            <tbody>
              {aging.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500">No open invoices, debit notes, or bills.</td></tr>
              ) : aging.map((row) => (
                <tr key={row.id} className="border-b border-slate-100">
                  <td className="px-4 py-2.5"><Link to={documentHref(row.kind, row.id)} className="font-medium text-teal-800 hover:underline">{row.number}</Link></td>
                  <td className="px-4 py-2.5">{row.party}</td>
                  <td className="px-4 py-2.5 uppercase text-xs">{row.side}</td>
                  <td className="px-4 py-2.5">{row.bucket}</td>
                  <td className="px-4 py-2.5 text-right"><Money minor={row.outstanding} currency={currency} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </PageShell>
  );
}

function groupAccounts(accounts: ReturnType<typeof withActivity>) {
  const map = new Map<AccountType, typeof accounts>();
  for (const account of accounts) {
    if (!account.allowPosting && account.debitTotalMinor === 0 && account.creditTotalMinor === 0) continue;
    const list = map.get(account.type) || [];
    list.push(account);
    map.set(account.type, list);
  }
  return map;
}

function sumTypes(accounts: { type: AccountType; debitTotalMinor: number; creditTotalMinor: number; normalBalance: 'debit' | 'credit' }[], types: AccountType[]) {
  return accounts.filter((a) => types.includes(a.type)).reduce((s, a) => s + signedBalance(a), 0);
}

function listTypes(grouped: Map<AccountType, any[]>, types: AccountType[]) {
  return types.flatMap((type) => (grouped.get(type) || []).map((a) => ({ name: `${a.code} ${a.name}`, amount: signedBalance(a), href: `/books/ledger/${a.id}` })));
}

function Section({ title, rows, currency }: { title: string; rows: { name: string; amount: number; href?: string }[]; currency: string }) {
  return (
    <div>
      <h3 className="font-semibold text-slate-800 mb-2">{title}</h3>
      <ul className="space-y-1">
        {rows.map((row) => (
          <li key={row.name} className="flex justify-between text-sm">
            {row.href ? <Link to={row.href} className="hover:underline">{row.name}</Link> : <span>{row.name}</span>}
            <Money minor={row.amount} currency={currency} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function Row({ label, amount, currency }: { label: string; amount: number; currency: string }) {
  return (
    <div className="flex justify-between">
      <span>{label}</span>
      <Money minor={amount} currency={currency} />
    </div>
  );
}

function ReportTable({ rows, currency, totals }: { rows: { label: string; debit: number; credit: number; href?: string }[]; currency: string; totals?: boolean }) {
  const debit = rows.reduce((s, r) => s + r.debit, 0);
  const credit = rows.reduce((s, r) => s + r.credit, 0);
  return (
    <table className="w-full text-sm">
      <thead className="text-left text-slate-500 border-b border-slate-200">
        <tr>
          <th className="px-4 py-3 font-medium">Account</th>
          <th className="px-4 py-3 font-medium text-right">Debit</th>
          <th className="px-4 py-3 font-medium text-right">Credit</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.label} className="border-b border-slate-100">
            <td className="px-4 py-2.5">{row.href ? <Link to={row.href} className="hover:underline">{row.label}</Link> : row.label}</td>
            <td className="px-4 py-2.5 text-right">{row.debit ? <Money minor={row.debit} currency={currency} /> : ''}</td>
            <td className="px-4 py-2.5 text-right">{row.credit ? <Money minor={row.credit} currency={currency} /> : ''}</td>
          </tr>
        ))}
        {totals && (
          <tr className={`font-semibold ${debit === credit ? 'text-emerald-700' : 'text-rose-700'}`}>
            <td className="px-4 py-3">Total {debit === credit ? '(balanced)' : '(unbalanced)'}</td>
            <td className="px-4 py-3 text-right"><Money minor={debit} currency={currency} /></td>
            <td className="px-4 py-3 text-right"><Money minor={credit} currency={currency} /></td>
          </tr>
        )}
      </tbody>
    </table>
  );
}

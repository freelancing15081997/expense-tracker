import React, { useMemo, useState } from 'react';
import { useBooks } from '../../context/BooksProvider';
import { signedBalance } from '../../engine/chartOfAccounts';
import { Card, Money, PageShell } from '../../ui';
import type { AccountType } from '../../core/types';
import { todayISO } from '../../core/money';

type Report = 'tb' | 'pl' | 'bs' | 'aging' | 'gst' | 'cash';

export default function Reports() {
  const { accounts, documents, parties, currency, journals } = useBooks();
  const [report, setReport] = useState<Report>('tb');

  const grouped = useMemo(() => {
    const map = new Map<AccountType, typeof accounts>();
    for (const account of accounts) {
      if (!account.allowPosting && account.debitTotalMinor === 0 && account.creditTotalMinor === 0) continue;
      const list = map.get(account.type) || [];
      list.push(account);
      map.set(account.type, list);
    }
    return map;
  }, [accounts]);

  const income = sumTypes(accounts, ['revenue', 'other_income']);
  const expense = sumTypes(accounts, ['expense', 'cogs', 'other_expense']);
  const assets = sumTypes(accounts, ['asset']);
  const liabilities = sumTypes(accounts, ['liability']);
  const equity = sumTypes(accounts, ['equity']) + (income - expense);

  const aging = useMemo(() => {
    const today = todayISO();
    return documents
      .filter((d) => (d.kind === 'invoice' || d.kind === 'bill') && d.status === 'posted' && d.paidMinor < d.totalMinor)
      .map((d) => {
        const due = d.dueDate || d.date;
        const days = Math.max(0, Math.floor((Date.parse(today) - Date.parse(due)) / 86400000));
        const bucket = days <= 0 ? 'Current' : days <= 30 ? '1-30' : days <= 60 ? '31-60' : '61+';
        return { ...d, days, bucket, outstanding: d.totalMinor - d.paidMinor, party: parties.find((p) => p.id === d.partyId)?.name || '—' };
      });
  }, [documents, parties]);

  return (
    <PageShell title="Reports" subtitle="Built from posted account totals. Unbalanced books cannot hide here.">
      <div className="flex flex-wrap gap-2">
        {([
          ['tb', 'Trial Balance'],
          ['pl', 'Profit & Loss'],
          ['bs', 'Balance Sheet'],
          ['aging', 'AR / AP Aging'],
          ['gst', 'GST'],
          ['cash', 'Cash movement'],
        ] as const).map(([id, label]) => (
          <button key={id} onClick={() => setReport(id)} className={`px-3 py-1.5 rounded-lg text-sm font-medium ${report === id ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-700'}`}>{label}</button>
        ))}
      </div>
      {report === 'tb' && (
        <Card>
          <ReportTable currency={currency} rows={accounts.filter((a) => a.allowPosting || a.debitTotalMinor || a.creditTotalMinor).map((a) => ({
            label: `${a.code} ${a.name}`,
            debit: a.debitTotalMinor,
            credit: a.creditTotalMinor,
          }))} totals />
        </Card>
      )}
      {report === 'pl' && (
        <Card className="p-4 space-y-4">
          <Section title="Income" rows={listTypes(grouped, ['revenue', 'other_income'])} currency={currency} />
          <Section title="Expenses" rows={listTypes(grouped, ['cogs', 'expense', 'other_expense'])} currency={currency} />
          <div className="flex justify-between font-semibold border-t border-slate-200 pt-3">
            <span>Net {income - expense >= 0 ? 'profit' : 'loss'}</span>
            <Money minor={income - expense} currency={currency} />
          </div>
        </Card>
      )}
      {report === 'bs' && (
        <Card className="p-4 space-y-4">
          <Section title="Assets" rows={listTypes(grouped, ['asset'])} currency={currency} />
          <Section title="Liabilities" rows={listTypes(grouped, ['liability'])} currency={currency} />
          <Section title="Equity (incl. current result)" rows={[...listTypes(grouped, ['equity']), { name: 'Current year result', amount: income - expense }]} currency={currency} />
          <div className={`flex justify-between font-semibold border-t border-slate-200 pt-3 ${assets === liabilities + equity ? 'text-emerald-700' : 'text-rose-700'}`}>
            <span>Assets {assets === liabilities + equity ? '=' : '≠'} Liabilities + Equity</span>
            <span><Money minor={assets} currency={currency} /> / <Money minor={liabilities + equity} currency={currency} /></span>
          </div>
          <p className="text-xs text-slate-500">{journals.filter((j) => j.status === 'posted').length} posted journals in this workspace.</p>
        </Card>
      )}
      {report === 'gst' && (
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
              {documents.filter((d) => d.status === 'posted' || d.status === 'paid').length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500">No posted tax documents.</td></tr>
              ) : documents.filter((d) => d.status === 'posted' || d.status === 'paid').map((d) => (
                <tr key={d.id} className="border-b border-slate-100">
                  <td className="px-4 py-2.5">{d.number}</td>
                  <td className="px-4 py-2.5 capitalize">{d.kind}</td>
                  <td className="px-4 py-2.5 text-right"><Money minor={d.tax.exclusiveMinor} currency={currency} /></td>
                  <td className="px-4 py-2.5 text-right"><Money minor={d.tax.cgstMinor} currency={currency} /></td>
                  <td className="px-4 py-2.5 text-right"><Money minor={d.tax.sgstMinor} currency={currency} /></td>
                  <td className="px-4 py-2.5 text-right"><Money minor={d.tax.igstMinor} currency={currency} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
      {report === 'cash' && (
        <Card className="p-4 space-y-2">
          {accounts.filter((a) => a.systemKey === 'cash' || a.systemKey === 'bank').map((a) => (
            <div key={a.id} className="flex justify-between text-sm">
              <span>{a.code} {a.name}</span>
              <Money minor={signedBalance(a)} currency={currency} />
            </div>
          ))}
          <p className="text-xs text-slate-500 pt-2">Cash movement is the signed posted balance of cash and bank accounts. Import feeds are not connected.</p>
        </Card>
      )}
      {report === 'aging' && (
        <Card>
          <table className="w-full text-sm">
            <thead className="text-left text-slate-500 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 font-medium">Doc</th>
                <th className="px-4 py-3 font-medium">Party</th>
                <th className="px-4 py-3 font-medium">Bucket</th>
                <th className="px-4 py-3 font-medium text-right">Outstanding</th>
              </tr>
            </thead>
            <tbody>
              {aging.length === 0 ? (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-500">No open invoices or bills.</td></tr>
              ) : aging.map((row) => (
                <tr key={row.id} className="border-b border-slate-100">
                  <td className="px-4 py-2.5">{row.number}</td>
                  <td className="px-4 py-2.5">{row.party}</td>
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

function sumTypes(accounts: { type: AccountType; debitTotalMinor: number; creditTotalMinor: number; normalBalance: 'debit' | 'credit' }[], types: AccountType[]) {
  return accounts.filter((a) => types.includes(a.type)).reduce((s, a) => s + signedBalance(a), 0);
}

function listTypes(grouped: Map<AccountType, any[]>, types: AccountType[]) {
  return types.flatMap((type) => (grouped.get(type) || []).map((a) => ({ name: `${a.code} ${a.name}`, amount: signedBalance(a) })));
}

function Section({ title, rows, currency }: { title: string; rows: { name: string; amount: number }[]; currency: string }) {
  return (
    <div>
      <h3 className="font-semibold text-slate-800 mb-2">{title}</h3>
      <ul className="space-y-1">
        {rows.map((row) => (
          <li key={row.name} className="flex justify-between text-sm">
            <span>{row.name}</span>
            <Money minor={row.amount} currency={currency} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function ReportTable({ rows, currency, totals }: { rows: { label: string; debit: number; credit: number }[]; currency: string; totals?: boolean }) {
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
            <td className="px-4 py-2.5">{row.label}</td>
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

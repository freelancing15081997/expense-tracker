import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useBooks } from '../../context/BooksProvider';
import { signedBalance } from '../../engine/chartOfAccounts';
import { todayISO } from '../../core/money';
import { Card, Kpi, Money, PageShell } from '../../ui';
import { formatMoney } from '../../core/money';
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

export default function CfoDashboard() {
  const { accounts, documents, bankTxns, budgets, currency, periods } = useBooks();
  const cash = accounts.filter((a) => a.systemKey === 'cash' || a.systemKey === 'bank').reduce((s, a) => s + signedBalance(a), 0);
  const ar = accounts.find((a) => a.systemKey === 'ar');
  const ap = accounts.find((a) => a.systemKey === 'ap');
  const income = accounts.filter((a) => a.type === 'revenue' || a.type === 'other_income').reduce((s, a) => s + signedBalance(a), 0);
  const spend = accounts.filter((a) => a.type === 'expense' || a.type === 'cogs' || a.type === 'other_expense').reduce((s, a) => s + signedBalance(a), 0);
  const profit = income - spend;
  const arBal = ar ? signedBalance(ar) : 0;
  const apBal = ap ? signedBalance(ap) : 0;
  const working = cash + arBal - apBal;
  const margin = income === 0 ? 0 : Math.round((profit / income) * 10000) / 100;
  const overdue = documents.filter((d) => d.kind === 'invoice' && d.status === 'posted' && d.dueDate && d.dueDate < todayISO() && d.paidMinor < d.totalMinor);
  const bills = documents.filter((d) => d.kind === 'bill' && d.status === 'posted' && d.paidMinor < d.totalMinor);
  const budgetTotal = budgets.reduce((s, b) => s + b.amountMinor, 0);

  const alerts = useMemo(() => {
    const list: { severity: string; text: string; href: string }[] = [];
    if (cash < 0) list.push({ severity: 'Critical', text: 'Cash is negative', href: '/books/banking' });
    if (overdue.length) list.push({ severity: 'High', text: `${overdue.length} overdue invoice(s)`, href: '/books/collections' });
    if (bills.length) list.push({ severity: 'Medium', text: `${bills.length} unpaid bill(s)`, href: '/books/payment-run' });
    if (bankTxns.some((t) => !t.reconciled)) list.push({ severity: 'Medium', text: 'Unreconciled bank journals', href: '/books/banking' });
    if (periods.every((p) => p.status === 'open') === false && periods.filter((p) => p.status === 'open').length === 0) {
      list.push({ severity: 'Low', text: 'No open accounting period', href: '/books/periods' });
    }
    return list;
  }, [bankTxns, bills.length, cash, overdue.length, periods]);

  return (
    <PageShell title="CFO Dashboard" subtitle="Posted balances only. Alerts are operational counts, not estimates.">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi label="Revenue"><Money minor={income} currency={currency} /></Kpi>
        <Kpi label="Expenses"><Money minor={spend} currency={currency} /></Kpi>
        <Kpi label="Profit"><Money minor={profit} currency={currency} /></Kpi>
        <Kpi label="Net margin">{margin}%</Kpi>
        <Kpi label="Cash"><Money minor={cash} currency={currency} /></Kpi>
        <Kpi label="AR"><Money minor={arBal} currency={currency} /></Kpi>
        <Kpi label="AP"><Money minor={apBal} currency={currency} /></Kpi>
        <Kpi label="Working capital"><Money minor={working} currency={currency} /></Kpi>
      </div>
      <div className="grid lg:grid-cols-2 gap-3">
        <Card className="p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Profit and loss</p>
          <p className="text-xs text-slate-500 mt-1 mb-3">Revenue, expenses, and profit from posted accounts.</p>
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={[{ name: 'P&L', Revenue: income / 100, Expenses: spend / 100, Profit: profit / 100 }]}>
                <XAxis dataKey="name" hide />
                <YAxis tick={{ fontSize: 11 }} width={48} />
                <Tooltip formatter={(value: number) => formatMoney(Math.round(Number(value) * 100), currency)} />
                <Bar dataKey="Revenue" fill="#12B8A8" radius={6} />
                <Bar dataKey="Expenses" fill="#0B1F3A" radius={6} />
                <Bar dataKey="Profit" fill="#64748B" radius={6} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card className="p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Cash position</p>
          <p className="text-xs text-slate-500 mt-1 mb-3">Cash, receivables, and payables.</p>
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={[{ name: 'Position', Cash: cash / 100, AR: arBal / 100, AP: apBal / 100 }]} layout="vertical">
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="name" hide />
                <Tooltip formatter={(value: number) => formatMoney(Math.round(Number(value) * 100), currency)} />
                <Bar dataKey="Cash" fill="#0B1F3A" radius={6} />
                <Bar dataKey="AR" fill="#12B8A8" radius={6} />
                <Bar dataKey="AP" fill="#94A3B8" radius={6} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
      {budgetTotal > 0 && (
        <Card className="p-4 text-sm">
          Budget lines total <Money minor={budgetTotal} currency={currency} /> · actual spend <Money minor={spend} currency={currency} /> · variance <Money minor={budgetTotal - spend} currency={currency} />
        </Card>
      )}
      <Card>
        <div className="px-4 py-3 border-b border-slate-100 font-semibold text-sm">Control alerts</div>
        {alerts.length === 0 ? <p className="p-4 text-sm text-slate-500">No operational alerts.</p> : (
          <ul className="divide-y divide-slate-100">
            {alerts.map((a) => (
              <li key={a.text} className="px-4 py-2.5 flex justify-between gap-3 text-sm">
                <span><span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full ${a.severity === 'Critical' ? 'bg-rose-50 text-rose-800' : a.severity === 'High' ? 'bg-amber-50 text-amber-900' : a.severity === 'Medium' ? 'bg-sky-50 text-sky-800' : 'bg-slate-100 text-slate-600'}`}>{a.severity}</span> {a.text}</span>
                <Link to={a.href} className="text-xs font-semibold text-teal-700">Open</Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </PageShell>
  );
}

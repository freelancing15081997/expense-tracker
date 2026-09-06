import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useBooks } from '../../context/BooksProvider';
import { signedBalance } from '../../engine/chartOfAccounts';
import { Card, Kpi, Money, PageShell, Status } from '../../ui';
import { todayISO } from '../../core/money';
import { BOOKS_QUICK_CREATE } from '../../nav';

export default function Dashboard() {
  const { tenant, accounts, journals, documents, currency } = useBooks();
  const byKey = (key: string) => accounts.find((a) => a.systemKey === key);

  const cards = useMemo(() => {
    const cash = (byKey('cash') ? signedBalance(byKey('cash')!) : 0) + (byKey('bank') ? signedBalance(byKey('bank')!) : 0);
    const ar = byKey('ar') ? signedBalance(byKey('ar')!) : 0;
    const ap = byKey('ap') ? signedBalance(byKey('ap')!) : 0;
    const income = accounts.filter((a) => a.type === 'revenue' || a.type === 'other_income').reduce((s, a) => s + signedBalance(a), 0);
    const spend = accounts.filter((a) => a.type === 'expense' || a.type === 'cogs' || a.type === 'other_expense').reduce((s, a) => s + signedBalance(a), 0);
    return [
      { label: 'Cash & Bank', value: cash },
      { label: 'Receivables', value: ar },
      { label: 'Payables', value: ap },
      { label: 'Income', value: income },
      { label: 'Expenses', value: spend },
      { label: 'Net', value: income - spend },
    ];
  }, [accounts]);

  const overdue = documents.filter((d) => d.kind === 'invoice' && d.status === 'posted' && d.dueDate && d.dueDate < todayISO() && d.paidMinor < d.totalMinor);

  return (
    <PageShell title={tenant?.name || 'Books'} subtitle="Live balances from posted journals. Nothing here is estimated.">
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        {cards.map((card) => (
          <Kpi key={card.label} label={card.label}><Money minor={card.value} currency={currency} /></Kpi>
        ))}
      </div>
      {overdue.length > 0 && (
        <Card className="p-4 border-amber-200 bg-amber-50">
          <p className="text-sm font-medium text-amber-900">{overdue.length} overdue invoice{overdue.length === 1 ? '' : 's'} need collection.</p>
        </Card>
      )}
      <div className="flex flex-wrap gap-2">
        {BOOKS_QUICK_CREATE.map((item) => (
          <Link key={item.href} to={item.href} className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:border-slate-400 hover:bg-slate-50">
            {item.name}
          </Link>
        ))}
        <Link to="/books/control-tower" className="bg-slate-900 text-white rounded-lg px-3 py-2 text-sm font-medium">Control Tower</Link>
        <Link to="/books/workbench" className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm font-medium text-slate-700">CA Workbench</Link>
      </div>
      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <div className="px-4 py-3 border-b border-slate-100 flex justify-between">
            <h2 className="font-semibold text-slate-800">Recent journals</h2>
            <Link to="/books/journals" className="text-sm text-slate-500 hover:text-slate-800">Open</Link>
          </div>
          {journals.slice(0, 6).length === 0 ? <p className="p-4 text-sm text-slate-500">No journals posted yet.</p> : (
            <ul className="divide-y divide-slate-100">
              {journals.slice(0, 6).map((j) => (
                <li key={j.id} className="px-4 py-3 flex items-center justify-between gap-3 text-sm">
                  <div>
                    <p className="font-medium text-slate-800">{j.number} · {j.description}</p>
                    <p className="text-slate-500">{j.date}</p>
                  </div>
                  <Status value={j.status} />
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card>
          <div className="px-4 py-3 border-b border-slate-100 flex justify-between">
            <h2 className="font-semibold text-slate-800">Open documents</h2>
            <Link to="/books/invoices" className="text-sm text-slate-500 hover:text-slate-800">Invoices</Link>
          </div>
          {documents.filter((d) => d.status === 'draft' || d.status === 'posted').slice(0, 6).length === 0 ? (
            <p className="p-4 text-sm text-slate-500">No open invoices, bills, or expenses.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {documents.filter((d) => d.status === 'draft' || d.status === 'posted').slice(0, 6).map((d) => (
                <li key={d.id} className="px-4 py-3 flex items-center justify-between gap-3 text-sm">
                  <div>
                    <p className="font-medium text-slate-800">{d.number}</p>
                    <p className="text-slate-500 capitalize">{d.kind} · {d.date}</p>
                  </div>
                  <Money minor={d.totalMinor - d.paidMinor} currency={currency} />
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </PageShell>
  );
}

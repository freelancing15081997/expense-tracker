import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useBooks } from '../../context/BooksProvider';
import { signedBalance } from '../../engine/chartOfAccounts';
import { Card, FeatureIcon, GroupIcon, Kpi, Money, PageShell, Status, btnAccent, btnGhost } from '../../ui';
import { formatMoney, todayISO } from '../../core/money';
import { BOOKS_QUICK_CREATE } from '../../nav';
import { BOOKS_TREE } from '../../catalog/modules';
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

export default function Dashboard() {
  const { tenant, accounts, journals, documents, parties, currency, approvals, bankTxns } = useBooks();
  const byKey = (key: string) => accounts.find((a) => a.systemKey === key);

  const cards = useMemo(() => {
    const cash = (byKey('cash') ? signedBalance(byKey('cash')!) : 0) + (byKey('bank') ? signedBalance(byKey('bank')!) : 0);
    const ar = byKey('ar') ? signedBalance(byKey('ar')!) : 0;
    const ap = byKey('ap') ? signedBalance(byKey('ap')!) : 0;
    const income = accounts.filter((a) => a.type === 'revenue' || a.type === 'other_income').reduce((s, a) => s + signedBalance(a), 0);
    const spend = accounts.filter((a) => a.type === 'expense' || a.type === 'cogs' || a.type === 'other_expense').reduce((s, a) => s + signedBalance(a), 0);
    return [
      { label: 'Cash & Bank', value: cash, href: '/books/banking' },
      { label: 'Receivables', value: ar, href: '/books/collections' },
      { label: 'Payables', value: ap, href: '/books/payment-run' },
      { label: 'Income', value: income, href: '/books/reports' },
      { label: 'Expenses', value: spend, href: '/books/expenses' },
      { label: 'Net', value: income - spend, href: '/books/reports' },
    ];
  }, [accounts]);

  const overdue = documents.filter((d) => d.kind === 'invoice' && d.status === 'posted' && d.dueDate && d.dueDate < todayISO() && d.paidMinor < d.totalMinor);
  const drafts = documents.filter((d) => d.status === 'draft');
  const openBills = documents.filter((d) => d.kind === 'bill' && d.status === 'posted' && d.paidMinor < d.totalMinor);
  const customers = parties.filter((p) => p.kind === 'customer' && p.active).length;
  const vendors = parties.filter((p) => p.kind === 'vendor' && p.active).length;
  const posted = journals.filter((j) => j.status === 'posted').length;
  const pending = approvals.filter((a) => a.status === 'pending').length;
  const unrec = bankTxns.filter((t) => !t.reconciled).length;

  return (
    <PageShell title={tenant?.name || 'Books'} subtitle="Live balances, drafts, and the work waiting on you.">
      <div className="flex flex-wrap gap-2">
        {BOOKS_QUICK_CREATE.map((item, index) => (
          <Link key={item.href} to={item.href} className={index === 0 ? btnAccent : btnGhost}>
            <FeatureIcon href={item.href} className="w-3.5 h-3.5" />
            {item.name}
          </Link>
        ))}
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        {cards.map((card) => (
          <Link key={card.label} to={card.href}>
            <Kpi label={card.label}>
              <span className="flex items-center gap-2">
                <FeatureIcon href={card.href} className="w-5 h-5" />
                <Money minor={card.value} currency={currency} />
              </span>
            </Kpi>
          </Link>
        ))}
      </div>

      <div className="grid lg:grid-cols-[1.2fr_0.8fr] gap-3">
        <Card className="p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Income vs expenses</p>
          <p className="text-xs text-slate-500 mt-1 mb-3">Posted account balances only.</p>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={[{ name: 'Posted', Income: cards[3].value / 100, Expenses: cards[4].value / 100 }]}>
                <XAxis dataKey="name" hide />
                <YAxis tick={{ fontSize: 11 }} width={48} />
                <Tooltip formatter={(value: number) => formatMoney(Math.round(Number(value) * 100), currency)} />
                <Bar dataKey="Income" fill="#12B8A8" radius={6} />
                <Bar dataKey="Expenses" fill="#0B1F3A" radius={6} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card className="p-4 space-y-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Work queue</p>
          <p className="text-sm text-[#0B1F3A]">{drafts.length} draft{drafts.length === 1 ? '' : 's'}</p>
          <p className="text-sm text-[#0B1F3A]">{overdue.length} overdue invoice{overdue.length === 1 ? '' : 's'}</p>
          <p className="text-sm text-[#0B1F3A]">{openBills.length} unpaid bill{openBills.length === 1 ? '' : 's'}</p>
          <p className="text-sm text-[#0B1F3A]">{pending} pending approval{pending === 1 ? '' : 's'}</p>
          <p className="text-sm text-[#0B1F3A]">{unrec} unreconciled bank item{unrec === 1 ? '' : 's'}</p>
        </Card>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
        <Card className="p-4"><p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Customers</p><p className="text-xl font-display mt-1">{customers}</p></Card>
        <Card className="p-4"><p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Vendors</p><p className="text-xl font-display mt-1">{vendors}</p></Card>
        <Card className="p-4"><p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Drafts</p><p className="text-xl font-display mt-1">{drafts.length}</p></Card>
        <Card className="p-4"><p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Journals</p><p className="text-xl font-display mt-1">{posted}</p></Card>
      </div>

      {(overdue.length > 0 || openBills.length > 0 || pending > 0 || unrec > 0) && (
        <Card className="p-4 border-amber-200 bg-amber-50 space-y-1">
          {overdue.length > 0 && <p className="text-sm font-medium text-amber-900">{overdue.length} overdue invoice{overdue.length === 1 ? '' : 's'} — <Link to="/books/collections" className="underline">Collections</Link></p>}
          {openBills.length > 0 && <p className="text-sm font-medium text-amber-900">{openBills.length} unpaid bill{openBills.length === 1 ? '' : 's'} — <Link to="/books/payment-run" className="underline">Payment run</Link></p>}
          {pending > 0 && <p className="text-sm font-medium text-amber-900">{pending} pending approval{pending === 1 ? '' : 's'} — <Link to="/books/approvals" className="underline">Approvals</Link></p>}
          {unrec > 0 && <p className="text-sm font-medium text-amber-900">{unrec} unreconciled bank item{unrec === 1 ? '' : 's'} — <Link to="/books/banking" className="underline">Banking</Link></p>}
          <p className="text-sm font-medium text-amber-900">Close checklist — <Link to="/books/close" className="underline">Month-end close</Link></p>
        </Card>
      )}

      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
        {BOOKS_TREE.map((branch) => (
          <Card key={branch.id} className="p-4 space-y-2">
            <Link to={branch.href} className="font-semibold text-[#0B1F3A] hover:underline inline-flex items-center gap-2">
              <GroupIcon title={branch.name} className="w-4 h-4" />
              {branch.name}
            </Link>
            <ul className="space-y-0.5">
              {branch.items.map((item) => (
                <li key={item.href}>
                  <Link to={item.href} className="text-[13px] text-slate-600 hover:text-[#0B1F3A] flex items-center gap-2 py-1">
                    <FeatureIcon href={item.href} className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{item.name}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-3">
        <Card>
          <div className="px-4 py-3 border-b border-slate-100 flex justify-between">
            <h2 className="text-sm font-semibold text-slate-800">Recent journals</h2>
            <Link to="/books/journals" className="text-xs font-semibold text-slate-500 hover:text-slate-800">Open</Link>
          </div>
          {journals.slice(0, 6).length === 0 ? <p className="p-4 text-sm text-slate-500">No journals posted yet.</p> : (
            <ul className="divide-y divide-slate-100">
              {journals.slice(0, 6).map((j) => (
                <li key={j.id} className="px-4 py-2.5 flex items-center justify-between gap-3 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium text-slate-800 truncate">{j.number} · {j.description}</p>
                    <p className="text-xs text-slate-500">{j.date}</p>
                  </div>
                  <Status value={j.status} />
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card>
          <div className="px-4 py-3 border-b border-slate-100 flex justify-between">
            <h2 className="text-sm font-semibold text-slate-800">Open documents</h2>
            <Link to="/books/invoices" className="text-xs font-semibold text-slate-500 hover:text-slate-800">Invoices</Link>
          </div>
          {documents.filter((d) => d.status === 'draft' || d.status === 'posted').slice(0, 6).length === 0 ? (
            <p className="p-4 text-sm text-slate-500">No open invoices, bills, or expenses.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {documents.filter((d) => d.status === 'draft' || d.status === 'posted').slice(0, 6).map((d) => (
                <li key={d.id} className="px-4 py-2.5 flex items-center justify-between gap-3 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium text-slate-800 truncate">{d.number}</p>
                    <p className="text-xs text-slate-500 capitalize">{d.kind} · {d.date}</p>
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

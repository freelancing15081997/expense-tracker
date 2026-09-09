import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useBooks } from '../../context/BooksProvider';
import { signedBalance } from '../../engine/chartOfAccounts';
import { Card, Kpi, Money, PageShell, Status, btnPrimary } from '../../ui';
import { todayISO } from '../../core/money';
import { BOOKS_QUICK_CREATE } from '../../nav';
import { BOOKS_TREE } from '../../catalog/modules';
import { BOOKS_CATALOG } from '../../catalog';

export default function Dashboard() {
  const { tenant, accounts, journals, documents, parties, currency, approvals, bankTxns, periods } = useBooks();
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
    <PageShell title={tenant?.name || 'Books'} subtitle="Command center for every live Books feature. Posted balances only — adapters are labeled as not operational.">
      <div className="flex flex-wrap gap-2">
        <Link to="/" className="byjan-btn-ghost">Main dashboard</Link>
        <Link to="/expenses" className="byjan-btn-ghost">Expense Tracker</Link>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        {cards.map((card) => (
          <Link key={card.label} to={card.href}>
            <Kpi label={card.label}><Money minor={card.value} currency={currency} /></Kpi>
          </Link>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {BOOKS_QUICK_CREATE.map((item) => (
          <Link key={item.href} to={item.href} className={btnPrimary}>{item.name}</Link>
        ))}
        <Link to="/books/control-tower" className="byjan-btn-ghost">Control Tower</Link>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
        <Card className="p-4"><p className="text-[#6B7280]">Customers</p><p className="text-xl font-display mt-1">{customers}</p></Card>
        <Card className="p-4"><p className="text-[#6B7280]">Vendors</p><p className="text-xl font-display mt-1">{vendors}</p></Card>
        <Card className="p-4"><p className="text-[#6B7280]">Draft documents</p><p className="text-xl font-display mt-1">{drafts.length}</p></Card>
        <Card className="p-4"><p className="text-[#6B7280]">Posted journals</p><p className="text-xl font-display mt-1">{posted}</p></Card>
      </div>

      {(overdue.length > 0 || openBills.length > 0 || pending > 0 || unrec > 0) && (
        <Card className="p-4 border-amber-200 bg-amber-50 space-y-1">
          {overdue.length > 0 && <p className="text-sm font-medium text-amber-900">{overdue.length} overdue invoice{overdue.length === 1 ? '' : 's'} — <Link to="/books/collections" className="underline">Collections</Link></p>}
          {openBills.length > 0 && <p className="text-sm font-medium text-amber-900">{openBills.length} unpaid bill{openBills.length === 1 ? '' : 's'} — <Link to="/books/payment-run" className="underline">Payment run</Link></p>}
          {pending > 0 && <p className="text-sm font-medium text-amber-900">{pending} pending approval{pending === 1 ? '' : 's'} — <Link to="/books/approvals" className="underline">Approvals</Link></p>}
          {unrec > 0 && <p className="text-sm font-medium text-amber-900">{unrec} unreconciled bank item{unrec === 1 ? '' : 's'} — <Link to="/books/banking" className="underline">Banking</Link></p>}
        </Card>
      )}

      <div>
        <h2 className="font-display text-lg mb-3">All Books features</h2>
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          {BOOKS_TREE.map((branch) => (
            <Card key={branch.id} className="p-4 space-y-3">
              <div>
                <Link to={branch.href} className="font-semibold text-[#0B1F3A] hover:underline">{branch.name}</Link>
                <p className="text-xs text-[#6B7280] mt-1">{branch.blurb}</p>
              </div>
              <ul className="space-y-1">
                {branch.items.map((item) => (
                  <li key={item.href}>
                    <Link to={item.href} className="text-sm text-[#0B1F3A] hover:text-teal-800 flex justify-between gap-2">
                      <span>{item.name}</span>
                      <span className="text-[10px] uppercase tracking-wide text-emerald-700">Live</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
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

      <Card className="p-4 space-y-3">
        <h2 className="font-semibold">Requirement coverage</h2>
        <p className="text-sm text-slate-500">{periods.filter((p) => p.status === 'open').length} open period(s). Live items post journals. Adapter items need an external service and are not faked.</p>
        {BOOKS_CATALOG.map((group) => (
          <div key={group.domain}>
            <h3 className="text-xs uppercase tracking-wide text-slate-500 font-bold mb-1">{group.domain}</h3>
            <ul className="text-sm grid sm:grid-cols-2 gap-1">
              {group.items.map((item) => (
                <li key={item.name} className="flex justify-between gap-3">
                  {item.href ? <Link to={item.href} className="hover:underline">{item.name}</Link> : <span>{item.name}</span>}
                  <span className={item.status === 'live' ? 'text-emerald-700' : 'text-slate-400'}>{item.status}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </Card>
    </PageShell>
  );
}

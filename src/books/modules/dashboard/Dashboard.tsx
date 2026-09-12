import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useBooks } from '../../context/BooksProvider';
import { signedBalance } from '../../engine/chartOfAccounts';
import { FeatureIcon, Money, PageShell, Status, btnAccent, btnGhost } from '../../ui';
import { ChevronRight } from 'lucide-react';
import { formatMoney, todayISO } from '../../core/money';
import { BOOKS_QUICK_CREATE } from '../../nav';
import { BOOKS_TREE } from '../../catalog/modules';
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

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
    <PageShell title={tenant?.name || 'Books'} subtitle="Balances, drafts, and what needs you next.">
      <div className="flex flex-wrap gap-2">
        {BOOKS_QUICK_CREATE.map((item, index) => (
          <Link key={item.href} to={item.href} className={`${index === 0 ? btnAccent : btnGhost} !rounded-full`}>
            <FeatureIcon href={item.href} className="w-3.5 h-3.5" />
            {item.name}
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-6 gap-2.5">
        {cards.map((card) => (
          <Link
            key={card.label}
            to={card.href}
            className="dash-kpi"
            title={`${card.label} from posted Books balances. Open for the full report.`}
          >
            <p className="dash-kpi-label">{card.label}</p>
            <p className="dash-kpi-value"><Money minor={card.value} currency={currency} /></p>
          </Link>
        ))}
      </div>

      <div className="grid lg:grid-cols-[1.15fr_0.85fr] gap-6">
        <div>
          <p className="ios-section-label">Income vs expenses</p>
          <div className="ios-widget">
            <div className="h-44">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={[
                  { name: 'Income', amount: cards[3].value / 100, fill: '#12B8A8' },
                  { name: 'Expenses', amount: cards[4].value / 100, fill: '#0B1F3A' },
                ]}>
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11 }} width={48} axisLine={false} tickLine={false} />
                  <Tooltip formatter={(value: number) => formatMoney(Math.round(Number(value) * 100), currency)} />
                  <Bar dataKey="amount" radius={8}>
                    <Cell fill="#12B8A8" />
                    <Cell fill="#0B1F3A" />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
        <div>
          <p className="ios-section-label">Needs attention</p>
          <div className="ios-group">
            {[
              { href: '/books/invoices', label: `${drafts.length} draft${drafts.length === 1 ? '' : 's'}` },
              { href: '/books/collections', label: `${overdue.length} overdue invoice${overdue.length === 1 ? '' : 's'}` },
              { href: '/books/payment-run', label: `${openBills.length} unpaid bill${openBills.length === 1 ? '' : 's'}` },
              { href: '/books/approvals', label: `${pending} pending approval${pending === 1 ? '' : 's'}` },
              { href: '/books/banking', label: `${unrec} unreconciled` },
            ].map((item) => (
              <Link key={item.href} to={item.href} className="ios-row">
                <span className="text-[16px] font-medium text-[#0B1F3A] tracking-tight">{item.label}</span>
                <ChevronRight className="ios-chevron w-5 h-5" />
              </Link>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Customers', value: customers },
          { label: 'Vendors', value: vendors },
          { label: 'Drafts', value: drafts.length },
          { label: 'Journals', value: posted },
        ].map((item) => (
          <div key={item.label} className="ios-widget">
            <p className="ios-caption">{item.label}</p>
            <p className="mt-2 text-[22px] font-semibold tracking-tight text-[#0B1F3A]">{item.value}</p>
          </div>
        ))}
      </div>

      {(overdue.length > 0 || openBills.length > 0 || pending > 0 || unrec > 0) && (
        <div className="ios-group">
          {overdue.length > 0 && <Link to="/books/collections" className="ios-row"><span>{overdue.length} overdue invoices</span><ChevronRight className="ios-chevron w-5 h-5" /></Link>}
          {openBills.length > 0 && <Link to="/books/payment-run" className="ios-row"><span>{openBills.length} unpaid bills</span><ChevronRight className="ios-chevron w-5 h-5" /></Link>}
          {pending > 0 && <Link to="/books/approvals" className="ios-row"><span>{pending} pending approvals</span><ChevronRight className="ios-chevron w-5 h-5" /></Link>}
          {unrec > 0 && <Link to="/books/banking" className="ios-row"><span>{unrec} unreconciled items</span><ChevronRight className="ios-chevron w-5 h-5" /></Link>}
          <Link to="/books/close" className="ios-row"><span>Month-end close</span><ChevronRight className="ios-chevron w-5 h-5" /></Link>
        </div>
      )}

      {BOOKS_TREE.map((branch) => (
        <div key={branch.id}>
          <p className="ios-section-label">{branch.name}</p>
          <div className="ios-group">
            {branch.items.map((item) => (
              <Link key={item.href} to={item.href} className="ios-row">
                <span className="ios-glyph"><FeatureIcon href={item.href} className="w-4 h-4" /></span>
                <span className="text-[16px] font-medium text-[#0B1F3A] tracking-tight truncate">{item.name}</span>
                <ChevronRight className="ios-chevron w-5 h-5" />
              </Link>
            ))}
          </div>
        </div>
      ))}

      <div className="grid lg:grid-cols-2 gap-6">
        <div>
          <div className="flex items-center justify-between ios-section-label">
            <span>Recent journals</span>
            <Link to="/books/journals" className="text-[#0B1F3A] font-semibold">Open</Link>
          </div>
          <div className="ios-group">
            {journals.slice(0, 6).length === 0 ? <p className="ios-row ios-caption">No journals posted yet.</p> : journals.slice(0, 6).map((j) => (
              <div key={j.id} className="ios-row">
                <span className="min-w-0">
                  <span className="block text-[15px] font-medium text-[#0B1F3A] truncate">{j.number} · {j.description}</span>
                  <span className="block text-[12px] text-[#8e8e93]">{j.date}</span>
                </span>
                <Status value={j.status} />
              </div>
            ))}
          </div>
        </div>
        <div>
          <div className="flex items-center justify-between ios-section-label">
            <span>Open documents</span>
            <Link to="/books/invoices" className="text-[#0B1F3A] font-semibold">Invoices</Link>
          </div>
          <div className="ios-group">
            {documents.filter((d) => d.status === 'draft' || d.status === 'posted').slice(0, 6).length === 0 ? (
              <p className="ios-row ios-caption">No open invoices, bills, or expenses.</p>
            ) : documents.filter((d) => d.status === 'draft' || d.status === 'posted').slice(0, 6).map((d) => (
              <div key={d.id} className="ios-row">
                <span className="min-w-0">
                  <span className="block text-[15px] font-medium text-[#0B1F3A] truncate">{d.number}</span>
                  <span className="block text-[12px] text-[#8e8e93] capitalize">{d.kind} · {d.date}</span>
                </span>
                <Money minor={d.totalMinor - d.paidMinor} currency={currency} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </PageShell>
  );
}

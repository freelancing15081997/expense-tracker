import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useBooks } from '../../context/BooksProvider';
import { signedBalance } from '../../engine/chartOfAccounts';
import { todayISO } from '../../core/money';
import { BOOKS_QUICK_CREATE } from '../../nav';
import { Card, Money, PageShell, Status } from '../../ui';

export default function ControlTower() {
  const { accounts, documents, journals, bankTxns, periods, approvals, currency } = useBooks();
  const cash = accounts.filter((a) => a.systemKey === 'cash' || a.systemKey === 'bank').reduce((s, a) => s + signedBalance(a), 0);
  const ar = accounts.find((a) => a.systemKey === 'ar');
  const ap = accounts.find((a) => a.systemKey === 'ap');
  const overdue = documents.filter((d) => d.kind === 'invoice' && d.status === 'posted' && d.dueDate && d.dueDate < todayISO() && d.paidMinor < d.totalMinor);
  const billsDue = documents.filter((d) => d.kind === 'bill' && d.status === 'posted' && d.paidMinor < d.totalMinor);
  const pending = approvals.filter((a) => a.status === 'pending');
  const unrec = bankTxns.filter((t) => !t.reconciled);

  const checks = useMemo(() => {
    const debit = accounts.reduce((s, a) => s + a.debitTotalMinor, 0);
    const credit = accounts.reduce((s, a) => s + a.creditTotalMinor, 0);
    return [
      { label: 'Books balanced', ok: debit === credit },
      { label: 'No overdue AR', ok: overdue.length === 0 },
      { label: 'Bank cleared', ok: unrec.length === 0 },
      { label: 'Approvals clear', ok: pending.length === 0 },
    ];
  }, [accounts, overdue.length, pending.length, unrec.length]);

  return (
    <PageShell title="Control Tower" subtitle="Live control view. Every figure is a posted balance or an open operational count.">
      <div className="flex flex-wrap gap-2">
        {BOOKS_QUICK_CREATE.map((item) => (
          <Link key={item.href} to={item.href} className="px-3 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium">{item.name}</Link>
        ))}
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="p-4"><p className="text-xs uppercase text-slate-500 font-semibold">Cash & bank</p><p className="mt-2 text-xl"><Money minor={cash} currency={currency} /></p></Card>
        <Card className="p-4"><p className="text-xs uppercase text-slate-500 font-semibold">Receivables</p><p className="mt-2 text-xl"><Money minor={ar ? signedBalance(ar) : 0} currency={currency} /></p></Card>
        <Card className="p-4"><p className="text-xs uppercase text-slate-500 font-semibold">Payables</p><p className="mt-2 text-xl"><Money minor={ap ? signedBalance(ap) : 0} currency={currency} /></p></Card>
        <Card className="p-4"><p className="text-xs uppercase text-slate-500 font-semibold">Posted journals</p><p className="mt-2 text-xl">{journals.filter((j) => j.status === 'posted').length}</p></Card>
      </div>
      <div className="grid md:grid-cols-4 gap-3">
        {checks.map((c) => (
          <Card key={c.label} className={`p-4 ${c.ok ? '' : 'border-amber-300'}`}>
            <p className="text-sm font-medium">{c.label}</p>
            <Status value={c.ok ? 'ok' : 'review'} />
          </Card>
        ))}
      </div>
      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <div className="px-4 py-3 border-b"><h2 className="font-semibold">Collections</h2></div>
          {overdue.length === 0 ? <p className="p-4 text-sm text-slate-500">No overdue posted invoices.</p> : overdue.slice(0, 8).map((d) => (
            <div key={d.id} className="px-4 py-2.5 flex justify-between text-sm border-b border-slate-100">
              <span>{d.number}</span>
              <Money minor={d.totalMinor - d.paidMinor} currency={currency} />
            </div>
          ))}
        </Card>
        <Card>
          <div className="px-4 py-3 border-b"><h2 className="font-semibold">Payment run candidates</h2></div>
          {billsDue.length === 0 ? <p className="p-4 text-sm text-slate-500">No open posted bills.</p> : billsDue.slice(0, 8).map((d) => (
            <div key={d.id} className="px-4 py-2.5 flex justify-between text-sm border-b border-slate-100">
              <span>{d.number}</span>
              <Money minor={d.totalMinor - d.paidMinor} currency={currency} />
            </div>
          ))}
        </Card>
      </div>
      <p className="text-xs text-slate-500">{periods.filter((p) => p.status === 'open').length} open period(s) · {unrec.length} unreconciled bank journal(s) · {pending.length} pending approval(s)</p>
    </PageShell>
  );
}

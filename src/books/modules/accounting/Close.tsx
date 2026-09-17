import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useBooks } from '../../context/BooksProvider';
import { signedBalance } from '../../engine/chartOfAccounts';
import { todayISO } from '../../core/money';
import { Card, IconBtn, Money, PageShell, Status } from '../../ui';

export default function MonthEndClose() {
  const books = useBooks();
  const { accounts, documents, bankTxns, periods, journals, assets, can, close, reopen, currency } = books;
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  const openPeriods = periods.filter((p) => p.status === 'open').sort((a, b) => `${b.year}-${String(b.month).padStart(2, '0')}`.localeCompare(`${a.year}-${String(a.month).padStart(2, '0')}`));
  const debit = accounts.reduce((s, a) => s + a.debitTotalMinor, 0);
  const credit = accounts.reduce((s, a) => s + a.creditTotalMinor, 0);
  const overdue = documents.filter((d) => d.kind === 'invoice' && d.status === 'posted' && d.dueDate && d.dueDate < todayISO() && d.paidMinor < d.totalMinor);
  const unpaidBills = documents.filter((d) => d.kind === 'bill' && d.status === 'posted' && d.paidMinor < d.totalMinor);
  const unrec = bankTxns.filter((t) => !t.reconciled);
  const drafts = documents.filter((d) => d.status === 'draft');
  const posted = journals.filter((j) => j.status === 'posted').length;

  const steps = useMemo(() => [
    { id: 'bank', label: 'Bank reconciliation', ok: unrec.length === 0, href: '/books/banking', detail: unrec.length === 0 ? 'All bank journals marked reconciled' : `${unrec.length} unreconciled — open Banking and clear the statement difference` },
    { id: 'ar', label: 'AR review', ok: overdue.length === 0, href: '/books/collections', detail: overdue.length === 0 ? 'No overdue posted invoices' : `${overdue.length} overdue` },
    { id: 'ap', label: 'AP review', ok: unpaidBills.length === 0, href: '/books/payment-run', detail: unpaidBills.length === 0 ? 'No open posted bills' : `${unpaidBills.length} unpaid` },
    { id: 'drafts', label: 'Draft documents', ok: drafts.length === 0, href: '/books/invoices', detail: drafts.length === 0 ? 'No drafts' : `${drafts.length} still draft` },
    { id: 'tb', label: 'Trial balance', ok: debit === credit, href: '/books/reports', detail: debit === credit ? 'Debits equal credits' : 'Books are out of balance' },
    { id: 'assets', label: 'Depreciation', ok: true, href: '/books/assets', detail: `${assets.length} asset(s) on the register` },
    { id: 'journals', label: 'Posted journals', ok: posted > 0, href: '/books/journals', detail: `${posted} posted` },
  ], [assets.length, credit, debit, drafts.length, overdue.length, posted, unpaidBills.length, unrec.length]);

  const blockers = steps.filter((s) => !s.ok).length;
  const current = openPeriods[0];

  return (
    <PageShell title="Month-End Close" subtitle="Checklist is computed from posted books. Closing a period rejects later unauthorized posting.">
      {error && <p className="text-sm text-rose-600">{error}</p>}
      <div className="grid sm:grid-cols-3 gap-3">
        <Card className="p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Open periods</p>
          <p className="font-display text-2xl mt-1">{openPeriods.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Blockers</p>
          <p className="font-display text-2xl mt-1">{blockers}</p>
        </Card>
        <Card className="p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Net cash</p>
          <p className="font-display text-2xl mt-1">
            <Money minor={accounts.filter((a) => a.systemKey === 'cash' || a.systemKey === 'bank').reduce((s, a) => s + signedBalance(a), 0)} currency={currency} />
          </p>
        </Card>
      </div>
      <Card>
        <ul className="divide-y divide-slate-100">
          {steps.map((step) => (
            <li key={step.id} className="px-4 py-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-[#0B1F3A]">{step.label}</p>
                <p className="text-xs text-slate-500">{step.detail}</p>
              </div>
              <div className="flex items-center gap-2">
                <Status value={step.ok ? 'ok' : 'review'} />
                <Link to={step.href} className="byjan-btn-ghost h-8 text-xs">Open</Link>
              </div>
            </li>
          ))}
        </ul>
      </Card>
      {current && (
        <Card className="p-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold">Current period {current.year}-{String(current.month).padStart(2, '0')}</p>
            <p className="text-xs text-slate-500">Close only after blockers are cleared, or an owner can still close with remaining review items.</p>
          </div>
          {can('close_period') && (
            <IconBtn
              action="post"
              disabled={busy === current.id}
              onClick={async () => {
                try {
                  setBusy(current.id);
                  setError('');
                  await close(current.id);
                } catch (err: any) {
                  setError(err.message || 'Close failed');
                } finally {
                  setBusy('');
                }
              }}
            >
              {busy === current.id ? 'Closing…' : 'Close period'}
            </IconBtn>
          )}
        </Card>
      )}
      <Card>
        <div className="px-4 py-3 border-b border-slate-100 text-sm font-semibold">All periods</div>
        <ul className="divide-y divide-slate-100">
          {periods.sort((a, b) => `${b.year}-${b.month}`.localeCompare(`${a.year}-${a.month}`)).map((p) => (
            <li key={p.id} className="px-4 py-2.5 flex items-center justify-between text-sm">
              <span>{p.year}-{String(p.month).padStart(2, '0')}</span>
              <div className="flex items-center gap-2">
                <Status value={p.status} />
                {p.status === 'closed' && can('close_period') && (
                  <button
                    type="button"
                    className="byjan-btn-ghost h-8 text-xs"
                    onClick={() => void reopen(p.id).catch((err) => setError(err.message))}
                  >
                    Reopen
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      </Card>
    </PageShell>
  );
}

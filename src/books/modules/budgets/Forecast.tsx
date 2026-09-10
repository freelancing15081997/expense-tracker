import React from 'react';
import { useBooks } from '../../context/BooksProvider';
import { signedBalance } from '../../engine/chartOfAccounts';
import { todayISO } from '../../core/money';
import { Card, Money, PageShell } from '../../ui';

export default function Forecast() {
  const { accounts, documents, currency } = useBooks();
  const cash = accounts.filter((a) => a.systemKey === 'cash' || a.systemKey === 'bank').reduce((s, a) => s + signedBalance(a), 0);
  const ar = documents.filter((d) => d.kind === 'invoice' && (d.status === 'posted') && d.paidMinor < d.totalMinor)
    .reduce((s, d) => s + (d.totalMinor - d.paidMinor), 0);
  const ap = documents.filter((d) => d.kind === 'bill' && d.status === 'posted' && d.paidMinor < d.totalMinor)
    .reduce((s, d) => s + (d.totalMinor - d.paidMinor), 0);
  const dueSoon = documents.filter((d) => d.kind === 'bill' && d.status === 'posted' && d.dueDate && d.dueDate <= todayISO() && d.paidMinor < d.totalMinor)
    .reduce((s, d) => s + (d.totalMinor - d.paidMinor), 0);
  const projected = cash + ar - ap;

  return (
    <PageShell title="Cash Forecast" subtitle="Projection = posted cash + unpaid posted invoices − unpaid posted bills. Recurring payroll and tax are not invented.">
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="p-4"><p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Cash now</p><p className="font-display text-xl mt-1"><Money minor={cash} currency={currency} /></p></Card>
        <Card className="p-4"><p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Unpaid invoices</p><p className="font-display text-xl mt-1"><Money minor={ar} currency={currency} /></p></Card>
        <Card className="p-4"><p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Unpaid bills</p><p className="font-display text-xl mt-1"><Money minor={ap} currency={currency} /></p></Card>
        <Card className="p-4"><p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Projected cash</p><p className="font-display text-xl mt-1"><Money minor={projected} currency={currency} /></p></Card>
      </div>
      <Card className="p-4 text-sm text-slate-600">
        Bills already due: <Money minor={dueSoon} currency={currency} />. This is a working-capital projection from posted AR/AP, not a bank feed forecast.
      </Card>
    </PageShell>
  );
}

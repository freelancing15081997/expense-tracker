import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useBooks } from '../../context/BooksProvider';
import { btnGhost, btnPrimary, Card, Empty, Field, FileField, inputClass, PageShell, Status } from '../../ui';
import { PagedTable } from '../../ui/PagedList';

export default function Workbench() {
  const books = useBooks();
  const { accounts, documents, journals, periods, bankTxns, workpapers, can, close, reopen } = books;
  const [title, setTitle] = useState('');
  const [periodId, setPeriodId] = useState(periods[0]?.id || '');
  const [notes, setNotes] = useState('');
  const [pending, setPending] = useState<File | null>(null);
  const [error, setError] = useState('');

  const health = useMemo(() => {
    const debit = accounts.reduce((s, a) => s + a.debitTotalMinor, 0);
    const credit = accounts.reduce((s, a) => s + a.creditTotalMinor, 0);
    const drafts = documents.filter((d) => d.status === 'draft').length;
    const overdue = documents.filter((d) => d.kind === 'invoice' && d.status === 'posted' && d.dueDate && d.paidMinor < d.totalMinor).length;
    const unrec = bankTxns.filter((t) => !t.reconciled).length;
    const openPeriods = periods.filter((p) => p.status === 'open').length;
    return [
      { label: 'Trial balance', ok: debit === credit, detail: debit === credit ? 'Balanced' : 'Unbalanced' },
      { label: 'Draft documents', ok: drafts === 0, detail: String(drafts) },
      { label: 'Overdue invoices', ok: overdue === 0, detail: String(overdue) },
      { label: 'Unreconciled bank', ok: unrec === 0, detail: String(unrec) },
      { label: 'Open periods', ok: openPeriods > 0, detail: String(openPeriods) },
      { label: 'Posted journals', ok: true, detail: String(journals.filter((j) => j.status === 'posted').length) },
    ];
  }, [accounts, bankTxns, documents, journals, periods]);

  const queue = documents.filter((d) => d.status === 'draft').slice(0, 12);

  return (
    <PageShell title="CA Workbench" subtitle="Month-end close, review queue, and workpapers. Every check is from posted books.">
      <div className="grid md:grid-cols-3 gap-3">
        {health.map((item) => (
          <Card key={item.label} className={`p-4 ${item.ok ? '' : 'border-amber-300'}`}>
            <p className="text-xs uppercase tracking-wide text-slate-500 font-semibold">{item.label}</p>
            <p className={`mt-2 text-lg font-semibold ${item.ok ? 'text-emerald-700' : 'text-amber-800'}`}>{item.detail}</p>
          </Card>
        ))}
      </div>
      <Card className="p-4">
        <h2 className="font-semibold mb-3">Periods</h2>
        <ul className="space-y-2">
          {periods.sort((a, b) => b.id.localeCompare(a.id)).map((period) => (
            <li key={period.id} className="flex items-center justify-between text-sm">
              <span>{period.id}</span>
              <span className="flex items-center gap-2">
                <Status value={period.status} />
                {period.status === 'open' && can('close_period') && <button className="underline" onClick={() => close(period.id)}>Close</button>}
                {period.status === 'closed' && can('close_period') && <button className="underline" onClick={() => reopen(period.id)}>Reopen</button>}
              </span>
            </li>
          ))}
        </ul>
      </Card>
      <Card>
        <div className="px-4 py-3 border-b border-slate-100 flex justify-between">
          <h2 className="font-semibold">Review queue</h2>
          <Link to="/books/invoices" className="text-sm text-slate-500">Documents</Link>
        </div>
        {queue.length === 0 ? <Empty text="No draft documents waiting." /> : (
          <ul className="divide-y divide-slate-100">
            {queue.map((row) => (
              <li key={row.id} className="px-4 py-3 flex justify-between text-sm">
                <span>{row.number} · {row.kind}</span>
                <Status value={row.status} />
              </li>
            ))}
          </ul>
        )}
      </Card>
      {can('create') && (
        <Card className="p-4 space-y-3">
          <h2 className="font-semibold">Workpaper</h2>
          <form
            className="grid md:grid-cols-3 gap-3"
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                setError('');
                let filePath: string | null = null;
                if (pending) {
                  const stored = await books.uploadFile({ domain: 'workpaper', file: pending });
                  filePath = stored.path;
                }
                await books.createWorkpaper({ title, periodId, notes, filePath });
                setTitle('');
                setNotes('');
                setPending(null);
              } catch (err: any) {
                setError(err.message);
              }
            }}
          >
            <Field label="Title"><input className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} required /></Field>
            <Field label="Period"><input className={inputClass} value={periodId} onChange={(e) => setPeriodId(e.target.value)} required /></Field>
            <Field label="Notes"><input className={inputClass} value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
            <FileField
              label="Supporting file"
              accept=".pdf,image/png,image/jpeg,image/webp,.xlsx,.csv"
              hint={pending ? pending.name : 'Optional workpaper attachment. 8 MB max.'}
              onFiles={(files) => setPending(files[0] || null)}
            />
            <button className={btnPrimary}>Save workpaper</button>
            {error && <p className="text-sm text-rose-600">{error}</p>}
          </form>
        </Card>
      )}
      <PagedTable rows={workpapers} empty="No workpapers." minWidth="min-w-[560px]">
        {(slice) => (
          <ul className="divide-y divide-slate-100">
            {slice.map((row) => (
              <li key={row.id} className="px-4 py-3 flex items-center justify-between gap-3 text-sm">
                <div>
                  <p className="font-medium">{row.title}</p>
                  <p className="text-slate-500">{row.periodId} · {row.notes}{row.filePath ? ' · file attached' : ''}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Status value={row.status} />
                  {row.status === 'open' && can('post') && (
                    <button className={btnGhost} onClick={() => books.markWorkpaperReviewed(row.id)}>Review</button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </PagedTable>
    </PageShell>
  );
}

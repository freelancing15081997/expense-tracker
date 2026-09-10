import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useBooks } from '../../context/BooksProvider';
import { btnGhost, btnPrimary, Card, Empty, Field, FileField, IconBtn, inputClass, PageShell, RecordFlyout, Status } from '../../ui';
import { PagedTable } from '../../ui/PagedList';
import type { Workpaper } from '../../core/types';

export default function Workbench() {
  const books = useBooks();
  const { accounts, documents, journals, periods, bankTxns, workpapers, entities, can, close, reopen } = books;
  const [title, setTitle] = useState('');
  const [periodId, setPeriodId] = useState(() => sessionStorage.getItem('byjan_wb_period') || '');
  const [entityId, setEntityId] = useState(() => sessionStorage.getItem('byjan_wb_entity') || '');
  const [notes, setNotes] = useState('');
  const [pending, setPending] = useState<File | null>(null);
  const [error, setError] = useState('');
  const [selectedPaper, setSelectedPaper] = useState<Workpaper | null>(null);

  useEffect(() => {
    if (!periodId && periods[0]) setPeriodId(periods[0].id);
    if (!entityId && entities[0]) setEntityId(entities.find((e) => e.isDefault)?.id || entities[0].id);
  }, [entityId, entities, periodId, periods]);

  useEffect(() => {
    if (periodId) sessionStorage.setItem('byjan_wb_period', periodId);
    if (entityId) sessionStorage.setItem('byjan_wb_entity', entityId);
  }, [entityId, periodId]);

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

  const queue = documents.filter((d) => {
    if (d.status !== 'draft') return false;
    if (!periodId) return true;
    return d.date.startsWith(periodId.slice(0, 7));
  }).slice(0, 12);
  const papers = workpapers.filter((w) => !periodId || w.periodId === periodId);
  const currentEntity = entities.find((e) => e.id === entityId) || entities.find((e) => e.isDefault) || entities[0];

  return (
    <PageShell title="CA Workbench" subtitle="Your month-end close desk. Switch period (and entity, if you have more than one) to review a different close.">
      <Card className="p-4">
        <div className="grid md:grid-cols-2 gap-3">
          <Field label="Working period">
            <select
              className={inputClass}
              value={periodId}
              onChange={(e) => setPeriodId(e.target.value)}
            >
              {periods.length === 0 && <option value="">No periods yet</option>}
              {periods.sort((a, b) => b.id.localeCompare(a.id)).map((period) => (
                <option key={period.id} value={period.id}>{period.id} · {period.status}</option>
              ))}
            </select>
          </Field>
          <Field label="Entity / books">
            <select
              className={inputClass}
              value={entityId}
              onChange={(e) => setEntityId(e.target.value)}
            >
              {entities.length === 0 && <option value="">This workspace</option>}
              {entities.map((entity) => (
                <option key={entity.id} value={entity.id}>{entity.name}{entity.isDefault ? ' (default)' : ''}</option>
              ))}
            </select>
          </Field>
        </div>
        <p className="text-xs text-slate-500 mt-2">
          CA Workbench is for closing {currentEntity?.name || 'this workspace'} for the selected month: trial balance, draft documents, bank rec, and workpapers. Use the switches above to move from one close to another. Day-to-day invoicing stays in Sales / Purchases.
        </p>
      </Card>
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
              files={pending}
              hint={pending ? pending.name : 'Optional workpaper attachment. 8 MB max.'}
              onFiles={(files) => setPending(files[0] || null)}
            />
            <IconBtn action="save">Save workpaper</IconBtn>
            {error && <p className="text-sm text-rose-600">{error}</p>}
          </form>
        </Card>
      )}
      <PagedTable<Workpaper> rows={papers} empty="No workpapers for this period." minWidth="min-w-[560px]">
        {(slice) => (
          <ul className="divide-y divide-slate-100">
            {slice.map((row) => (
              <li key={row.id} className="px-4 py-3 flex items-center justify-between gap-3 text-sm cursor-pointer hover:bg-slate-50" onClick={() => setSelectedPaper(row)}>
                <div>
                  <p className="font-medium">{row.title}</p>
                  <p className="text-slate-500">{row.periodId} · {row.notes}{row.filePath ? ' · file attached' : ''}</p>
                </div>
                <Status value={row.status} />
              </li>
            ))}
          </ul>
        )}
      </PagedTable>
      {selectedPaper && (
        <RecordFlyout
          title={selectedPaper.title}
          subtitle={`Workpaper · ${selectedPaper.periodId}`}
          onClose={() => setSelectedPaper(null)}
          actions={selectedPaper.status === 'open' && can('post') ? (
            <button className={btnGhost} onClick={() => { books.markWorkpaperReviewed(selectedPaper.id); setSelectedPaper(null); }}>Review</button>
          ) : null}
        >
          <p className="text-sm text-slate-600">{selectedPaper.notes || 'No notes'}</p>
          <Status value={selectedPaper.status} />
          {selectedPaper.filePath ? <p className="text-sm">Supporting file is attached to this workpaper.</p> : <p className="text-sm text-slate-500">No supporting file.</p>}
        </RecordFlyout>
      )}
    </PageShell>
  );
}

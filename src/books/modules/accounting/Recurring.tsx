import React, { useState } from 'react';
import { useBooks } from '../../context/BooksProvider';
import { parseMoney, todayISO } from '../../core/money';
import { btnGhost, btnPrimary, Card, Field, inputClass, PageShell } from '../../ui';
import { PagedTable } from '../../ui/PagedList';
import type { JournalLineInput } from '../../core/types';

const emptyLine = () => ({ accountId: '', debit: '', credit: '' });

export default function Recurring() {
  const { recurring, postingAccounts, can, createRecurring, runRecurringTemplate } = useBooks();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [lines, setLines] = useState([emptyLine(), emptyLine()]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  return (
    <PageShell
      title="Recurring Journals"
      subtitle="Save a balanced template and run it. Each run posts a new immutable journal."
      actions={can('create') && <button className={btnPrimary} onClick={() => setOpen(true)}>New template</button>}
    >
      {open && (
        <Card className="p-4 space-y-3">
          <form
            className="space-y-3"
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                setBusy(true);
                setError('');
                const parsed: JournalLineInput[] = lines.map((line) => ({
                  accountId: line.accountId,
                  debitMinor: line.debit ? parseMoney(line.debit) : 0,
                  creditMinor: line.credit ? parseMoney(line.credit) : 0,
                }));
                await createRecurring({ name, description, lines: parsed });
                setOpen(false);
                setName('');
                setDescription('');
                setLines([emptyLine(), emptyLine()]);
              } catch (err: any) {
                setError(err.message || 'Could not save template');
              } finally {
                setBusy(false);
              }
            }}
          >
            <div className="grid md:grid-cols-2 gap-3">
              <Field label="Name"><input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} required /></Field>
              <Field label="Description"><input className={inputClass} value={description} onChange={(e) => setDescription(e.target.value)} /></Field>
            </div>
            {lines.map((line, i) => (
              <div key={i} className="grid md:grid-cols-3 gap-2">
                <select className={inputClass} value={line.accountId} onChange={(e) => setLines((rows) => rows.map((r, idx) => idx === i ? { ...r, accountId: e.target.value } : r))}>
                  <option value="">Account</option>
                  {postingAccounts.map((a) => <option key={a.id} value={a.id}>{a.code} {a.name}</option>)}
                </select>
                <input className={inputClass} placeholder="Debit" value={line.debit} onChange={(e) => setLines((rows) => rows.map((r, idx) => idx === i ? { ...r, debit: e.target.value, credit: '' } : r))} />
                <input className={inputClass} placeholder="Credit" value={line.credit} onChange={(e) => setLines((rows) => rows.map((r, idx) => idx === i ? { ...r, credit: e.target.value, debit: '' } : r))} />
              </div>
            ))}
            <div className="flex gap-2 items-center">
              <button type="button" className={btnGhost} onClick={() => setLines((rows) => [...rows, emptyLine()])}>Add line</button>
              <button className={btnPrimary} disabled={busy}>Save template</button>
              <button type="button" className={btnGhost} onClick={() => setOpen(false)}>Cancel</button>
              {error && <p className="text-sm text-rose-600">{error}</p>}
            </div>
          </form>
        </Card>
      )}
      <PagedTable rows={recurring} empty="No recurring templates yet." minWidth="min-w-[560px]">
        {(slice) => (
          <ul className="divide-y divide-slate-100">
            {slice.map((row) => (
              <li key={row.id} className="px-4 py-3 flex items-center justify-between gap-3 text-sm">
                <div>
                  <p className="font-medium">{row.name}</p>
                  <p className="text-slate-500">{row.description || 'No description'}{row.lastRunAt ? ` · last run ${row.lastRunAt.slice(0, 10)}` : ''}</p>
                </div>
                {can('post') && (
                  <button className={btnPrimary} onClick={() => runRecurringTemplate(row, todayISO())}>Run now</button>
                )}
              </li>
            ))}
          </ul>
        )}
      </PagedTable>
    </PageShell>
  );
}

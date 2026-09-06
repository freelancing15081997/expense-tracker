import React, { useState } from 'react';
import { useBooks } from '../../context/BooksProvider';
import { btnGhost, btnPrimary, Card, Field, inputClass, PageShell, Status } from '../../ui';
import { PagedTable } from '../../ui/PagedList';

export default function Approvals() {
  const books = useBooks();
  const { approvals, documents, can } = books;
  const [title, setTitle] = useState('');
  const [resourceId, setResourceId] = useState(documents[0]?.id || '');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  return (
    <PageShell title="Approvals" subtitle="Human approve/reject only. An approval does not post a journal by itself — posting stays on the document or journal screen.">
      {can('create') && (
        <Card className="p-4">
          <form
            className="grid md:grid-cols-3 gap-3"
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                setError('');
                const doc = documents.find((d) => d.id === resourceId);
                await books.createApproval({
                  title: title || `Approve ${doc?.number || 'item'}`,
                  resource: 'document',
                  resourceId,
                  notes,
                });
                setTitle('');
                setNotes('');
              } catch (err: any) {
                setError(err.message);
              }
            }}
          >
            <Field label="Title"><input className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
            <Field label="Document">
              <select className={inputClass} value={resourceId} onChange={(e) => setResourceId(e.target.value)}>
                <option value="">Select</option>
                {documents.filter((d) => d.status === 'draft').map((d) => <option key={d.id} value={d.id}>{d.number}</option>)}
              </select>
            </Field>
            <Field label="Notes"><input className={inputClass} value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
            <button className={btnPrimary}>Request approval</button>
            {error && <p className="text-sm text-rose-600">{error}</p>}
          </form>
        </Card>
      )}
      <PagedTable rows={approvals} empty="No approval requests." minWidth="min-w-[560px]">
        {(slice) => (
          <ul className="divide-y divide-slate-100">
            {slice.map((row) => (
              <li key={row.id} className="px-4 py-3 flex items-center justify-between gap-3 text-sm">
                <div>
                  <p className="font-medium">{row.title}</p>
                  <p className="text-slate-500">{row.notes || row.resource}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Status value={row.status} />
                  {row.status === 'pending' && can('post') && (
                    <>
                      <button className={btnPrimary} onClick={() => books.decide(row.id, 'approved')}>Approve</button>
                      <button className={btnGhost} onClick={() => books.decide(row.id, 'rejected')}>Reject</button>
                    </>
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

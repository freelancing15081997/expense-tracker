import React, { useState } from 'react';
import { useBooks } from '../../context/BooksProvider';
import { booksFileUrl } from '../../storage/adapter';
import { btnGhost, btnPrimary, Card, Field, FileField, inputClass, PageShell, Status } from '../../ui';
import { PagedTable } from '../../ui/PagedList';
import type { InboxItem } from '../../core/types';

export default function Inbox() {
  const books = useBooks();
  const { inbox, can } = books;
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState<InboxItem['kind']>('receipt');
  const [notes, setNotes] = useState('');
  const [pending, setPending] = useState<File | null>(null);
  const [error, setError] = useState('');

  return (
    <PageShell title="Document Inbox" subtitle="Capture supporting documents as files plus metadata. OCR is not connected — nothing here pretends to extract or post.">
      {can('create') && (
        <Card className="p-4">
          <form
            className="grid md:grid-cols-2 gap-3"
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                setError('');
                let filePath: string | null = null;
                if (pending) {
                  const stored = await books.uploadFile({ domain: 'inbox', file: pending });
                  filePath = stored.path;
                }
                await books.createInbox({ title, kind, notes, filePath });
                setTitle('');
                setNotes('');
                setPending(null);
              } catch (err: any) {
                setError(err.message);
              }
            }}
          >
            <Field label="Title"><input className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} required /></Field>
            <Field label="Kind">
              <select className={inputClass} value={kind} onChange={(e) => setKind(e.target.value as InboxItem['kind'])}>
                <option value="receipt">Receipt</option>
                <option value="invoice">Invoice</option>
                <option value="bill">Bill</option>
                <option value="contract">Contract</option>
                <option value="other">Other</option>
              </select>
            </Field>
            <Field label="Notes"><input className={inputClass} value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
            <FileField
              label="Source file"
              accept=".pdf,image/png,image/jpeg,image/webp"
              hint={pending ? pending.name : 'Receipt, invoice scan, or contract. 8 MB max.'}
              onFiles={(files) => setPending(files[0] || null)}
            />
            <div className="md:col-span-2 flex items-center gap-2">
              <button className={btnPrimary}>Add to inbox</button>
              {error && <p className="text-sm text-rose-600">{error}</p>}
            </div>
          </form>
        </Card>
      )}
      <PagedTable rows={inbox} empty="Inbox is empty." minWidth="min-w-[560px]">
        {(slice) => (
          <ul className="divide-y divide-slate-100">
            {slice.map((row) => (
              <li key={row.id} className="px-4 py-3 flex items-center justify-between gap-3 text-sm">
                <div className="min-w-0">
                  <p className="font-medium truncate">{row.title}</p>
                  <p className="text-slate-500 capitalize">{row.kind} · {row.notes || 'No notes'}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {row.filePath && (
                    <button className={btnGhost} onClick={async () => window.open(await booksFileUrl(row.filePath!), '_blank', 'noopener')}>Open file</button>
                  )}
                  <Status value={row.status} />
                  {row.status === 'open' && can('edit') && (
                    <button className={btnGhost} onClick={() => books.markInboxLinked(row.id)}>Mark linked</button>
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

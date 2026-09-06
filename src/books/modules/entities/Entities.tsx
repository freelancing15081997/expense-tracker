import React, { useState } from 'react';
import { useBooks } from '../../context/BooksProvider';
import { btnPrimary, Card, Field, inputClass, PageShell } from '../../ui';
import { PagedTable } from '../../ui/PagedList';

export default function Entities() {
  const { entities, can, createEntity } = useBooks();
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  return (
    <PageShell title="Legal Entities" subtitle="Register additional entities. Consolidation and intercompany elimination are adapters — they do not invent group balances.">
      {can('manage_settings') && (
        <Card className="p-4">
          <form
            className="flex flex-wrap gap-3 items-end"
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                setError('');
                await createEntity(name);
                setName('');
              } catch (err: any) {
                setError(err.message || 'Could not add entity');
              }
            }}
          >
            <Field label="Entity name"><input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} required /></Field>
            <button className={btnPrimary}>Add entity</button>
            {error && <p className="text-sm text-rose-600">{error}</p>}
          </form>
        </Card>
      )}
      <PagedTable rows={entities} empty="No entities." minWidth="min-w-[480px]">
        {(slice) => (
          <ul className="divide-y divide-slate-100">
            {slice.map((row) => (
              <li key={row.id} className="px-4 py-3 flex justify-between text-sm">
                <span className="font-medium">{row.name}</span>
                <span className="text-slate-500">{row.country}{row.isDefault ? ' · default' : ''}</span>
              </li>
            ))}
          </ul>
        )}
      </PagedTable>
    </PageShell>
  );
}

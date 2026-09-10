import React, { useState } from 'react';
import { useBooks } from '../../context/BooksProvider';
import { Card, Field, IconBtn, inputClass, PageShell } from '../../ui';
import { PagedTable } from '../../ui/PagedList';
import type { FinanceEntity } from '../../core/types';

export default function Entities() {
  const { entities, can, createEntity } = useBooks();
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  return (
    <PageShell title="Legal Entities" subtitle="Register legal entities inside the open company. A subsidiary with its own books is created under Companies, not here. Consolidation does not invent group balances.">
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
            <IconBtn action="create">Add entity</IconBtn>
            {error && <p className="text-sm text-rose-600">{error}</p>}
          </form>
        </Card>
      )}
      <PagedTable<FinanceEntity> rows={entities} empty="No entities." minWidth="min-w-[480px]">
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

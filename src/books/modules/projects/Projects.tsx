import React, { useMemo, useState } from 'react';
import { useBooks } from '../../context/BooksProvider';
import { parseMoney } from '../../core/money';
import { btnGhost, btnPrimary, Card, Field, inputClass, Money, PageShell, Status } from '../../ui';
import { PagedTable } from '../../ui/PagedList';

export default function Projects() {
  const books = useBooks();
  const { projects, parties, documents, currency, can } = books;
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [budget, setBudget] = useState('');
  const [error, setError] = useState('');

  const spendByProject = useMemo(() => {
    const map = new Map<string, number>();
    for (const doc of documents) {
      if (!doc.projectId || doc.status === 'voided' || doc.status === 'draft') continue;
      map.set(doc.projectId, (map.get(doc.projectId) || 0) + doc.totalMinor);
    }
    return map;
  }, [documents]);

  return (
    <PageShell
      title="Projects"
      subtitle="Project spend is the posted documents tagged to the project. No estimated WIP is invented."
      actions={can('create') && <button className={btnPrimary} onClick={() => setOpen(true)}>New project</button>}
    >
      {open && (
        <Card className="p-4">
          <form
            className="grid md:grid-cols-3 gap-3"
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                setError('');
                await books.createProject({
                  name,
                  customerId: customerId || null,
                  status: 'open',
                  budgetMinor: budget ? parseMoney(budget) : 0,
                });
                setOpen(false);
                setName('');
                setBudget('');
              } catch (err: any) {
                setError(err.message || 'Could not save');
              }
            }}
          >
            <Field label="Name"><input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} required /></Field>
            <Field label="Customer">
              <select className={inputClass} value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
                <option value="">None</option>
                {parties.filter((p) => p.kind === 'customer' && p.active).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </Field>
            <Field label={`Budget (${currency})`}><input className={inputClass} value={budget} onChange={(e) => setBudget(e.target.value)} /></Field>
            <div className="flex items-end gap-2">
              <button className={btnPrimary}>Save</button>
              <button type="button" className={btnGhost} onClick={() => setOpen(false)}>Cancel</button>
            </div>
            {error && <p className="text-sm text-rose-600 md:col-span-3">{error}</p>}
          </form>
        </Card>
      )}
      <PagedTable rows={projects} empty="No projects yet.">
        {(slice) => (
          <table className="w-full text-sm">
            <thead className="text-left text-slate-500 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 font-medium">Project</th>
                <th className="px-4 py-3 font-medium">Customer</th>
                <th className="px-4 py-3 font-medium text-right">Budget</th>
                <th className="px-4 py-3 font-medium text-right">Posted spend</th>
                <th className="px-4 py-3 font-medium text-right">Remaining</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {slice.map((row) => {
                const spend = spendByProject.get(row.id) || 0;
                const customer = parties.find((p) => p.id === row.customerId);
                return (
                  <tr key={row.id} className="border-b border-slate-100">
                    <td className="px-4 py-2.5 font-medium">{row.name}</td>
                    <td className="px-4 py-2.5">{customer?.name || '—'}</td>
                    <td className="px-4 py-2.5 text-right"><Money minor={row.budgetMinor} currency={currency} /></td>
                    <td className="px-4 py-2.5 text-right"><Money minor={spend} currency={currency} /></td>
                    <td className="px-4 py-2.5 text-right"><Money minor={row.budgetMinor - spend} currency={currency} /></td>
                    <td className="px-4 py-2.5"><Status value={row.status} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </PagedTable>
    </PageShell>
  );
}

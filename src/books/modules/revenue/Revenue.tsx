import React, { useState } from 'react';
import { useBooks } from '../../context/BooksProvider';
import { parseMoney } from '../../core/money';
import { btnGhost, btnPrimary, Card, Field, inputClass, Money, PageShell, Status } from '../../ui';
import { PagedTable } from '../../ui/PagedList';

export default function Revenue() {
  const books = useBooks();
  const { contracts, parties, postingAccounts, currency, can } = books;
  const cash = postingAccounts.filter((a) => a.systemKey === 'cash' || a.systemKey === 'bank');
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [total, setTotal] = useState('');
  const [months, setMonths] = useState('12');
  const [cashAccountId, setCash] = useState(cash[0]?.id || '');
  const [error, setError] = useState('');

  return (
    <PageShell
      title="Revenue Recognition"
      subtitle="Cash received credits Deferred Revenue. Recognize posts Deferred Dr / Sales Cr for one month of the contract."
      actions={can('create') && <button className={btnPrimary} onClick={() => setOpen(true)}>New contract</button>}
    >
      {open && (
        <Card className="p-4">
          <form
            className="grid md:grid-cols-3 gap-3"
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                setError('');
                await books.createContract({
                  name,
                  customerId: customerId || null,
                  totalMinor: parseMoney(total),
                  months: Number(months),
                  cashAccountId,
                });
                setOpen(false);
                setName('');
                setTotal('');
              } catch (err: any) {
                setError(err.message || 'Could not save');
              }
            }}
          >
            <Field label="Name"><input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} required /></Field>
            <Field label="Customer">
              <select className={inputClass} value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
                <option value="">None</option>
                {parties.filter((p) => p.kind === 'customer').map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </Field>
            <Field label={`Prepaid total (${currency})`}><input className={inputClass} value={total} onChange={(e) => setTotal(e.target.value)} required /></Field>
            <Field label="Months"><input className={inputClass} value={months} onChange={(e) => setMonths(e.target.value)} required /></Field>
            <Field label="Cash / bank">
              <select className={inputClass} value={cashAccountId} onChange={(e) => setCash(e.target.value)}>
                {cash.map((a) => <option key={a.id} value={a.id}>{a.code} {a.name}</option>)}
              </select>
            </Field>
            <div className="flex items-end gap-2">
              <button className={btnPrimary}>Post receipt</button>
              <button type="button" className={btnGhost} onClick={() => setOpen(false)}>Cancel</button>
            </div>
            {error && <p className="text-sm text-rose-600 md:col-span-3">{error}</p>}
          </form>
        </Card>
      )}
      <PagedTable rows={contracts} empty="No revenue contracts.">
        {(slice) => (
          <table className="w-full text-sm">
            <thead className="text-left text-slate-500 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 font-medium">Contract</th>
                <th className="px-4 py-3 font-medium text-right">Total</th>
                <th className="px-4 py-3 font-medium text-right">Recognized</th>
                <th className="px-4 py-3 font-medium text-right">Deferred</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {slice.map((row) => (
                <tr key={row.id} className="border-b border-slate-100">
                  <td className="px-4 py-2.5 font-medium">{row.name}</td>
                  <td className="px-4 py-2.5 text-right"><Money minor={row.totalMinor} currency={currency} /></td>
                  <td className="px-4 py-2.5 text-right"><Money minor={row.recognizedMinor} currency={currency} /></td>
                  <td className="px-4 py-2.5 text-right"><Money minor={row.totalMinor - row.recognizedMinor} currency={currency} /></td>
                  <td className="px-4 py-2.5"><Status value={row.status} /></td>
                  <td className="px-4 py-2.5 text-right">
                    {row.status === 'open' && can('post') && (
                      <button className={btnPrimary} onClick={() => books.recognize(row).catch((err) => setError(err.message))}>Recognize month</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </PagedTable>
      {error && <p className="text-sm text-rose-600">{error}</p>}
    </PageShell>
  );
}

import React, { useState } from 'react';
import { useBooks } from '../../context/BooksProvider';
import { parseMoney } from '../../core/money';
import { btnGhost, btnPrimary, Card, Field, inputClass, Money, PageShell, Status } from '../../ui';
import { PagedTable } from '../../ui/PagedList';

export default function Leases() {
  const books = useBooks();
  const { leases, parties, postingAccounts, currency, can } = books;
  const cash = postingAccounts.filter((a) => a.systemKey === 'cash' || a.systemKey === 'bank');
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [vendorId, setVendorId] = useState('');
  const [monthly, setMonthly] = useState('');
  const [months, setMonths] = useState('12');
  const [payAccountId, setPay] = useState(cash[0]?.id || '');
  const [error, setError] = useState('');

  return (
    <PageShell
      title="Leases"
      subtitle="Each payment posts Rent Dr / cash Cr. This is a cash-lease register, not a fake ROU capitalization."
      actions={can('create') && <button className={btnPrimary} onClick={() => setOpen(true)}>New lease</button>}
    >
      {open && (
        <Card className="p-4">
          <form
            className="grid md:grid-cols-3 gap-3"
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                setError('');
                await books.createLease({
                  name,
                  vendorId: vendorId || null,
                  monthlyMinor: parseMoney(monthly),
                  months: Number(months),
                });
                setOpen(false);
                setName('');
                setMonthly('');
              } catch (err: any) {
                setError(err.message || 'Could not save');
              }
            }}
          >
            <Field label="Name"><input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} required /></Field>
            <Field label="Vendor">
              <select className={inputClass} value={vendorId} onChange={(e) => setVendorId(e.target.value)}>
                <option value="">None</option>
                {parties.filter((p) => p.kind === 'vendor').map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </Field>
            <Field label={`Monthly (${currency})`}><input className={inputClass} value={monthly} onChange={(e) => setMonthly(e.target.value)} required /></Field>
            <Field label="Months"><input className={inputClass} value={months} onChange={(e) => setMonths(e.target.value)} required /></Field>
            <div className="flex items-end gap-2">
              <button className={btnPrimary}>Save</button>
              <button type="button" className={btnGhost} onClick={() => setOpen(false)}>Cancel</button>
            </div>
            {error && <p className="text-sm text-rose-600 md:col-span-3">{error}</p>}
          </form>
        </Card>
      )}
      <PagedTable rows={leases} empty="No leases yet.">
        {(slice) => (
          <table className="w-full text-sm">
            <thead className="text-left text-slate-500 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 font-medium">Lease</th>
                <th className="px-4 py-3 font-medium text-right">Monthly</th>
                <th className="px-4 py-3 font-medium">Paid</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {slice.map((row) => (
                <tr key={row.id} className="border-b border-slate-100">
                  <td className="px-4 py-2.5 font-medium">{row.name}</td>
                  <td className="px-4 py-2.5 text-right"><Money minor={row.monthlyMinor} currency={currency} /></td>
                  <td className="px-4 py-2.5">{row.paidMonths} / {row.months}</td>
                  <td className="px-4 py-2.5"><Status value={row.status} /></td>
                  <td className="px-4 py-2.5 text-right">
                    {row.status === 'open' && can('post') && (
                      <div className="flex justify-end gap-2">
                        <select className={`${inputClass} w-40`} value={payAccountId} onChange={(e) => setPay(e.target.value)}>
                          {cash.map((a) => <option key={a.id} value={a.id}>{a.code} {a.name}</option>)}
                        </select>
                        <button className={btnPrimary} onClick={() => books.payLeaseMonth(row, payAccountId).catch((err) => setError(err.message))}>Pay month</button>
                      </div>
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

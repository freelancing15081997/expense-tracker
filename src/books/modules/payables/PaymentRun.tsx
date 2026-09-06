import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useBooks } from '../../context/BooksProvider';
import { todayISO } from '../../core/money';
import { btnPrimary, Card, Field, inputClass, Money, PageShell, Status } from '../../ui';
import { PagedTable } from '../../ui/PagedList';

export default function PaymentRun() {
  const books = useBooks();
  const { documents, parties, postingAccounts, currency, can } = books;
  const open = documents.filter((d) => d.kind === 'bill' && d.status === 'posted' && d.paidMinor < d.totalMinor);
  const cash = postingAccounts.filter((a) => a.systemKey === 'cash' || a.systemKey === 'bank');
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [accountId, setAccountId] = useState(cash[0]?.id || '');
  const [date, setDate] = useState(todayISO());
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');

  const chosen = useMemo(() => open.filter((d) => selected[d.id]), [open, selected]);
  const total = chosen.reduce((s, d) => s + (d.totalMinor - d.paidMinor), 0);

  return (
    <PageShell title="Payment Run" subtitle="Pays selected posted bills through the payment journal. Nothing is estimated.">
      <Card className="p-4 grid md:grid-cols-3 gap-3">
        <Field label="Pay from">
          <select className={inputClass} value={accountId} onChange={(e) => setAccountId(e.target.value)}>
            {cash.map((a) => <option key={a.id} value={a.id}>{a.code} {a.name}</option>)}
          </select>
        </Field>
        <Field label="Date"><input type="date" className={inputClass} value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        <div className="flex items-end justify-between gap-3">
          <p className="text-sm text-[#6b6458]">Selected <Money minor={total} currency={currency} /></p>
          <button
            className={btnPrimary}
            disabled={!can('post') || chosen.length === 0}
            onClick={async () => {
              try {
                setError('');
                setOk('');
                for (const bill of chosen) {
                  await books.payDoc(bill.id, bill.totalMinor - bill.paidMinor, date, accountId);
                }
                setSelected({});
                setOk(`Posted ${chosen.length} payment journal${chosen.length === 1 ? '' : 's'}.`);
              } catch (err: any) {
                setError(err.message || 'Payment run stopped');
              }
            }}
          >
            Post payments
          </button>
        </div>
        {ok && <p className="text-sm text-emerald-800 md:col-span-3">{ok}</p>}
        {error && <p className="text-sm text-rose-700 md:col-span-3">{error}</p>}
      </Card>
      <PagedTable rows={open} empty="No posted bills with a remaining balance.">
        {(slice) => (
          <table className="w-full text-sm">
            <thead className="text-left text-[#7a7368] border-b border-[#e6e0d4]">
              <tr>
                <th className="px-4 py-3"></th>
                <th className="px-4 py-3 font-medium">Bill</th>
                <th className="px-4 py-3 font-medium">Vendor</th>
                <th className="px-4 py-3 font-medium text-right">Due</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {slice.map((row) => (
                <tr key={row.id} className="border-b border-[#f0eadc]">
                  <td className="px-4 py-2.5">
                    <input type="checkbox" checked={!!selected[row.id]} onChange={(e) => setSelected((cur) => ({ ...cur, [row.id]: e.target.checked }))} />
                  </td>
                  <td className="px-4 py-2.5 font-medium"><Link to="/books/bills" className="underline underline-offset-2">{row.number}</Link></td>
                  <td className="px-4 py-2.5">{parties.find((p) => p.id === row.partyId)?.name || '—'}</td>
                  <td className="px-4 py-2.5 text-right"><Money minor={row.totalMinor - row.paidMinor} currency={currency} /></td>
                  <td className="px-4 py-2.5"><Status value={row.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </PagedTable>
    </PageShell>
  );
}

import React, { useState } from 'react';
import { useBooks } from '../../context/BooksProvider';
import { parseMoney } from '../../core/money';
import { btnGhost, btnPrimary, Card, Field, inputClass, Money, PageShell, Status } from '../../ui';
import { PagedTable } from '../../ui/PagedList';

export default function Assets() {
  const books = useBooks();
  const { assets, postingAccounts, currency, can } = books;
  const payAccounts = postingAccounts.filter((a) => a.systemKey === 'cash' || a.systemKey === 'bank' || a.systemKey === 'ap');
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [cost, setCost] = useState('');
  const [life, setLife] = useState('36');
  const [residual, setResidual] = useState('0');
  const [payAccountId, setPay] = useState(payAccounts[0]?.id || '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  return (
    <PageShell
      title="Fixed Assets"
      subtitle="Acquisition posts Asset Dr / pay-from Cr. Depreciation posts Expense Dr / Accumulated Depreciation Cr. Journals are immutable."
      actions={can('create') && <button className={btnPrimary} onClick={() => setOpen(true)}>Acquire asset</button>}
    >
      {open && (
        <Card className="p-4">
          <form
            className="grid md:grid-cols-3 gap-3"
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                setBusy(true);
                setError('');
                await books.createAsset({
                  name,
                  costMinor: parseMoney(cost),
                  lifeMonths: Number(life),
                  residualMinor: residual ? parseMoney(residual) : 0,
                  payAccountId,
                });
                setOpen(false);
                setName('');
                setCost('');
              } catch (err: any) {
                setError(err.message || 'Could not acquire');
              } finally {
                setBusy(false);
              }
            }}
          >
            <Field label="Name"><input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} required /></Field>
            <Field label={`Cost (${currency})`}><input className={inputClass} value={cost} onChange={(e) => setCost(e.target.value)} required /></Field>
            <Field label="Life (months)"><input className={inputClass} value={life} onChange={(e) => setLife(e.target.value)} required /></Field>
            <Field label="Residual"><input className={inputClass} value={residual} onChange={(e) => setResidual(e.target.value)} /></Field>
            <Field label="Pay from">
              <select className={inputClass} value={payAccountId} onChange={(e) => setPay(e.target.value)}>
                {payAccounts.map((a) => <option key={a.id} value={a.id}>{a.code} {a.name}</option>)}
              </select>
            </Field>
            <div className="flex items-end gap-2">
              <button className={btnPrimary} disabled={busy}>{busy ? 'Posting…' : 'Post acquisition'}</button>
              <button type="button" className={btnGhost} onClick={() => setOpen(false)}>Cancel</button>
            </div>
            {error && <p className="text-sm text-rose-600 md:col-span-3">{error}</p>}
          </form>
        </Card>
      )}
      <PagedTable rows={assets} empty="No assets on the register.">
        {(slice) => (
          <table className="w-full text-sm">
            <thead className="text-left text-slate-500 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 font-medium">Asset</th>
                <th className="px-4 py-3 font-medium">Acquired</th>
                <th className="px-4 py-3 font-medium text-right">Cost</th>
                <th className="px-4 py-3 font-medium text-right">Accum. dep.</th>
                <th className="px-4 py-3 font-medium text-right">NBV</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {slice.map((row) => (
                <tr key={row.id} className="border-b border-slate-100">
                  <td className="px-4 py-2.5 font-medium">{row.name}</td>
                  <td className="px-4 py-2.5">{row.acquireDate}</td>
                  <td className="px-4 py-2.5 text-right"><Money minor={row.costMinor} currency={currency} /></td>
                  <td className="px-4 py-2.5 text-right"><Money minor={row.accumDepMinor} currency={currency} /></td>
                  <td className="px-4 py-2.5 text-right"><Money minor={row.costMinor - row.accumDepMinor} currency={currency} /></td>
                  <td className="px-4 py-2.5"><Status value={row.status} /></td>
                  <td className="px-4 py-2.5 text-right">
                    {row.status === 'active' && can('post') && (
                      <button className={btnPrimary} onClick={() => books.runDepreciation(row).catch((err) => setError(err.message))}>Depreciate</button>
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

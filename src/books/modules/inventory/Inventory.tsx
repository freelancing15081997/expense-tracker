import React, { useState } from 'react';
import { useBooks } from '../../context/BooksProvider';
import { parseMoney, parseQty } from '../../core/money';
import { btnGhost, btnPrimary, Card, Field, inputClass, Money, PageShell, Status } from '../../ui';
import { PagedTable } from '../../ui/PagedList';

export default function Inventory() {
  const books = useBooks();
  const { products, postingAccounts, currency, can } = books;
  const payAccounts = postingAccounts.filter((a) => a.systemKey === 'cash' || a.systemKey === 'bank' || a.systemKey === 'ap');
  const [open, setOpen] = useState(false);
  const [sku, setSku] = useState('');
  const [name, setName] = useState('');
  const [kind, setKind] = useState<'goods' | 'service'>('goods');
  const [sale, setSale] = useState('');
  const [cost, setCost] = useState('');
  const [qty, setQty] = useState('');
  const [payAccountId, setPay] = useState(payAccounts[0]?.id || '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  return (
    <PageShell
      title="Inventory"
      subtitle="Stock in debits Inventory and credits the pay-from account. Stock out posts COGS. Services have no stock."
      actions={can('create') && <button className={btnPrimary} onClick={() => setOpen(true)}>New product</button>}
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
                await books.createProduct({
                  sku,
                  name,
                  kind,
                  salePriceMinor: parseMoney(sale),
                  costMinor: cost ? parseMoney(cost) : 0,
                  qtyMilli: 0,
                  active: true,
                });
                setOpen(false);
                setSku('');
                setName('');
                setSale('');
                setCost('');
              } catch (err: any) {
                setError(err.message || 'Could not save product');
              } finally {
                setBusy(false);
              }
            }}
          >
            <Field label="SKU"><input className={inputClass} value={sku} onChange={(e) => setSku(e.target.value)} required /></Field>
            <Field label="Name"><input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} required /></Field>
            <Field label="Kind">
              <select className={inputClass} value={kind} onChange={(e) => setKind(e.target.value as 'goods' | 'service')}>
                <option value="goods">Goods</option>
                <option value="service">Service</option>
              </select>
            </Field>
            <Field label={`Sale price (${currency})`}><input className={inputClass} value={sale} onChange={(e) => setSale(e.target.value)} required /></Field>
            <Field label={`Cost (${currency})`}><input className={inputClass} value={cost} onChange={(e) => setCost(e.target.value)} /></Field>
            <div className="flex items-end gap-2">
              <button className={btnPrimary} disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
              <button type="button" className={btnGhost} onClick={() => setOpen(false)}>Cancel</button>
            </div>
            {error && <p className="text-sm text-rose-600 md:col-span-3">{error}</p>}
          </form>
        </Card>
      )}
      <PagedTable rows={products} empty="No products yet." minWidth="min-w-[860px]">
        {(slice) => (
          <table className="w-full text-sm">
            <thead className="text-left text-slate-500 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 font-medium">SKU</th>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Kind</th>
                <th className="px-4 py-3 font-medium text-right">Sale</th>
                <th className="px-4 py-3 font-medium text-right">Cost</th>
                <th className="px-4 py-3 font-medium text-right">Qty</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {slice.map((row) => (
                <tr key={row.id} className="border-b border-slate-100">
                  <td className="px-4 py-2.5 font-medium">{row.sku}</td>
                  <td className="px-4 py-2.5">{row.name}</td>
                  <td className="px-4 py-2.5"><Status value={row.kind} /></td>
                  <td className="px-4 py-2.5 text-right"><Money minor={row.salePriceMinor} currency={currency} /></td>
                  <td className="px-4 py-2.5 text-right"><Money minor={row.costMinor} currency={currency} /></td>
                  <td className="px-4 py-2.5 text-right">{(row.qtyMilli / 1000).toFixed(3)}</td>
                  <td className="px-4 py-2.5">
                    {row.kind === 'goods' && can('post') && (
                      <div className="flex flex-wrap gap-2 justify-end">
                        <select className={`${inputClass} w-40`} value={payAccountId} onChange={(e) => setPay(e.target.value)}>
                          {payAccounts.map((a) => <option key={a.id} value={a.id}>{a.code} {a.name}</option>)}
                        </select>
                        <input className={`${inputClass} w-24`} placeholder="Qty" value={qty} onChange={(e) => setQty(e.target.value)} />
                        <button className={btnPrimary} onClick={async () => {
                          try {
                            setError('');
                            await books.stockIn(row, parseQty(qty || '1'), payAccountId);
                            setQty('');
                          } catch (err: any) {
                            setError(err.message);
                          }
                        }}>Receive</button>
                        <button className={btnGhost} onClick={async () => {
                          try {
                            setError('');
                            await books.stockOut(row, parseQty(qty || '1'));
                            setQty('');
                          } catch (err: any) {
                            setError(err.message);
                          }
                        }}>Issue / COGS</button>
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
      <p className="text-xs text-slate-500">Valuation uses the product cost already stored (integer paise × qty milli). Warehouse transfers are not a second ledger — move stock with receive/issue only.</p>
    </PageShell>
  );
}

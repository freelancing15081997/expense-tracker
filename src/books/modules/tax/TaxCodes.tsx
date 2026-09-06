import React, { useState } from 'react';
import { useBooks } from '../../context/BooksProvider';
import { parseMoney, todayISO } from '../../core/money';
import { btnPrimary, Card, Field, inputClass, PageShell } from '../../ui';
import { PagedTable } from '../../ui/PagedList';

export default function TaxCodes() {
  const books = useBooks();
  const { taxCodes, postingAccounts, can } = books;
  const [amount, setAmount] = useState('');
  const [againstAccountId, setAgainst] = useState(postingAccounts.find((a) => a.systemKey === 'ap')?.id || postingAccounts[0]?.id || '');
  const [date, setDate] = useState(todayISO());
  const [memo, setMemo] = useState('TDS withheld');
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');

  return (
    <PageShell title="Tax & TDS" subtitle="GST rates drive the tax engine. TDS withhold posts AP/expense Dr and TDS Payable Cr. E-Invoice is not connected.">
      <PagedTable rows={taxCodes} empty="Tax codes will appear after workspace seed." minWidth="min-w-[560px]">
        {(slice) => (
          <table className="w-full text-sm">
            <thead className="text-left text-slate-500 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 font-medium">Code</th>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Rate</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {slice.map((code) => (
                <tr key={code.id} className="border-b border-slate-100">
                  <td className="px-4 py-2.5 font-medium">{code.id}</td>
                  <td className="px-4 py-2.5">{code.name}</td>
                  <td className="px-4 py-2.5">{(code.rateBps / 100).toFixed(2)}%</td>
                  <td className="px-4 py-2.5">{code.active ? 'Active' : 'Inactive'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </PagedTable>
      <Card className="p-4 space-y-3">
        <h2 className="font-semibold">Withhold TDS</h2>
        <p className="text-sm text-slate-500">Posts a balanced journal. It does not mark a bill paid — record the net payment separately.</p>
        <form
          className="grid md:grid-cols-2 gap-3"
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              setError('');
              setOk('');
              await books.postTds({ amountMinor: parseMoney(amount), againstAccountId, date, memo });
              setOk('TDS journal posted.');
              setAmount('');
            } catch (err: any) {
              setError(err.message || 'TDS post failed');
            }
          }}
        >
          <Field label="Amount"><input className={inputClass} value={amount} onChange={(e) => setAmount(e.target.value)} required /></Field>
          <Field label="Date"><input type="date" className={inputClass} value={date} onChange={(e) => setDate(e.target.value)} /></Field>
          <Field label="Debit account">
            <select className={inputClass} value={againstAccountId} onChange={(e) => setAgainst(e.target.value)}>
              {postingAccounts.map((a) => <option key={a.id} value={a.id}>{a.code} {a.name}</option>)}
            </select>
          </Field>
          <Field label="Memo"><input className={inputClass} value={memo} onChange={(e) => setMemo(e.target.value)} /></Field>
          <div className="flex items-end gap-2">
            <button className={btnPrimary} disabled={!can('post')}>Post TDS</button>
            {ok && <p className="text-sm text-emerald-700">{ok}</p>}
            {error && <p className="text-sm text-rose-600">{error}</p>}
          </div>
        </form>
      </Card>
    </PageShell>
  );
}

import React, { useState } from 'react';
import { useBooks } from '../../context/BooksProvider';
import { parseMoney, todayISO } from '../../core/money';
import { btnGhost, btnPrimary, Card, Field, inputClass, Money, PageShell, Status } from '../../ui';
import { PagedTable } from '../../ui/PagedList';

export default function Banking() {
  const books = useBooks();
  const { postingAccounts, bankTxns, currency, can, transfer, createBankTxn, reconcileTxn } = books;
  const banks = postingAccounts.filter((a) => a.systemKey === 'cash' || a.systemKey === 'bank' || a.type === 'asset');
  const [fromAccountId, setFrom] = useState(banks.find((a) => a.systemKey === 'bank')?.id || banks[0]?.id || '');
  const [toAccountId, setTo] = useState(banks.find((a) => a.systemKey === 'cash')?.id || banks[1]?.id || '');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(todayISO());
  const [memo, setMemo] = useState('Bank transfer');
  const [txnAmount, setTxnAmount] = useState('');
  const [txnMemo, setTxnMemo] = useState('');
  const [txnAccountId, setTxnAccount] = useState(banks.find((a) => a.systemKey === 'bank')?.id || banks[0]?.id || '');
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [busy, setBusy] = useState(false);

  return (
    <PageShell title="Banking" subtitle="Transfers and bank journals post to the ledger. Statement import / bank feeds are not connected.">
      <Card className="p-4">
        <h2 className="font-semibold mb-3">Transfer</h2>
        <form
          className="grid md:grid-cols-2 gap-3"
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              setBusy(true);
              setError('');
              setOk('');
              await transfer({ fromAccountId, toAccountId, amountMinor: parseMoney(amount), date, memo });
              setOk('Transfer posted to the ledger.');
              setAmount('');
            } catch (err: any) {
              setError(err.message || 'Transfer failed');
            } finally {
              setBusy(false);
            }
          }}
        >
          <Field label="From">
            <select className={inputClass} value={fromAccountId} onChange={(e) => setFrom(e.target.value)}>
              {banks.map((a) => <option key={a.id} value={a.id}>{a.code} {a.name}</option>)}
            </select>
          </Field>
          <Field label="To">
            <select className={inputClass} value={toAccountId} onChange={(e) => setTo(e.target.value)}>
              {banks.map((a) => <option key={a.id} value={a.id}>{a.code} {a.name}</option>)}
            </select>
          </Field>
          <Field label={`Amount (${currency})`}><input className={inputClass} value={amount} onChange={(e) => setAmount(e.target.value)} required /></Field>
          <Field label="Date"><input type="date" className={inputClass} value={date} onChange={(e) => setDate(e.target.value)} /></Field>
          <Field label="Memo"><input className={inputClass} value={memo} onChange={(e) => setMemo(e.target.value)} /></Field>
          <div className="flex items-end gap-2">
            <button className={btnPrimary} disabled={busy || !can('post')}>{busy ? 'Posting…' : 'Post transfer'}</button>
            {ok && <p className="text-sm text-emerald-700">{ok}</p>}
            {error && <p className="text-sm text-rose-600">{error}</p>}
          </div>
        </form>
      </Card>
      <Card className="p-4">
        <h2 className="font-semibold mb-3">Bank journal</h2>
        <p className="text-sm text-slate-500 mb-3">Positive amount = deposit. Negative amount = withdrawal. Clearing uses the operating expense / sales account until you recode via reversal.</p>
        <form
          className="grid md:grid-cols-3 gap-3"
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              setError('');
              await createBankTxn({ accountId: txnAccountId, date, amountMinor: parseMoney(txnAmount), memo: txnMemo });
              setTxnAmount('');
              setTxnMemo('');
            } catch (err: any) {
              setError(err.message || 'Bank journal failed');
            }
          }}
        >
          <Field label="Account">
            <select className={inputClass} value={txnAccountId} onChange={(e) => setTxnAccount(e.target.value)}>
              {banks.map((a) => <option key={a.id} value={a.id}>{a.code} {a.name}</option>)}
            </select>
          </Field>
          <Field label="Signed amount"><input className={inputClass} value={txnAmount} onChange={(e) => setTxnAmount(e.target.value)} required /></Field>
          <Field label="Memo"><input className={inputClass} value={txnMemo} onChange={(e) => setTxnMemo(e.target.value)} required /></Field>
          <button className={btnPrimary} disabled={!can('post')}>Post bank journal</button>
        </form>
      </Card>
      <PagedTable rows={bankTxns} empty="No bank journals yet.">
        {(slice) => (
          <table className="w-full text-sm">
            <thead className="text-left text-slate-500 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Memo</th>
                <th className="px-4 py-3 font-medium text-right">Amount</th>
                <th className="px-4 py-3 font-medium">Reconciled</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {slice.map((row) => (
                <tr key={row.id} className="border-b border-slate-100">
                  <td className="px-4 py-2.5">{row.date}</td>
                  <td className="px-4 py-2.5">{row.memo}</td>
                  <td className="px-4 py-2.5 text-right"><Money minor={row.amountMinor} currency={currency} /></td>
                  <td className="px-4 py-2.5"><Status value={row.reconciled ? 'reconciled' : 'open'} /></td>
                  <td className="px-4 py-2.5 text-right">
                    {can('post') && (
                      <button className={btnGhost} onClick={() => reconcileTxn(row)}>{row.reconciled ? 'Unreconcile' : 'Reconcile'}</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </PagedTable>
    </PageShell>
  );
}

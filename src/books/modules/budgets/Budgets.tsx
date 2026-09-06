import React, { useMemo, useState } from 'react';
import { useBooks } from '../../context/BooksProvider';
import { periodIdFromDate, parseMoney, todayISO } from '../../core/money';
import { btnGhost, btnPrimary, Card, Field, inputClass, Money, PageShell } from '../../ui';
import { PagedTable } from '../../ui/PagedList';

export default function Budgets() {
  const books = useBooks();
  const { budgets, accounts, journals, periods, currency, can } = books;
  const posting = accounts.filter((a) => a.allowPosting);
  const [open, setOpen] = useState(false);
  const [periodId, setPeriodId] = useState(periods[0]?.id || periodIdFromDate(todayISO()));
  const [accountId, setAccountId] = useState(posting[0]?.id || '');
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');

  const actuals = useMemo(() => {
    const map = new Map<string, number>();
    for (const journal of journals.filter((j) => j.status === 'posted')) {
      for (const line of journal.lines) {
        const key = `${journal.periodId}:${line.accountId}`;
        map.set(key, (map.get(key) || 0) + line.debitMinor - line.creditMinor);
      }
    }
    return map;
  }, [journals]);

  return (
    <PageShell
      title="Budgets"
      subtitle="Variance uses posted journal lines in that period. Forecasts and scenarios are not invented numbers."
      actions={can('create') && <button className={btnPrimary} onClick={() => setOpen(true)}>Budget line</button>}
    >
      {open && (
        <Card className="p-4">
          <form
            className="grid md:grid-cols-3 gap-3"
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                setError('');
                await books.createBudget({ periodId, accountId, amountMinor: parseMoney(amount) });
                setOpen(false);
                setAmount('');
              } catch (err: any) {
                setError(err.message || 'Could not save');
              }
            }}
          >
            <Field label="Period">
              <input className={inputClass} value={periodId} onChange={(e) => setPeriodId(e.target.value)} placeholder="YYYY-MM" required />
            </Field>
            <Field label="Account">
              <select className={inputClass} value={accountId} onChange={(e) => setAccountId(e.target.value)}>
                {posting.map((a) => <option key={a.id} value={a.id}>{a.code} {a.name}</option>)}
              </select>
            </Field>
            <Field label={`Amount (${currency})`}><input className={inputClass} value={amount} onChange={(e) => setAmount(e.target.value)} required /></Field>
            <div className="flex items-end gap-2">
              <button className={btnPrimary}>Save</button>
              <button type="button" className={btnGhost} onClick={() => setOpen(false)}>Cancel</button>
            </div>
            {error && <p className="text-sm text-rose-600 md:col-span-3">{error}</p>}
          </form>
        </Card>
      )}
      <PagedTable rows={budgets} empty="No budget lines yet.">
        {(slice) => (
          <table className="w-full text-sm">
            <thead className="text-left text-slate-500 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 font-medium">Period</th>
                <th className="px-4 py-3 font-medium">Account</th>
                <th className="px-4 py-3 font-medium text-right">Budget</th>
                <th className="px-4 py-3 font-medium text-right">Actual (signed)</th>
                <th className="px-4 py-3 font-medium text-right">Variance</th>
              </tr>
            </thead>
            <tbody>
              {slice.map((row) => {
                const account = accounts.find((a) => a.id === row.accountId);
                const actual = actuals.get(`${row.periodId}:${row.accountId}`) || 0;
                return (
                  <tr key={row.id} className="border-b border-slate-100">
                    <td className="px-4 py-2.5">{row.periodId}</td>
                    <td className="px-4 py-2.5">{account ? `${account.code} ${account.name}` : row.accountId}</td>
                    <td className="px-4 py-2.5 text-right"><Money minor={row.amountMinor} currency={currency} /></td>
                    <td className="px-4 py-2.5 text-right"><Money minor={actual} currency={currency} /></td>
                    <td className="px-4 py-2.5 text-right"><Money minor={row.amountMinor - Math.abs(actual)} currency={currency} /></td>
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

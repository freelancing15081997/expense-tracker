import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useBooks } from '../../context/BooksProvider';
import { signedBalance } from '../../engine/chartOfAccounts';
import { Card, Money, PageShell } from '../../ui';
import { PagedTable } from '../../ui/PagedList';

export default function Ledger() {
  const { accountId } = useParams();
  const { accounts, currency, ledger } = useBooks();
  const account = accounts.find((a) => a.id === accountId);
  const [rows, setRows] = useState<any[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!accountId) return;
    ledger(accountId).then(setRows).catch((err) => setError(err.message || 'Failed to load ledger'));
  }, [accountId, ledger]);

  const withBalance = useMemo(() => {
    if (!account) return [];
    let running = 0;
    return rows.map((row) => {
      running += (row.debitMinor || 0) - (row.creditMinor || 0);
      return {
        ...row,
        shown: account.normalBalance === 'debit' ? running : -running,
      };
    });
  }, [account, rows]);

  if (!account) {
    return <PageShell title="General Ledger"><p className="text-sm text-slate-500">Account not found. <Link to="/books/chart-of-accounts" className="underline">Back to accounts</Link></p></PageShell>;
  }

  return (
    <PageShell title={`${account.code} ${account.name}`} subtitle="Every movement traces to a posted journal.">
      <Card className="p-4 flex justify-between">
        <span className="text-sm text-slate-500">Closing balance</span>
        <Money minor={signedBalance(account)} currency={currency} />
      </Card>
      {error && <p className="text-sm text-rose-600">{error}</p>}
      <PagedTable rows={withBalance} empty="No movements on this account.">
        {(slice) => (
          <table className="w-full text-sm">
            <thead className="text-left text-slate-500 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Journal</th>
                <th className="px-4 py-3 font-medium text-right">Debit</th>
                <th className="px-4 py-3 font-medium text-right">Credit</th>
                <th className="px-4 py-3 font-medium text-right">Balance</th>
              </tr>
            </thead>
            <tbody>
              {slice.map((row) => (
                <tr key={row.id} className="border-b border-slate-100">
                  <td className="px-4 py-2.5">{row.date}</td>
                  <td className="px-4 py-2.5">{row.journalNumber}{row.memo ? ` · ${row.memo}` : ''}</td>
                  <td className="px-4 py-2.5 text-right">{row.debitMinor ? <Money minor={row.debitMinor} currency={currency} /> : ''}</td>
                  <td className="px-4 py-2.5 text-right">{row.creditMinor ? <Money minor={row.creditMinor} currency={currency} /> : ''}</td>
                  <td className="px-4 py-2.5 text-right"><Money minor={row.shown} currency={currency} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </PagedTable>
    </PageShell>
  );
}

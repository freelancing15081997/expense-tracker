import React from 'react';
import { Link } from 'react-router-dom';
import { useBooks } from '../../context/BooksProvider';
import { signedBalance } from '../../engine/chartOfAccounts';
import { Money, PageShell } from '../../ui';
import { PagedTable } from '../../ui/PagedList';

export default function LedgerIndex() {
  const { accounts, currency } = useBooks();
  const rows = accounts.filter((a) => a.allowPosting);

  return (
    <PageShell title="General Ledger" subtitle="Open any postable account to see journal movements and running balance.">
      <PagedTable rows={rows} empty="Accounts are still seeding. Refresh in a moment.">
        {(slice) => (
          <table className="w-full text-sm">
            <thead className="text-left text-slate-500 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 font-medium">Code</th>
                <th className="px-4 py-3 font-medium">Account</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium text-right">Balance</th>
              </tr>
            </thead>
            <tbody>
              {slice.map((account) => (
                <tr key={account.id} className="border-b border-slate-100">
                  <td className="px-4 py-2.5 tabular-nums text-slate-500">{account.code}</td>
                  <td className="px-4 py-2.5">
                    <Link to={`/books/ledger/${account.id}`} className="text-slate-900 hover:underline font-medium">{account.name}</Link>
                  </td>
                  <td className="px-4 py-2.5 capitalize text-slate-500">{account.type.replace('_', ' ')}</td>
                  <td className="px-4 py-2.5 text-right"><Money minor={signedBalance(account)} currency={currency} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </PagedTable>
    </PageShell>
  );
}

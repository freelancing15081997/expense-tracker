import React, { useState } from 'react';
import { useBooks } from '../../context/BooksProvider';
import { Card, IconBtn, PageShell, Status } from '../../ui';

export default function Periods() {
  const { periods, can, close, reopen } = useBooks();
  const [error, setError] = useState('');
  const rows = [...periods].sort((a, b) => `${b.year}-${String(b.month).padStart(2, '0')}`.localeCompare(`${a.year}-${String(a.month).padStart(2, '0')}`));

  return (
    <PageShell title="Accounting Periods" subtitle="Closed periods reject posting. Reopen requires close-period permission.">
      {error && <p className="text-sm text-rose-600">{error}</p>}
      <Card>
        <table className="w-full text-sm">
          <thead className="text-left text-slate-500 border-b border-slate-200">
            <tr>
              <th className="px-4 py-3 font-medium">Period</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={3} className="px-4 py-8 text-center text-slate-500">No periods yet. Posting a journal opens the period for that date.</td></tr>
            ) : rows.map((p) => (
              <tr key={p.id} className="border-b border-slate-100">
                <td className="px-4 py-2.5 font-medium">{p.year}-{String(p.month).padStart(2, '0')}</td>
                <td className="px-4 py-2.5"><Status value={p.status} /></td>
                <td className="px-4 py-2.5 text-right">
                  {can('close_period') && p.status === 'open' && (
                    <IconBtn action="post" onClick={() => void close(p.id).catch((err) => setError(err.message))}>Close</IconBtn>
                  )}
                  {can('close_period') && p.status === 'closed' && (
                    <button type="button" className="byjan-btn-ghost" onClick={() => void reopen(p.id).catch((err) => setError(err.message))}>Reopen</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </PageShell>
  );
}

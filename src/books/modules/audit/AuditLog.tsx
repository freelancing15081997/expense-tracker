import React from 'react';
import { useBooks } from '../../context/BooksProvider';
import { PageShell } from '../../ui';
import { PagedTable } from '../../ui/PagedList';

export default function AuditLog() {
  const { audit } = useBooks();
  return (
    <PageShell title="Audit Trail" subtitle="Every post, payment, reversal, and void is recorded. Audit rows cannot be edited.">
      <PagedTable rows={audit} empty="No audit events yet. Post a journal or invoice to see lineage.">
        {(slice) => (
          <table className="w-full text-sm">
            <thead className="text-left text-slate-500 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 font-medium">When</th>
                <th className="px-4 py-3 font-medium">Action</th>
                <th className="px-4 py-3 font-medium">Resource</th>
                <th className="px-4 py-3 font-medium">Id</th>
              </tr>
            </thead>
            <tbody>
              {slice.map((row) => (
                <tr key={row.id} className="border-b border-slate-100">
                  <td className="px-4 py-2.5 text-slate-500">{row.at.replace('T', ' ').slice(0, 19)}</td>
                  <td className="px-4 py-2.5 font-medium">{row.action}</td>
                  <td className="px-4 py-2.5">{row.resource}</td>
                  <td className="px-4 py-2.5 text-slate-500 truncate max-w-[180px]">{row.resourceId}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </PagedTable>
    </PageShell>
  );
}

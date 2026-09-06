import React from 'react';
import { Link } from 'react-router-dom';
import { useBooks } from '../../context/BooksProvider';
import { todayISO } from '../../core/money';
import { Card, Money, PageShell, Status } from '../../ui';
import { PagedTable } from '../../ui/PagedList';

export default function Collections() {
  const { documents, parties, currency } = useBooks();
  const rows = documents.filter((d) => d.kind === 'invoice' && d.status === 'posted' && d.dueDate && d.dueDate < todayISO() && d.paidMinor < d.totalMinor);
  const total = rows.reduce((s, d) => s + (d.totalMinor - d.paidMinor), 0);

  return (
    <PageShell title="Collections" subtitle="Overdue posted invoices only. Reminder email is not connected — use the statement and invoice registers.">
      <Card className="p-4">
        <p className="text-sm text-[#6b6458]">{rows.length} overdue invoice{rows.length === 1 ? '' : 's'} · <Money minor={total} currency={currency} /></p>
        <div className="mt-3 flex gap-2 text-sm">
          <Link to="/books/statements" className="underline underline-offset-2">Statements</Link>
          <Link to="/books/invoices" className="underline underline-offset-2">Invoices</Link>
        </div>
      </Card>
      <PagedTable rows={rows} empty="No overdue posted invoices.">
        {(slice) => (
          <table className="w-full text-sm">
            <thead className="text-left text-[#7a7368] border-b border-[#e6e0d4]">
              <tr>
                <th className="px-4 py-3 font-medium">Invoice</th>
                <th className="px-4 py-3 font-medium">Customer</th>
                <th className="px-4 py-3 font-medium">Due</th>
                <th className="px-4 py-3 font-medium text-right">Outstanding</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {slice.map((row) => (
                <tr key={row.id} className="border-b border-[#f0eadc]">
                  <td className="px-4 py-2.5 font-medium">{row.number}</td>
                  <td className="px-4 py-2.5">{parties.find((p) => p.id === row.partyId)?.name || '—'}</td>
                  <td className="px-4 py-2.5">{row.dueDate}</td>
                  <td className="px-4 py-2.5 text-right"><Money minor={row.totalMinor - row.paidMinor} currency={currency} /></td>
                  <td className="px-4 py-2.5"><Status value="overdue" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </PagedTable>
    </PageShell>
  );
}

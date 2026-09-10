import React from 'react';
import { Link } from 'react-router-dom';
import { useBooks } from '../../context/BooksProvider';
import { todayISO } from '../../core/money';
import { Card, Money, PageShell, Status, btnGhost } from '../../ui';
import { PagedTable } from '../../ui/PagedList';
import type { FinanceDocument } from '../../core/types';
import { useToast } from '../../../context/ToastContext';
import { documentHref } from '../../../lib/search-index';

export default function Collections() {
  const { documents, parties, currency } = useBooks();
  const { addToast } = useToast();
  const rows = documents.filter((d) => (d.kind === 'invoice' || d.kind === 'debit_note') && d.status === 'posted' && d.dueDate && d.dueDate < todayISO() && d.paidMinor < d.totalMinor);
  const total = rows.reduce((s, d) => s + (d.totalMinor - d.paidMinor), 0);

  const copyReminder = async (row: FinanceDocument) => {
    const party = parties.find((p) => p.id === row.partyId);
    const outstanding = (row.totalMinor - row.paidMinor) / 100;
    const text = `Reminder: invoice ${row.number} for ${party?.name || 'customer'} is overdue (due ${row.dueDate}). Outstanding ${currency} ${outstanding.toFixed(2)}.`;
    try {
      await navigator.clipboard.writeText(text);
      addToast('Reminder copied', 'success');
    } catch {
      addToast(text, 'info');
    }
  };

  return (
    <PageShell title="Collections" subtitle="Overdue posted invoices. Copy a reminder — mass email is not connected.">
      <Card className="p-4">
        <p className="text-sm text-slate-600">{rows.length} overdue · <Money minor={total} currency={currency} /></p>
        <div className="mt-3 flex gap-2 text-sm">
          <Link to="/books/statements" className="underline underline-offset-2">Statements</Link>
          <Link to="/books/invoices" className="underline underline-offset-2">Invoices</Link>
        </div>
      </Card>
      <PagedTable<FinanceDocument> rows={rows} empty="No overdue posted invoices or debit notes.">
        {(slice) => (
          <table className="w-full text-sm">
            <thead className="text-left text-slate-500 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 font-medium">Document</th>
                <th className="px-4 py-3 font-medium">Customer</th>
                <th className="px-4 py-3 font-medium">Due</th>
                <th className="px-4 py-3 font-medium text-right">Outstanding</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {slice.map((row) => (
                <tr key={row.id} className="border-b border-slate-100">
                  <td className="px-4 py-2.5 font-medium"><Link to={documentHref(row.kind, row.id)} className="hover:underline">{row.number}</Link></td>
                  <td className="px-4 py-2.5">{parties.find((p) => p.id === row.partyId)?.name || '—'}</td>
                  <td className="px-4 py-2.5">{row.dueDate}</td>
                  <td className="px-4 py-2.5 text-right"><Money minor={row.totalMinor - row.paidMinor} currency={currency} /></td>
                  <td className="px-4 py-2.5"><Status value="overdue" /></td>
                  <td className="px-4 py-2.5 text-right">
                    <button type="button" className={btnGhost} onClick={() => void copyReminder(row)}>Copy reminder</button>
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

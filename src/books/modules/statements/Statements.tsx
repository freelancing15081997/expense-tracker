import React, { useMemo, useState } from 'react';
import { useBooks } from '../../context/BooksProvider';
import { todayISO } from '../../core/money';
import { btnGhost, Card, Field, inputClass, Money, PageShell, Status } from '../../ui';
import { PagedTable } from '../../ui/PagedList';
import { printCustomerStatement, printFinanceDocument } from '../../reporting/printDocument';
import { booksFileUrl } from '../../storage/adapter';

export default function Statements() {
  const { documents, parties, currency, tenant } = useBooks();
  const customers = parties.filter((p) => p.kind === 'customer');
  const [partyId, setPartyId] = useState(customers[0]?.id || '');

  const rows = useMemo(() => {
    return documents
      .filter((d) => d.partyId === partyId && (d.kind === 'invoice' || d.kind === 'credit_note') && d.status !== 'voided')
      .map((d) => ({
        ...d,
        outstanding: d.kind === 'credit_note' ? -(d.totalMinor - d.paidMinor) : d.totalMinor - d.paidMinor,
        overdue: Boolean(d.dueDate && d.dueDate < todayISO() && d.paidMinor < d.totalMinor && d.status === 'posted'),
      }));
  }, [documents, partyId]);

  const outstanding = rows.reduce((s, r) => s + (r.status === 'draft' ? 0 : r.outstanding), 0);
  const party = parties.find((p) => p.id === partyId) || null;

  const printStatement = async () => {
    if (!tenant) return;
    const companyLogo = tenant.logoPath ? await booksFileUrl(tenant.logoPath) : undefined;
    const partyLogo = party?.logoPath ? await booksFileUrl(party.logoPath) : undefined;
    printCustomerStatement({ tenant, party, rows, outstanding, companyLogo, partyLogo });
  };

  return (
    <PageShell
      title="Customer Statements"
      subtitle="Built from posted invoices and credit notes. Company and customer logos print when uploaded. Email send is not connected."
      actions={rows.length > 0 && <button className={btnGhost} onClick={printStatement}>Print statement</button>}
    >
      <Card className="p-4">
        <Field label="Customer">
          <select className={inputClass} value={partyId} onChange={(e) => setPartyId(e.target.value)}>
            {customers.length === 0 && <option value="">No customers — add one from Sales → Customers or from an invoice.</option>}
            {customers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </Field>
        <p className="text-sm text-slate-600 mt-3">Outstanding: <Money minor={outstanding} currency={currency} /></p>
      </Card>
      <PagedTable rows={rows} empty="No invoices or credit notes for this customer.">
        {(slice) => (
          <table className="w-full text-sm">
            <thead className="text-left text-slate-500 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 font-medium">Number</th>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Due</th>
                <th className="px-4 py-3 font-medium text-right">Total</th>
                <th className="px-4 py-3 font-medium text-right">Outstanding</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {slice.map((row) => (
                <tr key={row.id} className={`border-b border-slate-100 ${row.overdue ? 'bg-amber-50' : ''}`}>
                  <td className="px-4 py-2.5 font-medium">{row.number}</td>
                  <td className="px-4 py-2.5">{row.date}</td>
                  <td className="px-4 py-2.5">{row.dueDate || '—'}</td>
                  <td className="px-4 py-2.5 text-right"><Money minor={row.totalMinor} currency={currency} /></td>
                  <td className="px-4 py-2.5 text-right"><Money minor={row.outstanding} currency={currency} /></td>
                  <td className="px-4 py-2.5"><Status value={row.overdue ? 'overdue' : row.status} /></td>
                  <td className="px-4 py-2.5 text-right">
                    <button className={btnGhost} onClick={async () => {
                      const companyLogo = tenant?.logoPath ? await booksFileUrl(tenant.logoPath) : undefined;
                      const partyLogo = party?.logoPath ? await booksFileUrl(party.logoPath) : undefined;
                      if (tenant) printFinanceDocument({ tenant, document: row, party, companyLogo, partyLogo });
                    }}>Print</button>
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

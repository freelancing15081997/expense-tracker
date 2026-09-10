import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useBooks } from '../../context/BooksProvider';
import { useAppPrefs } from '../../../context/AppPrefsContext';
import { booksFileUrl } from '../../storage/adapter';
import { btnGhost, Card, Empty, IconBtn, inputClass, Money, PageShell, RecordFlyout, Status } from '../../ui';
import { Pager, usePaging } from '../../ui/PagedList';
import type { FinanceParty, PartyKind } from '../../core/types';
import { documentHref } from '../../../lib/search-index';
import { PartyForm } from './PartyForm';

export default function Parties({ kind }: { kind: PartyKind }) {
  const books = useBooks();
  const { prefs } = useAppPrefs();
  const { parties, documents, currency, can, deactivateParty } = books;
  const [search, setSearch] = useState('');
  const allRows = parties.filter((p) => p.kind === kind && p.active !== false);
  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return allRows;
    return allRows.filter((p) => [p.name, p.email, p.taxId, p.pan, p.city].some((v) => (v || '').toLowerCase().includes(q)));
  }, [allRows, search]);
  const paging = usePaging(rows, prefs.listPageSize);
  const title = kind === 'customer' ? 'Customers' : 'Vendors';
  const [editing, setEditing] = useState<FinanceParty | null>(null);
  const [open, setOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const [selected, setSelected] = useState<FinanceParty | null>(null);
  const [searchParams] = useSearchParams();
  const [logoUrl, setLogoUrl] = useState<string>('');
  const [error, setError] = useState('');

  const related = useMemo(() => {
    if (!selected) return [];
    const kinds = kind === 'customer' ? ['invoice', 'quote', 'credit_note'] : ['bill', 'purchase_request', 'purchase_order', 'vendor_credit'];
    return documents.filter((d) => d.partyId === selected.id && kinds.includes(d.kind) && d.status !== 'voided');
  }, [documents, kind, selected]);

  const outstanding = related
    .filter((d) => (d.kind === 'invoice' || d.kind === 'bill') && d.status === 'posted')
    .reduce((s, d) => s + (d.totalMinor - d.paidMinor), 0);

  const openEdit = (party?: FinanceParty) => {
    setEditing(party || null);
    setFormKey((n) => n + 1);
    setOpen(true);
    setError('');
  };

  const show = async (party: FinanceParty) => {
    setSelected(party);
    setLogoUrl('');
    if (party.logoPath) {
      try {
        setLogoUrl(await booksFileUrl(party.logoPath));
      } catch {
        setLogoUrl('');
      }
    }
  };

  useEffect(() => {
    const openId = searchParams.get('open');
    if (!openId) return;
    const hit = allRows.find((p) => p.id === openId);
    if (hit) void show(hit);
  }, [searchParams, allRows.map((p) => p.id).join('|')]);

  return (
    <PageShell
      title={title}
      subtitle={kind === 'customer'
        ? 'Master record for receivables: identity, tax, address, logo, and linked invoices.'
        : 'Master record for payables: identity, tax, address, logo, and linked bills.'}
      actions={can('create') && <IconBtn action="create" onClick={() => openEdit()}>{kind === 'customer' ? 'New customer' : 'New vendor'}</IconBtn>}
    >
      <div className="space-y-5">
        {open && (
          <Card className="p-5 space-y-5">
            <div>
              <p className="text-[10px] uppercase tracking-[0.16em] text-[#12B8A8] font-semibold">{editing ? 'Edit' : 'New'} {kind}</p>
              <h2 className="font-display text-xl mt-1">{editing ? editing.name : kind === 'customer' ? 'Add customer' : 'Add vendor'}</h2>
              <p className="text-sm text-slate-500 mt-1">{kind === 'customer' ? 'Receivable master: who you bill, credit limit, and invoice address.' : 'Payable master: who you buy from, payment terms, and remit-from address.'}</p>
            </div>
            <div key={formKey}>
            <PartyForm
              kind={kind}
              editing={editing}
              onCancel={() => { setOpen(false); setEditing(null); }}
              onSaved={() => { setOpen(false); setEditing(null); }}
            />
            </div>
          </Card>
        )}

        <Card>
          <div className="p-4 border-b border-[#E5E7EB]">
            <input className={`${inputClass} max-w-sm`} value={search} onChange={(e) => setSearch(e.target.value)} placeholder={`Search ${title.toLowerCase()}`} />
          </div>
          {rows.length === 0 ? <Empty text={allRows.length === 0 ? `No ${title.toLowerCase()} yet.` : 'No matches.'} /> : (
            <>
            <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[640px]">
              <thead className="text-left text-[#6B7280] border-b border-[#E5E7EB]">
                <tr>
                  <th className="px-4 py-3 font-medium">{kind === 'customer' ? 'Customer' : 'Vendor'}</th>
                  <th className="px-4 py-3 font-medium">Contact</th>
                  <th className="px-4 py-3 font-medium">GSTIN</th>
                  <th className="px-4 py-3 font-medium">Treatment</th>
                  <th className="px-4 py-3 font-medium">Terms</th>
                </tr>
              </thead>
              <tbody>
                {paging.slice.map((row) => (
                  <tr key={row.id} className={`border-b border-[#F3F4F6] cursor-pointer hover:bg-[#F8FAFC] ${selected?.id === row.id ? 'bg-[#F0FDFA]' : ''}`} onClick={() => show(row)}>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-[#0B1F3A]">{row.name}</p>
                      <p className="text-xs text-[#6B7280]">{row.city || row.email || 'No location'}</p>
                    </td>
                    <td className="px-4 py-3 text-[#4B5563]">{row.contactName || row.email || '—'}</td>
                    <td className="px-4 py-3 text-[#4B5563]">{row.taxId || '—'}</td>
                    <td className="px-4 py-3 text-[#4B5563]">{row.gstTreatment || '—'}</td>
                    <td className="px-4 py-3">{row.paymentTermsDays} days</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
            <Pager page={paging.page} pages={paging.pages} total={paging.total} pageSize={paging.pageSize} onPage={paging.setPage} />
            </>
          )}
        </Card>
      </div>

      {selected && (
        <RecordFlyout
          title={selected.name}
          subtitle={selected.contactName || selected.email || `${kind} profile`}
          onClose={() => setSelected(null)}
          actions={can('edit') && (
            <button className={btnGhost} onClick={() => { openEdit(selected); setSelected(null); }}>Edit</button>
          )}
        >
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-[#F3F4F6] overflow-hidden flex items-center justify-center text-[#0B1F3A] font-bold">
              {logoUrl ? <img src={logoUrl} alt="" className="w-full h-full object-cover" /> : selected.name.slice(0, 1)}
            </div>
            <div>
              <p className="text-sm text-slate-500">{selected.city || 'No location'}</p>
              <p className="text-xs text-slate-400">{selected.gstTreatment || 'GST treatment not set'}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><p className="text-xs text-slate-500">Email</p><p>{selected.email || '—'}</p></div>
            <div><p className="text-xs text-slate-500">Phone</p><p>{selected.phone || '—'}</p></div>
            <div><p className="text-xs text-slate-500">GSTIN</p><p>{selected.taxId || '—'}</p></div>
            <div><p className="text-xs text-slate-500">PAN</p><p>{selected.pan || '—'}</p></div>
            <div className="col-span-2"><p className="text-xs text-slate-500">Billing</p><p>{[selected.address, selected.city, selected.state, selected.pincode].filter(Boolean).join(', ') || '—'}</p></div>
            {kind === 'customer' && <div className="col-span-2"><p className="text-xs text-slate-500">Credit limit</p><p>{selected.creditLimitMinor ? <Money minor={selected.creditLimitMinor} currency={currency} /> : 'No limit recorded'}</p></div>}
          </div>
          <div className="rounded-2xl bg-[#F0FDFA] px-4 py-3">
            <p className="text-xs uppercase tracking-[0.14em] text-[#0f766e]">Open {kind === 'customer' ? 'receivable' : 'payable'}</p>
            <p className="text-xl font-display mt-1"><Money minor={outstanding} currency={currency} /></p>
          </div>
          <div>
            <p className="text-sm font-semibold mb-2">Linked documents</p>
            {related.length === 0 ? <p className="text-sm text-slate-500">None yet.</p> : (
              <ul className="space-y-2 text-sm">
                {related.slice(0, 8).map((d) => (
                  <li key={d.id} className="flex justify-between gap-3">
                    <Link to={documentHref(d.kind, d.id)} className="underline underline-offset-2">{d.number}</Link>
                    <span className="flex items-center gap-2"><Status value={d.status} /><Money minor={d.totalMinor} currency={currency} /></span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {can('edit') && (
            <button
              className={btnGhost}
              onClick={async () => {
                if (!confirm(`Deactivate ${selected.name}? They stay in the workspace for audit and disappear from this list.`)) return;
                try {
                  await deactivateParty(selected.id);
                  setSelected(null);
                } catch (err: any) {
                  setError(err.message || 'Could not deactivate');
                }
              }}
            >
              Deactivate
            </button>
          )}
          {error && <p className="text-sm text-rose-600">{error}</p>}
        </RecordFlyout>
      )}
    </PageShell>
  );
}

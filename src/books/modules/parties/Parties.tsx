import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useBooks } from '../../context/BooksProvider';
import { booksFileUrl } from '../../storage/adapter';
import { btnGhost, btnPrimary, Card, Empty, Field, FileField, inputClass, Money, PageShell, Status } from '../../ui';
import { Pager, usePaging } from '../../ui/PagedList';
import type { FinanceParty, PartyKind } from '../../core/types';

type Form = {
  name: string;
  email: string;
  phone: string;
  website: string;
  contactName: string;
  taxId: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  notes: string;
  terms: string;
};

const emptyForm = (): Form => ({
  name: '', email: '', phone: '', website: '', contactName: '', taxId: '',
  address: '', city: '', state: '', pincode: '', notes: '', terms: '30',
});

function fromParty(p: FinanceParty): Form {
  return {
    name: p.name,
    email: p.email,
    phone: p.phone || '',
    website: p.website || '',
    contactName: p.contactName || '',
    taxId: p.taxId,
    address: p.address || '',
    city: p.city || '',
    state: p.state || '',
    pincode: p.pincode || '',
    notes: p.notes || '',
    terms: String(p.paymentTermsDays || 0),
  };
}

export default function Parties({ kind }: { kind: PartyKind }) {
  const books = useBooks();
  const { parties, documents, currency, can, createParty, uploadFile } = books;
  const rows = parties.filter((p) => p.kind === kind);
  const paging = usePaging(rows, 10);
  const title = kind === 'customer' ? 'Customers' : 'Vendors';
  const [form, setForm] = useState<Form>(emptyForm());
  const [editing, setEditing] = useState<FinanceParty | null>(null);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<FinanceParty | null>(null);
  const [logoUrl, setLogoUrl] = useState<string>('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [pendingLogo, setPendingLogo] = useState<File | null>(null);

  const related = useMemo(() => {
    if (!selected) return [];
    const kinds = kind === 'customer' ? ['invoice', 'quote', 'credit_note'] : ['bill', 'purchase_order', 'vendor_credit'];
    return documents.filter((d) => d.partyId === selected.id && kinds.includes(d.kind) && d.status !== 'voided');
  }, [documents, kind, selected]);

  const outstanding = related
    .filter((d) => (d.kind === 'invoice' || d.kind === 'bill') && d.status === 'posted')
    .reduce((s, d) => s + (d.totalMinor - d.paidMinor), 0);

  const set = (key: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setBusy(true);
      setError('');
      const id = await createParty({
        id: editing?.id,
        kind,
        name: form.name,
        email: form.email,
        phone: form.phone,
        website: form.website,
        contactName: form.contactName,
        taxId: form.taxId,
        address: form.address,
        city: form.city,
        state: form.state,
        pincode: form.pincode,
        notes: form.notes,
        paymentTermsDays: Number(form.terms) || 0,
        logoPath: editing?.logoPath || null,
      });
      if (pendingLogo) {
        const stored = await uploadFile({ domain: `${kind}-logo`, resourceId: id, file: pendingLogo });
        await createParty({
          id,
          kind,
          name: form.name,
          email: form.email,
          phone: form.phone,
          website: form.website,
          contactName: form.contactName,
          taxId: form.taxId,
          address: form.address,
          city: form.city,
          state: form.state,
          pincode: form.pincode,
          notes: form.notes,
          paymentTermsDays: Number(form.terms) || 0,
          logoPath: stored.path,
        });
      }
      setOpen(false);
      setEditing(null);
      setPendingLogo(null);
      setForm(emptyForm());
    } catch (err: any) {
      setError(err.message || 'Could not save');
    } finally {
      setBusy(false);
    }
  };

  const openEdit = (party?: FinanceParty) => {
    setEditing(party || null);
    setForm(party ? fromParty(party) : emptyForm());
    setOpen(true);
    setPendingLogo(null);
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

  return (
    <PageShell
      title={title}
      subtitle={kind === 'customer'
        ? 'Master record for receivables: identity, tax, address, logo, and linked invoices.'
        : 'Master record for payables: identity, tax, address, logo, and linked bills.'}
      actions={can('create') && <button className={btnPrimary} onClick={() => openEdit()}>New {kind}</button>}
    >
      <div className="grid lg:grid-cols-[1.15fr_0.85fr] gap-5">
        <div className="space-y-5">
          {open && (
            <Card className="p-5 space-y-5">
              <div>
                <p className="text-[10px] uppercase tracking-[0.16em] text-[#12B8A8] font-semibold">{editing ? 'Edit record' : 'New record'}</p>
                <h2 className="font-display text-xl mt-1">{editing ? editing.name : `Add ${kind}`}</h2>
              </div>
              <form onSubmit={submit} className="space-y-5">
                <section className="grid md:grid-cols-2 gap-3">
                  <Field label="Legal / display name"><input className={inputClass} value={form.name} onChange={set('name')} required /></Field>
                  <Field label="Primary contact"><input className={inputClass} value={form.contactName} onChange={set('contactName')} /></Field>
                  <Field label="Email"><input type="email" className={inputClass} value={form.email} onChange={set('email')} /></Field>
                  <Field label="Phone"><input className={inputClass} value={form.phone} onChange={set('phone')} /></Field>
                  <Field label="Website"><input className={inputClass} value={form.website} onChange={set('website')} /></Field>
                  <Field label="GSTIN / Tax ID"><input className={inputClass} value={form.taxId} onChange={set('taxId')} /></Field>
                  <Field label="Payment terms (days)"><input className={inputClass} value={form.terms} onChange={set('terms')} /></Field>
                </section>
                <section className="grid md:grid-cols-2 gap-3">
                  <Field label="Address"><input className={inputClass} value={form.address} onChange={set('address')} /></Field>
                  <Field label="City"><input className={inputClass} value={form.city} onChange={set('city')} /></Field>
                  <Field label="State"><input className={inputClass} value={form.state} onChange={set('state')} /></Field>
                  <Field label="PIN"><input className={inputClass} value={form.pincode} onChange={set('pincode')} /></Field>
                  <div className="md:col-span-2">
                    <Field label="Internal notes"><textarea className={inputClass} rows={3} value={form.notes} onChange={set('notes')} /></Field>
                  </div>
                </section>
                <FileField
                  label={`${title.slice(0, -1)} logo`}
                  accept="image/png,image/jpeg,image/webp"
                  hint={pendingLogo ? pendingLogo.name : 'PNG, JPG, or WEBP · 8 MB max. Shown on invoices, bills, and statements.'}
                  onFiles={(files) => setPendingLogo(files[0] || null)}
                />
                <div className="flex gap-2">
                  <button className={btnPrimary} disabled={busy}>{busy ? 'Saving…' : 'Save record'}</button>
                  <button type="button" className={btnGhost} onClick={() => { setOpen(false); setEditing(null); }}>Cancel</button>
                  {error && <p className="text-sm text-rose-600">{error}</p>}
                </div>
              </form>
            </Card>
          )}

          <Card>
            {rows.length === 0 ? <Empty text={`No ${title.toLowerCase()} yet.`} /> : (
              <>
              <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[640px]">
                <thead className="text-left text-[#6B7280] border-b border-[#E5E7EB]">
                  <tr>
                    <th className="px-4 py-3 font-medium">Party</th>
                    <th className="px-4 py-3 font-medium">Contact</th>
                    <th className="px-4 py-3 font-medium">Tax</th>
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

        <Card className="p-5 h-fit">
          {!selected ? (
            <Empty text={`Select a ${kind} to see the full profile, logo, and linked documents.`} />
          ) : (
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 rounded-2xl bg-[#F3F4F6] overflow-hidden flex items-center justify-center text-[#0B1F3A] font-bold">
                    {logoUrl ? <img src={logoUrl} alt="" className="w-full h-full object-cover" /> : selected.name.slice(0, 1)}
                  </div>
                  <div>
                    <h2 className="font-display text-xl">{selected.name}</h2>
                    <p className="text-sm text-[#6B7280]">{selected.contactName || selected.email || 'No contact yet'}</p>
                  </div>
                </div>
                {can('edit') && <button className={btnGhost} onClick={() => openEdit(selected)}>Edit</button>}
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><p className="text-[#6B7280]">Email</p><p>{selected.email || '—'}</p></div>
                <div><p className="text-[#6B7280]">Phone</p><p>{selected.phone || '—'}</p></div>
                <div><p className="text-[#6B7280]">GSTIN</p><p>{selected.taxId || '—'}</p></div>
                <div><p className="text-[#6B7280]">Terms</p><p>{selected.paymentTermsDays} days</p></div>
                <div className="col-span-2"><p className="text-[#6B7280]">Address</p><p>{[selected.address, selected.city, selected.state, selected.pincode].filter(Boolean).join(', ') || '—'}</p></div>
                {selected.notes && <div className="col-span-2"><p className="text-[#6B7280]">Notes</p><p>{selected.notes}</p></div>}
              </div>
              <div className="rounded-2xl bg-[#F0FDFA] px-4 py-3">
                <p className="text-xs uppercase tracking-[0.14em] text-[#0f766e]">Open {kind === 'customer' ? 'receivable' : 'payable'}</p>
                <p className="text-xl font-display mt-1"><Money minor={outstanding} currency={currency} /></p>
              </div>
              <div>
                <p className="text-sm font-semibold mb-2">Linked documents</p>
                {related.length === 0 ? <p className="text-sm text-[#6B7280]">None yet.</p> : (
                  <ul className="space-y-2 text-sm">
                    {related.slice(0, 8).map((d) => (
                      <li key={d.id} className="flex justify-between gap-3">
                        <Link to={d.kind === 'bill' || d.kind === 'purchase_order' || d.kind === 'vendor_credit' ? '/books/bills' : '/books/invoices'} className="underline underline-offset-2">{d.number}</Link>
                        <span className="flex items-center gap-2"><Status value={d.status} /><Money minor={d.totalMinor} currency={currency} /></span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </Card>
      </div>
    </PageShell>
  );
}

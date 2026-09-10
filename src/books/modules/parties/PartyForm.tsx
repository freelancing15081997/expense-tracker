import React, { useState } from 'react';
import { useBooks } from '../../context/BooksProvider';
import { formatMinorPlain, parseMoney } from '../../core/money';
import { btnGhost, Field, FileField, IconBtn, inputClass } from '../../ui';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../components/ui/Select';
import type { FinanceParty, PartyKind } from '../../core/types';

const GST_TREATMENTS = [
  { id: '', label: 'Not specified' },
  { id: 'registered', label: 'Registered' },
  { id: 'unregistered', label: 'Unregistered' },
  { id: 'consumer', label: 'Consumer' },
  { id: 'composition', label: 'Composition' },
  { id: 'sez', label: 'SEZ' },
  { id: 'overseas', label: 'Overseas' },
];

type Form = {
  name: string;
  email: string;
  phone: string;
  website: string;
  contactName: string;
  taxId: string;
  pan: string;
  gstTreatment: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  shippingAddress: string;
  shippingCity: string;
  shippingState: string;
  shippingPincode: string;
  creditLimit: string;
  notes: string;
  terms: string;
};

const emptyForm = (): Form => ({
  name: '', email: '', phone: '', website: '', contactName: '', taxId: '', pan: '', gstTreatment: 'registered',
  address: '', city: '', state: '', pincode: '',
  shippingAddress: '', shippingCity: '', shippingState: '', shippingPincode: '',
  creditLimit: '', notes: '', terms: '30',
});

export function fromParty(p: FinanceParty): Form {
  return {
    name: p.name,
    email: p.email,
    phone: p.phone || '',
    website: p.website || '',
    contactName: p.contactName || '',
    taxId: p.taxId,
    pan: p.pan || '',
    gstTreatment: p.gstTreatment || '',
    address: p.address || '',
    city: p.city || '',
    state: p.state || '',
    pincode: p.pincode || '',
    shippingAddress: p.shippingAddress || '',
    shippingCity: p.shippingCity || '',
    shippingState: p.shippingState || '',
    shippingPincode: p.shippingPincode || '',
    creditLimit: p.creditLimitMinor ? formatMinorPlain(p.creditLimitMinor) : '',
    notes: p.notes || '',
    terms: String(p.paymentTermsDays || 0),
  };
}

export function PartyForm({
  kind,
  editing,
  onCancel,
  onSaved,
}: {
  kind: PartyKind;
  editing?: FinanceParty | null;
  onCancel: () => void;
  onSaved: (id: string, snapshot?: {
    name: string;
    email?: string;
    taxId?: string;
    address?: string;
    city?: string;
    state?: string;
    pincode?: string;
    phone?: string;
    paymentTermsDays?: number;
  }) => void;
}) {
  const { createParty, uploadFile } = useBooks();
  const [form, setForm] = useState<Form>(editing ? fromParty(editing) : emptyForm());
  const [pendingLogo, setPendingLogo] = useState<File | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const title = kind === 'customer' ? 'Customers' : 'Vendors';
  const set = (key: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const payload = (id?: string, logoPath?: string | null) => ({
    id,
    kind,
    name: form.name,
    email: form.email,
    phone: form.phone,
    website: form.website,
    contactName: form.contactName,
    taxId: form.taxId,
    pan: form.pan,
    gstTreatment: form.gstTreatment,
    address: form.address,
    city: form.city,
    state: form.state,
    pincode: form.pincode,
    shippingAddress: form.shippingAddress,
    shippingCity: form.shippingCity,
    shippingState: form.shippingState,
    shippingPincode: form.shippingPincode,
    creditLimitMinor: form.creditLimit.trim() ? parseMoney(form.creditLimit) : 0,
    notes: form.notes,
    paymentTermsDays: Number(form.terms) || 0,
    logoPath: logoPath === undefined ? (editing?.logoPath || null) : logoPath,
  });

  return (
    <form
      className="space-y-5"
      onSubmit={async (e) => {
        e.preventDefault();
        try {
          setBusy(true);
          setError('');
          const id = await createParty(payload(editing?.id));
          const next = payload(id);
          if (pendingLogo) {
            const stored = await uploadFile({ domain: `${kind}-logo`, resourceId: id, file: pendingLogo });
            try {
              await createParty(payload(id, stored.path));
            } catch (linkErr: any) {
              setError(stored.quotaBlocked
                ? (stored.message || 'Party saved. Logo is stored. Wait a minute and try linking it again.')
                : (linkErr.message || 'Could not link logo'));
              onSaved(id, next);
              return;
            }
          }
          onSaved(id, next);
        } catch (err: any) {
          setError(err.message || 'Could not save');
        } finally {
          setBusy(false);
        }
      }}
    >
      <section className="grid md:grid-cols-2 gap-3">
        <Field label={kind === 'customer' ? 'Customer name' : 'Vendor name'}><input className={inputClass} value={form.name} onChange={set('name')} required /></Field>
        <Field label="Primary contact"><input className={inputClass} value={form.contactName} onChange={set('contactName')} /></Field>
        <Field label="Email"><input type="email" className={inputClass} value={form.email} onChange={set('email')} /></Field>
        <Field label="Phone"><input className={inputClass} value={form.phone} onChange={set('phone')} /></Field>
        <Field label="Website"><input className={inputClass} value={form.website} onChange={set('website')} /></Field>
        <Field label="GSTIN / Tax ID"><input className={inputClass} value={form.taxId} onChange={set('taxId')} /></Field>
        <Field label="PAN"><input className={inputClass} value={form.pan} onChange={set('pan')} /></Field>
        <Field label="GST treatment">
          <Select value={form.gstTreatment || 'none'} onValueChange={(value) => setForm((f) => ({ ...f, gstTreatment: value === 'none' ? '' : value }))}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {GST_TREATMENTS.map((t) => (
                <SelectItem key={t.id || 'none'} value={t.id || 'none'}>{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label={kind === 'customer' ? 'Payment terms they get (days)' : 'Payment terms they give (days)'}><input className={inputClass} value={form.terms} onChange={set('terms')} /></Field>
        {kind === 'customer' && <Field label="Credit limit"><input className={inputClass} value={form.creditLimit} onChange={set('creditLimit')} placeholder="0.00" /></Field>}
      </section>
      <section className="grid md:grid-cols-2 gap-3">
        <Field label={kind === 'customer' ? 'Billing address' : 'Vendor address'}><input className={inputClass} value={form.address} onChange={set('address')} /></Field>
        <Field label="City"><input className={inputClass} value={form.city} onChange={set('city')} /></Field>
        <Field label="State"><input className={inputClass} value={form.state} onChange={set('state')} /></Field>
        <Field label="PIN"><input className={inputClass} value={form.pincode} onChange={set('pincode')} /></Field>
        <Field label={kind === 'customer' ? 'Shipping address' : 'Remit / pickup address'}><input className={inputClass} value={form.shippingAddress} onChange={set('shippingAddress')} placeholder={kind === 'customer' ? 'Leave blank to use billing' : 'Leave blank to use vendor address'} /></Field>
        <Field label={kind === 'customer' ? 'Shipping city' : 'Remit city'}><input className={inputClass} value={form.shippingCity} onChange={set('shippingCity')} /></Field>
        <Field label={kind === 'customer' ? 'Shipping state' : 'Remit state'}><input className={inputClass} value={form.shippingState} onChange={set('shippingState')} /></Field>
        <Field label={kind === 'customer' ? 'Shipping PIN' : 'Remit PIN'}><input className={inputClass} value={form.shippingPincode} onChange={set('shippingPincode')} /></Field>
        <div className="md:col-span-2">
          <Field label="Internal notes"><textarea className={inputClass} rows={3} value={form.notes} onChange={set('notes')} /></Field>
        </div>
      </section>
      <FileField
        label={`${title.slice(0, -1)} logo`}
        accept="image/png,image/jpeg,image/webp"
        files={pendingLogo}
        hint={pendingLogo ? pendingLogo.name : 'PNG, JPG, or WEBP · 8 MB max. Shown on invoices, bills, and statements.'}
        onFiles={(files) => setPendingLogo(files[0] || null)}
      />
      <div className="flex gap-2">
        <IconBtn action="save" type="submit" busy={busy}>{busy ? 'Saving record' : 'Save record'}</IconBtn>
        <button type="button" className={btnGhost} onClick={onCancel}>Cancel</button>
        {error && <p className="text-sm text-rose-600">{error}</p>}
      </div>
    </form>
  );
}

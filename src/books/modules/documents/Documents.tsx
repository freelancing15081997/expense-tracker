import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useBooks } from '../../context/BooksProvider';
import { addDays, formatMoney, lineAmount, parseMoney, parseQty, todayISO } from '../../core/money';
import { useAppPrefs } from '../../../context/AppPrefsContext';
import { computeDocument } from '../../engine/tax';
import { Plus, Trash2 } from 'lucide-react';
import { btnGhost, btnPrimary, Card, DateField, Empty, Field, FileField, IconBtn, inputClass, Money, PageShell, RecordFlyout, AttachmentList, Status } from '../../ui';
import { MenuDropdown } from '../../ui/MenuDropdown';
import { Pager, usePaging } from '../../ui/PagedList';
import { printFinanceDocument } from '../../reporting/printDocument';
import { booksFileUrl } from '../../storage/adapter';
import { formatMinorPlain } from '../../core/money';
import type { DocumentKind, DocumentLineInput, FinanceDocument } from '../../core/types';
import { documentProfile } from './kindProfile';
import { PartyForm } from '../parties/PartyForm';

type LineForm = { description: string; qty: string; price: string; taxCode: string; accountId: string };

const emptyLine = (accountId: string, taxCode: string): LineForm => ({
  description: '',
  qty: '1',
  price: '',
  taxCode,
  accountId,
});

function partyBlock(p: { name: string; taxId?: string; address?: string; city?: string; state?: string; pincode?: string; phone?: string; email?: string; shippingAddress?: string; shippingCity?: string; shippingState?: string; shippingPincode?: string }, shipping = false) {
  const lines = shipping
    ? [p.name, p.shippingAddress || p.address, [p.shippingCity || p.city, p.shippingState || p.state, p.shippingPincode || p.pincode].filter(Boolean).join(', ')]
    : [p.name, p.address, [p.city, p.state, p.pincode].filter(Boolean).join(', '), p.taxId ? `GSTIN ${p.taxId}` : '', p.phone, p.email];
  return lines.filter(Boolean).join('\n');
}

function linePreviewMinor(line: LineForm): number | null {
  try {
    return lineAmount(parseQty(line.qty), parseMoney(line.price));
  } catch {
    return null;
  }
}

export default function Documents({ kind }: { kind: DocumentKind }) {
  const books = useBooks();
  const { prefs } = useAppPrefs();
  const { documents, parties, postingAccounts, taxCodes, currency, can, projects, files, uploadFile } = books;
  const profile = documentProfile(kind);
  const allRows = documents.filter((d) => d.kind === kind && d.status !== 'voided');
  const partyKind = profile.partyRole;
  const defaultAccount = postingAccounts.find((a) => a.systemKey === (profile.accountSide === 'income' ? 'sales' : 'operating_expense'))?.id || '';
  const defaultTax = profile.showTax
    ? (taxCodes[0]?.id || 'GST18')
    : (taxCodes.find((t) => t.rateBps === 0)?.id || taxCodes.find((t) => t.id === 'EXEMPT')?.id || taxCodes[0]?.id || 'EXEMPT');
  const cashAccounts = postingAccounts.filter((a) => a.systemKey === 'cash' || a.systemKey === 'bank');
  const title = profile.plural;
  const convertTo = profile.convertTo;
  const canPost = profile.canPost;

  const [open, setOpen] = useState(false);
  const [partyId, setPartyId] = useState('');
  const [date, setDate] = useState(todayISO());
  const [dueDate, setDueDate] = useState(addDays(todayISO(), prefs.defaultPaymentTermsDays));
  const [searchParams] = useSearchParams();
  const [memo, setMemo] = useState('');
  useEffect(() => {
    const fromTemplate = searchParams.get('memo');
    if (fromTemplate) {
      setMemo(fromTemplate);
      setOpen(true);
    }
    const openId = searchParams.get('open');
    if (openId) setSelectedId(openId);
  }, [searchParams]);
  const [interstate, setInterstate] = useState(prefs.interstateDefault);
  const [payFrom, setPayFrom] = useState(
    cashAccounts.find((a) => a.systemKey === prefs.defaultCashAccount)?.id || cashAccounts[0]?.id || '',
  );
  const [lines, setLines] = useState<LineForm[]>([emptyLine(defaultAccount, defaultTax)]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [pay, setPay] = useState<{ id: string; amount: string; date: string; accountId: string } | null>(null);
  const [apply, setApply] = useState<{ creditId: string; targetId: string; amount: string } | null>(null);
  const [projectId, setProjectId] = useState('');
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [quickOpen, setQuickOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [savingHint, setSavingHint] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [poNumber, setPoNumber] = useState('');
  const [customerNotes, setCustomerNotes] = useState('');
  const [terms, setTerms] = useState('Payment due as per terms. Goods once sold are subject to the recorded tax treatment.');
  const [placeOfSupply, setPlaceOfSupply] = useState('');
  const [billTo, setBillTo] = useState('');
  const [shipTo, setShipTo] = useState('');
  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allRows.filter((d) => {
      if (statusFilter !== 'all' && d.status !== statusFilter) return false;
      if (!q) return true;
      const party = parties.find((p) => p.id === d.partyId);
      return [d.number, d.memo, d.poNumber, party?.name].some((v) => (v || '').toLowerCase().includes(q));
    });
  }, [allRows, parties, search, statusFilter]);
  const paging = usePaging(rows, prefs.listPageSize);

  const preview = useMemo(() => {
    try {
      const parsed = parseLines(lines, profile.showQty, profile.showTax ? null : defaultTax);
      return computeDocument(parsed, new Map(taxCodes.map((t) => [t.id, t])), profile.showInterstate ? interstate : false);
    } catch {
      return null;
    }
  }, [lines, taxCodes, interstate, profile.showQty, profile.showTax, profile.showInterstate, defaultTax]);

  const resetForm = () => {
    setEditingId(null);
    setMemo('');
    setPendingFiles([]);
    setPoNumber('');
    setCustomerNotes('');
    setBillTo('');
    setShipTo('');
    setPartyId('');
    setLines([emptyLine(defaultAccount, defaultTax)]);
    setPlaceOfSupply('');
    setTerms(books.tenant?.invoiceFooter || profile.defaultTerms);
  };

  const loadForm = (row: FinanceDocument) => {
    setEditingId(row.id);
    setPartyId(row.partyId || '');
    setDate(row.date);
    setDueDate(row.dueDate || addDays(row.date, 30));
    setMemo(row.memo || '');
    setInterstate(row.interstate);
    setProjectId(row.projectId || '');
    setPoNumber(row.poNumber || '');
    setCustomerNotes(row.customerNotes || '');
    setTerms(row.terms || books.tenant?.invoiceFooter || '');
    setPlaceOfSupply(row.placeOfSupply || '');
    setBillTo(row.billTo || '');
    setShipTo(row.shipTo || '');
    setPendingFiles([]);
    setLines(row.lines.length
      ? row.lines.map((line) => ({
          description: line.description,
          qty: String(line.qtyMilli / 1000),
          price: formatMinorPlain(line.unitPriceMinor),
          taxCode: line.taxCode,
          accountId: line.accountId,
        }))
      : [emptyLine(defaultAccount, defaultTax)]);
    setOpen(true);
    setError('');
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setBusy(true);
      setError('');
      if (partyKind && kind !== 'purchase_request' && !partyId) throw new Error(`Select a ${partyKind}`);
      const id = await books.createDocument({
        id: editingId || undefined,
        kind,
        partyId: partyId || null,
        date,
        dueDate: profile.dueDateLabel ? dueDate : null,
        lines: parseLines(lines, profile.showQty, profile.showTax ? null : defaultTax),
        interstate: profile.showInterstate ? interstate : false,
        memo,
        projectId: projectId || null,
        poNumber,
        customerNotes,
        terms,
        placeOfSupply,
        billTo,
        shipTo,
      });
      const queued = pendingFiles.slice();
      setOpen(false);
      resetForm();
      setBusy(false);
      if (queued.length) {
        setSavingHint('Saving supporting files…');
        Promise.all(queued.map((file) => uploadFile({ domain: kind, resourceId: id, file })))
          .catch((err) => setError(err?.message || 'Document saved. A supporting file failed — attach it from the preview.'))
          .finally(() => setSavingHint(''));
      }
    } catch (err: any) {
      if (err?.name === 'CancelledError') return;
      setError(err.message || 'Could not save');
      setBusy(false);
    }
  };

  return (
    <PageShell
      title={title}
      subtitle={profile.meaning}
      actions={can('create') && (
        <IconBtn
          action="create"
          onClick={() => {
            setError('');
            resetForm();
            setOpen(true);
          }}
        >
          {profile.createLabel}
        </IconBtn>
      )}
    >
      {savingHint && <p className="text-xs text-slate-500">{savingHint}</p>}
      {open && (
        <Card className="p-5 space-y-6">
          <form onSubmit={submit} className="space-y-6">
            <section>
              <p className="text-[10px] uppercase tracking-[0.16em] text-[#12B8A8] font-semibold">{profile.singular}</p>
              <h2 className="font-display text-xl mt-1">{editingId ? `Edit ${profile.singular.toLowerCase()}` : profile.createLabel}</h2>
              <p className="text-sm text-[#6B7280] mt-1">{profile.formIntro}</p>
            </section>
            <section className="grid md:grid-cols-3 gap-3">
              {partyKind && (
                <Field label={profile.partyLabel}>
                  <MenuDropdown
                    triggerLabel={parties.find((p) => p.id === partyId)?.name || `Select ${partyKind}`}
                    triggerHint={profile.partyHint}
                    items={parties.filter((p) => p.kind === partyKind && p.active).map((p) => ({
                      id: p.id,
                      label: p.name,
                      hint: p.taxId || p.email || 'No tax id',
                      onSelect: () => {
                        setPartyId(p.id);
                        setDueDate(addDays(date, p.paymentTermsDays || 30));
                        setPlaceOfSupply(p.state || '');
                        setInterstate(Boolean(p.state && books.tenant?.state && p.state !== books.tenant.state));
                        setBillTo(partyBlock(p));
                        setShipTo(partyBlock(p, true));
                      },
                    }))}
                    footer={{
                      id: 'add-party',
                      label: `Add ${partyKind}`,
                      icon: <Plus className="w-4 h-4" />,
                      onSelect: () => setQuickOpen(true),
                    }}
                  />
                </Field>
              )}
              <Field label={profile.issueDateLabel}><DateField value={date} onChange={setDate} required /></Field>
              {profile.dueDateLabel && <Field label={profile.dueDateLabel}><DateField value={dueDate} onChange={setDueDate} /></Field>}
              <Field label={profile.memoLabel}><input className={inputClass} value={memo} onChange={(e) => setMemo(e.target.value)} placeholder={profile.memoPlaceholder} /></Field>
              {profile.referenceLabel && <Field label={profile.referenceLabel}><input className={inputClass} value={poNumber} onChange={(e) => setPoNumber(e.target.value)} placeholder={profile.referencePlaceholder} /></Field>}
              {profile.placeOfSupplyLabel && <Field label={profile.placeOfSupplyLabel}><input className={inputClass} value={placeOfSupply} onChange={(e) => setPlaceOfSupply(e.target.value)} placeholder="State" /></Field>}
              {profile.showProject && projects.length > 0 && (
                <Field label="Project">
                  <select className={inputClass} value={projectId} onChange={(e) => setProjectId(e.target.value)}>
                    <option value="">None</option>
                    {projects.filter((p) => p.status === 'open').map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </Field>
              )}
              {kind === 'expense' && cashAccounts.length > 0 && (
                <Field label="Pay from">
                  <select className={inputClass} value={payFrom} onChange={(e) => setPayFrom(e.target.value)}>
                    {cashAccounts.map((a) => <option key={a.id} value={a.id}>{a.code} {a.name}</option>)}
                  </select>
                </Field>
              )}
              {profile.showInterstate && (
                <label className="flex items-center gap-2 text-sm text-[#0B1F3A] mt-7">
                  <input type="checkbox" checked={interstate} onChange={(e) => setInterstate(e.target.checked)} />
                  Interstate supply (IGST)
                </label>
              )}
              <FileField
                label={profile.fileLabel}
                accept=".pdf,image/png,image/jpeg,image/webp,.xlsx,.csv,.txt"
                multiple
                files={pendingFiles}
                hint={pendingFiles.length > 0 ? `${pendingFiles.length} file(s) will upload when you save the draft.` : profile.fileHint}
                onFiles={setPendingFiles}
              />
            </section>
            {(profile.billToLabel || profile.shipToLabel) && (
              <section className="grid md:grid-cols-2 gap-3">
                {profile.billToLabel && <Field label={profile.billToLabel}><textarea className={inputClass} rows={4} value={billTo} onChange={(e) => setBillTo(e.target.value)} placeholder={profile.billToPlaceholder} /></Field>}
                {profile.shipToLabel && <Field label={profile.shipToLabel}><textarea className={inputClass} rows={4} value={shipTo} onChange={(e) => setShipTo(e.target.value)} placeholder={profile.shipToPlaceholder} /></Field>}
              </section>
            )}
            <section>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold">Line items</p>
                <button type="button" className={btnGhost} onClick={() => setLines((rows) => [...rows, emptyLine(defaultAccount, defaultTax)])}>Add line</button>
              </div>
              <div className="overflow-x-auto rounded-2xl border border-[#E5E7EB]">
                <table className="w-full text-sm">
                  <thead className="bg-[#F8FAFC] text-left text-[#6B7280]">
                    <tr>
                      <th className="px-3 py-2 font-medium">Description</th>
                      {profile.showQty && <th className="px-3 py-2 font-medium w-24">{profile.qtyLabel}</th>}
                      <th className="px-3 py-2 font-medium w-28">{profile.rateLabel}</th>
                      {profile.showTax && <th className="px-3 py-2 font-medium w-36">Tax</th>}
                      {profile.showAccount && <th className="px-3 py-2 font-medium">{profile.accountLabel}</th>}
                      <th className="px-3 py-2 font-medium text-right w-28">Amount</th>
                      <th className="px-3 py-2 font-medium w-12"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((line, i) => (
                      <tr key={i} className="border-t border-[#F3F4F6]">
                        <td className="p-2"><input className={inputClass} placeholder={profile.linePlaceholder} value={line.description} onChange={(e) => setLines((rows) => rows.map((r, idx) => idx === i ? { ...r, description: e.target.value } : r))} /></td>
                        {profile.showQty && <td className="p-2"><input className={inputClass} value={line.qty} onChange={(e) => setLines((rows) => rows.map((r, idx) => idx === i ? { ...r, qty: e.target.value } : r))} /></td>}
                        <td className="p-2"><input className={inputClass} value={line.price} onChange={(e) => setLines((rows) => rows.map((r, idx) => idx === i ? { ...r, price: e.target.value } : r))} /></td>
                        {profile.showTax && (
                          <td className="p-2">
                            <select className={inputClass} value={line.taxCode} onChange={(e) => setLines((rows) => rows.map((r, idx) => idx === i ? { ...r, taxCode: e.target.value } : r))}>
                              {taxCodes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                            </select>
                          </td>
                        )}
                        {profile.showAccount && (
                          <td className="p-2">
                            <select className={inputClass} value={line.accountId} onChange={(e) => setLines((rows) => rows.map((r, idx) => idx === i ? { ...r, accountId: e.target.value } : r))}>
                              {postingAccounts.filter((a) => profile.accountSide === 'income' ? a.type === 'revenue' || a.type === 'other_income' : a.type === 'expense' || a.type === 'cogs' || a.type === 'asset').map((a) => (
                                <option key={a.id} value={a.id}>{a.code} {a.name}</option>
                              ))}
                            </select>
                          </td>
                        )}
                        <td className="p-2 text-right tabular-nums text-sm">
                          {linePreviewMinor(line) == null ? '—' : formatMoney(linePreviewMinor(line)!, currency)}
                        </td>
                        <td className="p-2">
                          <button
                            type="button"
                            className="p-2 text-[#6B7280] hover:text-rose-600 disabled:opacity-30"
                            disabled={lines.length === 1}
                            onClick={() => setLines((rows) => rows.filter((_, idx) => idx !== i))}
                            aria-label="Remove line"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
            {(profile.notesLabel || profile.termsLabel) && (
              <section className="grid md:grid-cols-2 gap-3">
                {profile.notesLabel && (
                  <Field label={profile.notesLabel}>
                    <textarea className={inputClass} rows={3} value={customerNotes} onChange={(e) => setCustomerNotes(e.target.value)} placeholder={profile.notesPlaceholder} />
                  </Field>
                )}
                {profile.termsLabel && (
                  <Field label={profile.termsLabel}>
                    <textarea className={inputClass} rows={3} value={terms} onChange={(e) => setTerms(e.target.value)} />
                  </Field>
                )}
              </section>
            )}
            <div className="flex flex-wrap gap-3 items-start justify-between">
              <div className="flex gap-2">
                <IconBtn action="save" type="submit" busy={busy}>{busy ? 'Saving draft' : editingId ? 'Update draft' : 'Save draft'}</IconBtn>
                <button type="button" className={btnGhost} onClick={() => setOpen(false)}>Cancel</button>
              </div>
              {preview && (
                <div className="min-w-[240px] rounded-2xl border border-[#E5E7EB] bg-[#F8FAFC] px-4 py-3 text-sm space-y-1">
                  <div className="flex justify-between gap-6"><span className="text-[#6B7280]">{profile.showTax ? 'Taxable' : 'Amount'}</span><span>{formatMoney(preview.tax.exclusiveMinor, currency)}</span></div>
                  {profile.showTax && (preview.tax.igstMinor > 0
                    ? <div className="flex justify-between gap-6"><span className="text-[#6B7280]">IGST</span><span>{formatMoney(preview.tax.igstMinor, currency)}</span></div>
                    : (
                      <>
                        <div className="flex justify-between gap-6"><span className="text-[#6B7280]">CGST</span><span>{formatMoney(preview.tax.cgstMinor, currency)}</span></div>
                        <div className="flex justify-between gap-6"><span className="text-[#6B7280]">SGST</span><span>{formatMoney(preview.tax.sgstMinor, currency)}</span></div>
                      </>
                    ))}
                  <div className="flex justify-between gap-6 pt-1 border-t border-[#E5E7EB] font-semibold"><span>Total</span><span>{formatMoney(preview.totalMinor, currency)}</span></div>
                </div>
              )}
              {error && <p className="text-sm text-rose-600">{error}</p>}
            </div>
          </form>
        </Card>
      )}
      {quickOpen && partyKind && (
        <Card className="p-5 space-y-4">
          <div>
            <p className="text-[10px] uppercase tracking-[0.16em] text-[#12B8A8] font-semibold">New {partyKind}</p>
            <h2 className="font-display text-xl mt-1">{partyKind === 'customer' ? 'Add customer' : 'Add vendor'}</h2>
            <p className="text-sm text-slate-500 mt-1">Save the full {partyKind} record, then continue this {profile.singular.toLowerCase()}.</p>
          </div>
          <PartyForm
            kind={partyKind}
            onCancel={() => setQuickOpen(false)}
            onSaved={(id, created) => {
              setPartyId(id);
              setDueDate(addDays(date, created?.paymentTermsDays || 30));
              setPlaceOfSupply(created?.state || '');
              setInterstate(Boolean(created?.state && books.tenant?.state && created.state !== books.tenant.state));
              if (created) {
                setBillTo(partyBlock(created));
                setShipTo(partyBlock(created, true));
              }
              setQuickOpen(false);
            }}
          />
        </Card>
      )}
      <Card>
        <div className="flex flex-wrap gap-3 p-4 border-b border-[#E5E7EB]">
          <input className={`${inputClass} max-w-sm`} value={search} onChange={(e) => setSearch(e.target.value)} placeholder={`Search ${profile.singular.toLowerCase()}, ${profile.listParty.toLowerCase()}, ${profile.listRef.toLowerCase()}`} />
          <select className={`${inputClass} max-w-[180px]`} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">All statuses</option>
            <option value="draft">Draft</option>
            <option value="posted">Posted</option>
            <option value="paid">Paid</option>
          </select>
        </div>
        {rows.length === 0 ? <Empty text={allRows.length === 0 ? `No ${title.toLowerCase()} yet.` : 'No documents match this search.'} /> : (
          <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[720px]">
            <thead className="text-left text-slate-500 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 font-medium">Number</th>
                <th className="px-4 py-3 font-medium">{profile.issueDateLabel}</th>
                <th className="px-4 py-3 font-medium">{profile.listParty}</th>
                <th className="px-4 py-3 font-medium">{profile.listRef}</th>
                <th className="px-4 py-3 font-medium text-right">Total</th>
                {profile.listDue && <th className="px-4 py-3 font-medium text-right">{profile.listDue}</th>}
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {paging.slice.map((row) => {
                const party = parties.find((p) => p.id === row.partyId);
                const due = row.totalMinor - row.paidMinor;
                return (
                  <tr key={row.id} className="border-b border-slate-100 align-top cursor-pointer hover:bg-[#F8FAFC]" onClick={() => setSelectedId(row.id)}>
                    <td className="px-4 py-2.5 font-medium">{row.number}</td>
                    <td className="px-4 py-2.5">{row.date}</td>
                    <td className="px-4 py-2.5">{party?.name || (kind === 'expense' ? (row.memo || '—') : '—')}</td>
                    <td className="px-4 py-2.5 text-[#6B7280]">{row.poNumber || row.memo || '—'}</td>
                    <td className="px-4 py-2.5 text-right"><Money minor={row.totalMinor} currency={currency} /></td>
                    {profile.listDue && (
                      <td className="px-4 py-2.5 text-right">
                        {profile.canPay || kind === 'credit_note' || kind === 'vendor_credit'
                          ? <Money minor={due} currency={currency} />
                          : (row.dueDate || '—')}
                      </td>
                    )}
                    <td className="px-4 py-2.5"><Status value={row.status} /></td>
                    <td className="px-4 py-2.5" onClick={(e) => e.stopPropagation()}>
                      <div className="flex flex-wrap gap-2 justify-end">
                        {row.status === 'draft' && can('edit') && (
                          <button className={btnGhost} onClick={() => loadForm(row)}>Edit</button>
                        )}
                        {row.status === 'draft' && canPost && can('post') && (
                          <IconBtn action="post" onClick={() => books.postDoc(row.id, kind === 'expense' ? (payFrom || cashAccounts[0]?.id) : undefined)}>Post</IconBtn>
                        )}
                        {row.status === 'draft' && convertTo && can('create') && (
                          <button className={btnPrimary} onClick={() => books.convertDoc(row.id, convertTo).catch((err) => setError(err.message))}>{profile.convertLabel}</button>
                        )}
                        {row.status === 'draft' && can('void') && (
                          <button className={btnGhost} onClick={() => books.voidDoc(row.id)}>Void</button>
                        )}
                        {profile.canPrint && (
                          <button className={btnGhost} onClick={async () => {
                            const party = parties.find((p) => p.id === row.partyId) || null;
                            const companyLogo = books.tenant?.logoPath ? await booksFileUrl(books.tenant.logoPath) : undefined;
                            const partyLogo = party?.logoPath ? await booksFileUrl(party.logoPath) : undefined;
                            printFinanceDocument({ tenant: books.tenant!, document: row, party, companyLogo, partyLogo });
                          }}>Print</button>
                        )}
                        {(row.status === 'posted') && due > 0 && profile.canPay && can('post') && (
                          <button className={btnGhost} onClick={() => setPay({ id: row.id, amount: (due / 100).toFixed(2), date: todayISO(), accountId: cashAccounts[0]?.id || '' })}>Payment</button>
                        )}
                        {(kind === 'credit_note' || kind === 'vendor_credit') && (row.status === 'posted' || row.status === 'paid') && due > 0 && can('post') && (
                          <button className={btnGhost} onClick={() => setApply({ creditId: row.id, targetId: '', amount: (due / 100).toFixed(2) })}>Apply</button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <Pager page={paging.page} pages={paging.pages} total={paging.total} pageSize={paging.pageSize} onPage={paging.setPage} />
          </div>
        )}
      </Card>
      {selectedId && (() => {
        const row = allRows.find((d) => d.id === selectedId);
        if (!row) return null;
        const party = parties.find((p) => p.id === row.partyId);
        const attached = files.filter((f) => f.resourceId === row.id && f.status !== 'archived');
        const canEdit = row.status === 'draft' && can('edit');
        return (
          <RecordFlyout
            title={row.number}
            subtitle={`${profile.singular} · ${party?.name || (kind === 'expense' ? (row.memo || 'Books expense') : 'No party')} · ${row.date}`}
            onClose={() => setSelectedId(null)}
            actions={canEdit && (
              <button type="button" className={btnGhost} onClick={() => { loadForm(row); setSelectedId(null); }}>
                Edit
              </button>
            )}
          >
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><p className="text-xs text-slate-500">Status</p><Status value={row.status} /></div>
              <div><p className="text-xs text-slate-500">Total</p><p className="font-semibold"><Money minor={row.totalMinor} currency={currency} /></p></div>
              <div><p className="text-xs text-slate-500">{profile.listRef}</p><p>{row.poNumber || row.memo || '—'}</p></div>
              {profile.placeOfSupplyLabel && <div><p className="text-xs text-slate-500">{profile.placeOfSupplyLabel}</p><p>{row.placeOfSupply || '—'}</p></div>}
              {profile.dueDateLabel && <div><p className="text-xs text-slate-500">{profile.dueDateLabel}</p><p>{row.dueDate || '—'}</p></div>}
              {profile.billToLabel && <div className="col-span-2 whitespace-pre-line"><p className="text-xs text-slate-500">{profile.billToLabel}</p><p>{row.billTo || (party ? partyBlock(party) : '—')}</p></div>}
              {profile.shipToLabel && <div className="col-span-2 whitespace-pre-line"><p className="text-xs text-slate-500">{profile.shipToLabel}</p><p>{row.shipTo || '—'}</p></div>}
            </div>
            <div className="rounded-2xl border border-slate-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-slate-500">
                  <tr>
                    <th className="px-3 py-2 font-medium">Description</th>
                    {profile.showQty && <th className="px-3 py-2 font-medium text-right">{profile.qtyLabel}</th>}
                    <th className="px-3 py-2 font-medium text-right">{profile.rateLabel}</th>
                  </tr>
                </thead>
                <tbody>
                  {row.lines.map((line, i) => (
                    <tr key={i} className="border-t border-slate-100">
                      <td className="px-3 py-2">{line.description}</td>
                      {profile.showQty && <td className="px-3 py-2 text-right">{(line.qtyMilli / 1000).toFixed(3)}</td>}
                      <td className="px-3 py-2 text-right">{formatMoney(line.unitPriceMinor, currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div>
              <p className="text-sm font-semibold mb-2">Supporting documents</p>
              <AttachmentList files={attached} empty="No files attached to this record." />
              {can('create') && (
                <div className="mt-3">
                  <FileField
                    label="Add a file"
                    accept=".pdf,image/png,image/jpeg,image/webp,.xlsx,.csv,.txt"
                    hint="Attaches immediately to this record."
                    onFiles={(picked) => {
                      const file = picked[0];
                      if (!file) return;
                      setSavingHint('Uploading file…');
                      uploadFile({ domain: kind, resourceId: row.id, file })
                        .catch((err) => setError(err.message || 'Upload failed'))
                        .finally(() => setSavingHint(''));
                    }}
                  />
                </div>
              )}
            </div>
            {(row.customerNotes || row.terms) && (
              <div className="grid gap-3 text-sm">
                {row.customerNotes && profile.notesLabel && <div><p className="text-xs text-slate-500">{profile.notesLabel}</p><p className="whitespace-pre-line">{row.customerNotes}</p></div>}
                {row.terms && profile.termsLabel && <div><p className="text-xs text-slate-500">{profile.termsLabel}</p><p className="whitespace-pre-line">{row.terms}</p></div>}
              </div>
            )}
          </RecordFlyout>
        );
      })()}
      {pay && (
        <Card className="p-4">
          <form
            className="grid md:grid-cols-4 gap-3"
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                setBusy(true);
                await books.payDoc(pay.id, parseMoney(pay.amount), pay.date, pay.accountId);
                setPay(null);
              } catch (err: any) {
                setError(err.message || 'Payment failed');
              } finally {
                setBusy(false);
              }
            }}
          >
            <Field label="Amount"><input className={inputClass} value={pay.amount} onChange={(e) => setPay({ ...pay, amount: e.target.value })} /></Field>
            <Field label="Date"><DateField value={pay.date} onChange={(iso) => setPay({ ...pay, date: iso })} /></Field>
            <Field label="Deposit / pay from">
              <select className={inputClass} value={pay.accountId} onChange={(e) => setPay({ ...pay, accountId: e.target.value })}>
                {cashAccounts.map((a) => <option key={a.id} value={a.id}>{a.code} {a.name}</option>)}
              </select>
            </Field>
            <div className="flex items-end gap-2">
              <IconBtn action="save" type="submit" busy={busy}>{busy ? 'Recording' : 'Record'}</IconBtn>
              <button type="button" className={btnGhost} onClick={() => setPay(null)}>Cancel</button>
            </div>
          </form>
          {error && <p className="text-sm text-rose-600 mt-2">{error}</p>}
        </Card>
      )}
      {apply && (() => {
        const credit = documents.find((d) => d.id === apply.creditId);
        const targetKind = kind === 'credit_note' ? 'invoice' : 'bill';
        const targets = documents.filter((d) => d.kind === targetKind && d.partyId && d.partyId === credit?.partyId && (d.status === 'posted' || d.status === 'paid') && d.paidMinor < d.totalMinor);
        return (
          <Card className="p-4">
            <form
              className="grid md:grid-cols-3 gap-3"
              onSubmit={async (e) => {
                e.preventDefault();
                try {
                  setBusy(true);
                  setError('');
                  if (!apply.targetId) throw new Error(targetKind === 'invoice' ? 'Select an invoice' : 'Select a bill');
                  await books.applyDocCredit(apply.creditId, apply.targetId, parseMoney(apply.amount));
                  setApply(null);
                } catch (err: any) {
                  setError(err.message || 'Could not apply credit');
                } finally {
                  setBusy(false);
                }
              }}
            >
              <Field label={targetKind === 'invoice' ? 'Apply to invoice' : 'Apply to bill'}>
                <select className={inputClass} value={apply.targetId} onChange={(e) => {
                  const target = targets.find((d) => d.id === e.target.value);
                  const unused = credit ? credit.totalMinor - credit.paidMinor : 0;
                  const outstanding = target ? target.totalMinor - target.paidMinor : unused;
                  setApply({ ...apply, targetId: e.target.value, amount: (Math.min(unused, outstanding) / 100).toFixed(2) });
                }}>
                  <option value="">{targets.length ? 'Select' : 'No open documents for this party'}</option>
                  {targets.map((d) => (
                    <option key={d.id} value={d.id}>{d.number} · {formatMinorPlain(d.totalMinor - d.paidMinor)} open</option>
                  ))}
                </select>
              </Field>
              <Field label="Amount"><input className={inputClass} value={apply.amount} onChange={(e) => setApply({ ...apply, amount: e.target.value })} /></Field>
              <div className="flex items-end gap-2">
                <button className={btnPrimary} disabled={busy || !apply.targetId}>Apply</button>
                <button type="button" className={btnGhost} onClick={() => setApply(null)}>Cancel</button>
              </div>
            </form>
            {error && <p className="text-sm text-rose-600 mt-2">{error}</p>}
          </Card>
        );
      })()}
    </PageShell>
  );
}

function parseLines(lines: LineForm[], showQty: boolean, forceTax: string | null): DocumentLineInput[] {
  return lines.map((line) => ({
    description: line.description,
    qtyMilli: showQty ? parseQty(line.qty) : parseQty('1'),
    unitPriceMinor: parseMoney(line.price),
    taxCode: forceTax || line.taxCode,
    accountId: line.accountId,
  }));
}

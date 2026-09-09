import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useBooks } from '../../context/BooksProvider';
import { addDays, formatMoney, lineAmount, parseMoney, parseQty, todayISO } from '../../core/money';
import { computeDocument } from '../../engine/tax';
import { Plus, Trash2 } from 'lucide-react';
import { btnGhost, btnPrimary, Card, Empty, Field, FileField, IconBtn, inputClass, Money, PageShell, Status } from '../../ui';
import { MenuDropdown } from '../../ui/MenuDropdown';
import { Pager, usePaging } from '../../ui/PagedList';
import { printFinanceDocument } from '../../reporting/printDocument';
import { booksFileUrl } from '../../storage/adapter';
import type { DocumentKind, DocumentLineInput } from '../../core/types';

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
  const { documents, parties, postingAccounts, taxCodes, currency, can, projects } = books;
  const allRows = documents.filter((d) => d.kind === kind && d.status !== 'voided');
  const salesKinds = ['invoice', 'quote', 'credit_note'];
  const partyKind = kind === 'expense' ? null : salesKinds.includes(kind) ? 'customer' : 'vendor';
  const defaultAccount = postingAccounts.find((a) => a.systemKey === (salesKinds.includes(kind) ? 'sales' : 'operating_expense'))?.id || '';
  const cashAccounts = postingAccounts.filter((a) => a.systemKey === 'cash' || a.systemKey === 'bank');
  const titles: Record<DocumentKind, string> = {
    invoice: 'Invoices',
    bill: 'Bills',
    expense: 'Books Expenses',
    quote: 'Quotes',
    credit_note: 'Credit Notes',
    purchase_order: 'Purchase Orders',
    vendor_credit: 'Vendor Credits',
  };
  const title = titles[kind];
  const convertTo = kind === 'quote' ? 'invoice' : kind === 'purchase_order' ? 'bill' : null;
  const canPost = kind !== 'quote' && kind !== 'purchase_order';

  const [open, setOpen] = useState(false);
  const [partyId, setPartyId] = useState('');
  const [date, setDate] = useState(todayISO());
  const [dueDate, setDueDate] = useState(addDays(todayISO(), 30));
  const [searchParams] = useSearchParams();
  const [memo, setMemo] = useState('');
  useEffect(() => {
    const fromTemplate = searchParams.get('memo');
    if (fromTemplate) {
      setMemo(fromTemplate);
      setOpen(true);
    }
  }, [searchParams]);
  const [interstate, setInterstate] = useState(false);
  const [payFrom, setPayFrom] = useState(cashAccounts[0]?.id || '');
  const [lines, setLines] = useState<LineForm[]>([emptyLine(defaultAccount, taxCodes[0]?.id || 'GST18')]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [pay, setPay] = useState<{ id: string; amount: string; date: string; accountId: string } | null>(null);
  const [projectId, setProjectId] = useState('');
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [quickOpen, setQuickOpen] = useState(false);
  const [quickName, setQuickName] = useState('');
  const [quickEmail, setQuickEmail] = useState('');
  const [quickTax, setQuickTax] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
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
  const paging = usePaging(rows, 10);

  const preview = useMemo(() => {
    try {
      const parsed = parseLines(lines);
      return computeDocument(parsed, new Map(taxCodes.map((t) => [t.id, t])), interstate);
    } catch {
      return null;
    }
  }, [lines, taxCodes, interstate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setBusy(true);
      setError('');
      if (kind !== 'expense' && !partyId) throw new Error(partyKind === 'customer' ? 'Select a customer' : 'Select a vendor');
      const id = await books.createDocument({
        kind,
        partyId: partyId || null,
        date,
        dueDate: kind === 'expense' ? null : dueDate,
        lines: parseLines(lines),
        interstate,
        memo,
        projectId: projectId || null,
        poNumber,
        customerNotes,
        terms,
        placeOfSupply,
        billTo,
        shipTo,
      });
      for (const file of pendingFiles) {
        await books.uploadFile({ domain: kind, resourceId: id, file });
      }
      setOpen(false);
      setMemo('');
      setPendingFiles([]);
      setPoNumber('');
      setCustomerNotes('');
      setBillTo('');
      setShipTo('');
      setPartyId('');
      setLines([emptyLine(defaultAccount, taxCodes[0]?.id || 'GST18')]);
      setPlaceOfSupply('');
      setTerms(books.tenant?.invoiceFooter || 'Payment due as per terms. Goods once sold are subject to the recorded tax treatment.');
    } catch (err: any) {
      setError(err.message || 'Could not save');
    } finally {
      setBusy(false);
    }
  };

  return (
    <PageShell
      title={title}
      subtitle={kind === 'expense' ? 'Separate from Expense Tracker. Posting writes the journal immediately on pay-from account.' : 'Draft → post (journal) → payment (journal). Totals are computed by the tax engine.'}
      actions={can('create') && (
        <IconBtn
          action="create"
          onClick={() => {
            setError('');
            setOpen(true);
            setPartyId('');
            setMemo('');
            setPoNumber('');
            setCustomerNotes('');
            setBillTo('');
            setShipTo('');
            setPlaceOfSupply('');
            setTerms(books.tenant?.invoiceFooter || 'Payment due as per terms. Goods once sold are subject to the recorded tax treatment.');
            setLines([emptyLine(defaultAccount, taxCodes[0]?.id || 'GST18')]);
          }}
        >
          New {kind}
        </IconBtn>
      )}
    >
      {open && (
        <Card className="p-5 space-y-6">
          <form onSubmit={submit} className="space-y-6">
            <section>
              <p className="text-[10px] uppercase tracking-[0.16em] text-[#12B8A8] font-semibold">Document</p>
              <h2 className="font-display text-xl mt-1">New {title.slice(0, -1).toLowerCase()}</h2>
              <p className="text-sm text-[#6B7280] mt-1">Draft only until you post. Tax is computed by the engine, not typed in.</p>
            </section>
            <section className="grid md:grid-cols-3 gap-3">
              {kind !== 'expense' && (
                <Field label={partyKind === 'customer' ? 'Customer' : 'Vendor'}>
                  <MenuDropdown
                    triggerLabel={parties.find((p) => p.id === partyId)?.name || `Select ${partyKind}`}
                    triggerHint={partyKind === 'customer' ? 'Receivable party' : 'Payable party'}
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
              <Field label="Issue date"><input type="date" className={inputClass} value={date} onChange={(e) => setDate(e.target.value)} required /></Field>
              {kind !== 'expense' && <Field label="Due date"><input type="date" className={inputClass} value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></Field>}
              <Field label="Reference / memo"><input className={inputClass} value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="Internal memo" /></Field>
              {kind !== 'expense' && <Field label={kind === 'bill' || kind === 'purchase_order' ? 'Vendor invoice / PO' : 'PO / reference'}><input className={inputClass} value={poNumber} onChange={(e) => setPoNumber(e.target.value)} placeholder="PO-1024" /></Field>}
              {kind !== 'expense' && <Field label="Place of supply"><input className={inputClass} value={placeOfSupply} onChange={(e) => setPlaceOfSupply(e.target.value)} placeholder="State" /></Field>}
              {projects.length > 0 && (
                <Field label="Project">
                  <select className={inputClass} value={projectId} onChange={(e) => setProjectId(e.target.value)}>
                    <option value="">None</option>
                    {projects.filter((p) => p.status === 'open').map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </Field>
              )}
              <label className="flex items-center gap-2 text-sm text-[#0B1F3A] mt-7">
                <input type="checkbox" checked={interstate} onChange={(e) => setInterstate(e.target.checked)} />
                Interstate supply (IGST)
              </label>
              <FileField
                label="Supporting files (receipt, PO, contract)"
                accept=".pdf,image/png,image/jpeg,image/webp,.xlsx,.csv,.txt"
                multiple
                files={pendingFiles}
                hint={pendingFiles.length > 0 ? `${pendingFiles.length} file(s) will upload when you save the draft.` : 'Receipt, PO, or contract. 8 MB max per file.'}
                onFiles={setPendingFiles}
              />
            </section>
            {kind !== 'expense' && (
              <section className="grid md:grid-cols-2 gap-3">
                <Field label="Bill to"><textarea className={inputClass} rows={4} value={billTo} onChange={(e) => setBillTo(e.target.value)} placeholder="Legal name, billing address, GSTIN" /></Field>
                <Field label="Ship to"><textarea className={inputClass} rows={4} value={shipTo} onChange={(e) => setShipTo(e.target.value)} placeholder="Delivery address if different" /></Field>
              </section>
            )}
            <section>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold">Line items</p>
                <button type="button" className={btnGhost} onClick={() => setLines((rows) => [...rows, emptyLine(defaultAccount, taxCodes[0]?.id || 'GST18')])}>Add line</button>
              </div>
              <div className="overflow-x-auto rounded-2xl border border-[#E5E7EB]">
                <table className="w-full text-sm">
                  <thead className="bg-[#F8FAFC] text-left text-[#6B7280]">
                    <tr>
                      <th className="px-3 py-2 font-medium">Description</th>
                      <th className="px-3 py-2 font-medium w-24">Qty</th>
                      <th className="px-3 py-2 font-medium w-28">Rate</th>
                      <th className="px-3 py-2 font-medium w-36">Tax</th>
                      <th className="px-3 py-2 font-medium">Account</th>
                      <th className="px-3 py-2 font-medium text-right w-28">Amount</th>
                      <th className="px-3 py-2 font-medium w-12"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((line, i) => (
                      <tr key={i} className="border-t border-[#F3F4F6]">
                        <td className="p-2"><input className={inputClass} placeholder="What is this for?" value={line.description} onChange={(e) => setLines((rows) => rows.map((r, idx) => idx === i ? { ...r, description: e.target.value } : r))} /></td>
                        <td className="p-2"><input className={inputClass} value={line.qty} onChange={(e) => setLines((rows) => rows.map((r, idx) => idx === i ? { ...r, qty: e.target.value } : r))} /></td>
                        <td className="p-2"><input className={inputClass} value={line.price} onChange={(e) => setLines((rows) => rows.map((r, idx) => idx === i ? { ...r, price: e.target.value } : r))} /></td>
                        <td className="p-2">
                          <select className={inputClass} value={line.taxCode} onChange={(e) => setLines((rows) => rows.map((r, idx) => idx === i ? { ...r, taxCode: e.target.value } : r))}>
                            {taxCodes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                          </select>
                        </td>
                        <td className="p-2">
                          <select className={inputClass} value={line.accountId} onChange={(e) => setLines((rows) => rows.map((r, idx) => idx === i ? { ...r, accountId: e.target.value } : r))}>
                            {postingAccounts.filter((a) => salesKinds.includes(kind) ? a.type === 'revenue' || a.type === 'other_income' : a.type === 'expense' || a.type === 'cogs' || a.type === 'asset').map((a) => (
                              <option key={a.id} value={a.id}>{a.code} {a.name}</option>
                            ))}
                          </select>
                        </td>
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
            <section className="grid md:grid-cols-2 gap-3">
              <Field label={kind === 'bill' || kind === 'purchase_order' || kind === 'vendor_credit' ? 'Notes to vendor' : 'Notes to customer'}>
                <textarea className={inputClass} rows={3} value={customerNotes} onChange={(e) => setCustomerNotes(e.target.value)} placeholder="Shown on the printed document" />
              </Field>
              <Field label="Terms & conditions">
                <textarea className={inputClass} rows={3} value={terms} onChange={(e) => setTerms(e.target.value)} />
              </Field>
            </section>
            <div className="flex flex-wrap gap-3 items-start justify-between">
              <div className="flex gap-2">
                <IconBtn action="save" disabled={busy}>{busy ? 'Saving…' : 'Save draft'}</IconBtn>
                <button type="button" className={btnGhost} onClick={() => setOpen(false)}>Cancel</button>
              </div>
              {preview && (
                <div className="min-w-[240px] rounded-2xl border border-[#E5E7EB] bg-[#F8FAFC] px-4 py-3 text-sm space-y-1">
                  <div className="flex justify-between gap-6"><span className="text-[#6B7280]">Taxable</span><span>{formatMoney(preview.tax.exclusiveMinor, currency)}</span></div>
                  {preview.tax.igstMinor > 0
                    ? <div className="flex justify-between gap-6"><span className="text-[#6B7280]">IGST</span><span>{formatMoney(preview.tax.igstMinor, currency)}</span></div>
                    : (
                      <>
                        <div className="flex justify-between gap-6"><span className="text-[#6B7280]">CGST</span><span>{formatMoney(preview.tax.cgstMinor, currency)}</span></div>
                        <div className="flex justify-between gap-6"><span className="text-[#6B7280]">SGST</span><span>{formatMoney(preview.tax.sgstMinor, currency)}</span></div>
                      </>
                    )}
                  <div className="flex justify-between gap-6 pt-1 border-t border-[#E5E7EB] font-semibold"><span>Total</span><span>{formatMoney(preview.totalMinor, currency)}</span></div>
                </div>
              )}
              {error && <p className="text-sm text-rose-600">{error}</p>}
            </div>
          </form>
        </Card>
      )}
      {quickOpen && partyKind && (
        <Card className="p-4">
          <form
            className="grid md:grid-cols-4 gap-3"
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                const id = await books.createParty({
                  kind: partyKind,
                  name: quickName,
                  email: quickEmail,
                  taxId: quickTax,
                  paymentTermsDays: 30,
                });
                const created = { name: quickName, email: quickEmail, taxId: quickTax, address: '', city: '', state: '', pincode: '', phone: '' };
                setPartyId(id);
                setDueDate(addDays(date, 30));
                setBillTo(partyBlock(created));
                setShipTo(partyBlock(created, true));
                setQuickOpen(false);
                setQuickName('');
                setQuickEmail('');
                setQuickTax('');
              } catch (err: any) {
                setError(err.message || 'Could not add party');
              }
            }}
          >
            <Field label={`${partyKind} name`}><input className={inputClass} value={quickName} onChange={(e) => setQuickName(e.target.value)} required /></Field>
            <Field label="Email"><input type="email" className={inputClass} value={quickEmail} onChange={(e) => setQuickEmail(e.target.value)} /></Field>
            <Field label="GSTIN"><input className={inputClass} value={quickTax} onChange={(e) => setQuickTax(e.target.value)} /></Field>
            <div className="flex items-end gap-2">
              <button className={btnPrimary}>Save & select</button>
              <button type="button" className={btnGhost} onClick={() => setQuickOpen(false)}>Cancel</button>
            </div>
          </form>
        </Card>
      )}
      <Card>
        <div className="flex flex-wrap gap-3 p-4 border-b border-[#E5E7EB]">
          <input className={`${inputClass} max-w-sm`} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search number, party, PO, memo" />
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
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Party</th>
                <th className="px-4 py-3 font-medium">Reference</th>
                <th className="px-4 py-3 font-medium text-right">Total</th>
                <th className="px-4 py-3 font-medium text-right">Due</th>
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
                    <td className="px-4 py-2.5">{party?.name || (kind === 'expense' ? '—' : 'Unknown')}</td>
                    <td className="px-4 py-2.5 text-[#6B7280]">{row.poNumber || row.placeOfSupply || '—'}</td>
                    <td className="px-4 py-2.5 text-right"><Money minor={row.totalMinor} currency={currency} /></td>
                    <td className="px-4 py-2.5 text-right"><Money minor={due} currency={currency} /></td>
                    <td className="px-4 py-2.5"><Status value={row.status} /></td>
                    <td className="px-4 py-2.5" onClick={(e) => e.stopPropagation()}>
                      <div className="flex flex-wrap gap-2 justify-end">
                        {row.status === 'draft' && canPost && can('post') && (
                          <IconBtn action="post" onClick={() => books.postDoc(row.id, kind === 'expense' ? (payFrom || cashAccounts[0]?.id) : undefined)}>Post</IconBtn>
                        )}
                        {row.status === 'draft' && convertTo && can('create') && (
                          <button className={btnPrimary} onClick={() => books.convertDoc(row.id, convertTo).catch((err) => setError(err.message))}>Convert</button>
                        )}
                        {row.status === 'draft' && can('void') && (
                          <button className={btnGhost} onClick={() => books.voidDoc(row.id)}>Void</button>
                        )}
                        {(row.status === 'posted' || row.status === 'paid') && (kind === 'invoice' || kind === 'bill' || kind === 'quote') && (
                          <button className={btnGhost} onClick={async () => {
                            const party = parties.find((p) => p.id === row.partyId) || null;
                            const companyLogo = books.tenant?.logoPath ? await booksFileUrl(books.tenant.logoPath) : undefined;
                            const partyLogo = party?.logoPath ? await booksFileUrl(party.logoPath) : undefined;
                            printFinanceDocument({ tenant: books.tenant!, document: row, party, companyLogo, partyLogo });
                          }}>Print</button>
                        )}
                        {(row.status === 'posted') && due > 0 && (kind === 'invoice' || kind === 'bill') && can('post') && (
                          <button className={btnGhost} onClick={() => setPay({ id: row.id, amount: (due / 100).toFixed(2), date: todayISO(), accountId: cashAccounts[0]?.id || '' })}>Payment</button>
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
        return (
          <Card className="p-5 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-[0.16em] text-[#12B8A8] font-semibold">{row.kind.replace('_', ' ')}</p>
                <h2 className="font-display text-xl mt-1">{row.number}</h2>
                <p className="text-sm text-[#6B7280]">{party?.name || 'No party'} · {row.date}{row.dueDate ? ` · due ${row.dueDate}` : ''}</p>
              </div>
              <button type="button" className={btnGhost} onClick={() => setSelectedId(null)}>Close</button>
            </div>
            <div className="grid md:grid-cols-3 gap-4 text-sm">
              <div><p className="text-[#6B7280]">Status</p><Status value={row.status} /></div>
              <div><p className="text-[#6B7280]">PO / reference</p><p>{row.poNumber || row.memo || '—'}</p></div>
              <div><p className="text-[#6B7280]">Place of supply</p><p>{row.placeOfSupply || '—'}</p></div>
              <div className="whitespace-pre-line"><p className="text-[#6B7280]">Bill to</p><p>{row.billTo || (party ? partyBlock(party) : '—')}</p></div>
              <div className="whitespace-pre-line"><p className="text-[#6B7280]">Ship to</p><p>{row.shipTo || '—'}</p></div>
              <div>
                <p className="text-[#6B7280]">Totals</p>
                <p>Taxable {formatMoney(row.tax.exclusiveMinor, currency)}</p>
                {row.tax.igstMinor > 0
                  ? <p>IGST {formatMoney(row.tax.igstMinor, currency)}</p>
                  : <p>CGST {formatMoney(row.tax.cgstMinor, currency)} · SGST {formatMoney(row.tax.sgstMinor, currency)}</p>}
                <p className="font-semibold">Total {formatMoney(row.totalMinor, currency)}</p>
              </div>
            </div>
            <div className="overflow-x-auto rounded-2xl border border-[#E5E7EB]">
              <table className="w-full text-sm">
                <thead className="bg-[#F8FAFC] text-left text-[#6B7280]">
                  <tr>
                    <th className="px-3 py-2 font-medium">Description</th>
                    <th className="px-3 py-2 font-medium text-right">Qty</th>
                    <th className="px-3 py-2 font-medium text-right">Rate</th>
                    <th className="px-3 py-2 font-medium">Tax</th>
                  </tr>
                </thead>
                <tbody>
                  {row.lines.map((line, i) => (
                    <tr key={i} className="border-t border-[#F3F4F6]">
                      <td className="px-3 py-2">{line.description}</td>
                      <td className="px-3 py-2 text-right">{(line.qtyMilli / 1000).toFixed(3)}</td>
                      <td className="px-3 py-2 text-right">{formatMoney(line.unitPriceMinor, currency)}</td>
                      <td className="px-3 py-2">{line.taxCode}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {(row.customerNotes || row.terms) && (
              <div className="grid md:grid-cols-2 gap-4 text-sm">
                {row.customerNotes && <div><p className="text-[#6B7280]">Notes</p><p className="whitespace-pre-line">{row.customerNotes}</p></div>}
                {row.terms && <div><p className="text-[#6B7280]">Terms</p><p className="whitespace-pre-line">{row.terms}</p></div>}
              </div>
            )}
          </Card>
        );
      })()}
      {kind === 'expense' && can('post') && cashAccounts.length > 0 && (
        <Field label="Pay Books expenses from">
          <select className={`${inputClass} max-w-sm`} value={payFrom} onChange={(e) => setPayFrom(e.target.value)}>
            {cashAccounts.map((a) => <option key={a.id} value={a.id}>{a.code} {a.name}</option>)}
          </select>
        </Field>
      )}
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
            <Field label="Date"><input type="date" className={inputClass} value={pay.date} onChange={(e) => setPay({ ...pay, date: e.target.value })} /></Field>
            <Field label="Deposit / pay from">
              <select className={inputClass} value={pay.accountId} onChange={(e) => setPay({ ...pay, accountId: e.target.value })}>
                {cashAccounts.map((a) => <option key={a.id} value={a.id}>{a.code} {a.name}</option>)}
              </select>
            </Field>
            <div className="flex items-end gap-2">
              <button className={btnPrimary} disabled={busy}>Record</button>
              <button type="button" className={btnGhost} onClick={() => setPay(null)}>Cancel</button>
            </div>
          </form>
          {error && <p className="text-sm text-rose-600 mt-2">{error}</p>}
        </Card>
      )}
    </PageShell>
  );
}

function parseLines(lines: LineForm[]): DocumentLineInput[] {
  return lines.map((line) => ({
    description: line.description,
    qtyMilli: parseQty(line.qty),
    unitPriceMinor: parseMoney(line.price),
    taxCode: line.taxCode,
    accountId: line.accountId,
  }));
}

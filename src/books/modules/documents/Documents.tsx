import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useBooks } from '../../context/BooksProvider';
import { addDays, formatMoney, parseMoney, parseQty, todayISO } from '../../core/money';
import { computeDocument } from '../../engine/tax';
import { Plus } from 'lucide-react';
import { btnGhost, btnPrimary, Card, Empty, Field, inputClass, Money, PageShell, Status } from '../../ui';
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

export default function Documents({ kind }: { kind: DocumentKind }) {
  const books = useBooks();
  const { documents, parties, postingAccounts, taxCodes, currency, can, projects } = books;
  const rows = documents.filter((d) => d.kind === kind && d.status !== 'voided');
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
      });
      for (const file of pendingFiles) {
        await books.uploadFile({ domain: kind, resourceId: id, file });
      }
      setOpen(false);
      setMemo('');
      setPendingFiles([]);
      setLines([emptyLine(defaultAccount, taxCodes[0]?.id || 'GST18')]);
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
      actions={can('create') && <button className={btnPrimary} onClick={() => setOpen(true)}>New {kind}</button>}
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
                      onSelect: () => setPartyId(p.id),
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
              <Field label="Reference / memo"><input className={inputClass} value={memo} onChange={(e) => setMemo(e.target.value)} /></Field>
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
              <Field label="Supporting files (receipt, PO, contract)">
                <input
                  type="file"
                  multiple
                  className="block text-sm"
                  onChange={(e) => {
                    setPendingFiles(Array.from(e.target.files || []));
                    e.target.value = '';
                  }}
                />
                {pendingFiles.length > 0 && <p className="text-xs text-[#6B7280] mt-1">{pendingFiles.length} file(s) will upload when you save the draft.</p>}
              </Field>
            </section>
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
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
            <div className="flex flex-wrap gap-3 items-center justify-between">
              <div className="flex gap-2">
                <button className={btnPrimary} disabled={busy}>{busy ? 'Saving…' : 'Save draft'}</button>
                <button type="button" className={btnGhost} onClick={() => setOpen(false)}>Cancel</button>
              </div>
              {preview && (
                <div className="text-sm text-[#4B5563]">
                  Taxable {formatMoney(preview.tax.exclusiveMinor, currency)} · Tax {formatMoney(preview.tax.taxMinor, currency)} · <strong className="text-[#0B1F3A]">Total {formatMoney(preview.totalMinor, currency)}</strong>
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
                setPartyId(id);
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
        {rows.length === 0 ? <Empty text={`No ${title.toLowerCase()} yet.`} /> : (
          <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[720px]">
            <thead className="text-left text-slate-500 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 font-medium">Number</th>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Party</th>
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
                  <tr key={row.id} className="border-b border-slate-100 align-top">
                    <td className="px-4 py-2.5 font-medium">{row.number}</td>
                    <td className="px-4 py-2.5">{row.date}</td>
                    <td className="px-4 py-2.5">{party?.name || (kind === 'expense' ? '—' : 'Unknown')}</td>
                    <td className="px-4 py-2.5 text-right"><Money minor={row.totalMinor} currency={currency} /></td>
                    <td className="px-4 py-2.5 text-right"><Money minor={due} currency={currency} /></td>
                    <td className="px-4 py-2.5"><Status value={row.status} /></td>
                    <td className="px-4 py-2.5">
                      <div className="flex flex-wrap gap-2 justify-end">
                        {row.status === 'draft' && canPost && can('post') && (
                          <button className={btnPrimary} onClick={() => books.postDoc(row.id, kind === 'expense' ? (payFrom || cashAccounts[0]?.id) : undefined)}>Post</button>
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

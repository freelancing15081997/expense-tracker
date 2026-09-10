import React, { useMemo, useState } from 'react';
import { useBooks } from '../../context/BooksProvider';
import { parseMoney, todayISO } from '../../core/money';
import { btnGhost, btnPrimary, Card, Field, IconBtn, inputClass, PageShell, Status } from '../../ui';
import { PagedTable } from '../../ui/PagedList';
import type { JournalLineInput, RecurringTemplate } from '../../core/types';

const emptyLine = () => ({ accountId: '', debit: '', credit: '' });

export default function Recurring() {
  const { recurring, postingAccounts, parties, taxCodes, currency, can, createRecurring, runRecurringTemplate } = useBooks();
  const [tab, setTab] = useState<'journal' | 'invoice' | 'bill'>('invoice');
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [lines, setLines] = useState([emptyLine(), emptyLine()]);
  const [partyId, setPartyId] = useState('');
  const [lineDesc, setLineDesc] = useState('');
  const [price, setPrice] = useState('');
  const [taxCode, setTaxCode] = useState(taxCodes[0]?.id || 'GST18');
  const [accountId, setAccountId] = useState('');
  const [dueDays, setDueDays] = useState('30');
  const [autoPost, setAutoPost] = useState(true);
  const [interstate, setInterstate] = useState(false);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [busy, setBusy] = useState(false);
  const [running, setRunning] = useState('');

  const rows = useMemo(
    () => recurring.filter((t) => (t.kind || 'journal') === tab),
    [recurring, tab],
  );
  const partyKind = tab === 'bill' ? 'vendor' : 'customer';
  const defaultAccount = postingAccounts.find((a) => a.systemKey === (tab === 'bill' ? 'operating_expense' : 'sales'))?.id || '';

  const reset = () => {
    setOpen(false);
    setName('');
    setDescription('');
    setLines([emptyLine(), emptyLine()]);
    setPartyId('');
    setLineDesc('');
    setPrice('');
    setError('');
  };

  return (
    <PageShell
      title="Recurring"
      subtitle="Templates create a new journal, invoice, or bill each run. Auto-post writes the ledger immediately."
      actions={can('create') && <IconBtn action="create" onClick={() => { setOpen(true); setError(''); }}>{tab === 'journal' ? 'New journal' : tab === 'bill' ? 'New bill' : 'New invoice'}</IconBtn>}
    >
      <div className="flex flex-wrap gap-2">
        {([['invoice', 'Invoices'], ['bill', 'Bills'], ['journal', 'Journals']] as const).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => { setTab(id); setOpen(false); }}
            className={`h-9 px-3 rounded-lg text-sm font-semibold ${tab === id ? 'bg-[#0B1F3A] text-white' : 'bg-white border border-slate-200 text-slate-700'}`}
          >
            {label}
          </button>
        ))}
      </div>
      {ok && <p className="text-sm text-emerald-700">{ok}</p>}
      {open && tab === 'journal' && (
        <Card className="p-4 space-y-3">
          <form
            className="space-y-3"
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                setBusy(true);
                setError('');
                const parsed: JournalLineInput[] = lines
                  .filter((line) => line.accountId && (line.debit || line.credit))
                  .map((line) => ({
                    accountId: line.accountId,
                    debitMinor: line.debit ? parseMoney(line.debit) : 0,
                    creditMinor: line.credit ? parseMoney(line.credit) : 0,
                  }));
                await createRecurring({ name, description, kind: 'journal', lines: parsed });
                reset();
                setOk('Journal template saved.');
              } catch (err: any) {
                setError(err.message || 'Could not save template');
              } finally {
                setBusy(false);
              }
            }}
          >
            <div className="grid md:grid-cols-2 gap-3">
              <Field label="Name"><input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} required /></Field>
              <Field label="Description"><input className={inputClass} value={description} onChange={(e) => setDescription(e.target.value)} /></Field>
            </div>
            {lines.map((line, i) => (
              <div key={i} className="grid md:grid-cols-3 gap-2">
                <select className={inputClass} value={line.accountId} onChange={(e) => setLines((rows) => rows.map((r, idx) => idx === i ? { ...r, accountId: e.target.value } : r))}>
                  <option value="">Account</option>
                  {postingAccounts.map((a) => <option key={a.id} value={a.id}>{a.code} {a.name}</option>)}
                </select>
                <input className={inputClass} placeholder="Debit" value={line.debit} onChange={(e) => setLines((rows) => rows.map((r, idx) => idx === i ? { ...r, debit: e.target.value, credit: '' } : r))} />
                <input className={inputClass} placeholder="Credit" value={line.credit} onChange={(e) => setLines((rows) => rows.map((r, idx) => idx === i ? { ...r, credit: e.target.value, debit: '' } : r))} />
              </div>
            ))}
            <div className="flex gap-2 items-center">
              <button type="button" className={btnGhost} onClick={() => setLines((rows) => [...rows, emptyLine()])}>Add line</button>
              <IconBtn action="save" type="submit" busy={busy}>{busy ? 'Saving template' : 'Save template'}</IconBtn>
              <button type="button" className={btnGhost} onClick={() => setOpen(false)}>Cancel</button>
              {error && <p className="text-sm text-rose-600">{error}</p>}
            </div>
          </form>
        </Card>
      )}
      {open && tab !== 'journal' && (
        <Card className="p-4">
          <form
            className="grid md:grid-cols-2 gap-3"
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                setBusy(true);
                setError('');
                await createRecurring({
                  name,
                  description: description || lineDesc,
                  kind: tab,
                  partyId,
                  interstate,
                  dueDays: Number(dueDays) || 30,
                  autoPost,
                  documentLines: [{
                    description: lineDesc || name,
                    qtyMilli: 1000,
                    unitPriceMinor: parseMoney(price),
                    taxCode,
                    accountId: accountId || defaultAccount,
                  }],
                });
                reset();
                setOk(`${tab === 'bill' ? 'Bill' : 'Invoice'} template saved.`);
              } catch (err: any) {
                setError(err.message || 'Could not save template');
              } finally {
                setBusy(false);
              }
            }}
          >
            <Field label="Name"><input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} required /></Field>
            <Field label={tab === 'bill' ? 'Vendor' : 'Customer'}>
              <select className={inputClass} value={partyId} onChange={(e) => setPartyId(e.target.value)} required>
                <option value="">Select</option>
                {parties.filter((p) => p.kind === partyKind && p.active).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </Field>
            <Field label="Line"><input className={inputClass} value={lineDesc} onChange={(e) => setLineDesc(e.target.value)} placeholder="Retainer / rent" required /></Field>
            <Field label={`Amount (${currency})`}><input className={inputClass} value={price} onChange={(e) => setPrice(e.target.value)} required /></Field>
            <Field label="Account">
              <select className={inputClass} value={accountId || defaultAccount} onChange={(e) => setAccountId(e.target.value)}>
                {postingAccounts.map((a) => <option key={a.id} value={a.id}>{a.code} {a.name}</option>)}
              </select>
            </Field>
            <Field label="Tax">
              <select className={inputClass} value={taxCode} onChange={(e) => setTaxCode(e.target.value)}>
                {taxCodes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </Field>
            <Field label="Due days"><input className={inputClass} value={dueDays} onChange={(e) => setDueDays(e.target.value)} /></Field>
            <label className="flex items-center gap-2 text-sm mt-6">
              <input type="checkbox" checked={autoPost} onChange={(e) => setAutoPost(e.target.checked)} />
              Post to the ledger when run
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={interstate} onChange={(e) => setInterstate(e.target.checked)} />
              Interstate (IGST)
            </label>
            <div className="md:col-span-2 flex gap-2 items-center">
              <IconBtn action="save" type="submit" busy={busy}>{busy ? 'Saving template' : 'Save template'}</IconBtn>
              <button type="button" className={btnGhost} onClick={() => setOpen(false)}>Cancel</button>
              {error && <p className="text-sm text-rose-600">{error}</p>}
            </div>
          </form>
        </Card>
      )}
      <PagedTable<RecurringTemplate> rows={rows} empty={`No ${tab} templates yet.`} minWidth="min-w-[560px]">
        {(slice) => (
          <ul className="divide-y divide-slate-100">
            {slice.map((row) => {
              const party = parties.find((p) => p.id === row.partyId);
              return (
                <li key={row.id} className="px-4 py-3 flex items-center justify-between gap-3 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{row.name}</p>
                    <p className="text-slate-500 truncate">
                      {party?.name || row.description || 'No party'}
                      {row.autoPost ? ' · auto-post' : ''}
                      {row.lastRunAt ? ` · last ${row.lastRunAt.slice(0, 10)}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Status value={row.kind || 'journal'} />
                    {can('post') && (
                      <button
                        className={btnPrimary}
                        disabled={running === row.id}
                        onClick={async () => {
                          try {
                            setRunning(row.id);
                            setError('');
                            setOk('');
                            await runRecurringTemplate(row, todayISO());
                            setOk(`Ran ${row.name}.`);
                          } catch (err: any) {
                            setError(err.message || 'Run failed');
                          } finally {
                            setRunning('');
                          }
                        }}
                      >
                        {running === row.id ? 'Running…' : 'Run now'}
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </PagedTable>
      {error && !open && <p className="text-sm text-rose-600">{error}</p>}
    </PageShell>
  );
}

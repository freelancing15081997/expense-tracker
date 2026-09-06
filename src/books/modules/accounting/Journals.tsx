import React, { useMemo, useState } from 'react';
import { useBooks } from '../../context/BooksProvider';
import { parseMoney, todayISO } from '../../core/money';
import { btnGhost, btnPrimary, Card, Empty, Field, inputClass, Money, PageShell, Status } from '../../ui';
import { Pager, usePaging } from '../../ui/PagedList';
import type { JournalLineInput } from '../../core/types';

const emptyLine = (): { accountId: string; debit: string; credit: string; memo: string } => ({ accountId: '', debit: '', credit: '', memo: '' });

export default function Journals() {
  const { journals, postingAccounts, currency, can, postJournal, reverse, accounts } = useBooks();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(todayISO());
  const [description, setDescription] = useState('');
  const [lines, setLines] = useState([emptyLine(), emptyLine()]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const accountName = (id: string) => accounts.find((a) => a.id === id)?.name || id;
  const paging = usePaging(journals, 10);

  const preview = useMemo(() => {
    try {
      return lines.map((line) => ({
        accountId: line.accountId,
        debitMinor: line.debit ? parseMoney(line.debit) : 0,
        creditMinor: line.credit ? parseMoney(line.credit) : 0,
        memo: line.memo,
      }));
    } catch {
      return null;
    }
  }, [lines]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setBusy(true);
      setError('');
      const parsed: JournalLineInput[] = lines.map((line) => ({
        accountId: line.accountId,
        debitMinor: line.debit ? parseMoney(line.debit) : 0,
        creditMinor: line.credit ? parseMoney(line.credit) : 0,
        memo: line.memo.trim(),
      }));
      await postJournal({ date, description, lines: parsed });
      setOpen(false);
      setDescription('');
      setLines([emptyLine(), emptyLine()]);
    } catch (err: any) {
      setError(err.message || 'Could not post journal');
    } finally {
      setBusy(false);
    }
  };

  return (
    <PageShell
      title="Journal Entries"
      subtitle="Posted journals are immutable. Corrections use a reversal."
      actions={can('post') && <button className={btnPrimary} onClick={() => setOpen(true)}>New journal</button>}
    >
      {open && (
        <Card className="p-4 space-y-3">
          <form onSubmit={submit} className="space-y-3">
            <div className="grid md:grid-cols-2 gap-3">
              <Field label="Date"><input type="date" className={inputClass} value={date} onChange={(e) => setDate(e.target.value)} required /></Field>
              <Field label="Description"><input className={inputClass} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Month-end adjustment" /></Field>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-slate-500">
                  <tr>
                    <th className="pb-2 font-medium">Account</th>
                    <th className="pb-2 font-medium">Debit</th>
                    <th className="pb-2 font-medium">Credit</th>
                    <th className="pb-2 font-medium">Memo</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line, i) => (
                    <tr key={i}>
                      <td className="pr-2 pb-2">
                        <select className={inputClass} value={line.accountId} onChange={(e) => setLines((rows) => rows.map((r, idx) => idx === i ? { ...r, accountId: e.target.value } : r))}>
                          <option value="">Select</option>
                          {postingAccounts.map((a) => <option key={a.id} value={a.id}>{a.code} {a.name}</option>)}
                        </select>
                      </td>
                      <td className="pr-2 pb-2"><input className={inputClass} value={line.debit} onChange={(e) => setLines((rows) => rows.map((r, idx) => idx === i ? { ...r, debit: e.target.value, credit: '' } : r))} /></td>
                      <td className="pr-2 pb-2"><input className={inputClass} value={line.credit} onChange={(e) => setLines((rows) => rows.map((r, idx) => idx === i ? { ...r, credit: e.target.value, debit: '' } : r))} /></td>
                      <td className="pb-2"><input className={inputClass} value={line.memo} onChange={(e) => setLines((rows) => rows.map((r, idx) => idx === i ? { ...r, memo: e.target.value } : r))} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap gap-2 items-center">
              <button type="button" className={btnGhost} onClick={() => setLines((rows) => [...rows, emptyLine()])}>Add line</button>
              <button className={btnPrimary} disabled={busy}>{busy ? 'Posting…' : 'Post journal'}</button>
              <button type="button" className={btnGhost} onClick={() => setOpen(false)}>Cancel</button>
              {preview && <span className="text-sm text-slate-500">Debit <Money minor={preview.reduce((s, l) => s + l.debitMinor, 0)} currency={currency} /> · Credit <Money minor={preview.reduce((s, l) => s + l.creditMinor, 0)} currency={currency} /></span>}
              {error && <p className="text-sm text-rose-600">{error}</p>}
            </div>
          </form>
        </Card>
      )}
      <Card>
        {journals.length === 0 ? <Empty text="No journals yet. Post an invoice, bill, expense, or manual entry." /> : (
          <div className="divide-y divide-slate-100">
            {paging.slice.map((journal) => (
              <details key={journal.id} className="px-4 py-3">
                <summary className="cursor-pointer flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-medium text-slate-800">{journal.number} · {journal.description}</span>
                  <span className="flex items-center gap-2">
                    <Money minor={journal.debitTotalMinor} currency={currency} />
                    <Status value={journal.status} />
                  </span>
                </summary>
                <div className="mt-3 text-sm">
                  <p className="text-slate-500 mb-2">{journal.date} · {journal.type}{journal.sourceId ? ` · source ${journal.sourceType}` : ''}</p>
                  <table className="w-full">
                    <tbody>
                      {journal.lines.map((line, i) => (
                        <tr key={i} className="border-t border-slate-100">
                          <td className="py-1.5">{accountName(line.accountId)}</td>
                          <td className="py-1.5 text-right tabular-nums">{line.debitMinor ? format(line.debitMinor, currency) : ''}</td>
                          <td className="py-1.5 text-right tabular-nums">{line.creditMinor ? format(line.creditMinor, currency) : ''}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {journal.status === 'posted' && can('reverse') && (
                    <button className={`${btnGhost} mt-3`} onClick={() => reverse(journal.id)}>Reverse</button>
                  )}
                </div>
              </details>
            ))}
            <Pager page={paging.page} pages={paging.pages} total={paging.total} pageSize={paging.pageSize} onPage={paging.setPage} />
          </div>
        )}
      </Card>
    </PageShell>
  );
}

function format(minor: number, currency: string) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency, minimumFractionDigits: 2 }).format(minor / 100);
}

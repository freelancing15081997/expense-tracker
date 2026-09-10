import React, { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useBooks } from '../../context/BooksProvider';
import { formatMoney, parseMoney, todayISO } from '../../core/money';
import { useAppPrefs } from '../../../context/AppPrefsContext';
import { btnGhost, Card, Empty, Field, IconBtn, inputClass, Money, PageShell, RecordFlyout, Status } from '../../ui';
import { Pager, usePaging } from '../../ui/PagedList';
import type { JournalLineInput } from '../../core/types';

const emptyLine = (): { accountId: string; debit: string; credit: string; memo: string } => ({ accountId: '', debit: '', credit: '', memo: '' });

export default function Journals() {
  const { journals, postingAccounts, currency, can, postJournal, reverse, accounts } = useBooks();
  const { prefs } = useAppPrefs();
  const [searchParams] = useSearchParams();
  const [selectedId, setSelectedId] = useState<string | null>(searchParams.get('open'));
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(todayISO());
  const [description, setDescription] = useState('');
  const [lines, setLines] = useState([emptyLine(), emptyLine()]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const accountName = (id: string) => accounts.find((a) => a.id === id)?.name || id;
  const paging = usePaging(journals, prefs.listPageSize);

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
      const parsed: JournalLineInput[] = lines
        .filter((line) => line.accountId && (line.debit || line.credit))
        .map((line) => ({
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
      if (err?.name === 'CancelledError') return;
      setError(err.message || 'Could not post journal');
    } finally {
      setBusy(false);
    }
  };

  return (
    <PageShell
      title="Journal Entries"
      subtitle="Posted journals are immutable. Corrections use a reversal."
      actions={can('post') && <IconBtn action="create" onClick={() => setOpen(true)}>New journal</IconBtn>}
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
              <IconBtn action="post" disabled={busy}>{busy ? 'Posting…' : 'Post journal'}</IconBtn>
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
              <button
                key={journal.id}
                type="button"
                className="w-full text-left px-4 py-3 hover:bg-slate-50 flex flex-wrap items-center justify-between gap-2"
                onClick={() => setSelectedId(journal.id)}
              >
                <span className="text-sm font-medium text-slate-800">{journal.number} · {journal.description}</span>
                <span className="flex items-center gap-2">
                  <Money minor={journal.debitTotalMinor} currency={currency} />
                  <Status value={journal.status} />
                </span>
              </button>
            ))}
            <Pager page={paging.page} pages={paging.pages} total={paging.total} pageSize={paging.pageSize} onPage={paging.setPage} />
          </div>
        )}
      </Card>
      {selectedId && (() => {
        const journal = journals.find((j) => j.id === selectedId);
        if (!journal) return null;
        return (
          <RecordFlyout
            title={journal.number}
            subtitle={`${journal.date} · ${journal.type}${journal.sourceId ? ` · ${journal.sourceType}` : ''}`}
            onClose={() => setSelectedId(null)}
            actions={journal.status === 'posted' && can('reverse') ? (
              <button className={btnGhost} onClick={() => reverse(journal.id)}>Reverse</button>
            ) : null}
          >
            <p className="text-sm font-medium">{journal.description}</p>
            <table className="w-full text-sm">
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
            <p className="text-sm text-slate-500">Journals are immutable after post. Use Reverse to correct.</p>
          </RecordFlyout>
        );
      })()}
    </PageShell>
  );
}

function format(minor: number, currency: string) {
  return formatMoney(minor, currency);
}

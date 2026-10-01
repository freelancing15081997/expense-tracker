import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { MoreVertical, Users, Settings as Cog, Pin, Download, Mail, Plus, Flag, Trash2, Copy, Filter, Paperclip, Scale } from 'lucide-react';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { getBook, listEntries, updateBook, deleteEntry, updateEntry, createEntry, listAudit, totals, categoriesOf, canEdit, PAYMENT_METHODS, type Book, type Expense } from '../lib/books';
import { listSettlements, reportSummary, type Settlement, type ReportSummary } from '../lib/money';
import { apiPost, isNative } from '../lib/api';
import { buildBookReportPdf } from '../lib/report-pdf';
import { useSession } from '../lib/session';
import { inr, inrPaise, niceDate, relTime, monthKey, todayIso, newId } from '../lib/format';
import { AppBar, Empty, ListSkeleton, SourceLogo, useConfirm, useToast } from '../ui';
import { Press, Stagger, Item, Sheet, CountUp, MeterBar, PullToRefresh, Underline, motion, AnimatePresence } from '../motion';
import { BarList } from './Reports';

type Tab = 'entries' | 'splits' | 'reports' | 'history';

export default function BookView({ onCapture }: { onCapture: () => void }) {
  const { bookId = '' } = useParams();
  const s = useSession(); const nav = useNavigate(); const toast = useToast(); const confirm = useConfirm();
  const uid = s.user?.uid || '';
  const [book, setBook] = useState<Book | null>(null);
  const [rows, setRows] = useState<Expense[] | null>(null);
  const [tab, setTab] = useState<Tab>('entries');
  const [menu, setMenu] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [f, setF] = useState({ kind: 'all', category: '', method: '', month: monthKey(todayIso()), flagged: false, q: '' });

  const load = useCallback(async () => {
    try { const [b, e] = await Promise.all([getBook(bookId), listEntries(bookId)]); setBook(b); setRows(e); localStorage.setItem('byjan.lastBook', bookId); }
    catch (e) { toast({ text: (e as Error).message, tone: 'error' }); setRows((r) => r || []); }
  }, [bookId]);
  useEffect(() => { void load(); }, [load]);

  const inMonth = useMemo(() => (rows || []).filter((r) => !f.month || (r.date || '').startsWith(f.month)), [rows, f.month]);
  const shown = useMemo(() => inMonth.filter((r) =>
    (f.kind === 'all' || r.entryType === f.kind) && (!f.category || r.category === f.category) && (!f.method || r.paymentMethod === f.method) && (!f.flagged || r.flagged)
    && (!f.q || [r.merchant, r.description, r.notes, r.upiRef, String(r.amount)].join(' ').toLowerCase().includes(f.q.toLowerCase()))
  ).sort((a, b) => `${b.date}${b.time || ''}${b.createdAt || ''}`.localeCompare(`${a.date}${a.time || ''}${a.createdAt || ''}`)), [inMonth, f]);
  const t = totals(inMonth);
  const groups = useMemo(() => { const m = new Map<string, Expense[]>(); shown.forEach((r) => m.set(r.date, [...(m.get(r.date) || []), r])); return [...m.entries()]; }, [shown]);
  const editable = canEdit(book, uid) && s.can('money_add');
  const budget = Number(book?.monthlyBudget || 0);
  const months = useMemo(() => [...new Set((rows || []).map((r) => monthKey(r.date || todayIso())))].sort().reverse(), [rows]);
  const activeFilters = [f.kind !== 'all', !!f.category, !!f.method, f.flagged].filter(Boolean).length;

  const remove = async (e: Expense) => {
    if (!s.can('money_delete')) return;
    const { ok } = await confirm({ title: 'Delete this entry?', body: `${inr(e.amount)} · ${e.merchant || e.description || ''}`, confirm: 'Delete', danger: true });
    if (!ok) return;
    setRows((r) => (r || []).filter((x) => x.id !== e.id));
    try { await deleteEntry(bookId, e.id); toast({ text: 'Entry deleted', action: { label: 'Undo', run: async () => { const { id: _i, ...rest } = e; await createEntry(bookId, rest, { force: true, idempotencyKey: newId('undo') }); void load(); } } }); }
    catch (err) { toast({ text: (err as Error).message, tone: 'error' }); void load(); }
  };
  const toggleFlag = async (e: Expense) => {
    setRows((r) => (r || []).map((x) => (x.id === e.id ? { ...x, flagged: !x.flagged } : x)));
    try { await updateEntry(bookId, e.id, { flagged: !e.flagged }); } catch (err) { toast({ text: (err as Error).message, tone: 'error' }); void load(); }
  };
  const duplicate = (e: Expense) => nav(`/book/${bookId}/new`, { state: { duplicateOf: e } });

  const exportCsv = async () => {
    const head = ['Date', 'Time', 'Type', 'Amount', 'Paid to', 'For what', 'Category', 'Paid by', 'Account', 'Paid from', 'UPI ref', 'UPI ID', 'Bill no', 'GST', 'Notes'];
    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const body = shown.map((r) => [r.date, r.time, r.txType || r.entryType, r.amount, r.merchant, r.description, r.category, r.paymentMethod, r.accountId, r.fundSource, r.upiRef, r.vpa, r.invoiceNumber, r.taxAmount, r.notes].map(esc).join(','));
    const csv = [head.join(','), ...body].join('\n');
    const name = `${(book?.name || 'book').replace(/\W+/g, '-')}-${f.month || 'all'}.csv`;
    if (isNative()) {
      const w = await Filesystem.writeFile({ path: name, data: csv, directory: Directory.Cache, encoding: Encoding.UTF8 });
      await Share.share({ title: name, url: w.uri, dialogTitle: 'Share export' });
    } else {
      const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = name; a.click();
    }
  };
  const emailReport = async () => {
    try {
      // The server expects subject + message + a base64 PDF (it does not build the report itself).
      const pdf = await buildBookReportPdf(book, shown, f.month);
      await apiPost('/api/email/send-report', {
        bookId, to: s.user?.email, subject: pdf.subject, message: pdf.message, pdfBase64: pdf.base64, filename: pdf.filename, kind: 'report',
      });
      toast({ text: `PDF report sent to ${s.user?.email}` });
    }
    catch (e) { toast({ text: (e as Error).message, tone: 'error' }); }
  };

  return (
    <div className="screen">
      <AppBar back="/" title={book?.name || ' '} kicker={book?.purposeLabel || 'Money book'} rule
        right={<><Press className="icon-btn" title="People" onClick={() => nav(`/book/${bookId}/people`)}><Users size={21} /></Press><Press className="icon-btn" title="More" onClick={() => setMenu(true)}><MoreVertical size={21} /></Press></>} />
      <PullToRefresh onRefresh={load}>
        <div className="cells" style={{ gridTemplateColumns: 'repeat(3, minmax(0,1fr))', borderTop: 0 }}>
          <div><p className="cell-label">Out</p><p className="cell-value" style={{ fontSize: 18 }}><CountUp value={t.outP / 100} format={(n) => inr(n)} /></p></div>
          <div><p className="cell-label">In</p><p className="cell-value amt-in" style={{ fontSize: 18 }}><CountUp value={t.inP / 100} format={(n) => inr(n)} /></p></div>
          <div style={{ borderRight: 0 }}><p className="cell-label">Net</p><p className="cell-value" style={{ fontSize: 18 }}>{inrPaise(t.netP)}</p></div>
        </div>
        {budget > 0 && s.can('money_budget') && (
          <div className="pad" style={{ padding: '12px 16px', background: 'var(--surface)', borderBottom: '1px solid var(--line)' }}>
            <div className="row hint" style={{ marginBottom: 6 }}><span className="grow">Budget {inr(budget)}</span><span>{inr(Math.max(0, budget - t.outP / 100))} left</span></div>
            <MeterBar pct={t.outP / 100 / budget} />
          </div>
        )}

        <div className="row" style={{ gap: 22, padding: '12px 16px 0', borderBottom: '1px solid var(--line)', background: 'var(--surface)', overflowX: 'auto' }}>
          {([['entries', 'Entries'], ['splits', 'Splits'], ['reports', 'Reports'], ['history', 'History']] as Array<[Tab, string]>)
            .filter(([k]) => (k === 'splits' ? s.can('money_split_tab') : k === 'reports' ? s.can('money_book_analytics') : k === 'history' ? s.can('money_history') : true))
            .map(([k, label]) => (
              <button key={k} onClick={() => setTab(k)} style={{ position: 'relative', border: 0, background: 'none', padding: '0 0 12px', font: `${tab === k ? 600 : 500} 14.5px var(--font)`, color: tab === k ? 'var(--ink)' : 'var(--muted)', cursor: 'pointer' }}>
                {label}{tab === k && <Underline id="booktab" />}
              </button>
            ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
            {tab === 'entries' && (
              <>
                <div className="row pad" style={{ padding: '10px 16px', gap: 8 }}>
                  <input className="input" style={{ minHeight: 40 }} placeholder="Search this book" value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} />
                  {s.can('money_filters') && <Press className="btn btn-secondary btn-sm" onClick={() => setFilterOpen(true)}><Filter size={15} />{activeFilters ? activeFilters : ''}</Press>}
                </div>
                <div className="chips pad" style={{ paddingBottom: 8 }}>
                  {[{ v: '', l: 'All time' }, ...months.map((m) => ({ v: m, l: new Date(m + '-01').toLocaleString('en-IN', { month: 'short', year: '2-digit' }) }))].map((m) =>
                    <button key={m.v || 'all'} className={`chip ${f.month === m.v ? 'on' : ''}`} onClick={() => setF({ ...f, month: m.v })}>{m.l}</button>)}
                </div>
                {!rows ? <ListSkeleton /> : !shown.length ? (
                  <Empty icon={<Paperclip size={34} />} title={rows.length ? 'No entries match' : 'No entries yet'} body={rows.length ? 'Try another month or clear filters.' : 'Share a receipt to Byjan, scan one, or add it by hand.'}
                    action={editable ? <Press className="btn btn-primary" onClick={onCapture}><Plus size={18} />Add entry</Press> : undefined} />
                ) : (
                  groups.map(([date, list]) => (
                    <div key={date}>
                      <div className="row" style={{ padding: '14px 16px 6px' }}><span className="kicker grow">{niceDate(date)}</span><span className="hint mono">{inrPaise(totals(list).outP)}</span></div>
                      <Stagger className="list">
                        {list.map((e) => <EntryRow key={e.id} e={e} onOpen={() => nav(`/book/${bookId}/entry/${e.id}`)} onDelete={() => remove(e)} onFlag={() => toggleFlag(e)} onDuplicate={() => duplicate(e)} canEdit={editable} s={s} />)}
                      </Stagger>
                    </div>
                  ))
                )}
              </>
            )}
            {tab === 'splits' && <SplitsTab bookId={bookId} uid={uid} />}
            {tab === 'reports' && <BookReports bookId={bookId} month={f.month} />}
            {tab === 'history' && <HistoryTab bookId={bookId} />}
          </motion.div>
        </AnimatePresence>
      </PullToRefresh>

      {editable && tab === 'entries' && (
        <motion.button className="fab" onClick={onCapture} initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 300, damping: 20 }} whileTap={{ scale: 0.94 }} style={{ bottom: 'calc(20px + var(--safe-b))' }}><Plus size={22} />Add</motion.button>
      )}

      <Sheet open={menu} onClose={() => setMenu(false)} title="Book options">
        <div className="list" style={{ margin: '0 -16px' }}>
          {s.can('money_pin') && <div className="list-row" onClick={async () => { setMenu(false); if (!book) return; const b = await updateBook(bookId, { pinned: !book.pinned }); setBook(b); toast({ text: b.pinned ? 'Pinned to top' : 'Unpinned' }); }}><Pin size={19} /><span className="t grow">{book?.pinned ? 'Unpin book' : 'Pin to top'}</span></div>}
          {s.can('money_settle') && <div className="list-row" onClick={() => { setMenu(false); nav(`/book/${bookId}/settle`); }}><Scale size={19} /><span className="t grow">Settle up</span></div>}
          {s.can('money_export') && <div className="list-row" onClick={() => { setMenu(false); void exportCsv(); }}><Download size={19} /><span className="t grow">Export Excel (CSV)</span></div>}
          {s.can('money_email_report') && <div className="list-row" onClick={() => { setMenu(false); void emailReport(); }}><Mail size={19} /><span className="t grow">Email PDF report</span></div>}
          <div className="list-row" onClick={() => { setMenu(false); nav(`/book/${bookId}/settings`); }}><Cog size={19} /><span className="t grow">Book settings</span></div>
        </div>
      </Sheet>

      <Sheet open={filterOpen} onClose={() => setFilterOpen(false)} title="Filter entries"
        footer={<><Press className="btn btn-secondary" onClick={() => setF({ ...f, kind: 'all', category: '', method: '', flagged: false })}>Clear</Press><Press className="btn btn-primary grow" onClick={() => setFilterOpen(false)}>Show {shown.length}</Press></>}>
        <p className="label">Type</p>
        <div className="chips">{[['all', 'All'], ['out', 'Money out'], ['in', 'Money in'], ['transfer', 'Transfers']].map(([v, l]) => <button key={v} className={`chip ${f.kind === v ? 'on' : ''}`} onClick={() => setF({ ...f, kind: v })}>{l}</button>)}</div>
        <p className="label">Category</p>
        <div className="chips" style={{ flexWrap: 'wrap' }}>{['', ...categoriesOf(book)].map((c) => <button key={c || 'any'} className={`chip ${f.category === c ? 'on' : ''}`} onClick={() => setF({ ...f, category: c })}>{c || 'Any'}</button>)}</div>
        <p className="label">Paid by</p>
        <div className="chips" style={{ flexWrap: 'wrap' }}>{[{ id: '', label: 'Any' }, ...PAYMENT_METHODS].map((m) => <button key={m.id || 'any'} className={`chip ${f.method === m.id ? 'on' : ''}`} onClick={() => setF({ ...f, method: m.id })}>{m.label}</button>)}</div>
        <button className={`chip ${f.flagged ? 'on' : ''}`} style={{ alignSelf: 'flex-start' }} onClick={() => setF({ ...f, flagged: !f.flagged })}><Flag size={14} />Flagged only</button>
      </Sheet>
    </div>
  );
}

/** Swipe left to reveal Flag / Copy / Delete. */
function EntryRow({ e, onOpen, onDelete, onFlag, onDuplicate, canEdit: ok, s }: { e: Expense; onOpen: () => void; onDelete: () => void; onFlag: () => void; onDuplicate: () => void; canEdit: boolean; s: ReturnType<typeof useSession> }) {
  const [open, setOpen] = useState(false);
  const actions = [
    s.can('money_flag') && { k: 'flag', icon: <Flag size={18} />, bg: 'var(--amber)', run: onFlag },
    s.can('money_duplicate') && { k: 'dup', icon: <Copy size={18} />, bg: 'var(--ink-2)', run: onDuplicate },
    s.can('money_delete') && { k: 'del', icon: <Trash2 size={18} />, bg: 'var(--red)', run: onDelete },
  ].filter(Boolean) as Array<{ k: string; icon: React.ReactNode; bg: string; run: () => void }>;
  const w = ok ? actions.length * 64 : 0;
  return (
    <Item style={{ position: 'relative', overflow: 'hidden', borderBottom: '1px solid var(--line)' }}>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', justifyContent: 'flex-end' }}>
        {ok && actions.map((a) => <button key={a.k} onClick={() => { setOpen(false); a.run(); }} style={{ width: 64, border: 0, background: a.bg, color: '#fff', display: 'grid', placeItems: 'center' }}>{a.icon}</button>)}
      </div>
      <motion.div className="list-row" style={{ borderBottom: 0, position: 'relative' }} drag={ok ? 'x' : false} dragConstraints={{ left: -w, right: 0 }} dragElastic={0.08}
        animate={{ x: open ? -w : 0 }} transition={{ type: 'spring', stiffness: 500, damping: 40 }}
        onDragEnd={(_, i) => setOpen(i.offset.x < -w / 2)} onClick={() => (open ? setOpen(false) : onOpen())}>
        <SourceLogo name={e.fundSource || e.source || e.paymentMethod} size={28} />
        <div className="grow">
          <p className="t ellipsis row" style={{ gap: 6 }}>{e.merchant || e.description || e.category || 'Entry'}{e.flagged && <Flag size={13} color="var(--amber)" fill="var(--amber)" />}{e.receiptPath && <Paperclip size={13} color="var(--faint)" />}</p>
          <p className="s ellipsis">{[e.time, e.category, e.description && e.merchant ? e.description : '', e.split ? 'Split' : ''].filter(Boolean).join(' · ')}</p>
        </div>
        <p className={`mono ${e.entryType === 'in' ? 'amt-in' : ''}`} style={{ font: '500 15px var(--mono)' }}>{e.entryType === 'in' ? '+' : e.entryType === 'transfer' ? '⇄ ' : ''}{inr(Number(e.amount))}</p>
      </motion.div>
    </Item>
  );
}

function SplitsTab({ bookId, uid }: { bookId: string; uid: string }) {
  const nav = useNavigate();
  const [rows, setRows] = useState<Settlement[] | null>(null);
  useEffect(() => { void listSettlements(bookId).then(setRows).catch(() => setRows([])); }, [bookId]);
  if (!rows) return <ListSkeleton rows={3} />;
  const open = rows.filter((r) => !['SETTLED', 'CONFIRMED'].includes(r.status));
  if (!open.length) return <Empty title="All settled" body="Split an entry from its detail page and balances show up here." />;
  return (
    <div style={{ paddingTop: 10 }}>
      <Stagger className="list">
        {open.map((r) => (
          <Item key={r.id} className="list-row" onClick={() => nav(`/book/${bookId}/settle`)}>
            <div className="grow"><p className="t">{r.fromUid === uid ? `You owe ${r.receiverNameSnapshot || 'them'}` : `${r.receiverNameSnapshot || 'Someone'} owes you`}</p><p className="s ellipsis">{r.expenseDescription || r.merchant || ''} · {r.status.toLowerCase().replace(/_/g, ' ')}</p></div>
            <span className={`mono ${r.toUid === uid ? 'amt-in' : ''}`}>{inrPaise(r.amountPaise)}</span>
          </Item>
        ))}
      </Stagger>
      <div className="pad" style={{ paddingTop: 14 }}><Press className="btn btn-primary btn-block" onClick={() => nav(`/book/${bookId}/settle`)}><Scale size={18} />Settle up</Press></div>
    </div>
  );
}

function BookReports({ bookId, month }: { bookId: string; month: string }) {
  const [r, setR] = useState<ReportSummary | null | undefined>(undefined);
  useEffect(() => {
    const from = month ? `${month}-01` : undefined;
    const to = month ? `${month}-31` : undefined;
    void reportSummary([bookId], from, to).then(setR).catch(() => setR(null));
  }, [bookId, month]);
  if (r === undefined) return <ListSkeleton rows={4} />;
  if (!r || !r.count) return <Empty title="Nothing to report yet" body="Reports fill in as entries are added." />;
  return (
    <div className="stack" style={{ padding: 16 }}>
      <BarList title="By category" rows={r.byCategory.map((c) => ({ label: c.category || 'Uncategorized', paise: c.outPaise }))} />
      {r.byMethod && <BarList title="By payment method" rows={r.byMethod.map((c) => ({ label: c.method || 'Other', paise: c.outPaise }))} />}
      {r.topMerchants && <BarList title="Top payees" rows={r.topMerchants.map((c) => ({ label: `${c.merchant} · ${c.count}×`, paise: c.outPaise }))} />}
    </div>
  );
}

function HistoryTab({ bookId }: { bookId: string }) {
  const [rows, setRows] = useState<Array<Record<string, unknown>> | null>(null);
  useEffect(() => { void listAudit(bookId).then(setRows).catch(() => setRows([])); }, [bookId]);
  if (!rows) return <ListSkeleton rows={5} />;
  if (!rows.length) return <Empty title="No changes yet" />;
  return (
    <Stagger className="list" style={{ marginTop: 10 }}>
      {rows.map((r, i) => (
        <Item key={String(r.id || i)} className="list-row" style={{ cursor: 'default' }}>
          <div className="grow"><p className="t">{String(r.summary || r.action || 'Change')}</p><p className="s">{String(r.actorName || r.actorEmail || '')} · {relTime(String(r.at || r.createdAt || ''))}</p></div>
        </Item>
      ))}
    </Stagger>
  );
}

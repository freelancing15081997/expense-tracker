import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Plus, Search, Pin, BookOpen, Sparkles, ChevronRight, ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { listBooks, listAllEntries, createBook, updateBook, PURPOSES, totals, type Book, type Expense } from '../lib/books';
import { listMySettlements, nlSearch, type Settlement } from '../lib/money';
import { useSession } from '../lib/session';
import { inr, inrPaise, niceDate, monthKey, todayIso } from '../lib/format';
import { Logo, Avatar, Empty, Field, ListSkeleton, Seg, SourceLogo, useToast } from '../ui';
import { Press, Stagger, Item, CountUp, Sheet, PullToRefresh, MeterBar, motion } from '../motion';

export default function Home({ onCapture }: { onCapture: () => void }) {
  const s = useSession();
  const nav = useNavigate();
  const toast = useToast();
  const [books, setBooks] = useState<Book[] | null>(null);
  const [entries, setEntries] = useState<Expense[]>([]);
  const [settle, setSettle] = useState<Settlement[]>([]);
  const [newOpen, setNewOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const [b, all, st] = await Promise.all([listBooks(), listAllEntries().catch(() => ({ expenses: [] })), listMySettlements().catch(() => [])]);
      setBooks(b); setEntries((all.expenses || []).filter((e) => !e.deleted)); setSettle(st.filter((x) => x.status !== 'SETTLED' && x.status !== 'CONFIRMED'));
    } catch (e) { setBooks((x) => x || []); toast({ text: (e as Error).message, tone: 'error' }); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const month = monthKey(todayIso());
  const thisMonth = useMemo(() => totals(entries.filter((e) => (e.date || '').startsWith(month))), [entries, month]);
  const byBook = useMemo(() => {
    const m = new Map<string, Expense[]>();
    entries.forEach((e) => { const k = String(e.bookId || ''); m.set(k, [...(m.get(k) || []), e]); });
    return m;
  }, [entries]);
  const sorted = useMemo(() => (books || []).slice().sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned) || a.name.localeCompare(b.name)), [books]);
  const recent = useMemo(() => entries.slice().sort((a, b) => `${b.date}${b.time || ''}${b.createdAt || ''}`.localeCompare(`${a.date}${a.time || ''}${a.createdAt || ''}`)).slice(0, 6), [entries]);
  const scansLeft = s.remaining('receipt_scans');
  const scanMeter = s.usage?.meters?.receipt_scans;
  const owe = settle.filter((x) => x.fromUid === s.user?.uid);
  const owed = settle.filter((x) => x.toUid === s.user?.uid);
  const first = (s.me?.displayName || s.user?.displayName || '').split(' ')[0];

  return (
    <div className="screen">
      <header className="appbar">
        <div className="grow" style={{ paddingLeft: 8 }}><Logo height={24} /></div>
        {s.can('app_search') && <Press className="icon-btn" title="Search" onClick={() => setSearchOpen(true)}><Search size={21} /></Press>}
        <Press className="icon-btn" title="Notifications" onClick={() => nav('/notifications')}><Bell size={21} /></Press>
        <Press className="icon-btn" title="Profile" onClick={() => nav('/settings')}><Avatar name={s.me?.displayName || s.user?.email || ''} src={s.user?.photoURL || undefined} size={32} /></Press>
      </header>
      <PullToRefresh onRefresh={async () => { await Promise.all([load(), s.refreshSaas()]); }}>
        <Stagger>
          <Item className="pad" style={{ paddingTop: 8, paddingBottom: 18, borderBottom: '2px solid var(--ink)', margin: '0 16px', paddingLeft: 0, paddingRight: 0 }}>
            <p className="kicker">{new Date().toLocaleString('en-IN', { month: 'long' })} · all books</p>
            <h1 className="h-display" style={{ marginTop: 8 }}>{first ? `Hi ${first}` : 'Your money'}</h1>
            <div className="row" style={{ marginTop: 16, gap: 28 }}>
              <div><p className="cell-label">Spent</p><p className="cell-value"><CountUp value={thisMonth.outP / 100} format={(n) => inr(n)} /></p></div>
              <div><p className="cell-label">Received</p><p className="cell-value amt-in"><CountUp value={thisMonth.inP / 100} format={(n) => inr(n)} /></p></div>
            </div>
          </Item>

          {scanMeter && scanMeter.limit >= 0 && !s.isOwner && (
            <Item className="pad" style={{ paddingTop: 14 }}>
              <Press as="div" className="card card-pad" onClick={() => nav('/usage')} style={{ display: 'flex', flexDirection: 'column', gap: 8, cursor: 'pointer' }}>
                <div className="row"><Sparkles size={16} color="var(--teal-700)" /><span className="grow" style={{ font: '500 14px var(--font)' }}>{scansLeft === Infinity ? 'Unlimited scans' : `${scansLeft} smart scans left this month`}</span><span className="badge teal">{s.plan?.name || 'Free'}</span></div>
                <MeterBar pct={scanMeter.used / Math.max(1, scanMeter.limit + scanMeter.extra)} />
              </Press>
            </Item>
          )}

          {(owe.length > 0 || owed.length > 0) && (
            <Item className="pad" style={{ paddingTop: 12 }}>
              <div className="grid2">
                <Press as="div" className="card card-pad" onClick={() => owe[0] && nav(`/book/${owe[0].bookId}/settle`)} style={{ cursor: 'pointer' }}>
                  <p className="cell-label row" style={{ gap: 4 }}><ArrowUpRight size={14} />You owe</p>
                  <p className="cell-value" style={{ fontSize: 19 }}>{inrPaise(owe.reduce((a, x) => a + x.amountPaise, 0))}</p>
                </Press>
                <Press as="div" className="card card-pad" onClick={() => owed[0] && nav(`/book/${owed[0].bookId}/settle`)} style={{ cursor: 'pointer' }}>
                  <p className="cell-label row" style={{ gap: 4 }}><ArrowDownLeft size={14} />Owed to you</p>
                  <p className="cell-value amt-in" style={{ fontSize: 19 }}>{inrPaise(owed.reduce((a, x) => a + x.amountPaise, 0))}</p>
                </Press>
              </div>
            </Item>
          )}

          <Item><div className="h-section">Money books{s.can('money_create_book') && <button className="btn-ghost" style={{ border: 0, background: 'none', color: 'var(--teal-700)', display: 'flex', alignItems: 'center', gap: 4 }} onClick={() => { if (s.guard('books')) setNewOpen(true); }}><Plus size={16} />New</button>}</div></Item>
          {!books ? <ListSkeleton rows={3} /> : !books.length ? (
            <Empty icon={<BookOpen size={36} />} title="Start your first money book" body="A book holds entries for one purpose — home, a trip, your shop. Invite others any time."
              action={<Press className="btn btn-primary" onClick={() => setNewOpen(true)}><Plus size={18} />New book</Press>} />
          ) : (
            <Stagger className="list" style={{ borderTop: 0 }}>
              {sorted.map((b) => {
                const t = totals((byBook.get(b.id) || []).filter((e) => (e.date || '').startsWith(month)));
                const members = Object.keys(b.roles || {}).length || 1;
                return (
                  <Item key={b.id} className="list-row" onClick={() => nav(`/book/${b.id}`)}>
                    <span className="avatar" style={{ background: 'var(--teal-50)', color: 'var(--teal-700)' }}>{b.name.slice(0, 1).toUpperCase()}</span>
                    <div className="grow"><p className="t ellipsis row" style={{ gap: 6 }}>{b.name}{b.pinned && <Pin size={13} color="var(--muted)" />}</p><p className="s">{b.purposeLabel || 'Everyday'} · {members} {members === 1 ? 'person' : 'people'}</p></div>
                    <div style={{ textAlign: 'right' }}><p className="mono" style={{ font: '500 14px var(--mono)' }}>{inrPaise(t.outP)}</p><p className="s">this month</p></div>
                    <ChevronRight size={18} color="var(--faint)" />
                  </Item>
                );
              })}
            </Stagger>
          )}

          {recent.length > 0 && (
            <>
              <Item><div className="h-section">Latest entries</div></Item>
              <Stagger className="list" style={{ borderTop: 0 }}>
                {recent.map((e) => (
                  <Item key={e.id} className="list-row" onClick={() => nav(`/book/${e.bookId}/entry/${e.id}`)}>
                    <SourceLogo name={e.fundSource || e.source} size={28} />
                    <div className="grow"><p className="t ellipsis">{e.merchant || e.description || e.category || 'Entry'}</p><p className="s ellipsis">{niceDate(e.date)} · {(books || []).find((b) => b.id === e.bookId)?.name || 'Book'}{e.category ? ` · ${e.category}` : ''}</p></div>
                    <p className={`mono ${e.entryType === 'in' ? 'amt-in' : ''}`} style={{ font: '500 15px var(--mono)' }}>{e.entryType === 'in' ? '+' : ''}{inr(Number(e.amount))}</p>
                  </Item>
                ))}
              </Stagger>
            </>
          )}
        </Stagger>
      </PullToRefresh>

      <motion.button className="fab" onClick={onCapture} initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 300, damping: 20, delay: 0.3 }} whileTap={{ scale: 0.94 }}>
        <Plus size={22} />Add
      </motion.button>

      <NewBookSheet open={newOpen} onClose={() => setNewOpen(false)} onCreated={(b) => { setBooks((x) => [...(x || []), b]); s.bump('books'); nav(`/book/${b.id}`); }} />
      <SearchSheet open={searchOpen} onClose={() => setSearchOpen(false)} books={books || []} entries={entries} />
    </div>
  );
}

export function NewBookSheet({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (b: Book) => void }) {
  const s = useSession(); const toast = useToast();
  const [name, setName] = useState(''); const [purpose, setPurpose] = useState('default'); const [currency, setCurrency] = useState('INR');
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) { setName(''); setPurpose('default'); setErr(''); } }, [open]);
  const p = PURPOSES.find((x) => x.id === purpose)!;
  return (
    <Sheet open={open} onClose={onClose} title="New money book"
      footer={<Press className="btn btn-primary btn-block" disabled={busy} onClick={async () => {
        if (!name.trim()) { setErr('Give the book a name'); return; }
        setBusy(true);
        try { const b = await createBook({ name: name.trim(), currency, purposeId: p.id, purposeLabel: p.label, categories: p.categories }); toast({ text: `${b.name} created` }); onClose(); onCreated(b); }
        catch (e) { if (!s.handleQuotaError(e)) toast({ text: (e as Error).message, tone: 'error' }); } finally { setBusy(false); }
      }}>{busy ? 'Creating…' : 'Create book'}</Press>}>
      <Field label="Name" error={err}><input className={`input ${err ? 'bad' : ''}`} value={name} placeholder="e.g. Goa trip, Home, Shop" onChange={(e) => { setName(e.target.value); setErr(''); }} autoFocus /></Field>
      {s.can('money_purpose') && (
        <Field label="What is it for?" hint="Sets starter categories. You can change them later.">
          <div className="chips" style={{ flexWrap: 'wrap' }}>{PURPOSES.map((x) => <button key={x.id} className={`chip ${purpose === x.id ? 'on' : ''}`} onClick={() => setPurpose(x.id)}>{x.label}</button>)}</div>
        </Field>
      )}
      <Field label="Currency"><Seg id="cur" value={currency} onChange={setCurrency} options={[{ value: 'INR', label: '₹ INR' }, { value: 'USD', label: '$ USD' }, { value: 'AED', label: 'AED' }, { value: 'EUR', label: '€ EUR' }]} /></Field>
    </Sheet>
  );
}

function SearchSheet({ open, onClose, books, entries }: { open: boolean; onClose: () => void; books: Book[]; entries: Expense[] }) {
  const s = useSession(); const nav = useNavigate(); const toast = useToast();
  const [q, setQ] = useState(''); const [smart, setSmart] = useState<Expense[] | null>(null); const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) { setQ(''); setSmart(null); } }, [open]);
  const needle = q.trim().toLowerCase();
  const local = needle ? entries.filter((e) => [e.merchant, e.description, e.category, e.notes, e.upiRef, String(e.amount)].join(' ').toLowerCase().includes(needle)).slice(0, 30) : [];
  const bookHits = needle ? books.filter((b) => b.name.toLowerCase().includes(needle)) : [];
  const runSmart = async () => {
    if (!s.can('money_search') || !s.guard('smart_search')) return;
    setBusy(true);
    try {
      const results = await Promise.all(books.map((b) => nlSearch(b.id, q).then((r) => (r.expenses || []).map((x) => ({ ...x, bookId: b.id }))).catch(() => [])));
      setSmart(results.flat() as Expense[]); s.bump('smart_search');
    } catch (e) { if (!s.handleQuotaError(e)) toast({ text: (e as Error).message, tone: 'error' }); } finally { setBusy(false); }
  };
  const rows = smart || local;
  return (
    <Sheet open={open} onClose={onClose} title="Search" tall>
      <input className="input" autoFocus placeholder="Merchant, amount, note, UPI ref…" value={q} onChange={(e) => { setQ(e.target.value); setSmart(null); }} onKeyDown={(e) => e.key === 'Enter' && runSmart()} />
      {s.can('money_search') && q.trim().length > 3 && (
        <Press className="btn btn-secondary btn-block" disabled={busy} onClick={runSmart}><Sparkles size={16} />{busy ? 'Thinking…' : `Ask: “${q.trim()}”`}<span className="hint btn-trail">{s.remaining('smart_search') === Infinity ? '' : `${s.remaining('smart_search')} left`}</span></Press>
      )}
      {bookHits.map((b) => <div key={b.id} className="list-row card" onClick={() => { onClose(); nav(`/book/${b.id}`); }}><BookOpen size={18} /><span className="t grow">{b.name}</span></div>)}
      <div className="list" style={{ margin: '0 -16px' }}>
        {rows.map((e) => (
          <div key={`${e.bookId}-${e.id}`} className="list-row" onClick={() => { onClose(); nav(`/book/${e.bookId}/entry/${e.id}`); }}>
            <div className="grow"><p className="t ellipsis">{e.merchant || e.description || 'Entry'}</p><p className="s">{niceDate(e.date)} · {books.find((b) => b.id === e.bookId)?.name}</p></div>
            <span className="mono">{inr(Number(e.amount))}</span>
          </div>
        ))}
      </div>
      {needle && !rows.length && !bookHits.length && <p className="hint">Nothing matches “{q}”.</p>}
    </Sheet>
  );
}

export const pinBook = (b: Book) => updateBook(b.id, { pinned: !b.pinned });

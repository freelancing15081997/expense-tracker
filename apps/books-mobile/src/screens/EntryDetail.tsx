import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Pencil, Copy, Flag, Trash2, Split, Share2, Paperclip, X } from 'lucide-react';
import { Share } from '@capacitor/share';
import { getBook, listEntries, deleteEntry, updateEntry, accountsOf, canEdit, PAYMENT_METHODS, type Book, type Expense } from '../lib/books';
import { listTimeline } from '../lib/money';
import { fileUrl, isNative } from '../lib/api';
import { useSession } from '../lib/session';
import { inr, niceDate, relTime } from '../lib/format';
import { AppBar, Empty, SourceLogo, useConfirm, useToast, Skeleton } from '../ui';
import { Press, Stagger, Item, motion, AnimatePresence } from '../motion';
import { SplitSheet } from './Settle';

export default function EntryDetail() {
  const { bookId = '', entryId = '' } = useParams();
  const s = useSession(); const nav = useNavigate(); const toast = useToast(); const confirm = useConfirm();
  const [book, setBook] = useState<Book | null>(null);
  const [e, setE] = useState<Expense | null | undefined>(undefined);
  const [events, setEvents] = useState<Array<{ id: string; at: string; actor?: string; action: string; detail?: string }>>([]);
  const [viewer, setViewer] = useState(false);
  const [splitOpen, setSplitOpen] = useState(false);

  const load = async () => {
    const [b, rows] = await Promise.all([getBook(bookId), listEntries(bookId)]);
    setBook(b); setE(rows.find((x) => x.id === entryId) || null);
    void listTimeline(bookId, entryId).then(setEvents).catch(() => undefined);
  };
  useEffect(() => { void load().catch((err) => { toast({ text: err.message, tone: 'error' }); setE(null); }); }, [bookId, entryId]);

  if (e === undefined) return <div className="screen no-nav"><AppBar back title=" " rule /><div className="stack pad" style={{ paddingTop: 20 }}><Skeleton h={44} w="50%" /><Skeleton h={18} w="70%" /><Skeleton h={200} /></div></div>;
  if (e === null) return <div className="screen no-nav"><AppBar back={`/book/${bookId}`} title="Entry" rule /><Empty title="This entry was deleted" action={<Press className="btn btn-secondary" onClick={() => nav(`/book/${bookId}`)}>Back to book</Press>} /></div>;

  const ok = canEdit(book, s.user?.uid || '');
  const acc = accountsOf(book);
  const accName = (id?: string) => acc.find((a) => a.id === id)?.name || id || '';
  const method = PAYMENT_METHODS.find((m) => m.id === e.paymentMethod)?.label || e.paymentMethod;
  const isImg = /\.(jpe?g|png|webp)$/i.test(e.receiptPath || '');
  const rows: Array<[string, React.ReactNode]> = ([
    ['Type', e.txType ? e.txType.replace(/_/g, ' ').toLowerCase().replace(/^./, (c) => c.toUpperCase()) : e.entryType === 'in' ? 'Income' : 'Expense'],
    ['Date', `${niceDate(e.date)}${e.time ? ' · ' + e.time : ''}`],
    [e.entryType === 'in' ? 'Received from' : 'Paid to', e.merchant],
    ['For what', e.description],
    ['Category', e.category],
    ['Paid by', method],
    [e.entryType === 'transfer' ? 'From → to' : 'Account', e.entryType === 'transfer' ? `${accName(e.accountId)} → ${accName(e.toAccountId)}` : accName(e.accountId)],
    ['Paid from', e.fundSource ? <span className="row" style={{ gap: 6 }}><SourceLogo name={e.fundSource} size={18} />{e.fundSource}</span> : ''],
    ['UPI ref', e.upiRef ? <span className="mono">{e.upiRef}</span> : ''],
    ['UPI ID', e.vpa],
    ['Bill no.', e.invoiceNumber],
    ['GST / tax', e.taxAmount ? inr(Number(e.taxAmount)) : ''],
    ['Document', e.documentType],
    ['Adjustments', e.adjustments],
    ['Notes', e.notes ? <span style={{ whiteSpace: 'pre-wrap' }}>{e.notes}</span> : ''],
    ['Added by', e.spenderName || e.lastEditedBy],
  ] as Array<[string, React.ReactNode]>).filter(([, v]) => v);

  const actions = [
    ok && s.can('money_add') && { k: 'edit', label: 'Edit', icon: <Pencil size={18} />, run: () => nav(`/book/${bookId}/entry/${entryId}/edit`) },
    ok && s.can('money_split_entry') && { k: 'split', label: e.split ? 'Edit split' : 'Split', icon: <Split size={18} />, run: () => setSplitOpen(true) },
    ok && s.can('money_duplicate') && { k: 'dup', label: 'Copy', icon: <Copy size={18} />, run: () => nav(`/book/${bookId}/new`, { state: { duplicateOf: e } }) },
    ok && s.can('money_flag') && { k: 'flag', label: e.flagged ? 'Unflag' : 'Flag', icon: <Flag size={18} />, run: async () => { const n = await updateEntry(bookId, e.id, { flagged: !e.flagged }); setE({ ...e, ...n, flagged: !e.flagged }); } },
    s.can('money_export') && { k: 'share', label: 'Share', icon: <Share2 size={18} />, run: async () => {
      const txt = `${e.merchant || e.description || 'Entry'} — ${inr(Number(e.amount))} on ${e.date}${e.upiRef ? ` (UPI ${e.upiRef})` : ''}`;
      if (isNative()) await Share.share({ text: txt, url: e.receiptPath ? fileUrl(e.receiptPath) : undefined }); else { await navigator.clipboard.writeText(txt); toast({ text: 'Copied' }); }
    } },
    ok && s.can('money_delete') && { k: 'del', label: 'Delete', icon: <Trash2 size={18} />, danger: true, run: async () => {
      const { ok: yes } = await confirm({ title: 'Delete this entry?', body: 'It disappears for everyone in this book.', confirm: 'Delete', danger: true });
      if (!yes) return; await deleteEntry(bookId, e.id); toast({ text: 'Entry deleted' }); nav(`/book/${bookId}`, { replace: true });
    } },
  ].filter(Boolean) as Array<{ k: string; label: string; icon: React.ReactNode; run: () => void; danger?: boolean }>;

  return (
    <div className="screen no-nav">
      <AppBar back={`/book/${bookId}`} title={book?.name || ''} kicker="Entry" rule />
      <Stagger>
        <Item className="pad" style={{ padding: '20px 16px 18px', background: 'var(--surface)', borderBottom: '1px solid var(--line)' }}>
          <div className="row"><SourceLogo name={e.fundSource || e.source} size={30} /><span className="kicker grow">{e.category || 'Uncategorized'}</span>{e.flagged && <span className="badge amber">Flagged</span>}{e.split ? <span className="badge teal">Split</span> : null}</div>
          <motion.p className={`num ${e.entryType === 'in' ? 'amt-in' : ''}`} style={{ font: '600 40px/1.05 var(--font)', letterSpacing: '-.02em', marginTop: 12 }} initial={{ scale: 0.94, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
            {e.entryType === 'in' ? '+' : ''}{inr(Number(e.amount), { decimals: Number(e.amount) % 1 !== 0 })}
          </motion.p>
          <p style={{ marginTop: 6, font: '500 16px var(--font)' }}>{e.merchant || e.description}</p>
        </Item>
        <Item className="row" style={{ padding: '10px 8px', gap: 2, background: 'var(--surface)', borderBottom: '2px solid var(--ink)', overflowX: 'auto' }}>
          {actions.map((a) => (
            <Press key={a.k} onClick={a.run} style={{ flex: 1, minWidth: 64, border: 0, background: 'none', display: 'grid', justifyItems: 'center', gap: 4, padding: '6px 0', color: a.danger ? 'var(--red-700)' : 'var(--ink-2)', font: '500 12px var(--font)', cursor: 'pointer' }}>{a.icon}{a.label}</Press>
          ))}
        </Item>
        {e.receiptPath && (
          <Item className="pad" style={{ paddingTop: 16 }}>
            <Press as="div" className="card row" style={{ padding: 10, cursor: 'pointer' }} onClick={() => (isImg ? setViewer(true) : window.open(fileUrl(e.receiptPath!), '_blank'))}>
              {isImg ? <img src={fileUrl(e.receiptPath)} alt="Receipt" style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 6 }} /> : <span className="avatar" style={{ width: 64, height: 64 }}><Paperclip size={22} /></span>}
              <div className="grow"><p style={{ font: '500 15px var(--font)' }}>{e.receiptName || 'Receipt'}</p><p className="hint">Tap to view</p></div>
            </Press>
          </Item>
        )}
        <Item>
          <div className="list" style={{ marginTop: 16 }}>
            {rows.map(([k, v]) => (
              <div key={k} className="list-row" style={{ cursor: 'default', alignItems: 'flex-start', minHeight: 48 }}>
                <span className="hint" style={{ width: 112, flex: 'none', paddingTop: 1 }}>{k}</span><span className="grow" style={{ font: '500 14.5px var(--font)', overflowWrap: 'anywhere' }}>{v}</span>
              </div>
            ))}
          </div>
        </Item>
        {events.length > 0 && s.can('money_history') && (
          <Item>
            <div className="h-section">Timeline</div>
            <div className="pad" style={{ paddingTop: 12 }}>
              {events.map((ev, i) => (
                <motion.div key={ev.id || i} className="row" style={{ alignItems: 'flex-start', paddingBottom: 14 }} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 5, background: i === 0 ? 'var(--teal)' : 'var(--line-2)', marginTop: 5, flex: 'none' }} />
                  <div className="grow"><p style={{ font: '500 14px var(--font)' }}>{ev.action}</p><p className="hint">{[ev.actor, relTime(ev.at), ev.detail].filter(Boolean).join(' · ')}</p></div>
                </motion.div>
              ))}
            </div>
          </Item>
        )}
      </Stagger>

      <AnimatePresence>
        {viewer && e.receiptPath && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ position: 'fixed', inset: 0, zIndex: 90, background: '#000', display: 'grid', placeItems: 'center' }} onClick={() => setViewer(false)}>
            <motion.img src={fileUrl(e.receiptPath)} alt="Receipt" drag dragConstraints={{ left: -200, right: 200, top: -300, bottom: 300 }} whileTap={{ cursor: 'grabbing' }}
              initial={{ scale: 0.9 }} animate={{ scale: 1 }} style={{ maxWidth: '100%', maxHeight: '100%', touchAction: 'none' }} onClick={(ev) => ev.stopPropagation()} onDoubleClick={(ev) => { const el = ev.currentTarget; el.style.transform = el.style.transform.includes('scale(2)') ? '' : 'scale(2)'; }} />
            <button className="icon-btn" style={{ position: 'absolute', top: 'calc(12px + var(--safe-t))', right: 12, color: '#fff' }} onClick={() => setViewer(false)}><X size={24} /></button>
          </motion.div>
        )}
      </AnimatePresence>
      {book && <SplitSheet open={splitOpen} onClose={() => setSplitOpen(false)} book={book} entry={e} onSaved={() => { setSplitOpen(false); void load(); }} />}
    </div>
  );
}

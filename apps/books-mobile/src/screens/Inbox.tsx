import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Inbox as InboxIcon, Bell, Copy, AlertCircle, CalendarClock, Check } from 'lucide-react';
import { listInbox, dismissInbox, type InboxItem } from '../lib/money';
import { listNotifications, markNotificationsRead, getBook, type AppNotification } from '../lib/books';
import { autofill, blankDraft } from '../lib/autofill';
import { useSession } from '../lib/session';
import { inrPaise, relTime } from '../lib/format';
import { AppBar, Empty, ListSkeleton, SourceLogo, useToast } from '../ui';
import { Press, Stagger, Item, PullToRefresh, motion, AnimatePresence } from '../motion';

const KIND: Record<InboxItem['kind'], { label: string; cls: string; icon: React.ReactNode }> = {
  review: { label: 'Needs a look', cls: 'amber', icon: <AlertCircle size={14} /> },
  duplicate: { label: 'Possible duplicate', cls: 'red', icon: <Copy size={14} /> },
  upcoming: { label: 'Upcoming', cls: 'teal', icon: <CalendarClock size={14} /> },
  failed: { label: 'Couldn’t read', cls: 'red', icon: <AlertCircle size={14} /> },
};

/** Captures that arrived by email / share but weren’t auto-confirmed. Tap → filled form. */
export function Inbox() {
  const s = useSession(); const nav = useNavigate(); const toast = useToast();
  const [items, setItems] = useState<InboxItem[] | null>(null);
  const load = () => listInbox().then(setItems).catch(() => setItems([]));
  useEffect(() => { void load(); }, []);
  if (!s.can('money_inbox')) return <div className="screen"><AppBar title="Inbox" rule /><Empty title="Inbox is turned off for your account" /></div>;

  const open = async (it: InboxItem) => {
    const book = await getBook(it.bookId);
    const a = autofill(blankDraft(book, s.user?.uid || ''), book, { preview: it.preview, receiptPath: it.preview.receiptPath, receiptName: it.preview.receiptName, source: it.preview.source });
    nav(`/book/${it.bookId}/new`, { state: { capture: { draft: a.draft, filled: [...a.filled], low: [...a.low], preview: it.preview } } });
  };
  const dismiss = async (it: InboxItem) => {
    setItems((x) => (x || []).filter((y) => y.id !== it.id));
    try { await dismissInbox(it.id); toast({ text: 'Dismissed' }); } catch (e) { toast({ text: (e as Error).message, tone: 'error' }); void load(); }
  };

  return (
    <div className="screen">
      <AppBar title="Inbox" kicker="Waiting for you" rule />
      <PullToRefresh onRefresh={load}>
        {!items ? <ListSkeleton /> : !items.length ? <Empty icon={<InboxIcon size={36} />} title="All caught up" body="Receipts that need a check — from email, shares or bank SMS — land here." /> : (
          <Stagger className="list" style={{ borderTop: 0 }}>
            <AnimatePresence>
              {items.map((it) => (
                <motion.div key={it.id} layout exit={{ opacity: 0, x: -60, height: 0 }}>
                  <Item className="list-row" onClick={() => open(it)}>
                    <SourceLogo name={it.preview.fundSource || it.preview.source} size={28} />
                    <div className="grow">
                      <p className="t ellipsis">{it.preview.merchant || it.preview.description || 'Receipt'}</p>
                      <p className="s ellipsis">{it.bookName} · {relTime(it.at)}</p>
                      <span className={`badge ${KIND[it.kind].cls}`} style={{ marginTop: 6, gap: 4 }}>{KIND[it.kind].icon}{KIND[it.kind].label}</span>
                    </div>
                    <div style={{ display: 'grid', justifyItems: 'end', gap: 6 }}>
                      <span className="mono">{it.preview.amountPaise ? inrPaise(it.preview.amountPaise) : '—'}</span>
                      <button className="btn btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); void dismiss(it); }}>Dismiss</button>
                    </div>
                  </Item>
                </motion.div>
              ))}
            </AnimatePresence>
          </Stagger>
        )}
      </PullToRefresh>
    </div>
  );
}

export function Notifications() {
  const nav = useNavigate();
  const [rows, setRows] = useState<AppNotification[] | null>(null);
  const load = () => listNotifications().then(setRows).catch(() => setRows([]));
  useEffect(() => { void load(); }, []);
  const unread = (rows || []).filter((r) => !r.read).map((r) => r.id);
  return (
    <div className="screen">
      <AppBar back title="Notifications" rule right={unread.length ? <Press className="btn btn-ghost btn-sm" onClick={async () => { await markNotificationsRead(unread); setRows((x) => (x || []).map((r) => ({ ...r, read: true }))); }}><Check size={16} />Read all</Press> : null} />
      <PullToRefresh onRefresh={load}>
        {!rows ? <ListSkeleton /> : !rows.length ? <Empty icon={<Bell size={36} />} title="No notifications" body="You’ll hear here when someone adds, edits or settles in your books." /> : (
          <Stagger className="list" style={{ borderTop: 0 }}>
            {rows.map((n) => (
              <Item key={n.id} className="list-row" onClick={() => { if (!n.read) void markNotificationsRead([n.id]); if (n.bookId && n.expenseId) nav(`/book/${n.bookId}/entry/${n.expenseId}`); else if (n.bookId) nav(`/book/${n.bookId}`); }}>
                <span style={{ width: 8, height: 8, borderRadius: 4, background: n.read ? 'transparent' : 'var(--teal)', flex: 'none' }} />
                <div className="grow"><p className="t" style={{ fontWeight: n.read ? 400 : 600 }}>{n.title}</p>{n.body && <p className="s">{n.body}</p>}<p className="s">{relTime(n.at)}</p></div>
              </Item>
            ))}
          </Stagger>
        )}
      </PullToRefresh>
    </div>
  );
}

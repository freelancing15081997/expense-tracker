import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Inbox } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { listAllExpenses } from '../lib/expenses';
import { buildAttentionInbox, type AttentionItem } from '../lib/financial-memory';
import { detectAnomalies, detectCommitments } from '../lib/money-intelligence';
import { detectRegularPayments } from '../lib/recurrence-engine';
import { formatIndianAmount } from '../lib/bridge-automations';
import { ListPager, ListSearch, usePagedList } from '../components/ListControls';
import { MoneyFeedSkeleton } from '../components/money/MoneySkeletons';
import { markInboxDismissed, markInboxRead, readInboxState } from '../lib/inbox-state';
import { toUserMessage } from '../lib/user-message';

const KINDS: Array<{ id: 'all' | AttentionItem['kind']; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'receipt_review', label: 'Receipts' },
  { id: 'categorize', label: 'Category' },
  { id: 'duplicate', label: 'Duplicates' },
  { id: 'recurring', label: 'Recurring' },
  { id: 'commitment', label: 'Upcoming' },
  { id: 'split', label: 'Splits' },
];

export default function FinancialInboxPage() {
  const { currentUser } = useAuth();
  const uid = currentUser?.uid || 'anon';
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [items, setItems] = useState<AttentionItem[]>([]);
  const [kind, setKind] = useState<(typeof KINDS)[number]['id']>('all');
  const [status, setStatus] = useState<'all' | 'unread' | 'read'>('all');
  const [inbox, setInbox] = useState(() => readInboxState(uid));
  const [reload, setReload] = useState(0);

  useEffect(() => {
    setInbox(readInboxState(uid));
  }, [uid]);

  useEffect(() => {
    let alive = true;
    void (async () => {
      setLoading(true);
      setError('');
      try {
        const data = await listAllExpenses();
        const expenses = data.expenses || [];
        const drafts = expenses.filter((e) => String(e.status || '').toLowerCase() === 'draft' || String(e.financialStatus || '') === 'DRAFT');
        const uncategorized = expenses.filter((e) => {
          const cat = String(e.category || '').trim().toLowerCase();
          return !cat || cat === 'uncategorized';
        }).slice(0, 12);
        const dupHits = detectAnomalies(expenses as any).filter((h) => h.kind === 'duplicate').slice(0, 8);
        const commitments = detectCommitments(expenses as any).slice(0, 8);
        const recurring = detectRegularPayments(expenses.map((e) => ({
          id: String(e.id),
          amount: Number(e.amount || 0),
          date: String(e.date || ''),
          merchant: String(e.merchant || ''),
          description: String(e.description || ''),
          category: String(e.category || ''),
          entryType: String(e.entryType || 'out'),
          paymentMethod: String(e.paymentMethod || ''),
          bookId: String(e.bookId || ''),
          bookName: String(e.bookName || ''),
        }))).filter((p) => p.band !== 'NOT_RECURRING' && p.status !== 'ignored');
        if (!alive) return;
        setItems(buildAttentionInbox({
          drafts: drafts as any,
          uncategorized: uncategorized as any,
          duplicates: dupHits.map((h) => ({
            id: h.id,
            message: h.message,
            bookId: String((expenses.find((e) => String(e.id) === h.id) || {}).bookId || ''),
          })),
          recurring: recurring.map((r) => ({ id: r.id, label: r.merchant, amount: r.avgAmount })),
          commitments: commitments.map((c) => ({
            id: c.id,
            label: c.label,
            nextEstimate: c.nextEstimate,
            amount: c.amount,
          })),
        }));
      } catch (err) {
        if (alive) setError(toUserMessage(err, 'Could not load your financial inbox.'));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [reload]);

  const visible = useMemo(() => {
    const dismissed = new Set(inbox.dismissed);
    const read = new Set(inbox.read);
    return items.filter((row) => {
      if (dismissed.has(row.id)) return false;
      if (kind !== 'all' && row.kind !== kind) return false;
      const isRead = read.has(row.id);
      if (status === 'unread' && isRead) return false;
      if (status === 'read' && !isRead) return false;
      return true;
    });
  }, [items, inbox, kind, status]);

  const list = usePagedList(visible, (row, q) => `${row.title} ${row.detail} ${row.kind} ${row.action || ''}`.toLowerCase().includes(q), 10);

  const onRead = (id: string, read = true) => setInbox(markInboxRead(uid, id, read));
  const onDismiss = (ids: string[]) => setInbox(markInboxDismissed(uid, ids));

  return (
    <div className="premium-list-page web-page max-w-xl md:max-w-4xl mx-auto pb-28 md:pb-8">
      <Link to="/" className="inline-flex items-center gap-1 text-sm font-semibold text-slate-500 hover:text-[#0B1F3A] mb-2">
        <ArrowLeft className="w-4 h-4" /> Home
      </Link>
      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
        <Inbox className="w-3.5 h-3.5" /> Money
      </p>
      <h1 className="font-display text-[26px] font-semibold text-[#0B1F3A] tracking-tight">Financial inbox</h1>
      <p className="text-[13px] text-slate-500 mt-1">Items that need a review — not your activity history.</p>

      <div className="mt-4">
        <ListSearch query={list.query} onQuery={list.setQuery} placeholder="Search inbox" />
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {KINDS.map((row) => (
          <button key={row.id} type="button" className="byjan-chip" data-on={kind === row.id} onClick={() => setKind(row.id)}>
            {row.label}
          </button>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        {(['all', 'unread', 'read'] as const).map((row) => (
          <button key={row} type="button" className="byjan-chip" data-on={status === row} onClick={() => setStatus(row)}>
            {row === 'all' ? 'Any status' : row === 'unread' ? 'Unread' : 'Read'}
          </button>
        ))}
        {visible.length > 0 ? (
          <button type="button" className="byjan-chip ml-auto" onClick={() => onDismiss(visible.map((r) => r.id))}>
            Clear visible
          </button>
        ) : null}
      </div>

      {loading ? <div className="mt-6"><MoneyFeedSkeleton rows={6} /></div> : null}
      {error ? (
        <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          <p>{error}</p>
          <button type="button" className="mt-2 text-sm font-semibold" onClick={() => setReload((n) => n + 1)}>Try again</button>
        </div>
      ) : null}
      {!loading && !error && list.filtered.length === 0 ? (
        <p className="mt-8 text-sm text-slate-500">Nothing waiting. New receipts, duplicates, and upcoming payments will land here.</p>
      ) : null}

      <div className="mt-4 space-y-2">
        {list.pageRows.map((row) => {
          const isRead = inbox.read.includes(row.id);
          return (
            <article
              key={row.id}
              className={`rounded-2xl border border-slate-200 bg-white px-4 py-3 ${isRead ? 'opacity-70' : ''}`}
            >
              <Link to={row.href || '/'} className="block min-w-0" onClick={() => onRead(row.id, true)}>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{row.kind.replace('_', ' ')}</p>
                <h2 className="text-[15px] font-semibold text-[#0B1F3A] mt-0.5">{row.title}</h2>
                <p className="text-[13px] text-slate-500 mt-0.5">{row.detail}</p>
                {row.amount ? <p className="byjan-money text-sm mt-1">{formatIndianAmount(row.amount)}</p> : null}
              </Link>
              <div className="mt-2 flex flex-wrap gap-2">
                <button type="button" className="text-xs font-semibold text-teal-700" onClick={() => onRead(row.id, !isRead)}>
                  {isRead ? 'Mark unread' : 'Mark read'}
                </button>
                <button type="button" className="text-xs font-semibold text-slate-500" onClick={() => onDismiss([row.id])}>
                  Clear
                </button>
              </div>
            </article>
          );
        })}
      </div>
      {list.filtered.length > 0 ? (
        <ListPager
          page={list.page}
          totalPages={list.totalPages}
          onPage={list.setPage}
          pageSize={list.pageSize}
          onPageSize={list.setPageSize}
          total={list.filtered.length}
        />
      ) : null}
    </div>
  );
}

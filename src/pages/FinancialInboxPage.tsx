import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, Check, CalendarClock, Copy, Inbox, Receipt, Repeat, Tag, Users, X, type LucideIcon } from 'lucide-react';
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
  { id: 'outlier', label: 'Unusual' },
  { id: 'receipt_review', label: 'Receipts' },
  { id: 'categorize', label: 'No category' },
  { id: 'duplicate', label: 'Duplicates' },
  { id: 'recurring', label: 'Repeating' },
  { id: 'commitment', label: 'Coming up' },
  { id: 'split', label: 'Owed' },
];

const KIND_META: Record<AttentionItem['kind'], { icon: LucideIcon; label: string; tone: string }> = {
  outlier: { icon: AlertTriangle, label: 'Unusual spend', tone: 'is-amber' },
  receipt_review: { icon: Receipt, label: 'Receipt', tone: 'is-navy' },
  categorize: { icon: Tag, label: 'No category', tone: 'is-slate' },
  duplicate: { icon: Copy, label: 'Duplicate?', tone: 'is-rose' },
  recurring: { icon: Repeat, label: 'Repeating', tone: 'is-indigo' },
  commitment: { icon: CalendarClock, label: 'Coming up', tone: 'is-teal' },
  split: { icon: Users, label: 'Owed', tone: 'is-sky' },
  warranty: { icon: Check, label: 'Warranty', tone: 'is-slate' },
};

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
  const [leaving, setLeaving] = useState<Set<string>>(new Set());

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
        const byId = new Map(expenses.map((e) => [String(e.id), e]));
        const drafts = expenses.filter((e) => String(e.status || '').toLowerCase() === 'draft' || String(e.financialStatus || '') === 'DRAFT');
        const uncategorized = expenses.filter((e) => {
          const cat = String(e.category || '').trim().toLowerCase();
          return !cat || cat === 'uncategorized';
        }).slice(0, 12);
        const anomalies = detectAnomalies(expenses as any);
        const dupHits = anomalies.filter((h) => h.kind === 'duplicate').slice(0, 8);
        // Outliers: money-out entries far above the person's usual spend — the "wait, what was that?" list.
        const outliers = anomalies
          .filter((h) => h.kind === 'amount')
          .map((h) => {
            const e = byId.get(h.id);
            return {
              id: h.id,
              message: h.message,
              severity: h.severity,
              bookId: String(e?.bookId || ''),
              amount: Number(e?.amount || 0),
              label: [String(e?.description || e?.merchant || 'Entry'), e?.bookName ? String(e.bookName) : ''].filter(Boolean).join(' · '),
            };
          })
          .sort((a, b) => b.amount - a.amount)
          .slice(0, 6);
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
          outliers,
          duplicates: dupHits.map((h) => ({
            id: h.id,
            message: h.message,
            bookId: String(byId.get(h.id)?.bookId || ''),
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

  const counts = useMemo(() => {
    const dismissed = new Set(inbox.dismissed);
    const out: Partial<Record<AttentionItem['kind'] | 'all', number>> = { all: 0 };
    for (const row of items) {
      if (dismissed.has(row.id)) continue;
      out.all = (out.all || 0) + 1;
      out[row.kind] = (out[row.kind] || 0) + 1;
    }
    return out;
  }, [items, inbox]);

  const list = usePagedList<AttentionItem>(visible, (row, q) => `${row.title} ${row.detail} ${row.why || ''} ${row.kind} ${row.action || ''}`.toLowerCase().includes(q), 10);

  const onRead = (id: string, read = true) => setInbox(markInboxRead(uid, id, read));
  const onDismiss = (ids: string[]) => {
    setLeaving((curr) => new Set([...curr, ...ids]));
    window.setTimeout(() => {
      setInbox(markInboxDismissed(uid, ids));
      setLeaving((curr) => { const next = new Set(curr); ids.forEach((id) => next.delete(id)); return next; });
    }, 180);
  };

  return (
    <div className="premium-list-page web-page max-w-xl md:max-w-4xl mx-auto pb-28 md:pb-8 fi-page" data-testid="inbox-page">
      <Link to="/" className="inline-flex items-center gap-1 text-sm font-semibold text-slate-500 hover:text-[#0B1F3A] mb-2">
        <ArrowLeft className="w-4 h-4" /> Home
      </Link>
      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
        <Inbox className="w-3.5 h-3.5" /> Money
      </p>
      <h1 className="font-display text-[26px] font-semibold text-[#0B1F3A] tracking-tight">Financial inbox</h1>
      <p className="text-[13px] text-slate-500 mt-1">Things worth a look — unusual spends, receipts to confirm, duplicates and payments coming up.</p>

      <div className="mt-4">
        <ListSearch query={list.query} onQuery={list.setQuery} placeholder="Search inbox" />
      </div>
      <div className="mt-3 fi-chips" role="tablist" aria-label="Type">
        {KINDS.map((row) => {
          const n = counts[row.id] || 0;
          if (row.id !== 'all' && n === 0 && kind !== row.id) return null;
          return (
            <button key={row.id} type="button" role="tab" aria-selected={kind === row.id} className="byjan-chip" data-on={kind === row.id} data-testid={`inbox-kind-${row.id}`} onClick={() => setKind(row.id)}>
              {row.label}{n ? <span className="fi-chip-n">{n}</span> : null}
            </button>
          );
        })}
      </div>
      <div className="mt-2 flex flex-wrap gap-2 items-center">
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
        <div className="fi-empty">
          <span className="fi-empty-icon"><Check className="w-5 h-5" /></span>
          <p className="fi-empty-title">All clear</p>
          <p className="fi-empty-sub">New receipts, unusual spends, duplicates and upcoming payments will land here.</p>
        </div>
      ) : null}

      <div className="mt-4 fi-list">
        {list.pageRows.map((row) => {
          const isRead = inbox.read.includes(row.id);
          const meta = KIND_META[row.kind] || KIND_META.warranty;
          const Icon = meta.icon;
          return (
            <article
              key={row.id}
              className={`fi-card ${meta.tone}${isRead ? ' is-read' : ''}${leaving.has(row.id) ? ' is-leaving' : ''}${row.severity === 'high' ? ' is-high' : ''}`}
              data-testid="inbox-card"
              data-kind={row.kind}
            >
              <Link to={row.href || '/'} className="fi-card-main" onClick={() => onRead(row.id, true)}>
                <span className="fi-card-icon" aria-hidden><Icon className="w-4 h-4" /></span>
                <span className="fi-card-body">
                  <span className="fi-card-kicker">{meta.label}{!isRead ? <i className="fi-dot" aria-label="Unread" /> : null}</span>
                  <span className="fi-card-title">{row.title}</span>
                  <span className="fi-card-detail">{row.detail}</span>
                  {row.why ? <span className="fi-card-why">{row.why}</span> : null}
                </span>
                {row.amount ? <span className="fi-card-amt byjan-money">{formatIndianAmount(row.amount)}</span> : null}
              </Link>
              <div className="fi-card-actions">
                <Link to={row.href || '/'} className="fi-act is-primary" onClick={() => onRead(row.id, true)}>{row.action || 'Open'}</Link>
                <button type="button" className="fi-act" onClick={() => onRead(row.id, !isRead)}>
                  {isRead ? 'Mark unread' : 'Mark read'}
                </button>
                <button type="button" className="fi-act is-quiet" aria-label="Clear" title="Clear" onClick={() => onDismiss([row.id])}>
                  <X className="w-3.5 h-3.5" />
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

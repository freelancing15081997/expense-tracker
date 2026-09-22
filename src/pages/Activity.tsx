import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useFeatures } from '../lib/use-features';
import { listAllExpenses } from '../lib/expenses';
import { listNotifications, markNotificationRead, notificationPath, type AppNotification } from '../lib/notifications';
import { getCurrencySymbol } from '../lib/currency';
import { formatIndianAmount } from '../lib/bridge-automations';
import { ListPager, ListSearch, usePagedList } from '../components/ListControls';
import { MoneyFeedSkeleton } from '../components/money/MoneySkeletons';

function dayHeading(iso: string) {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return 'Earlier';
  const d = new Date(t);
  const today = new Date();
  const yday = new Date();
  yday.setDate(today.getDate() - 1);
  const same = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  if (same(d, today)) return 'Today';
  if (same(d, yday)) return 'Yesterday';
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: d.getFullYear() !== today.getFullYear() ? 'numeric' : undefined });
}

export default function Activity() {
  const { currentUser, userProfile } = useAuth();
  const { on: hasFeature } = useFeatures();
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [notifs, setNotifs] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    Promise.all([
      listAllExpenses().catch(() => ({ expenses: [] as Array<Record<string, unknown>> })),
      listNotifications().catch(() => [] as Array<Record<string, unknown>>),
    ]).then(([exp, notes]) => {
      if (!alive) return;
      setRows((exp.expenses || []).slice(0, 40));
      setNotifs(notes as Array<Record<string, unknown>>);
      setLoading(false);
    });
    return () => { alive = false; };
  }, [currentUser?.uid]);

  const items = useMemo(() => {
    const money = rows.map((r) => ({
      id: `e-${r.id}`,
      at: String(r.createdAt || r.date || ''),
      kind: 'money' as const,
      title: String(r.description || r.merchant || 'Entry').replace(/\s+/g, ' ').trim().slice(0, 72),
      detail: `${r.entryType === 'in' ? '+' : '−'}${formatIndianAmount(Number(r.amount || 0), getCurrencySymbol(String(r.currency || userProfile?.defaultCurrency || 'INR')))}`,
      href: r.bookId ? `/book/${r.bookId}?entry=${encodeURIComponent(String(r.id))}` : '/expenses',
    }));
    const notes = notifs.map((n) => ({
      id: `n-${n.id}`,
      at: String(n.createdAt || ''),
      kind: 'note' as const,
      title: String(n.bookName || 'Byjan'),
      detail: `${n.senderName || 'Someone'} ${String(n.action || 'updated').toLowerCase()}`,
      href: notificationPath(n as AppNotification),
      unread: !n.read,
      nid: String(n.id || ''),
    }));
    return [...money, ...notes].sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
  }, [rows, notifs, userProfile?.defaultCurrency]);

  const list = usePagedList(items, (row: { title: string; detail: string }, q: string) => `${row.title} ${row.detail}`.toLowerCase().includes(q), 10);
  const grouped = useMemo(() => {
    const out: Array<{ label: string; rows: typeof items }> = [];
    for (const row of list.pageRows) {
      const label = dayHeading(row.at);
      const last = out[out.length - 1];
      if (last && last.label === label) last.rows.push(row);
      else out.push({ label, rows: [row] });
    }
    return out;
  }, [list.pageRows]);

  return (
    <div className="premium-list-page web-page max-w-xl md:max-w-4xl mx-auto pb-28 md:pb-8">
      <Link to="/" className="inline-flex items-center gap-1 text-sm font-semibold text-slate-500 hover:text-[#0B1F3A] mb-2">
        <ArrowLeft className="w-4 h-4" /> Back
      </Link>
      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Activity</p>
      <h1 className="font-display text-[26px] font-semibold text-[#0B1F3A] tracking-tight">What’s happening</h1>
      <div className="mt-3 flex flex-wrap gap-2">
        {hasFeature('money_recurring') && <Link to="/regular-payments" className="byjan-chip text-xs">Regular payments</Link>}
        {hasFeature('money_reports') && <Link to="/reports" className="byjan-chip text-xs">Summary</Link>}
        {hasFeature('money_inbox') && <Link to="/financial-inbox" className="byjan-chip text-xs">Financial inbox</Link>}
      </div>
      <div className="mt-3">
        <ListSearch query={list.query} onQuery={list.setQuery} placeholder="Search activity" />
      </div>
      {loading ? (
        <div className="mt-6"><MoneyFeedSkeleton rows={6} /></div>
      ) : null}
      {!loading && items.length === 0 ? <p className="mt-6 text-sm text-slate-500">No activity yet.</p> : null}
      <div className="mt-4 space-y-4">
        {grouped.map((group) => (
          <section key={group.label} className="day-group">
            <p className="day-group-label">{group.label}</p>
            {group.rows.map((row) => {
              const isMoney = row.kind === 'money';
              const isOut = isMoney && String(row.detail || '').startsWith('−');
              const isIn = isMoney && String(row.detail || '').startsWith('+');
              return (
              <Link
                key={row.id}
                to={row.href}
                onClick={() => { if ('nid' in row && row.unread && row.nid) void markNotificationRead(row.nid); }}
                className={`activity-card ${'unread' in row && row.unread ? 'is-unread' : ''}`}
              >
                <span className="activity-main">
                  <p className="text-sm font-semibold text-[#0B1F3A] line-clamp-2">{row.title}</p>
                  {!isMoney ? <p className="text-[12px] text-slate-500 mt-0.5">{row.detail}</p> : null}
                </span>
                {isMoney ? (
                  <span className={`activity-amt ${isOut ? 'is-out' : ''} ${isIn ? 'is-in' : ''}`}>{row.detail}</span>
                ) : null}
              </Link>
              );
            })}
          </section>
        ))}
      </div>
      {items.length > 0 ? (
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

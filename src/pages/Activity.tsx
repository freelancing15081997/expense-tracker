import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { listAllExpenses } from '../lib/expenses';
import { listNotifications, markNotificationRead, notificationPath, type AppNotification } from '../lib/notifications';
import { getCurrencySymbol } from '../lib/currency';
import { formatIndianAmount } from '../lib/bridge-automations';

export default function Activity() {
  const { currentUser, userProfile } = useAuth();
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
      title: String(r.description || r.merchant || 'Entry'),
      detail: `${r.entryType === 'in' ? '+' : '−'}${getCurrencySymbol(String(r.currency || userProfile?.defaultCurrency || 'INR'))}${formatIndianAmount(Number(r.amount || 0))}`,
      href: r.bookId ? `/book/${r.bookId}` : '/expenses',
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
    return [...money, ...notes].sort((a, b) => Date.parse(b.at) - Date.parse(a.at)).slice(0, 50);
  }, [rows, notifs, userProfile?.defaultCurrency]);

  return (
    <div className="max-w-xl mx-auto pb-8">
      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Activity</p>
      <h1 className="font-display text-[26px] font-semibold text-[#0B1F3A] tracking-tight">What’s happening</h1>
      {loading ? <p className="mt-6 text-sm text-slate-500">Loading…</p> : null}
      {!loading && items.length === 0 ? <p className="mt-6 text-sm text-slate-500">No activity yet.</p> : null}
      <ul className="mt-4 space-y-2">
        {items.map((row) => (
          <li key={row.id}>
            <Link
              to={row.href}
              onClick={() => { if ('nid' in row && row.unread && row.nid) void markNotificationRead(row.nid); }}
              className="block rounded-2xl border border-slate-200 bg-white px-4 py-3"
            >
              <p className="text-sm font-semibold text-[#0B1F3A]">{row.title}</p>
              <p className="text-[13px] text-slate-500 mt-0.5">{row.detail}</p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { listNotifications, markAllNotificationsRead, markNotificationRead, notificationPath } from '../lib/notifications';
import { useAuth } from '../context/AuthContext';

const GROUPS = ['Payments', 'Splits', 'Books', 'Security', 'System'] as const;

function groupOf(row: Record<string, unknown>) {
  const hay = `${row.action || ''} ${row.kind || ''} ${row.detail || ''}`.toLowerCase();
  if (/pay|upi|settlement|paid/.test(hay)) return 'Payments';
  if (/split/.test(hay)) return 'Splits';
  if (/security|login|lock/.test(hay)) return 'Security';
  if (/system|invite/.test(hay)) return 'System';
  return 'Books';
}

export default function NotificationsPage() {
  const { currentUser } = useAuth();
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [filter, setFilter] = useState<(typeof GROUPS)[number] | 'All'>('All');

  const load = () => {
    listNotifications().then(setRows).catch(() => setRows([]));
  };

  useEffect(() => {
    load();
  }, [currentUser?.uid]);

  const filtered = useMemo(
    () => (filter === 'All' ? rows : rows.filter((r) => groupOf(r) === filter)),
    [rows, filter],
  );

  return (
    <div className="max-w-xl mx-auto pb-8">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Inbox</p>
          <h1 className="font-display text-[26px] font-semibold text-[#0B0F1F] tracking-tight">Notifications</h1>
        </div>
        <button type="button" className="text-xs font-semibold text-[#2440DB]" onClick={() => void markAllNotificationsRead().then(load)}>
          Mark all read
        </button>
      </div>
      <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
        {['All', ...GROUPS].map((g) => (
          <button
            key={g}
            type="button"
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold border ${filter === g ? 'bg-[#12B8A8] text-white border-[#12B8A8]' : 'bg-white text-slate-600 border-slate-200'}`}
            onClick={() => setFilter(g as typeof filter)}
          >
            {g}
          </button>
        ))}
      </div>
      {filtered.length === 0 ? <p className="mt-6 text-sm text-slate-500">Nothing in this group.</p> : null}
      <ul className="mt-4 space-y-2">
        {filtered.map((n) => (
          <li key={String(n.id)}>
            <Link
              to={notificationPath(n)}
              onClick={() => { if (!n.read && n.id) void markNotificationRead(String(n.id)); }}
              className={`block rounded-2xl border px-4 py-3 ${n.read ? 'bg-white border-slate-200' : 'bg-indigo-50 border-indigo-100'}`}
            >
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{groupOf(n)}</p>
              <p className="text-sm font-semibold text-[#0B0F1F] mt-0.5">{String(n.bookName || 'Byjan')}</p>
              <p className="text-[13px] text-slate-500">{String(n.senderName || 'Someone')} {String(n.action || 'updated the book').toLowerCase()}</p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

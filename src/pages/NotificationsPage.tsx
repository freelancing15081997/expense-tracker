import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, BookOpen, CheckCheck, Lock, Split, Wallet } from 'lucide-react';
import { listNotifications, markAllNotificationsRead, markNotificationRead, notificationPath, notifyTimeAgo } from '../lib/notifications';
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

function GroupIcon({ group }: { group: string }) {
  if (group === 'Payments') return <Wallet className="w-4 h-4" />;
  if (group === 'Splits') return <Split className="w-4 h-4" />;
  if (group === 'Security') return <Lock className="w-4 h-4" />;
  if (group === 'System') return <Bell className="w-4 h-4" />;
  return <BookOpen className="w-4 h-4" />;
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
  const unread = rows.filter((r) => !r.read).length;

  return (
    <div className="notify-page">
      <div className="notify-page-head">
        <div className="notify-page-brand">
          <img src="/logo.png" alt="" className="notify-byjan-mark" />
          <div>
            <p className="notify-kicker">Inbox</p>
            <h1 className="notify-title">Notifications</h1>
            <p className="notify-sub">{unread ? `${unread} unread` : 'You’re all caught up'}</p>
          </div>
        </div>
        <button type="button" className="notify-mark-all" onClick={() => void markAllNotificationsRead().then(load)}>
          <CheckCheck className="w-4 h-4" />
          Mark all read
        </button>
      </div>
      <div className="notify-filters" role="tablist" aria-label="Notification groups">
        {['All', ...GROUPS].map((g) => (
          <button
            key={g}
            type="button"
            role="tab"
            aria-selected={filter === g}
            className={`notify-filter${filter === g ? ' is-on' : ''}`}
            onClick={() => setFilter(g as typeof filter)}
          >
            {g !== 'All' ? <GroupIcon group={g} /> : <Bell className="w-3.5 h-3.5" />}
            {g}
          </button>
        ))}
      </div>
      {filtered.length === 0 ? <p className="notify-empty">Nothing in this group yet.</p> : null}
      <ul className="notify-list">
        {filtered.map((n) => {
          const group = groupOf(n);
          return (
            <li key={String(n.id)}>
              <Link
                to={notificationPath(n)}
                onClick={() => { if (!n.read && n.id) void markNotificationRead(String(n.id)); }}
                className={`notify-card${n.read ? '' : ' is-unread'}`}
              >
                <span className={`notify-glyph tone-${group.toLowerCase()}`} aria-hidden>
                  <img src="/logo.png" alt="" />
                </span>
                <span className="notify-body">
                  <span className="notify-card-top">
                    <span className="notify-group">{group}</span>
                    <span className="notify-time">{notifyTimeAgo(String(n.createdAt || n.created_at || ''))}</span>
                  </span>
                  <span className="notify-book">{String(n.bookName || 'Byjan')}</span>
                  <span className="notify-copy">
                    <b>{String(n.senderName || 'Someone')}</b> {String(n.action || 'updated the book').toLowerCase()}
                  </span>
                  {n.detail ? <span className="notify-detail">{String(n.detail)}</span> : null}
                </span>
                {!n.read ? <span className="notify-dot" aria-label="Unread" /> : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

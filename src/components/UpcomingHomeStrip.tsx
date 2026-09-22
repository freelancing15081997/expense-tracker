import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarClock, ChevronRight } from 'lucide-react';
import type { RegularPayment } from '../lib/recurrence-engine';
import { formatIndianAmount } from '../lib/bridge-automations';
import { getCurrencySymbol } from '../lib/currency';
import HomeSwipeDeck from './HomeSwipeDeck';

function dueLabel(iso: string) {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return 'Upcoming';
  const days = Math.round((t - Date.now()) / 86400000);
  if (days < 0) return `${Math.abs(days)}d overdue`;
  if (days === 0) return 'Due today';
  if (days === 1) return 'Due tomorrow';
  return `In ${days}d`;
}

export default function UpcomingHomeStrip({
  items,
  currencyCode,
}: {
  items: RegularPayment[];
  currencyCode?: string;
}) {
  const symbol = getCurrencySymbol(currencyCode);
  const rows = items.slice(0, 8);
  const [index, setIndex] = useState(0);
  const safeIndex = rows.length ? Math.min(index, rows.length - 1) : 0;
  if (!rows.length) return null;

  return (
    <section className={`home-upcoming${rows.length === 0 ? ' is-empty' : ''}`} aria-label="Upcoming payments">
      <div className="home-upcoming-head">
        <span className="home-upcoming-kicker">
          <CalendarClock className="w-4 h-4" strokeWidth={2.2} />
          Upcoming
        </span>
        <Link to="/regular-payments">
          See all <ChevronRight className="w-3.5 h-3.5" />
        </Link>
      </div>
      {rows.length === 0 ? (
        <Link to="/regular-payments" className="home-upcoming-empty">
          No bills yet — tap to set up
        </Link>
      ) : (
        <HomeSwipeDeck
          count={rows.length}
          index={safeIndex}
          onIndex={setIndex}
          label="Upcoming reminders"
        >
          {rows.map((row) => {
            const entryId = row.expenseIds?.[0];
            const href = row.bookId
              ? `/book/${row.bookId}${entryId ? `?entry=${encodeURIComponent(entryId)}` : ''}`
              : '/regular-payments';
            return (
              <div
                key={row.id}
                className={`home-swipe-slide home-quad-card${row.missed || row.lateDays > 0 ? ' is-late' : ''}`}
              >
                <span className="home-quad-kind">{dueLabel(row.nextExpected)}</span>
                <span className="home-quad-copy min-w-0">
                  <span className="home-upcoming-name">{row.merchant}</span>
                  <span className="home-upcoming-meta">{row.bookName || 'Repeating'}</span>
                </span>
                <strong className="home-upcoming-amt byjan-money">
                  {formatIndianAmount(row.avgAmount, symbol)}
                </strong>
                <Link to={href} className="home-quad-pay">
                  Pay
                </Link>
              </div>
            );
          })}
        </HomeSwipeDeck>
      )}
    </section>
  );
}

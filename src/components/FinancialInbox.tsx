import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Inbox } from 'lucide-react';
import type { AttentionItem } from '../lib/financial-memory';
import HomeSwipeDeck from './HomeSwipeDeck';

export default function FinancialInbox({ items }: { items: AttentionItem[] }) {
  const rows = items.slice(0, 8);
  const count = rows.length;
  const [index, setIndex] = useState(0);
  const safeIndex = count ? Math.min(index, count - 1) : 0;
  if (!count) return null;

  return (
    <section className="fin-inbox home-upcoming" aria-label="Financial inbox">
      <div className="home-upcoming-head">
        <span className="home-upcoming-kicker">
          <Inbox className="w-4 h-4" strokeWidth={2.2} />
          Financial inbox
        </span>
        <Link to="/activity">
          See all <ChevronRight className="w-3.5 h-3.5" />
        </Link>
      </div>
      <HomeSwipeDeck
        count={count}
        index={safeIndex}
        onIndex={setIndex}
        label="Inbox reminders"
      >
        {rows.map((row) => (
          <Link
            key={row.id}
            to={row.href || '/activity'}
            className="home-swipe-slide home-upcoming-card fin-inbox-strip"
          >
            <span className="fin-inbox-dot" data-kind={row.kind} aria-hidden />
            <span className="min-w-0 flex-1">
              <span className="fin-inbox-title">{row.title}</span>
              <span className="fin-inbox-sub">{row.detail}</span>
            </span>
          </Link>
        ))}
      </HomeSwipeDeck>
    </section>
  );
}

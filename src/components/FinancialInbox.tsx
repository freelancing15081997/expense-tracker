import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Inbox } from 'lucide-react';
import type { AttentionItem } from '../lib/financial-memory';
import { formatIndianAmount } from '../lib/bridge-automations';
import HomeSwipeDeck from './HomeSwipeDeck';

export default function FinancialInbox({ items }: { items: AttentionItem[] }) {
  const rows = items.slice(0, 8);
  const count = rows.length;
  const [index, setIndex] = useState(0);
  const safeIndex = count ? Math.min(index, count - 1) : 0;

  return (
    <section className={`home-upcoming${count ? '' : ' is-empty'}`} aria-label="Financial inbox">
      <div className="home-upcoming-head">
        <span className="home-upcoming-kicker">
          <Inbox className="w-4 h-4" strokeWidth={2.2} />
          Financial inbox
        </span>
        <Link to="/activity">
          See all <ChevronRight className="w-3.5 h-3.5" />
        </Link>
      </div>
      {!count ? (
        <Link to="/activity" className="home-upcoming-empty">
          Nothing waiting — tap to open activity
        </Link>
      ) : (
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
              className="home-swipe-slide home-quad-card"
            >
              <span className="home-quad-kind" data-kind={row.kind}>
                {row.kind.replace('_', ' ')}
              </span>
              <span className="home-quad-copy min-w-0">
                <span className="home-upcoming-name">{row.title}</span>
                <span className="home-upcoming-meta">{row.detail}</span>
              </span>
              <strong className="home-upcoming-amt byjan-money">
                {row.amount ? formatIndianAmount(row.amount) : '—'}
              </strong>
              <span className={`home-quad-pay${/pay|review|remind/i.test(row.kind + row.action) ? ' pulse-attn' : ''}`}>{row.action || 'Open'}</span>
            </Link>
          ))}
        </HomeSwipeDeck>
      )}
    </section>
  );
}

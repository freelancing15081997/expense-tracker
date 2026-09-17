import React from 'react';
import { Link } from 'react-router-dom';
import { Inbox } from 'lucide-react';
import type { AttentionItem } from '../lib/financial-memory';

export default function FinancialInbox({ items }: { items: AttentionItem[] }) {
  return (
    <section className="fin-inbox" aria-label="Financial inbox">
      <div className="fin-inbox-head">
        <p className="fin-inbox-title">Financial inbox</p>
        <p className="fin-inbox-sub">{items.length ? `${items.length} to review` : 'Clear'}</p>
      </div>
      {items.length === 0 ? (
        <div className="fin-inbox-empty">
          <Inbox className="w-5 h-5 mx-auto mb-2 text-emerald-500" aria-hidden />
          <strong>You&apos;re all caught up</strong>
          Nothing needs your attention right now.
        </div>
      ) : (
        <div className="divide-y divide-slate-100/80">
          {items.map((item) => (
            <Link key={item.id} to={item.href} className="fin-inbox-item">
              <span className="fin-inbox-dot" data-kind={item.kind} aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] font-semibold text-[#0B1F3A] truncate">{item.title}</span>
                <span className="block text-[11px] text-slate-500 truncate">{item.detail}</span>
              </span>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

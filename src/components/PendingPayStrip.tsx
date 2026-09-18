import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Banknote, ChevronRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { listMySettlements, type MoneySettlementRow } from '../lib/money-api';
import { paiseToUpiAmount } from '../lib/upi';
import { getCurrencySymbol } from '../lib/currency';
import HomeSwipeDeck from './HomeSwipeDeck';

export default function PendingPayStrip({ uid }: { uid: string }) {
  const { currentUser } = useAuth();
  const me = uid || currentUser?.uid || '';
  const [rows, setRows] = useState<MoneySettlementRow[]>([]);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!me) return;
    let alive = true;
    const load = () => {
      listMySettlements()
        .then((list) => { if (alive) setRows(Array.isArray(list) ? list : []); })
        .catch(() => { if (alive) setRows([]); });
    };
    load();
    const tick = window.setInterval(load, 25000);
    const onVis = () => { if (document.visibilityState === 'visible') load(); };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      alive = false;
      window.clearInterval(tick);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [me]);

  const mineToPay = rows.filter((r) => r.fromUid === me && String(r.status || '').toUpperCase() !== 'PAID');
  const waiting = rows.filter((r) => r.toUid === me && r.fromUid !== me && String(r.status || '').toUpperCase() !== 'PAID');
  const cards = [...mineToPay, ...waiting];
  if (!cards.length) return null;

  const duePaise = mineToPay.reduce((s, r) => s + Number(r.amountPaise || 0), 0);
  const symbol = getCurrencySymbol(mineToPay[0]?.currency || waiting[0]?.currency || 'INR');
  const safeIndex = Math.min(index, cards.length - 1);

  return (
    <section className="home-upcoming" aria-label="Pending payments">
      <div className="home-upcoming-head">
        <span className="home-upcoming-kicker">
          <Banknote className="w-4 h-4" strokeWidth={2.2} />
          {mineToPay.length ? `To pay · ${symbol}${paiseToUpiAmount(duePaise)}` : 'Awaiting you'}
        </span>
        <Link to={cards[0] ? `/book/${cards[0].bookId}?pay=${encodeURIComponent(cards[0].id)}` : '/expenses'}>
          See all <ChevronRight className="w-3.5 h-3.5" />
        </Link>
      </div>
      <HomeSwipeDeck
        count={cards.length}
        index={safeIndex}
        onIndex={setIndex}
        label="Payment reminders"
      >
        {cards.map((row) => {
          const iOwe = row.fromUid === me;
          const href = `/book/${row.bookId}?pay=${encodeURIComponent(row.id)}`;
          return (
            <div key={row.id} className="home-swipe-slide home-quad-card">
              <span className="home-quad-kind">{iOwe ? 'You owe' : 'Incoming'}</span>
              <span className="home-quad-copy min-w-0">
                <span className="home-upcoming-name">{row.expenseDescription || row.merchant || 'Split'}</span>
                <span className="home-upcoming-meta">{row.merchant || 'Money book'}</span>
              </span>
              <strong className="home-upcoming-amt">
                {symbol}{paiseToUpiAmount(row.amountPaise)}
              </strong>
              <Link to={href} className="home-quad-pay">{iOwe ? 'Pay' : 'Review'}</Link>
            </div>
          );
        })}
      </HomeSwipeDeck>
    </section>
  );
}

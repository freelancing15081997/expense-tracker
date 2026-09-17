import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDownLeft, ArrowUpRight, Banknote, ChevronRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { listMySettlements, type MoneySettlementRow } from '../lib/money-api';
import { paiseToUpiAmount } from '../lib/upi';
import { getCurrencySymbol } from '../lib/currency';

export default function PendingPayStrip({ uid }: { uid: string }) {
  const { currentUser } = useAuth();
  const me = uid || currentUser?.uid || '';
  const [rows, setRows] = useState<MoneySettlementRow[]>([]);

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
  if (!mineToPay.length && !waiting.length) return null;

  const duePaise = mineToPay.reduce((s, r) => s + Number(r.amountPaise || 0), 0);
  const symbol = getCurrencySymbol(mineToPay[0]?.currency || waiting[0]?.currency || 'INR');
  const top = mineToPay[0] || waiting[0];
  const preview = [...mineToPay, ...waiting].slice(0, 3);

  return (
    <section className="pay-strip is-alert" aria-label="Pending payments">
      <div className="pay-strip-orb" aria-hidden>
        <Banknote className="w-5 h-5" />
        <span className="pay-strip-pulse" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="pay-strip-kicker">Payment alerts</p>
        {mineToPay.length ? (
          <p className="pay-strip-title">
            {mineToPay.length} to pay · {symbol}{paiseToUpiAmount(duePaise)}
          </p>
        ) : (
          <p className="pay-strip-title">{waiting.length} awaiting your confirmation</p>
        )}
        <ul className="pay-strip-list">
          {preview.map((row) => {
            const iOwe = row.fromUid === me;
            return (
              <li key={row.id}>
                <Link to={`/book/${row.bookId}?pay=${encodeURIComponent(row.id)}`} className="pay-strip-row">
                  <span className={`pay-strip-dir ${iOwe ? 'out' : 'in'}`}>
                    {iOwe ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownLeft className="w-3 h-3" />}
                  </span>
                  <span className="min-w-0 flex-1 truncate">
                    {row.expenseDescription || row.merchant || 'Split'}
                  </span>
                  <span className="pay-strip-amt">
                    {symbol}{paiseToUpiAmount(row.amountPaise)}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
      <Link
        to={top ? `/book/${top.bookId}?pay=${encodeURIComponent(top.id)}` : '/expenses'}
        className="pay-strip-cta"
      >
        {mineToPay.length ? 'Pay now' : 'Review'}
        <ChevronRight className="w-4 h-4" />
      </Link>
    </section>
  );
}

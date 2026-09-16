import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Banknote, ChevronRight } from 'lucide-react';
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
    listMySettlements()
      .then((list) => setRows(Array.isArray(list) ? list : []))
      .catch(() => setRows([]));
  }, [me]);

  const mineToPay = rows.filter((r) => r.fromUid === me && String(r.status || '').toUpperCase() !== 'PAID');
  const waiting = rows.filter((r) => r.toUid === me && r.fromUid !== me && String(r.status || '').toUpperCase() !== 'PAID');
  if (!mineToPay.length && !waiting.length) return null;

  const duePaise = mineToPay.reduce((s, r) => s + Number(r.amountPaise || 0), 0);
  const symbol = getCurrencySymbol(mineToPay[0]?.currency || waiting[0]?.currency || 'INR');
  const top = mineToPay[0] || waiting[0];

  return (
    <section className="pay-strip" aria-label="Pending payments">
      <div className="pay-strip-orb" aria-hidden>
        <Banknote className="w-5 h-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="pay-strip-kicker">Needs attention</p>
        {mineToPay.length ? (
          <p className="pay-strip-title">
            {mineToPay.length} pending payment{mineToPay.length === 1 ? '' : 's'} · {symbol}{paiseToUpiAmount(duePaise)}
          </p>
        ) : (
          <p className="pay-strip-title">{waiting.length} incoming settlement{waiting.length === 1 ? '' : 's'}</p>
        )}
        <p className="pay-strip-meta">
          {top?.expenseDescription || top?.merchant || 'Split share'}
          {top?.receiverNameSnapshot ? ` · ${top.receiverNameSnapshot}` : ''}
        </p>
      </div>
      <Link
        to={top ? `/book/${top.bookId}?pay=${encodeURIComponent(top.id)}` : '/expenses'}
        className="pay-strip-cta"
      >
        {mineToPay.length ? 'Pay' : 'View'}
        <ChevronRight className="w-4 h-4" />
      </Link>
    </section>
  );
}

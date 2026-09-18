import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, ChevronDown, RefreshCw, Search, Users } from 'lucide-react';
import {
  listMemberUpi,
  listSettlements,
  requestMemberUpi,
  type MoneySettlementRow,
} from '../lib/money-api';
import { canStartPayment, paiseToUpiAmount, paymentStatusLabel } from '../lib/upi';
import SettlementPaySheet from './SettlementPaySheet';
import UpiSetupSheet from './UpiSetupSheet';
import { UpiBrandMark } from './UpiBrandMark';
import './split-premium.css';

type Props = {
  bookId: string;
  currentUid: string;
  symbol?: string;
  myUpiId?: string;
  myUpiName?: string;
  onToast: (msg: string, kind?: 'success' | 'error') => void;
  onProfileRefresh?: () => void;
  initialPayId?: string;
  /** Fired when deep-link pay should be cleared from the URL. */
  onPayConsumed?: () => void;
  /** compact = toolbar collapse; page = full Splits tab */
  variant?: 'compact' | 'page';
};

type Filter = 'all' | 'unpaid' | 'pay' | 'receive' | 'failed' | 'paid';

function statusTone(status: string) {
  const s = String(status || '').toUpperCase();
  if (s === 'PAID') return 'ok';
  if (s === 'FAILED' || s === 'CANCELLED' || s === 'EXPIRED') return 'bad';
  if (s === 'PAYMENT_STARTED' || s === 'AWAITING_CONFIRMATION' || s === 'UNKNOWN' || s === 'REVIEW_REQUIRED') return 'warn';
  return 'idle';
}

export default function SettlementsPanel({
  bookId,
  currentUid,
  symbol = '₹',
  myUpiId = '',
  myUpiName = '',
  onToast,
  onProfileRefresh,
  variant = 'compact',
  initialPayId = '',
  onPayConsumed,
}: Props) {
  const [rows, setRows] = useState<MoneySettlementRow[]>([]);
  const [members, setMembers] = useState<Array<{ uid: string; displayName: string; hasUpi: boolean; email: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(variant === 'page');
  const [payTarget, setPayTarget] = useState<MoneySettlementRow | null>(null);
  const [payFromNotification, setPayFromNotification] = useState(false);
  const [upiOpen, setUpiOpen] = useState(false);
  const [askUid, setAskUid] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [q, setQ] = useState('');
  const [savedUpi, setSavedUpi] = useState(myUpiId);
  const consumedPay = React.useRef('');

  useEffect(() => {
    setSavedUpi(myUpiId);
  }, [myUpiId]);

  const refresh = useCallback(async () => {
    if (!bookId) return;
    setLoading(true);
    try {
      const [settlements, upiMembers] = await Promise.all([
        listSettlements(bookId),
        listMemberUpi(bookId),
      ]);
      setRows(settlements);
      setMembers(upiMembers.map((m) => ({
        uid: m.uid,
        displayName: m.displayName,
        hasUpi: m.hasUpi,
        email: m.email,
      })));
      setPayTarget((prev) => (prev ? settlements.find((s) => s.id === prev.id) || prev : null));
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not load settlements';
      if (!/unknown money operation/i.test(msg)) onToast(msg, 'error');
    } finally {
      setLoading(false);
    }
  }, [bookId, onToast]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!initialPayId || !rows.length) return;
    if (consumedPay.current === initialPayId) return;
    const hit = rows.find((r) => r.id === initialPayId);
    if (!hit) return;
    if (String(hit.status || '').toUpperCase() === 'PAID') {
      consumedPay.current = initialPayId;
      onPayConsumed?.();
      return;
    }
    setPayFromNotification(true);
    setPayTarget(hit);
    setOpen(true);
  }, [initialPayId, rows, onPayConsumed]);

  const openPay = (row: MoneySettlementRow, fromNotification = false) => {
    if (String(row.status || '').toUpperCase() === 'PAID') return;
    setPayFromNotification(fromNotification);
    setPayTarget(row);
  };

  const closePay = () => {
    if (payTarget?.id && initialPayId && payTarget.id === initialPayId) {
      consumedPay.current = initialPayId;
      onPayConsumed?.();
    }
    setPayTarget(null);
    setPayFromNotification(false);
  };

  const mine = useMemo(
    () => rows.filter((r) => r.fromUid === currentUid || r.toUid === currentUid),
    [rows, currentUid],
  );

  const unpaid = mine.filter((r) => r.status !== 'PAID');
  const missingUpi = members.filter((m) => m.uid !== currentUid && !m.hasUpi);
  const iNeedUpi = !savedUpi;
  const badge = unpaid.filter((r) => r.status !== 'CANCELLED').length || (iNeedUpi ? 1 : 0) || missingUpi.length;

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return mine.filter((r) => {
      const iOwe = r.fromUid === currentUid;
      const s = String(r.status || '').toUpperCase();
      if (filter === 'unpaid' && s === 'PAID') return false;
      if (filter === 'paid' && s !== 'PAID') return false;
      if (filter === 'pay' && !iOwe) return false;
      if (filter === 'receive' && iOwe) return false;
      if (filter === 'failed' && !['FAILED', 'CANCELLED', 'UNKNOWN', 'REVIEW_REQUIRED'].includes(s)) return false;
      if (!needle) return true;
      const hay = `${r.expenseDescription || ''} ${r.merchant || ''} ${r.receiverNameSnapshot || ''} ${r.note || ''} ${paymentStatusLabel(r.status)}`.toLowerCase();
      return hay.includes(needle);
    });
  }, [mine, filter, q, currentUid]);

  const totals = useMemo(() => {
    let owe = 0;
    let due = 0;
    for (const r of mine) {
      if (r.status === 'PAID') continue;
      if (r.fromUid === currentUid) owe += Number(r.amountPaise || 0);
      else due += Number(r.amountPaise || 0);
    }
    return { owe, due };
  }, [mine, currentUid]);

  const askUpi = async (uid: string) => {
    setAskUid(uid);
    try {
      await requestMemberUpi(bookId, uid, 'Please add your UPI ID so we can settle splits in this book.');
      onToast('Asked them to add UPI ID', 'success');
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Could not send request', 'error');
    } finally {
      setAskUid('');
    }
  };

  const listBody = (
    <>
      {variant === 'page' ? (
        <div className="stx-hero">
          <div>
            <p className="stx-kicker">Split settlements</p>
            <h3 className="stx-title">Transactions</h3>
            <p className="stx-sub">Separate from expenses — pay, retry failed UPI, and track who’s owed.</p>
          </div>
          <button type="button" className="byjan-btn-ghost !h-9 !px-2.5" disabled={loading} onClick={() => void refresh()}>
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-2 mb-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Split payments</p>
          <button type="button" className="byjan-btn-ghost !h-8 !px-2" disabled={loading} onClick={() => void refresh()}>
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      )}

      {variant === 'page' ? (
        <div className="stx-stats">
          <div className="stx-stat">
            <span>You owe</span>
            <strong>{symbol}{paiseToUpiAmount(totals.owe)}</strong>
          </div>
          <div className="stx-stat is-in">
            <span>Owed to you</span>
            <strong>{symbol}{paiseToUpiAmount(totals.due)}</strong>
          </div>
        </div>
      ) : null}

      {iNeedUpi ? (
        <div className="mb-2 rounded-xl border border-teal-200 bg-teal-50/70 px-3 py-2">
          <p className="text-sm font-semibold text-teal-900">Add your UPI ID</p>
          <p className="text-xs text-teal-800/80 mt-0.5">Needed so teammates can pay you.</p>
          <button type="button" className="byjan-btn !h-9 mt-2" onClick={() => setUpiOpen(true)}>
            Add UPI ID
          </button>
        </div>
      ) : (
        <div className="mb-2 rounded-xl border border-slate-200 bg-white px-3 py-2 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">Your UPI ID</p>
            <p className="text-sm font-semibold text-[#0B1F3A] truncate">{savedUpi}</p>
          </div>
          <button type="button" className="byjan-btn-ghost !h-8 shrink-0" onClick={() => setUpiOpen(true)}>
            Update
          </button>
        </div>
      )}

      {missingUpi.length > 0 ? (
        <div className="mb-2 space-y-1.5">
          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Waiting for UPI</p>
          {missingUpi.slice(0, variant === 'page' ? 8 : 4).map((m) => (
            <div key={m.uid} className="flex items-center justify-between gap-2 text-sm">
              <span className="text-slate-700 truncate">{m.displayName}</span>
              <button
                type="button"
                className="text-teal-700 font-semibold text-xs shrink-0"
                disabled={askUid === m.uid}
                onClick={() => void askUpi(m.uid)}
              >
                {askUid === m.uid ? 'Asking…' : 'Ask'}
              </button>
            </div>
          ))}
        </div>
      ) : null}

      {variant === 'page' ? (
        <div className="stx-toolbar">
          <label className="stx-search">
            <Search className="w-3.5 h-3.5 text-slate-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search merchant, person, note"
            />
          </label>
          <div className="stx-filters">
            {([
              ['all', 'All'],
              ['unpaid', 'Open'],
              ['pay', 'You pay'],
              ['receive', 'Receive'],
              ['failed', 'Failed'],
              ['paid', 'Paid'],
            ] as Array<[Filter, string]>).map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={`stx-chip ${filter === id ? 'is-on' : ''}`}
                onClick={() => setFilter(id)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className={variant === 'page' ? 'stx-list' : 'space-y-2'}>
        {(variant === 'page' ? filtered : mine.slice(0, 12)).length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 px-4 py-8 text-center text-sm text-slate-500">
            {mine.length === 0 ? 'No split transactions yet. Split an expense to see settlements here.' : 'No matches for this filter.'}
          </div>
        ) : (
          (variant === 'page' ? filtered : mine.slice(0, 12)).map((row) => {
            const iOwe = row.fromUid === currentUid;
            const tone = statusTone(row.status);
            const label = iOwe ? 'You pay' : 'They pay you';
            return (
              <article key={row.id} className={`stx-card tone-${tone}`}>
                <div className={`stx-icon ${iOwe ? 'out' : 'in'}`}>
                  {iOwe ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownLeft className="w-4 h-4" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold text-[#0B1F3A] truncate">
                      {label} {symbol}{paiseToUpiAmount(row.amountPaise)}
                    </p>
                    <span className={`stx-badge tone-${tone}`}>{paymentStatusLabel(row.status)}</span>
                  </div>
                  <p className="text-[12px] text-slate-500 truncate mt-0.5">
                    {row.expenseDescription || row.merchant || 'Split'}
                    {row.receiverNameSnapshot ? ` · ${row.receiverNameSnapshot}` : ''}
                  </p>
                </div>
                {row.status !== 'PAID' ? (
                  <button
                    type="button"
                    className="byjan-btn !h-9 !px-3 text-xs shrink-0 inline-flex items-center"
                    onClick={() => openPay(row, false)}
                  >
                    {iOwe && canStartPayment(row.status) ? (
                      <>
                        <span className="sp-pay-brands" aria-hidden>
                          <span><UpiBrandMark app="phonepe" size={16} /></span>
                          <span><UpiBrandMark app="paytm" size={16} /></span>
                          <span><UpiBrandMark app="cred" size={16} /></span>
                        </span>
                        {['FAILED', 'CANCELLED', 'UNKNOWN'].includes(String(row.status).toUpperCase()) ? 'Retry' : 'Pay'}
                      </>
                    ) : 'Open'}
                  </button>
                ) : (
                  <span className="text-[11px] font-bold text-emerald-700 shrink-0">PAID</span>
                )}
              </article>
            );
          })
        )}
      </div>
    </>
  );

  if (variant === 'compact' && !mine.length && !iNeedUpi && !missingUpi.length) {
    return null;
  }

  return (
    <div className={variant === 'page' ? 'stx-page' : 'tool-collapse'}>
      {variant === 'compact' ? (
        <>
          <button
            type="button"
            className="tool-collapse-trigger"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            <Users className="w-3.5 h-3.5" />
            Split
            {badge > 0 ? <span className="tool-collapse-badge">{badge > 9 ? '9+' : badge}</span> : null}
            <ChevronDown className={`w-3.5 h-3.5 tool-collapse-chevron ${open ? 'is-open' : ''}`} />
          </button>
          {open ? <div className="tool-collapse-panel">{listBody}</div> : null}
        </>
      ) : (
        listBody
      )}

      <SettlementPaySheet
        open={Boolean(payTarget)}
        bookId={bookId}
        settlement={payTarget}
        currentUid={currentUid}
        symbol={symbol}
        requireSwipe={payFromNotification}
        onClose={closePay}
        onPaid={() => {
          if (payTarget?.id) consumedPay.current = payTarget.id;
          onPayConsumed?.();
        }}
        onChanged={() => void refresh()}
        onToast={onToast}
        onNeedReceiverUpi={() => {
          closePay();
          onToast('Ask the recipient to add their UPI ID', 'error');
        }}
      />

      <UpiSetupSheet
        open={upiOpen}
        initialUpiId={savedUpi || myUpiId}
        initialName={myUpiName}
        onClose={() => setUpiOpen(false)}
        onSaved={(profile) => {
          setSavedUpi(profile.upiId);
          onProfileRefresh?.();
          void refresh();
        }}
        onToast={onToast}
      />
    </div>
  );
}

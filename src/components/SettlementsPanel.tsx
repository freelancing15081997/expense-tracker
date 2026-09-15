import React, { useCallback, useEffect, useState } from 'react';
import { ChevronDown, IndianRupee, RefreshCw, Users } from 'lucide-react';
import {
  listMemberUpi,
  listSettlements,
  requestMemberUpi,
  type MoneySettlementRow,
} from '../lib/money-api';
import { canStartPayment, paiseToUpiAmount, paymentStatusLabel } from '../lib/upi';
import SettlementPaySheet from './SettlementPaySheet';
import UpiSetupSheet from './UpiSetupSheet';

type Props = {
  bookId: string;
  currentUid: string;
  symbol?: string;
  myUpiId?: string;
  myUpiName?: string;
  onToast: (msg: string, kind?: 'success' | 'error') => void;
  onProfileRefresh?: () => void;
};

export default function SettlementsPanel({
  bookId,
  currentUid,
  symbol = '₹',
  myUpiId = '',
  myUpiName = '',
  onToast,
  onProfileRefresh,
}: Props) {
  const [rows, setRows] = useState<MoneySettlementRow[]>([]);
  const [members, setMembers] = useState<Array<{ uid: string; displayName: string; hasUpi: boolean; email: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [payTarget, setPayTarget] = useState<MoneySettlementRow | null>(null);
  const [upiOpen, setUpiOpen] = useState(false);
  const [askUid, setAskUid] = useState('');

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

  const mine = rows.filter((r) => r.fromUid === currentUid || r.toUid === currentUid);
  const unpaid = mine.filter((r) => r.status !== 'PAID' && r.status !== 'CANCELLED');
  const missingUpi = members.filter((m) => m.uid !== currentUid && !m.hasUpi);
  const iNeedUpi = !myUpiId;
  const badge = unpaid.length || (iNeedUpi ? 1 : 0) || missingUpi.length;

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

  if (!mine.length && !iNeedUpi && !missingUpi.length) {
    return null;
  }

  return (
    <div className="tool-collapse">
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

      {open ? (
        <div className="tool-collapse-panel">
          <div className="flex items-center justify-between gap-2 mb-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Split payments</p>
            <button type="button" className="byjan-btn-ghost !h-8 !px-2" disabled={loading} onClick={() => void refresh()}>
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {iNeedUpi ? (
            <div className="mb-2 rounded-xl border border-teal-200 bg-teal-50/70 px-3 py-2">
              <p className="text-sm font-semibold text-teal-900">Add your UPI ID</p>
              <p className="text-xs text-teal-800/80 mt-0.5">Needed so teammates can pay you.</p>
              <button type="button" className="byjan-btn !h-9 mt-2" onClick={() => setUpiOpen(true)}>
                Add UPI ID
              </button>
            </div>
          ) : null}

          {missingUpi.length > 0 ? (
            <div className="mb-2 space-y-1.5">
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Waiting for UPI</p>
              {missingUpi.slice(0, 4).map((m) => (
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

          <div className="space-y-2">
            {mine.slice(0, 12).map((row) => {
              const iOwe = row.fromUid === currentUid;
              const label = iOwe ? 'You pay' : 'They pay you';
              return (
                <div key={row.id} className="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-2.5 py-2">
                  <div className="w-8 h-8 rounded-lg bg-slate-100 text-[#0B1F3A] inline-flex items-center justify-center shrink-0">
                    <IndianRupee className="w-3.5 h-3.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-[#0B1F3A] truncate">
                      {label} {symbol}{paiseToUpiAmount(row.amountPaise)}
                    </p>
                    <p className="text-[11px] text-slate-500 truncate">
                      {paymentStatusLabel(row.status)} · {row.expenseDescription || row.merchant || 'Split'}
                    </p>
                  </div>
                  {row.status !== 'PAID' ? (
                    <button
                      type="button"
                      className="byjan-btn !h-8 !px-2.5 text-xs shrink-0"
                      onClick={() => setPayTarget(row)}
                    >
                      {iOwe && canStartPayment(row.status) ? 'Pay' : 'Open'}
                    </button>
                  ) : (
                    <span className="text-[11px] font-bold text-emerald-700">PAID</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      <SettlementPaySheet
        open={Boolean(payTarget)}
        bookId={bookId}
        settlement={payTarget}
        currentUid={currentUid}
        symbol={symbol}
        onClose={() => setPayTarget(null)}
        onChanged={() => void refresh()}
        onToast={onToast}
        onNeedReceiverUpi={() => {
          setPayTarget(null);
          onToast('Ask the recipient to add their UPI ID', 'error');
        }}
      />

      <UpiSetupSheet
        open={upiOpen}
        initialUpiId={myUpiId}
        initialName={myUpiName}
        onClose={() => setUpiOpen(false)}
        onSaved={() => {
          onProfileRefresh?.();
          void refresh();
        }}
        onToast={onToast}
      />
    </div>
  );
}

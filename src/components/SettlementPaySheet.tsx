import React, { useMemo, useState } from 'react';
import { Copy, X } from 'lucide-react';
import {
  confirmSettlementReceived,
  markSettlementReview,
  reportUpiReturn,
  startUpiPayment,
  type MoneySettlementRow,
} from '../lib/money-api';
import {
  buildAppUpiUri,
  canStartPayment,
  copyText,
  launchUpiPayNative,
  launchUpiUri,
  paiseToUpiAmount,
  paymentStatusLabel,
} from '../lib/upi';
import './split-premium.css';

type Props = {
  open: boolean;
  bookId: string;
  settlement: MoneySettlementRow | null;
  currentUid: string;
  symbol?: string;
  onClose: () => void;
  onChanged: () => void;
  onToast: (msg: string, kind?: 'success' | 'error') => void;
  onNeedReceiverUpi?: (toUid: string) => void;
};

const APPS: Array<{ id: 'generic' | 'gpay' | 'phonepe' | 'paytm' | 'bhim'; label: string }> = [
  { id: 'generic', label: 'Any UPI app' },
  { id: 'gpay', label: 'Google Pay' },
  { id: 'phonepe', label: 'PhonePe' },
  { id: 'paytm', label: 'Paytm' },
  { id: 'bhim', label: 'BHIM' },
];

export default function SettlementPaySheet({
  open,
  bookId,
  settlement,
  currentUid,
  symbol = '₹',
  onClose,
  onChanged,
  onToast,
  onNeedReceiverUpi,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState<'ready' | 'waiting' | 'done' | 'unclear'>('ready');
  const [attemptId, setAttemptId] = useState('');
  const [statusMsg, setStatusMsg] = useState('');
  const [fallback, setFallback] = useState<{ upiId: string; amount: string; note: string; title: string } | null>(null);
  const [payMeta, setPayMeta] = useState<{ upiId: string; recipientName: string; amount: string; upiUri: string } | null>(null);

  const role = useMemo(() => {
    if (!settlement) return 'none';
    if (settlement.fromUid === currentUid) return 'payer';
    if (settlement.toUid === currentUid) return 'receiver';
    return 'viewer';
  }, [settlement, currentUid]);

  React.useEffect(() => {
    if (!open) return;
    setPhase('ready');
    setAttemptId('');
    setStatusMsg('');
    setFallback(null);
    setPayMeta(null);
  }, [open, settlement?.id]);

  if (!open || !settlement) return null;

  const amountLabel = `${symbol}${paiseToUpiAmount(settlement.amountPaise)}`;

  const applyNativeResult = async (
    attempt: string,
    native: NonNullable<Awaited<ReturnType<typeof launchUpiPayNative>>>,
  ) => {
    const res = await reportUpiReturn({
      bookId,
      attemptId: attempt,
      outcome: native.outcome,
      userAction: native.outcome,
      returnedStatus: native.status,
      responseCode: native.responseCode,
      upiReference: native.approvalRefNo || native.txnId || native.txnRef,
      raw: {
        ...(native.raw || {}),
        resultCode: (native as any).resultCode,
        message: native.message,
      },
    });
    setStatusMsg(res.message || paymentStatusLabel(String(res.status || '')));
    setPhase(res.status === 'PAID' || res.status === 'FAILED' || res.status === 'CANCELLED' ? 'done' : 'unclear');
    onChanged();
    const errLike = res.status === 'CANCELLED' || res.status === 'FAILED' || res.status === 'UNKNOWN';
    onToast(res.message || 'Status updated', errLike ? 'error' : 'success');
    if (res.status === 'PAID') onClose();
  };

  const startPay = async (app: typeof APPS[number]['id']) => {
    setBusy(true);
    setStatusMsg('');
    try {
      const res = await startUpiPayment(bookId, settlement.id, app);
      if (!res.attemptId) throw new Error(res.message || 'Could not start payment');
      setAttemptId(res.attemptId);
      setPhase('waiting');
      setStatusMsg(res.message || 'Complete payment in your UPI app…');
      if (res.fallback) setFallback(res.fallback);
      const meta = {
        upiId: String(res.upiId || ''),
        recipientName: String(res.recipientName || ''),
        amount: String(res.amount || paiseToUpiAmount(settlement.amountPaise)),
        upiUri: String(res.upiUri || ''),
      };
      setPayMeta(meta);

      let uri = meta.upiUri;
      if (app !== 'generic' && meta.upiId) {
        try {
          uri = buildAppUpiUri(app, {
            pa: meta.upiId,
            pn: meta.recipientName,
            am: meta.amount,
            tn: settlement.expenseDescription || 'Byjan split',
            tr: String(res.generatedTxnId || ''),
          });
        } catch {
          /* keep generic */
        }
      }

      if (!uri) {
        setFallback({
          title: 'UPI payment could not be fully prefilled',
          upiId: meta.upiId,
          amount: meta.amount,
          note: settlement.expenseDescription || 'Byjan split',
        });
        setPhase('unclear');
        onToast('Open your UPI app and pay using the details below', 'error');
        return;
      }

      const native = await launchUpiPayNative(uri);
      if (native) {
        await applyNativeResult(res.attemptId, native);
        return;
      }

      // Web / no native plugin: open URI; only show manual actions if result is unclear later.
      const launched = await launchUpiUri(uri);
      if (!launched.opened) {
        setFallback({
          title: 'UPI payment could not be fully prefilled',
          upiId: meta.upiId,
          amount: meta.amount,
          note: settlement.expenseDescription || 'Byjan split',
        });
        await reportUpiReturn({
          bookId,
          attemptId: res.attemptId,
          outcome: 'failed',
          userAction: 'failed',
          returnedStatus: launched.error,
        });
        setPhase('done');
        setStatusMsg(launched.error || 'Could not open a UPI app');
        onToast(launched.error || 'Could not open a UPI app', 'error');
      } else {
        setPhase('unclear');
        setStatusMsg('Finish in your UPI app. If the result isn’t read automatically, use the options below.');
        onToast('Opened UPI app — complete the payment there', 'success');
      }
      onChanged();
    } catch (err: any) {
      const msg = err?.message || 'Could not start UPI payment';
      const code = err?.extra?.code || err?.code;
      if (String(msg).includes('UPI ID') || code === 'RECEIVER_UPI_MISSING') {
        onNeedReceiverUpi?.(settlement.toUid);
      }
      onToast(msg, 'error');
      setPhase('ready');
    } finally {
      setBusy(false);
    }
  };

  const afterReturn = async (userAction: 'cancelled' | 'failed' | 'unknown') => {
    if (!attemptId) {
      onClose();
      return;
    }
    setBusy(true);
    try {
      const res = await reportUpiReturn({ bookId, attemptId, userAction, outcome: userAction });
      setStatusMsg(res.message || paymentStatusLabel(String(res.status || '')));
      setPhase('done');
      onChanged();
      onToast(res.message || 'Status updated', res.status === 'CANCELLED' || res.status === 'FAILED' ? 'error' : 'success');
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Could not update status', 'error');
    } finally {
      setBusy(false);
    }
  };

  const confirmReceived = async () => {
    setBusy(true);
    try {
      await confirmSettlementReceived(bookId, settlement.id);
      onToast('Marked paid after you confirmed receipt', 'success');
      onChanged();
      onClose();
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Could not confirm', 'error');
    } finally {
      setBusy(false);
    }
  };

  const needReview = async () => {
    setBusy(true);
    try {
      await markSettlementReview(bookId, settlement.id, 'User requested review');
      onToast('Marked for review', 'success');
      onChanged();
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Could not update', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="sp-root" role="dialog" aria-modal="true" aria-label="Settle payment">
      <button type="button" className="sp-dim" aria-label="Close" onClick={onClose} />
      <div className="sp-sheet">
        <div className="sp-handle" aria-hidden />
        <header className="sp-head">
          <div>
            <p className="sp-kicker">{paymentStatusLabel(settlement.status)}</p>
            <h2 className="sp-title">Pay {amountLabel}</h2>
          </div>
          <button type="button" className="sp-close" onClick={onClose} aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </header>

        <div className="sp-hero">
          <p className="sp-hero-label">To</p>
          <p className="sp-hero-amount" style={{ fontSize: 22 }}>
            {settlement.receiverNameSnapshot || 'Teammate'}
          </p>
          <div className="sp-meters">
            <div>
              <span>UPI ID</span>
              <strong style={{ fontSize: 13 }}>{settlement.receiverUpiSnapshot || 'Not set yet'}</strong>
            </div>
            <div>
              <span>For</span>
              <strong style={{ fontSize: 13 }}>{settlement.expenseDescription || settlement.merchant || 'Split'}</strong>
            </div>
          </div>
        </div>

        {role === 'payer' && phase === 'ready' && canStartPayment(settlement.status) ? (
          <>
            <p className="sp-kicker" style={{ marginBottom: 8 }}>Choose payment app</p>
            <div className="sp-methods" style={{ gridTemplateColumns: '1fr 1fr', marginBottom: 12 }}>
              {APPS.map((app) => (
                <button key={app.id} type="button" disabled={busy} onClick={() => void startPay(app.id)}>
                  {app.label}
                </button>
              ))}
            </div>
            <p style={{ fontSize: 12, color: 'rgba(244,241,234,0.45)', marginBottom: 8 }}>
              Success or failure is read automatically when the UPI app returns a result. Recipient confirm is optional later if needed.
            </p>
          </>
        ) : null}

        {phase === 'waiting' ? (
          <div className="sp-row is-on" style={{ marginBottom: 12 }}>
            <div className="sp-meta" style={{ gridColumn: '1 / -1' }}>
              <p className="sp-name">Waiting for UPI app…</p>
              <p className="sp-email">{statusMsg || 'Complete the payment — Byjan will read the result when the app returns.'}</p>
            </div>
          </div>
        ) : null}

        {phase === 'done' || phase === 'unclear' ? (
          <div className="sp-row is-on" style={{ marginBottom: 12 }}>
            <div className="sp-meta" style={{ gridColumn: '1 / -1' }}>
              <p className="sp-name">{statusMsg || 'Status updated'}</p>
              {phase === 'unclear' ? (
                <p className="sp-email">No clear success/failure from the UPI app. Retry, cancel, or the recipient can confirm later.</p>
              ) : null}
            </div>
          </div>
        ) : null}

        {(fallback || payMeta) && phase !== 'waiting' && (
          <div style={{ display: 'grid', gap: 8, marginBottom: 12 }}>
            {fallback ? <p className="sp-error">{fallback.title}</p> : null}
            <button
              type="button"
              className="sp-select-all"
              onClick={() => void copyText(fallback?.upiId || payMeta?.upiId || '').then((ok) => onToast(ok ? 'UPI ID copied' : 'Copy failed', ok ? 'success' : 'error'))}
            >
              <Copy className="w-3.5 h-3.5 inline" /> Copy UPI ID
            </button>
            <button
              type="button"
              className="sp-select-all"
              onClick={() => void copyText(fallback?.amount || payMeta?.amount || '').then((ok) => onToast(ok ? 'Amount copied' : 'Copy failed', ok ? 'success' : 'error'))}
            >
              <Copy className="w-3.5 h-3.5 inline" /> Copy amount
            </button>
          </div>
        )}

        {role === 'payer' && phase === 'unclear' ? (
          <div className="sp-footer">
            <button type="button" className="sp-select-all" disabled={busy} onClick={() => void afterReturn('cancelled')}>
              I cancelled / it failed
            </button>
            <button type="button" className="sp-select-all" disabled={busy} onClick={() => void needReview()}>
              Needs review
            </button>
            <button type="button" className="sp-cta" disabled={busy || !canStartPayment(settlement.status)} onClick={() => { setPhase('ready'); setStatusMsg(''); }}>
              Try again
            </button>
          </div>
        ) : null}

        {role === 'receiver' && settlement.status !== 'PAID' ? (
          <div className="sp-footer">
            <p className="sp-footer-meta">Optional: confirm only if you actually received {amountLabel} and it wasn’t already marked paid.</p>
            <button type="button" className="sp-cta" disabled={busy} onClick={() => void confirmReceived()}>
              {busy ? 'Saving…' : `Confirm received ${amountLabel}`}
            </button>
            <button type="button" className="sp-select-all" disabled={busy} onClick={() => void needReview()}>
              Mark for review
            </button>
          </div>
        ) : null}

        {settlement.status === 'PAID' || (phase === 'done' && statusMsg.toLowerCase().includes('success')) ? (
          <p style={{ textAlign: 'center', color: '#6fcbb4', fontWeight: 700 }}>Paid</p>
        ) : null}
      </div>
    </div>
  );
}

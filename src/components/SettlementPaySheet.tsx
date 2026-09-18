import React, { useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, Copy, RefreshCw, X, XCircle } from 'lucide-react';
import {
  confirmSettlementReceived,
  markSettlementReview,
  reportUpiReturn,
  startUpiPayment,
  type MoneySettlementRow,
} from '../lib/money-api';
import {
  UPI_APP_PACKAGES,
  UPI_PAY_APPS,
  type UpiAppId,
  buildAppUpiUri,
  copyText,
  launchUpiPayNative,
  launchUpiUri,
  paiseToUpiAmount,
  paymentStatusLabel,
} from '../lib/upi';
import { UpiBrandMark } from './UpiBrandMark';
import './split-premium.css';

type Props = {
  open: boolean;
  bookId: string;
  settlement: MoneySettlementRow | null;
  currentUid: string;
  symbol?: string;
  /** Swipe unlock only from notification / deep-link — Pay button skips swipe. */
  requireSwipe?: boolean;
  onClose: () => void;
  onChanged: () => void;
  onToast: (msg: string, kind?: 'success' | 'error') => void;
  onNeedReceiverUpi?: (toUid: string) => void;
  /** Called when payment succeeds so parent can clear ?pay= and not reopen. */
  onPaid?: () => void;
};

type Phase = 'ready' | 'waiting' | 'paid' | 'failed' | 'unclear';

export default function SettlementPaySheet({
  open,
  bookId,
  settlement,
  currentUid,
  symbol = '₹',
  requireSwipe = false,
  onClose,
  onChanged,
  onToast,
  onNeedReceiverUpi,
  onPaid,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState<Phase>('ready');
  const [attemptId, setAttemptId] = useState('');
  const [statusMsg, setStatusMsg] = useState('');
  const [lastApp, setLastApp] = useState<UpiAppId>('generic');
  const [fallback, setFallback] = useState<{ upiId: string; amount: string; note: string; title: string } | null>(null);
  const [payUnlocked, setPayUnlocked] = useState(!requireSwipe);
  const [swipeX, setSwipeX] = useState(0);
  const swipeStart = React.useRef<number | null>(null);
  const swipeXRef = React.useRef(0);
  const [payMeta, setPayMeta] = useState<{ upiId: string; recipientName: string; amount: string; upiUri: string } | null>(null);
  const paidOnce = React.useRef(false);

  const role = useMemo(() => {
    if (!settlement) return 'none';
    if (settlement.fromUid === currentUid) return 'payer';
    if (settlement.toUid === currentUid) return 'receiver';
    return 'viewer';
  }, [settlement, currentUid]);

  React.useEffect(() => {
    if (!open) return;
    paidOnce.current = false;
    setPhase('ready');
    setAttemptId('');
    setStatusMsg('');
    setFallback(null);
    setPayMeta(null);
    setPayUnlocked(!requireSwipe);
    setSwipeX(requireSwipe ? 0 : 1);
    swipeXRef.current = requireSwipe ? 0 : 1;
    swipeStart.current = null;
  }, [open, settlement?.id, requireSwipe]);

  if (!open || !settlement) return null;

  const statusUpper = String(settlement.status || '').toUpperCase();
  const amountLabel = `${symbol}${paiseToUpiAmount(settlement.amountPaise)}`;

  const finishPaid = (message?: string) => {
    if (paidOnce.current) return;
    paidOnce.current = true;
    setPhase('paid');
    onToast(message || 'Payment successful', 'success');
    onChanged();
    onPaid?.();
    onClose();
  };

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
    const status = String(res.status || '').toUpperCase();
    setStatusMsg(res.message || paymentStatusLabel(status));
    onChanged();

    if (status === 'PAID') {
      finishPaid(res.message || 'Payment successful');
      return;
    }
    if (status === 'FAILED' || status === 'CANCELLED') {
      setPhase('failed');
      onToast(res.message || 'Payment failed', 'error');
      return;
    }
    setPhase('unclear');
    onToast(res.message || 'Couldn’t verify payment yet', 'error');
  };

  const startPay = async (app: UpiAppId) => {
    setBusy(true);
    setStatusMsg('');
    setLastApp(app);
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
        setPhase('failed');
        setStatusMsg('Could not open UPI — use the details below or retry.');
        onToast('Open your UPI app and pay using the details below', 'error');
        return;
      }

      const pkg = UPI_APP_PACKAGES[app];
      let native = await launchUpiPayNative(uri, pkg);
      if (native?.status === 'NO_UPI_APP' && meta.upiUri && uri !== meta.upiUri) {
        native = await launchUpiPayNative(meta.upiUri, pkg);
      }
      if (native?.status === 'NO_UPI_APP' && meta.upiUri) {
        native = await launchUpiPayNative(meta.upiUri);
      }
      if (native && native.status !== 'NO_UPI_APP') {
        await applyNativeResult(res.attemptId, native);
        return;
      }

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
        setPhase('failed');
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
      setPhase('failed');
      setStatusMsg(msg);
      onToast(msg, 'error');
    } finally {
      setBusy(false);
    }
  };

  const afterReturn = async (userAction: 'cancelled' | 'failed' | 'unknown') => {
    if (!attemptId) {
      setPhase('failed');
      setStatusMsg('Payment did not complete.');
      return;
    }
    setBusy(true);
    try {
      const res = await reportUpiReturn({ bookId, attemptId, userAction, outcome: userAction });
      setStatusMsg(res.message || paymentStatusLabel(String(res.status || '')));
      if (res.status === 'PAID') {
        finishPaid(res.message);
        return;
      }
      setPhase('failed');
      onChanged();
      onToast(res.message || 'Status updated', 'error');
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
      finishPaid('Marked paid — you confirmed receipt');
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Could not confirm', 'error');
    } finally {
      setBusy(false);
    }
  };

  const didNotReceive = async () => {
    setBusy(true);
    try {
      await markSettlementReview(bookId, settlement.id, 'Receiver: I did not get this payment');
      onToast('Marked as not received — flagged for review', 'error');
      onChanged();
      // Do not call onPaid — that clears ?pay= as if the settlement was paid.
      onClose();
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Could not update', 'error');
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

  const retryPay = () => {
    setPhase('ready');
    setStatusMsg('');
    setAttemptId('');
    setPayUnlocked(true);
    void startPay(lastApp || 'generic');
  };

  if (statusUpper === 'PAID' || phase === 'paid') {
    return (
      <div className="sp-root" role="dialog" aria-modal="true" aria-label="Payment complete">
        <button type="button" className="sp-dim" aria-label="Close" onClick={onClose} />
        <div className="sp-sheet">
          <div className="sp-handle" aria-hidden />
          <div className="sp-done">
            <CheckCircle2 className="w-10 h-10" />
            <p className="sp-done-title">Already settled</p>
            <p className="sp-done-sub">{amountLabel} · no further action needed</p>
            <button type="button" className="sp-cta" onClick={onClose}>Done</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="sp-root" role="dialog" aria-modal="true" aria-label="Settle payment">
      <button type="button" className="sp-dim" aria-label="Close" onClick={onClose} />
      <div className="sp-sheet">
        <div className="sp-handle" aria-hidden />
        <header className="sp-head">
          <div>
            <p className="sp-kicker">{paymentStatusLabel(settlement.status)}</p>
            <h2 className="sp-title">{role === 'receiver' ? `Confirm ${amountLabel}` : `Pay ${amountLabel}`}</h2>
          </div>
          <button type="button" className="sp-close" onClick={onClose} aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </header>

        <div className="sp-body">
          <div className="sp-hero">
            <p className="sp-hero-label">{role === 'receiver' ? 'From' : 'To'}</p>
            <div className="sp-glass-card">
              <p className="sp-hero-amount" style={{ fontSize: 20 }}>
                {role === 'receiver'
                  ? (settlement as any).payerNameSnapshot || settlement.receiverNameSnapshot || 'Teammate'
                  : settlement.receiverNameSnapshot || 'Teammate'}
              </p>
            </div>
            <div className="sp-meters">
              <div className="sp-glass-card">
                <span>UPI ID</span>
                <strong style={{ fontSize: 13 }}>{settlement.receiverUpiSnapshot || 'Not set yet'}</strong>
              </div>
              <div className="sp-glass-card">
                <span>For</span>
                <strong style={{ fontSize: 13 }}>{settlement.expenseDescription || settlement.merchant || 'Split'}</strong>
              </div>
            </div>
          </div>

          {role === 'receiver' ? (
            <div className="sp-confirm-pair" role="group" aria-label="Confirm receipt">
              <p className="sp-confirm-lead">Did you receive {amountLabel}?</p>
              <button type="button" className="sp-cta sp-cta-ok" disabled={busy} onClick={() => void confirmReceived()}>
                <CheckCircle2 className="w-4 h-4" />
                {busy ? 'Saving…' : 'I received this'}
              </button>
              <button type="button" className="sp-cta-deny" disabled={busy} onClick={() => void didNotReceive()}>
                <XCircle className="w-4 h-4" />
                I did not get it
              </button>
            </div>
          ) : null}

          {phase === 'failed' ? (
            <div className="sp-fail-card" role="alert">
              <div className="sp-fail-icon">
                <AlertCircle className="w-6 h-6" />
              </div>
              <p className="sp-fail-title">Payment failed</p>
              <p className="sp-fail-detail">{statusMsg || 'The UPI app reported a failure or cancel. Nothing was marked paid.'}</p>
              {role === 'payer' ? (
                <div className="sp-footer" style={{ marginTop: 14 }}>
                  <button type="button" className="sp-cta" disabled={busy} onClick={() => void retryPay()}>
                    <RefreshCw className="w-4 h-4 inline" style={{ marginRight: 6 }} />
                    {busy ? 'Retrying…' : 'Retry payment'}
                  </button>
                  <button type="button" className="sp-select-all" disabled={busy} onClick={() => { setPhase('ready'); setStatusMsg(''); setPayUnlocked(true); }}>
                    Choose another app
                  </button>
                  <button type="button" className="sp-select-all" disabled={busy} onClick={() => void needReview()}>
                    Needs review
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}

          {role === 'payer' && phase === 'ready' ? (
            <>
              {requireSwipe && !payUnlocked ? (
                <>
                  <p className="sp-kicker" style={{ marginBottom: 8 }}>Slide to unlock payment</p>
                  <div
                    className={`sp-swipe${swipeX > 0.62 ? ' is-go' : ''}${swipeX > 0.08 ? ' is-drag' : ''}`}
                    onPointerDown={(e) => {
                      swipeStart.current = e.clientX;
                      (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
                    }}
                    onPointerMove={(e) => {
                      if (swipeStart.current == null) return;
                      const w = Math.max(1, (e.currentTarget as HTMLDivElement).clientWidth - 48);
                      const next = Math.max(0, Math.min(1, (e.clientX - swipeStart.current) / w));
                      swipeXRef.current = next;
                      setSwipeX(next);
                    }}
                    onPointerUp={() => {
                      if (swipeXRef.current > 0.62) {
                        setPayUnlocked(true);
                        setSwipeX(1);
                      } else {
                        setSwipeX(0);
                        swipeXRef.current = 0;
                      }
                      swipeStart.current = null;
                    }}
                  >
                    <span className="sp-swipe-track" aria-hidden />
                    <span className="sp-swipe-fill" style={{ width: `${Math.max(22, swipeX * 100)}%` }} />
                    <span className="sp-swipe-hint">{swipeX > 0.62 ? 'Release' : 'Swipe to pay'}</span>
                    <span className="sp-swipe-knob" style={{ left: `calc(4px + ${swipeX} * (100% - 48px))` }}>
                      <span className="sp-swipe-chevrons" aria-hidden>
                        <i /><i /><i />
                      </span>
                    </span>
                  </div>
                </>
              ) : (
                <>
                  <p className="sp-kicker" style={{ marginBottom: 8 }}>Pay with</p>
                  <div className="sp-partners">
                    {UPI_PAY_APPS.map((app) => (
                      <button
                        key={app.id}
                        type="button"
                        className="sp-partner"
                        disabled={busy}
                        aria-label={`Pay with ${app.label}`}
                        onClick={() => void startPay(app.id)}
                      >
                        <span className="sp-partner-mark">
                          <UpiBrandMark app={app.id} size={40} />
                        </span>
                        {app.label}
                      </button>
                    ))}
                  </div>
                  <p style={{ fontSize: 12, color: 'rgba(244,241,234,0.45)', marginBottom: 8 }}>
                    Success or failure is read automatically when you return from the UPI app.
                  </p>
                </>
              )}
            </>
          ) : null}

          {phase === 'waiting' ? (
            <div className="sp-row is-on" style={{ marginBottom: 12 }}>
              <div className="sp-meta" style={{ gridColumn: '1 / -1' }}>
                <p className="sp-name">Waiting for UPI app…</p>
                <p className="sp-email">{statusMsg || 'Complete the payment — Byjan reads success or failure when the app returns.'}</p>
              </div>
            </div>
          ) : null}

          {phase === 'unclear' ? (
            <div className="sp-row is-on" style={{ marginBottom: 12 }}>
              <div className="sp-meta" style={{ gridColumn: '1 / -1' }}>
                <p className="sp-name">{statusMsg || 'No clear result yet'}</p>
                <p className="sp-email">Retry, mark failed, or the recipient can confirm later if money actually arrived.</p>
              </div>
            </div>
          ) : null}

          {(fallback || payMeta) && phase !== 'waiting' && phase !== 'paid' && (
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
              <button type="button" className="sp-cta" disabled={busy} onClick={() => void retryPay()}>
                <RefreshCw className="w-4 h-4 inline" style={{ marginRight: 6 }} /> Retry payment
              </button>
              <button type="button" className="sp-select-all" disabled={busy} onClick={() => void afterReturn('failed')}>
                Mark as failed
              </button>
              <button type="button" className="sp-select-all" disabled={busy} onClick={() => void needReview()}>
                Needs review
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

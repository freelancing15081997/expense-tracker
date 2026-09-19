import React, { useEffect, useState } from 'react';
import { Check, Shield, X } from 'lucide-react';
import { saveMyUpi } from '../lib/money-api';
import { normalizeVpa, validateUpiId } from '../lib/upi';
import './split-premium.css';

type Props = {
  open: boolean;
  initialUpiId?: string;
  initialName?: string;
  onClose: () => void;
  onSaved?: (profile: { upiId: string; upiDisplayName: string; upiStatus: string }) => void;
  onToast?: (msg: string, kind?: 'success' | 'error') => void;
};

export default function UpiSetupSheet({
  open,
  initialUpiId = '',
  initialName = '',
  onClose,
  onSaved,
  onToast,
}: Props) {
  const [upiId, setUpiId] = useState(initialUpiId);
  const [name, setName] = useState(initialName);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setUpiId(initialUpiId);
    setName(initialName);
    setConfirm(false);
    setError('');
  }, [open, initialUpiId, initialName]);

  if (!open) return null;

  const check = validateUpiId(upiId);
  const valid = check.ok;

  const save = async () => {
    setError('');
    if (!valid) {
      setError(check.message || 'Enter a valid UPI ID like name@oksbi — not a phone number alone.');
      return;
    }
    if (!String(name || '').trim()) {
      setError('Enter the name shown on your UPI app for this ID.');
      return;
    }
    if (!confirm) {
      setError('Tick the box to confirm this UPI ID belongs to you.');
      return;
    }
    setBusy(true);
    try {
      const res = await saveMyUpi({
        upiId: normalizeVpa(upiId),
        upiDisplayName: name.trim(),
        confirm: true,
      });
      const profile = res.profile || {
        upiId: normalizeVpa(upiId),
        upiDisplayName: name.trim(),
        upiStatus: 'SELF_CONFIRMED',
      };
      onSaved?.(profile);
      onToast?.('UPI ID saved', 'success');
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not save UPI ID';
      setError(msg);
      onToast?.(msg, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="sp-root" role="dialog" aria-modal="true" aria-label="Add UPI ID">
      <button type="button" className="sp-dim" aria-label="Close" onClick={onClose} />
      <div className="sp-sheet">
        <div className="sp-handle" aria-hidden />
        <header className="sp-head">
          <div>
            <p className="sp-kicker">Settlements</p>
            <h2 className="sp-title">Add your UPI ID</h2>
          </div>
          <button type="button" className="sp-close" onClick={onClose} aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </header>

        <div className="sp-hero" style={{ marginBottom: 14 }}>
          <p className="sp-hero-label">For team splits</p>
          <p style={{ marginTop: 8, fontSize: 14, lineHeight: 1.45, color: 'rgba(244,241,234,0.72)' }}>
            Teammates use this ID to pay you via PhonePe, GPay, BHIM and other UPI apps. We never ask for your UPI PIN.
          </p>
        </div>

        <label className="sp-search" style={{ marginBottom: 10 }}>
          <Shield className="w-4 h-4" />
          <input
            value={upiId}
            onChange={(e) => setUpiId(e.target.value)}
            placeholder="yourname@oksbi"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
          />
        </label>
        {upiId.trim() ? (
          <p className={`text-[11px] leading-relaxed mb-2 px-1 ${valid ? 'text-teal-800' : 'text-rose-600'}`}>
            {check.message}
          </p>
        ) : null}
        <label className="sp-search" style={{ marginBottom: 12 }}>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name on your UPI app (required)"
            required
          />
        </label>

        <button
          type="button"
          className={`sp-row ${confirm ? 'is-on' : ''}`}
          style={{ width: '100%', textAlign: 'left', marginBottom: 12 }}
          onClick={() => setConfirm((v) => !v)}
        >
          <span className="sp-check">{confirm ? <Check className="w-3.5 h-3.5" strokeWidth={3} /> : null}</span>
          <span className="sp-meta" style={{ gridColumn: '2 / -1' }}>
            <p className="sp-name">I confirm this UPI ID and name belong to me</p>
            <p className="sp-email">Byjan checks format and bank handle — not live NPCI name lookup</p>
          </span>
        </button>

        {error ? <p className="sp-error">{error}</p> : null}

        <div className="sp-footer">
          <button type="button" className="sp-cta" disabled={busy || !valid || !confirm || !name.trim()} onClick={() => void save()}>
            {busy ? 'Saving…' : 'Save & confirm UPI'}
          </button>
        </div>
      </div>
    </div>
  );
}

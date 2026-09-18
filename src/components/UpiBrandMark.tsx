import React from 'react';

const BRAND_SRC: Record<string, string> = {
  phonepe: '/brands/phonepe.svg',
  paytm: '/brands/paytm.svg',
  gpay: '/brands/gpay.svg',
  cred: '/brands/cred.svg',
  whatsapp: '/brands/whatsapp.svg',
  bhim: '/brands/bhim.svg',
  amazonpay: '/brands/amazonpay.svg',
  amazon: '/brands/amazonpay.svg',
  mobikwik: '/brands/mobikwik.svg',
  generic: '/brands/upi.svg',
};

const BRAND_BG: Record<string, string> = {
  phonepe: '#FFFFFF',
  paytm: '#FFFFFF',
  gpay: '#FFFFFF',
  cred: '#111111',
  whatsapp: '#FFFFFF',
  bhim: '#FFFFFF',
  amazonpay: '#FFFFFF',
  amazon: '#FFFFFF',
  mobikwik: '#FFFFFF',
  generic: '#FFFFFF',
};

/** Official India payment app marks (PhonePe, Paytm, GPay, CRED, BHIM, Amazon Pay, MobiKwik). */
export function UpiBrandMark({ app, size = 40 }: { app: string; size?: number }) {
  const key = String(app || '').toLowerCase();
  const src = BRAND_SRC[key] || BRAND_SRC.generic;
  const bg = BRAND_BG[key] || '#ffffff';
  const radius = Math.max(8, Math.round(size * 0.22));
  const inset = Math.max(5, Math.round(size * 0.14));
  return (
    <span
      className="upi-brand-wrap"
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        background: bg,
        display: 'inline-grid',
        placeItems: 'center',
        overflow: 'hidden',
        boxShadow: '0 0 0 1px rgba(15,23,42,0.08)',
        flexShrink: 0,
      }}
    >
      <img
        src={src}
        alt=""
        width={size - inset * 2}
        height={size - inset * 2}
        draggable={false}
        className="upi-brand-img"
        style={{ width: size - inset * 2, height: size - inset * 2, display: 'block', objectFit: 'contain' }}
      />
    </span>
  );
}

export function PaymentMethodMark({ method, size = 22 }: { method: string; size?: number }) {
  const m = String(method || '').toLowerCase();
  if (m === 'upi') {
    return (
      <span className="pay-method-stack" aria-hidden>
        <UpiBrandMark app="phonepe" size={size} />
        <UpiBrandMark app="gpay" size={size} />
        <UpiBrandMark app="paytm" size={size} />
      </span>
    );
  }
  if (m === 'card') return <UpiBrandMark app="cred" size={size} />;
  if (m === 'wallet') {
    return (
      <span className="pay-method-stack" aria-hidden>
        <UpiBrandMark app="paytm" size={size} />
        <UpiBrandMark app="amazonpay" size={size} />
        <UpiBrandMark app="mobikwik" size={size} />
      </span>
    );
  }
  if (m === 'bank') return <UpiBrandMark app="bhim" size={size} />;
  return <UpiBrandMark app="generic" size={size} />;
}

export const ENTRY_PAY_METHODS: Array<{ id: string; label: string; apps: string[] }> = [
  { id: 'upi', label: 'UPI', apps: ['phonepe', 'gpay', 'paytm'] },
  { id: 'card', label: 'Card', apps: ['cred'] },
  { id: 'wallet', label: 'Wallet', apps: ['paytm', 'amazonpay', 'mobikwik'] },
  { id: 'bank', label: 'Bank', apps: ['bhim'] },
  { id: 'cash', label: 'Cash', apps: [] },
];

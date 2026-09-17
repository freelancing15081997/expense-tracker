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

/** Official India payment app marks (PhonePe, Paytm, GPay, CRED, BHIM, Amazon Pay, MobiKwik). */
export function UpiBrandMark({ app, size = 28 }: { app: string; size?: number }) {
  const src = BRAND_SRC[String(app || '').toLowerCase()] || BRAND_SRC.generic;
  const radius = Math.max(6, Math.round(size * 0.25));
  return (
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      draggable={false}
      className="upi-brand-img"
      style={{ width: size, height: size, borderRadius: radius, display: 'block', objectFit: 'cover', background: '#fff' }}
    />
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

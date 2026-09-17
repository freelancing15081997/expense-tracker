import React from 'react';

/** Brand-color marks for UPI partners (original marks in official brand colors, not trademark artwork). */
export function UpiBrandMark({ app, size = 28 }: { app: string; size?: number }) {
  const s = size;
  const letter = (bg: string, ch: string, fg = '#fff') => (
    <svg width={s} height={s} viewBox="0 0 32 32" aria-hidden>
      <rect width="32" height="32" rx="8" fill={bg} />
      <text x="16" y="22" textAnchor="middle" fontSize="16" fontWeight="800" fontFamily="Arial,Helvetica,sans-serif" fill={fg}>{ch}</text>
    </svg>
  );
  if (app === 'gpay') {
    if (s <= 18) return letter('#4285F4', 'G');
    return (
      <svg width={s} height={s} viewBox="0 0 32 32" aria-hidden>
        <circle cx="16" cy="16" r="16" fill="#fff" />
        <path d="M16.2 7.2c2.4 0 4.4.7 5.8 2l-2.5 2.4c-.8-.7-1.9-1.2-3.3-1.2-2.8 0-5.1 1.9-5.9 4.4H7.4A8.8 8.8 0 0 1 16.2 7.2Z" fill="#EA4335" />
        <path d="M24.8 16c0 .7-.1 1.4-.2 2H16v-3.4h8.5c.2.4.3.9.3 1.4Z" fill="#4285F4" />
        <path d="M10.3 18.8c.4 1.2 1.2 2.2 2.2 2.9l-2.6 2c-1.5-1.4-2.5-3.5-2.5-5.9 0-.8.1-1.5.3-2.2h3.6c-.2.5-.3 1.1-.3 1.6 0 .5.1 1.1.3 1.6Z" fill="#FBBC05" />
        <path d="M16.2 24.8c-2.4 0-4.5-.8-6.1-2.2l2.6-2c.9.6 2.1 1 3.5 1 2.1 0 3.9-.7 5.2-2l2.6 2c-1.6 1.9-4.1 3.2-7.8 3.2Z" fill="#34A853" />
      </svg>
    );
  }
  if (app === 'phonepe') {
    return (
      <svg width={s} height={s} viewBox="0 0 32 32" aria-hidden>
        <rect width="32" height="32" rx="8" fill="#5F259F" />
        <path d="M10 9.5h7.2c3.3 0 5.4 1.8 5.4 4.6 0 3.1-2.4 4.9-5.8 4.9H13.6V22.5H10V9.5Zm3.6 6.6h3.2c1.5 0 2.4-.8 2.4-2 0-1.2-.9-1.9-2.4-1.9h-3.2v3.9Z" fill="#fff" />
      </svg>
    );
  }
  if (app === 'paytm') {
    if (s <= 18) return letter('#00BAF2', 'P');
    return (
      <svg width={s} height={s} viewBox="0 0 32 32" aria-hidden>
        <rect width="32" height="32" rx="8" fill="#00BAF2" />
        <text x="16" y="21" textAnchor="middle" fontSize="9" fontWeight="800" fontFamily="Arial,Helvetica,sans-serif" fill="#fff">Paytm</text>
      </svg>
    );
  }
  if (app === 'cred') {
    if (s <= 18) return letter('#0D0D0D', 'C');
    return (
      <svg width={s} height={s} viewBox="0 0 32 32" aria-hidden>
        <rect width="32" height="32" rx="8" fill="#0D0D0D" />
        <text x="16" y="21" textAnchor="middle" fontSize="9" fontWeight="800" fontFamily="Arial,Helvetica,sans-serif" fill="#fff" letterSpacing="0.6">CRED</text>
      </svg>
    );
  }
  if (app === 'whatsapp') {
    return (
      <svg width={s} height={s} viewBox="0 0 32 32" aria-hidden>
        <circle cx="16" cy="16" r="16" fill="#25D366" />
        <path d="M16 8.2A7.8 7.8 0 0 0 9.4 19.6L8.2 24l4.5-1.2A7.8 7.8 0 1 0 16 8.2Zm4.4 11.1c-.2.5-1 .9-1.4 1-.4 0-.8.2-2.6-.6-2.2-1-3.6-3.3-3.7-3.5-.1-.2-.9-1.2-.9-2.3 0-1.1.6-1.6.8-1.8.2-.2.4-.2.6-.2h.4c.1 0 .3 0 .5.4.2.5.7 1.7.7 1.8.1.1.1.3 0 .4-.1.2-.2.3-.3.4-.2.2-.3.3-.1.6.2.3.8 1.3 1.8 2.1 1.2.9 2.2 1.2 2.5 1.3.3.1.5.1.7-.1.2-.2.8-.9 1-1.2.2-.3.4-.2.7-.1.3.1 1.9 1 2.2 1.1.3.2.5.2.6.4 0 .2 0 1-.3 1.5Z" fill="#fff" />
      </svg>
    );
  }
  if (app === 'bhim') {
    if (s <= 18) return letter('#F7A800', 'B', '#0B1F3A');
    return (
      <svg width={s} height={s} viewBox="0 0 32 32" aria-hidden>
        <rect width="32" height="32" rx="8" fill="#F7A800" />
        <rect x="0" y="11" width="32" height="10" fill="#fff" />
        <rect x="0" y="21" width="32" height="11" rx="8" fill="#128807" />
        <text x="16" y="19.5" textAnchor="middle" fontSize="8" fontWeight="800" fontFamily="Arial,Helvetica,sans-serif" fill="#0B1F3A">BHIM</text>
      </svg>
    );
  }
  return letter('#0B1F3A', 'U', '#12B8A8');
}

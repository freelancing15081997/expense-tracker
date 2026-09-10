import React from 'react';

type BrandLogoProps = {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
};

const sizes = {
  sm: 'w-12 h-12',
  md: 'w-24 h-24',
  lg: 'w-72 h-72 max-w-[88vw]',
};

export default function BrandLogo({ size = 'sm', className = '' }: BrandLogoProps) {
  return (
    <div
      className={`${sizes[size]} ${className} brand-logo overflow-hidden rounded-2xl bg-white shrink-0 ring-1 ring-slate-200/90 shadow-[0_8px_24px_-12px_rgba(11,31,58,0.35)]`.trim()}
      data-size={size}
    >
      <img
        src="/logo.png"
        alt="Byjan — Trace Financials Easily"
        className="brand-logo-img"
      />
    </div>
  );
}

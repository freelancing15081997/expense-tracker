import React from 'react';

type BrandLogoProps = {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
};

const sizes = {
  sm: 'w-8 h-8',
  md: 'w-16 h-16',
  lg: 'w-28 h-28',
};

export default function BrandLogo({ size = 'sm', className = '' }: BrandLogoProps) {
  const crop = size === 'lg'
    ? 'object-contain p-[4%]'
    : 'object-cover object-[50%_10%] scale-[1.35] origin-center';

  return (
    <div className={`${sizes[size]} ${className} overflow-hidden rounded-lg bg-white shrink-0 ring-1 ring-slate-200/80`.trim()}>
      <img
        src="/logo.png"
        onError={(e) => {
          e.currentTarget.onerror = null;
          e.currentTarget.src = '/byjan-logo.jpg';
        }}
        alt="Byjan — Trace Financials Easily"
        className={`w-full h-full ${crop}`}
      />
    </div>
  );
}

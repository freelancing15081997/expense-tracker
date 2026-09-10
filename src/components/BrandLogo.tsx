import React from 'react';

type BrandLogoProps = {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
};

const sizes = {
  sm: 'w-10 h-10',
  md: 'w-16 h-16',
  lg: 'w-[220px] h-[120px]',
};

export default function BrandLogo({ size = 'sm', className = '' }: BrandLogoProps) {
  return (
    <div
      className={`${sizes[size]} ${className} brand-logo overflow-hidden shrink-0`.trim()}
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

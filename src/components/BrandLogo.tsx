import React from 'react';

type BrandLogoProps = {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
};

const sizes = {
  sm: 'w-11 h-11',
  md: 'w-[88px] h-[88px]',
  lg: 'w-[280px] h-[340px]',
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

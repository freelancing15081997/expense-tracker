import React from 'react';
import { BRAND_LOGO_SRC } from '../lib/brand';

type BrandLogoProps = {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
};

const sizes = {
  sm: 'w-11 h-11',
  md: 'w-16 h-16',
  lg: 'w-[168px] h-[200px]',
};

export default function BrandLogo({ size = 'sm', className = '' }: BrandLogoProps) {
  return (
    <div
      className={`${sizes[size]} ${className} brand-logo overflow-hidden shrink-0`.trim()}
      data-size={size}
    >
      <img
        src={BRAND_LOGO_SRC}
        alt="Byjan — Trace Financials Easily"
        className="brand-logo-img"
      />
    </div>
  );
}

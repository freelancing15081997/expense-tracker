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
  return (
    <div className={`${sizes[size]} ${className}`.trim()}>
      <img
        src="/byjan-logo.jpg"
        alt="Byjan — Trace Financials Easily"
        className="w-full h-full rounded-lg object-cover object-[50%_20%] shrink-0 bg-white"
        style={{ objectFit: 'cover', objectPosition: '50% 20%' }}
      />
    </div>
  );
}

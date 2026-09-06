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
    <img
      src="/byjan-logo.jpg"
      alt="Byjan — Trace Financials Easily"
      className={`${sizes[size]} rounded-lg object-contain shrink-0 bg-white ${className}`.trim()}
      onError={(e) => {
        e.currentTarget.src = '/set-logo.jpg';
      }}
    />
  );
}

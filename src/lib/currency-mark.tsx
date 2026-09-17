import React from 'react';
import { getCurrencySymbol } from './currency';

export function CurrencyMark({
  code,
  className = '',
  size = 'md',
}: {
  code?: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}) {
  const symbol = getCurrencySymbol(code);
  return (
    <span
      className={`currency-mark is-${size} ${className}`.trim()}
      title={String(code || '').toUpperCase() || symbol}
      aria-hidden
    >
      {symbol}
    </span>
  );
}

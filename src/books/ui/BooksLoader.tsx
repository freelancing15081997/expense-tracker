import React from 'react';
import AppLoader from '../../components/AppLoader';

/** Same loader on every Books screen — no brand mark, no per-feature variant. */
export function BooksLoader(_props?: { feature?: string; href?: string; compact?: boolean }) {
  return <AppLoader message="Loading" />;
}

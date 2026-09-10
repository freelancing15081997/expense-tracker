import React from 'react';
import AppLoader from '../../components/AppLoader';

const MEANING: Record<string, string> = {
  '/books': 'Opening posted balances and the work waiting on you.',
  '/books/cfo': 'Opening cash, profit, and control alerts.',
  '/books/invoices': 'Loading invoices and receivables.',
  '/books/bills': 'Loading bills and payables.',
  '/books/customers': 'Loading customer records.',
  '/books/vendors': 'Loading vendor records.',
  '/books/journals': 'Loading journal entries.',
  '/books/banking': 'Opening cash and bank journals.',
  '/books/expenses': 'Loading Books expenses.',
  '/books/reports': 'Preparing financial reports.',
};

export function BooksLoader(props?: { feature?: string; href?: string; compact?: boolean }) {
  const feature = props?.feature || 'Books';
  const meaning = (props?.href && MEANING[props.href]) || `Loading ${feature.toLowerCase()}.`;
  return <AppLoader title={feature} message={meaning} />;
}

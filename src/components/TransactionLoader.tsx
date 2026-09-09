import React from 'react';
import AppLoader from './AppLoader';

export default function TransactionLoader({ message = 'Saving' }: { message?: string }) {
  return <AppLoader overlay message={message} />;
}

export function CompactTransactionLoader() {
  return <span className="app-loader-ring app-loader-ring-sm" />;
}

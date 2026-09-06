export type DomainStatus = 'live' | 'adapter';

export const BOOKS_CATALOG: { domain: string; items: { name: string; href?: string; status: DomainStatus }[] }[] = [
  {
    domain: 'Accounting',
    items: [
      { name: 'Chart of Accounts', href: '/books/chart-of-accounts', status: 'live' },
      { name: 'Journal Entries', href: '/books/journals', status: 'live' },
      { name: 'General Ledger', href: '/books/ledger', status: 'live' },
      { name: 'Recurring Journals', href: '/books/recurring', status: 'live' },
      { name: 'Accounting Periods', href: '/books/settings', status: 'live' },
      { name: 'Trial Balance / P&L / Balance Sheet', href: '/books/reports', status: 'live' },
    ],
  },
  {
    domain: 'Receivables / Payables',
    items: [
      { name: 'Customers', href: '/books/customers', status: 'live' },
      { name: 'Quotes → Invoice', href: '/books/quotes', status: 'live' },
      { name: 'Collections', href: '/books/collections', status: 'live' },
      { name: 'Payment run', href: '/books/payment-run', status: 'live' },
      { name: 'Files + templates per feature', href: '/books/inbox', status: 'live' },
      { name: 'Invoices + Payments', href: '/books/invoices', status: 'live' },
      { name: 'Credit Notes', href: '/books/credit-notes', status: 'live' },
      { name: 'Statements / Collections', href: '/books/statements', status: 'live' },
      { name: 'Vendors', href: '/books/vendors', status: 'live' },
      { name: 'Purchase Orders → Bill', href: '/books/purchase-orders', status: 'live' },
      { name: 'Bills + Payments', href: '/books/bills', status: 'live' },
      { name: 'Vendor Credits', href: '/books/vendor-credits', status: 'live' },
      { name: 'AR / AP Aging', href: '/books/reports', status: 'live' },
    ],
  },
  {
    domain: 'Banking / Expenses / Tax',
    items: [
      { name: 'Transfers + bank journals', href: '/books/banking', status: 'live' },
      { name: 'Manual reconciliation', href: '/books/banking', status: 'live' },
      { name: 'Books Expenses', href: '/books/expenses', status: 'live' },
      { name: 'GST tax codes + TDS withhold', href: '/books/tax', status: 'live' },
      { name: 'Bank feeds / statement import', status: 'adapter' },
    ],
  },
  {
    domain: 'Operations',
    items: [
      { name: 'Inventory / COGS', href: '/books/inventory', status: 'live' },
      { name: 'Fixed assets / depreciation', href: '/books/assets', status: 'live' },
      { name: 'Projects / WIP', href: '/books/projects', status: 'live' },
      { name: 'Budgets / variance', href: '/books/budgets', status: 'live' },
      { name: 'Revenue recognition', href: '/books/revenue', status: 'live' },
      { name: 'Leases', href: '/books/leases', status: 'live' },
      { name: 'Multi-entity register', href: '/books/entities', status: 'live' },
      { name: 'Consolidation / FX revaluation', status: 'adapter' },
    ],
  },
  {
    domain: 'Control / CA / Automation',
    items: [
      { name: 'CA workbench + workpapers', href: '/books/workbench', status: 'live' },
      { name: 'Document inbox (manual)', href: '/books/inbox', status: 'live' },
      { name: 'Approvals', href: '/books/approvals', status: 'live' },
      { name: 'Audit trail', href: '/books/audit', status: 'live' },
      { name: 'Rule-based insights', href: '/books/insights', status: 'live' },
      { name: 'OCR / AI Finance provider', status: 'adapter' },
      { name: 'E-Invoice / E-Way Bill', status: 'adapter' },
    ],
  },
];

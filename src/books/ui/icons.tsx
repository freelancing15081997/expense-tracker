import React from 'react';

export type BooksGlyphName =
  | 'book'
  | 'dashboard'
  | 'tower'
  | 'accounts'
  | 'journal'
  | 'recurring'
  | 'ledger'
  | 'customer'
  | 'quote'
  | 'invoice'
  | 'credit'
  | 'statement'
  | 'collection'
  | 'vendor'
  | 'po'
  | 'bill'
  | 'vendor-credit'
  | 'payment'
  | 'bank'
  | 'expense'
  | 'inventory'
  | 'asset'
  | 'project'
  | 'budget'
  | 'revenue'
  | 'lease'
  | 'tax'
  | 'report'
  | 'entity'
  | 'workbench'
  | 'inbox'
  | 'approval'
  | 'insight'
  | 'audit'
  | 'settings'
  | 'create'
  | 'save'
  | 'post'
  | 'pay'
  | 'run'
  | 'file'
  | 'image'
  | 'pdf';

function Frame({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className || 'w-4 h-4'} aria-hidden>
      {children}
    </svg>
  );
}

const ink = '#0B1F3A';
const teal = '#12B8A8';

export function BooksGlyph({ name, className }: { name: BooksGlyphName; className?: string }) {
  switch (name) {
    case 'book':
      return (
        <Frame className={className}>
          <path d="M5 5.5h9.5a3 3 0 0 1 3 3V19H8.5A3.5 3.5 0 0 1 5 15.5V5.5Z" stroke={ink} strokeWidth="1.6" />
          <path d="M8.5 19A3.5 3.5 0 0 1 5 15.5" stroke={ink} strokeWidth="1.6" />
          <path d="M9 8.5h6.5M9 12h5" stroke={teal} strokeWidth="1.5" strokeLinecap="round" />
        </Frame>
      );
    case 'dashboard':
      return (
        <Frame className={className}>
          <rect x="3.5" y="4.5" width="17" height="15" rx="3" stroke={ink} strokeWidth="1.6" />
          <path d="M8 14.5c1.2-2.4 2.6-3.6 4-3.6s2.8 1.2 4 3.6" stroke={teal} strokeWidth="1.6" strokeLinecap="round" />
          <circle cx="12" cy="14.5" r="1.1" fill={ink} />
        </Frame>
      );
    case 'tower':
      return (
        <Frame className={className}>
          <path d="M8 20V8.5L12 4.5l4 4V20" stroke={ink} strokeWidth="1.6" strokeLinejoin="round" />
          <path d="M8 12h8M8 16h8" stroke={teal} strokeWidth="1.5" />
          <circle cx="12" cy="10" r="1.1" fill={ink} />
        </Frame>
      );
    case 'accounts':
      return (
        <Frame className={className}>
          <path d="M5 18V7.5h5.5V18" stroke={ink} strokeWidth="1.6" />
          <path d="M10.5 11.5H19V18H10.5" stroke={ink} strokeWidth="1.6" />
          <path d="M7.2 10v5M16 14v2" stroke={teal} strokeWidth="1.5" strokeLinecap="round" />
        </Frame>
      );
    case 'journal':
      return (
        <Frame className={className}>
          <rect x="4" y="4.5" width="16" height="15" rx="2.2" stroke={ink} strokeWidth="1.6" />
          <path d="M12 4.5v15" stroke={ink} strokeWidth="1.6" />
          <path d="M6.5 9h3.5M6.5 13h3.5M14 9h3.5M14 13h3.5" stroke={teal} strokeWidth="1.5" strokeLinecap="round" />
        </Frame>
      );
    case 'recurring':
      return (
        <Frame className={className}>
          <path d="M7 8.5h9.5v9H8.5A3.5 3.5 0 0 1 5 14" stroke={ink} strokeWidth="1.6" strokeLinejoin="round" />
          <path d="M16.5 6.5 19 8.5l-2.5 2" stroke={teal} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M7.5 17.5 5 15.5l2.5-2" stroke={teal} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </Frame>
      );
    case 'ledger':
      return (
        <Frame className={className}>
          <path d="M6 5h10.5a2.5 2.5 0 0 1 2.5 2.5V19H8.5A2.5 2.5 0 0 1 6 16.5V5Z" stroke={ink} strokeWidth="1.6" />
          <path d="M9.5 9h7M9.5 12.5h7M9.5 16h4.5" stroke={teal} strokeWidth="1.5" strokeLinecap="round" />
        </Frame>
      );
    case 'customer':
      return (
        <Frame className={className}>
          <circle cx="9" cy="8" r="2.4" stroke={ink} strokeWidth="1.6" />
          <path d="M4.8 17.5c.4-3 2.1-4.6 4.2-4.6s3.8 1.6 4.2 4.6" stroke={ink} strokeWidth="1.6" strokeLinecap="round" />
          <rect x="13.5" y="9" width="6.2" height="8" rx="1.2" stroke={teal} strokeWidth="1.5" />
          <path d="M15 12h3.2M15 14.5h2.2" stroke={ink} strokeWidth="1.2" strokeLinecap="round" />
        </Frame>
      );
    case 'quote':
      return (
        <Frame className={className}>
          <path d="M7 4.5h7.5L19 9v10.5H7V4.5Z" stroke={ink} strokeWidth="1.6" strokeLinejoin="round" />
          <path d="M14.5 4.5V9H19" stroke={ink} strokeWidth="1.6" />
          <path d="M9.5 13h5.5M9.5 16h3.5" stroke={teal} strokeWidth="1.5" strokeLinecap="round" />
        </Frame>
      );
    case 'invoice':
      return (
        <Frame className={className}>
          <rect x="6" y="3.8" width="12" height="16.4" rx="2" stroke={ink} strokeWidth="1.6" />
          <path d="M9 8h6M9 11.5h6M9 15h3.5" stroke={teal} strokeWidth="1.5" strokeLinecap="round" />
          <circle cx="15.4" cy="15.2" r="1.5" stroke={ink} strokeWidth="1.3" />
        </Frame>
      );
    case 'credit':
      return (
        <Frame className={className}>
          <rect x="5.5" y="5" width="13" height="14" rx="2" stroke={ink} strokeWidth="1.6" />
          <path d="M9 12h6" stroke={teal} strokeWidth="1.8" strokeLinecap="round" />
          <path d="M9 8.5h4" stroke={ink} strokeWidth="1.4" strokeLinecap="round" />
        </Frame>
      );
    case 'statement':
      return (
        <Frame className={className}>
          <rect x="5" y="6.5" width="11" height="13" rx="1.6" stroke={ink} strokeWidth="1.5" />
          <rect x="8" y="4" width="11" height="13" rx="1.6" stroke={ink} strokeWidth="1.6" />
          <path d="M10.5 8.5h5.5M10.5 11.5h5.5M10.5 14.5h3.5" stroke={teal} strokeWidth="1.4" strokeLinecap="round" />
        </Frame>
      );
    case 'collection':
      return (
        <Frame className={className}>
          <path d="M5 6.5h14l-3.2 5.5H8.2L5 6.5Z" stroke={ink} strokeWidth="1.6" strokeLinejoin="round" />
          <path d="M8.2 12v6.5h7.6V12" stroke={ink} strokeWidth="1.6" />
          <circle cx="12" cy="15.4" r="1.3" stroke={teal} strokeWidth="1.4" />
        </Frame>
      );
    case 'vendor':
      return (
        <Frame className={className}>
          <path d="M4.5 19V10.5L12 5.5l7.5 5V19" stroke={ink} strokeWidth="1.6" strokeLinejoin="round" />
          <path d="M9.5 19v-5h5v5" stroke={teal} strokeWidth="1.5" />
        </Frame>
      );
    case 'po':
      return (
        <Frame className={className}>
          <rect x="6" y="3.5" width="12" height="17" rx="2" stroke={ink} strokeWidth="1.6" />
          <path d="M9 3.5v3h6v-3" stroke={ink} strokeWidth="1.5" />
          <path d="M9 11h6M9 14.5h4" stroke={teal} strokeWidth="1.5" strokeLinecap="round" />
        </Frame>
      );
    case 'bill':
      return (
        <Frame className={className}>
          <path d="M7 4.8h10v14.4l-1.6-1-1.6 1-1.6-1-1.6 1-1.6-1-1.6 1V4.8Z" stroke={ink} strokeWidth="1.6" strokeLinejoin="round" />
          <path d="M9.5 9h5M9.5 12.5h5" stroke={teal} strokeWidth="1.5" strokeLinecap="round" />
        </Frame>
      );
    case 'vendor-credit':
      return (
        <Frame className={className}>
          <rect x="5.5" y="5" width="13" height="14" rx="2" stroke={ink} strokeWidth="1.6" />
          <path d="M14.5 12H9.2m0 0 2-2m-2 2 2 2" stroke={teal} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </Frame>
      );
    case 'payment':
      return (
        <Frame className={className}>
          <circle cx="8.5" cy="12" r="4.2" stroke={ink} strokeWidth="1.6" />
          <circle cx="15.5" cy="12" r="4.2" stroke={teal} strokeWidth="1.6" />
          <path d="M12 12h.01" stroke={ink} strokeWidth="2" strokeLinecap="round" />
        </Frame>
      );
    case 'bank':
      return (
        <Frame className={className}>
          <path d="M4.5 9.5 12 4.8l7.5 4.7" stroke={ink} strokeWidth="1.6" strokeLinejoin="round" />
          <path d="M6 10v7.5M10 10v7.5M14 10v7.5M18 10v7.5M4.5 18.5h15" stroke={ink} strokeWidth="1.6" strokeLinecap="round" />
          <path d="M4.5 9.5h15" stroke={teal} strokeWidth="1.5" />
        </Frame>
      );
    case 'expense':
      return (
        <Frame className={className}>
          <path d="M8 4.5h6l4 4V19H8V4.5Z" stroke={ink} strokeWidth="1.6" strokeLinejoin="round" />
          <path d="M14 4.5V9h4.5" stroke={ink} strokeWidth="1.5" />
          <path d="M10.5 13h4M12.5 11v4" stroke={teal} strokeWidth="1.6" strokeLinecap="round" />
        </Frame>
      );
    case 'inventory':
      return (
        <Frame className={className}>
          <path d="M4.8 9.2 12 5.5l7.2 3.7V15L12 18.7 4.8 15V9.2Z" stroke={ink} strokeWidth="1.6" strokeLinejoin="round" />
          <path d="M12 18.7V9.2M4.8 9.2 12 12.8 19.2 9.2" stroke={teal} strokeWidth="1.4" />
        </Frame>
      );
    case 'asset':
      return (
        <Frame className={className}>
          <rect x="5" y="10" width="14" height="9" rx="1.4" stroke={ink} strokeWidth="1.6" />
          <path d="M8 10V7.5h8V10" stroke={ink} strokeWidth="1.6" />
          <path d="M9.5 14h5" stroke={teal} strokeWidth="1.6" strokeLinecap="round" />
        </Frame>
      );
    case 'project':
      return (
        <Frame className={className}>
          <path d="M6 19.5V5.5h.5l6 3-6 3" stroke={ink} strokeWidth="1.6" strokeLinejoin="round" />
          <path d="M14 12.5h4.5v5H14" stroke={teal} strokeWidth="1.5" />
          <path d="M15.5 17.5v-2.2M17.5 17.5v-3.4" stroke={ink} strokeWidth="1.4" strokeLinecap="round" />
        </Frame>
      );
    case 'budget':
      return (
        <Frame className={className}>
          <circle cx="12" cy="12" r="7.2" stroke={ink} strokeWidth="1.6" />
          <path d="M12 12 16 8.8" stroke={teal} strokeWidth="1.7" strokeLinecap="round" />
          <circle cx="12" cy="12" r="1.2" fill={ink} />
        </Frame>
      );
    case 'revenue':
      return (
        <Frame className={className}>
          <path d="M5 16.5 9.2 12l3.2 3.2L19 8.5" stroke={teal} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M15 8.5h4v4" stroke={ink} strokeWidth="1.5" strokeLinecap="round" />
          <path d="M5 18.5h14" stroke={ink} strokeWidth="1.5" strokeLinecap="round" />
        </Frame>
      );
    case 'lease':
      return (
        <Frame className={className}>
          <rect x="5" y="5" width="10" height="14" rx="2" stroke={ink} strokeWidth="1.6" />
          <path d="M15 10.5h3.2a1.8 1.8 0 0 1 0 3.6H15" stroke={teal} strokeWidth="1.5" />
          <circle cx="10" cy="15.5" r="1.1" fill={ink} />
        </Frame>
      );
    case 'tax':
      return (
        <Frame className={className}>
          <rect x="4.5" y="6" width="15" height="12" rx="2.2" stroke={ink} strokeWidth="1.6" />
          <path d="M9 10.2 15 15.2M9.2 15.2h.02M14.8 10.2h.02" stroke={teal} strokeWidth="1.6" strokeLinecap="round" />
        </Frame>
      );
    case 'report':
      return (
        <Frame className={className}>
          <path d="M6 18.5V11h3.2v7.5M11.4 18.5V8h3.2v10.5M16.8 18.5V5.5H20v13" stroke={ink} strokeWidth="1.6" strokeLinecap="round" />
          <path d="M5 18.5h15" stroke={teal} strokeWidth="1.5" strokeLinecap="round" />
        </Frame>
      );
    case 'entity':
      return (
        <Frame className={className}>
          <rect x="4" y="9" width="7" height="10" rx="1.2" stroke={ink} strokeWidth="1.6" />
          <rect x="13" y="5" width="7" height="14" rx="1.2" stroke={ink} strokeWidth="1.6" />
          <path d="M6.2 12h2.4M6.2 15h2.4M15.2 8.5h2.6M15.2 12h2.6M15.2 15.5h2.6" stroke={teal} strokeWidth="1.3" strokeLinecap="round" />
        </Frame>
      );
    case 'workbench':
      return (
        <Frame className={className}>
          <rect x="4.5" y="8" width="15" height="10" rx="1.8" stroke={ink} strokeWidth="1.6" />
          <path d="M8 8V6.2h8V8" stroke={ink} strokeWidth="1.5" />
          <path d="M8 13h8" stroke={teal} strokeWidth="1.5" strokeLinecap="round" />
        </Frame>
      );
    case 'inbox':
      return (
        <Frame className={className}>
          <path d="M4.5 13.5 7.2 6.5h9.6l2.7 7V18.5h-15v-5Z" stroke={ink} strokeWidth="1.6" strokeLinejoin="round" />
          <path d="M4.5 13.5h4.2l1.3 2.4h4l1.3-2.4h4.2" stroke={teal} strokeWidth="1.5" strokeLinejoin="round" />
        </Frame>
      );
    case 'approval':
      return (
        <Frame className={className}>
          <path d="M12 4.2 18.5 7v5.2c0 4-2.7 6.6-6.5 7.8-3.8-1.2-6.5-3.8-6.5-7.8V7L12 4.2Z" stroke={ink} strokeWidth="1.6" strokeLinejoin="round" />
          <path d="m9 12 2.1 2.1L15.2 10" stroke={teal} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
        </Frame>
      );
    case 'insight':
      return (
        <Frame className={className}>
          <circle cx="11" cy="11" r="5.4" stroke={ink} strokeWidth="1.6" />
          <path d="m15.2 15.2 3.3 3.3" stroke={ink} strokeWidth="1.6" strokeLinecap="round" />
          <path d="M11 8.4v2.4L13 12" stroke={teal} strokeWidth="1.5" strokeLinecap="round" />
        </Frame>
      );
    case 'audit':
      return (
        <Frame className={className}>
          <rect x="6" y="4.5" width="12" height="15" rx="2" stroke={ink} strokeWidth="1.6" />
          <path d="M9 9h6M9 12.5h6M9 16h3.2" stroke={teal} strokeWidth="1.5" strokeLinecap="round" />
        </Frame>
      );
    case 'settings':
      return (
        <Frame className={className}>
          <path d="M5 8h14M5 12h14M5 16h14" stroke={ink} strokeWidth="1.6" strokeLinecap="round" />
          <circle cx="9" cy="8" r="1.4" fill={teal} />
          <circle cx="15" cy="12" r="1.4" fill={teal} />
          <circle cx="11" cy="16" r="1.4" fill={teal} />
        </Frame>
      );
    case 'create':
      return (
        <Frame className={className}>
          <rect x="5" y="5" width="14" height="14" rx="3" stroke={ink} strokeWidth="1.6" />
          <path d="M12 8.5v7M8.5 12h7" stroke={teal} strokeWidth="1.7" strokeLinecap="round" />
        </Frame>
      );
    case 'save':
      return (
        <Frame className={className}>
          <path d="M6 16.5h12V19H6v-2.5Z" stroke={ink} strokeWidth="1.6" strokeLinejoin="round" />
          <path d="M12 5.5v9" stroke={teal} strokeWidth="1.7" strokeLinecap="round" />
          <path d="m8.8 11.2 3.2 3.3 3.2-3.3" stroke={teal} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
        </Frame>
      );
    case 'post':
      return (
        <Frame className={className}>
          <circle cx="12" cy="12" r="7.2" stroke={ink} strokeWidth="1.6" />
          <path d="m9 12.2 2 2 4.2-4.4" stroke={teal} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
        </Frame>
      );
    case 'pay':
      return (
        <Frame className={className}>
          <rect x="3.8" y="7" width="16.4" height="10" rx="2" stroke={ink} strokeWidth="1.6" />
          <circle cx="12" cy="12" r="2.1" stroke={teal} strokeWidth="1.5" />
        </Frame>
      );
    case 'run':
      return (
        <Frame className={className}>
          <circle cx="12" cy="12" r="7.2" stroke={ink} strokeWidth="1.6" />
          <path d="m10 8.8 6 3.2-6 3.2V8.8Z" fill={teal} />
        </Frame>
      );
    case 'file':
      return (
        <Frame className={className}>
          <path d="M7 4.5h7.2L18.5 9v10.5H7V4.5Z" stroke={ink} strokeWidth="1.6" strokeLinejoin="round" />
          <path d="M14.2 4.5V9h4.3" stroke={ink} strokeWidth="1.5" />
        </Frame>
      );
    case 'image':
      return (
        <Frame className={className}>
          <rect x="4.5" y="5.5" width="15" height="13" rx="2" stroke={ink} strokeWidth="1.6" />
          <circle cx="9.2" cy="10" r="1.4" stroke={teal} strokeWidth="1.4" />
          <path d="m4.8 16.2 4.4-3.6 3 2.4 2.4-1.8 4.4 3" stroke={teal} strokeWidth="1.5" strokeLinejoin="round" />
        </Frame>
      );
    case 'pdf':
      return (
        <Frame className={className}>
          <path d="M7 4.5h7.2L18.5 9v10.5H7V4.5Z" stroke={ink} strokeWidth="1.6" strokeLinejoin="round" />
          <path d="M9.2 14.8V11h2.1a1.4 1.4 0 0 1 0 2.8H9.2M14.4 11v3.8" stroke={teal} strokeWidth="1.4" strokeLinecap="round" />
        </Frame>
      );
    default:
      return (
        <Frame className={className}>
          <rect x="5" y="5" width="14" height="14" rx="3" stroke={ink} strokeWidth="1.6" />
        </Frame>
      );
  }
}

const HREF_GLYPH: Record<string, BooksGlyphName> = {
  '/books': 'dashboard',
  '/books/control-tower': 'tower',
  '/books/chart-of-accounts': 'accounts',
  '/books/journals': 'journal',
  '/books/recurring': 'recurring',
  '/books/ledger': 'ledger',
  '/books/customers': 'customer',
  '/books/quotes': 'quote',
  '/books/invoices': 'invoice',
  '/books/credit-notes': 'credit',
  '/books/statements': 'statement',
  '/books/collections': 'collection',
  '/books/vendors': 'vendor',
  '/books/purchase-orders': 'po',
  '/books/bills': 'bill',
  '/books/vendor-credits': 'vendor-credit',
  '/books/payment-run': 'payment',
  '/books/banking': 'bank',
  '/books/expenses': 'expense',
  '/books/inventory': 'inventory',
  '/books/assets': 'asset',
  '/books/projects': 'project',
  '/books/budgets': 'budget',
  '/books/revenue': 'revenue',
  '/books/leases': 'lease',
  '/books/tax': 'tax',
  '/books/reports': 'report',
  '/books/entities': 'entity',
  '/books/workbench': 'workbench',
  '/books/inbox': 'inbox',
  '/books/approvals': 'approval',
  '/books/insights': 'insight',
  '/books/audit': 'audit',
  '/books/settings': 'settings',
};

const GROUP_GLYPH: Record<string, BooksGlyphName> = {
  Dashboard: 'dashboard',
  Accounting: 'journal',
  Sales: 'invoice',
  Purchases: 'bill',
  'Banking & Expenses': 'bank',
  Operations: 'inventory',
  Control: 'approval',
};

export function glyphForHref(href: string): BooksGlyphName {
  const path = href.replace(/\/ledger\/.+$/, '/ledger').replace(/#.*$/, '');
  if (HREF_GLYPH[path]) return HREF_GLYPH[path];
  const hit = Object.keys(HREF_GLYPH).find((key) => key !== '/books' && path.startsWith(key));
  return hit ? HREF_GLYPH[hit] : 'book';
}

export function FeatureIcon({ href, className }: { href: string; className?: string }) {
  return <BooksGlyph name={glyphForHref(href)} className={className} />;
}

export function GroupIcon({ title, className }: { title: string; className?: string }) {
  return <BooksGlyph name={GROUP_GLYPH[title] || 'book'} className={className} />;
}

export function ActionIcon({ name, className }: { name: BooksGlyphName; className?: string }) {
  return <BooksGlyph name={name} className={className} />;
}

export function fileGlyph(file: { type?: string; name?: string }): BooksGlyphName {
  const type = (file.type || '').toLowerCase();
  const name = (file.name || '').toLowerCase();
  if (type.startsWith('image/') || /\.(png|jpe?g|webp)$/.test(name)) return 'image';
  if (type === 'application/pdf' || name.endsWith('.pdf')) return 'pdf';
  return 'file';
}

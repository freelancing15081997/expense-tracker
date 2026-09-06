export type BooksLink = { name: string; href: string };
export type BooksModule = {
  id: string;
  name: string;
  href: string;
  blurb: string;
  related: BooksLink[];
};
export type BooksBranch = {
  id: string;
  name: string;
  href: string;
  blurb: string;
  items: BooksLink[];
};

export const BOOKS_TREE: BooksBranch[] = [
  {
    id: 'dashboard',
    name: 'Dashboard',
    href: '/books',
    blurb: 'Posted balances, close health, and the work queue.',
    items: [
      { name: 'Finance Dashboard', href: '/books' },
      { name: 'Control Tower', href: '/books/control-tower' },
    ],
  },
  {
    id: 'accounting',
    name: 'Accounting',
    href: '/books/chart-of-accounts',
    blurb: 'Chart, journals, ledger, and recurring postings.',
    items: [
      { name: 'Chart of Accounts', href: '/books/chart-of-accounts' },
      { name: 'Journal Entries', href: '/books/journals' },
      { name: 'Recurring Journals', href: '/books/recurring' },
      { name: 'General Ledger', href: '/books/ledger' },
    ],
  },
  {
    id: 'sales',
    name: 'Sales',
    href: '/books/invoices',
    blurb: 'Customers, quotes, invoices, credits, and collections.',
    items: [
      { name: 'Customers', href: '/books/customers' },
      { name: 'Quotes', href: '/books/quotes' },
      { name: 'Invoices', href: '/books/invoices' },
      { name: 'Credit Notes', href: '/books/credit-notes' },
      { name: 'Statements', href: '/books/statements' },
      { name: 'Collections', href: '/books/collections' },
    ],
  },
  {
    id: 'purchases',
    name: 'Purchases',
    href: '/books/bills',
    blurb: 'Vendors, purchase orders, bills, credits, and payment runs.',
    items: [
      { name: 'Vendors', href: '/books/vendors' },
      { name: 'Purchase Orders', href: '/books/purchase-orders' },
      { name: 'Bills', href: '/books/bills' },
      { name: 'Vendor Credits', href: '/books/vendor-credits' },
      { name: 'Payment Run', href: '/books/payment-run' },
    ],
  },
  {
    id: 'banking',
    name: 'Banking & Expenses',
    href: '/books/banking',
    blurb: 'Transfers, bank journals, and Books expenses (not Expense Tracker).',
    items: [
      { name: 'Banking', href: '/books/banking' },
      { name: 'Books Expenses', href: '/books/expenses' },
    ],
  },
  {
    id: 'operations',
    name: 'Operations',
    href: '/books/inventory',
    blurb: 'Inventory, assets, projects, budgets, revenue, and leases.',
    items: [
      { name: 'Inventory', href: '/books/inventory' },
      { name: 'Fixed Assets', href: '/books/assets' },
      { name: 'Projects', href: '/books/projects' },
      { name: 'Budgets', href: '/books/budgets' },
      { name: 'Revenue', href: '/books/revenue' },
      { name: 'Leases', href: '/books/leases' },
    ],
  },
  {
    id: 'control',
    name: 'Control',
    href: '/books/reports',
    blurb: 'Tax, reports, CA work, inbox, approvals, and settings.',
    items: [
      { name: 'Tax & TDS', href: '/books/tax' },
      { name: 'Reports', href: '/books/reports' },
      { name: 'Entities', href: '/books/entities' },
      { name: 'CA Workbench', href: '/books/workbench' },
      { name: 'Inbox', href: '/books/inbox' },
      { name: 'Approvals', href: '/books/approvals' },
      { name: 'Insights', href: '/books/insights' },
      { name: 'Audit Trail', href: '/books/audit' },
      { name: 'Settings', href: '/books/settings' },
    ],
  },
];

const BLURBS: Record<string, string> = Object.fromEntries(BOOKS_TREE.flatMap((branch) => [
  [branch.href, branch.blurb],
  ...branch.items.map((item) => [item.href, `${item.name} sits under ${branch.name}. ${branch.blurb}`]),
]));

export const BOOKS_MODULES: BooksModule[] = BOOKS_TREE.flatMap((branch) => {
  const children = branch.items.map((item) => ({
    id: item.href,
    name: item.name,
    href: item.href,
    blurb: BLURBS[item.href] || branch.blurb,
    related: branch.items.filter((other) => other.href !== item.href).slice(0, 4),
  }));
  return [
    { id: branch.id, name: branch.name, href: branch.href, blurb: branch.blurb, related: branch.items.slice(0, 4) },
    ...children,
  ];
});

export function moduleByPath(pathname: string): BooksModule {
  const path = pathname.replace(/\/ledger\/.+$/, '/ledger');
  const named = BOOKS_MODULES.find((m) => m.href === path && !BOOKS_TREE.some((b) => b.id === m.id && b.href === path));
  if (named) return named;
  const hit = BOOKS_MODULES.find((m) => m.href === path);
  if (hit) return hit;
  const nested = BOOKS_MODULES.find((m) => m.href !== '/books' && path.startsWith(m.href));
  return nested || BOOKS_MODULES[0];
}

export function branchByPath(pathname: string): BooksBranch {
  const path = pathname.replace(/\/ledger\/.+$/, '/ledger');
  return BOOKS_TREE.find((branch) => branch.href === path || branch.items.some((item) => item.href === path)) || BOOKS_TREE[0];
}

export const BOOKS_NAV_FEATURES = BOOKS_TREE.flatMap((branch) => branch.items);

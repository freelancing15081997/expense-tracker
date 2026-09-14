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
    name: 'Home',
    href: '/books',
    blurb: 'See balances, work waiting, and what needs attention.',
    items: [
      { name: 'Home', href: '/books' },
      { name: 'Money overview', href: '/books/cfo' },
      { name: 'Watch list', href: '/books/control-tower' },
    ],
  },
  {
    id: 'accounting',
    name: 'Accounts',
    href: '/books/chart-of-accounts',
    blurb: 'Your account list, typed entries, and month close.',
    items: [
      { name: 'Account list', href: '/books/chart-of-accounts' },
      { name: 'Manual entries', href: '/books/journals' },
      { name: 'Repeat entries', href: '/books/recurring' },
      { name: 'Account history', href: '/books/ledger' },
      { name: 'Months', href: '/books/periods' },
      { name: 'Close the month', href: '/books/close' },
    ],
  },
  {
    id: 'sales',
    name: 'Sales',
    href: '/books/invoices',
    blurb: 'Customers, quotes, invoices, and unpaid bills they owe you.',
    items: [
      { name: 'Customers', href: '/books/customers' },
      { name: 'Estimates', href: '/books/estimates' },
      { name: 'Quotes', href: '/books/quotes' },
      { name: 'Orders', href: '/books/sales-orders' },
      { name: 'Invoices', href: '/books/invoices' },
      { name: 'Refund notes', href: '/books/credit-notes' },
      { name: 'Extra charges', href: '/books/debit-notes' },
      { name: 'Customer statements', href: '/books/statements' },
      { name: 'Unpaid invoices', href: '/books/collections' },
    ],
  },
  {
    id: 'purchases',
    name: 'Buying',
    href: '/books/bills',
    blurb: 'Suppliers, buy orders, bills, and paying what you owe.',
    items: [
      { name: 'Suppliers', href: '/books/vendors' },
      { name: 'Buy requests', href: '/books/purchase-requests' },
      { name: 'Buy orders', href: '/books/purchase-orders' },
      { name: 'Goods received', href: '/books/purchase-receipts' },
      { name: 'Supplier bills', href: '/books/bills' },
      { name: 'Supplier refunds', href: '/books/vendor-credits' },
      { name: 'Pay bills', href: '/books/payment-run' },
    ],
  },
  {
    id: 'banking',
    name: 'Bank',
    href: '/books/banking',
    blurb: 'Bank moves and business spends. Daily money books stay under Money.',
    items: [
      { name: 'Bank', href: '/books/banking' },
      { name: 'Business spends', href: '/books/expenses' },
    ],
  },
  {
    id: 'operations',
    name: 'Operations',
    href: '/books/inventory',
    blurb: 'Stock, equipment, projects, budgets, and rentals.',
    items: [
      { name: 'Stock', href: '/books/inventory' },
      { name: 'Equipment', href: '/books/assets' },
      { name: 'Projects', href: '/books/projects' },
      { name: 'Budgets', href: '/books/budgets' },
      { name: 'Cash plan', href: '/books/forecast' },
      { name: 'Income deals', href: '/books/revenue' },
      { name: 'Rentals', href: '/books/leases' },
    ],
  },
  {
    id: 'control',
    name: 'Reports & tax',
    href: '/books/reports',
    blurb: 'Tax, reports, accountant tools, inbox, and settings.',
    items: [
      { name: 'Tax', href: '/books/tax' },
      { name: 'Reports', href: '/books/reports' },
      { name: 'GST entities', href: '/books/entities' },
      { name: 'Companies', href: '/books/companies' },
      { name: 'Accountant', href: '/books/workbench' },
      { name: 'Inbox', href: '/books/inbox' },
      { name: 'Approvals', href: '/books/approvals' },
      { name: 'Insights', href: '/books/insights' },
      { name: 'Change log', href: '/books/audit' },
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

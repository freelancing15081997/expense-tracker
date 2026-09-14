import { BOOKS_TREE } from './catalog/modules';

export type BooksNavItem = { name: string; href: string };
export type BooksNavGroup = { title: string; items: BooksNavItem[] };

export const BOOKS_NAV: BooksNavGroup[] = BOOKS_TREE.map((branch) => ({
  title: branch.name,
  items: branch.items,
}));

export const BOOKS_FLAT_LINKS = BOOKS_NAV.flatMap((group) => group.items);

export const BOOKS_QUICK_CREATE = [
  { name: 'Invoice', href: '/books/invoices' },
  { name: 'Bill', href: '/books/bills' },
  { name: 'Manual entry', href: '/books/journals' },
  { name: 'Customer', href: '/books/customers' },
  { name: 'Supplier', href: '/books/vendors' },
  { name: 'Spend', href: '/books/expenses' },
  { name: 'Estimate', href: '/books/estimates' },
  { name: 'Order', href: '/books/sales-orders' },
];

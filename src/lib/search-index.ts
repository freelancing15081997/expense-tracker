export type SearchHit = {
  id: string;
  type: 'feature' | 'book' | 'expense' | 'record';
  href: string;
  description: string;
  hint: string;
  amount?: number;
  currency?: string;
  date?: string;
  category?: string;
  bookName?: string;
  enteredBy?: string;
};

let hits: SearchHit[] = [];
const listeners = new Set<() => void>();

export function setBooksSearchHits(next: SearchHit[]) {
  hits = next;
  listeners.forEach((fn) => fn());
}

export function getBooksSearchHits() {
  return hits;
}

export function subscribeBooksSearch(fn: () => void) {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

export function documentHref(kind: string, id?: string) {
  const map: Record<string, string> = {
    invoice: '/books/invoices',
    bill: '/books/bills',
    expense: '/books/expenses',
    quote: '/books/quotes',
    credit_note: '/books/credit-notes',
    purchase_order: '/books/purchase-orders',
    vendor_credit: '/books/vendor-credits',
  };
  const base = map[kind] || '/books/invoices';
  return id ? `${base}?open=${id}` : base;
}

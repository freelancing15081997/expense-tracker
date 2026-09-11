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
  merchant?: string;
  notes?: string;
  tags?: string;
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
    estimate: '/books/estimates',
    sales_order: '/books/sales-orders',
    credit_note: '/books/credit-notes',
    debit_note: '/books/debit-notes',
    purchase_request: '/books/purchase-requests',
    purchase_order: '/books/purchase-orders',
    purchase_receipt: '/books/purchase-receipts',
    vendor_credit: '/books/vendor-credits',
  };
  const base = map[kind] || '/books/invoices';
  return id ? `${base}?open=${id}` : base;
}

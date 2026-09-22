import { listAllExpenses } from './expenses';
import { listLedgers } from './ledgers';
import { getBooksSearchHits, setBooksSearchHits, type SearchHit } from './search-index';

export type CatalogHit = SearchHit;

const FEATURES: CatalogHit[] = [
  { name: 'Home', href: '/' },
  { name: 'Money books', href: '/expenses' },
  { name: 'Activity', href: '/activity' },
  { name: 'Summary', href: '/reports' },
  { name: 'Settings', href: '/settings' },
  { name: 'Help', href: '/help' },
]
  .map((item) => ({
    id: item.href,
    type: 'feature' as const,
    href: item.href,
    description: item.name,
    hint: 'Workspace',
  }));

type Catalog = { uid: string; at: number; hits: CatalogHit[] };
const mem: Catalog = { uid: '', at: 0, hits: [] };
let inflight: { uid: string; promise: Promise<CatalogHit[]> } | null = null;

function matches(hit: CatalogHit, needle: string) {
  if (!needle) return true;
  return [hit.description, hit.hint, hit.bookName, hit.category, hit.enteredBy, hit.date, String(hit.amount ?? ''), hit.merchant, hit.notes, hit.tags]
    .some((value) => String(value || '').toLowerCase().includes(needle));
}

export function getSearchCatalog() {
  return mem.hits;
}

export async function warmSearchCatalog(uid: string, force = false) {
  if (!uid) return [];
  if (!force && mem.uid === uid && Date.now() - mem.at < 45_000) return mem.hits;
  if (inflight && inflight.uid === uid) return inflight.promise;

  const promise = (async () => {
    // One call — listAll already includes books (deduped with Dashboard via expenses cache).
    const all = await listAllExpenses().catch(() => ({ expenses: [] as Array<Record<string, unknown>>, books: [] as Array<Record<string, unknown>> }));
    const ledgers = Array.isArray(all.books) && all.books.length
      ? all.books
      : await listLedgers().catch(() => []);
    const ledgerHits: CatalogHit[] = ledgers.map((book: any) => ({
      id: `ledger:${book.id}`,
      type: 'book' as const,
      href: `/book/${book.id}`,
      description: String(book.name || 'Ledger'),
      hint: 'Expense ledger',
      currency: String(book.currency || ''),
      bookName: String(book.name || ''),
    }));
    const expenseHits: CatalogHit[] = (all.expenses || []).slice(0, 400).map((row) => ({
      id: `expense:${row.bookId}:${row.id}`,
      type: 'expense' as const,
      href: `/book/${row.bookId}`,
      description: String(row.description || 'Entry'),
      hint: 'Ledger entry',
      amount: Number(row.amount || 0),
      currency: String(row.currency || ''),
      date: String(row.date || ''),
      category: String(row.category || ''),
      bookName: String(row.bookName || ''),
      enteredBy: String(row.enteredBy || row.paidByName || ''),
      merchant: String(row.merchant || ''),
      notes: String(row.notes || ''),
      tags: String(row.tags || ''),
    }));
    const hits = [...FEATURES, ...ledgerHits, ...expenseHits, ...getBooksSearchHits()];
    mem.uid = uid;
    mem.at = Date.now();
    mem.hits = hits;
    setBooksSearchHits(hits);
    return hits;
  })();

  inflight = { uid, promise };
  try {
    return await promise;
  } finally {
    if (inflight?.promise === promise) inflight = null;
  }
}

export function clearSearchCatalog() {
  mem.uid = '';
  mem.at = 0;
  mem.hits = [];
  inflight = null;
}

export function querySearchCatalog(term: string, limit = 24): CatalogHit[] {
  const needle = term.trim().toLowerCase();
  const ranked = (needle ? mem.hits.filter((hit) => matches(hit, needle)) : mem.hits.filter((hit) => hit.type === 'feature' || hit.type === 'book'))
    .filter((item, i, arr) => arr.findIndex((x) => x.id === item.id && x.href === item.href) === i);
  return ranked.slice(0, limit);
}

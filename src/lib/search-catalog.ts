import { listAllExpenses } from './expenses';
import { listLedgers } from './ledgers';
import { BOOKS_FLAT_LINKS, BOOKS_QUICK_CREATE } from '../books/nav';
import { getBooksSearchHits, setBooksSearchHits, type SearchHit } from './search-index';

export type CatalogHit = SearchHit;

const FEATURES: CatalogHit[] = [...BOOKS_QUICK_CREATE, ...BOOKS_FLAT_LINKS, { name: 'Main Dashboard', href: '/' }, { name: 'Expense Tracker', href: '/expenses' }, { name: 'Settings', href: '/settings' }]
  .filter((item, i, arr) => arr.findIndex((x) => x.href === item.href) === i)
  .map((item) => ({
    id: item.href,
    type: 'feature' as const,
    href: item.href,
    description: item.name,
    hint: item.href.startsWith('/books') ? 'Books' : 'Workspace',
  }));

type Catalog = { uid: string; at: number; hits: CatalogHit[] };
const mem: Catalog = { uid: '', at: 0, hits: [] };
let inflight: Promise<CatalogHit[]> | null = null;

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
  if (inflight) return inflight;
  inflight = (async () => {
    const [ledgers, all] = await Promise.all([
      listLedgers().catch(() => []),
      listAllExpenses().catch(() => ({ expenses: [] as Array<Record<string, unknown>> })),
    ]);
    const ledgerHits: CatalogHit[] = ledgers.map((book) => ({
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
  try {
    return await inflight;
  } finally {
    inflight = null;
  }
}

export function querySearchCatalog(term: string, limit = 24): CatalogHit[] {
  const needle = term.trim().toLowerCase();
  const ranked = (needle ? mem.hits.filter((hit) => matches(hit, needle)) : mem.hits.filter((hit) => hit.type === 'feature' || hit.type === 'book'))
    .filter((item, i, arr) => arr.findIndex((x) => x.id === item.id && x.href === item.href) === i);
  return ranked.slice(0, limit);
}

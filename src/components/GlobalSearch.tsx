import React, { useState, useEffect, useRef } from 'react';
import { Search, X, Receipt, BookOpen, LayoutGrid, Loader2, FileText } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { db } from '../lib/firebase';
import { collection, query, where, getDocs, limit } from '../lib/store';
import { useNavigate } from 'react-router-dom';
import { BOOKS_FLAT_LINKS, BOOKS_QUICK_CREATE } from '../books/nav';
import { isSoftDeleted } from '../lib/records';
import { getBooksSearchHits, subscribeBooksSearch, type SearchHit } from '../lib/search-index';

export function openGlobalSearch() {
  window.dispatchEvent(new Event('byjan-open-search'));
}

interface SearchResult {
  id: string;
  type: 'expense' | 'book' | 'feature' | 'record';
  href: string;
  bookName?: string;
  description: string;
  amount?: number;
  currency?: string;
  date?: string;
  category?: string;
  enteredBy?: string;
  hint: string;
}

const FEATURES = [...BOOKS_QUICK_CREATE, ...BOOKS_FLAT_LINKS, { name: 'Main Dashboard', href: '/' }, { name: 'Expense Tracker', href: '/expenses' }, { name: 'Settings', href: '/settings' }]
  .filter((item, i, arr) => arr.findIndex((x) => x.href === item.href) === i);

type CachedBook = { id: string; name: string; currency?: string };
const bookCache: { uid: string; books: CachedBook[]; at: number } = { uid: '', books: [], at: 0 };

function featureResults(term: string): SearchResult[] {
  const needle = term.trim().toLowerCase();
  const source = needle
    ? FEATURES.filter((item) => item.name.toLowerCase().includes(needle) || item.href.toLowerCase().includes(needle))
    : FEATURES.slice(0, 10);
  return source.map((item) => ({
    id: item.href,
    type: 'feature' as const,
    href: item.href,
    description: item.name,
    hint: item.href.startsWith('/books') ? 'Books' : 'Workspace',
  }));
}

async function loadBooksFast(uid: string): Promise<CachedBook[]> {
  if (bookCache.uid === uid && Date.now() - bookCache.at < 45_000) return bookCache.books;
  const booksQuery = query(
    collection(db, 'books'),
    where(`roles.${uid}.role`, 'in', ['owner', 'admin', 'contributor', 'viewer', 'auditor']),
    limit(30)
  );
  const snap = await getDocs(booksQuery);
  const books = snap.docs.flatMap((d) => {
    const data = d.data();
    if (isSoftDeleted(data)) return [];
    return [{ id: d.id, name: data.name || 'Ledger', currency: data.currency }];
  });
  bookCache.uid = uid;
  bookCache.books = books;
  bookCache.at = Date.now();
  return books;
}

function fireOpen(event?: React.SyntheticEvent) {
  event?.preventDefault();
  event?.stopPropagation();
  openGlobalSearch();
}

export function SearchTrigger({
  variant = 'button',
}: {
  variant?: 'button' | 'bar' | 'icon';
}) {
  if (variant === 'bar') {
    return (
      <button
        type="button"
        data-open-search
        onPointerDown={fireOpen}
        onClick={fireOpen}
        className="relative z-20 flex items-center gap-2.5 w-full px-4 h-11 text-sm text-slate-800 bg-[#F8FAFC] hover:bg-white rounded-2xl border border-slate-200 shadow-[0_1px_1px_rgba(11,31,58,0.04),0_8px_18px_-12px_rgba(11,31,58,0.18)] transition-colors"
      >
        <Search className="w-5 h-5 text-slate-500" />
        <span className="flex-1 text-left text-slate-500">Search invoices, people, ledgers, features…</span>
        <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-semibold text-slate-500 bg-slate-100 border border-slate-200 rounded">⌘K</kbd>
      </button>
    );
  }
  if (variant === 'icon') {
    return (
      <button
        type="button"
        data-open-search
        onPointerDown={fireOpen}
        onClick={fireOpen}
        className="relative z-20 w-10 h-10 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 flex items-center justify-center shadow-[0_1px_2px_rgba(11,31,58,0.06)]"
        title="Search (⌘K)"
      >
        <Search className="w-5 h-5" />
      </button>
    );
  }
  return (
    <button
      type="button"
      data-open-search
      onPointerDown={fireOpen}
      onClick={fireOpen}
      className="relative z-20 flex items-center gap-2 px-3 py-1.5 text-sm text-slate-700 bg-slate-100 hover:bg-slate-50 rounded-lg border border-slate-200 transition-colors"
    >
      <Search className="w-6 h-6" />
      <span className="hidden sm:inline">Search</span>
    </button>
  );
}

export default function GlobalSearch() {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const ignoreClose = useRef(0);
  const [booksHits, setBooksHits] = useState<SearchHit[]>(() => getBooksSearchHits());

  const open = () => {
    ignoreClose.current = Date.now();
    setIsOpen(true);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (Date.now() - ignoreClose.current < 400) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest('[data-open-search]')) return;
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        open();
      }
      if (event.key === 'Escape') setIsOpen(false);
    };
    const onOpen = () => open();
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('byjan-open-search', onOpen);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('byjan-open-search', onOpen);
    };
  }, []);

  useEffect(() => {
    if (currentUser?.uid) loadBooksFast(currentUser.uid).catch(() => {});
  }, [currentUser?.uid]);

  useEffect(() => subscribeBooksSearch(() => setBooksHits(getBooksSearchHits())), []);

  useEffect(() => {
    const term = searchQuery.trim();
    const needle = term.toLowerCase();
    const instant: SearchResult[] = featureResults(term);
    if (currentUser && bookCache.uid === currentUser.uid) {
      const books = needle
        ? bookCache.books.filter((b) => b.name.toLowerCase().includes(needle))
        : bookCache.books.slice(0, 5);
      instant.push(...books.map((b) => ({
        id: b.id,
        type: 'book' as const,
        href: `/book/${b.id}`,
        bookName: b.name,
        description: b.name,
        currency: b.currency,
        hint: 'Expense Tracker',
      })));
    }
    if (needle) {
      instant.push(...booksHits.filter((hit) =>
        hit.description.toLowerCase().includes(needle) || hit.hint.toLowerCase().includes(needle)
      ).slice(0, 12));
    } else {
      instant.push(...booksHits.slice(0, 6));
    }
    const deduped = instant.filter((item, i, arr) => arr.findIndex((x) => x.id === item.id && x.href === item.href) === i);
    setResults(deduped.slice(0, 18));
    setLoading(false);
    if (currentUser && (bookCache.uid !== currentUser.uid || Date.now() - bookCache.at > 45_000)) {
      void loadBooksFast(currentUser.uid).catch(() => {});
    }
  }, [searchQuery, currentUser, booksHits]);

  const handleResultClick = (result: SearchResult) => {
    navigate(result.href);
    setIsOpen(false);
    setSearchQuery('');
  };

  const getCurrencySymbol = (currency: string) => {
    const symbols: Record<string, string> = { INR: '₹', USD: '$', EUR: '€', GBP: '£' };
    return symbols[currency] || currency;
  };

  return (
    <div
      className={isOpen
        ? 'fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[200] flex items-start justify-center pt-[12vh]'
        : 'hidden'}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) setIsOpen(false);
      }}
    >
      <div ref={searchRef} className="w-full max-w-2xl mx-4 byjan-panel overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-200">
          <Search className="w-6 h-6 text-slate-500" />
          <input
            ref={inputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search invoices, customers, ledgers, expenses…"
            className="flex-1 text-sm outline-none text-slate-900 placeholder:text-slate-400"
            autoFocus
          />
          {loading && <Loader2 className="w-4 h-4 text-slate-400 animate-spin" />}
          <button type="button" onClick={() => setIsOpen(false)} className="p-1 text-slate-400 hover:text-slate-700 rounded">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="max-h-[60vh] overflow-y-auto">
          {results.length === 0 && !loading ? (
            <div className="p-8 text-center text-sm text-slate-500">No results for “{searchQuery}”</div>
          ) : (
            <div className="py-1">
              {results.map((result) => (
                <button
                  key={`${result.type}-${result.id}`}
                  type="button"
                  onClick={() => handleResultClick(result)}
                  className="w-full px-4 py-3 hover:bg-slate-50 transition-colors text-left flex items-start gap-3 border-b border-slate-100 last:border-0"
                >
                  <div className="mt-0.5">
                    {result.type === 'feature' ? <LayoutGrid className="w-4 h-4 text-teal-600" /> : result.type === 'book' ? <BookOpen className="w-4 h-4 text-blue-600" /> : result.type === 'record' ? <FileText className="w-4 h-4 text-indigo-600" /> : <Receipt className="w-4 h-4 text-emerald-600" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-sm font-semibold text-slate-900 truncate">{result.description}</p>
                      {result.amount !== undefined && (
                        <span className="text-sm font-bold text-slate-900 whitespace-nowrap">
                          {getCurrencySymbol(result.currency || 'INR')} {Number(result.amount).toLocaleString()}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <span>{result.hint}</span>
                      {result.bookName && <><span>•</span><span className="truncate">{result.bookName}</span></>}
                      {result.category && <><span>•</span><span>{result.category}</span></>}
                      {result.enteredBy && <><span>•</span><span>{result.enteredBy}</span></>}
                      {result.date && <><span>•</span><span>{result.date}</span></>}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="px-4 py-2 bg-slate-50 border-t border-slate-200 text-xs text-slate-500 flex items-center justify-between">
          <span>Invoices, people, ledgers, and features</span>
          <span>⌘K / Ctrl+K</span>
        </div>
      </div>
    </div>
  );
}

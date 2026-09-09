import React, { useState, useEffect, useRef } from 'react';
import { Search, X, Receipt, BookOpen, LayoutGrid, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { db } from '../lib/firebase';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { BOOKS_FLAT_LINKS, BOOKS_QUICK_CREATE } from '../books/nav';

export function openGlobalSearch() {
  window.dispatchEvent(new Event('byjan-open-search'));
}

interface SearchResult {
  id: string;
  type: 'expense' | 'book' | 'feature';
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

const FEATURES = [...BOOKS_QUICK_CREATE, ...BOOKS_FLAT_LINKS, { name: 'Expense Tracker', href: '/' }, { name: 'Settings', href: '/settings' }]
  .filter((item, i, arr) => arr.findIndex((x) => x.href === item.href) === i);

function safeDateLabel(data: any) {
  if (typeof data?.date === 'string' && data.date) return data.date;
  try {
    if (data?.createdAt && typeof data.createdAt.toDate === 'function') {
      return format(data.createdAt.toDate(), 'MMM dd, yyyy');
    }
  } catch { /* pending timestamp */ }
  return '';
}

export function SearchTrigger({
  variant = 'button',
}: {
  variant?: 'button' | 'sidebar' | 'bar' | 'icon';
}) {
  const open = () => openGlobalSearch();
  if (variant === 'sidebar') {
    return (
      <button
        type="button"
        onClick={open}
        className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl bg-white/15 border border-white/25 text-left text-sm text-white hover:bg-white/25 transition-colors"
      >
        <Search className="w-4 h-4 text-white shrink-0" />
        <span className="flex-1 text-white/90">Search features, names…</span>
        <kbd className="hidden lg:inline px-1.5 py-0.5 text-[10px] font-semibold text-white/80 bg-black/20 border border-white/20 rounded">⌘K</kbd>
      </button>
    );
  }
  if (variant === 'bar') {
    return (
      <button
        type="button"
        onClick={open}
        className="flex items-center gap-2 w-full max-w-xl px-3 py-2 text-sm text-slate-800 bg-white hover:bg-slate-50 rounded-xl border border-slate-200 shadow-sm transition-colors"
      >
        <Search className="w-4 h-4 text-slate-600" />
        <span className="flex-1 text-left text-slate-500">Search features, customers, expenses…</span>
        <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-semibold text-slate-500 bg-slate-100 border border-slate-200 rounded">⌘K</kbd>
      </button>
    );
  }
  if (variant === 'icon') {
    return (
      <button type="button" onClick={open} className="p-2.5 rounded-xl bg-white/15 border border-white/25 text-white hover:bg-white/25" title="Search (⌘K)">
        <Search className="w-4 h-4" />
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={open}
      className="flex items-center gap-2 px-3 py-1.5 text-sm text-white bg-white/15 hover:bg-white/25 rounded-lg border border-white/25 transition-colors"
    >
      <Search className="w-4 h-4" />
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

  const open = () => {
    setIsOpen(true);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
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
    const term = searchQuery.trim();
    if (term.length < 1) {
      setResults(FEATURES.slice(0, 8).map((item) => ({
        id: item.href,
        type: 'feature' as const,
        href: item.href,
        description: item.name,
        hint: 'Feature',
      })));
      return;
    }
    const searchTimeout = setTimeout(() => performSearch(term), 200);
    return () => clearTimeout(searchTimeout);
  }, [searchQuery, currentUser]);

  const performSearch = async (term: string) => {
    const needle = term.toLowerCase();
    const searchResults: SearchResult[] = FEATURES
      .filter((item) => item.name.toLowerCase().includes(needle) || item.href.toLowerCase().includes(needle))
      .map((item) => ({
        id: item.href,
        type: 'feature' as const,
        href: item.href,
        description: item.name,
        hint: 'Feature',
      }));

    if (!currentUser) {
      setResults(searchResults.slice(0, 18));
      return;
    }

    setLoading(true);
    try {
      const booksQuery = query(
        collection(db, 'books'),
        where(`roles.${currentUser.uid}.role`, 'in', ['owner', 'admin', 'contributor', 'viewer', 'auditor']),
        limit(20)
      );
      const booksSnapshot = await getDocs(booksQuery);

      for (const bookDoc of booksSnapshot.docs) {
        const bookData = bookDoc.data();
        const bookName = bookData.name || '';
        if (bookName.toLowerCase().includes(needle)) {
          searchResults.push({
            id: bookDoc.id,
            type: 'book',
            href: `/book/${bookDoc.id}`,
            bookName,
            description: bookName,
            currency: bookData.currency,
            hint: 'Expense Tracker',
          });
        }

        const expensesSnapshot = await getDocs(query(collection(db, `books/${bookDoc.id}/expenses`), limit(30)));
        expensesSnapshot.forEach((expDoc) => {
          const expData = expDoc.data();
          const description = expData.description || '';
          const category = expData.category || '';
          const enteredBy = expData.enteredBy || expData.paidByName || '';
          const matches =
            description.toLowerCase().includes(needle) ||
            category.toLowerCase().includes(needle) ||
            enteredBy.toLowerCase().includes(needle) ||
            String(expData.amount || '').includes(needle);
          if (!matches) return;
          searchResults.push({
            id: expDoc.id,
            type: 'expense',
            href: `/book/${bookDoc.id}`,
            bookName,
            description: description || 'Entry',
            amount: expData.amount,
            currency: bookData.currency,
            date: safeDateLabel(expData),
            category,
            enteredBy,
            hint: 'Entry',
          });
        });
      }
      setResults(searchResults.slice(0, 18));
    } catch (error) {
      console.error('Search error:', error);
      setResults(searchResults.slice(0, 18));
    } finally {
      setLoading(false);
    }
  };

  const handleResultClick = (result: SearchResult) => {
    navigate(result.href);
    setIsOpen(false);
    setSearchQuery('');
  };

  const getCurrencySymbol = (currency: string) => {
    const symbols: Record<string, string> = { INR: '₹', USD: '$', EUR: '€', GBP: '£' };
    return symbols[currency] || currency;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[80] flex items-start justify-center pt-[12vh]">
      <div ref={searchRef} className="w-full max-w-2xl mx-4 bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-200">
          <Search className="w-5 h-5 text-slate-500" />
          <input
            ref={inputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search features, names, ledgers, expenses…"
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
                    {result.type === 'feature' ? <LayoutGrid className="w-4 h-4 text-teal-600" /> : result.type === 'book' ? <BookOpen className="w-4 h-4 text-blue-600" /> : <Receipt className="w-4 h-4 text-emerald-600" />}
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
          <span>Features, ledgers, and people names</span>
          <span>⌘K / Ctrl+K</span>
        </div>
      </div>
    </div>
  );
}

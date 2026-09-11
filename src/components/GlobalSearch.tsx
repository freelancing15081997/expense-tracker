import React, { useState, useEffect, useRef } from 'react';
import { Search, X, Receipt, BookOpen, LayoutGrid, Loader2, FileText } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { getRuntimePrefs } from '../lib/app-prefs';
import { querySearchCatalog, warmSearchCatalog, type CatalogHit } from '../lib/search-catalog';
import { getCurrencySymbol } from '../lib/currency';

export function openGlobalSearch() {
  window.dispatchEvent(new Event('byjan-open-search'));
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
        <span className="flex-1 text-left text-slate-500">Search ledgers, entries, invoices, people…</span>
        <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-semibold text-slate-500 bg-slate-100 border border-slate-200 rounded">Ctrl+K</kbd>
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
        title="Search (Ctrl+K)"
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
      <Search className="w-5 h-5" />
      <span className="hidden sm:inline">Search</span>
    </button>
  );
}

export default function GlobalSearch() {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<CatalogHit[]>([]);
  const [loading, setLoading] = useState(false);
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const ignoreClose = useRef(0);

  const open = () => {
    ignoreClose.current = Date.now();
    setIsOpen(true);
    if (currentUser?.uid) void warmSearchCatalog(currentUser.uid);
    setTimeout(() => inputRef.current?.focus(), 30);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (Date.now() - ignoreClose.current < 400) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest('[data-open-search]')) return;
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) setIsOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        if (!getRuntimePrefs().keyboardShortcuts) return;
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
  }, [currentUser?.uid]);

  useEffect(() => {
    if (currentUser?.uid) void warmSearchCatalog(currentUser.uid);
  }, [currentUser?.uid]);

  useEffect(() => {
    if (!isOpen) return;
    setResults(querySearchCatalog(searchQuery));
    if (currentUser?.uid) {
      setLoading(true);
      void warmSearchCatalog(currentUser.uid).then(() => {
        setResults(querySearchCatalog(searchQuery));
        setLoading(false);
      }).catch(() => setLoading(false));
    }
  }, [searchQuery, isOpen, currentUser?.uid]);

  return (
    <div
      className={isOpen ? 'fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[200] flex items-start justify-center pt-[12vh]' : 'hidden'}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) setIsOpen(false);
      }}
    >
      <div ref={searchRef} className="w-full max-w-2xl mx-4 byjan-panel overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-200">
          <Search className="w-5 h-5 text-slate-500" />
          <input
            ref={inputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search ledgers, entries, invoices, people…"
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
            <div className="p-8 text-center text-sm text-slate-500">{searchQuery.trim() ? `No results for “${searchQuery}”` : 'Type to search everything you can open.'}</div>
          ) : (
            <div className="py-1">
              {results.map((result) => (
                <button
                  key={`${result.type}-${result.id}`}
                  type="button"
                  onClick={() => {
                    navigate(result.href);
                    setIsOpen(false);
                    setSearchQuery('');
                  }}
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
          <span>Ledgers, entries, Books records, and features</span>
          <span>Ctrl+K</span>
        </div>
      </div>
    </div>
  );
}

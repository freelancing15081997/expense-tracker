import React, { useState, useEffect, useRef } from 'react';
import { Search, X, FileText, Receipt, BookOpen, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { db } from '../lib/firebase';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';

interface SearchResult {
  id: string;
  type: 'expense' | 'book';
  bookId?: string;
  bookName: string;
  description: string;
  amount?: number;
  currency?: string;
  date?: string;
  category?: string;
  enteredBy?: string;
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

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
        event.preventDefault();
        setIsOpen(true);
        setTimeout(() => inputRef.current?.focus(), 100);
      }
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  useEffect(() => {
    if (searchQuery.trim().length < 2) {
      setResults([]);
      return;
    }

    const searchTimeout = setTimeout(async () => {
      await performSearch(searchQuery);
    }, 300);

    return () => clearTimeout(searchTimeout);
  }, [searchQuery, currentUser]);

  const performSearch = async (query: string) => {
    if (!currentUser) return;
    
    setLoading(true);
    const searchResults: SearchResult[] = [];

    try {
      const booksQuery = query(
        collection(db, 'books'),
        where(`roles.${currentUser.uid}`, '!=', null),
        limit(10)
      );
      const booksSnapshot = await getDocs(booksQuery);
      
      for (const bookDoc of booksSnapshot.docs) {
        const bookData = bookDoc.data();
        const bookName = bookData.name || '';
        
        if (bookName.toLowerCase().includes(query.toLowerCase())) {
          searchResults.push({
            id: bookDoc.id,
            type: 'book',
            bookName: bookName,
            description: `Book: ${bookName}`,
            currency: bookData.currency
          });
        }

        const expensesQuery = query(
          collection(db, `books/${bookDoc.id}/expenses`),
          limit(20)
        );
        const expensesSnapshot = await getDocs(expensesQuery);
        
        expensesSnapshot.forEach((expDoc) => {
          const expData = expDoc.data();
          const description = expData.description || '';
          const category = expData.category || '';
          const enteredBy = expData.enteredBy || expData.paidByName || '';
          
          const matchesQuery = 
            description.toLowerCase().includes(query.toLowerCase()) ||
            category.toLowerCase().includes(query.toLowerCase()) ||
            enteredBy.toLowerCase().includes(query.toLowerCase()) ||
            expData.amount?.toString().includes(query);

          if (matchesQuery) {
            searchResults.push({
              id: expDoc.id,
              type: 'expense',
              bookId: bookDoc.id,
              bookName: bookName,
              description: description,
              amount: expData.amount,
              currency: bookData.currency,
              date: expData.date || (expData.createdAt ? format(expData.createdAt.toDate(), 'MMM dd, yyyy') : ''),
              category: category,
              enteredBy: enteredBy
            });
          }
        });
      }

      setResults(searchResults.slice(0, 15));
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleResultClick = (result: SearchResult) => {
    if (result.type === 'book') {
      navigate(`/books/${result.id}`);
    } else if (result.type === 'expense' && result.bookId) {
      navigate(`/books/${result.bookId}`);
    }
    setIsOpen(false);
    setSearchQuery('');
  };

  const getCurrencySymbol = (currency: string) => {
    const symbols: Record<string, string> = { 'INR': '₹', 'USD': '$', 'EUR': '€', 'GBP': '£' };
    return symbols[currency] || currency;
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 px-3 py-1.5 text-sm text-slate-400 bg-zinc-800 hover:bg-zinc-700 rounded-lg border border-zinc-700 transition-colors"
      >
        <Search className="w-4 h-4" />
        <span className="hidden sm:inline">Search...</span>
        <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-semibold text-slate-400 bg-zinc-900 border border-zinc-700 rounded">⌘K</kbd>
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-start justify-center pt-[15vh]">
          <div ref={searchRef} className="w-full max-w-2xl mx-4 bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-200">
              <Search className="w-5 h-5 text-slate-400" />
              <input
                ref={inputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search expenses, books, invoices..."
                className="flex-1 text-sm outline-none text-slate-900 placeholder:text-slate-400"
                autoFocus
              />
              {loading && <Loader2 className="w-4 h-4 text-slate-400 animate-spin" />}
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="max-h-[60vh] overflow-y-auto">
              {searchQuery.trim().length < 2 ? (
                <div className="p-8 text-center text-sm text-slate-500">
                  <p>Type at least 2 characters to search</p>
                  <p className="mt-2 text-xs">Search by description, amount, category, or user name</p>
                </div>
              ) : results.length === 0 && !loading ? (
                <div className="p-8 text-center text-sm text-slate-500">
                  No results found for "{searchQuery}"
                </div>
              ) : (
                <div className="py-2">
                  {results.map((result) => (
                    <button
                      key={`${result.type}-${result.id}`}
                      onClick={() => handleResultClick(result)}
                      className="w-full px-4 py-3 hover:bg-slate-50 transition-colors text-left flex items-start gap-3 border-b border-slate-100 last:border-0"
                    >
                      <div className="mt-1">
                        {result.type === 'book' ? (
                          <BookOpen className="w-4 h-4 text-blue-500" />
                        ) : (
                          <Receipt className="w-4 h-4 text-emerald-500" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-sm font-medium text-slate-900 truncate">{result.description}</p>
                          {result.amount !== undefined && (
                            <span className="text-sm font-bold text-slate-900 whitespace-nowrap">
                              {getCurrencySymbol(result.currency || 'INR')} {result.amount.toLocaleString()}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                          <span className="truncate">{result.bookName}</span>
                          {result.category && (
                            <>
                              <span>•</span>
                              <span className="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px]">{result.category}</span>
                            </>
                          )}
                          {result.date && (
                            <>
                              <span>•</span>
                              <span>{result.date}</span>
                            </>
                          )}
                          {result.enteredBy && (
                            <>
                              <span>•</span>
                              <span>{result.enteredBy}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="px-4 py-2 bg-slate-50 border-t border-slate-200 text-xs text-slate-500 flex items-center justify-between">
              <span>Press ESC to close</span>
              <span>⌘K to open search</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

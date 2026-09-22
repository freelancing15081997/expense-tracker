import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { BookText, Search, X } from 'lucide-react';
import { initials } from '../lib/ledger-advanced';
import { roleLabel } from '../lib/plain-language';
import { MoneyBookListSkeleton } from './money/MoneySkeletons';

export type BookPickItem = {
  id: string;
  name: string;
  role?: string;
};

type Props = {
  open: boolean;
  title: string;
  subtitle?: string;
  books: BookPickItem[];
  loading?: boolean;
  onPick: (bookId: string) => void;
  onClose: () => void;
};

export default function BookPickSheet({ open, title, subtitle, books, loading, onPick, onClose }: Props) {
  const [q, setQ] = useState('');

  useEffect(() => {
    if (!open) setQ('');
  }, [open]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return books;
    return books.filter((book) => {
      const hay = `${book.name} ${book.role || ''}`.toLowerCase();
      return hay.includes(needle);
    });
  }, [books, q]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <>
      <div className="ios-sheet-dim book-pick-dim" onClick={onClose} />
      <div className="book-pick-sheet" role="dialog" aria-modal="true" aria-label={title} data-testid="book-pick-sheet">
        <div className="ios-notify-handle" aria-hidden />
        <div className="book-pick-head">
          <div className="min-w-0">
            <p className="book-pick-kicker">Choose a book</p>
            <h2 className="book-pick-title">{title}</h2>
            {subtitle ? <p className="book-pick-sub">{subtitle}</p> : null}
          </div>
          <button type="button" className="ios-notify-close" aria-label="Close" onClick={onClose}>
            <X className="w-4 h-4" />
          </button>
        </div>
        {books.length > 4 || q ? (
          <label className="book-pick-search">
            <Search className="w-4 h-4" aria-hidden />
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search books"
              autoFocus={books.length > 6}
              data-testid="book-pick-search"
            />
          </label>
        ) : null}
        <div className="book-pick-list">
          {loading ? (
            <div className="px-1 py-2"><MoneyBookListSkeleton rows={3} /></div>
          ) : filtered.length === 0 ? (
            <p className="book-pick-empty">{q.trim() ? `No books match “${q.trim()}”` : 'No money books yet. Create one first.'}</p>
          ) : (
            filtered.map((book) => (
              <button
                key={book.id}
                type="button"
                className="book-pick-row"
                onClick={() => onPick(book.id)}
              >
                <span className="book-pick-icon" aria-hidden>
                  {initials(book.name) || <BookText className="w-4 h-4" />}
                </span>
                <span className="min-w-0 flex-1 text-left">
                  <span className="book-pick-name">{book.name}</span>
                  {book.role ? <span className="book-pick-meta">{roleLabel(book.role)}</span> : null}
                </span>
              </button>
            ))
          )}
        </div>
      </div>
    </>,
    document.body,
  );
}

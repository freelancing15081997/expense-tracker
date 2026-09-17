import React from 'react';
import { createPortal } from 'react-dom';
import { BookText, X } from 'lucide-react';
import { initials } from '../lib/ledger-advanced';
import { roleLabel } from '../lib/plain-language';

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
  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <>
      <div className="ios-sheet-dim book-pick-dim" onClick={onClose} />
      <div className="book-pick-sheet" role="dialog" aria-modal="true" aria-label={title}>
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
        <div className="book-pick-list">
          {loading ? (
            <p className="book-pick-empty">Loading your books…</p>
          ) : books.length === 0 ? (
            <p className="book-pick-empty">No money books yet. Create one first.</p>
          ) : (
            books.map((book) => (
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

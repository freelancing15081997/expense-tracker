import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBooks } from '../context/BooksProvider';
import { BOOKS_FLAT_LINKS, BOOKS_QUICK_CREATE } from '../nav';
import { FeatureIcon } from './icons';
import { documentHref } from '../../lib/search-index';

export default function CommandPalette() {
  const navigate = useNavigate();
  const books = useBooks();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const results = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const screens = [...BOOKS_QUICK_CREATE, ...BOOKS_FLAT_LINKS].reduce<{ name: string; href: string; hint: string }[]>((acc, item) => {
      if (acc.some((x) => x.href === item.href)) return acc;
      if (!needle || item.name.toLowerCase().includes(needle)) acc.push({ name: item.name, href: item.href, hint: 'Feature' });
      return acc;
    }, []);
    const records: { name: string; href: string; hint: string }[] = [];
    if (needle.length >= 2) {
      for (const d of books.documents) {
        if (d.number.toLowerCase().includes(needle) || d.memo.toLowerCase().includes(needle)) {
          records.push({ name: d.number, href: documentHref(d.kind, d.id), hint: d.kind.replace('_', ' ') });
        }
      }
      for (const p of books.parties) {
        if (p.name.toLowerCase().includes(needle)) {
          records.push({ name: p.name, href: `${p.kind === 'vendor' ? '/books/vendors' : '/books/customers'}?open=${p.id}`, hint: p.kind });
        }
      }
      for (const a of books.accounts) {
        if (a.code.includes(needle) || a.name.toLowerCase().includes(needle)) {
          records.push({ name: `${a.code} ${a.name}`, href: `/books/ledger/${a.id}`, hint: 'ledger' });
        }
      }
    }
    return [...screens, ...records].slice(0, 14);
  }, [q, books.accounts, books.documents, books.parties]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[180] bg-[#0B1F3A]/40 flex items-start justify-center pt-24 px-4" onClick={() => setOpen(false)}>
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200" onClick={(e) => e.stopPropagation()}>
        <input
          autoFocus
          className="w-full px-4 py-3.5 border-b border-slate-200 text-sm outline-none bg-transparent"
          placeholder="Search features, invoices, parties, accounts…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <ul>
          {results.map((item) => (
            <li key={`${item.href}-${item.name}`}>
              <button
                type="button"
                className="w-full text-left px-4 py-2.5 text-sm hover:bg-slate-50 flex justify-between gap-3"
                onClick={() => {
                  navigate(item.href);
                  setOpen(false);
                  setQ('');
                }}
              >
                <span className="inline-flex items-center gap-2 min-w-0">
                  <FeatureIcon href={item.href} className="w-4 h-4 shrink-0" />
                  <span className="truncate">{item.name}</span>
                </span>
                <span className="text-[11px] uppercase tracking-wide text-slate-400">{item.hint}</span>
              </button>
            </li>
          ))}
        </ul>
        <p className="px-4 py-2 text-[11px] text-slate-400">Ctrl/⌘ Shift+K · does not replace header search (Ctrl+K)</p>
      </div>
    </div>
  );
}

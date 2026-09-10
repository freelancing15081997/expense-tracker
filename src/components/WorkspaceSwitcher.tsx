import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { BookOpen, Building2, Check, ChevronUp, LayoutDashboard, Receipt } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useBooksTenantMeta } from '../lib/tenant';
import { db } from '../lib/firebase';
import { collection, getDocs, limit, query, where } from '../lib/store';
import { isSoftDeleted } from '../lib/records';

type Ledger = { id: string; name: string };

export default function WorkspaceSwitcher({ expanded }: { expanded: boolean }) {
  const { currentUser } = useAuth();
  const tenant = useBooksTenantMeta();
  const location = useLocation();
  const wrapRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [ledgers, setLedgers] = useState<Ledger[]>([]);

  const onBooks = location.pathname === '/books' || location.pathname.startsWith('/books/');
  const onExpenses = location.pathname === '/expenses' || location.pathname.startsWith('/book/');
  const currentLabel = onBooks
    ? (tenant?.name || 'Books')
    : onExpenses
      ? 'Expense Tracker'
      : 'Main dashboard';

  useEffect(() => {
    if (!currentUser) return;
    const uid = currentUser.uid;
    getDocs(query(
      collection(db, 'books'),
      where(`roles.${uid}.role`, 'in', ['owner', 'admin', 'contributor', 'viewer', 'auditor']),
      limit(20),
    )).then((snap) => {
      setLedgers(snap.docs.flatMap((row) => {
        const data = row.data();
        if (isSoftDeleted(data)) return [];
        return [{ id: row.id, name: String(data.name || 'Ledger') }];
      }));
    }).catch(() => undefined);
  }, [currentUser?.uid]);

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener('mousedown', onClick);
    return () => window.removeEventListener('mousedown', onClick);
  }, []);

  return (
    <div ref={wrapRef} className="relative mb-2">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        title="Switch workspace"
        className={expanded
          ? 'w-full flex items-center gap-2 px-2 py-2 rounded-xl bg-[#F4F7FB] border border-slate-200 text-left hover:bg-white'
          : 'w-full flex justify-center p-1 rounded-xl hover:bg-white'}
      >
        <span className="w-8 h-8 rounded-lg bg-white border border-slate-200 text-[#0B1F3A] flex items-center justify-center shrink-0">
          <Building2 className="w-4 h-4" />
        </span>
        {expanded && (
          <>
            <span className="min-w-0 flex-1">
              <span className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Workspace</span>
              <span className="block text-[12px] font-semibold text-[#0B1F3A] truncate">{currentLabel}</span>
            </span>
            <ChevronUp className={`w-4 h-4 text-slate-400 transition-transform ${open ? '' : 'rotate-180'}`} />
          </>
        )}
      </button>
      {open && (
        <div className={expanded
          ? 'absolute z-[90] byjan-flyout p-2 bottom-[calc(100%+8px)] left-0 right-0'
          : 'absolute z-[90] byjan-flyout p-2 bottom-0 left-[calc(100%+10px)] w-64'}
        >
          <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Switch to</p>
          <Link to="/" className="flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-slate-50 text-sm font-medium text-slate-700">
            <LayoutDashboard className="w-4 h-4" />
            Main dashboard
            {location.pathname === '/' && <Check className="w-3.5 h-3.5 ml-auto text-teal-600" />}
          </Link>
          <Link to="/books" className="flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-slate-50 text-sm font-medium text-slate-700">
            <BookOpen className="w-4 h-4" />
            <span className="min-w-0 truncate">{tenant?.name || 'Books'}</span>
            {onBooks && <Check className="w-3.5 h-3.5 ml-auto text-teal-600" />}
          </Link>
          <Link to="/expenses" className="flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-slate-50 text-sm font-medium text-slate-700">
            <Receipt className="w-4 h-4" />
            Expense Tracker
            {location.pathname === '/expenses' && <Check className="w-3.5 h-3.5 ml-auto text-teal-600" />}
          </Link>
          {ledgers.length > 0 && (
            <>
              <p className="px-2 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Ledgers</p>
              {ledgers.map((book) => (
                <Link
                  key={book.id}
                  to={`/book/${book.id}`}
                  className="flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-slate-50 text-sm font-medium text-slate-700"
                >
                  <span className="w-4 h-4 rounded bg-slate-200 shrink-0" />
                  <span className="truncate">{book.name}</span>
                  {location.pathname === `/book/${book.id}` && <Check className="w-3.5 h-3.5 ml-auto text-teal-600" />}
                </Link>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

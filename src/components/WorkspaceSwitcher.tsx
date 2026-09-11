import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { BookOpen, Building2, Check, ChevronDown, LayoutDashboard, Plus, Receipt } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useBooksTenantMeta } from '../lib/tenant';
import { db } from '../lib/firebase';
import { listLedgers } from '../lib/ledgers';
import { listOrgDirectory } from '../books/data/orgs';
import { buildOrgTree, selectWorkspace, type OrgRecord } from '../books/core/hierarchy';

type Ledger = { id: string; name: string };

export default function WorkspaceSwitcher({ variant = 'header' }: { variant?: 'header' | 'sidebar' }) {
  const { currentUser } = useAuth();
  const tenant = useBooksTenantMeta();
  const location = useLocation();
  const navigate = useNavigate();
  const wrapRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [ledgers, setLedgers] = useState<Ledger[]>([]);
  const [orgs, setOrgs] = useState<OrgRecord[]>([]);

  const onBooks = location.pathname === '/books' || location.pathname.startsWith('/books/');
  const onExpenses = location.pathname === '/expenses' || location.pathname.startsWith('/book/');
  const tree = useMemo(() => buildOrgTree(orgs), [orgs]);
  const activeOrg = orgs.find((row) => row.id === tenant?.id) || orgs[0];
  const currentLabel = onBooks
    ? (activeOrg?.name || tenant?.name || 'Books')
    : onExpenses
      ? 'Expense Tracker'
      : 'Main dashboard';

  useEffect(() => {
    if (!currentUser) return;
    listLedgers().then((rows) => {
      setLedgers(rows.slice(0, 20).map((row) => ({
        id: row.id,
        name: String(row.name || 'Ledger'),
      })));
    }).catch(() => undefined);
  }, [currentUser?.uid]);

  useEffect(() => {
    if (!currentUser) return;
    listOrgDirectory(db, currentUser.uid, tenant?.name || 'Books')
      .then(setOrgs)
      .catch(() => setOrgs([{
        id: currentUser.uid,
        name: tenant?.name || 'Books',
        parentId: null,
        depth: 0,
        kind: 'root',
        role: 'owner',
      }]));
  }, [currentUser?.uid, tenant?.name, onBooks]);

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

  const openCompany = (id: string) => {
    if (!currentUser) return;
    selectWorkspace(currentUser.uid, id);
    if (!onBooks) navigate('/books');
    setOpen(false);
  };

  const header = variant === 'header';

  return (
    <div ref={wrapRef} className={`relative ${header ? '' : 'mb-2'}`}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        title="Switch workspace"
        className={header
          ? 'inline-flex items-center gap-2 h-10 max-w-[14rem] pl-1.5 pr-2.5 rounded-xl border border-slate-200 bg-white text-left hover:bg-slate-50'
          : 'w-full flex items-center gap-2 px-2 py-2 rounded-xl bg-[#F4F7FB] border border-slate-200 text-left hover:bg-white'}
      >
        <span className="w-8 h-8 rounded-lg bg-[#F4F7FB] border border-slate-200 text-[#0B1F3A] flex items-center justify-center shrink-0">
          <Building2 className="w-4 h-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Workspace</span>
          <span className="block text-[12px] font-semibold text-[#0B1F3A] truncate">{currentLabel}</span>
        </span>
        <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className={header
          ? 'absolute z-[90] byjan-flyout p-2 top-[calc(100%+8px)] left-0 w-80 max-h-[min(28rem,70vh)] overflow-y-auto'
          : 'absolute z-[90] byjan-flyout p-2 bottom-[calc(100%+8px)] left-0 right-0'}
        >
          <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Switch to</p>
          <Link to="/" className="flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-slate-50 text-sm font-medium text-slate-700">
            <LayoutDashboard className="w-4 h-4" />
            Main dashboard
            {location.pathname === '/' && <Check className="w-3.5 h-3.5 ml-auto text-teal-600" />}
          </Link>
          <p className="px-2 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Books companies</p>
          {tree.map((row) => (
            <button
              key={row.id}
              type="button"
              onClick={() => openCompany(row.id)}
              className="w-full flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-slate-50 text-sm font-medium text-slate-700 text-left"
              style={{ paddingLeft: 8 + row.indent * 14 }}
            >
              <BookOpen className="w-4 h-4 shrink-0" />
              <span className="min-w-0 truncate">{row.name}</span>
              {onBooks && tenant?.id === row.id && <Check className="w-3.5 h-3.5 ml-auto text-teal-600" />}
            </button>
          ))}
          <Link
            to="/books/companies"
            className="flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-slate-50 text-sm font-medium text-teal-700"
          >
            <Plus className="w-4 h-4" />
            New company
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

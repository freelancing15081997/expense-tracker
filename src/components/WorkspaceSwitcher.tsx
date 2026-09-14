import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { BookOpen, Building2, Check, ChevronDown, LayoutDashboard, Plus, Receipt } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useFeatures } from '../lib/use-features';
import { useBooksTenantMeta } from '../lib/tenant';
import { db } from '../lib/firebase';
import { getLedger, listLedgers } from '../lib/ledgers';
import { listOrgDirectory } from '../books/data/orgs';
import { buildOrgTree, selectWorkspace, type OrgRecord } from '../books/core/hierarchy';

type Ledger = { id: string; name: string };

export default function WorkspaceSwitcher({ variant = 'header' }: { variant?: 'header' | 'sidebar' }) {
  const { currentUser } = useAuth();
  const { on: hasFeature } = useFeatures();
  const tenant = useBooksTenantMeta();
  const location = useLocation();
  const navigate = useNavigate();
  const wrapRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0, width: 320, place: 'below' as 'below' | 'above' });
  const [ledgers, setLedgers] = useState<Ledger[]>([]);
  const [orgs, setOrgs] = useState<OrgRecord[]>([]);
  const [activeBookName, setActiveBookName] = useState('');

  const onBooks = location.pathname === '/books' || location.pathname.startsWith('/books/');
  const onExpenses = location.pathname === '/expenses' || location.pathname.startsWith('/book/');
  const activeBookId = location.pathname.startsWith('/book/') ? location.pathname.split('/')[2] : '';
  const activeBook = ledgers.find((row) => row.id === activeBookId);
  const tree = useMemo(() => buildOrgTree(orgs), [orgs]);
  const activeOrg = orgs.find((row) => row.id === tenant?.id) || orgs[0];
  const currentLabel = activeBookId
    ? (activeBook?.name || activeBookName || 'Money book')
    : onBooks
      ? (activeOrg?.name || tenant?.name || 'Business')
      : onExpenses
        ? 'Money books'
        : 'Home';

  useEffect(() => {
    if (!currentUser) return;
    listLedgers().then((rows) => {
      setLedgers(rows.map((row) => ({
        id: row.id,
        name: String(row.name || 'Money book'),
      })));
    }).catch(() => undefined);
  }, [currentUser?.uid]);

  useEffect(() => {
    if (!activeBookId) {
      setActiveBookName('');
      return;
    }
    const hit = ledgers.find((row) => row.id === activeBookId);
    if (hit) {
      setActiveBookName(hit.name);
      return;
    }
    getLedger(activeBookId)
      .then((book) => setActiveBookName(String(book.name || 'Money book')))
      .catch(() => setActiveBookName('Money book'));
  }, [activeBookId, ledgers]);

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
      const target = event.target as Node;
      if (wrapRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
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

  const toggleOpen = () => {
    const next = !open;
    if (next && wrapRef.current) {
      const rect = wrapRef.current.getBoundingClientRect();
      const place = rect.bottom + 360 > window.innerHeight && rect.top > 280 ? 'above' : 'below';
      const width = Math.min(320, Math.max(rect.width, 260));
      const left = Math.min(Math.max(8, rect.left), window.innerWidth - width - 8);
      setMenuPos({
        top: place === 'below' ? rect.bottom + 8 : Math.max(8, rect.top - 8),
        left,
        width,
        place,
      });
    }
    setOpen(next);
  };

  const menu = open && typeof document !== 'undefined'
    ? createPortal(
      <div
        ref={menuRef}
        className="fixed z-[140] p-2 max-h-[min(28rem,70vh)] overflow-y-auto bg-white border border-slate-200 rounded-[22px] shadow-[0_28px_64px_-16px_rgba(11,31,58,0.38)]"
        style={{
          top: menuPos.place === 'below' ? menuPos.top : undefined,
          bottom: menuPos.place === 'above' ? window.innerHeight - menuPos.top : undefined,
          left: menuPos.left,
          width: menuPos.width,
        }}
      >
        <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Switch to</p>
        <Link to="/" className="flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-slate-50 text-sm font-medium text-slate-700">
          <LayoutDashboard className="w-4 h-4" />
          Home
          {location.pathname === '/' && <Check className="w-3.5 h-3.5 ml-auto text-teal-600" />}
        </Link>
        {hasFeature('business') && onBooks && (
        <>
        <p className="px-2 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Business companies</p>
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
        </>
        )}
        {hasFeature('money') && (onExpenses || location.pathname === '/') && (
        <>
        <Link to="/expenses" className="flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-slate-50 text-sm font-medium text-slate-700">
          <Receipt className="w-4 h-4" />
          All money books
          {location.pathname === '/expenses' && <Check className="w-3.5 h-3.5 ml-auto text-teal-600" />}
        </Link>
        {ledgers.length > 0 && (
          <>
            <p className="px-2 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Your money books</p>
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
        </>
        )}
      </div>,
      document.body,
    )
    : null;

  return (
    <div ref={wrapRef} className={`relative ${header ? '' : 'mb-2'}`}>
      <button
        type="button"
        onClick={toggleOpen}
        title="Switch workspace"
        className={header
          ? 'inline-flex items-center gap-2 h-10 max-w-[14rem] pl-1.5 pr-2.5 rounded-xl border border-slate-200 bg-white text-left hover:bg-slate-50'
          : 'w-full flex items-center gap-2 px-2 py-2 rounded-xl bg-[#F4F7FB] border border-slate-200 text-left hover:bg-white'}
      >
        <span className="w-8 h-8 rounded-lg bg-[#F4F7FB] border border-slate-200 text-[#0B1F3A] flex items-center justify-center shrink-0">
          <Building2 className="w-4 h-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">{activeBook ? 'Money book' : 'Workspace'}</span>
          <span className="block text-[12px] font-semibold text-[#0B1F3A] truncate">{currentLabel}</span>
        </span>
        <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {menu}
    </div>
  );
}

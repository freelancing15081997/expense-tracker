import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { ChevronRight, Search, X } from 'lucide-react';
import { branchByPath, moduleByPath } from '../catalog/modules';
import { useFeatures } from '../../lib/use-features';
import { useBooks } from '../context/BooksProvider';
import { BooksPageMode, FeatureIcon } from '../ui';
import CommandPalette from '../ui/CommandPalette';

function itemActive(pathname: string, href: string) {
  return pathname === href || (href !== '/books' && pathname.startsWith(`${href}/`));
}

function BooksNav({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  const current = branchByPath(pathname);
  const [openId, setOpenId] = useState(current.id);
  const { tree } = useFeatures();

  useEffect(() => {
    setOpenId(current.id);
  }, [current.id]);

  return (
    <nav className="space-y-5 px-3 pb-8">
      {tree.map((branch) => {
        const open = openId === branch.id;
        return (
          <section key={branch.id}>
            <button
              type="button"
              className="w-full flex items-center justify-between px-2 mb-2"
              onClick={() => setOpenId((id) => (id === branch.id ? '' : branch.id))}
            >
              <span className="text-[12px] font-semibold tracking-[0.04em] uppercase text-[#6e6e73]">{branch.name}</span>
              <ChevronRight className={`w-3.5 h-3.5 text-[#c7c7cc] transition-transform ${open ? 'rotate-90' : ''}`} />
            </button>
            {open && (
              <div className="ios-group">
                {branch.items.map((item) => {
                  const active = itemActive(pathname, item.href);
                  return (
                    <Link
                      key={item.href}
                      to={item.href}
                      title={`${item.name} â€” ${branch.blurb}`}
                      onClick={onNavigate}
                      className={`ios-row !min-h-[44px] !py-2 ${active ? 'bg-[#EEF2F6]' : ''}`}
                    >
                      <span className={`ios-glyph !w-7 !h-7 !rounded-lg ${active ? '' : '!bg-[#e8eaed] !text-[#0B0F1F]'}`}>
                        <FeatureIcon href={item.href} className="w-3.5 h-3.5" />
                      </span>
                      <span className={`text-[15px] tracking-tight truncate ${active ? 'font-semibold text-[#0B0F1F]' : 'font-medium text-[#3a3a3c]'}`}>
                        {item.name}
                      </span>
                      <ChevronRight className="ios-chevron w-4 h-4" />
                    </Link>
                  );
                })}
              </div>
            )}
          </section>
        );
      })}
    </nav>
  );
}

export default function BooksShell({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const { tenant } = useBooks();
  const { allowsHref } = useFeatures();
  const module = moduleByPath(location.pathname);
  const current = branchByPath(location.pathname);
  const [browse, setBrowse] = useState(false);

  useEffect(() => {
    setBrowse(false);
  }, [location.pathname]);

  if (!allowsHref(location.pathname)) {
    return <Navigate to={allowsHref('/books') ? '/books' : '/'} replace />;
  }

  return (
    <div className="books-root h-full min-h-0 flex overflow-hidden text-[#0B0F1F]">
      <aside className="books-aside hidden lg:flex">
        <div className="px-4 pt-4 pb-3">
          <p className="text-[11px] font-semibold tracking-[0.16em] uppercase text-[#8e8e93]">Business</p>
          <p className="mt-1 text-[17px] font-semibold tracking-tight truncate">{tenant?.name || 'Company'}</p>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto">
          <BooksNav pathname={location.pathname} />
        </div>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
        <header className="books-chrome shrink-0 z-30 px-4 md:px-5 min-h-14 py-2 flex items-center gap-3">
          <button
            type="button"
            className="lg:hidden w-10 h-10 rounded-[12px] bg-white/70 border border-white/70 text-[#0B0F1F] flex items-center justify-center"
            onClick={() => setBrowse(true)}
            aria-label="Open business menu"
          >
            <FeatureIcon href={module.href} className="w-5 h-5" />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-[20px] font-semibold tracking-[-0.03em] truncate">{module.name}</h1>
            <p className="text-[12px] text-[#8e8e93] truncate">{tenant?.name || 'Business'} Â· {current.name}</p>
          </div>
          <button
            type="button"
            className="hidden sm:inline-flex h-9 px-3 rounded-full bg-white/70 border border-white/70 text-[13px] font-semibold text-[#3a3a3c] items-center gap-1.5"
            onClick={() => window.dispatchEvent(new Event('byjan:books-search'))}
          >
            <Search className="w-3.5 h-3.5" />
            Search
          </button>
        </header>
        <div className="flex-1 min-h-0 overflow-hidden">
          <BooksPageMode embedded>{children}</BooksPageMode>
        </div>
      </div>

      {browse && typeof document !== 'undefined' && createPortal(
        <>
          <div className="fixed inset-0 z-[72] bg-[#3654FF]/35 backdrop-blur-[6px] lg:hidden" onClick={() => setBrowse(false)} />
          <aside className="books-aside books-aside-sheet lg:hidden">
            <div className="flex items-center justify-between px-4 pt-4 pb-2">
              <div>
                <p className="text-[11px] font-semibold tracking-[0.16em] uppercase text-[#8e8e93]">Business</p>
                <p className="mt-1 text-[17px] font-semibold tracking-tight">{tenant?.name || 'Workspace'}</p>
              </div>
              <button type="button" className="w-9 h-9 rounded-full bg-white/80 text-[#3a3a3c]" onClick={() => setBrowse(false)} aria-label="Close">
                <X className="w-4 h-4 mx-auto" />
              </button>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto pt-2">
              <BooksNav pathname={location.pathname} onNavigate={() => setBrowse(false)} />
            </div>
          </aside>
        </>,
        document.body,
      )}
      <CommandPalette />
    </div>
  );
}

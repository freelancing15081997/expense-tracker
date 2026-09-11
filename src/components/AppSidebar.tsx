import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowRightLeft, BookOpen, ChevronRight, LayoutDashboard, LogOut, Settings } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import BrandLogo from './BrandLogo';
import { BOOKS_NAV, BOOKS_QUICK_CREATE } from '../books/nav';
import { FeatureIcon, GroupIcon } from '../books/ui/icons';
import type { BooksTenantMeta } from '../lib/tenant';
import type { UserProfile } from '../context/AuthContext';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type AppSidebarProps = {
  expanded: boolean;
  tenant: BooksTenantMeta | null;
  userProfile: UserProfile | null;
  onLogout: () => void;
};

function iconWell(active: boolean) {
  return cn(
    'w-10 h-10 rounded-[14px] flex items-center justify-center shrink-0 border transition-colors duration-150',
    active
      ? 'bg-[#0B1F3A] text-white border-[#0B1F3A] shadow-[0_10px_18px_-10px_rgba(11,31,58,0.75)]'
      : 'bg-white text-slate-500 border-slate-200 group-hover:border-slate-300 group-hover:text-[#0B1F3A] group-hover:bg-[#F8FAFC]'
  );
}

export default function AppSidebar({ expanded, tenant, userProfile, onLogout }: AppSidebarProps) {
  const location = useLocation();
  const booksWrapRef = useRef<HTMLDivElement>(null);
  const [booksFlyout, setBooksFlyout] = useState(false);
  const [mobileBooks, setMobileBooks] = useState(location.pathname.startsWith('/books'));
  const [flyoutPos, setFlyoutPos] = useState({ top: 72, left: 84 });
  const closeTimer = useRef<number | null>(null);

  const onBooks = location.pathname === '/books' || location.pathname.startsWith('/books/');
  const onExpenses = location.pathname === '/expenses' || location.pathname.startsWith('/book/');
  const onHome = location.pathname === '/';
  const onSettings = location.pathname === '/settings';
  const showText = expanded;

  useEffect(() => {
    setMobileBooks(onBooks);
  }, [onBooks]);

  useEffect(() => {
    setBooksFlyout(false);
  }, [location.pathname]);

  useLayoutEffect(() => {
    if (!booksFlyout || !booksWrapRef.current) return;
    const rect = booksWrapRef.current.getBoundingClientRect();
    const height = Math.min(window.innerHeight - 24, 640);
    const top = Math.min(Math.max(12, rect.top - 16), window.innerHeight - height - 12);
    // Flush to the rail edge so the pointer never crosses a dead zone that closes the flyout.
    setFlyoutPos({ top, left: Math.round(rect.right) });
  }, [booksFlyout, expanded]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setBooksFlyout(false);
      }
    };
    const onClick = (event: MouseEvent) => {
      const node = event.target as Node;
      if (booksWrapRef.current && !booksWrapRef.current.contains(node)) {
        const flyout = document.getElementById('books-nav-flyout');
        if (!flyout?.contains(node)) setBooksFlyout(false);
      }
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('mousedown', onClick);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('mousedown', onClick);
    };
  }, []);

  const openBooksFlyout = () => {
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    setBooksFlyout(true);
  };
  const scheduleCloseBooks = () => {
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => setBooksFlyout(false), 180);
  };

  const initial = userProfile?.displayName?.charAt(0).toUpperCase() || userProfile?.email?.charAt(0).toUpperCase() || 'U';

  return (
    <>
      <Link
        to="/"
        title="Byjan home"
        className={cn(
          'group mx-2.5 mt-3 mb-3 flex items-center rounded-2xl bg-white border border-slate-200/80',
          showText ? 'gap-3 px-2 py-2' : 'justify-center p-1.5'
        )}
      >
        <BrandLogo size="sm" />
        {showText && (
          <div className="min-w-0">
            <p className="font-display font-semibold text-[17px] text-[#0B1F3A] tracking-[-0.03em] leading-none">Byjan</p>
            <p className="text-[11px] font-medium text-slate-500 mt-1.5 truncate tracking-wide">Trace Financials Easily</p>
          </div>
        )}
      </Link>

      <nav className="flex-1 overflow-y-auto overflow-x-visible px-2.5 pb-3 space-y-0.5">
        {showText && (
          <p className="px-2.5 pt-1 pb-2 text-[10px] font-semibold tracking-[0.18em] text-slate-400 uppercase">Menu</p>
        )}

        <Link
          to="/"
          title="Dashboard"
          className={cn('group flex items-center rounded-2xl', showText ? 'gap-3 px-1.5 py-1' : 'justify-center py-0.5')}
        >
          <span className={iconWell(onHome)}>
            <LayoutDashboard className="w-5 h-5" strokeWidth={2.2} />
          </span>
          {showText && <span className={cn('text-[13.5px] font-semibold tracking-[-0.01em]', onHome ? 'text-[#0B1F3A]' : 'text-slate-600')}>Dashboard</span>}
        </Link>

        <Link
          to="/expenses"
          title="Expense Tracker"
          className={cn('group flex items-center rounded-2xl', showText ? 'gap-3 px-1.5 py-1' : 'justify-center py-0.5')}
        >
          <span className={iconWell(onExpenses)}>
            <ArrowRightLeft className="w-5 h-5" strokeWidth={2.2} />
          </span>
          {showText && <span className={cn('text-[13.5px] font-semibold tracking-[-0.01em]', onExpenses ? 'text-[#0B1F3A]' : 'text-slate-600')}>Expense Tracker</span>}
        </Link>

        <div
          ref={booksWrapRef}
          className="relative"
          onMouseEnter={openBooksFlyout}
          onMouseLeave={scheduleCloseBooks}
        >
          <div className={cn('flex items-center', showText ? 'gap-1' : 'justify-center')}>
            <Link
              to="/books"
              title="Books"
              className={cn('group flex min-w-0 items-center rounded-2xl', showText ? 'flex-1 gap-3 px-1.5 py-1' : 'justify-center py-0.5')}
            >
              <span className={iconWell(onBooks)}>
                <BookOpen className="w-5 h-5" strokeWidth={2.2} />
              </span>
              {showText && <span className={cn('text-[13.5px] font-semibold truncate tracking-[-0.01em]', onBooks ? 'text-[#0B1F3A]' : 'text-slate-600')}>Books</span>}
            </Link>
            {showText && (
              <button
                type="button"
                className={cn(
                  'w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 transition-colors',
                  booksFlyout || mobileBooks || onBooks ? 'border-slate-300 bg-white text-[#0B1F3A]' : 'border-transparent text-slate-400 hover:border-slate-200 hover:bg-white'
                )}
                aria-label="Open Books menu"
                onClick={() => {
                  if (window.matchMedia('(min-width: 768px)').matches) setBooksFlyout((open) => !open);
                  else setMobileBooks((open) => !open);
                }}
              >
                <ChevronRight className={cn('w-4 h-4 transition-transform md:rotate-0', booksFlyout && 'md:rotate-90', mobileBooks && 'max-md:rotate-90')} />
              </button>
            )}
          </div>

          {showText && mobileBooks && (
            <div className="md:hidden mt-1 space-y-2 pl-1">
              {BOOKS_NAV.map((group) => (
                <div key={group.title}>
                  <p className="px-2 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">{group.title}</p>
                  <div className="space-y-1">
                    {group.items.map((item) => {
                      const active = location.pathname === item.href || location.pathname.startsWith(`${item.href}/`);
                      return (
                        <Link key={item.href} to={item.href} className="group flex items-center gap-2.5 px-1.5 py-1 rounded-xl">
                          <span className={cn(iconWell(active), 'w-8 h-8 rounded-lg')}>
                            <FeatureIcon href={item.href} className="w-4 h-4" />
                          </span>
                          <span className={cn('text-[13px] font-medium', active ? 'text-[#0B1F3A]' : 'text-slate-600')}>{item.name}</span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <Link
          to="/settings"
          title="Settings"
          className={cn('group flex items-center rounded-2xl', showText ? 'gap-3 px-1.5 py-1' : 'justify-center py-0.5')}
        >
          <span className={iconWell(onSettings)}>
            <Settings className="w-5 h-5" strokeWidth={2.2} />
          </span>
          {showText && <span className={cn('text-[13.5px] font-semibold tracking-[-0.01em]', onSettings ? 'text-[#0B1F3A]' : 'text-slate-600')}>Settings</span>}
        </Link>
      </nav>

      <div className="p-2 border-t border-slate-200/80 space-y-1.5">
        <div className={cn('flex items-center', showText ? 'gap-2 px-1.5' : 'justify-center')}>
          <span className="w-10 h-10 rounded-xl bg-[#0B1F3A] text-white flex items-center justify-center font-semibold text-sm shrink-0 overflow-hidden">
            {userProfile?.photoURL ? <img src={userProfile.photoURL} alt="" className="w-full h-full object-cover" /> : initial}
          </span>
          {showText && (
            <span className="min-w-0 flex-1 text-left">
              <span className="block text-sm font-semibold text-[#0B1F3A] truncate">{userProfile?.displayName || 'User'}</span>
              <span className="block text-[11px] text-slate-500 truncate">{userProfile?.email || 'Account'}</span>
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={onLogout}
          title="Sign out"
          className={cn(
            'w-full inline-flex items-center rounded-xl border border-rose-100 bg-rose-50 text-rose-700 text-sm font-semibold hover:bg-rose-100',
            showText ? 'justify-center gap-2 h-10' : 'justify-center h-10'
          )}
        >
          <LogOut className="w-4 h-4" />
          {showText && 'Sign out'}
        </button>
      </div>

      {booksFlyout && (
        <div
          id="books-nav-flyout"
          className="hidden md:block fixed z-[80] w-[min(560px,calc(100vw-96px))] max-h-[min(640px,calc(100vh-24px))] overflow-y-auto byjan-flyout p-4 pl-5 before:content-[''] before:absolute before:inset-y-0 before:-left-3 before:w-3"
          style={{ top: flyoutPos.top, left: flyoutPos.left }}
          onMouseEnter={openBooksFlyout}
          onMouseLeave={scheduleCloseBooks}
        >
          <div className="flex items-start justify-between gap-3 mb-4 pb-3 border-b border-slate-100">
            <div>
              <p className="font-display text-[17px] font-semibold tracking-[-0.02em] text-[#0B1F3A]">Books</p>
              <p className="text-[12px] text-slate-500 mt-0.5">{tenant?.name || 'Workspace'} · accounting, sales, and control</p>
            </div>
            <Link to="/books" className="h-9 px-3 rounded-xl bg-[#0B1F3A] text-white text-xs font-semibold inline-flex items-center">
              Open home
            </Link>
          </div>
          <div className="flex flex-wrap gap-2 mb-4">
            {BOOKS_QUICK_CREATE.map((item) => (
              <Link
                key={item.href}
                to={item.href}
                className="group inline-flex items-center gap-2 h-9 pl-1.5 pr-3 rounded-xl border border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
              >
                <span className={cn(iconWell(false), 'w-7 h-7 rounded-lg')}>
                  <FeatureIcon href={item.href} className="w-3.5 h-3.5" />
                </span>
                <span className="text-[12px] font-semibold text-slate-700">{item.name}</span>
              </Link>
            ))}
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            {BOOKS_NAV.map((group) => (
              <section key={group.title}>
                <p className="flex items-center gap-1.5 px-1 mb-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
                  <GroupIcon title={group.title} className="w-3.5 h-3.5" />
                  {group.title}
                </p>
                <div className="space-y-1">
                  {group.items.map((item) => {
                    const active = location.pathname === item.href || (item.href !== '/books' && location.pathname.startsWith(`${item.href}/`)) || location.pathname === item.href;
                    return (
                      <Link
                        key={item.href}
                        to={item.href}
                        className={cn(
                          'group flex items-center gap-2.5 px-1.5 py-1 rounded-xl border',
                          active ? 'bg-[#F4F7FB] border-slate-200' : 'border-transparent hover:bg-slate-50 hover:border-slate-200'
                        )}
                      >
                        <span className={cn(iconWell(active), 'w-8 h-8 rounded-lg')}>
                          <FeatureIcon href={item.href} className="w-4 h-4" />
                        </span>
                        <span className={cn('text-[13px] font-medium', active ? 'text-[#0B1F3A]' : 'text-slate-600')}>{item.name}</span>
                      </Link>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

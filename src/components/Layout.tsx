import React, { useState, useEffect } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { logout, db } from '../lib/firebase';
import { LogOut, Settings, Menu, X, Bell, CheckCircle2, ArrowRightLeft, ChevronDown, ChevronRight } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { collection, query, where, onSnapshot, updateDoc, doc } from 'firebase/firestore';
import BrandLogo from './BrandLogo';
import GlobalSearch, { SearchTrigger } from './GlobalSearch';
import { BOOKS_NAV } from '../books/nav';
import { FeatureIcon, GroupIcon, BooksGlyph } from '../books/ui/icons';
import { useBooksTenantMeta } from '../lib/tenant';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function Layout() {
  const { currentUser, userProfile } = useAuth();
  const location = useLocation();
  const tenant = useBooksTenantMeta();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isSidebarHovered, setIsSidebarHovered] = useState(false);
  const isExpanded = mobileMenuOpen || isSidebarHovered;
  const [booksOpen, setBooksOpen] = useState(location.pathname.startsWith('/books'));
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const [notificationsPanelOpen, setNotificationsPanelOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);

  const onBooks = location.pathname === '/books' || location.pathname.startsWith('/books/');
  const onExpenses = location.pathname === '/expenses' || location.pathname.startsWith('/book/');
  const onHome = location.pathname === '/';

  useEffect(() => {
    if (onBooks) setBooksOpen(true);
    const match = BOOKS_NAV.find((group) =>
      group.items.some((item) => location.pathname === item.href || location.pathname.startsWith(`${item.href}/`))
    );
    if (match) setOpenGroup(match.title);
  }, [onBooks, location.pathname]);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!currentUser) return;
    const q = query(collection(db, 'notifications'), where('userId', '==', currentUser.uid));
    const unsub = onSnapshot(q, (snap) => {
      const notifs: any[] = [];
      snap.forEach((d) => notifs.push({ id: d.id, ...d.data() }));
      const millis = (value: any) => {
        try {
          if (value && typeof value.toMillis === 'function') return value.toMillis();
        } catch { /* pending server timestamp */ }
        return 0;
      };
      notifs.sort((a, b) => millis(b.createdAt) - millis(a.createdAt));
      setNotifications(notifs);
    }, (err) => {
      console.error('Snapshot error on', q, err);
      if ((err as { code?: string }).code === 'resource-exhausted') unsub();
    });
    return () => unsub();
  }, [currentUser]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleMarkAsRead = async (id: string) => {
    try {
      await updateDoc(doc(db, 'notifications', id), { read: true });
    } catch (err) {
      console.error(err);
    }
  };

  const navBtn = (active: boolean) => cn('byjan-nav', active && 'byjan-nav-active');

  const showText = isExpanded;
  const sidebar = (
    <>
      <Link
        to="/"
        className={cn(
          'mx-3 mt-3 mb-2 flex items-center gap-3 rounded-[14px] px-3 py-3 byjan-lift border',
          onHome ? 'bg-[#EEF2F6] border-slate-200 shadow-[inset_0_1px_2px_rgba(11,31,58,0.08)]' : 'border-transparent hover:border-slate-200 hover:bg-white'
        )}
        title="Open main dashboard"
      >
        <BrandLogo size="sm" />
        {showText && (<div className="min-w-0 whitespace-nowrap">
          <p className="font-bold text-[17px] text-[#0B1F3A] tracking-tight leading-none">Byjan</p>
          <p className="text-[11px] text-slate-500 mt-1">Main dashboard</p>
        </div>)}
      </Link>

      <div className="px-3 mb-3 flex justify-center">
        {showText ? <SearchTrigger variant="sidebar" /> : <SearchTrigger variant="icon" />}
      </div>

      <nav className="flex-1 overflow-y-auto px-3 pb-4 space-y-1">
        {showText && <p className="text-[10px] font-bold tracking-widest text-slate-400 uppercase px-3 mb-1 whitespace-nowrap">Workspace</p>}

        <Link to="/expenses" className={navBtn(onExpenses)}>
          <ArrowRightLeft className="w-4 h-4 shrink-0" />
          {showText && <span className="whitespace-nowrap">Expense Tracker</span>}
        </Link>

        <div>
          <div className={cn('flex items-stretch rounded-xl', onBooks && 'bg-[#EEF2F6] shadow-[inset_0_1px_2px_rgba(11,31,58,0.08)]')}>
            <Link
              to="/books"
              className={cn(
                'flex-1 flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-l-xl',
                onBooks ? 'text-[#0B1F3A]' : 'text-slate-700 hover:bg-slate-50 rounded-xl'
              )}
            >
              <BooksGlyph name="book" className="w-4 h-4 shrink-0" />
              {showText && <span className="whitespace-nowrap">Books</span>}
            </Link>
            {showText && (
              <button
                type="button"
                aria-label={booksOpen ? 'Collapse Books menu' : 'Expand Books menu'}
                onClick={() => setBooksOpen((open) => !open)}
                className="px-2 rounded-r-xl text-slate-500 hover:text-[#0B1F3A]"
              >
                {booksOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>
            )}
          </div>

          {(booksOpen && showText) && (
            <div className="mt-1 ml-2 pl-3 border-l border-slate-200 space-y-0.5">
              {BOOKS_NAV.map((group) => {
                const groupOpen = openGroup === group.title;
                return (
                  <div 
                    key={group.title}
                    onMouseEnter={() => setOpenGroup(group.title)}
                    onMouseLeave={() => { if (!group.items.some(i => location.pathname === i.href || location.pathname.startsWith(i.href+'/'))) setOpenGroup(null); }}
                  >
                    <button
                      type="button"
                      onClick={() => setOpenGroup((current) => current === group.title ? null : group.title)}
                      className="w-full flex items-center justify-between px-2 py-1.5 rounded-xl text-[13px] font-semibold text-slate-600 hover:bg-slate-50 hover:text-[#0B1F3A] whitespace-nowrap"
                    >
                      <span className="flex items-center gap-2 min-w-0">
                        <GroupIcon title={group.title} className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">{group.title}</span>
                      </span>
                      <ChevronRight className={cn('w-3.5 h-3.5 text-slate-400 transition-transform shrink-0', groupOpen && 'rotate-90')} />
                    </button>
                    {groupOpen && (
                      <div className="mb-1 space-y-0.5">
                        {group.items.map((sub) => (
                          <Link
                            key={sub.href}
                            to={sub.href}
                            className={cn(
                              'byjan-subnav',
                              location.pathname === sub.href ? 'byjan-subnav-active' : ''
                            )}
                          >
                            <FeatureIcon href={sub.href} className="w-3.5 h-3.5 shrink-0" />
                            {sub.name}
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <Link to="/settings" className={navBtn(location.pathname === '/settings')}>
          <Settings className="w-4 h-4 shrink-0" />
          {showText && <span className="whitespace-nowrap">Settings</span>}
        </Link>
      </nav>

      <div className="p-3 border-t border-slate-200 space-y-2">
        {tenant && showText && (
          <div
            className="mx-1 px-2 py-0.5 rounded-full bg-[#EEF2F6] border border-slate-200 text-[10px] font-semibold text-[#0B1F3A] truncate"
            title={`${tenant.name} · erp_workspaces/${tenant.id}`}
          >
            {tenant.name}
          </div>
        )}
        <div>
          <div className="flex items-center gap-3 p-2 rounded-xl">
            <div className="w-8 h-8 rounded-full bg-[#0B1F3A] text-white flex items-center justify-center font-bold text-sm shrink-0 overflow-hidden shadow-[0_4px_10px_-4px_rgba(11,31,58,0.6)]">
              {userProfile?.photoURL ? (
                <img src={userProfile.photoURL} alt="" className="w-full h-full object-cover" />
              ) : (
                userProfile?.displayName?.charAt(0).toUpperCase() || userProfile?.email?.charAt(0).toUpperCase()
              )}
            </div>
            {showText && (<div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-[#0B1F3A] truncate whitespace-nowrap">{userProfile?.displayName || 'User'}</p>
              <p className="text-[10px] text-slate-500 truncate whitespace-nowrap">{userProfile?.email}</p>
            </div>)}
          </div>
          <button
            onClick={logout}
            title="Sign out"
            className="mt-1 w-full flex items-center gap-2 px-3 py-2 text-slate-600 hover:bg-rose-50 hover:text-rose-700 rounded-xl text-sm font-medium"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            {showText && <span className="whitespace-nowrap">Sign out</span>}
          </button>
        </div>
      </div>
    </>
  );

  return (
    <div className="h-screen w-full bg-[#F5F7FA] flex flex-col md:flex-row font-sans text-[#0F172A] overflow-hidden">
      <GlobalSearch />

      <div className="md:hidden bg-white border-b border-slate-200 flex items-center justify-between px-3 py-2.5 z-50">
        <Link to="/" className="flex items-center gap-2" title="Main dashboard">
          <BrandLogo size="sm" />
          <span className="font-bold text-slate-900">Byjan</span>
        </Link>
        <div className="flex items-center gap-1">
          <SearchTrigger />
          <button onClick={() => setNotificationsPanelOpen(true)} className="relative p-2 text-slate-600 hover:bg-slate-100 rounded-lg">
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full" />}
          </button>
          <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg">
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-40 bg-slate-900/40" onClick={() => setMobileMenuOpen(false)} />
      )}

      <aside
        onMouseEnter={() => setIsSidebarHovered(true)}
        onMouseLeave={() => setIsSidebarHovered(false)}
        className={cn(
          'byjan-rail fixed inset-y-0 left-0 z-50 flex flex-col md:relative md:translate-x-0 md:z-auto transition-all duration-300 overflow-hidden bg-white border-r border-slate-200',
          mobileMenuOpen ? 'translate-x-0 w-72' : '-translate-x-full md:translate-x-0',
          !mobileMenuOpen && (isSidebarHovered ? 'md:w-72 shadow-2xl md:shadow-none' : 'md:w-[72px]')
        )}
      >
        {sidebar}
      </aside>

      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <div className="hidden md:flex shrink-0 items-center gap-3 px-4 lg:px-6 py-2.5 bg-white border-b border-slate-200 shadow-[0_1px_0_rgba(11,31,58,0.04)]">
          <SearchTrigger variant="bar" />
          <button
            onClick={() => setNotificationsPanelOpen(true)}
            className="relative ml-auto p-2 text-slate-600 hover:bg-slate-100 rounded-lg"
            title="Notifications"
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full" />}
          </button>
        </div>
        <main className={cn(
          'flex-1 min-h-0',
          location.pathname.startsWith('/books')
            ? 'overflow-hidden flex flex-col'
            : 'overflow-y-auto p-4 md:p-6 lg:p-8'
        )}>
          <Outlet />
        </main>
      </div>

      {notificationsPanelOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
            onClick={() => setNotificationsPanelOpen(false)}
          />
          <div className="fixed inset-y-0 right-0 w-full max-w-sm bg-white z-50 flex flex-col shadow-[-12px_0_40px_-16px_rgba(11,31,58,0.28)]">
            <div className="p-4 border-b flex items-center justify-between bg-slate-50">
              <h2 className="font-semibold flex items-center gap-2 text-slate-800">
                <Bell className="w-4 h-4 text-slate-500" />
                Notifications
              </h2>
              <button onClick={() => setNotificationsPanelOpen(false)} className="p-1 text-slate-400 hover:text-slate-600 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/50">
              {notifications.length === 0 ? (
                <div className="text-center text-slate-400 text-sm py-8">No notifications yet.</div>
              ) : (
                notifications.map((notif) => (
                  <div
                    key={notif.id}
                    className={cn(
                      'p-3 rounded-lg border text-sm',
                      notif.read ? 'bg-white border-slate-200' : 'bg-indigo-50/50 border-indigo-200'
                    )}
                  >
                    <div className="flex justify-between items-start mb-1">
                      <span className="font-semibold text-slate-800">{notif.bookName}</span>
                      {!notif.read && (
                        <button onClick={() => handleMarkAsRead(notif.id)} className="text-indigo-600 hover:text-indigo-700" title="Mark as read">
                          <CheckCircle2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    <p className="text-slate-600"><span className="font-medium text-slate-700">{notif.senderName}</span> {notif.action.toLowerCase()}.</p>
                    <p className="text-slate-500 mt-1 text-xs">{notif.detail}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { logout, db } from '../lib/firebase';
import { Bell, CheckCircle2, Menu, X, Mail } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { collection, query, where, getDocs, updateDoc, doc } from '../lib/store';
import BrandLogo from './BrandLogo';
import GlobalSearch, { SearchTrigger } from './GlobalSearch';
import AppSidebar from './AppSidebar';
import WorkspaceSwitcher from './WorkspaceSwitcher';
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
  const [notificationsPanelOpen, setNotificationsPanelOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  const loadNotifications = () => {
    if (!currentUser) return;
    const q = query(collection(db, 'notifications'), where('userId', '==', currentUser.uid));
    getDocs(q, { force: true, kvMs: 5000 }).then((snap) => {
      const notifs: any[] = [];
      snap.forEach((d) => notifs.push({ id: d.id, ...d.data() }));
      const millis = (value: any) => {
        if (typeof value === 'string') {
          const parsed = Date.parse(value);
          return Number.isNaN(parsed) ? 0 : parsed;
        }
        try {
          if (value && typeof value.toMillis === 'function') return value.toMillis();
        } catch { /* pending server timestamp */ }
        return 0;
      };
      notifs.sort((a, b) => millis(b.createdAt) - millis(a.createdAt));
      setNotifications(notifs);
    }).catch((err) => {
      if ((err as { code?: string }).code !== 'resource-exhausted') console.error(err);
    });
  };

  useEffect(() => {
    loadNotifications();
  }, [currentUser?.uid]);

  const openNotifications = () => {
    setNotificationsPanelOpen(true);
    loadNotifications();
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleMarkAsRead = async (id: string) => {
    try {
      await updateDoc(doc(db, 'notifications', id), { read: true });
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="h-full w-full bg-[#F5F7FA] flex flex-col md:flex-row font-sans text-[#0F172A] overflow-hidden">
      <GlobalSearch />

      <div className="md:hidden bg-white border-b border-slate-200 flex items-center justify-between px-3 py-2.5 z-50">
        <Link to="/" className="flex items-center gap-2" title="Main dashboard">
          <BrandLogo size="sm" />
          <span className="font-bold text-slate-900">Byjan</span>
        </Link>
        <div className="flex items-center gap-1">
          <WorkspaceSwitcher variant="header" />
          <SearchTrigger />
          <button
            type="button"
            onClick={openNotifications}
            className="relative w-10 h-10 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 flex items-center justify-center"
            title="Notifications"
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full" />}
          </button>
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="w-10 h-10 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 flex items-center justify-center"
          >
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
          'byjan-rail fixed inset-y-0 left-0 z-50 flex flex-col md:relative md:translate-x-0 md:z-auto transition-[width,transform] duration-200 overflow-visible bg-[#FBFCFD] border-r border-slate-200',
          mobileMenuOpen ? 'translate-x-0 w-[280px]' : '-translate-x-full md:translate-x-0',
          !mobileMenuOpen && (isSidebarHovered ? 'md:w-[280px] shadow-2xl md:shadow-none' : 'md:w-[76px]')
        )}
      >
        <AppSidebar
          expanded={isExpanded}
          tenant={tenant}
          userProfile={userProfile}
          onLogout={logout}
        />
      </aside>

      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <div className="hidden md:flex relative z-30 shrink-0 items-center gap-3 px-5 h-14 bg-white border-b border-slate-200">
          <WorkspaceSwitcher variant="header" />
          <div className="flex-1 flex justify-center min-w-0">
            <div className="w-full max-w-2xl" data-open-search>
              <SearchTrigger variant="bar" />
            </div>
          </div>
          <button
            type="button"
            onClick={openNotifications}
            className="relative w-10 h-10 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 flex items-center justify-center shadow-[0_1px_2px_rgba(11,31,58,0.06)]"
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
                <Bell className="w-5 h-5 text-slate-500" />
                Notifications
              </h2>
              <button
                type="button"
                onClick={() => setNotificationsPanelOpen(false)}
                className="w-9 h-9 rounded-xl border border-slate-200 bg-white text-slate-500 hover:text-slate-700 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/50">
              {notifications.length === 0 ? (
                <div className="text-center text-slate-400 text-sm py-8">No notifications yet.</div>
              ) : (
                notifications.map((notif) => (
                    <Link
                      key={notif.id}
                      to={notif.bookId ? `/book/${notif.bookId}` : '#'}
                      onClick={() => {
                        setNotificationsPanelOpen(false);
                        if (!notif.read) void handleMarkAsRead(notif.id);
                      }}
                      className={cn(
                        'block p-3 rounded-xl border text-sm text-left',
                        notif.read ? 'bg-white border-slate-200 hover:border-slate-300' : 'bg-indigo-50/50 border-indigo-200 hover:border-indigo-300'
                      )}
                    >
                    <div className="flex justify-between items-start mb-1">
                      <span className="font-semibold text-slate-800 flex items-center gap-1.5">
                        {notif.kind === 'inbound' ? <Mail className="w-3.5 h-3.5 text-slate-400" /> : null}
                        {notif.bookName}
                      </span>
                      {!notif.read && (
                        <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); void handleMarkAsRead(notif.id); }} className="text-indigo-600 hover:text-indigo-700" title="Mark as read">
                          <CheckCircle2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    <p className="text-slate-600"><span className="font-medium text-slate-700">{notif.senderName}</span> {notif.action.toLowerCase()}.</p>
                    <p className="text-slate-500 mt-1 text-xs">{notif.detail}</p>
                    {notif.bookId ? <p className="text-indigo-600 mt-2 text-xs font-semibold">Open ledger →</p> : null}
                    </Link>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

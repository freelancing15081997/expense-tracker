import React, { useState, useEffect, useRef } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { logout } from '../lib/firebase';
import { Bell, CheckCircle2, X, Mail, LayoutDashboard, BookOpen, Settings, BookText } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { listNotifications, markNotificationRead } from '../lib/notifications';
import { warmSearchCatalog } from '../lib/search-catalog';
import BrandLogo from './BrandLogo';
import GlobalSearch, { SearchTrigger } from './GlobalSearch';
import AppSidebar from './AppSidebar';
import AccountMenu from './AccountMenu';
import WorkspaceSwitcher from './WorkspaceSwitcher';
import FeatureTour from './FeatureTour';
import { useBooksTenantMeta } from '../lib/tenant';
import { CapacitorService } from '../lib/capacitor';
import { useFeatures } from '../lib/use-features';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function Layout() {
  const { currentUser, userProfile } = useAuth();
  const { on: hasFeature } = useFeatures();
  const location = useLocation();
  const tenant = useBooksTenantMeta();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isSidebarHovered, setIsSidebarHovered] = useState(false);
  const [railPinned, setRailPinned] = useState(() => {
    try { return localStorage.getItem('byjan.rail.pin') === '1'; } catch { return false; }
  });
  const isExpanded = mobileMenuOpen || isSidebarHovered || railPinned;
  const toggleRailPin = () => {
    setRailPinned((curr) => {
      const next = !curr;
      try { localStorage.setItem('byjan.rail.pin', next ? '1' : '0'); } catch { /* ignore */ }
      if (!next) setIsSidebarHovered(false);
      return next;
    });
  };
  const [notificationsPanelOpen, setNotificationsPanelOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const knownNotifIds = useRef<Set<string>>(new Set());
  const notifReady = useRef(false);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    try {
      document.documentElement.dataset.privacy = localStorage.getItem('byjan.privacy') === '1' ? 'on' : '';
    } catch { /* ignore */ }
  }, []);

  const loadNotifications = (opts?: { silent?: boolean }) => {
    if (!currentUser) return;
    listNotifications().then((notifs) => {
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
      if (notifReady.current) {
        const fresh = notifs.filter((row) => row?.id && !row.read && !knownNotifIds.current.has(String(row.id)));
        if (fresh[0] && document.visibilityState === 'visible') {
          void CapacitorService.alertIncoming({
            title: String(fresh[0].bookName || 'Byjan'),
            body: `${fresh[0].senderName || 'Someone'} ${String(fresh[0].action || 'updated the book').toLowerCase()}`,
            bookId: String(fresh[0].bookId || ''),
            foreground: true,
          });
        }
      }
      knownNotifIds.current = new Set(notifs.map((row) => String(row.id || '')).filter(Boolean));
      notifReady.current = true;
      setNotifications(notifs);
    }).catch((err) => {
      if ((err as { code?: string }).code !== 'resource-exhausted') console.error(err);
    });
  };

  useEffect(() => {
    notifReady.current = false;
    knownNotifIds.current = new Set();
    loadNotifications();
    // Slight delay so Dashboard owns the first listAll call; catalog reuses the cache/inflight.
    let warmTimer = 0;
    if (currentUser?.uid) {
      warmTimer = window.setTimeout(() => { void warmSearchCatalog(currentUser.uid); }, 600);
    }
    if (!currentUser?.uid) return;
    const tick = window.setInterval(() => {
      if (document.visibilityState === 'visible') loadNotifications({ silent: true });
    }, 12000);
    const onVis = () => {
      if (document.visibilityState === 'visible') loadNotifications({ silent: true });
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      if (warmTimer) window.clearTimeout(warmTimer);
      window.clearInterval(tick);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [currentUser?.uid]);

  const openNotifications = () => {
    void CapacitorService.hapticTick();
    setNotificationsPanelOpen(true);
    loadNotifications();
  };

  const unreadCount = notifications.filter((n) => !n.read).length;
  const onHome = location.pathname === '/';
  const onBooks = location.pathname.startsWith('/books');
  const onSettings = location.pathname === '/settings';
  const onLedger = location.pathname.startsWith('/book/');
  const onLedgers = location.pathname === '/expenses' || onLedger;

  const handleMarkAsRead = async (id: string) => {
    try {
      await markNotificationRead(id);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="h-full w-full flex flex-col md:flex-row font-sans text-[#0F172A] overflow-hidden bg-transparent">
      <GlobalSearch />

      <div className="md:hidden bg-white border-b border-slate-200/80 flex items-center justify-between px-3 py-2.5 z-[80] pt-[max(0.6rem,env(safe-area-inset-top))]">
        <Link to="/" className="flex items-center gap-2.5" title="Home">
          <BrandLogo size="sm" className="!w-10 !h-10" />
          <span className="font-display font-semibold text-[17px] text-[#0B1F3A] tracking-tight">Byjan</span>
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
            {unreadCount > 0 && <span className="ios-notify-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>}
          </button>
          <AccountMenu />
        </div>
      </div>

      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-40 bg-slate-900/40" onClick={() => setMobileMenuOpen(false)} />
      )}

      <aside
        onMouseEnter={() => setIsSidebarHovered(true)}
        onMouseLeave={() => setIsSidebarHovered(false)}
        className={cn(
          'byjan-rail z-50 flex flex-col shrink-0 border-r border-white/50 bg-[#FBFCFD]/80 backdrop-blur-xl transition-[width] duration-200 overflow-y-auto overflow-x-visible',
          mobileMenuOpen ? 'fixed inset-y-0 left-0 w-[280px] translate-x-0' : 'fixed inset-y-0 left-0 -translate-x-full md:relative md:translate-x-0 md:transform-none',
          isExpanded ? 'md:w-[240px]' : 'md:w-[76px]'
        )}
      >
        <AppSidebar
          expanded={isExpanded}
          pinned={railPinned}
          tenant={tenant}
          userProfile={userProfile}
          onLogout={logout}
          onTogglePin={toggleRailPin}
        />
      </aside>

      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <div className="hidden md:flex relative z-[80] shrink-0 items-center gap-3 px-5 h-14 bg-white border-b border-slate-200">
          <WorkspaceSwitcher variant="header" />
          <div className="flex-1 flex justify-center min-w-0">
            <div className="w-full max-w-2xl">
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
            {unreadCount > 0 && <span className="ios-notify-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>}
          </button>
          <AccountMenu />
        </div>
        <main className={cn(
          'flex-1 min-h-0 ios-page',
          location.pathname.startsWith('/book')
            ? 'overflow-hidden flex flex-col pb-[calc(4.75rem+env(safe-area-inset-bottom))] md:pb-0'
            : 'overflow-y-auto p-3 md:p-6 lg:p-8 pb-[calc(5.25rem+env(safe-area-inset-bottom))] md:pb-8'
        )}>
          <Outlet />
        </main>
      </div>

      <FeatureTour />

      {notificationsPanelOpen && (
        <>
          <div
            className="ios-sheet-dim"
            onClick={() => setNotificationsPanelOpen(false)}
          />
          <div className="ios-notify-sheet">
            <div className="ios-notify-handle" aria-hidden />
            <div className="ios-notify-head">
              <div>
                <p className="ios-notify-kicker">Inbox</p>
                <h2 className="ios-notify-title">Notifications</h2>
              </div>
              <button
                type="button"
                onClick={() => setNotificationsPanelOpen(false)}
                className="ios-notify-close"
                aria-label="Close notifications"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="ios-notify-list">
              {notifications.length === 0 ? (
                <div className="ios-notify-empty">No alerts yet. When a teammate adds an entry, it rings here.</div>
              ) : (
                notifications.map((notif) => (
                    <Link
                      key={notif.id}
                      to={notif.bookId ? `/book/${notif.bookId}` : '#'}
                      onClick={() => {
                        void CapacitorService.hapticTick();
                        setNotificationsPanelOpen(false);
                        if (!notif.read) void handleMarkAsRead(notif.id);
                      }}
                      className={cn('ios-notify-row', !notif.read && 'is-unread')}
                    >
                    <span className="ios-notify-glyph">
                      {notif.kind === 'inbound' ? <Mail className="w-4 h-4" /> : <Bell className="w-4 h-4" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="ios-notify-book">{notif.bookName || 'Money book'}</span>
                      <span className="ios-notify-copy"><b>{notif.senderName || 'Someone'}</b> {String(notif.action || 'updated the book').toLowerCase()}.</span>
                      {notif.detail ? <span className="ios-notify-detail">{notif.detail}</span> : null}
                    </span>
                    {!notif.read && (
                      <button type="button" className="ios-notify-read" onClick={(e) => { e.preventDefault(); e.stopPropagation(); void handleMarkAsRead(notif.id); }} title="Mark as read">
                        <CheckCircle2 className="w-4 h-4" />
                      </button>
                    )}
                    </Link>
                ))
              )}
            </div>
          </div>
        </>
      )}

      <nav className="dash-tabbar md:hidden" aria-label="Primary">
        <Link to="/" className="dash-tab" data-on={onHome} onClick={() => void CapacitorService.hapticTick()}>
          <LayoutDashboard className="w-5 h-5" />
          Home
        </Link>
        {hasFeature('money') && (
          <Link to="/expenses" className="dash-tab" data-on={onLedgers} onClick={() => void CapacitorService.hapticTick()}>
            <BookText className="w-5 h-5" />
            Money
          </Link>
        )}
        {hasFeature('business') && (
          <Link to="/books" className="dash-tab" data-on={onBooks} onClick={() => void CapacitorService.hapticTick()}>
            <BookOpen className="w-5 h-5" />
            Business
          </Link>
        )}
        <Link to="/settings" className="dash-tab" data-on={onSettings} onClick={() => void CapacitorService.hapticTick()}>
          <Settings className="w-5 h-5" />
          Settings
        </Link>
      </nav>
    </div>
  );
}

import React, { useState, useEffect, useRef } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { logout } from '../lib/firebase';
import { Bell, CheckCircle2, X, LayoutDashboard, Settings, BookText, Plus, ScanLine, PenLine, Mic, Activity } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { listNotifications, markNotificationRead, notificationPath, notifyTimeAgo } from '../lib/notifications';
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

const MotionLink = motion.create(Link);
const tabSpring = { type: 'spring' as const, stiffness: 520, damping: 28, mass: 0.7 };
const fabMenuSpring = { type: 'spring' as const, stiffness: 420, damping: 24 };

export default function Layout() {
  const { currentUser, userProfile } = useAuth();
  const { on: hasFeature } = useFeatures();
  const location = useLocation();
  const navigate = useNavigate();
  const tenant = useBooksTenantMeta();
  const reduceMotion = useReducedMotion();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [fabOpen, setFabOpen] = useState(false);
  const [navPulse, setNavPulse] = useState(0);

  const pulseNav = () => {
    void CapacitorService.hapticTick();
    setNavPulse((n) => n + 1);
  };

  // Quick actions from the raised center button. Dashboard and BookView listen.
  const fireQuickAction = (kind: 'scan' | 'add' | 'voice') => {
    void CapacitorService.hapticTick();
    setFabOpen(false);
    const path = location.pathname;
    const handledHere = path === '/' || path === '/expenses' || path.startsWith('/book/');
    if (handledHere) {
      window.dispatchEvent(new CustomEvent('byjan-quick', { detail: kind }));
    } else {
      navigate('/');
      window.setTimeout(() => window.dispatchEvent(new CustomEvent('byjan-quick', { detail: kind })), 380);
    }
  };
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
    setFabOpen(false);
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
    }, 45000);
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
  const onSettings = location.pathname === '/settings' || location.pathname === '/help' || location.pathname.startsWith('/access');
  const onLedger = location.pathname.startsWith('/book/');
  const onLedgers = location.pathname === '/expenses' || onLedger;
  const onActivity = location.pathname === '/activity' || location.pathname === '/regular-payments' || location.pathname === '/reports';
  const canAdd = hasFeature('money_add');
  const canScan = hasFeature('money_scan');
  const canVoice = hasFeature('money_voice');
  const canNotify = hasFeature('app_notifications') && hasFeature('app_notifications_bell');
  const showFab = hasFeature('money') && (canAdd || canScan || canVoice);

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
          <span className="font-display font-semibold text-[17px] text-[#0B0F1F] tracking-tight">Byjan</span>
        </Link>
        <div className="flex items-center gap-1">
          <WorkspaceSwitcher variant="header" />
          {hasFeature('app_search') ? <SearchTrigger /> : null}
          {canNotify && (
          <button
            type="button"
            onClick={openNotifications}
            className="byjan-bell"
            title="Notifications"
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && <span className="ios-notify-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>}
          </button>
          )}
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
              {hasFeature('app_search') ? <SearchTrigger variant="bar" /> : null}
            </div>
          </div>
          {canNotify && (
          <button
            type="button"
            onClick={openNotifications}
            className="byjan-bell"
            title="Notifications"
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && <span className="ios-notify-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>}
          </button>
          )}
          <AccountMenu />
        </div>
        <main className={cn(
          'flex-1 min-h-0 ios-page',
          location.pathname.startsWith('/book')
            ? 'overflow-hidden flex flex-col pb-[calc(5.5rem+env(safe-area-inset-bottom))] md:pb-0'
            : 'overflow-y-auto p-3 md:p-6 lg:p-8 pb-[calc(8.5rem+env(safe-area-inset-bottom))] md:pb-8'
        )}>
          <div
            key={`${location.pathname}:${navPulse}`}
            className={reduceMotion ? undefined : 'nav-page-enter'}
            style={{ minHeight: '100%' }}
          >
            <Outlet />
          </div>
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
              <div className="notify-page-brand is-sheet">
                <img src="/logo.png" alt="" className="notify-byjan-mark" />
                <div>
                  <p className="ios-notify-kicker">Inbox</p>
                  <h2 className="ios-notify-title">Notifications</h2>
                </div>
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
                      to={notificationPath(notif)}
                      onClick={() => {
                        void CapacitorService.hapticTick();
                        setNotificationsPanelOpen(false);
                        if (!notif.read) void handleMarkAsRead(notif.id);
                      }}
                      className={cn('ios-notify-row', !notif.read && 'is-unread')}
                    >
                    <span className="ios-notify-glyph">
                      <img src="/logo.png" alt="" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="ios-notify-book">{notif.bookName || 'Byjan'}</span>
                      <span className="ios-notify-copy"><b>{notif.senderName || 'Someone'}</b> {String(notif.action || 'updated the book').toLowerCase()}.</span>
                      {notif.detail ? <span className="ios-notify-detail">{notif.detail}</span> : null}
                      <span className="notify-time">{notifyTimeAgo(String(notif.createdAt || ''))}</span>
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
            <Link
              to="/notifications"
              className="notify-see-all"
              onClick={() => setNotificationsPanelOpen(false)}
            >
              See all notifications
            </Link>
          </div>
        </>
      )}

      <AnimatePresence>
        {fabOpen && showFab && (
          <motion.div
            className="dash-fab-scrim md:hidden"
            initial={reduceMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setFabOpen(false)}
          />
        )}
      </AnimatePresence>

      <nav className={`dash-tabbar md:hidden${showFab ? ' has-fab' : ''}`} aria-label="Primary">
        <MotionLink to="/" className="dash-tab dash-tab-home" data-on={onHome} onClick={pulseNav} whileTap={reduceMotion ? undefined : { scale: 0.9, rotateX: 16 }} transition={tabSpring} style={{ transformPerspective: 700 }}>
          <LayoutDashboard className="w-5 h-5" />
          Home
        </MotionLink>
        {hasFeature('money') && (
          <MotionLink to="/expenses" className="dash-tab dash-tab-books" data-on={onLedgers} onClick={pulseNav} whileTap={reduceMotion ? undefined : { scale: 0.9, rotateX: 16 }} transition={tabSpring} style={{ transformPerspective: 700 }}>
            <BookText className="w-5 h-5" />
            Books
          </MotionLink>
        )}
        {showFab ? <span className="dash-fab-slot" aria-hidden /> : null}
        {hasFeature('money') && hasFeature('money_activity') && (
          <MotionLink to="/activity" className="dash-tab dash-tab-activity" data-on={onActivity} onClick={pulseNav} whileTap={reduceMotion ? undefined : { scale: 0.9, rotateX: 16 }} transition={tabSpring} style={{ transformPerspective: 700 }}>
            <Activity className="w-5 h-5" />
            Activity
          </MotionLink>
        )}
        <MotionLink to="/settings" className="dash-tab dash-tab-more" data-on={onSettings} onClick={pulseNav} whileTap={reduceMotion ? undefined : { scale: 0.9, rotateX: 16 }} transition={tabSpring} style={{ transformPerspective: 700 }}>
          <Settings className="w-5 h-5" />
          More
        </MotionLink>
        {showFab && (
          <div className="dash-fab-anchor">
            <button
              type="button"
              className="dash-fab-center"
              data-open={fabOpen}
              aria-label={fabOpen ? 'Close quick actions' : 'Quick actions'}
              aria-expanded={fabOpen}
              onClick={() => { pulseNav(); setFabOpen((v) => !v); }}
            >
              <Plus className="w-6 h-6" />
            </button>
            <AnimatePresence>
              {fabOpen && (
                <div className="dash-fab-orbit" role="menu" aria-label="Quick actions">
                  {canVoice && (
                    <motion.button
                      type="button"
                      className="dash-fab-item is-voice"
                      initial={reduceMotion ? false : { opacity: 0, x: 0, y: 0, scale: 0.35 }}
                      animate={{ opacity: 1, x: -78, y: -70, scale: 1 }}
                      exit={{ opacity: 0, x: 0, y: 0, scale: 0.35 }}
                      transition={{ ...fabMenuSpring, delay: 0.02 }}
                      onClick={() => fireQuickAction('voice')}
                    >
                      <span className="dash-fab-btn tone-rose"><Mic className="w-5 h-5" strokeWidth={2.4} /></span>
                      <span className="dash-fab-label">Voice</span>
                    </motion.button>
                  )}
                  {canAdd && (
                    <motion.button
                      type="button"
                      className="dash-fab-item is-add"
                      initial={reduceMotion ? false : { opacity: 0, x: 0, y: 0, scale: 0.35 }}
                      animate={{ opacity: 1, x: 0, y: -102, scale: 1 }}
                      exit={{ opacity: 0, x: 0, y: 0, scale: 0.35 }}
                      transition={{ ...fabMenuSpring, delay: 0.05 }}
                      onClick={() => fireQuickAction('add')}
                    >
                      <span className="dash-fab-btn tone-brand"><PenLine className="w-5 h-5" strokeWidth={2.4} /></span>
                      <span className="dash-fab-label">Add</span>
                    </motion.button>
                  )}
                  {canScan && (
                    <motion.button
                      type="button"
                      className="dash-fab-item is-scan"
                      initial={reduceMotion ? false : { opacity: 0, x: 0, y: 0, scale: 0.35 }}
                      animate={{ opacity: 1, x: 78, y: -70, scale: 1 }}
                      exit={{ opacity: 0, x: 0, y: 0, scale: 0.35 }}
                      transition={{ ...fabMenuSpring, delay: 0.08 }}
                      onClick={() => fireQuickAction('scan')}
                    >
                      <span className="dash-fab-btn tone-gold"><ScanLine className="w-5 h-5" strokeWidth={2.4} /></span>
                      <span className="dash-fab-label">Scan</span>
                    </motion.button>
                  )}
                </div>
              )}
            </AnimatePresence>
          </div>
        )}
      </nav>
    </div>
  );
}

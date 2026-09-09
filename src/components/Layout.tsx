import React, { useState, useEffect, useRef } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { logout, db } from '../lib/firebase';
import { LogOut, Settings, Menu, X, BookOpen, Bell, CheckCircle2, ChevronLeft, ChevronRight, ArrowRightLeft, ChevronRight as Chevron } from 'lucide-react';
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { collection, query, where, onSnapshot, updateDoc, doc } from 'firebase/firestore';
import BrandLogo from './BrandLogo';
import GlobalSearch, { SearchTrigger } from './GlobalSearch';
import { BOOKS_NAV } from '../books/nav';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function Layout() {
  const { currentUser, userProfile } = useAuth();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  const [isSidebarHovered, setIsSidebarHovered] = useState(false);
  const [hoveredMenu, setHoveredMenu] = useState<string | null>(null);
  const [hoveredGroup, setHoveredGroup] = useState<string | null>(null);
  const [mobileExpandedMenu, setMobileExpandedMenu] = useState<string | null>(null);
  const [mobileGroup, setMobileGroup] = useState<string | null>(null);
  const [notificationsPanelOpen, setNotificationsPanelOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const collapseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flyoutTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const booksRowRef = useRef<HTMLDivElement>(null);
  const [flyoutPos, setFlyoutPos] = useState({ top: 160, left: 288 });

  const isExpanded = mobileMenuOpen || isPinned || isSidebarHovered;
  const onBooks = location.pathname === '/books' || location.pathname.startsWith('/books/');

  const handleSidebarEnter = () => {
    if (collapseTimer.current) {
      clearTimeout(collapseTimer.current);
      collapseTimer.current = null;
    }
    setIsSidebarHovered(true);
  };

  const handleSidebarLeave = () => {
    collapseTimer.current = setTimeout(() => {
      setIsSidebarHovered(false);
      setHoveredMenu(null);
      setHoveredGroup(null);
    }, 80);
  };

  useEffect(() => {
    return () => {
      if (collapseTimer.current) clearTimeout(collapseTimer.current);
      if (flyoutTimer.current) clearTimeout(flyoutTimer.current);
    };
  }, []);

  useEffect(() => {
    if (!currentUser) return;
    const q = query(collection(db, 'notifications'), where('userId', '==', currentUser.uid));
    const unsub = onSnapshot(q, (snap) => {
      const notifs: any[] = [];
      snap.forEach(d => notifs.push({ id: d.id, ...d.data() }));
      const millis = (value: any) => {
        try {
          if (value && typeof value.toMillis === 'function') return value.toMillis();
        } catch { /* pending server timestamp */ }
        return 0;
      };
      notifs.sort((a, b) => millis(b.createdAt) - millis(a.createdAt));
      setNotifications(notifs);
    }, (err) => { console.error("Snapshot error on", q, err); });
    return () => unsub();
  }, [currentUser]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const handleMarkAsRead = async (id: string) => {
    try {
      await updateDoc(doc(db, 'notifications', id), { read: true });
    } catch (err) {
      console.error(err);
    }
  };

  const navigation = [
    { name: 'Expense Tracker', href: '/', icon: ArrowRightLeft },
    {
      name: 'Books',
      href: '/books',
      icon: BookOpen,
      groups: BOOKS_NAV,
    },
    { name: 'Notifications', href: '#', icon: Bell, isNotification: true },
    { name: 'Settings', href: '/settings', icon: Settings },
  ];

  const linkClass = (active: boolean) => cn(
    "nav-item-3d flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium text-sm",
    active ? "bg-white text-[#0B1F3A] shadow-sm" : "text-white hover:bg-white/15"
  );

  return (
    <div className="h-screen w-full bg-[#f4f7fb] flex flex-col md:flex-row font-sans text-slate-900 overflow-hidden">
      <GlobalSearch />

      <div className="md:hidden bg-[#0B1F3A] text-white flex items-center justify-between p-3 z-50">
        <div className="flex items-center gap-2 font-bold tracking-tight">
          <BrandLogo size="sm" />
          <span className="font-black text-lg">Byjan</span>
        </div>
        <div className="flex items-center gap-2">
          <SearchTrigger />
          <button onClick={() => setNotificationsPanelOpen(true)} className="relative p-2 text-white hover:bg-white/15 rounded-lg">
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && <span className="absolute top-1 right-1 w-2 h-2 bg-rose-500 rounded-full"></span>}
          </button>
          <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="p-2 text-white hover:bg-white/15 rounded-lg">
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      <div
        onMouseEnter={handleSidebarEnter}
        onMouseLeave={handleSidebarLeave}
        className={cn(
          "fixed inset-y-0 left-0 z-40 bg-[#0B1F3A] text-white transition-[width,transform] duration-150 ease-out md:relative md:h-screen flex flex-col shadow-2xl md:shadow-none will-change-[width]",
          mobileMenuOpen ? "translate-x-0 w-72" : "-translate-x-full md:translate-x-0",
          isExpanded ? "md:w-72" : "md:w-20"
        )}
      >
        <button
          onClick={() => setIsPinned(!isPinned)}
          className="hidden md:flex absolute -right-3 top-6 w-6 h-6 bg-white text-[#0B1F3A] hover:bg-teal-50 rounded-full items-center justify-center z-50 shadow border border-slate-200"
          title={isPinned ? "Unpin sidebar" : "Pin sidebar open"}
        >
          {isExpanded ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>

        <div className={cn("p-5 flex items-center", isExpanded ? "gap-3" : "justify-center")}>
          <BrandLogo size="sm" />
          {isExpanded && (
            <div className="min-w-0">
              <p className="font-bold text-xl text-white tracking-tight leading-none">Byjan</p>
              <p className="text-[11px] text-slate-200 tracking-wide mt-1">Trace Financials Easily</p>
            </div>
          )}
        </div>

        <div className="px-3 mb-4">
          {isExpanded ? <SearchTrigger variant="sidebar" /> : <div className="flex justify-center"><SearchTrigger variant="icon" /></div>}
        </div>

        <nav className="flex-1 overflow-y-auto overflow-x-visible px-3 space-y-1 pb-4">
          {isExpanded && <div className="text-[10px] font-bold tracking-widest text-slate-300 uppercase mb-2 ml-2">Main</div>}
          {navigation.map((item) => {
            const isSectionActive = item.groups
              ? onBooks
              : location.pathname === item.href || (location.pathname.startsWith('/book/') && item.href === '/');
            const mobileBooksOpen = Boolean(item.groups) && mobileMenuOpen && mobileExpandedMenu === item.name;

            return (
              <div
                key={item.name}
                ref={item.groups ? booksRowRef : undefined}
                className="relative"
                onMouseEnter={() => {
                  if (mobileMenuOpen) return;
                  if (flyoutTimer.current) clearTimeout(flyoutTimer.current);
                  setHoveredMenu(item.name);
                  if (!item.groups) setHoveredGroup(null);
                  if (item.groups && booksRowRef.current) {
                    const r = booksRowRef.current.getBoundingClientRect();
                    const width = 224;
                    const maxTop = window.innerHeight - 24 - 360;
                    setFlyoutPos({
                      top: Math.max(12, Math.min(r.top, maxTop)),
                      left: Math.min(r.right + 8, window.innerWidth - width - 12),
                    });
                  }
                }}
                onMouseLeave={() => {
                  if (mobileMenuOpen) return;
                  flyoutTimer.current = setTimeout(() => {
                    setHoveredMenu((current) => current === item.name ? null : current);
                    if (item.groups) setHoveredGroup(null);
                  }, 120);
                }}
              >
                <Link
                  to={item.isNotification ? '#' : item.href}
                  onClick={(e) => {
                    if (item.isNotification) {
                      e.preventDefault();
                      setNotificationsPanelOpen(true);
                    } else if (item.groups && mobileMenuOpen) {
                      e.preventDefault();
                      setMobileExpandedMenu((current) => current === item.name ? null : item.name);
                      setMobileGroup(null);
                    } else {
                      setMobileMenuOpen(false);
                    }
                  }}
                  className={linkClass(isSectionActive && !item.isNotification)}
                >
                  <item.icon className="w-5 h-5 shrink-0" />
                  {isExpanded && (
                    <div className="flex-1 flex justify-between items-center">
                      <span>{item.name}</span>
                      {item.groups && <Chevron className="w-4 h-4 opacity-70" />}
                      {item.isNotification && unreadCount > 0 && (
                        <span className="w-2 h-2 bg-rose-400 rounded-full"></span>
                      )}
                    </div>
                  )}
                </Link>

                {item.groups && mobileBooksOpen && (
                  <div className="mt-1 mb-2 space-y-1">
                    {item.groups.map((group) => (
                      <div key={group.title}>
                        <button
                          type="button"
                          className="w-full text-left px-3 py-2 rounded-lg text-sm font-semibold text-white bg-white/10"
                          onClick={() => setMobileGroup((current) => current === group.title ? null : group.title)}
                        >
                          {group.title}
                        </button>
                        {mobileGroup === group.title && (
                          <div className="mt-1 ml-2 space-y-0.5">
                            {group.items.map((sub) => (
                              <Link
                                key={sub.href}
                                to={sub.href}
                                onClick={() => setMobileMenuOpen(false)}
                                className={cn(
                                  "block px-3 py-2 rounded-lg text-sm font-medium",
                                  location.pathname === sub.href ? "bg-white text-[#0B1F3A]" : "text-white hover:bg-white/20"
                                )}
                              >
                                {sub.name}
                              </Link>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {item.groups && hoveredMenu === item.name && !mobileMenuOpen && (
                  <div
                    className="hidden md:block fixed z-[60] w-56 max-h-[min(22rem,calc(100vh-1.5rem))] overflow-y-auto rounded-xl bg-white text-slate-900 nav-flyout"
                    style={{ top: flyoutPos.top, left: flyoutPos.left }}
                    onMouseEnter={() => {
                      if (flyoutTimer.current) clearTimeout(flyoutTimer.current);
                      setHoveredMenu(item.name);
                      handleSidebarEnter();
                    }}
                    onMouseLeave={() => {
                      setHoveredGroup(null);
                      setHoveredMenu(null);
                    }}
                  >
                    <p className="px-3 pt-2.5 pb-1 text-[10px] uppercase tracking-widest text-teal-700 font-bold sticky top-0 bg-white">Books</p>
                    {item.groups.map((group) => (
                      <div
                        key={group.title}
                        onMouseEnter={() => setHoveredGroup(group.title)}
                      >
                        <div className={cn(
                          "flex items-center justify-between px-3 py-2 text-sm font-semibold",
                          hoveredGroup === group.title ? "bg-slate-100 text-[#0B1F3A]" : "text-slate-800"
                        )}>
                          {group.title}
                          <Chevron className={cn("w-3.5 h-3.5 text-slate-400 transition-transform", hoveredGroup === group.title && "rotate-90")} />
                        </div>
                        {hoveredGroup === group.title && (
                          <div className="pb-1">
                            {group.items.map((sub) => (
                              <Link
                                key={sub.href}
                                to={sub.href}
                                onClick={() => {
                                  setHoveredMenu(null);
                                  setHoveredGroup(null);
                                  setMobileMenuOpen(false);
                                }}
                                className={cn(
                                  "block mx-2 px-2.5 py-1.5 rounded-md text-[13px] font-medium",
                                  location.pathname === sub.href ? "bg-teal-50 text-teal-900" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                                )}
                              >
                                {sub.name}
                              </Link>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        <div className="p-3 mt-auto">
          <div className={cn("flex items-center bg-white/10 border border-white/15 rounded-xl cursor-pointer hover:bg-white/15 transition-colors relative group", isExpanded ? "p-3 gap-3" : "p-2 justify-center")}>
            <div className="w-8 h-8 rounded-full bg-white text-[#0B1F3A] flex items-center justify-center font-bold text-sm shrink-0 overflow-hidden">
              {userProfile?.photoURL ? (
                <img src={userProfile.photoURL} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                userProfile?.displayName?.charAt(0).toUpperCase() || userProfile?.email?.charAt(0).toUpperCase()
              )}
            </div>
            {isExpanded && (
              <>
                <div className="flex-1 overflow-hidden">
                  <p className="text-sm font-semibold text-white truncate">{userProfile?.displayName || 'User'}</p>
                  <p className="text-[10px] text-slate-200 font-medium truncate">{userProfile?.email}</p>
                </div>
              </>
            )}
            <div className="absolute bottom-full left-0 mb-2 w-full bg-white rounded-xl border border-slate-200 shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
              <button
                onClick={logout}
                className="w-full flex items-center gap-2 p-3 text-slate-800 hover:bg-slate-50 rounded-xl text-sm font-medium transition-colors"
              >
                <LogOut className="w-4 h-4" />
                {isExpanded && "Sign Out"}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <div className="hidden md:flex shrink-0 items-center gap-3 px-4 lg:px-6 py-2.5 bg-white border-b border-slate-200">
          <SearchTrigger variant="bar" />
          <button
            onClick={() => setNotificationsPanelOpen(true)}
            className="relative ml-auto p-2 text-slate-600 hover:bg-slate-100 rounded-lg"
            title="Notifications"
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full"></span>}
          </button>
        </div>
        <main className={cn(
          "flex-1 min-h-0",
          location.pathname.startsWith('/books')
            ? "overflow-hidden flex flex-col"
            : "overflow-y-auto p-4 md:p-6 lg:p-8"
        )}>
          <Outlet />
        </main>
      </div>

      {notificationsPanelOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 transition-opacity"
            onClick={() => setNotificationsPanelOpen(false)}
          />
          <div className="fixed inset-y-0 right-0 w-full max-w-sm bg-white shadow-2xl z-50 flex flex-col animate-in slide-in-from-right-8 duration-300">
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
                <div className="text-center text-slate-400 text-sm py-8">
                  No notifications yet.
                </div>
              ) : (
                notifications.map(notif => (
                  <div
                    key={notif.id}
                    className={cn(
                      "p-3 rounded-lg border text-sm transition-colors",
                      notif.read ? "bg-white border-slate-200" : "bg-indigo-50/50 border-indigo-200"
                    )}
                  >
                    <div className="flex justify-between items-start mb-1">
                      <span className="font-semibold text-slate-800">{notif.bookName}</span>
                      {!notif.read && (
                        <button
                          onClick={() => handleMarkAsRead(notif.id)}
                          className="text-indigo-600 hover:text-indigo-700"
                          title="Mark as read"
                        >
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

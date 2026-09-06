import React, { useState, useEffect, useRef } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { signOut, auth, db } from '../lib/firebase';
import { Wallet, LogOut, LayoutDashboard, Settings, Menu, X, Receipt, BookOpen, Bell, CheckCircle2, Search, FileText, CreditCard, ChevronLeft, ChevronRight, Plus, Users, ArrowRightLeft } from 'lucide-react';
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { collection, query, where, onSnapshot, updateDoc, doc } from 'firebase/firestore';
import BrandLogo from './BrandLogo';
import GlobalSearch from './GlobalSearch';
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
  const [mobileExpandedMenu, setMobileExpandedMenu] = useState<string | null>(null);
  const [notificationsPanelOpen, setNotificationsPanelOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const collapseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isExpanded = mobileMenuOpen || isPinned || isSidebarHovered;

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
    }, 120);
  };

  useEffect(() => {
    return () => {
      if (collapseTimer.current) clearTimeout(collapseTimer.current);
    };
  }, []);

  useEffect(() => {
    if (!currentUser) return;
    const q = query(collection(db, 'notifications'), where('userId', '==', currentUser.uid));
    const unsub = onSnapshot(q, (snap) => {
      const notifs: any[] = [];
      snap.forEach(d => notifs.push({ id: d.id, ...d.data() }));
      notifs.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
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

  

  return (
    <div className="h-screen w-full bg-[#f8f9fa] flex flex-col md:flex-row font-sans text-slate-900 overflow-hidden">
      {/* Mobile Header */}
      <div className="md:hidden bg-[#161616] text-white flex items-center justify-between p-3 z-50">
        <div className="flex items-center gap-2 font-bold tracking-tight">
          <BrandLogo size="sm" />
          <span className="font-black text-lg">Byjan</span>
        </div>
        <div className="flex items-center gap-2">
          <GlobalSearch />
          <button onClick={() => setNotificationsPanelOpen(true)} className="relative p-2 text-zinc-400 hover:text-white">
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && <span className="absolute top-1 right-1 w-2 h-2 bg-rose-500 rounded-full"></span>}
          </button>
          <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="p-2 text-zinc-400 hover:text-white">
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Sidebar Navigation */}
      <div
        onMouseEnter={handleSidebarEnter}
        onMouseLeave={handleSidebarLeave}
        className={cn(
        "fixed inset-y-0 left-0 z-40 bg-[#161616] text-[#8a8a8a] transition-all duration-300 ease-in-out md:relative md:h-screen flex flex-col shadow-2xl md:shadow-none",
        mobileMenuOpen ? "translate-x-0 w-64" : "-translate-x-full md:translate-x-0",
        isExpanded ? "md:w-64" : "md:w-20"
      )}>
        {/* Pin / collapse toggle */}
        <button 
          onClick={() => setIsPinned(!isPinned)}
          className="hidden md:flex absolute -right-3 top-6 w-6 h-6 bg-[#2a2a2a] text-[#8a8a8a] hover:text-white rounded-full items-center justify-center z-50"
          title={isPinned ? "Unpin sidebar" : "Pin sidebar open"}
        >
          {isExpanded ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>

        {/* Logo */}
        <div className={cn("p-6 flex items-center", isExpanded ? "gap-3" : "justify-center")}>
          <BrandLogo size="sm" />
          {isExpanded && (
            <div className="min-w-0">
              <p className="font-bold text-xl text-white tracking-tight leading-none">Byjan</p>
              <p className="text-[10px] text-[#8a8a8a] tracking-wide mt-1">Trace Financials Easily</p>
            </div>
          )}
        </div>

        {/* Search */}
        <div className="px-4 mb-6">
          <div className={cn("flex items-center bg-[#1f1f1f] rounded-xl border border-[#2a2a2a] transition-all", isExpanded ? "px-3 py-2.5 gap-2" : "p-3 justify-center")}>
            <Search className="w-4 h-4 text-[#8a8a8a]" />
            {isExpanded && (
              <>
                <input type="text" placeholder="Search" className="bg-transparent border-none outline-none text-sm text-white w-full placeholder:text-[#8a8a8a]" />
                <div className="flex items-center gap-1 bg-[#2a2a2a] px-1.5 py-0.5 rounded text-[10px] font-medium text-[#8a8a8a]">
                  <span>⌘</span>
                  <span>S</span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto scrollbar-none px-4 space-y-6">
          <div>
            {isExpanded && <div className="text-[10px] font-bold tracking-widest text-[#5a5a5a] uppercase mb-3 ml-2">Main</div>}
            <div className="space-y-1">
              {navigation.map((item) => {
                const isSectionActive = item.groups
                  ? location.pathname === item.href || location.pathname.startsWith(`${item.href}/`)
                  : location.pathname === item.href || (location.pathname.startsWith('/book/') && item.href === '/');
                const showSubItems = Boolean(item.groups) && isExpanded && (
                  mobileMenuOpen
                    ? mobileExpandedMenu === item.name
                    : hoveredMenu === item.name || isSectionActive
                );
                
                return (
                  <div
                    key={item.name}
                    className="relative"
                    onMouseEnter={() => setHoveredMenu(item.name)}
                    onMouseLeave={() => setHoveredMenu((current) => current === item.name ? null : current)}
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
                        } else {
                          setMobileMenuOpen(false);
                        }
                      }}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium text-sm transition-all duration-200 group",
                        isSectionActive && !item.isNotification ? "bg-[#2a2a2a] text-white" : "hover:bg-[#1f1f1f] hover:text-white text-[#8a8a8a]"
                      )}
                    >
                      <item.icon className={cn("w-5 h-5 shrink-0 transition-colors", isSectionActive && !item.isNotification ? "text-white" : "group-hover:text-white")} />
                      {isExpanded && (
                        <div className="flex-1 flex justify-between items-center">
                          {item.name}
                          {item.isNotification && unreadCount > 0 && (
                            <span className="w-2 h-2 bg-rose-500 rounded-full"></span>
                          )}
                        </div>
                      )}
                    </Link>
                    
                    {item.groups && (
                      <div className={cn('grid transition-[grid-template-rows] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]', showSubItems ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]')}>
                        <div className="overflow-hidden">
                          <div className="ml-5 mt-1 relative pb-1">
                            <div className="absolute left-[9px] top-0 bottom-4 w-px bg-[#2a2a2a]"></div>
                            {item.groups.map((group) => (
                              <div key={group.title || 'features'} className="mt-2">
                                {group.title ? <div className="ml-6 px-3 py-1 text-[10px] uppercase tracking-wider text-[#5a5a5a] font-bold">{group.title}</div> : null}
                                {group.items.map((sub) => {
                                  const isSubActive = location.pathname === sub.href;
                                  return (
                                    <div key={sub.href} className="relative flex items-center mt-0.5">
                                      <div className="absolute left-[9px] top-1/2 w-3 h-px bg-[#2a2a2a]"></div>
                                      <Link
                                        to={sub.href}
                                        onClick={() => setMobileMenuOpen(false)}
                                        className={cn(
                                          "ml-6 px-3 py-1.5 rounded-lg text-sm w-full transition-colors",
                                          isSubActive ? "bg-[#2a2a2a] text-white" : "text-[#8a8a8a] hover:text-white hover:bg-[#1f1f1f]"
                                        )}
                                      >
                                        {sub.name}
                                      </Link>
                                    </div>
                                  );
                                })}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </nav>

        {/* Profile */}
        <div className="p-4 mt-auto">
          <div className={cn("flex items-center bg-[#1f1f1f] border border-[#2a2a2a] rounded-xl cursor-pointer hover:bg-[#2a2a2a] transition-colors relative group", isExpanded ? "p-3 gap-3" : "p-2 justify-center")}>
            <div className="w-8 h-8 rounded-full bg-[#3a3a3a] text-white flex items-center justify-center font-bold text-sm shrink-0 overflow-hidden">
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
                  <p className="text-[10px] text-[#8a8a8a] font-medium uppercase tracking-wider truncate">Designer</p>
                </div>
                <ChevronRight className="w-4 h-4 text-[#5a5a5a]" />
              </>
            )}
            
            {/* Hover sign out menu (simple for now) */}
            <div className="absolute bottom-full left-0 mb-2 w-full bg-[#2a2a2a] rounded-xl border border-[#3a3a3a] shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
              <button 
                onClick={() => signOut(auth)}
                className="w-full flex items-center gap-2 p-3 text-white hover:bg-[#3a3a3a] rounded-xl text-sm font-medium transition-colors"
              >
                <LogOut className="w-4 h-4" />
                {isExpanded && "Sign Out"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <main className={cn(
          "flex-1 min-h-0",
          location.pathname.startsWith('/books')
            ? "overflow-hidden flex flex-col"
            : "overflow-y-auto p-4 md:p-6 lg:p-8"
        )}>
          <Outlet />
        </main>
      </div>

      {/* Notifications Panel */}
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

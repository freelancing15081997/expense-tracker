import React, { useState, useEffect } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { signOut, auth, db } from '../lib/firebase';
import { Wallet, LogOut, LayoutDashboard, Settings, Menu, X, Receipt, Bell, CheckCircle2 } from 'lucide-react';
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { collection, query, where, onSnapshot, updateDoc, doc } from 'firebase/firestore';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function Layout() {
  const { currentUser, userProfile } = useAuth();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notificationsPanelOpen, setNotificationsPanelOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);

  useEffect(() => {
    if (!currentUser) return;
    const q = query(collection(db, 'notifications'), where('userId', '==', currentUser.uid));
    const unsub = onSnapshot(q, (snap) => {
      const notifs: any[] = [];
      snap.forEach(d => notifs.push({ id: d.id, ...d.data() }));
      notifs.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
      setNotifications(notifs);
    });
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
    { name: 'Dashboard', href: '/', icon: LayoutDashboard },
    { name: 'Bookkeeping ERP', href: '/bookkeeping', icon: Receipt },
    { name: 'Settings', href: '/settings', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row font-sans text-slate-900">
      {/* Mobile Header */}
      <div className="md:hidden bg-slate-900 text-white flex items-center justify-between p-3 sticky top-0 z-50 border-b border-slate-800">
        <div className="flex items-center gap-2 font-bold tracking-tight">
          <div className="w-6 h-6 rounded-md bg-gradient-to-tr from-orange-600 to-amber-500 flex items-center justify-center">
            <Wallet className="w-3.5 h-3.5 text-white" />
          </div>
          <span>SET</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setNotificationsPanelOpen(true)} className="relative p-2 text-slate-300 hover:text-white">
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-orange-500 rounded-full"></span>
            )}
          </button>
          <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="p-2 text-slate-300 hover:text-white">
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Sidebar Navigation */}
      <div className={cn(
        "fixed inset-y-0 left-0 z-40 w-64 bg-slate-900 text-slate-300 transition-transform duration-300 ease-in-out md:translate-x-0 md:static md:flex md:flex-col border-r border-slate-800 shadow-xl",
        mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="p-6 hidden md:flex flex-col gap-1">
          <div className="flex items-center gap-2.5 font-bold text-xl text-white tracking-tight">
            <div className="w-7 h-7 rounded-md bg-gradient-to-tr from-orange-600 to-amber-500 flex items-center justify-center shadow-lg shadow-orange-500/20">
              <Wallet className="w-4 h-4 text-white" />
            </div>
            <span>SET App</span>
          </div>
          <p className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold ml-10">Secure Expense Tracker</p>
        </div>
        <nav className="flex-1 px-4 py-4 space-y-1.5">
          <div className="px-3 pb-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">Modules</div>
          {navigation.map((item) => {
            const isActive = location.pathname === item.href || (location.pathname.startsWith('/book/') && item.href === '/');
            return (
              <Link
                key={item.name}
                to={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium text-sm transition-all duration-200",
                  isActive ? "bg-orange-500/10 text-orange-400" : "hover:bg-slate-800/80 hover:text-slate-100"
                )}
              >
                <item.icon className={cn("w-4 h-4", isActive ? "text-orange-500" : "text-slate-400")} />
                {item.name}
              </Link>
            );
          })}
          
          <div className="mt-8 px-3 pb-2 pt-6 text-xs font-semibold text-slate-500 uppercase tracking-wider border-t border-slate-800/50">Actions</div>
          <button
            onClick={() => {
              setMobileMenuOpen(false);
              setNotificationsPanelOpen(true);
            }}
            className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg font-medium text-sm transition-colors hover:bg-slate-800/80 hover:text-slate-100"
          >
            <div className="flex items-center gap-3">
              <Bell className="w-4 h-4 text-slate-400" />
              Notifications
            </div>
            {unreadCount > 0 && (
              <span className="bg-orange-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full shadow-lg shadow-orange-500/20">
                {unreadCount}
              </span>
            )}
          </button>
        </nav>

        <div className="p-4 mt-auto border-t border-slate-800/80">
          <div className="flex items-center gap-2.5 px-3 py-2 rounded-md mb-1 border border-slate-800/50 bg-slate-800/20">
            <div className="w-7 h-7 rounded-full bg-orange-500/20 text-orange-500 flex items-center justify-center font-bold text-xs border border-orange-500/30">
              {userProfile?.displayName?.charAt(0).toUpperCase() || userProfile?.email?.charAt(0).toUpperCase()}
            </div>
            <div className="overflow-hidden flex-1">
              <p className="text-xs font-semibold text-white truncate">{userProfile?.displayName}</p>
              <p className="text-[10px] text-slate-400 truncate leading-tight">{userProfile?.email}</p>
            </div>
          </div>
          <button
            onClick={() => signOut(auth)}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-md transition-colors font-medium text-sm"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-h-screen overflow-hidden">
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>

      {/* Notifications Panel */}
      {notificationsPanelOpen && (
        <>
          <div 
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 transition-opacity" 
            onClick={() => setNotificationsPanelOpen(false)} 
          />
          <div className="fixed inset-y-0 right-0 w-full max-w-sm bg-white shadow-2xl z-50 flex flex-col animate-in slide-in-from-right-8 duration-300">
            <div className="p-4 border-b flex items-center justify-between bg-slate-50">
              <h2 className="font-semibold flex items-center gap-2">
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
                      notif.read ? "bg-white border-slate-200" : "bg-orange-50/50 border-orange-200"
                    )}
                  >
                    <div className="flex justify-between items-start mb-1">
                      <span className="font-semibold text-slate-800">{notif.bookName}</span>
                      {!notif.read && (
                        <button 
                          onClick={() => handleMarkAsRead(notif.id)}
                          className="text-orange-500 hover:text-orange-600"
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

      {/* Overlay for mobile menu */}
      {mobileMenuOpen && (
        <div 
           className="fixed inset-0 bg-black/60 z-30 md:hidden backdrop-blur-sm"
           onClick={() => setMobileMenuOpen(false)}
        />
      )}
    </div>
  );
}

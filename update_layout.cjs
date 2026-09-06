const fs = require('fs');
let content = fs.readFileSync('src/components/Layout.tsx', 'utf8');

// Update navigation
content = content.replace(
  /const navigation = \[[^\]]+\];/m,
  `const navigation = [
    { name: 'Dashboard', href: '/', icon: LayoutDashboard },
    { name: 'Expense Tracker', href: '/bookkeeping', icon: Receipt },
    { name: 'Settings', href: '/settings', icon: Settings },
  ];`
);

// Mobile Header Update
content = content.replace(
  /<div className="md:hidden bg-indigo-950 text-white flex items-center justify-between p-3 z-50 border-b border-indigo-900">([\s\S]*?)<\/div>\s*\{?\/\* Sidebar Navigation \*\/\}/,
  `<div className="md:hidden bg-white text-zinc-900 flex items-center justify-between p-3 z-50 border-b border-zinc-200">
        <div className="flex flex-col">
          <div className="flex items-center gap-2 font-bold tracking-tight">
            <div className="relative flex items-center justify-center w-6 h-6">
              <div className="absolute inset-0 bg-zinc-900 rounded-md rotate-45 transform opacity-10"></div>
              <div className="absolute inset-0 bg-zinc-800 rounded-md transform opacity-20 scale-90"></div>
              <Wallet className="w-3 h-3 text-zinc-900 z-10" />
            </div>
            <span className="font-black text-lg text-zinc-900 font-display">SET</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setNotificationsPanelOpen(true)} className="relative p-2 text-zinc-400 hover:text-zinc-900">
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full"></span>
            )}
          </button>
          <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="p-2 text-zinc-400 hover:text-zinc-900">
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>
      {/* Sidebar Navigation */}`
);

// Sidebar Update
const oldSidebar = `<div className={cn(
        "fixed inset-y-0 left-0 z-40 w-[240px] bg-indigo-950 text-indigo-100 transition-transform duration-300 ease-in-out md:sticky md:top-0 md:h-screen md:translate-x-0 md:flex md:flex-col border-r border-indigo-900 shadow-xl shadow-indigo-900/10",
        mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="p-5 hidden md:flex flex-col gap-1 border-b border-indigo-900/50 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-indigo-500/10 to-transparent pointer-events-none"></div>
          <div className="flex flex-col relative z-10">
            <div className="flex items-center gap-3 font-bold text-2xl text-white tracking-tight">
              <div className="relative flex items-center justify-center w-8 h-8">
                <div className="absolute inset-0 bg-indigo-500 rounded-lg rotate-45 transform opacity-30 shadow-lg shadow-indigo-500/30"></div>
                <div className="absolute inset-0 bg-indigo-400 rounded-lg transform opacity-50 scale-90"></div>
                <Wallet className="w-4 h-4 text-indigo-100 z-10" />
              </div>
              <span className="font-black text-xl tracking-tight text-white font-display">SET <span className="text-indigo-400 font-medium text-lg ml-0.5 font-sans">Books</span></span>
            </div>
            <p className="text-[9px] uppercase tracking-widest text-indigo-300/80 font-semibold mt-1.5 ml-11">Secure Expense Tracker</p>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 py-5 space-y-1.5 scrollbar-none">
          {navigation.map((item) => {
            const isActive = location.pathname === item.href || (location.pathname.startsWith('/book/') && item.href === '/');
            return (
              <Link
                key={item.name}
                to={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium text-sm transition-all duration-200 relative group",
                  isActive ? "bg-indigo-900/50 text-white" : "text-indigo-200 hover:bg-indigo-900/30 hover:text-white"
                )}
              >
                {isActive && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-indigo-400 rounded-r-full"></div>}
                <item.icon className={cn("w-4 h-4 transition-colors", isActive ? "text-indigo-300" : "text-indigo-400 group-hover:text-indigo-300")} />
                {item.name}
              </Link>
            );
          })}
          
          <div className="mt-6 px-3 pb-2 pt-6 text-[10px] font-bold text-indigo-300/60 uppercase tracking-wider border-t border-indigo-900/50">System</div>
          <button
            onClick={() => {
              setMobileMenuOpen(false);
              setNotificationsPanelOpen(true);
            }}
            className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg font-medium text-sm transition-colors text-indigo-200 hover:bg-indigo-900/30 hover:text-white group"
          >
            <div className="flex items-center gap-3">
              <Bell className="w-4 h-4 text-indigo-400 group-hover:text-indigo-300 transition-colors" />
              Notifications
            </div>
            {unreadCount > 0 && (
              <span className="bg-rose-500/20 text-rose-300 text-[10px] font-bold px-1.5 py-0.5 rounded-sm">
                {unreadCount}
              </span>
            )}
          </button>
        </nav>
        <div className="p-4 mt-auto border-t border-indigo-900/50 bg-indigo-950/50 relative">
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg mb-2 bg-indigo-900/40 border border-indigo-800/50 shadow-inner">
            <div className="w-8 h-8 rounded-md bg-indigo-800 text-indigo-100 flex items-center justify-center font-bold text-xs border border-indigo-700/50 shadow-sm">
              {userProfile?.displayName?.charAt(0).toUpperCase() || userProfile?.email?.charAt(0).toUpperCase()}
            </div>
            <div className="overflow-hidden flex-1">
              <p className="text-sm font-semibold text-indigo-50 truncate">{userProfile?.displayName}</p>
              <p className="text-[10px] text-indigo-300/80 truncate leading-tight mt-0.5">{userProfile?.email}</p>
            </div>
          </div>
          <button
            onClick={() => signOut(auth)}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-indigo-300 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors font-medium text-sm border border-transparent hover:border-rose-500/20"
          >
            <LogOut className="w-4 h-4" />
            <span className="font-semibold">Sign Out</span>
          </button>
        </div>
      </div>`;

const newSidebar = `<div className={cn(
        "fixed inset-y-0 left-0 z-40 w-[240px] bg-white text-zinc-600 transition-transform duration-300 ease-in-out md:sticky md:top-0 md:h-screen md:translate-x-0 md:flex md:flex-col border-r border-zinc-200 shadow-sm",
        mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="p-5 hidden md:flex flex-col gap-1 border-b border-zinc-100 bg-white">
          <div className="flex flex-col relative z-10">
            <div className="flex items-center gap-2.5 font-bold text-2xl text-zinc-900 tracking-tight">
              <div className="relative flex items-center justify-center w-8 h-8 rounded-lg shadow-sm border border-zinc-200 bg-zinc-50">
                <Wallet className="w-4 h-4 text-zinc-700 z-10" />
              </div>
              <span className="font-black text-xl tracking-tight text-zinc-900 font-display">SET</span>
            </div>
            <p className="text-[10px] uppercase tracking-widest text-zinc-400 font-semibold mt-1.5 ml-11">Secure Expense Tracker</p>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 py-5 space-y-1.5 scrollbar-none bg-zinc-50/30">
          {navigation.map((item) => {
            const isActive = location.pathname === item.href || (location.pathname.startsWith('/book/') && item.href === '/');
            return (
              <Link
                key={item.name}
                to={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium text-sm transition-all duration-200 relative group",
                  isActive ? "bg-white shadow-sm border border-zinc-200 text-zinc-900" : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 border border-transparent"
                )}
              >
                <item.icon className={cn("w-4 h-4 transition-colors", isActive ? "text-zinc-900" : "text-zinc-400 group-hover:text-zinc-600")} />
                {item.name}
              </Link>
            );
          })}
          
          <div className="mt-6 px-3 pb-2 pt-6 text-[10px] font-bold text-zinc-400 uppercase tracking-wider border-t border-zinc-100">System</div>
          <button
            onClick={() => {
              setMobileMenuOpen(false);
              setNotificationsPanelOpen(true);
            }}
            className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg font-medium text-sm transition-all duration-200 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 border border-transparent group"
          >
            <div className="flex items-center gap-3">
              <Bell className="w-4 h-4 text-zinc-400 group-hover:text-zinc-600 transition-colors" />
              Notifications
            </div>
            {unreadCount > 0 && (
              <span className="bg-rose-100 text-rose-600 text-[10px] font-bold px-1.5 py-0.5 rounded-sm">
                {unreadCount}
              </span>
            )}
          </button>
        </nav>
        <div className="p-4 mt-auto border-t border-zinc-200 bg-zinc-50">
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg mb-2 bg-white border border-zinc-200 shadow-sm">
            <div className="w-8 h-8 rounded-md bg-zinc-100 text-zinc-600 flex items-center justify-center font-bold text-xs border border-zinc-200">
              {userProfile?.displayName?.charAt(0).toUpperCase() || userProfile?.email?.charAt(0).toUpperCase()}
            </div>
            <div className="overflow-hidden flex-1">
              <p className="text-sm font-semibold text-zinc-900 truncate">{userProfile?.displayName}</p>
              <p className="text-[10px] text-zinc-500 truncate leading-tight mt-0.5">{userProfile?.email}</p>
            </div>
          </div>
          <button
            onClick={() => signOut(auth)}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-200/50 rounded-lg transition-colors font-medium text-sm border border-transparent"
          >
            <LogOut className="w-4 h-4" />
            <span className="font-semibold">Sign Out</span>
          </button>
        </div>
      </div>`;

content = content.replace(oldSidebar, newSidebar);
fs.writeFileSync('src/components/Layout.tsx', content);
console.log("Layout.tsx updated!");

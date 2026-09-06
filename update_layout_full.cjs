const fs = require('fs');

const content = fs.readFileSync('src/components/Layout.tsx', 'utf8');

// I will just replace the entire Sidebar div
const oldSidebarRegex = /\{\/\* Sidebar Navigation \*\/\}\s*<div className=\{cn\([\s\S]*?<\/div>\s*<\/div>\s*\{\/\* Main Content \*\/\}/;

const newSidebar = `{/* Sidebar Navigation */}
      <div className={cn(
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
      </div>

      {/* Main Content */}`;

const updated = content.replace(oldSidebarRegex, newSidebar);
fs.writeFileSync('src/components/Layout.tsx', updated);
console.log("Layout.tsx Sidebar replaced!");

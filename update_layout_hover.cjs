const fs = require('fs');
let code = fs.readFileSync('src/components/Layout.tsx', 'utf8');

// 1. Add state
code = code.replace('const [mobileMenuOpen, setMobileMenuOpen] = useState(false);', 
`const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isSidebarHovered, setIsSidebarHovered] = useState(false);
  const isExpanded = mobileMenuOpen || isSidebarHovered;`);

// 2. Change booksOpen state
code = code.replace(`const [booksOpen, setBooksOpen] = useState(location.pathname.startsWith('/books'));`,
`const [booksOpen, setBooksOpen] = useState(location.pathname.startsWith('/books'));`);

// 3. Add text hiding logic and hover expansions
code = code.replace(
  `  const sidebar = (`,
  `  const showText = isExpanded;
  const sidebar = (`
);

// 4. Logo text
code = code.replace(
  `<div className="min-w-0">
          <p className="font-bold text-[17px] text-[#0B1F3A] tracking-tight leading-none">Byjan</p>
          <p className="text-[11px] text-slate-500 mt-1">Main dashboard</p>
        </div>`,
  `{showText && (<div className="min-w-0 whitespace-nowrap">
          <p className="font-bold text-[17px] text-[#0B1F3A] tracking-tight leading-none">Byjan</p>
          <p className="text-[11px] text-slate-500 mt-1">Main dashboard</p>
        </div>)}`
);

// 5. Workspace text
code = code.replace(
  `<p className="text-[10px] font-bold tracking-widest text-slate-400 uppercase px-3 mb-1">Workspace</p>`,
  `{showText && <p className="text-[10px] font-bold tracking-widest text-slate-400 uppercase px-3 mb-1 whitespace-nowrap">Workspace</p>}`
);

code = code.replace(
  `Expense Tracker`,
  `{showText && <span className="whitespace-nowrap">Expense Tracker</span>}`
);

// 6. Books nav
code = code.replace(
  `Books
            </Link>
            <button
              type="button"
              aria-label={booksOpen ? 'Collapse Books menu' : 'Expand Books menu'}
              onClick={() => setBooksOpen((open) => !open)}
              className="px-2 rounded-r-xl text-slate-500 hover:text-[#0B1F3A]"
            >
              {booksOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
          </div>

          {booksOpen && (`,
  `{showText && <span className="whitespace-nowrap">Books</span>}
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

          {(booksOpen && showText) && (`
);

// 7. Books hover menus
code = code.replace(
  `{BOOKS_NAV.map((group) => {
                const groupOpen = openGroup === group.title;
                return (
                  <div key={group.title}>
                    <button
                      type="button"
                      onClick={() => setOpenGroup((current) => current === group.title ? null : group.title)}
                      className="w-full flex items-center justify-between px-2 py-1.5 rounded-xl text-[13px] font-semibold text-slate-600 hover:bg-slate-50 hover:text-[#0B1F3A]"
                    >`,
  `{BOOKS_NAV.map((group) => {
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
                    >`
);

code = code.replace(
  `{group.title}
                      <ChevronRight className={cn('w-3.5 h-3.5 text-slate-400 transition-transform', groupOpen && 'rotate-90')} />
                    </button>
                    {groupOpen && (`,
  `{group.title}
                      <ChevronRight className={cn('w-3.5 h-3.5 text-slate-400 transition-transform shrink-0', groupOpen && 'rotate-90')} />
                    </button>
                    {groupOpen && (`
);

code = code.replace(
  `<Settings className="w-4 h-4 shrink-0" />
          Settings`,
  `<Settings className="w-4 h-4 shrink-0" />
          {showText && <span className="whitespace-nowrap">Settings</span>}`
);

// 8. Tenant & User info
code = code.replace(
  `{tenant && (
          <div className="px-3 py-2.5 rounded-xl bg-[#F8FAFC] border border-slate-200 shadow-[inset_0_1px_2px_rgba(11,31,58,0.06)]">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Books tenant</p>
            <p className="text-xs font-semibold text-[#0B1F3A] truncate mt-0.5">{tenant.name}</p>
            <p className="text-[10px] text-slate-500 truncate">erp_workspaces/{tenant.id.slice(0, 8)}… · {tenant.memberCount} member{tenant.memberCount === 1 ? '' : 's'}</p>
          </div>
        )}`,
  `{tenant && showText && (
          <div className="px-3 py-2.5 rounded-xl bg-[#F8FAFC] border border-slate-200 shadow-[inset_0_1px_2px_rgba(11,31,58,0.06)]">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 whitespace-nowrap">Books tenant</p>
            <p className="text-xs font-semibold text-[#0B1F3A] truncate mt-0.5 whitespace-nowrap">{tenant.name}</p>
            <p className="text-[10px] text-slate-500 truncate whitespace-nowrap">erp_workspaces/{tenant.id.slice(0, 8)}… · {tenant.memberCount} member{tenant.memberCount === 1 ? '' : 's'}</p>
          </div>
        )}`
);

code = code.replace(
  `            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-[#0B1F3A] truncate">{userProfile?.displayName || 'User'}</p>
              <p className="text-[10px] text-slate-500 truncate">{userProfile?.email}</p>
            </div>
          </div>
          <button
            onClick={logout}
            className="mt-1 w-full flex items-center gap-2 px-3 py-2 text-slate-600 hover:bg-rose-50 hover:text-rose-700 rounded-xl text-sm font-medium"
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </button>`,
  `            {showText && (<div className="flex-1 min-w-0">
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
          </button>`
);

// 9. SearchTrigger display
code = code.replace(
  `<div className="px-3 mb-3">
        <SearchTrigger variant="sidebar" />
      </div>`,
  `<div className="px-3 mb-3 flex justify-center">
        {showText ? <SearchTrigger variant="sidebar" /> : <button title="Search" className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"><SearchTrigger variant="iconOnly" /></button>}
      </div>`
);

// 10. The aside wrapper
code = code.replace(
  `<aside
        className={cn(
          'byjan-rail fixed inset-y-0 left-0 z-50 w-72 flex flex-col md:relative md:translate-x-0 md:z-auto transition-transform',
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        )}
      >`,
  `<aside
        onMouseEnter={() => setIsSidebarHovered(true)}
        onMouseLeave={() => setIsSidebarHovered(false)}
        className={cn(
          'byjan-rail fixed inset-y-0 left-0 z-50 flex flex-col md:relative md:translate-x-0 md:z-auto transition-all duration-300 overflow-hidden bg-white border-r border-slate-200',
          mobileMenuOpen ? 'translate-x-0 w-72' : '-translate-x-full md:translate-x-0',
          !mobileMenuOpen && (isSidebarHovered ? 'md:w-72 shadow-2xl md:shadow-none' : 'md:w-[72px]')
        )}
      >`
);


fs.writeFileSync('src/components/Layout.tsx', code);
console.log('Layout patched');

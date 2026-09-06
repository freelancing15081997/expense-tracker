const fs = require('fs');
let content = fs.readFileSync('src/components/Layout.tsx', 'utf8');

const navStart = content.indexOf('<nav className="flex-1 overflow-y-auto scrollbar-none px-4 space-y-6">');
const navEnd = content.indexOf('</nav>') + 6;

const newNav = `<nav className="flex-1 overflow-y-auto scrollbar-none px-4 space-y-6">
          <div>
            {!isSidebarCollapsed && <div className="text-[10px] font-bold tracking-widest text-[#5a5a5a] uppercase mb-3 ml-2">Main</div>}
            <div className="space-y-1">
              {navigation.map((item) => {
                const isActive = location.pathname === item.href || (location.pathname.startsWith('/book/') && item.href === '/');
                
                return (
                  <div key={item.name} className="relative">
                    <Link
                      to={item.isNotification ? '#' : item.href}
                      onClick={(e) => {
                        if (item.isNotification) {
                          e.preventDefault();
                          setNotificationsPanelOpen(true);
                        } else {
                          setMobileMenuOpen(false);
                        }
                      }}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium text-sm transition-all duration-200 group",
                        isActive && !item.isNotification ? "bg-[#2a2a2a] text-white" : "hover:bg-[#1f1f1f] hover:text-white text-[#8a8a8a]"
                      )}
                    >
                      <item.icon className={cn("w-5 h-5 shrink-0 transition-colors", isActive && !item.isNotification ? "text-white" : "group-hover:text-white")} />
                      {!isSidebarCollapsed && (
                        <div className="flex-1 flex justify-between items-center">
                          {item.name}
                          {item.isNotification && unreadCount > 0 && (
                            <span className="w-2 h-2 bg-rose-500 rounded-full"></span>
                          )}
                        </div>
                      )}
                    </Link>
                    
                    {/* Sub-items */}
                    {!isSidebarCollapsed && item.subItems && (
                      <div className="ml-5 mt-1 relative pb-1">
                        {/* Vertical line */}
                        <div className="absolute left-[9px] top-0 bottom-4 w-px bg-[#2a2a2a]"></div>
                        {item.subItems.map((sub, idx) => {
                          const isSubActive = location.pathname === sub.href;
                          return (
                            <div key={sub.name} className="relative flex items-center mt-1">
                              {/* Horizontal branch */}
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
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </nav>`;

content = content.substring(0, navStart) + newNav + content.substring(navEnd);
fs.writeFileSync('src/components/Layout.tsx', content);

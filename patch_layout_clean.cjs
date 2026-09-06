const fs = require('fs');
let content = fs.readFileSync('src/components/Layout.tsx', 'utf8');

const searchNav = `const navigation = [
    { 
      name: 'Books', 
      href: '/', 
      icon: LayoutDashboard,
      subItems: [
        { name: 'Invoicing', href: '/invoicing' },
        { name: 'Reports', href: '/reports' }
      ]
    },
    { name: 'Expense Tracker', href: '/expenses', icon: Receipt },
    { name: 'Notifications', href: '#', icon: Bell, isNotification: true },
    { name: 'Settings', href: '/settings', icon: Settings },
  ];`;

const replaceNav = `const navigation = [
    { name: 'Books', href: '/', icon: BookOpen },
    { name: 'Expense Tracker', href: '/expenses', icon: Receipt },
    { name: 'Notifications', href: '#', icon: Bell, isNotification: true },
    { name: 'Settings', href: '/settings', icon: Settings },
  ];`;

content = content.replace(searchNav, replaceNav);
fs.writeFileSync('src/components/Layout.tsx', content);

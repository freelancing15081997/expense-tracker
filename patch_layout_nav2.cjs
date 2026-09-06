const fs = require('fs');
let content = fs.readFileSync('src/components/Layout.tsx', 'utf8');

// The user wants 'Expense Tracker' back as a main feature.
// In the current `navigation` array definition:
const searchNav = `const navigation = [
    { 
      name: 'Books', 
      href: '/', 
      icon: LayoutDashboard,
      subItems: [
        { name: 'Receipts (All)', href: '/expenses' },
        { name: 'Invoicing', href: '/invoicing' },
        { name: 'Reports', href: '/reports' }
      ]
    },
    { name: 'Notifications', href: '#', icon: Bell, isNotification: true },
    { name: 'Settings', href: '/settings', icon: Settings },
  ];`;
  
const replaceNav = `const navigation = [
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

if (content.includes(searchNav)) {
  content = content.replace(searchNav, replaceNav);
} else {
  // Try regex if exact match fails
  content = content.replace(/\{ name: 'Receipts \(All\)', href: '\/expenses' \},\s*/, '');
  content = content.replace(/\{ name: 'Notifications', href: '#', icon: Bell, isNotification: true \},/, `{ name: 'Expense Tracker', href: '/expenses', icon: Receipt },\n    { name: 'Notifications', href: '#', icon: Bell, isNotification: true },`);
}

fs.writeFileSync('src/components/Layout.tsx', content);

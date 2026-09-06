const fs = require('fs');
let layout = fs.readFileSync('src/components/Layout.tsx', 'utf8');

const oldNav = `const navigation = [
    { name: 'Expense Tracker', href: '/', icon: Receipt },
    { name: 'Books (Auditing)', href: '/bookkeeping', icon: BookOpen },
    { name: 'Notifications', href: '#', icon: Bell, isNotification: true },
    { name: 'Settings', href: '/settings', icon: Settings },
  ];`;

const newNav = `const navigation = [
    { name: 'Expense Tracker', href: '/', icon: ArrowRightLeft },
    { 
      name: 'Books', 
      href: '/books', 
      icon: BookOpen,
      subItems: [
        { name: 'Dashboard', href: '/books' },
        { name: 'Invoicing', href: '/books/invoicing' },
        { name: 'Billing', href: '/books/billing' },
        { name: 'Expenses', href: '/books/expenses' },
        { name: 'Chart of Accounts', href: '/books/chart-of-accounts' },
        { name: 'Templates', href: '/books/templates' },
        { name: 'Clients', href: '/books/clients' },
        { name: 'Vendors', href: '/books/vendors' },
        { name: 'Reports', href: '/books/reports' }
      ]
    },
    { name: 'Notifications', href: '#', icon: Bell, isNotification: true },
    { name: 'Settings', href: '/settings', icon: Settings },
  ];`;

if (layout.includes(oldNav)) {
  layout = layout.replace(oldNav, newNav);
} else {
  // Regex fallback
  layout = layout.replace(/const navigation = \[[^\]]*\];/, newNav);
}

// Add icon ArrowRightLeft if missing
if (!layout.includes('ArrowRightLeft')) {
  layout = layout.replace(/import {([^}]+)} from 'lucide-react';/, "import { $1, ArrowRightLeft } from 'lucide-react';");
}

fs.writeFileSync('src/components/Layout.tsx', layout);

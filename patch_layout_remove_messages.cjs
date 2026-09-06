const fs = require('fs');
let content = fs.readFileSync('src/components/Layout.tsx', 'utf8');

// Remove the messages array
content = content.replace(/const messages = \[[\s\S]*?\];/g, '');

// Remove the Messages section from the sidebar JSX
const messagesSectionRegex = /<div className=\{cn\("flex items-center mb-3", isSidebarCollapsed \? "justify-center" : "justify-between ml-2"\)\}>[\s\S]*?<\/div>\s*<\/div>/;
content = content.replace(messagesSectionRegex, '');

// Also remove the "Contracts" and "Payments" links if they are considered "junk"
// Actually, let's just rewrite the `navigation` array completely.
content = content.replace(/const navigation = \[[\s\S]*?\];/g, `const navigation = [
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
    { name: 'Settings', href: '/settings', icon: Settings },
  ];`);

fs.writeFileSync('src/components/Layout.tsx', content);

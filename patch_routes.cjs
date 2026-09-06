const fs = require('fs');

// Patch App.tsx
let app = fs.readFileSync('src/App.tsx', 'utf8');
app = app.replace('<Route path="expenses" element={<AllExpenses />} />', '<Route path="bookkeeping" element={<AllExpenses />} />');
fs.writeFileSync('src/App.tsx', app);

// Patch Layout.tsx
let layout = fs.readFileSync('src/components/Layout.tsx', 'utf8');
const searchNav = `const navigation = [
    { name: 'Books', href: '/', icon: BookOpen },
    { name: 'Expense Tracker', href: '/expenses', icon: Receipt },
    { name: 'Notifications', href: '#', icon: Bell, isNotification: true },
    { name: 'Settings', href: '/settings', icon: Settings },
  ];`;
const replaceNav = `const navigation = [
    { name: 'Expense Tracker', href: '/', icon: Receipt },
    { name: 'Books (Auditing)', href: '/bookkeeping', icon: BookOpen },
    { name: 'Notifications', href: '#', icon: Bell, isNotification: true },
    { name: 'Settings', href: '/settings', icon: Settings },
  ];`;
layout = layout.replace(searchNav, replaceNav);
fs.writeFileSync('src/components/Layout.tsx', layout);

// Patch Dashboard.tsx
let dash = fs.readFileSync('src/pages/Dashboard.tsx', 'utf8');
dash = dash.replace('<h1 className="text-2xl font-bold text-slate-900 font-display">SET</h1>', '<h1 className="text-2xl font-bold text-slate-900 font-display">Expense Tracker</h1>');
fs.writeFileSync('src/pages/Dashboard.tsx', dash);

// Patch AllExpenses.tsx
let all = fs.readFileSync('src/pages/AllExpenses.tsx', 'utf8');
all = all.replace('<h1 className="text-2xl font-bold text-zinc-900 tracking-tight flex items-center gap-2">\n          <Receipt className="w-6 h-6 text-zinc-700" />\n          Expense Tracker\n        </h1>', '<h1 className="text-2xl font-bold text-zinc-900 tracking-tight flex items-center gap-2">\n          <BookOpen className="w-6 h-6 text-zinc-700" />\n          Books (Auditing)\n        </h1>');
all = all.replace('import { Receipt, ArrowUpRight, ArrowDownRight, Loader2, ArrowLeftRight } from \'lucide-react\';', 'import { Receipt, ArrowUpRight, ArrowDownRight, Loader2, ArrowLeftRight, BookOpen } from \'lucide-react\';');
all = all.replace('<p className="text-sm text-zinc-500">All your incoming and outgoing flows across all books.</p>', '<p className="text-sm text-zinc-500">Global bookkeeping view across all ledgers for auditing purposes.</p>');
fs.writeFileSync('src/pages/AllExpenses.tsx', all);

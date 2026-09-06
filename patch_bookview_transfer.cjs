const fs = require('fs');
let content = fs.readFileSync('src/pages/BookView.tsx', 'utf8');

// The state might only allow 'in' | 'out'. Let's change it.
content = content.replace(
  /const \[entryType, setEntryType\] = useState\<'in' \| 'out'\>\('out'\);/,
  `const [entryType, setEntryType] = useState<'in' | 'out' | 'transfer'>('out');`
);

// We need to add the Transfer button to the form.
const oldButtons = `<div className="flex bg-slate-100 p-1 rounded-lg">
                <button 
                  type="button"
                  onClick={() => setEntryType('out')}
                  className={cn("flex-1 py-1.5 text-sm font-semibold rounded-md transition-colors", entryType === 'out' ? "bg-white text-rose-600 shadow-sm" : "text-slate-500 hover:text-slate-700")}
                >
                  Money Out
                </button>
                <button 
                  type="button"
                  onClick={() => setEntryType('in')}
                  className={cn("flex-1 py-1.5 text-sm font-semibold rounded-md transition-colors", entryType === 'in' ? "bg-white text-emerald-600 shadow-sm" : "text-slate-500 hover:text-slate-700")}
                >
                  Money In
                </button>
              </div>`;

const newButtons = `<div className="flex bg-slate-100 p-1 rounded-lg">
                <button 
                  type="button"
                  onClick={() => setEntryType('out')}
                  className={cn("flex-1 py-1.5 text-sm font-semibold rounded-md transition-colors", entryType === 'out' ? "bg-white text-rose-600 shadow-sm" : "text-slate-500 hover:text-slate-700")}
                >
                  Money Out
                </button>
                <button 
                  type="button"
                  onClick={() => setEntryType('in')}
                  className={cn("flex-1 py-1.5 text-sm font-semibold rounded-md transition-colors", entryType === 'in' ? "bg-white text-emerald-600 shadow-sm" : "text-slate-500 hover:text-slate-700")}
                >
                  Money In
                </button>
                <button 
                  type="button"
                  onClick={() => setEntryType('transfer')}
                  className={cn("flex-1 py-1.5 text-sm font-semibold rounded-md transition-colors", entryType === 'transfer' ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700")}
                >
                  Transfer
                </button>
              </div>`;

content = content.replace(oldButtons, newButtons);

// Make sure rendering handles 'transfer' correctly
const oldDesktopRender = `<div className={cn("font-bold text-[14px] whitespace-nowrap", e.entryType === 'in' ? "text-emerald-600" : "text-zinc-900")}>{e.entryType === 'in' ? '+' : ''}{getCurrencySymbol(book.currency)} {exp.amount.toLocaleString(undefined, {minimumFractionDigits: 2})}</div>`;

// Wait, I need to check how it was actually rendered.
fs.writeFileSync('src/pages/BookView.tsx', content);

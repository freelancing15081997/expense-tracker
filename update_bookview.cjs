const fs = require('fs');

let content = fs.readFileSync('src/pages/BookView.tsx', 'utf8');

// 1. Add entryType state
content = content.replace(
  "const [amount, setAmount] = useState('');",
  "const [entryType, setEntryType] = useState<'in' | 'out'>('out');\n  const [amount, setAmount] = useState('');"
);

// 2. openNewExpense
content = content.replace(
  "setEditingExpense(null);\n    setAmount('');",
  "setEditingExpense(null);\n    setEntryType('out');\n    setAmount('');"
);

// 3. openEditExpense
content = content.replace(
  "setEditingExpense(exp);\n    setAmount(exp.amount.toString());",
  "setEditingExpense(exp);\n    setEntryType(exp.type || 'out');\n    setAmount(exp.amount.toString());"
);

// 4. handleSaveExpense (updateDoc)
content = content.replace(
  "amount: Number(amount),",
  "type: entryType,\n          amount: Number(amount),"
);
content = content.replace(
  "amount: Number(amount),", // Second match for addDoc
  "type: entryType,\n          amount: Number(amount),"
);

// 5. Compute totals
content = content.replace(
  "const totalSpend = expenses.reduce((sum, exp) => sum + (exp.amount || 0), 0);",
  `const totalIn = expenses.filter(e => e.type === 'in').reduce((sum, exp) => sum + (exp.amount || 0), 0);
  const totalOut = expenses.filter(e => e.type !== 'in').reduce((sum, exp) => sum + (exp.amount || 0), 0);
  const balance = totalIn - totalOut;`
);

// 6. Fix chart data (only chart 'out' money maybe? or chart balance?)
// Let's just chart money out
content = content.replace(
  "const chartData = expenses.reduce((acc: any[], exp) => {",
  "const chartData = expenses.filter(e => e.type !== 'in').reduce((acc: any[], exp) => {"
);

// 7. UI Replacements (Summary Cards)
content = content.replace(
  /<p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Balance<\/p>[\s\S]*?<\/h2>/,
  `<p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Net Balance</p>
              <h2 className={cn("text-lg font-bold", balance >= 0 ? "text-emerald-600" : "text-rose-600")}>{balance < 0 ? '-' : ''}{getCurrencySymbol(book.currency)} {Math.abs(balance).toLocaleString(undefined, {minimumFractionDigits: 2})}</h2>`
);
content = content.replace(
  /<p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Entries Count<\/p>[\s\S]*?<\/h2>/,
  `<p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Money Out</p>
              <h2 className="text-lg font-bold text-rose-600">{getCurrencySymbol(book.currency)} {totalOut.toLocaleString(undefined, {minimumFractionDigits: 2})}</h2>
            </div>
            <div className="w-full sm:w-auto flex-1 flex flex-row items-center justify-between bg-white p-3 px-5 rounded-lg border border-slate-200 shadow-sm">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Money In</p>
              <h2 className="text-lg font-bold text-emerald-600">{getCurrencySymbol(book.currency)} {totalIn.toLocaleString(undefined, {minimumFractionDigits: 2})}</h2>`
);

// 8. Modal UI modifications
content = content.replace(
  /<Dialog\.Title className="text-lg font-bold text-slate-900">\{editingExpense \? 'Edit Entry' : 'New Entry'\}<\/Dialog\.Title>/,
  `<Dialog.Title className="text-lg font-bold text-slate-900">{editingExpense ? 'Edit Entry' : 'New Entry'}</Dialog.Title>
            </div>
            <div className="flex gap-2 mb-4 bg-slate-100 p-1 rounded-md">
              <button type="button" onClick={() => setEntryType('out')} className={cn("flex-1 py-1.5 text-sm font-semibold rounded shadow-sm transition-all", entryType === 'out' ? "bg-white text-zinc-900" : "text-zinc-500 hover:text-zinc-700")}>Money Out</button>
              <button type="button" onClick={() => setEntryType('in')} className={cn("flex-1 py-1.5 text-sm font-semibold rounded shadow-sm transition-all", entryType === 'in' ? "bg-white text-zinc-900" : "text-zinc-500 hover:text-zinc-700")}>Money In</button>`
);

// Fix list to show Money In (emerald) and Money Out (zinc) correctly
content = content.replace(
  /<div className="font-bold text-slate-900 text-\[14px\] whitespace-nowrap">\{getCurrencySymbol\(book.currency\)\} \{exp.amount.toLocaleString\(undefined, \{minimumFractionDigits: 2\}\)\}<\/div>/g,
  `<div className={cn("font-bold text-[14px] whitespace-nowrap", exp.type === 'in' ? "text-emerald-600" : "text-zinc-900")}>{exp.type === 'in' ? '+' : ''}{getCurrencySymbol(book.currency)} {exp.amount.toLocaleString(undefined, {minimumFractionDigits: 2})}</div>`
);
content = content.replace(
  /<td className="p-4 font-bold text-slate-900">\{getCurrencySymbol\(book.currency\)\} \{exp.amount.toLocaleString\(undefined, \{minimumFractionDigits: 2\}\)\}<\/td>/g,
  `<td className={cn("p-4 font-bold", exp.type === 'in' ? "text-emerald-600" : "text-zinc-900")}>{exp.type === 'in' ? '+' : ''}{getCurrencySymbol(book.currency)} {exp.amount.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>`
);

// Replace "Ledgers" and "Ledger" terminology
content = content.replace(/>Ledger</g, '>Expense Tracker<');
content = content.replace(/>Ledgers</g, '>Expense Trackers<');
content = content.replace(/"Ledger"/g, '"Expense Tracker"');

fs.writeFileSync('src/pages/BookView.tsx', content);
console.log("BookView.tsx updated!");

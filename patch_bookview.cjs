const fs = require('fs');
let content = fs.readFileSync('src/pages/BookView.tsx', 'utf8');

// Update email subject in notifyTeamMembers
content = content.replace(
  /const subject = `Ledger Update: \$\{book\.name\}`;/,
  `const subject = \`\$\{userProfile?.displayName || currentUser?.email\} \$\{action.toLowerCase()\} in \$\{book.name\} expense book\`;`
);

// We should also improve the detail parameter being passed.
// Update addDoc and updateDoc calls to pass better detail.
content = content.replace(
  /await notifyTeamMembers\('Edited an Entry', `Updated expense for \$\{description\} to \$\{getCurrencySymbol\(book\.currency\)\} \$\{amount\}`\);/,
  `await notifyTeamMembers('Edited an entry', \`Updated \$\{entryType === 'in' ? 'money in' : 'money out'\} for "\$\{description\}" to \$\{getCurrencySymbol(book.currency)\} \$\{amount\} in category "\$\{finalCategory\}"\`);`
);

content = content.replace(
  /await notifyTeamMembers\('Added a New Entry', `Recorded \$\{getCurrencySymbol\(book\.currency\)\} \$\{amount\} for \$\{description\}`\);/,
  `await notifyTeamMembers('Added a new entry', \`Recorded \$\{entryType === 'in' ? 'money in' : 'money out'\} of \$\{getCurrencySymbol(book.currency)\} \$\{amount\} for "\$\{description\}" in category "\$\{finalCategory\}"\`);`
);

content = content.replace(
  /await notifyTeamMembers\('Deleted an Entry', `Removed expense for \$\{description\}`\);/,
  `await notifyTeamMembers('Deleted an entry', \`Removed entry for "\$\{description\}"\`);`
);

// Add Entry Type toggle in the modal form
const formReplacement = `            <form onSubmit={handleSaveExpense} className="space-y-4">
              <div className="flex bg-slate-100 p-1 rounded-lg">
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
              </div>
              <div>`;

content = content.replace(
  /<form onSubmit=\{handleSaveExpense\} className="space-y-4">\s*<div>/,
  formReplacement
);

// Replace the word "expense" with "entry" to be more generic in the UI since it can be money in
content = content.replace(
  /placeholder="Search expenses..."/,
  `placeholder="Search entries..."`
);

content = content.replace(
  /No expenses found matching your criteria./,
  `No entries found matching your criteria.`
);

content = content.replace(
  /No expenses found./,
  `No entries found.`
);

fs.writeFileSync('src/pages/BookView.tsx', content);
console.log("Patched BookView!");

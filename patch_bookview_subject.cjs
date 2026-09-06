const fs = require('fs');
let content = fs.readFileSync('src/pages/BookView.tsx', 'utf8');

// Change signature
content = content.replace(
  /const notifyTeamMembers = async \(action: string, detail: string\) => \{/,
  `const notifyTeamMembers = async (action: string, detail: string, customSubject?: string) => {`
);

// Use customSubject if available
content = content.replace(
  /const subject = `\$\{userProfile\?\.displayName \|\| currentUser\?\.email\} \$\{action\.toLowerCase\(\)\} in \$\{book\.name\} expense book`;/,
  `const subject = customSubject || \`\$\{userProfile?.displayName || currentUser?.email\} \$\{action.toLowerCase()\} in \$\{book.name\} expense book\`;`
);

// Update usages
content = content.replace(
  /await notifyTeamMembers\('Member Removed', `\$\{book\.roles\[uidToRemove\]\?\.email\} was removed from the ledger\.`\);/,
  `await notifyTeamMembers('Member Removed', \`\$\{book.roles[uidToRemove]?.email\} was removed from the ledger.\`, \`\$\{book.roles[uidToRemove]?.email\} was removed from \$\{book.name\}\`);`
);

content = content.replace(
  /await notifyTeamMembers\('Edited an entry', `Updated \$\{entryType === 'in' \? 'money in' : 'money out'\} for "\$\{description\}" to \$\{getCurrencySymbol\(book\.currency\)\} \$\{amount\} in category "\$\{finalCategory\}"`\);/,
  `await notifyTeamMembers('Edited an entry', \`Updated \$\{entryType === 'in' ? 'money in' : 'money out'\} for "\$\{description\}" to \$\{getCurrencySymbol(book.currency)\} \$\{amount\} in category "\$\{finalCategory\}"\`, \`\$\{userProfile?.displayName || currentUser?.email\} updated "\$\{description\}" to \$\{getCurrencySymbol(book.currency)\}\$\{amount\} in \$\{book.name\}\`);`
);

content = content.replace(
  /await notifyTeamMembers\('Added a new entry', `Recorded \$\{entryType === 'in' \? 'money in' : 'money out'\} of \$\{getCurrencySymbol\(book\.currency\)\} \$\{amount\} for "\$\{description\}" in category "\$\{finalCategory\}"`\);/,
  `await notifyTeamMembers('Added a new entry', \`Recorded \$\{entryType === 'in' ? 'money in' : 'money out'\} of \$\{getCurrencySymbol(book.currency)\} \$\{amount\} for "\$\{description\}" in category "\$\{finalCategory\}"\`, \`\$\{userProfile?.displayName || currentUser?.email\} added "\$\{description\}" (\$\{getCurrencySymbol(book.currency)\}\$\{amount\}) to \$\{book.name\}\`);`
);

content = content.replace(
  /await notifyTeamMembers\('Deleted an entry', `Removed entry for "\$\{description\}"`\);/,
  `await notifyTeamMembers('Deleted an entry', \`Removed entry for "\$\{description\}"\`, \`\$\{userProfile?.displayName || currentUser?.email\} deleted "\$\{description\}" from \$\{book.name\}\`);`
);

fs.writeFileSync('src/pages/BookView.tsx', content);

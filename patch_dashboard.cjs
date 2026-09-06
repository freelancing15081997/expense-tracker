const fs = require('fs');
let content = fs.readFileSync('src/pages/Dashboard.tsx', 'utf8');

// Replace the generic email with a more detailed one if present.
content = content.replace(
  /const subject = `Ledger Update: \$\{invite\.bookName\}`;/,
  `const subject = \`\$\{userProfile?.displayName || currentUser?.email\} joined \$\{invite.bookName\} expense book\`;`
);

content = content.replace(
  /const message = `<p>Hello,<\/p><p><b>\$\{userProfile\?\.displayName \|\| currentUser\?\.email\}<\/b> has accepted your invitation and joined the ledger <b>\$\{invite\.bookName\}<\/b>.<\/p>`;/,
  `const message = \`<p>Hello,</p><p><b>\$\{userProfile?.displayName || currentUser?.email\}</b> has accepted your invitation and joined the ledger <b>\$\{invite.bookName\}</b>.</p>\`;`
);

fs.writeFileSync('src/pages/Dashboard.tsx', content);
console.log("Patched Dashboard!");

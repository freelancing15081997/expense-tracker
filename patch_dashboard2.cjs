const fs = require('fs');
let content = fs.readFileSync('src/pages/Dashboard.tsx', 'utf8');

content = content.replace(
  /subject: `New member joined: \$\{invite.bookName\}`/g,
  `subject: \`\$\{userProfile.displayName || userProfile.email\} joined \$\{invite.bookName\} expense book\``
);

fs.writeFileSync('src/pages/Dashboard.tsx', content);
console.log("Patched Dashboard email subject!");

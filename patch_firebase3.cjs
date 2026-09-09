const fs = require('fs');
let code = fs.readFileSync('src/lib/firebase.ts', 'utf8');

// replace everything after firestoreDatabaseId: until the }
code = code.replace(
  /firestoreDatabaseId:[^\}]*/,
  `firestoreDatabaseId: "ai-studio-sharedsheetexpen-15aa5fbb-9604-4c59-b4a3-aa994442cb50"\n`
);

fs.writeFileSync('src/lib/firebase.ts', code);
console.log('patched 3');

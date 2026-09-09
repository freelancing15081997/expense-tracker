const fs = require('fs');
let code = fs.readFileSync('src/lib/firebase.ts', 'utf8');

// Hardcode the ID
code = code.replace(
  /firestoreDatabaseId:.*?,/g,
  `firestoreDatabaseId: "ai-studio-sharedsheetexpen-15aa5fbb-9604-4c59-b4a3-aa994442cb50",`
);

fs.writeFileSync('src/lib/firebase.ts', code);
console.log('patched 2');

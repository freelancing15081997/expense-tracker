const fs = require('fs');
let code = fs.readFileSync('src/lib/firebase.ts', 'utf8');

// Force the database ID to be the string we know works, just to be safe
code = code.replace(
  `firestoreDatabaseId: import.meta.env.VITE_FIREBASE_DATABASE_ID || "ai-studio-sharedsheetexpen-15aa5fbb-9604-4c59-b4a3-aa994442cb50"`,
  `firestoreDatabaseId: (import.meta.env.VITE_FIREBASE_DATABASE_ID && import.meta.env.VITE_FIREBASE_DATABASE_ID.trim() !== "" && import.meta.env.VITE_FIREBASE_DATABASE_ID !== "undefined") ? import.meta.env.VITE_FIREBASE_DATABASE_ID : "ai-studio-sharedsheetexpen-15aa5fbb-9604-4c59-b4a3-aa994442cb50"`
);

fs.writeFileSync('src/lib/firebase.ts', code);
console.log('patched');

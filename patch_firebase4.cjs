const fs = require('fs');
let code = fs.readFileSync('src/lib/firebase.ts', 'utf8');

code = code.replace(/import\.meta\.env\.VITE_FIREBASE_API_KEY \|\| /g, '');
code = code.replace(/import\.meta\.env\.VITE_FIREBASE_AUTH_DOMAIN \|\| /g, '');
code = code.replace(/import\.meta\.env\.VITE_FIREBASE_PROJECT_ID \|\| /g, '');
code = code.replace(/import\.meta\.env\.VITE_FIREBASE_STORAGE_BUCKET \|\| /g, '');
code = code.replace(/import\.meta\.env\.VITE_FIREBASE_MESSAGING_SENDER_ID \|\| /g, '');
code = code.replace(/import\.meta\.env\.VITE_FIREBASE_APP_ID \|\| /g, '');

fs.writeFileSync('src/lib/firebase.ts', code);
console.log('patched 4');

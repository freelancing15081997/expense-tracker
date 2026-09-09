const fs = require('fs');
let code = fs.readFileSync('firestore.rules', 'utf8');

if (!code.includes('match /erp_files/')) {
  code = code.replace(
    `    match /erp_workspaces/{userId}/{document=**} {`,
    `    match /erp_files/{fileId} {
      allow read, write: if isAuthenticated();
    }
    match /erp_workspaces/{userId}/{document=**} {`
  );
  fs.writeFileSync('firestore.rules', code);
  console.log('rules patched');
} else {
  console.log('rules already patched');
}

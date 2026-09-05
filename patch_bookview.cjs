const fs = require('fs');
let code = fs.readFileSync('src/pages/BookView.tsx', 'utf8');

// Replace the filter so it emails everyone, even the sender, for testing purposes
code = code.replace(
  /\.filter\(\(email: string\) => email !== \(userProfile\?\.email \|\| currentUser\?\.email\)\);/g,
  '; // Removed self-filter for testing so the user gets their own emails'
);

fs.writeFileSync('src/pages/BookView.tsx', code);

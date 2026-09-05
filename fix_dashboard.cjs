const fs = require('fs');
let code = fs.readFileSync('src/pages/Dashboard.tsx', 'utf8');

if (!code.includes('getDoc,')) {
  code = code.replace('getDocs,', 'getDocs, getDoc,');
}

code = code.replace(/to: email,/g, 'to: r.email,');

fs.writeFileSync('src/pages/Dashboard.tsx', code);

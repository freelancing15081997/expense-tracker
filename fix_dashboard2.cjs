const fs = require('fs');
let code = fs.readFileSync('src/pages/Dashboard.tsx', 'utf8');

code = code.replace(/to: r\.email,/g, 'to: emails.join(", "),');

fs.writeFileSync('src/pages/Dashboard.tsx', code);

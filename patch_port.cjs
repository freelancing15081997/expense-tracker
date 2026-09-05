const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

// Change port 587 back to 2525
code = code.replace(/port: 587,/, 'port: 2525,');

fs.writeFileSync('server.ts', code);

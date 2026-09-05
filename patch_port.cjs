const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

code = code.replace(/const PORT = 3000;/g, 'const PORT = process.env.PORT || 3000;');
fs.writeFileSync('server.ts', code);

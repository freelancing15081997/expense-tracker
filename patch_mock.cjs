const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const regex = /if \(!process\.env\.SMTP_PASS\) \{[\s\S]*?return res\.status\(200\)\.json\(\{[\s\S]*?\}\);\s*\}/g;
code = code.replace(regex, '');

fs.writeFileSync('server.ts', code);

const fs = require('fs');
let pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));

pkg.scripts.start = "node --dns-result-order=ipv4first dist/server.cjs";
pkg.scripts.dev = "tsx --dns-result-order=ipv4first server.ts";

fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2));

let server = fs.readFileSync('server.ts', 'utf8');
server = server.replace(/port: Number\(process.env.SMTP_PORT\) \|\| 587,/, 'port: Number(process.env.SMTP_PORT) || 465,');
server = server.replace(/secure: false,/, 'secure: true,');
fs.writeFileSync('server.ts', server);

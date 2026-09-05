const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

// Add dns import and setDefaultResultOrder if it's not already there
if (!code.includes("dns.setDefaultResultOrder")) {
  code = "import dns from 'dns';\ndns.setDefaultResultOrder('ipv4first');\n" + code;
}

// Hardcode smtp.gmail.com and 465 to override any Render env vars the user set
code = code.replace(/host: process\.env\.SMTP_HOST \|\| "smtp\.gmail\.com",/g, 'host: "smtp.gmail.com",');
code = code.replace(/port: Number\(process\.env\.SMTP_PORT\) \|\| 465,/g, 'port: 465,');

fs.writeFileSync('server.ts', code);

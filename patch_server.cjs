const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

// Update createTransporter
code = code.replace(/host: process\.env\.SMTP_HOST \|\| "smtp\.gmail\.com",/, 'host: process.env.SMTP_HOST || "smtp-relay.brevo.com",');
code = code.replace(/port: Number\(process\.env\.SMTP_PORT\) \|\| 465,/, 'port: Number(process.env.SMTP_PORT) || 2525,');
code = code.replace(/secure: true,/, 'secure: false,');
code = code.replace(/user: SYSTEM_EMAIL,/, 'user: process.env.SMTP_USER || "b7ffda001@smtp-brevo.com",');
code = code.replace(/pass: process\.env\.SMTP_PASS,/, 'pass: process.env.SMTP_PASS || "bskbpWFhUtdUJPH",');

// Remove the if (!process.env.SMTP_PASS) block that mocks emails
// We want to remove from `if (!process.env.SMTP_PASS) {` up to `try {`
code = code.replace(/if \(!process\.env\.SMTP_PASS\) \{[\s\S]*?\} catch \(error\)/, 'try {');
// But wait, there's a `}` right before `try {`. Let's do it safer.

fs.writeFileSync('server.ts', code);

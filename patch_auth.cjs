const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

// Hardcode Brevo settings to avoid `.env` bleed-over from old Gmail settings
code = code.replace(/host: process\.env\.SMTP_HOST \|\| "smtp-relay\.brevo\.com",/, 'host: "smtp-relay.brevo.com",');
code = code.replace(/port: Number\(process\.env\.SMTP_PORT\) \|\| 2525,/, 'port: 587,'); // Switch back to 587 as requested by user
code = code.replace(/user: process\.env\.SMTP_USER \|\| "b7ffda001@smtp-brevo\.com",/, 'user: "b7ffda001@smtp-brevo.com",');
code = code.replace(/pass: process\.env\.SMTP_PASS \|\| "bskbpWFhUtdUJPH",/, 'pass: "bskbpWFhUtdUJPH",');

// Also update SYSTEM_EMAIL to point to a verified sender if they didn't have one, but we'll leave it to byjanbooks for now.
code = code.replace(/const SYSTEM_EMAIL = process\.env\.SMTP_USER \|\| "byjanbooks@gmail\.com";/, 'const SYSTEM_EMAIL = "byjanbooks@gmail.com";');

fs.writeFileSync('server.ts', code);

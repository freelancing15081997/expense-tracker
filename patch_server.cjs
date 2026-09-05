const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

// Replace the fallback email
code = code.replace(/process\.env\.SMTP_USER,\s*\/\/\s*fallback/g, 'process.env.SMTP_USER || "set@gmail.com",');
code = code.replace(/process\.env\.SMTP_USER \|\| "your_email@gmail.com"/g, 'process.env.SMTP_USER || "set@gmail.com"');
code = code.replace(/process\.env\.SMTP_USER/g, '(process.env.SMTP_USER || "set@gmail.com")');

// Wait, doing this blindly might mess up the file. I need to be precise.

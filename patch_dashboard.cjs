const fs = require('fs');
let code = fs.readFileSync('src/pages/Dashboard.tsx', 'utf8');

code = code.replace(/await fetch\('https:\/\/gmail\.googleapis\.com\/gmail\/v1\/users\/me\/messages\/send'[\s\S]*?}\);/, `await fetch('/api/email/send', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                to: email,
                subject: \`New member joined: \${invite.bookName}\`,
                message: \`<p>Hello,</p><p><b>\${userProfile.displayName || userProfile.email}</b> has accepted the invitation and joined the ledger <b>\${invite.bookName}</b>.</p>\`
              })
            });`);
fs.writeFileSync('src/pages/Dashboard.tsx', code);

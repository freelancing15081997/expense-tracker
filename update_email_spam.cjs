const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

// Replace the sendMail block
const newSendMail = `
      // Clean up the message to create a plain text version to avoid spam filters
      const textMessage = message.replace(/<[^>]*>?/gm, '');
      
      const info = await transporter.sendMail({
        from: \`"Ledger Notifications" <\${SYSTEM_EMAIL}>\`,
        to,
        subject,
        text: textMessage, // Add plain text (Crucial for spam avoidance)
        html: \`<!DOCTYPE html>
<html>
<head>
<style>
  body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
  .container { padding: 20px; border: 1px solid #eaeaea; border-radius: 5px; background: #fff; }
</style>
</head>
<body style="background-color: #f9f9f9; padding: 20px;">
  <div class="container" style="max-width: 600px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px;">
    \${message}
    <hr style="border: 0; border-top: 1px solid #eaeaea; margin-top: 20px;">
    <p style="font-size: 12px; color: #888;">This is an automated notification from your Shared Ledger App.</p>
  </div>
</body>
</html>\`,
      });
`;

code = code.replace(/const info = await transporter\.sendMail\(\{\s*from: `"Ledger App" <\$\{SYSTEM_EMAIL\}>`,\s*to,\s*subject,\s*html: message,\s*\}\);/, newSendMail);

fs.writeFileSync('server.ts', code);

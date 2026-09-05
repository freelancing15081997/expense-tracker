const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

// The replacement messed up the try/catch block. Let's fix the whole route.
code = code.replace(/app\.post\("\/api\/email\/send", async \(req, res\) => \{[\s\S]*?\}\);\s*\/\/ Vite middleware/m, `app.post("/api/email/send", async (req, res) => {
    const { to, subject, message } = req.body;

    if (!to || !subject || !message) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    try {
      const transporter = createTransporter();
      
      const textMessage = message.replace(/<[^>]*>?/gm, '');
      
      const info = await transporter.sendMail({
        from: \`"Ledger Notifications" <\${SYSTEM_EMAIL}>\`,
        to,
        subject,
        text: textMessage,
        html: \`<!DOCTYPE html><html><head><style>  body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }  .container { padding: 20px; border: 1px solid #eaeaea; border-radius: 5px; background: #fff; }</style></head><body style="background-color: #f9f9f9; padding: 20px;">  <div class="container" style="max-width: 600px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px;">    \${message}    <hr style="border: 0; border-top: 1px solid #eaeaea; margin-top: 20px;">    <p style="font-size: 12px; color: #888;">This is an automated notification from your Shared Ledger App.</p>  </div></body></html>\`,
      });

      console.log("Message sent: %s", info.messageId);
      res.json({ success: true, messageId: info.messageId });
    } catch (error) {
      console.error("Error sending email:", error);
      res.status(500).json({ error: "Failed to send email" });
    }
  });

  // Vite middleware`);

fs.writeFileSync('server.ts', code);

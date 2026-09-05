import dns from 'dns';
dns.setDefaultResultOrder('ipv4first');
import "dotenv/config";
import express from "express";
import path from "path";
import nodemailer from "nodemailer";

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json());

  // Use the exact email you requested as the fallback/system email
  const SYSTEM_EMAIL = "byjanbooks@gmail.com";

  const createTransporter = () => {
    return nodemailer.createTransport({
      host: "smtp-relay.brevo.com",
      port: 587,
      secure: false, 
      auth: {
        user: "b7ffda001@smtp-brevo.com", 
        pass: "bskbpWFhUtdUJPH", 
      },
    });
  };

  // ==========================================
  // CORE BACKEND APIs (Architecture Structure)
  // ==========================================

  // 1. Email Service API
  // This route is called by the React frontend whenever an email needs to be sent.
  // Because it runs on Node.js, it securely holds the SMTP_PASS and reliably sends
  // the email in the background, completely bypassing the browser's limitations.
  app.post("/api/email/send", async (req, res) => {
    const { to, subject, message } = req.body;

    if (!to || !subject || !message) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    try {
      const transporter = createTransporter();
      
      const textMessage = message.replace(/<[^>]*>?/gm, '');
      
      const info = await transporter.sendMail({
        from: `"Ledger Notifications" <${SYSTEM_EMAIL}>`,
        to,
        subject,
        text: textMessage,
        html: `<!DOCTYPE html><html><head><style>  body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }  .container { padding: 20px; border: 1px solid #eaeaea; border-radius: 5px; background: #fff; }</style></head><body style="background-color: #f9f9f9; padding: 20px;">  <div class="container" style="max-width: 600px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px;">    ${message}    <hr style="border: 0; border-top: 1px solid #eaeaea; margin-top: 20px;">    <p style="font-size: 12px; color: #888;">This is an automated notification from your Shared Ledger App.</p>  </div></body></html>`,
      });

      console.log("Message sent: %s", info.messageId);
      res.json({ success: true, messageId: info.messageId });
    } catch (error) {
      console.error("Error sending email:", error);
      res.status(500).json({ error: "Failed to send email" });
    }
  });

  // Vite middleware for development (Frontend Serving)
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

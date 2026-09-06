import type { VercelRequest, VercelResponse } from '@vercel/node';
import nodemailer from 'nodemailer';

const SYSTEM_EMAIL = "byjanbooks@gmail.com";

const createTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: parseInt(process.env.SMTP_PORT || "587"),
    secure: false, 
    auth: {
      user: process.env.SMTP_USER, 
      pass: process.env.SMTP_PASS, 
    },
  });
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { to, subject, message } = req.body;
  
  if (!to || !subject || !message) {
    return res.status(400).json({ error: "Missing required fields" });
  }
  
  try {
    const transporter = createTransporter();
    const textMessage = message.replace(/<[^>]*>?/gm, '');
    
    const info = await transporter.sendMail({
      from: `"Byjan Notifications" <${SYSTEM_EMAIL}>`,
      to,
      subject,
      text: textMessage,
      html: `
<!DOCTYPE html>
<html>
<head>
<style>
  body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #1e293b; background-color: #f8fafc; margin: 0; padding: 0; }
  .wrapper { width: 100%; background-color: #f8fafc; padding: 40px 20px; }
  .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03); border: 1px solid #e2e8f0; }
  .header { background: linear-gradient(to right, #ea580c, #d97706); padding: 32px; text-align: center; }
  .header h1 { margin: 0; color: #ffffff; font-size: 24px; font-weight: 800; letter-spacing: -0.025em; }
  .header p { margin: 4px 0 0 0; color: #ffedd5; font-size: 12px; text-transform: uppercase; letter-spacing: 0.1em; font-weight: 600; }
  .content { padding: 40px 32px; font-size: 15px; color: #334155; }
  .content p { margin: 0 0 16px 0; }
  .content b { color: #0f172a; font-weight: 600; }
  .footer { background-color: #f1f5f9; padding: 24px; text-align: center; border-top: 1px solid #e2e8f0; }
  .footer p { margin: 0; font-size: 13px; color: #64748b; }
</style>
</head>
<body>
  <div class="wrapper">
    <div class="container">
      <div class="header">
        <h1>Byjan</h1>
        <p>Trace Financials Easily</p>
      </div>
      <div class="content">
        ${message.replace(/\n/g, '<br/>')}
      </div>
      <div class="footer">
        <p>This is an automated notification from Byjan.</p>
        <p style="margin-top: 8px; font-size: 11px; color: #94a3b8;">&copy; ${new Date().getFullYear()} Byjan. All rights reserved.</p>
      </div>
    </div>
  </div>
</body>
</html>
`,
    });
    
    console.log("Message sent: %s", info.messageId);
    res.json({ success: true, messageId: info.messageId });
  } catch (error: any) {
    console.error("Error sending email:", error);
    res.status(500).json({ error: "Failed to send email", details: error.message });
  }
}

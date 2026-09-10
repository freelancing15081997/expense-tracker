import type { VercelRequest, VercelResponse } from '@vercel/node';
import nodemailer from 'nodemailer';
import { readSession } from '../_lib/helpers';

const SYSTEM_EMAIL = "byjanbooks@gmail.com";

const createTransporter = () => {
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  
  if (!smtpUser || !smtpPass) {
    throw new Error('Email notifications are not configured. Please set SMTP_USER and SMTP_PASS environment variables. For Gmail, you need an App Password (not your regular password). See: https://myaccount.google.com/apppasswords');
  }
  
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: parseInt(process.env.SMTP_PORT || "587"),
    secure: false, 
    auth: {
      user: smtpUser, 
      pass: smtpPass, 
    },
  });
};

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '50mb', // Vercel has limits but we request max
    },
  },
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const uid = await readSession(req);
  if (!uid) {
    return res.status(401).json({ error: 'Sign in required' });
  }

  const { to, subject, message, pdfBase64, filename } = req.body;
  if (!to || !subject || !pdfBase64) {
    return res.status(400).json({ error: "Missing required fields" });
  }
  
  try {
    const transporter = createTransporter();
    const textMessage = message ? message.replace(/<[^>]*>?/gm, '') : 'Please find the attached report.';
    
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
        <p>${textMessage}</p>
        <p><b>Please find the attached PDF report.</b></p>
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
      attachments: [
        {
          filename: filename || 'report.pdf',
          content: pdfBase64,
          encoding: 'base64'
        }
      ]
    });
    
    console.log("Report sent: %s", info.messageId);
    res.json({ success: true, messageId: info.messageId });
  } catch (error: any) {
    console.error("Error sending report:", error);
    
    // Provide helpful error messages
    let errorMessage = "Failed to send report";
    if (error.message?.includes('not configured')) {
      errorMessage = error.message;
    } else if (error.code === 'EAUTH' || error.responseCode === 535) {
      errorMessage = "Email authentication failed. Please check your SMTP_USER and SMTP_PASS. For Gmail, you need an App Password.";
    } else if (error.code === 'ECONNECTION' || error.code === 'ETIMEDOUT') {
      errorMessage = "Cannot connect to email server. Please check your SMTP_HOST and SMTP_PORT settings.";
    }
    
    res.status(500).json({ 
      error: errorMessage, 
      details: error.message,
      hint: "Set up email in your .env file. See .env.example for instructions."
    });
  }
}

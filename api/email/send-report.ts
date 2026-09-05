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
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { to, subject, message, pdfBase64, filename } = req.body;
  if (!to || !subject || !pdfBase64) {
    return res.status(400).json({ error: "Missing required fields" });
  }
  
  try {
    const transporter = createTransporter();
    const textMessage = message ? message.replace(/<[^>]*>?/gm, '') : 'Please find the attached report.';
    
    const info = await transporter.sendMail({
      from: `"SET App Notifications" <${SYSTEM_EMAIL}>`,
      to,
      subject,
      text: textMessage,
      html: `<p>${textMessage}</p>`,
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
    res.status(500).json({ error: "Failed to send report", details: error.message });
  }
}

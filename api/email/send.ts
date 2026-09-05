import type { VercelRequest, VercelResponse } from '@vercel/node';
import nodemailer from 'nodemailer';

const SYSTEM_EMAIL = "byjanbooks@gmail.com";

const createTransporter = () => {
  return nodemailer.createTransport({
    host: "smtp-relay.brevo.com",
    port: 2525,
    secure: false, 
    auth: {
      user: "b7ffda001@smtp-brevo.com", 
      pass: "bskbpWFhUtdUJPH", 
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
      from: `"Ledger Notifications" <${SYSTEM_EMAIL}>`,
      to,
      subject,
      text: textMessage,
      html: `<!DOCTYPE html><html><head><style>  body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }  .container { padding: 20px; border: 1px solid #eaeaea; border-radius: 5px; background: #fff; }</style></head><body style="background-color: #f9f9f9; padding: 20px;">  <div class="container" style="max-width: 600px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px;">    ${message}    <hr style="border: 0; border-top: 1px solid #eaeaea; margin-top: 20px;">    <p style="font-size: 12px; color: #888;">This is an automated notification from your Shared Ledger App.</p>  </div></body></html>`,
    });
    
    console.log("Message sent: %s", info.messageId);
    res.json({ success: true, messageId: info.messageId });
  } catch (error: any) {
    console.error("Error sending email:", error);
    res.status(500).json({ error: "Failed to send email", details: error.message });
  }
}

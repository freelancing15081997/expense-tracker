import dns from 'dns';
import "dotenv/config";
import express from "express";
import path from "path";
import nodemailer from "nodemailer";
import { handleBlobDeleteRequest, handleBlobUploadRequest } from "./api/_lib/blob-store";
import { handleAuthRequest } from "./api/_lib/auth-handler";
import { applyCors, requireUser } from "./api/_lib/helpers";

dns.setDefaultResultOrder('ipv4first');

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use("/api", (req, res, next) => {
  applyCors(req, res);
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  next();
});
app.use("/neondb/auth", (req, res, next) => {
  applyCors(req, res);
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  next();
});

app.post("/api/blob/upload", express.raw({ type: "*/*", limit: "9mb" }), (req, res) => {
  void handleBlobUploadRequest(req, res);
});
app.post("/api/blob/handle", express.json({ limit: "1mb" }), async (req, res) => {
  const { default: handle } = await import("./api/blob/handle");
  await handle(req as any, res as any);
});
app.post("/api/blob/delete", express.json({ limit: "1mb" }), (req, res) => {
  void handleBlobDeleteRequest(req, res);
});
app.get("/api/blob/file", async (req, res) => {
  const { default: file } = await import("./api/blob/file");
  await file(req as any, res as any);
});

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

app.use("/api/auth", (req, res) => {
  void handleAuthRequest(req, res);
});
app.use("/neondb/auth", (req, res) => {
  void handleAuthRequest(req, res);
});
app.all("/api/kv", async (req, res) => {
  const { default: kv } = await import("./api/kv");
  await kv(req as any, res as any);
});
app.all("/api/invites", async (req, res) => {
  const { default: invites } = await import("./api/invites");
  await invites(req as any, res as any);
});
app.all("/api/ledgers", async (req, res) => {
  const { default: ledgers } = await import("./api/ledgers");
  await ledgers(req as any, res as any);
});
app.all("/api/expenses", async (req, res) => {
  const { default: expenses } = await import("./api/expenses");
  await expenses(req as any, res as any);
});
app.all("/api/notifications", async (req, res) => {
  const { default: notifications } = await import("./api/notifications");
  await notifications(req as any, res as any);
});
app.all("/api/me", async (req, res) => {
  const { default: me } = await import("./api/me");
  await me(req as any, res as any);
});
app.post("/api/email/inbound", async (req, res) => {
  const { default: inbound } = await import("./api/email/inbound");
  await inbound(req as any, res as any);
});
app.post("/api/migrate", async (req, res) => {
  const { default: migrate } = await import("./api/migrate");
  await migrate(req as any, res as any);
});

const DEFAULT_FROM = "byjanbooks@easypado.com";
const SYSTEM_EMAIL = (() => {
  const raw = String(process.env.MAIL_FROM || DEFAULT_FROM).trim();
  if (!raw || /gmail\.com$/i.test(raw)) return DEFAULT_FROM;
  return raw;
})();

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

app.post("/api/email/send-report", async (req, res) => {
  const uid = await requireUser(req, res);
  if (!uid) return;
  const { to, subject, message, pdfBase64, filename } = req.body;
  if (!to || !subject || !pdfBase64) {
    return res.status(400).json({ error: "Missing required fields" });
  }
  try {
    const transporter = createTransporter();
    const textMessage = message ? message.replace(/<[^>]*>?/gm, '') : 'Please find the attached report.';
    
    const info = await transporter.sendMail({
      from: `"Byjan Notifications" <${SYSTEM_EMAIL}>`,
      replyTo: SYSTEM_EMAIL,
      envelope: { from: SYSTEM_EMAIL, to },
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
  } catch (error) {
    console.error("Error sending report:", error);
    res.status(500).json({ error: "Failed to send report" });
  }
});

app.post("/api/email/send", async (req, res) => {
  const uid = await requireUser(req, res);
  if (!uid) return;
  const { to, subject, message } = req.body;
  if (!to || !subject || !message) {
    return res.status(400).json({ error: "Missing required fields" });
  }
  try {
    const transporter = createTransporter();
    const textMessage = message.replace(/<[^>]*>?/gm, '');
    
    const info = await transporter.sendMail({
      from: `"Byjan Notifications" <${SYSTEM_EMAIL}>`,
      replyTo: SYSTEM_EMAIL,
      envelope: { from: SYSTEM_EMAIL, to },
      to,
      subject,
      text: textMessage,
      html: `<!DOCTYPE html><html><head><style>  body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }  .container { padding: 20px; border: 1px solid #eaeaea; border-radius: 5px; background: #fff; }</style></head><body style="background-color: #f9f9f9; padding: 20px;">  <div class="container" style="max-width: 600px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px;">    ${message}    <hr style="border: 0; border-top: 1px solid #eaeaea; margin-top: 20px;">    <p style="font-size: 12px; color: #888;">This is an automated notification from Byjan.</p>  </div></body></html>`,
    });
    console.log("Message sent: %s", info.messageId);
    res.json({ success: true, messageId: info.messageId });
  } catch (error) {
    console.error("Error sending email:", error);
    res.status(500).json({ error: "Failed to send email" });
  }
});

// For local development or standard Node deployment
if (process.env.NODE_ENV !== "production") {
  import("vite").then(({ createServer: createViteServer }) => {
    createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    }).then((vite) => {
      app.use(vite.middlewares);
      app.listen(PORT, "0.0.0.0", () => {
        console.log(`Server running on http://localhost:${PORT}`);
      });
    });
  });
} else {
  // In production (non-Vercel environments), serve the dist folder
  // Note: Vercel will ignore this branch because it uses Serverless functions and serves dist statically
  if (!process.env.VERCEL) {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  }
}

// Export the express app so Vercel can use it as a serverless function
export default app;

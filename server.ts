import dns from 'dns';
import "dotenv/config";
import express from "express";
import path from "path";
import { handleBlobDeleteRequest, handleBlobUploadRequest } from "./api/_lib/blob-store";
import { handleAuthRequest } from "./api/_lib/auth-handler";
import { applyCors, requireUser } from "./api/_lib/helpers";
import { sendTracedMail, smtpConfigured } from "./api/_lib/smtp-mail";
import { publicServiceError } from "./api/_lib/ops-classify";

dns.setDefaultResultOrder('ipv4first');

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const PRODUCTION_API = String(process.env.VITE_API_URL || 'https://www.easypado.com').replace(/\/+$/, '');

async function proxyEmailToProduction(req: express.Request, res: express.Response, path: string) {
  if (/localhost|127\.0\.0\.1/i.test(PRODUCTION_API)) {
    res.status(503).json({ error: publicServiceError(new Error('SMTP'), 'Email is temporarily unavailable. Please try again later.') });
    return;
  }
  const auth = String(req.headers.authorization || '');
  const r = await fetch(`${PRODUCTION_API}${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(auth ? { authorization: auth } : {}),
    },
    body: JSON.stringify(req.body || {}),
  });
  const text = await r.text();
  res.status(r.status);
  res.setHeader('content-type', r.headers.get('content-type') || 'application/json');
  res.send(text);
}

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
app.post("/api/blob/delete", express.json({ limit: "1mb" }), (req, res) => {
  void handleBlobDeleteRequest(req, res);
});
app.get("/api/blob/file", async (req, res) => {
  const { default: file } = await import("./api/blob/file");
  await file(req as any, res as any);
});

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// OTP must not go through the Neon Auth proxy — it uses Brevo/Gmail SMTP directly.
app.all("/api/auth/otp", async (req, res) => {
  const { default: otp } = await import("./api/auth/otp");
  await otp(req as any, res as any);
});

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
app.all(["/api/ledgers", "/api/expenses", "/api/notifications", "/api/me", "/api/support", "/api/books", "/api/tracker"], async (req, res) => {
  const { default: tracker } = await import("./api/tracker");
  await tracker(req as any, res as any);
});
app.post("/api/email/inbound", async (req, res) => {
  const { default: inbound } = await import("./api/email/inbound");
  await inbound(req as any, res as any);
});
app.post("/api/migrate", async (req, res) => {
  const { default: migrate } = await import("./api/migrate");
  await migrate(req as any, res as any);
});

app.post("/api/email/send-report", async (req, res) => {
  if (!process.env.VERCEL && !smtpConfigured()) {
    try {
      await proxyEmailToProduction(req, res, "/api/email/send-report");
    } catch (error: any) {
      res.status(502).json({ error: publicServiceError(error, "Could not send the report email. Please try again.") });
    }
    return;
  }
  const uid = await requireUser(req, res);
  if (!uid) return;
  const { to, subject, message, pdfBase64, filename } = req.body;
  const pdf = String(pdfBase64 || '').replace(/^data:application\/pdf[^,]*,/i, '').replace(/\s+/g, '');
  if (!to || !subject || !pdf) {
    return res.status(400).json({ error: "Missing report, address, or subject" });
  }
  try {
    const textMessage = message ? String(message).replace(/<[^>]*>?/gm, '') : 'Please find the attached report.';
    const info = await sendTracedMail({
      to,
      subject,
      text: `${textMessage}\n\nThe PDF report is attached.`,
      html: `<p>${textMessage}</p><p>The PDF is attached.</p>`,
      fromName: 'Byjan',
      kind: 'email.send-report',
      attachments: [
        {
          filename: String(filename || 'Byjan_Report.pdf').replace(/[^\w.-]+/g, '_'),
          content: pdf,
          encoding: 'base64',
          contentType: 'application/pdf',
        },
      ],
    });
    console.log("Report sent: %s", info.messageId);
    res.json({ success: true, messageId: info.messageId });
  } catch (error: any) {
    console.error("Error sending report:", error);
    res.status(500).json({ error: publicServiceError(error, "Could not send the report email. Please try again.") });
  }
});

app.post("/api/email/send", async (req, res) => {
  if (!process.env.VERCEL && !smtpConfigured()) {
    try {
      await proxyEmailToProduction(req, res, "/api/email/send");
    } catch (error: any) {
      res.status(502).json({ error: publicServiceError(error, "Could not send this email. Please try again.") });
    }
    return;
  }
  const uid = await requireUser(req, res);
  if (!uid) return;
  const { to, subject, message } = req.body;
  if (!to || !subject || !message) {
    return res.status(400).json({ error: "Missing required fields" });
  }
  try {
    const textMessage = String(message).replace(/<[^>]*>?/gm, '');
    const info = await sendTracedMail({
      to,
      subject,
      text: textMessage,
      html: `<!DOCTYPE html><html><head><style>  body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }  .container { padding: 20px; border: 1px solid #eaeaea; border-radius: 5px; background: #fff; }</style></head><body style="background-color: #f9f9f9; padding: 20px;">  <div class="container" style="max-width: 600px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px;">    ${message}    <hr style="border: 0; border-top: 1px solid #eaeaea; margin-top: 20px;">    <p style="font-size: 12px; color: #888;">This is an automated notification from Byjan.</p>  </div></body></html>`,
      fromName: 'Byjan Notifications',
      kind: 'email.send',
    });
    console.log("Message sent: %s", info.messageId);
    res.json({ success: true, messageId: info.messageId });
  } catch (error: any) {
    console.error("Error sending email:", error);
    res.status(500).json({ error: publicServiceError(error, "Could not send this email. Please try again.") });
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

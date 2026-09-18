import type { VercelRequest, VercelResponse } from '@vercel/node';

const FIREBASE_PROJECT = 'gen-lang-client-0616065043';

const BUILTIN_SUPER = ['pujaribadrinath@gmail.com', 'byjanbooks@gmail.com'];

function parseEmails(raw: string) {
  return String(raw || '')
    .split(/[,;\s]+/)
    .map((v) => v.trim().toLowerCase())
    .filter(Boolean);
}

function isSuperEmail(email?: string | null) {
  const needle = String(email || '').trim().toLowerCase();
  if (!needle) return false;
  const extra = parseEmails(String(process.env.SUPER_USER_EMAILS || process.env.VITE_SUPER_USER_EMAILS || ''));
  return [...BUILTIN_SUPER, ...extra].includes(needle);
}

function json(res: VercelResponse, status: number, payload: unknown) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json');
  res.setHeader('cache-control', 'no-store');
  res.end(JSON.stringify(payload));
}

function cors(req: VercelRequest, res: VercelResponse) {
  const origin = String(req.headers.origin || '');
  res.setHeader('Access-Control-Allow-Origin', origin || '*');
  if (origin) res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization,Content-Type');
}

async function requireUser(req: VercelRequest) {
  const header = String(req.headers.authorization || '');
  const token = header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : '';
  if (!token) return null;
  const { createRemoteJWKSet, jwtVerify } = await import('jose');
  const { payload } = await jwtVerify(
    token,
    createRemoteJWKSet(new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com')),
    {
      issuer: `https://securetoken.google.com/${FIREBASE_PROJECT}`,
      audience: FIREBASE_PROJECT,
    },
  );
  return {
    uid: String(payload.user_id || payload.sub || ''),
    email: String(payload.email || '').toLowerCase(),
  };
}

function envPresence(name: string) {
  const v = String(process.env[name] || '').trim();
  return { name, set: Boolean(v), length: v ? v.length : 0 };
}

function freeTier() {
  const checks = [
    { id: 'smtp', label: 'Brevo SMTP', ok: Boolean(process.env.SMTP_USER && process.env.SMTP_PASS), hint: 'SMTP_USER / SMTP_PASS' },
    { id: 'neon', label: 'Neon Postgres', ok: Boolean(process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.NEON_DATABASE_URL), hint: 'DATABASE_URL' },
    { id: 'r2', label: 'Cloudflare R2', ok: Boolean(process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY && process.env.R2_BUCKET_NAME), hint: 'R2_*' },
    { id: 'firebase', label: 'Firebase project', ok: Boolean(FIREBASE_PROJECT), hint: 'JWT audience' },
    { id: 'gemini', label: 'Gemini / AI', ok: Boolean(process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY), hint: 'GEMINI_API_KEY' },
    { id: 'fcm', label: 'FCM push', ok: Boolean(process.env.FIREBASE_SERVICE_ACCOUNT || process.env.FCM_SERVER_KEY || process.env.GOOGLE_APPLICATION_CREDENTIALS), hint: 'service account' },
  ];
  return checks;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    cors(req, res);
    if (req.method === 'OPTIONS') {
      res.statusCode = 204;
      res.end();
      return;
    }
    if (req.method !== 'GET') {
      json(res, 405, { error: 'GET required' });
      return;
    }
    const user = await requireUser(req);
    if (!user?.uid) {
      json(res, 401, { error: 'Sign in required' });
      return;
    }
    if (!isSuperEmail(user.email)) {
      json(res, 403, { error: 'Trace is only available to super admins.' });
      return;
    }

    const { ledgerList } = await import('../_pg-tables.js');
    const rows = await ledgerList('ops/trace/');
    const events = (Array.isArray(rows) ? rows : [])
      .map((row: any) => {
        const data = row?.data && typeof row.data === 'object' ? row.data : row;
        return data && typeof data === 'object' ? { id: row.id || data.id, ...data } : null;
      })
      .filter(Boolean)
      .sort((a: any, b: any) => String(b.at || '').localeCompare(String(a.at || '')))
      .slice(0, 120);

    const tiers = freeTier();
    const emailFails = events.filter((e: any) => (e.kind === 'email.send' || e.kind === 'email.config') && e.ok === false).slice(0, 40);
    const emailOk = events.filter((e: any) => e.kind === 'email.send' && e.ok === true).slice(0, 20);

    json(res, 200, {
      at: new Date().toISOString(),
      actor: { uid: user.uid, email: user.email },
      health: {
        smtp: tiers.find((t) => t.id === 'smtp'),
        database: tiers.find((t) => t.id === 'neon'),
        storage: tiers.find((t) => t.id === 'r2'),
        ai: tiers.find((t) => t.id === 'gemini'),
        push: tiers.find((t) => t.id === 'fcm'),
      },
      freeTiers: tiers,
      env: [
        envPresence('SMTP_HOST'),
        envPresence('SMTP_USER'),
        envPresence('SMTP_PASS'),
        envPresence('MAIL_FROM'),
        envPresence('DATABASE_URL'),
        envPresence('POSTGRES_URL'),
        envPresence('R2_BUCKET_NAME'),
        envPresence('GEMINI_API_KEY'),
      ],
      email: {
        recentOk: emailOk.length,
        recentFailed: emailFails.length,
        lastFail: emailFails[0] || null,
        fails: emailFails,
        sent: emailOk,
      },
      events,
      note: 'Super-admin only. No secrets are returned — only presence and lengths.',
    });
  } catch (err: any) {
    json(res, 500, { error: err?.message || 'Trace failed' });
  }
}

import type { VercelRequest, VercelResponse } from '@vercel/node';

function json(res: VercelResponse, status: number, payload: unknown) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify(payload));
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const origin = String(req.headers.origin || '');
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
    if (origin) res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET,HEAD,POST,PUT,PATCH,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization,Content-Type');
    if (req.method === 'OPTIONS') {
      res.statusCode = 204;
      res.end();
      return;
    }
    if (req.method !== 'POST') {
      json(res, 405, { error: 'POST required' });
      return;
    }

    const { createRemoteJWKSet, jwtVerify } = await import('jose');
    const header = String(req.headers.authorization || '');
    const token = header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : '';
    if (!token) {
      json(res, 401, { error: 'Sign in required' });
      return;
    }
    const jwks = createRemoteJWKSet(
      new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'),
    );
    const { payload } = await jwtVerify(token, jwks, {
      issuer: 'https://securetoken.google.com/gen-lang-client-0616065043',
      audience: 'gen-lang-client-0616065043',
    });
    const uid = String(payload.user_id || payload.sub || '');
    if (!uid) {
      json(res, 401, { error: 'Sign in required' });
      return;
    }

    // Records are read from Firestore by /api/kv when Postgres is unset.
    // Copying here would import api/_lib, which Vercel does not bundle.
    json(res, 200, { copied: 0, skipped: true });
  } catch (err: any) {
    json(res, 500, { error: err?.message || 'Copy failed' });
  }
}

export const config = { maxDuration: 60 };

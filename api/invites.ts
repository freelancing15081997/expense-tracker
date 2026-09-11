import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ledgerDel, ledgerGet, ledgerList, ledgerSet } from './_pg-tables.js';

const FIREBASE_PROJECT = 'gen-lang-client-0616065043';
const jwtMem = new Map<string, { uid: string; email: string; exp: number }>();
let jwks: any = null;

type Role = { role?: string; email?: string };

function json(res: VercelResponse, status: number, payload: unknown) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify(payload));
}

async function userFromToken(token: string) {
  const hit = jwtMem.get(token);
  if (hit && hit.exp > Date.now() + 5000) return hit;
  const { createRemoteJWKSet, jwtVerify } = await import('jose');
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'));
  }
  const { payload } = await jwtVerify(token, jwks, {
    issuer: `https://securetoken.google.com/${FIREBASE_PROJECT}`,
    audience: FIREBASE_PROJECT,
  });
  const uid = String(payload.user_id || payload.sub || '');
  const email = String(payload.email || '').trim().toLowerCase();
  const exp = Number(payload.exp || 0) * 1000 || Date.now() + 50_000;
  if (!uid) return null;
  const session = { uid, email, exp };
  jwtMem.set(token, session);
  if (jwtMem.size > 300) jwtMem.clear();
  return session;
}

function asRoles(value: unknown): Record<string, Role> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, Role>;
}

function memberEmails(roles: Record<string, Role>, exceptEmail?: string) {
  const skip = String(exceptEmail || '').trim().toLowerCase();
  const out: string[] = [];
  for (const row of Object.values(roles)) {
    const email = String(row?.email || '').trim().toLowerCase();
    if (!email || (skip && email === skip) || out.includes(email)) continue;
    out.push(email);
  }
  return out;
}

function canManage(roles: Record<string, Role>, uid: string) {
  const role = String(roles[uid]?.role || '');
  return role === 'owner' || role === 'admin';
}

function inviteId(bookId: string, email: string) {
  return `${bookId}_${email}`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const origin = String(req.headers.origin || '');
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
    if (origin) res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET,HEAD,POST,OPTIONS');
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

    const header = String(req.headers.authorization || '');
    const token = header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : '';
    const user = token ? await userFromToken(token) : null;
    if (!user) {
      json(res, 401, { error: 'Sign in required' });
      return;
    }

    const rawBody = req.body;
    const body = typeof rawBody === 'string'
      ? JSON.parse(rawBody || '{}')
      : (rawBody && typeof rawBody === 'object' ? rawBody : {});
    const op = String(body.op || '');

    if (op === 'list') {
      const rows = await ledgerList('invites', [{ type: 'where', field: 'email', op: '==', value: user.email }]);
      const invites = rows
        .map((row) => ({ id: row.id, ...row.data }))
        .filter((row) => String(row.invitedBy || '') !== user.uid);
      json(res, 200, { invites });
      return;
    }

    if (op === 'create') {
      const bookId = String(body.bookId || '').trim();
      const email = String(body.email || '').trim().toLowerCase();
      const role = String(body.role || 'contributor').trim() || 'contributor';
      if (!bookId || !email) {
        json(res, 400, { error: 'Ledger and email are required' });
        return;
      }
      const book = await ledgerGet(`books/${bookId}`);
      if (!book) {
        json(res, 404, { error: 'Ledger not found' });
        return;
      }
      const roles = asRoles(book.roles);
      if (!canManage(roles, user.uid)) {
        json(res, 403, { error: 'Not allowed to invite members' });
        return;
      }
      const id = inviteId(bookId, email);
      const data = {
        email,
        bookId,
        bookName: String(book.name || body.bookName || 'Ledger'),
        role,
        invitedBy: user.uid,
        status: 'pending',
      };
      await ledgerSet(`invites/${id}`, data);
      json(res, 200, { id, invite: { id, ...data } });
      return;
    }

    if (op === 'accept') {
      const id = String(body.id || '').trim();
      if (!id) {
        json(res, 400, { error: 'Missing invite' });
        return;
      }
      const invite = await ledgerGet(`invites/${id}`);
      if (!invite) {
        json(res, 404, { error: 'Invite not found' });
        return;
      }
      if (String(invite.email || '').trim().toLowerCase() !== user.email) {
        json(res, 403, { error: 'This invite is not for your account' });
        return;
      }
      const bookId = String(invite.bookId || '').trim();
      const book = await ledgerGet(`books/${bookId}`);
      if (!book) {
        json(res, 404, { error: 'Ledger not found' });
        return;
      }
      const roles = {
        ...asRoles(book.roles),
        [user.uid]: { role: String(invite.role || 'contributor'), email: user.email },
      };
      await ledgerSet(`books/${bookId}`, { ...book, roles });
      await ledgerDel(`invites/${id}`);
      json(res, 200, {
        ok: true,
        bookId,
        bookName: String(invite.bookName || book.name || ''),
        notifyEmails: memberEmails(roles, user.email),
      });
      return;
    }

    if (op === 'decline') {
      const id = String(body.id || '').trim();
      if (!id) {
        json(res, 400, { error: 'Missing invite' });
        return;
      }
      const invite = await ledgerGet(`invites/${id}`);
      if (invite && String(invite.email || '').trim().toLowerCase() !== user.email) {
        json(res, 403, { error: 'This invite is not for your account' });
        return;
      }
      await ledgerDel(`invites/${id}`);
      json(res, 200, { ok: true });
      return;
    }

    json(res, 400, { error: 'Unknown op' });
  } catch (err: any) {
    json(res, 500, { error: err?.message || 'Invite request failed' });
  }
}

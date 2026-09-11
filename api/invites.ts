import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ledgerAudit, ledgerGet, ledgerList, ledgerSet } from './_pg-tables.js';

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

function isPending(invite: Record<string, unknown> | null) {
  if (!invite) return false;
  if (invite.deleted === true || invite.deleted === 'true') return false;
  const status = String(invite.status || 'pending');
  return status === 'pending';
}

async function closeInvite(id: string, invite: Record<string, unknown>, status: string, actorUid: string) {
  await ledgerSet(`invites/${id}`, {
    ...invite,
    status,
    deleted: true,
    deletedAt: new Date().toISOString(),
    closedBy: actorUid,
  });
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
    let user = null;
    try {
      user = token ? await userFromToken(token) : null;
    } catch {
      user = null;
    }
    const rawBody = req.body;
    const body = typeof rawBody === 'string'
      ? JSON.parse(rawBody || '{}')
      : (rawBody && typeof rawBody === 'object' ? rawBody : {});
    const op = String(body.op || '');

    if (op === 'peek') {
      const id = String(body.id || '').trim();
      if (!id) {
        json(res, 400, { error: 'Missing invite' });
        return;
      }
      if (!user) {
        json(res, 200, { status: 'auth_required' });
        return;
      }
      const invite = await ledgerGet(`invites/${id}`);
      if (!invite) {
        json(res, 200, { status: 'missing' });
        return;
      }
      const invitedEmail = String(invite.email || '').trim().toLowerCase();
      if (invitedEmail !== user.email) {
        json(res, 200, {
          status: 'wrong_account',
          invitedEmail,
          currentEmail: user.email,
        });
        return;
      }
      const bookId = String(invite.bookId || '').trim();
      const book = bookId ? await ledgerGet(`books/${bookId}`) : null;
      const roles = asRoles(book?.roles);
      if (roles[user.uid]) {
        json(res, 200, { status: 'already_member', bookId });
        return;
      }
      if (!isPending(invite)) {
        json(res, 200, { status: 'closed', bookId });
        return;
      }
      json(res, 200, {
        status: 'ok',
        invite: {
          id,
          bookId,
          bookName: String(invite.bookName || book?.name || 'Ledger'),
          role: String(invite.role || 'contributor'),
          invitedBy: String(invite.invitedBy || ''),
          email: invitedEmail,
        },
      });
      return;
    }

    if (!user) {
      json(res, 401, { error: 'Sign in required' });
      return;
    }

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
      if (email === user.email) {
        json(res, 400, { error: 'You already have access to this ledger' });
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
        invitedByEmail: user.email,
        status: 'pending',
        deleted: false,
        createdAt: new Date().toISOString(),
      };
      await ledgerSet(`invites/${id}`, data);
      await ledgerAudit({
        bookId,
        actorUid: user.uid,
        actorEmail: user.email,
        action: 'invite_created',
        entityType: 'invite',
        entityId: id,
        detail: { email, role },
      }).catch(() => undefined);
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
      if (!invite || !isPending(invite)) {
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
      await closeInvite(id, invite, 'accepted', user.uid);
      await ledgerAudit({
        bookId,
        actorUid: user.uid,
        actorEmail: user.email,
        action: 'invite_accepted',
        entityType: 'invite',
        entityId: id,
        detail: { role: invite.role },
      }).catch(() => undefined);
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
      if (invite) await closeInvite(id, invite, 'declined', user.uid);
      await ledgerAudit({
        bookId: String(invite?.bookId || ''),
        actorUid: user.uid,
        actorEmail: user.email,
        action: 'invite_declined',
        entityType: 'invite',
        entityId: id,
      }).catch(() => undefined);
      json(res, 200, { ok: true });
      return;
    }

    json(res, 400, { error: 'Unknown op' });
  } catch (err: any) {
    json(res, 500, { error: err?.message || 'Invite request failed' });
  }
}

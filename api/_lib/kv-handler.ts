import type { IncomingMessage, ServerResponse } from 'http';
import { applyCors, kvDel, kvGet, kvList, kvSet, newId, readJsonBody, readNeonSession, sendJson } from './helpers';
import { getDocument, listDocuments } from './firestore-import';
import { remapFirebaseUidIfNeeded } from './remap';

function getAt(obj: any, path: string) {
  return path.split('.').reduce((acc, key) => (acc == null ? acc : acc[key]), obj);
}

function extractToken(req: IncomingMessage) {
  const header = String(req.headers.authorization || '');
  return header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : '';
}

async function readDoc(path: string, token: string) {
  try {
    const local = await kvGet(path);
    if (local) return local;
  } catch {
    // Blob/Postgres may be missing on Vercel; fall through to Firestore reads.
  }
  const remote = await getDocument(token, path);
  return remote?.data || null;
}

async function readList(path: string, token: string) {
  const byId = new Map<string, { id: string; data: Record<string, unknown> }>();
  try {
    for (const row of await kvList(path)) byId.set(row.id, row);
  } catch {
    // Same fallback as readDoc.
  }
  try {
    for (const row of await listDocuments(token, path)) {
      const id = String(row.path.split('/').pop() || '');
      if (!id || byId.has(id)) continue;
      byId.set(id, { id, data: row.data });
    }
  } catch {
    // Firestore list is best-effort when security rules hide a collection.
  }
  return [...byId.values()];
}

export async function handleKvRequest(req: IncomingMessage & { body?: unknown }, res: ServerResponse) {
  applyCors(req, res);
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }
  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method not allowed' });
    return;
  }

  const session = await readNeonSession(req);
  if (!session?.uid) {
    sendJson(res, 401, { error: 'Sign in required' });
    return;
  }
  try {
    await remapFirebaseUidIfNeeded(session);
  } catch {
    // Remap is best-effort; do not block reads/writes.
  }

  try {
    const body = await readJsonBody(req);
    const op = String(body.op || '');
    const path = String(body.path || '').replace(/^\/+|\/+$/g, '');

    const token = extractToken(req);

    if (op === 'get') {
      const data = await readDoc(path, token);
      sendJson(res, 200, { exists: Boolean(data), id: path.split('/').pop(), data });
      return;
    }

    if (op === 'set') {
      const current = (await readDoc(path, token)) || {};
      const next = { ...((body.merge && typeof current === 'object') ? current : {}), ...(body.data || {}) };
      await kvSet(path, next);
      sendJson(res, 200, { ok: true, id: path.split('/').pop(), data: next });
      return;
    }

    if (op === 'update') {
      const current = (await readDoc(path, token)) || {};
      const patch = body.data || {};
      const next = { ...current };
      for (const [key, value] of Object.entries(patch)) {
        if (value && typeof value === 'object' && (value as any).__delete) {
          const parts = key.split('.');
          let cur: any = next;
          for (let i = 0; i < parts.length - 1; i++) {
            if (!cur[parts[i]]) break;
            cur = cur[parts[i]];
          }
          if (cur) delete cur[parts[parts.length - 1]];
        } else if (key.includes('.')) {
          const parts = key.split('.');
          let cur: any = next;
          for (let i = 0; i < parts.length - 1; i++) {
            if (typeof cur[parts[i]] !== 'object' || !cur[parts[i]]) cur[parts[i]] = {};
            cur = cur[parts[i]];
          }
          cur[parts[parts.length - 1]] = value;
        } else {
          next[key] = value;
        }
      }
      await kvSet(path, next);
      sendJson(res, 200, { ok: true, data: next });
      return;
    }

    if (op === 'delete') {
      await kvDel(path);
      sendJson(res, 200, { ok: true });
      return;
    }

    if (op === 'add') {
      const id = newId();
      const data = { ...(body.data || {}), id };
      await kvSet(`${path}/${id}`, data);
      sendJson(res, 200, { id, data });
      return;
    }

    if (op === 'list' || op === 'query') {
      let rows = await readList(path, token);
      const constraints = Array.isArray(body.constraints) ? body.constraints : [];
      for (const c of constraints) {
        if (c.type === 'where' && c.op === '==') {
          rows = rows.filter((row) => getAt({ id: row.id, ...row.data }, c.field) === c.value);
        } else if (c.type === 'where' && c.op === 'in') {
          const allowed = Array.isArray(c.value) ? c.value : [];
          rows = rows.filter((row) => allowed.includes(getAt({ id: row.id, ...row.data }, c.field)));
        } else if (c.type === 'orderBy') {
          const dir = c.dir === 'desc' ? -1 : 1;
          rows.sort((a, b) => String(getAt(a.data, c.field) || '').localeCompare(String(getAt(b.data, c.field) || '')) * dir);
        } else if (c.type === 'limit') {
          rows = rows.slice(0, Number(c.n) || rows.length);
        }
      }
      sendJson(res, 200, { docs: rows });
      return;
    }

    sendJson(res, 400, { error: 'Unknown op' });
  } catch (err: any) {
    sendJson(res, 500, { error: err?.message || 'Data request failed' });
  }
}

import type { IncomingMessage, ServerResponse } from 'http';
import { applyCors, kvDel, kvGet, kvList, kvSet, newId, readJsonBody, readNeonSession, sendJson } from '../vercel/helpers';
import { remapFirebaseUidIfNeeded } from '../vercel/remap';

function getAt(obj: any, path: string) {
  return path.split('.').reduce((acc, key) => (acc == null ? acc : acc[key]), obj);
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
  await remapFirebaseUidIfNeeded(session);

  try {
    const body = await readJsonBody(req);
    const op = String(body.op || '');
    const path = String(body.path || '').replace(/^\/+|\/+$/g, '');

    if (op === 'get') {
      const data = await kvGet(path);
      sendJson(res, 200, { exists: Boolean(data), id: path.split('/').pop(), data });
      return;
    }

    if (op === 'set') {
      const current = (await kvGet(path)) || {};
      const next = { ...((body.merge && typeof current === 'object') ? current : {}), ...(body.data || {}) };
      await kvSet(path, next);
      sendJson(res, 200, { ok: true, id: path.split('/').pop(), data: next });
      return;
    }

    if (op === 'update') {
      const current = (await kvGet(path)) || {};
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
      let rows = await kvList(path);
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

import { kvGet, kvList, kvListPrefix, kvSet } from './db';
import type { NeonSession } from './helpers';

const EMAIL_MAP = 'migrations/email-map';
const inFlight = new Map<string, Promise<void>>();

function normEmail(email: string) {
  return email.trim().toLowerCase();
}

function rewriteValue(value: unknown, oldUid: string, newUid: string): unknown {
  if (value === oldUid) return newUid;
  if (Array.isArray(value)) return value.map((item) => rewriteValue(item, oldUid, newUid));
  if (!value || typeof value !== 'object') return value;
  const out: Record<string, unknown> = {};
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    const nextKey = key === oldUid ? newUid : key;
    const nextVal = rewriteValue(nested, oldUid, newUid);
    if (nextKey in out && out[nextKey] && typeof out[nextKey] === 'object' && nextVal && typeof nextVal === 'object') {
      out[nextKey] = { ...(out[nextKey] as Record<string, unknown>), ...(nextVal as Record<string, unknown>) };
    } else {
      out[nextKey] = nextVal;
    }
  }
  return out;
}

function rewritePath(path: string, oldUid: string, newUid: string) {
  return path
    .split('/')
    .map((part) => {
      if (part === oldUid) return newUid;
      if (part === `t_${oldUid}`) return `t_${newUid}`;
      return part;
    })
    .join('/');
}

function collectUidsFromRoles(data: Record<string, unknown>, email: string) {
  const found = new Set<string>();
  const roles = data.roles;
  if (roles && typeof roles === 'object') {
    for (const [uid, info] of Object.entries(roles as Record<string, any>)) {
      if (normEmail(String(info?.email || '')) === email) found.add(uid);
    }
  }
  const members = data.members;
  if (members && typeof members === 'object') {
    for (const [uid, info] of Object.entries(members as Record<string, any>)) {
      if (normEmail(String(info?.email || '')) === email) found.add(uid);
    }
  }
  if (normEmail(String(data.email || '')) === email && typeof data.id === 'string') found.add(data.id);
  return found;
}

async function findFirebaseUids(session: NeonSession) {
  const email = normEmail(session.email);
  const uids = new Set<string>();
  if (!email) return uids;

  const mapDoc = await kvGet(EMAIL_MAP);
  const mapped = mapDoc && typeof mapDoc === 'object' ? (mapDoc as Record<string, any>)[email] : null;
  if (mapped?.firebaseUid) uids.add(String(mapped.firebaseUid));

  for (const row of await kvList('books')) {
    for (const uid of collectUidsFromRoles(row.data, email)) uids.add(uid);
  }
  for (const row of await kvList('users')) {
    if (normEmail(String(row.data.email || '')) === email) uids.add(row.id);
  }
  for (const row of await kvListPrefix('erp_workspaces')) {
    if (!row.path.endsWith('/meta/tenant')) continue;
    for (const uid of collectUidsFromRoles(row.data, email)) uids.add(uid);
    const parts = row.path.split('/');
    if (parts[0] === 'erp_workspaces' && parts[1] && normEmail(String(row.data.email || '')) === email) {
      uids.add(parts[1]);
    }
  }

  uids.delete(session.uid);
  return uids;
}

async function copyUidOwnedRows(oldUid: string, newUid: string) {
  const prefixes = [
    `users/${oldUid}`,
    `erp_workspaces/${oldUid}`,
    `financeMembers/${oldUid}`,
    `financeTenants/t_${oldUid}`,
  ];
  const seen = new Set<string>();
  for (const prefix of prefixes) {
    let rows: { path: string; data: Record<string, unknown> }[] = [];
    try {
      rows = await kvListPrefix(prefix);
    } catch {
      continue;
    }
    for (const row of rows) {
      if (seen.has(row.path)) continue;
      seen.add(row.path);
      const rewritten = rewriteValue(row.data, oldUid, newUid) as Record<string, unknown>;
      const dest = rewritePath(row.path, oldUid, newUid);
      if (dest !== row.path) {
        const existing = await kvGet(dest);
        if (!existing) await kvSet(dest, rewritten);
        else if (dest.startsWith('users/') || dest.endsWith('/meta/tenant')) {
          await kvSet(dest, {
            ...rewritten,
            ...existing,
            email: existing.email || rewritten.email,
            displayName: existing.displayName || rewritten.displayName,
            roles: { ...((rewritten.roles as object) || {}), ...((existing.roles as object) || {}) },
            members: { ...((rewritten.members as object) || {}), ...((existing.members as object) || {}) },
            memberIds: [...new Set([
              ...((Array.isArray(rewritten.memberIds) ? rewritten.memberIds : []) as string[]),
              ...((Array.isArray(existing.memberIds) ? existing.memberIds : []) as string[]),
              newUid,
            ])],
            ownerId: existing.ownerId || rewritten.ownerId || newUid,
          });
        }
      }
    }
  }
}

async function rewriteSharedRows(oldUid: string, newUid: string) {
  for (const root of ['books', 'notifications', 'invites', 'erp_files']) {
    let rows: { id: string; data: Record<string, unknown> }[] = [];
    try {
      rows = await kvList(root);
    } catch {
      continue;
    }
    for (const row of rows) {
      const path = `${root}/${row.id}`;
      await kvSet(path, rewriteValue(row.data, oldUid, newUid) as Record<string, unknown>);
    }
  }

  const bookRows = await kvList('books');
  for (const book of bookRows) {
    for (const sub of ['expenses']) {
      const children = await kvList(`books/${book.id}/${sub}`);
      for (const child of children) {
        await kvSet(
          `books/${book.id}/${sub}/${child.id}`,
          rewriteValue(child.data, oldUid, newUid) as Record<string, unknown>,
        );
      }
    }
  }
}

async function runRemap(session: NeonSession) {
  const email = normEmail(session.email);
  if (!email) return;
  const done = await kvGet(`migrations/uid-remap/${session.uid}`);
  if (done?.at) return;

  const oldUids = [...await findFirebaseUids(session)];
  for (const oldUid of oldUids) {
    await copyUidOwnedRows(oldUid, session.uid);
    await rewriteSharedRows(oldUid, session.uid);
  }

  const mapDoc = (await kvGet(EMAIL_MAP)) || {};
  const prev = (mapDoc[email] && typeof mapDoc[email] === 'object') ? mapDoc[email] as Record<string, unknown> : {};
  await kvSet(EMAIL_MAP, {
    ...mapDoc,
    [email]: {
      ...prev,
      firebaseUid: prev.firebaseUid || oldUids[0] || null,
      neonUid: session.uid,
      remappedAt: new Date().toISOString(),
    },
  });
  await kvSet(`migrations/uid-remap/${session.uid}`, {
    email,
    firebaseUids: oldUids,
    at: new Date().toISOString(),
  });
}

export async function remapFirebaseUidIfNeeded(session: NeonSession) {
  const existing = inFlight.get(session.uid);
  if (existing) {
    await existing;
    return;
  }
  const task = runRemap(session).catch((err) => {
    console.error('uid remap failed', err);
  });
  inFlight.set(session.uid, task);
  try {
    await task;
  } finally {
    inFlight.delete(session.uid);
  }
}

import { kvGet, kvSet } from './db';

const PROJECT = process.env.FIREBASE_PROJECT_ID || 'gen-lang-client-0616065043';
const DATABASE = process.env.FIREBASE_DATABASE_ID || 'ai-studio-sharedsheetexpen-15aa5fbb-9604-4c59-b4a3-aa994442cb50';
const ROOT = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/${DATABASE}/documents`;
let readsOk = false;

function decodeValue(value: any): unknown {
  if (value == null || typeof value !== 'object') return value;
  if ('nullValue' in value) return null;
  if ('booleanValue' in value) return value.booleanValue;
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return value.doubleValue;
  if ('stringValue' in value) return value.stringValue;
  if ('timestampValue' in value) return value.timestampValue;
  if ('bytesValue' in value) return value.bytesValue;
  if ('referenceValue' in value) return String(value.referenceValue).split('/documents/').pop() || value.referenceValue;
  if ('geoPointValue' in value) return value.geoPointValue;
  if ('arrayValue' in value) return (value.arrayValue.values || []).map(decodeValue);
  if ('mapValue' in value) {
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value.mapValue.fields || {})) out[key] = decodeValue(val);
    return out;
  }
  return value;
}

function pathFromName(name: string) {
  const marker = `/documents/`;
  const idx = name.indexOf(marker);
  return idx >= 0 ? name.slice(idx + marker.length) : '';
}

function decodeDoc(json: any) {
  const path = pathFromName(String(json.name || ''));
  const data: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(json.fields || {})) data[key] = decodeValue(val);
  return { path, data };
}

async function fsFetch(token: string, url: string, init?: RequestInit) {
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      ...(init?.headers || {}),
    },
  });
  return res;
}

export async function getDocument(token: string, path: string) {
  const res = await fsFetch(token, `${ROOT}/${path}`);
  if (res.status === 404 || res.status === 403) return null;
    if (!res.ok) return null;
    readsOk = true;
    return decodeDoc(await res.json());
}

export async function listDocuments(token: string, colPath: string) {
  const out: { path: string; data: Record<string, unknown> }[] = [];
  let pageToken = '';
  for (let i = 0; i < 20; i++) {
    const url = new URL(`${ROOT}/${colPath}`);
    url.searchParams.set('pageSize', '100');
    if (pageToken) url.searchParams.set('pageToken', pageToken);
    const res = await fsFetch(token, url.toString());
    if (res.status === 403 || res.status === 404) break;
    if (!res.ok) break;
    readsOk = true;
    const json = await res.json();
    for (const doc of json.documents || []) out.push(decodeDoc(doc));
    pageToken = json.nextPageToken || '';
    if (!pageToken) break;
  }
  return out;
}

async function listCollectionIds(token: string, parentPath: string) {
  const parent = parentPath ? `${ROOT}/${parentPath}` : ROOT;
  const res = await fsFetch(token, `${parent}:listCollectionIds`, {
    method: 'POST',
    body: JSON.stringify({ pageSize: 100 }),
  });
  if (!res.ok) return [] as string[];
  const json = await res.json();
  return (json.collectionIds || []) as string[];
}

async function walkDoc(token: string, path: string, rows: { path: string; data: Record<string, unknown> }[]) {
  const doc = await getDocument(token, path);
  if (doc?.path) rows.push(doc);
  const cols = await listCollectionIds(token, path);
  for (const col of cols) {
    const docs = await listDocuments(token, `${path}/${col}`);
    for (const child of docs) {
      if (!child.path) continue;
      await walkDoc(token, child.path, rows);
    }
  }
}

export async function importFirestoreForUser(uid: string, token: string) {
  const marker = `migrations/copied/${uid}`;
  const already = await kvGet(marker);
  if (already?.done) return { copied: 0, skipped: true };
  readsOk = false;

  const rows: { path: string; data: Record<string, unknown> }[] = [];
  await walkDoc(token, `users/${uid}`, rows);
  await walkDoc(token, `erp_workspaces/${uid}`, rows);
  await walkDoc(token, `financeMembers/${uid}`, rows);
  await walkDoc(token, `financeTenants/t_${uid}`, rows);

  for (const col of ['books', 'notifications', 'invites', 'erp_files']) {
    const docs = await listDocuments(token, col);
    for (const doc of docs) {
      if (!doc.path) continue;
      await walkDoc(token, doc.path, rows);
    }
  }

  let copied = 0;
  for (const row of rows) {
    const path = String(row.path || '').replace(/^\/+|\/+$/g, '');
    if (!path) continue;
    await kvSet(path, row.data || {});
    copied += 1;
  }

  if (copied > 0 || readsOk) {
    await kvSet(marker, { done: true, at: new Date().toISOString(), copied, uid });
  }
  return { copied, skipped: false };
}

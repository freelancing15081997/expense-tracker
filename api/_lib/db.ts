import { r2GetJson } from './r2.js';
import {
  postgresUrl,
  cleanPath,
  asObject,
  ledgerGet,
  ledgerSet,
  ledgerDel,
  ledgerList,
} from './pg-tables';

const DOC_PREFIX = 'documents/';

function blobKey(path: string) {
  return `${DOC_PREFIX}${cleanPath(path)}.json`;
}

async function blobGet(path: string): Promise<Record<string, unknown> | null> {
  return asObject(await r2GetJson(blobKey(path)));
}

export async function kvGet(path: string): Promise<Record<string, unknown> | null> {
  if (postgresUrl()) return ledgerGet(path);
  return blobGet(path);
}

export async function kvSet(path: string, data: unknown) {
  if (!postgresUrl()) throw new Error('Postgres is not configured. Ledger rows are stored in Neon, not R2.');
  await ledgerSet(path, data);
}

export async function kvDel(path: string) {
  if (!postgresUrl()) throw new Error('Postgres is not configured. Ledger rows are stored in Neon, not R2.');
  await ledgerDel(path);
}

export async function kvList(prefix: string) {
  if (!postgresUrl()) throw new Error('Postgres is not configured. Ledger rows are stored in Neon, not R2.');
  return ledgerList(prefix);
}

export async function kvListPrefix(prefix: string) {
  if (!postgresUrl()) throw new Error('Postgres is not configured. Ledger rows are stored in Neon, not R2.');
  const p = cleanPath(prefix);
  const self = await ledgerGet(p);
  const children = await ledgerList(p);
  const out: { path: string; data: Record<string, unknown> }[] = [];
  if (self) out.push({ path: p, data: self });
  for (const row of children) out.push({ path: `${p}/${row.id}`, data: row.data });
  return out;
}

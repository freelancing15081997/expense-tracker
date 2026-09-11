#!/usr/bin/env node
/**
 * Build SQL you can paste into Neon → SQL Editor.
 *
 *   npm run neon:export              dump what is already in Neon
 *   npm run neon:export-firestore    dump Firestore (needs Admin credentials)
 *
 * Writes ops/neon/import.sql (gitignored). Does not print secrets.
 */
import 'dotenv/config';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { neon } from '@neondatabase/serverless';

const require = createRequire(import.meta.url);
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'ops', 'neon');
const fromFirestore = process.argv.includes('--firestore');

function postgresUrl() {
  const raw = process.env.DATABASE_URL || process.env.POSTGRES_URL || '';
  if (!raw) throw new Error('Set DATABASE_URL in .env');
  try {
    const url = new URL(raw);
    url.searchParams.delete('channel_binding');
    return url.toString();
  } catch {
    return raw;
  }
}

function sqlString(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function jsonLiteral(data) {
  const raw = JSON.stringify(data ?? {});
  if (raw.includes('$neon$')) {
    return `${sqlString(raw)}::jsonb`;
  }
  return `$neon$${raw}$neon$::jsonb`;
}

function schemaSql() {
  return `-- Generated ${new Date().toISOString()}
-- Import order: run this whole file in Neon SQL Editor.

CREATE TABLE IF NOT EXISTS documents (
  path TEXT PRIMARY KEY,
  data JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS documents_path_idx ON documents (path);
CREATE INDEX IF NOT EXISTS documents_updated_at_idx ON documents (updated_at);

`;
}

function insertSql(rows) {
  const chunks = [];
  const size = 40;
  for (let i = 0; i < rows.length; i += size) {
    const slice = rows.slice(i, i + size);
    const values = slice.map((row) => {
      const updated = row.updated_at ? sqlString(row.updated_at) : 'NOW()';
      return `(${sqlString(row.path)}, ${jsonLiteral(row.data)}, ${updated}::timestamptz)`;
    });
    chunks.push(`INSERT INTO documents (path, data, updated_at)
VALUES
${values.join(',\n')}
ON CONFLICT (path) DO UPDATE SET
  data = EXCLUDED.data,
  updated_at = EXCLUDED.updated_at;
`);
  }
  return chunks.join('\n');
}

async function fromNeon() {
  const sql = neon(postgresUrl());
  await sql`CREATE TABLE IF NOT EXISTS documents (
    path TEXT PRIMARY KEY,
    data JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  const rows = await sql`SELECT path, data, updated_at FROM documents ORDER BY path`;
  return rows.map((row) => ({
    path: String(row.path),
    data: row.data,
    updated_at: row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at || ''),
  }));
}

function toJson(value) {
  if (value == null) return value;
  if (typeof value.toDate === 'function') return value.toDate().toISOString();
  if (typeof value.toMillis === 'function') return new Date(value.toMillis()).toISOString();
  if (value._seconds != null || value.seconds != null) {
    const seconds = value._seconds ?? value.seconds;
    const nanos = value._nanoseconds ?? value.nanoseconds ?? 0;
    return new Date(seconds * 1000 + nanos / 1e6).toISOString();
  }
  if (Array.isArray(value)) return value.map(toJson);
  if (typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = toJson(v);
    return out;
  }
  return value;
}

async function exportTree(docRef, path, rows) {
  const snap = await docRef.get();
  if (snap.exists) rows.push({ path, data: toJson(snap.data()) || {}, updated_at: new Date().toISOString() });
  const cols = await docRef.listCollections();
  for (const col of cols) {
    const docs = await col.listDocuments();
    for (const child of docs) await exportTree(child, `${path}/${child.id}`, rows);
  }
}

async function fromFs() {
  let admin;
  let getFirestore;
  try {
    admin = require('firebase-admin');
    ({ getFirestore } = require('firebase-admin/firestore'));
  } catch {
    throw new Error('Install firebase-admin: npm install firebase-admin --no-save');
  }
  const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'gen-lang-client-0616065043';
  const DATABASE_ID = process.env.FIREBASE_DATABASE_ID || 'ai-studio-sharedsheetexpen-15aa5fbb-9604-4c59-b4a3-aa994442cb50';
  const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  const email = process.env.FIREBASE_CLIENT_EMAIL;
  const key = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!admin.apps.length) {
    if (json) admin.initializeApp({ credential: admin.credential.cert(JSON.parse(json)), projectId: PROJECT_ID });
    else if (email && key) {
      admin.initializeApp({
        credential: admin.credential.cert({ projectId: PROJECT_ID, clientEmail: email, privateKey: key }),
      });
    } else if (credPath) {
      admin.initializeApp({ credential: admin.credential.applicationDefault(), projectId: PROJECT_ID });
    } else {
      throw new Error('Set GOOGLE_APPLICATION_CREDENTIALS or FIREBASE_SERVICE_ACCOUNT_JSON to export Firestore.');
    }
  }
  let db;
  try {
    db = getFirestore(admin.app(), DATABASE_ID);
  } catch {
    db = getFirestore(admin.app());
  }
  const rows = [];
  for (const col of await db.listCollections()) {
    for (const docRef of await col.listDocuments()) {
      await exportTree(docRef, `${col.id}/${docRef.id}`, rows);
    }
  }
  return rows;
}

async function main() {
  mkdirSync(outDir, { recursive: true });
  const rows = fromFirestore ? await fromFs() : await fromNeon();
  const body = `${schemaSql()}-- ${rows.length} documents from ${fromFirestore ? 'Firestore' : 'Neon'}\n\n${insertSql(rows)}`;
  const file = join(outDir, fromFirestore ? 'import-firestore.sql' : 'import.sql');
  writeFileSync(file, body);
  const counts = {};
  for (const row of rows) {
    const top = String(row.path).split('/')[0] || '(root)';
    counts[top] = (counts[top] || 0) + 1;
  }
  console.log(`Wrote ${file}`);
  console.log(`Documents: ${rows.length}`);
  console.log(JSON.stringify(counts, null, 2));
  console.log('\nIn Neon SQL Editor: paste ops/neon/schema.sql if needed, then this import file. ON CONFLICT updates matching paths.');
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});

#!/usr/bin/env node
/**
 * One-time copy of Firestore documents into Neon Postgres `documents(path, data jsonb)`.
 *
 * Named Firestore DB used by this app:
 *   ai-studio-sharedsheetexpen-15aa5fbb-9604-4c59-b4a3-aa994442cb50
 *
 * Credentials (any one is enough), never commit them:
 *   GOOGLE_APPLICATION_CREDENTIALS=/path/to/serviceAccount.json
 *   FIREBASE_SERVICE_ACCOUNT_JSON='{"type":"service_account",...}'
 *   FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY
 *
 * Optional:
 *   FIREBASE_PROJECT_ID  FIREBASE_DATABASE_ID
 *   BLOB_READ_WRITE_TOKEN  (copy Firebase Storage receipt bytes to Vercel Blob)
 *
 * Run: npm run migrate:firestore
 */
import 'dotenv/config';
import { createRequire } from 'module';
import { neon } from '@neondatabase/serverless';
import { put } from '@vercel/blob';

const require = createRequire(import.meta.url);

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID || 'gen-lang-client-0616065043';
const DATABASE_ID = process.env.FIREBASE_DATABASE_ID || process.env.VITE_FIREBASE_DATABASE_ID || 'ai-studio-sharedsheetexpen-15aa5fbb-9604-4c59-b4a3-aa994442cb50';

function postgresUrl() {
  const raw = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!raw) throw new Error('Set DATABASE_URL or POSTGRES_URL');
  try {
    const url = new URL(raw);
    url.searchParams.delete('channel_binding');
    return url.toString();
  } catch {
    return raw;
  }
}

function loadAdmin() {
  let admin;
  let getFirestore;
  try {
    admin = require('firebase-admin');
    ({ getFirestore } = require('firebase-admin/firestore'));
  } catch {
    throw new Error('Install firebase-admin to run this script: npm install firebase-admin --no-save');
  }

  const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  const email = process.env.FIREBASE_CLIENT_EMAIL;
  const key = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;

  if (!admin.apps.length) {
    if (json) {
      admin.initializeApp({ credential: admin.credential.cert(JSON.parse(json)), projectId: PROJECT_ID });
    } else if (email && key) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: PROJECT_ID,
          clientEmail: email,
          privateKey: key,
        }),
      });
    } else if (credPath) {
      admin.initializeApp({ credential: admin.credential.applicationDefault(), projectId: PROJECT_ID });
    } else {
      throw new Error(
        'Missing Firebase Admin credentials. Set GOOGLE_APPLICATION_CREDENTIALS, FIREBASE_SERVICE_ACCOUNT_JSON, or FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY.',
      );
    }
  }

  try {
    return getFirestore(admin.app(), DATABASE_ID);
  } catch {
    return getFirestore(admin.app());
  }
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
  if (Buffer.isBuffer(value)) return { __bytes: value.toString('base64') };
  if (typeof value === 'object') {
    if (value.isEqual && value.path) return { __ref: value.path };
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = toJson(v);
    return out;
  }
  return value;
}

async function exportTree(docRef, path, rows) {
  const snap = await docRef.get();
  if (snap.exists) rows.push({ path, data: toJson(snap.data()) || {} });
  const cols = await docRef.listCollections();
  for (const col of cols) {
    const docs = await col.listDocuments();
    for (const child of docs) {
      await exportTree(child, `${path}/${child.id}`, rows);
    }
  }
}

function collectEmailMap(rows) {
  const map = {};
  for (const row of rows) {
    const data = row.data || {};
    const parts = row.path.split('/');
    if (parts[0] === 'users' && parts.length === 2 && data.email) {
      map[String(data.email).trim().toLowerCase()] = { firebaseUid: parts[1], email: data.email };
    }
    const roles = data.roles;
    if (roles && typeof roles === 'object') {
      for (const [uid, info] of Object.entries(roles)) {
        const email = String(info?.email || '').trim().toLowerCase();
        if (email) map[email] = { ...(map[email] || {}), firebaseUid: map[email]?.firebaseUid || uid, email };
      }
    }
    const members = data.members;
    if (members && typeof members === 'object') {
      for (const [uid, info] of Object.entries(members)) {
        const email = String(info?.email || '').trim().toLowerCase();
        if (email) map[email] = { ...(map[email] || {}), firebaseUid: map[email]?.firebaseUid || uid, email };
      }
    }
  }
  return map;
}

async function walkUrls(value, visit) {
  if (typeof value === 'string') return visit(value);
  if (Array.isArray(value)) {
    const out = [];
    for (const item of value) out.push(await walkUrls(item, visit));
    return out;
  }
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = await walkUrls(v, visit);
    return out;
  }
  return value;
}

function isFirebaseFileUrl(url) {
  return /firebasestorage\.googleapis\.com|firebasestorage\.app|googleapis\.com\/download\/storage/.test(url);
}

async function copyFirebaseFiles(rows) {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    console.log('Skipping Blob copy (BLOB_READ_WRITE_TOKEN not set). Firebase Storage URLs are left as-is.');
    return { copied: 0, left: 0 };
  }
  const cache = new Map();
  let copied = 0;
  let left = 0;
  for (const row of rows) {
    row.data = await walkUrls(row.data, async (url) => {
      if (typeof url !== 'string' || !url.startsWith('http') || !isFirebaseFileUrl(url)) return url;
      if (cache.has(url)) return cache.get(url);
      try {
        const res = await fetch(url);
        if (!res.ok) {
          left += 1;
          cache.set(url, url);
          return url;
        }
        const buf = Buffer.from(await res.arrayBuffer());
        const ext = (url.split('?')[0].split('.').pop() || 'bin').replace(/[^a-z0-9]/gi, '').slice(0, 8) || 'bin';
        const pathname = `migrated/${copied}-${Date.now()}.${ext}`;
        const blob = await put(pathname, buf, {
          access: 'public',
          token,
          addRandomSuffix: true,
          ...(process.env.BLOB_STORE_ID ? { storeId: process.env.BLOB_STORE_ID } : {}),
        });
        cache.set(url, blob.url);
        copied += 1;
        return blob.url;
      } catch {
        left += 1;
        cache.set(url, url);
        return url;
      }
    });
  }
  return { copied, left };
}

async function listAuthUsers(admin) {
  const out = [];
  try {
    let next;
    do {
      const batch = await admin.auth().listUsers(1000, next);
      for (const user of batch.users) {
        if (user.email) out.push({ email: user.email.toLowerCase(), firebaseUid: user.uid });
      }
      next = batch.pageToken;
    } while (next);
  } catch (err) {
    console.log('Could not list Firebase Auth users:', err.message);
  }
  return out;
}

async function main() {
  console.log('🚀 Starting Firebase to Neon migration...\n');
  
  // Test database connection
  let sql;
  try {
    sql = neon(postgresUrl());
    await sql`SELECT 1`;
    console.log('✓ Neon database connection successful');
  } catch (err) {
    console.error('❌ Failed to connect to Neon database:', err.message);
    console.error('\nPlease check:');
    console.error('  - DATABASE_URL or POSTGRES_URL is set in .env');
    console.error('  - The connection string is valid');
    console.error('  - Your Neon project is active');
    process.exit(1);
  }

  // Create schema
  await sql`CREATE TABLE IF NOT EXISTS documents (
    path TEXT PRIMARY KEY,
    data JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  await sql`CREATE INDEX IF NOT EXISTS documents_path_idx ON documents (path)`;
  await sql`CREATE INDEX IF NOT EXISTS documents_updated_at_idx ON documents (updated_at)`;
  console.log('✓ Database schema ready');

  let adminMod;
  try {
    adminMod = require('firebase-admin');
  } catch {
    adminMod = null;
  }

  let db;
  try {
    db = loadAdmin();
    console.log('✓ Firebase Admin initialized');
  } catch (err) {
    console.error('\n❌ Failed to initialize Firebase Admin:', err.message);
    console.error('\nThe app still remaps Firebase uids → Neon uids on first login by email once rows exist in Postgres.');
    process.exitCode = 1;
    return;
  }

  const rows = [];
  const rootCols = await db.listCollections();
  console.log('\n📚 Exporting Firestore collections...');
  console.log('Root collections:', rootCols.map((c) => c.id).join(', ') || '(none)');
  
  for (const col of rootCols) {
    const docs = await col.listDocuments();
    console.log(`  📁 ${col.id}: ${docs.length} documents`);
    let exported = 0;
    for (const docRef of docs) {
      await exportTree(docRef, `${col.id}/${docRef.id}`, rows);
      exported++;
      if (exported % 50 === 0) {
        console.log(`     Exported ${exported}/${docs.length} documents from ${col.id}...`);
      }
    }
    console.log(`  ✓ Completed ${col.id}: ${exported} documents exported`);
  }
  console.log(`\n✓ Total documents exported: ${rows.length}`);

  if (rows.length === 0) {
    console.warn('\n⚠️  Warning: No documents found in Firestore.');
    console.warn('   This could mean:');
    console.warn('   - Firebase database is empty');
    console.warn('   - Service account lacks read permissions');
    console.warn('   - Wrong project ID or database ID');
    console.log('\nContinuing anyway to set up the schema...');
  }

  console.log('\n📦 Copying Firebase Storage files to Vercel Blob...');
  const fileStats = await copyFirebaseFiles(rows);
  if (fileStats.copied > 0) {
    console.log(`✓ Copied ${fileStats.copied} files to Vercel Blob`);
  }
  if (fileStats.left > 0) {
    console.log(`⚠️  ${fileStats.left} files left on Firebase Storage`);
  }
  
  console.log('\n👥 Mapping user emails...');
  const emailMap = collectEmailMap(rows);
  if (adminMod) {
    for (const user of await listAuthUsers(adminMod)) {
      emailMap[user.email] = { ...(emailMap[user.email] || {}), ...user };
    }
  }

  rows.push({
    path: 'migrations/email-map',
    data: emailMap,
  });
  rows.push({
    path: 'migrations/firestore-copy',
    data: {
      at: new Date().toISOString(),
      databaseId: DATABASE_ID,
      projectId: PROJECT_ID,
      rows: rows.length,
      emails: Object.keys(emailMap).length,
      filesCopied: fileStats.copied,
      filesLeftOnFirebase: fileStats.left,
    },
  });

  console.log('\n💾 Writing to Neon Postgres...');
  let upserts = 0;
  const batchSize = 100;
  
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    for (const row of batch) {
      const path = String(row.path || '').replace(/^\/+|\/+$/g, '');
      if (!path) continue;
      const payload = JSON.stringify(row.data ?? {});
      await sql`
        INSERT INTO documents (path, data, updated_at)
        VALUES (${path}, ${payload}::jsonb, NOW())
        ON CONFLICT (path) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()
      `;
      upserts += 1;
    }
    console.log(`  Wrote ${Math.min(i + batchSize, rows.length)}/${rows.length} documents...`);
  }

  const count = await sql`SELECT count(*)::int AS n FROM documents`;
  
  console.log('\n✅ Migration completed successfully!\n');
  console.log('📊 Summary:');
  console.log(JSON.stringify({
    copiedFromFirestore: rows.length - 2,
    upserts,
    totalPostgresDocuments: count[0].n,
    emailsMapped: Object.keys(emailMap).length,
    filesCopiedToBlob: fileStats.copied,
    firebaseFileUrlsLeft: fileStats.left,
  }, null, 2));
  
  console.log('\n🎯 Next steps:');
  console.log('  1. Run: npm run validate:migration');
  console.log('  2. Test your application locally');
  console.log('  3. Update production environment variables');
  console.log('  4. Deploy to production\n');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

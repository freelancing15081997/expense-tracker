#!/usr/bin/env node
/**
 * Pre-flight checks before migration
 * Validates environment setup without running the migration
 */
import 'dotenv/config';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

let hasErrors = false;

function error(msg) {
  console.error(`❌ ${msg}`);
  hasErrors = true;
}

function warn(msg) {
  console.warn(`⚠️  ${msg}`);
}

function success(msg) {
  console.log(`✅ ${msg}`);
}

console.log('🔍 Running pre-flight checks...\n');

// Check Node version
const nodeVersion = process.version;
const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
if (majorVersion < 18) {
  error(`Node.js ${nodeVersion} detected. Minimum required: v18.0.0`);
} else {
  success(`Node.js ${nodeVersion}`);
}

// Check DATABASE_URL
const dbUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;
if (!dbUrl) {
  error('DATABASE_URL or POSTGRES_URL not set');
  console.log('  Set this in your .env file:');
  console.log('  DATABASE_URL=postgresql://user:password@host.neon.tech/dbname\n');
} else {
  success('Database URL configured');
  
  // Validate URL format
  try {
    const url = new URL(dbUrl);
    if (!url.protocol.startsWith('postgres')) {
      error('DATABASE_URL must start with postgresql://');
    }
    if (!url.hostname) {
      error('DATABASE_URL missing hostname');
    }
    if (!url.pathname || url.pathname === '/') {
      warn('DATABASE_URL may be missing database name');
    }
  } catch (err) {
    error(`Invalid DATABASE_URL format: ${err.message}`);
  }
}

// Check Firebase credentials
const projectId = process.env.FIREBASE_PROJECT_ID;
const databaseId = process.env.FIREBASE_DATABASE_ID;

if (!projectId || !databaseId) {
  error('FIREBASE_PROJECT_ID and FIREBASE_DATABASE_ID must be set');
} else {
  success('Firebase project configured');
}

// Check for at least one credential method
const hasServiceAccountJson = Boolean(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
const hasCredPath = Boolean(process.env.GOOGLE_APPLICATION_CREDENTIALS);
const hasIndividualCreds = Boolean(
  process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY
);

if (!hasServiceAccountJson && !hasCredPath && !hasIndividualCreds) {
  error('No Firebase credentials found. Set one of:');
  console.log('  - FIREBASE_SERVICE_ACCOUNT_JSON (entire JSON as string)');
  console.log('  - GOOGLE_APPLICATION_CREDENTIALS (path to JSON file)');
  console.log('  - FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY\n');
} else {
  if (hasServiceAccountJson) success('Firebase credentials: Service Account JSON');
  if (hasCredPath) success('Firebase credentials: JSON file path');
  if (hasIndividualCreds) success('Firebase credentials: Individual keys');
}

// Check firebase-admin is installed
console.log('\n📦 Checking dependencies...');
try {
  require('firebase-admin');
  success('firebase-admin installed');
} catch {
  warn('firebase-admin not installed');
  console.log('  Install with: npm install firebase-admin --no-save\n');
}

// Check @neondatabase/serverless
try {
  require('@neondatabase/serverless');
  success('@neondatabase/serverless installed');
} catch {
  error('@neondatabase/serverless not installed');
  console.log('  Install with: npm install\n');
}

// Check optional Blob storage
console.log('\n📦 Optional services...');
const hasBlobToken = Boolean(process.env.BLOB_READ_WRITE_TOKEN);
if (hasBlobToken) {
  success('Vercel Blob configured (files will be migrated)');
} else {
  warn('BLOB_READ_WRITE_TOKEN not set (files will stay on Firebase)');
}

// Summary
console.log('\n' + '='.repeat(60));
if (hasErrors) {
  console.log('❌ Pre-flight checks FAILED');
  console.log('\nFix the errors above before running migration.');
  console.log('See SETUP.md for configuration help.\n');
  process.exit(1);
} else {
  console.log('✅ Pre-flight checks PASSED');
  console.log('\nYou\'re ready to run the migration!');
  console.log('\nNext steps:');
  console.log('  1. npm run migrate:firestore');
  console.log('  2. npm run validate:migration');
  console.log('  3. npm run dev (to test locally)\n');
}

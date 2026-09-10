#!/usr/bin/env node
/**
 * Validate that Neon migration completed successfully
 */
import 'dotenv/config';
import { neon } from '@neondatabase/serverless';

function postgresUrl() {
  const raw = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!raw) throw new Error('Set DATABASE_URL or POSTGRES_URL in .env');
  try {
    const url = new URL(raw);
    url.searchParams.delete('channel_binding');
    return url.toString();
  } catch {
    return raw;
  }
}

async function main() {
  console.log('🔍 Validating Neon Migration...\n');

  const sql = neon(postgresUrl());

  // Check database connection
  console.log('✓ Database connection successful');

  // Check if documents table exists
  const tables = await sql`
    SELECT tablename FROM pg_tables 
    WHERE schemaname = 'public' AND tablename = 'documents'
  `;
  
  if (tables.length === 0) {
    console.error('❌ Documents table not found. Run migration first.');
    process.exit(1);
  }
  console.log('✓ Documents table exists');

  // Check total document count
  const totalCount = await sql`SELECT COUNT(*)::int as count FROM documents`;
  console.log(`✓ Total documents: ${totalCount[0].count}`);

  if (totalCount[0].count === 0) {
    console.warn('⚠️  Warning: No documents found. Migration may not have run or Firebase was empty.');
  }

  // Check for migration metadata
  const migrationInfo = await sql`
    SELECT data FROM documents 
    WHERE path = 'migrations/firestore-copy'
  `;

  if (migrationInfo.length > 0) {
    const info = migrationInfo[0].data;
    console.log('\n📊 Migration Stats:');
    console.log(`   - Migrated at: ${info.at}`);
    console.log(`   - Total rows: ${info.rows}`);
    console.log(`   - Emails mapped: ${info.emails}`);
    console.log(`   - Files copied: ${info.filesCopied}`);
    console.log(`   - Files left on Firebase: ${info.filesLeftOnFirebase}`);
  }

  // Check collection distribution
  const collections = await sql`
    SELECT 
      split_part(path, '/', 1) as collection,
      COUNT(*)::int as count
    FROM documents
    WHERE path NOT LIKE 'migrations/%'
    GROUP BY split_part(path, '/', 1)
    ORDER BY count DESC
  `;

  if (collections.length > 0) {
    console.log('\n📚 Collections:');
    for (const col of collections) {
      console.log(`   - ${col.collection}: ${col.count} documents`);
    }
  }

  // Check for user data
  const userCount = await sql`
    SELECT COUNT(*)::int as count FROM documents 
    WHERE path LIKE 'users/%'
  `;
  console.log(`\n👥 User documents: ${userCount[0].count}`);

  // Check indexes
  const indexes = await sql`
    SELECT indexname FROM pg_indexes 
    WHERE schemaname = 'public' AND tablename = 'documents'
  `;
  console.log(`\n📇 Indexes: ${indexes.length}`);
  for (const idx of indexes) {
    console.log(`   - ${idx.indexname}`);
  }

  // Sample a few documents
  const samples = await sql`
    SELECT path, jsonb_object_keys(data) as keys
    FROM documents
    WHERE path NOT LIKE 'migrations/%'
    LIMIT 5
  `;

  if (samples.length > 0) {
    console.log('\n📄 Sample Documents:');
    const pathKeys = new Map();
    for (const sample of samples) {
      if (!pathKeys.has(sample.path)) {
        pathKeys.set(sample.path, []);
      }
      pathKeys.get(sample.path).push(sample.keys);
    }
    for (const [path, keys] of pathKeys) {
      console.log(`   - ${path}`);
      console.log(`     Fields: ${keys.join(', ')}`);
    }
  }

  console.log('\n✅ Migration validation complete!');
  console.log('\n🚀 Next steps:');
  console.log('   1. Test your application locally');
  console.log('   2. Verify all features work correctly');
  console.log('   3. Update production environment variables');
  console.log('   4. Deploy to production');
}

main().catch((err) => {
  console.error('\n❌ Validation failed:', err.message);
  process.exit(1);
});

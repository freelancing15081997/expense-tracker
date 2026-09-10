# Firebase to Neon Migration Guide

This guide will help you migrate all your Firebase data to Neon Postgres database.

## Prerequisites

Before starting, you'll need:
- [ ] A Neon account (sign up at https://neon.tech)
- [ ] Firebase service account credentials for data export
- [ ] Vercel Blob storage token (optional, for file migration)

## Step 1: Set Up Neon Database

1. **Create a Neon Project:**
   - Go to https://console.neon.tech
   - Click "New Project"
   - Name it (e.g., "expense-tracker")
   - Select a region close to your users

2. **Get Your Connection String:**
   - In your Neon project dashboard, click "Connection Details"
   - Copy the connection string (it looks like: `postgresql://user:password@host/dbname`)
   - You'll need this for `DATABASE_URL`

3. **Enable Neon Auth (Optional, for future authentication):**
   - In Neon console, go to "Authentication"
   - Enable Neon Auth
   - Copy the Auth URL for `VITE_NEON_AUTH_URL`

## Step 2: Get Firebase Credentials

You need Firebase Admin credentials to export data. Choose ONE option:

### Option A: Service Account JSON (Recommended)
1. Go to Firebase Console → Project Settings → Service Accounts
2. Click "Generate New Private Key"
3. Download the JSON file
4. Save it securely (DO NOT commit to git)

### Option B: Individual Credentials
Extract from the service account JSON:
- `client_email` → `FIREBASE_CLIENT_EMAIL`
- `private_key` → `FIREBASE_PRIVATE_KEY`

## Step 3: Configure Environment Variables

Create a `.env` file in the project root:

```bash
# Neon Database
DATABASE_URL=postgresql://user:password@host/dbname
POSTGRES_URL=postgresql://user:password@host/dbname

# Optional: Vercel Blob for file storage
BLOB_READ_WRITE_TOKEN=your_vercel_blob_token
BLOB_STORE_ID=your_blob_store_id

# Firebase (for one-time migration)
FIREBASE_PROJECT_ID=gen-lang-client-0616065043
FIREBASE_DATABASE_ID=ai-studio-sharedsheetexpen-15aa5fbb-9604-4c59-b4a3-aa994442cb50

# Choose one of these credential methods:
# Method 1: Service Account JSON
FIREBASE_SERVICE_ACCOUNT_JSON='{"type":"service_account",...}'

# Method 2: Path to JSON file
GOOGLE_APPLICATION_CREDENTIALS=/path/to/serviceAccount.json

# Method 3: Individual credentials
FIREBASE_CLIENT_EMAIL=your-service-account@project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

## Step 4: Install Dependencies

```bash
# Install migration dependencies (not saved to package.json)
npm install firebase-admin --no-save
```

## Step 5: Run the Migration

```bash
# This will:
# - Export ALL data from Firebase Firestore
# - Copy ALL files from Firebase Storage to Vercel Blob (if BLOB_READ_WRITE_TOKEN is set)
# - Import everything into Neon Postgres
npm run migrate:firestore
```

The migration will:
- ✅ Export all Firestore collections and documents
- ✅ Convert Firebase data types to JSON
- ✅ Copy receipt images and files to Vercel Blob
- ✅ Map Firebase user IDs to emails
- ✅ Preserve all data structure and relationships

## Step 6: Verify Migration

```bash
# Run validation script
npm run validate:migration
```

This checks:
- Database connectivity
- Data integrity
- Record counts
- File migration status

## Step 7: Deploy with New Configuration

Once migration is complete and verified:

1. **Update Vercel/Production Environment Variables:**
   - Add `DATABASE_URL` and `POSTGRES_URL`
   - Add `BLOB_READ_WRITE_TOKEN` (if using Blob storage)
   - Keep Firebase Auth variables (for user authentication)

2. **Deploy:**
   ```bash
   git add .
   git commit -m "Migrate from Firebase to Neon"
   git push
   ```

3. **Remove Firebase Credentials:**
   - After successful deployment, remove Firestore credentials
   - Keep only Firebase Auth credentials (for user login)

## What Gets Migrated?

### Collections Migrated:
- ✅ `users/{uid}` - User profiles and settings
- ✅ `erp_workspaces/{uid}` - Workspace data
- ✅ `financeMembers/{uid}` - Member information
- ✅ `financeTenants/t_{uid}` - Tenant data
- ✅ `books` - All bookkeeping records
- ✅ `notifications` - Notification history
- ✅ `invites` - Invitation records
- ✅ `erp_files` - File metadata

### Subcollections:
- ✅ All nested collections (expenses, categories, etc.)
- ✅ Complete document hierarchy

### Files:
- ✅ Receipt images
- ✅ Uploaded documents
- ✅ Profile pictures

## Data Structure

All data is stored in a single table:

```sql
CREATE TABLE documents (
  path TEXT PRIMARY KEY,              -- e.g., "users/uid123/expenses/exp456"
  data JSONB NOT NULL,                -- All document fields as JSON
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

Examples:
- User: `users/abc123` → `{email, displayName, defaultCurrency, ...}`
- Expense: `users/abc123/expenses/exp456` → `{amount, date, category, ...}`

## Authentication Notes

**Current State:**
- ✅ Firebase Authentication is still used for login
- ✅ Data is now stored in Neon instead of Firestore

**Future Migration:**
- You can migrate to Neon Auth later
- Users will need to reset passwords
- Social logins will need reconfiguration

## Troubleshooting

### "Firebase Admin credentials not found"
- Check your `.env` file exists
- Verify credential format (JSON must be valid)
- For private key, ensure newlines are escaped as `\\n`

### "Database connection failed"
- Verify `DATABASE_URL` is correct
- Check Neon project is active
- Ensure IP allowlist allows your location (or set to 0.0.0.0/0)

### "No data migrated"
- Check Firebase project ID matches your project
- Verify service account has Firestore read permissions
- Check Firestore database ID is correct

### Files not migrated
- Ensure `BLOB_READ_WRITE_TOKEN` is set
- Verify Vercel Blob storage is configured
- Files are optional - app works without blob storage

## Rollback Plan

If something goes wrong:

1. **Data is still in Firebase** - Migration only copies, doesn't delete
2. **Remove Neon variables** from production
3. **Code automatically falls back** to Firestore if Neon is not configured
4. **Re-run migration** after fixing issues

## Performance

- Small databases (< 1,000 docs): ~1-2 minutes
- Medium databases (1,000-10,000 docs): ~5-15 minutes  
- Large databases (> 10,000 docs): ~30-60 minutes
- File migration adds extra time based on file sizes

## Cost Comparison

**Firebase:**
- Firestore: ~$0.06 per 100K reads
- Storage: $0.026/GB/month

**Neon:**
- Compute: Free tier includes 191 hours/month
- Storage: Free tier includes 0.5 GiB
- Generous free tier for small apps

## Next Steps After Migration

1. ✅ Monitor application in production
2. ✅ Verify all features work correctly
3. ✅ Keep Firebase as backup for 30 days
4. ⏭️ Consider migrating to Neon Auth (optional)
5. ⏭️ Remove Firebase project (after verification)

## Support

- Neon Documentation: https://neon.tech/docs
- Neon Discord: https://discord.gg/neon
- GitHub Issues: Create an issue in your repository

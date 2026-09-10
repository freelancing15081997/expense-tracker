# Quick Setup: Migrate to Neon

This is a streamlined guide to migrate from Firebase Firestore to Neon Postgres.

## 🚀 Quick Start (5 minutes)

### 1. Create Neon Database

1. Sign up at [neon.tech](https://neon.tech)
2. Create a new project
3. Copy your connection string from the dashboard

### 2. Get Firebase Credentials

**Option A: Download Service Account**
- Firebase Console → Settings → Service Accounts
- Click "Generate New Private Key"
- Save the JSON file securely

**Option B: Use Existing Credentials**
- Extract from service account JSON

### 3. Create `.env` File

Create `.env` in project root:

```bash
# Required: Neon Database
DATABASE_URL=postgresql://user:password@host/dbname

# Required: Firebase (for one-time migration)
FIREBASE_PROJECT_ID=gen-lang-client-0616065043
FIREBASE_DATABASE_ID=ai-studio-sharedsheetexpen-15aa5fbb-9604-4c59-b4a3-aa994442cb50

# Choose ONE credential method:

# Method 1: Service Account JSON (easiest)
FIREBASE_SERVICE_ACCOUNT_JSON='{"type":"service_account","project_id":"...",...}'

# Method 2: JSON file path
GOOGLE_APPLICATION_CREDENTIALS=/path/to/serviceAccount.json

# Method 3: Individual credentials
FIREBASE_CLIENT_EMAIL=your-service-account@project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# Optional: Vercel Blob for files (recommended)
BLOB_READ_WRITE_TOKEN=your_vercel_blob_token
```

### 4. Run Migration

```bash
# Install migration tool
npm install firebase-admin --no-save

# Run migration (takes 1-15 minutes depending on data size)
npm run migrate:firestore

# Validate migration
npm run validate:migration
```

### 5. Test Locally

```bash
# Start development server
npm run dev
```

Test all features:
- ✅ Login works
- ✅ View expenses
- ✅ Add/edit/delete records
- ✅ View reports
- ✅ All features functional

### 6. Deploy to Production

```bash
# Add environment variables to Vercel/your hosting platform:
# - DATABASE_URL
# - POSTGRES_URL (same as DATABASE_URL)
# - BLOB_READ_WRITE_TOKEN (if using)

# Deploy
git add .
git commit -m "Migrate to Neon Postgres"
git push
```

## ✅ What This Migration Does

- ✅ Exports ALL Firebase Firestore data
- ✅ Converts to PostgreSQL-compatible format
- ✅ Preserves all relationships and structure
- ✅ Copies files to Vercel Blob (optional)
- ✅ Maps Firebase user IDs to new system
- ✅ Zero data loss
- ✅ No downtime (Firebase stays active until you remove it)

## 📊 Collections Migrated

Everything gets migrated:
- User profiles and settings
- All expenses and transactions
- Categories and budgets
- Notifications and invites
- Bookkeeping records
- ERP workspaces
- File metadata
- All subcollections and nested data

## 🔒 Authentication

**Current:** Firebase Auth (unchanged)
**Future:** Can migrate to Neon Auth later if desired

The migration only moves data storage, not authentication. Users can continue logging in with their existing accounts.

## 💰 Cost Savings

**Before (Firebase):**
- Firestore reads: ~$0.06 per 100K reads
- Storage: $0.026/GB/month
- Typical monthly cost: $5-50

**After (Neon):**
- Free tier: 191 compute hours/month
- Free tier: 0.5 GiB storage
- Typical monthly cost: **$0-10**

## 🆘 Troubleshooting

### "Database connection failed"
- Check your `DATABASE_URL` is correct
- Verify Neon project is active
- Check IP allowlist in Neon dashboard

### "Firebase credentials not found"
- Verify `.env` file exists in project root
- Check JSON format is valid (no syntax errors)
- For `FIREBASE_PRIVATE_KEY`, ensure newlines are `\n` not actual newlines

### "No data migrated"
- Verify Firebase project ID is correct
- Check service account has Firestore read permissions
- Try downloading a fresh service account key

### Files not copied
- Files are optional - app works without them
- Set `BLOB_READ_WRITE_TOKEN` to copy files
- Old Firebase Storage URLs will still work until you delete them

## 📖 Full Documentation

See [MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md) for complete details.

## ⚡ Performance

- Small apps (< 1K docs): ~1-2 minutes
- Medium apps (1-10K docs): ~5-15 minutes
- Large apps (> 10K docs): ~30-60 minutes

## 🔄 Rollback

Don't worry! Your Firebase data is never deleted. If something goes wrong:

1. Remove `DATABASE_URL` from environment
2. App automatically falls back to Firebase
3. Fix issues and re-run migration

## 🎯 Next Steps After Migration

1. ✅ Test thoroughly in production
2. ✅ Keep Firebase active for 30 days as backup
3. ✅ Monitor for any issues
4. ⏭️ Remove Firebase credentials (keep Auth only)
5. ⏭️ Consider Neon Auth migration (optional)
6. ⏭️ Delete old Firebase project (after 30 days)

## 📞 Support

- Issues? Open a GitHub issue
- Questions? Check the [full guide](./MIGRATION_GUIDE.md)
- Neon help: [neon.tech/docs](https://neon.tech/docs)

# GitHub Actions Workflows

## 🤖 Automated Builds

This repository has automated Android app builds set up with GitHub Actions.

### What Happens Automatically

Every time you push code:
1. ✅ Web assets are built
2. ✅ Capacitor syncs to Android
3. ✅ APK is generated (debug build)
4. ✅ AAB is generated (release build, main branch only)
5. ✅ Files available for download

### Quick Links

- **Actions Tab**: https://github.com/[your-repo]/actions
- **Latest Builds**: Check the Actions tab for recent runs
- **Download APK**: Click any completed workflow → Artifacts section

### Build Status

[![Build Android App](https://github.com/[your-repo]/actions/workflows/android-build.yml/badge.svg)](https://github.com/[your-repo]/actions/workflows/android-build.yml)

### Required Secrets

For builds to work, you need:
- `GOOGLE_SERVICES_JSON` - Your Firebase configuration (base64 encoded)

Optional for signed Play Store uploads:
- `KEYSTORE_FILE` — upload keystore, base64 encoded
- `KEYSTORE_PASSWORD` — keystore password
- `KEY_ALIAS` — key alias (`byjan`)
- `KEY_PASSWORD` — key password
- `PLAY_SERVICE_ACCOUNT_JSON` — Play Developer API service-account JSON (plain text)

Run **Actions → Publish to Google Play** after those secrets exist. The first Play Console listing still has to be created by hand.

### See Also

- [CI/CD Setup Guide](../CI_CD_SETUP.md)
- [Mobile App README](../MOBILE_APP_README.md)

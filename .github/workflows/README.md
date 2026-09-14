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

Optional for signed releases:
- `KEYSTORE_FILE` - Your release keystore (base64 encoded)
- `KEYSTORE_PASSWORD` - Keystore password
- `KEY_ALIAS` - Key alias
- `KEY_PASSWORD` - Key password

### See Also

- [CI/CD Setup Guide](../CI_CD_SETUP.md)
- [Mobile App README](../MOBILE_APP_README.md)

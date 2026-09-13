# 🚀 CI/CD Setup for Automatic Mobile Builds

Your mobile app now has **automatic builds**! Every time you push code, GitHub Actions will build your APK and AAB automatically.

---

## ✅ What's Already Done

- ✅ GitHub Actions workflow created
- ✅ Builds on every push to main or PR
- ✅ Automatically generates APK (for testing)
- ✅ Automatically generates AAB (for Play Store)
- ✅ Available for download from GitHub

---

## 🔧 One-Time Setup (5 minutes)

### **Step 1: Add google-services.json as Secret**

You need to add your Firebase config as a GitHub Secret:

#### **Convert File to Base64:**

**On Windows (PowerShell):**
```powershell
cd "C:\Users\pujar\Desktop\Expense Tracker\expense-tracker"
[Convert]::ToBase64String([IO.File]::ReadAllBytes("android\app\google-services.json"))
```

**Or use online tool:**
1. Go to: https://www.base64encode.org/
2. Upload your `google-services.json`
3. Click "Encode"
4. Copy the result

#### **Add to GitHub Secrets:**

1. Go to your GitHub repo
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Click **"New repository secret"**
4. Name: `GOOGLE_SERVICES_JSON`
5. Value: Paste the base64 string
6. Click **"Add secret"**

---

### **Step 2: (Optional) Add Release Signing for Play Store**

If you want to build signed AAB for Play Store automatically:

#### **Create/Use Your Keystore:**

```bash
# If you don't have one, create it:
keytool -genkey -v -keystore byjan-release.keystore \
  -alias byjan -keyalg RSA -keysize 2048 -validity 10000
```

#### **Convert Keystore to Base64:**

**On Windows (PowerShell):**
```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("byjan-release.keystore"))
```

#### **Add Signing Secrets to GitHub:**

1. Go to: Settings → Secrets and variables → Actions
2. Add these secrets:

```
KEYSTORE_FILE              = [base64 of keystore file]
KEYSTORE_PASSWORD          = [your keystore password]
KEY_ALIAS                  = byjan
KEY_PASSWORD               = [your key password]
```

#### **Update Workflow (I'll do this for you if you want signed builds)**

---

## 🎯 How It Works

### **Automatic Builds:**

1. **You push code** to GitHub:
   ```bash
   git add .
   git commit -m "Updated mobile features"
   git push
   ```

2. **GitHub Actions automatically**:
   - ✅ Installs dependencies
   - ✅ Builds web assets
   - ✅ Syncs to Android
   - ✅ Builds APK (debug)
   - ✅ Builds AAB (release, on main branch)

3. **Download your builds**:
   - Go to: Actions tab on GitHub
   - Click latest workflow run
   - Download APK from "Artifacts" section

---

## 📱 Testing Your App

### **After Each Push:**

1. Go to: https://github.com/[your-repo]/actions
2. Click the latest workflow run
3. Wait for build to complete (~5-10 minutes)
4. Download **app-debug** artifact
5. Extract ZIP → get `app-debug.apk`
6. Copy to phone and install!

---

## 🏪 Deploy to Play Store

### **Option 1: Manual (Current Setup)**

1. Push code to `main` branch
2. Wait for build to complete
3. Download `app-release-bundle.aab` from artifacts
4. Upload to Play Store Console

### **Option 2: Automatic Deploy (Advanced)**

I can set up automatic deployment to Play Store. You'll need:
- Google Play Service Account
- Upload key configured
- Play Store API access

Let me know if you want this!

---

## 🎨 Branch Strategy

### **Current Configuration:**

- **Any branch**: Builds debug APK
- **Main branch**: Builds debug APK + release AAB
- **Pull Request**: Builds APK + comments on PR with download link
- **Tagged release**: Creates GitHub Release with files attached

### **Recommended Workflow:**

```bash
# Feature development
git checkout -b feature/new-feature
# ... make changes ...
git push origin feature/new-feature
# GitHub builds APK automatically

# When ready for production
git checkout main
git merge feature/new-feature
git tag v1.0.1
git push origin main --tags
# GitHub builds AAB for Play Store
```

---

## 📊 What Gets Built

### **On Every Push:**
```
✅ app-debug.apk         ~50MB    For testing on device
```

### **On Main Branch:**
```
✅ app-debug.apk         ~50MB    For testing
✅ app-release.aab       ~40MB    For Play Store upload
```

### **On Tagged Release (v1.0.0):**
```
✅ app-debug.apk         ~50MB    Attached to GitHub Release
✅ app-release.aab       ~40MB    Attached to GitHub Release
```

---

## 🆘 Troubleshooting

### **Build Fails with "google-services.json not found"**
- Make sure you added `GOOGLE_SERVICES_JSON` secret
- Check the base64 encoding is correct
- The secret name must be exactly `GOOGLE_SERVICES_JSON`

### **Build Takes Too Long**
- First build: 8-10 minutes (downloads everything)
- Subsequent builds: 3-5 minutes (uses cache)

### **Can't Download APK**
- Wait for build to complete (green checkmark)
- Go to Actions → Click workflow run → Scroll to Artifacts
- Click "app-debug" to download

---

## 🎯 Quick Reference

### **Push Code:**
```bash
git add .
git commit -m "Your changes"
git push
```

### **Download APK:**
1. Go to: https://github.com/[your-repo]/actions
2. Click latest run
3. Download "app-debug" artifact
4. Extract and install on phone

### **Check Build Status:**
- GitHub repo → Actions tab
- Green ✓ = success
- Red ✗ = failed (click for logs)

---

## 📝 Environment Variables

If you need custom environment variables in your build:

1. Add them as secrets in GitHub
2. Add to workflow file under `env:` section
3. They'll be available during build

Example:
```yaml
- name: Build with custom API URL
  env:
    VITE_API_URL: ${{ secrets.API_URL }}
  run: npm run build
```

---

## 🎉 Benefits

✅ **No manual builds** - Push code, get APK
✅ **Consistent builds** - Same environment every time
✅ **Version history** - Every build saved
✅ **Easy testing** - Download and install
✅ **Team ready** - Everyone can access builds
✅ **Play Store ready** - AAB automatically generated

---

## 📚 Next Steps

1. ✅ Add `GOOGLE_SERVICES_JSON` secret (required)
2. ✅ Push code to trigger first build
3. ✅ Download APK and test on phone
4. ✅ Add signing keys for production builds (optional)
5. ✅ Set up automatic Play Store deploy (optional)

---

## 🚀 Ready to Go!

Once you add the `GOOGLE_SERVICES_JSON` secret, your CI/CD is live!

Every push = automatic build = downloadable APK 🎊

---

**Need help setting up automatic Play Store deployment? Let me know!**

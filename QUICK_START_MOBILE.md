# 🚀 Quick Start - Mobile App

Get your mobile app running in 5 minutes!

## Prerequisites

- ✅ Node.js 18+ installed
- ✅ Java 17+ installed
- ✅ Android Studio installed (for Android)
- ✅ Firebase project created

## Step 1: Install Dependencies (Already Done)

```bash
npm install
```

All Capacitor dependencies are already installed in this branch.

## Step 2: Get Firebase Configuration

### A. Go to Firebase Console
1. Visit https://console.firebase.google.com/
2. Select project: **gen-lang-client-0616065043**
3. Click the Android icon or go to Project Settings

### B. Add Android App (if not exists)
1. Click "Add app" → Android icon
2. Android package name: `com.byjan.app`
3. App nickname: `Byjan Android`
4. Debug signing certificate SHA-1 (optional for now)

### C. Download google-services.json
1. Click "Download google-services.json"
2. Save to: `/workspace/android/app/google-services.json`

```bash
# Place the file here:
/workspace/android/app/google-services.json
```

### D. Get SHA-1 Certificate (for Google Sign-In)
```bash
cd /workspace/android
./gradlew signingReport

# Copy the SHA-1 and SHA-256 from debug keystore
# Add them to Firebase Console → Project Settings → Your apps → Add fingerprint
```

## Step 3: Build Web Assets

```bash
npm run build
```

This creates the `dist/` folder with your web app.

## Step 4: Sync to Android

```bash
npm run mobile:sync:android
```

This copies web assets to Android and updates plugins.

## Step 5: Run on Device/Emulator

### Option A: Android Studio (Recommended)
```bash
npm run mobile:open:android
```

Then click ▶️ Run in Android Studio.

### Option B: Direct Run
```bash
npm run mobile:run:android
```

This builds and deploys to connected device/emulator.

## Step 6: Test Mobile Features

Open the app on your device and test:

1. **Login/Register** - Firebase Auth should work
2. **Camera** - Take a photo or select from gallery
3. **Notifications** - Request permission
4. **Network Status** - Check online/offline detection
5. **Haptic Feedback** - Feel the vibrations on button taps

## Common Issues & Solutions

### Issue: google-services.json not found
**Solution**: Download from Firebase Console and place at `android/app/google-services.json`

### Issue: Google Sign-In doesn't work
**Solution**: 
1. Get SHA-1: `cd android && ./gradlew signingReport`
2. Add to Firebase Console → Project Settings → Add fingerprint
3. Rebuild app

### Issue: Build fails with Java error
**Solution**: 
```bash
java -version  # Should be 17+
# If not, install Java 17 and set JAVA_HOME
```

### Issue: Cannot run on device
**Solution**:
1. Enable USB debugging on device
2. Accept "Install via USB" on device
3. Run: `adb devices` to verify connection

### Issue: Push notifications not working
**Solution**:
1. Verify FCM is enabled in Firebase Console
2. Check device has Google Play Services
3. Grant notification permission in app settings

## Build for Production

### 1. Create Release Keystore
```bash
cd /workspace/android/app
keytool -genkey -v -keystore byjan-release.keystore \
  -alias byjan -keyalg RSA -keysize 2048 -validity 10000
```

Enter details when prompted. **Save passwords securely!**

### 2. Configure Signing
```bash
# Copy template
cp /workspace/android/gradle.properties.template /workspace/android/gradle.properties

# Edit gradle.properties with your keystore details
nano /workspace/android/gradle.properties
```

Update:
```properties
BYJAN_RELEASE_STORE_FILE=./app/byjan-release.keystore
BYJAN_RELEASE_KEY_ALIAS=byjan
BYJAN_RELEASE_STORE_PASSWORD=your_store_password
BYJAN_RELEASE_KEY_PASSWORD=your_key_password
```

### 3. Build Release AAB
```bash
npm run mobile:build:android:bundle
```

Output: `android/app/build/outputs/bundle/release/app-release.aab`

### 4. Get SHA-1 for Release Build
```bash
keytool -list -v -keystore android/app/byjan-release.keystore -alias byjan
```

Add this SHA-1 to Firebase Console too!

## Using Mobile Features in Your Code

### Basic Example
```typescript
import { CapacitorService, isMobile } from './lib/capacitor';

// Check if mobile
if (isMobile) {
  // Take photo
  const image = await CapacitorService.takePicture();
  
  // Show toast
  await CapacitorService.showToast('Photo taken!');
  
  // Haptic feedback
  await CapacitorService.hapticImpact();
}
```

### Using the Hook
```typescript
import { useMobileFeatures } from './hooks/useMobileFeatures';

function MyComponent() {
  const mobile = useMobileFeatures();
  
  if (!mobile.isMobile) {
    return <div>Desktop version</div>;
  }
  
  return (
    <div>
      <p>Network: {mobile.networkStatus.connected ? 'Online' : 'Offline'}</p>
      <button onClick={() => mobile.takePicture()}>
        Take Photo
      </button>
    </div>
  );
}
```

### Demo Component
See `src/components/MobileFeaturesDemo.tsx` for a complete example with all features.

## Backend Setup (Optional)

To enable push notifications, add these endpoints to your backend:

```typescript
// Register push token
app.post('/api/push-token', async (req, res) => {
  const { token, platform, userId } = req.body;
  // Save token to database
  res.json({ success: true });
});

// Send notification
app.post('/api/push-notifications', async (req, res) => {
  const { tokens, title, body } = req.body;
  // Use Firebase Admin SDK to send
  res.json({ success: true });
});
```

See `server-mobile-api-example.ts` for complete implementation.

## Next Steps

1. ✅ Test all features on real device
2. ✅ Create app icons (see Play Store requirements)
3. ✅ Take screenshots for Play Store
4. ✅ Write app description
5. ✅ Create privacy policy
6. ✅ Build release AAB
7. ✅ Submit to Google Play Store

## Resources

- **Full Guide**: `MOBILE_APP_README.md`
- **Detailed Setup**: `mobile-setup-instructions.md`
- **Play Store Guide**: `PLAY_STORE_CHECKLIST.md`
- **API Examples**: `server-mobile-api-example.ts`

## Support

- Capacitor Docs: https://capacitorjs.com/docs
- Firebase Docs: https://firebase.google.com/docs/android/setup
- Android Docs: https://developer.android.com

---

**You're ready to go!** 🎉

Just add `google-services.json` and run the app.

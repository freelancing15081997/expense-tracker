# Mobile App Setup Instructions

## Firebase Configuration for Android

### Step 1: Download Firebase Configuration File

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: `gen-lang-client-0616065043`
3. Click on the Android icon to add an Android app (if not already added)
4. Use the package name: `com.byjan.app`
5. Download the `google-services.json` file
6. Place it in: `/workspace/android/app/google-services.json`

### Step 2: Configure Firebase in Firebase Console

#### Enable Authentication Methods
1. Go to Authentication > Sign-in method
2. Enable:
   - Email/Password
   - Google Sign-in
3. Add SHA-1 and SHA-256 certificates for your app (see below)

#### Enable Push Notifications (FCM)
1. Go to Project Settings > Cloud Messaging
2. Enable Cloud Messaging API (Legacy) if not already enabled
3. Note your Server Key (for backend integration)

#### Get SHA-1 and SHA-256 Fingerprints

For Debug builds:
```bash
cd /workspace/android
./gradlew signingReport
```

For Release builds (after creating keystore):
```bash
keytool -list -v -keystore your-release-key.keystore -alias your-key-alias
```

Add these fingerprints to Firebase Console:
- Project Settings > General > Your apps > Add fingerprint

### Step 3: Create Release Keystore

```bash
cd /workspace/android/app
keytool -genkey -v -keystore byjan-release.keystore -alias byjan -keyalg RSA -keysize 2048 -validity 10000
```

Create `/workspace/android/keystore.properties`:
```properties
storePassword=YOUR_STORE_PASSWORD
keyPassword=YOUR_KEY_PASSWORD
keyAlias=byjan
storeFile=./app/byjan-release.keystore
```

### Step 4: Build Mobile App

#### For Development/Testing (APK):
```bash
npm run mobile:build:android
```
Output: `android/app/build/outputs/apk/release/app-release-unsigned.apk`

#### For Google Play Store (AAB):
```bash
npm run mobile:build:android:bundle
```
Output: `android/app/build/outputs/bundle/release/app-release.aab`

### Step 5: Run on Device/Emulator

```bash
npm run mobile:run:android
```

Or open in Android Studio:
```bash
npm run mobile:open:android
```

## Mobile Features Implemented

### ✅ Core Features
- [x] Capacitor integration
- [x] Android platform support
- [x] Production build configuration
- [x] Separate mobile package (doesn't affect web app)

### ✅ Advanced Mobile Features
- [x] **Camera Access** - Take photos, select from gallery
- [x] **Push Notifications** - Firebase Cloud Messaging
- [x] **Local Notifications** - Scheduled and instant notifications
- [x] **Haptic Feedback** - Touch feedback for better UX
- [x] **Keyboard Management** - Auto-resize, show/hide
- [x] **Network Status** - Online/offline detection
- [x] **Status Bar** - Customizable status bar styling
- [x] **Splash Screen** - Professional app launch screen
- [x] **File System** - Read/write files on device
- [x] **Share** - Native share functionality
- [x] **Geolocation** - GPS location access
- [x] **Device Info** - Platform, OS version, etc.
- [x] **Browser** - Open URLs in native browser
- [x] **Toast Messages** - Native toast notifications
- [x] **App State** - Background/foreground detection
- [x] **Deep Linking** - Handle custom URL schemes

## Using Mobile Features in Your Code

### Camera Example
```typescript
import { CapacitorService } from './lib/capacitor';

// Take a photo
const image = await CapacitorService.takePicture({
  quality: 90,
  allowEditing: true,
});
```

### Push Notifications
Push notifications are automatically initialized. To send notifications from backend:

```typescript
// Backend API endpoint needed
POST /api/push-notifications
{
  "tokens": ["fcm_token_1", "fcm_token_2"],
  "title": "New Expense",
  "body": "You have a new expense to review",
  "data": {
    "url": "/expenses/123"
  }
}
```

### Local Notifications
```typescript
import { CapacitorService } from './lib/capacitor';

// Schedule a notification
await CapacitorService.scheduleLocalNotification({
  title: 'Reminder',
  body: 'Check your expenses!',
  id: 1,
  schedule: { at: new Date(Date.now() + 3600000) } // 1 hour from now
});
```

### Haptic Feedback
```typescript
import { CapacitorService, ImpactStyle } from './lib/capacitor';

// Add touch feedback
await CapacitorService.hapticImpact(ImpactStyle.Medium);
```

### Share Content
```typescript
import { CapacitorService } from './lib/capacitor';

// Share text or URL
await CapacitorService.shareContent({
  title: 'Check this out!',
  text: 'Byjan - Financial tracking made easy',
  url: 'https://byjan.com'
});
```

### Network Status
```typescript
import { Network } from './lib/capacitor';

// Check network status
const status = await Network.getStatus();
console.log('Connected:', status.connected);
console.log('Connection type:', status.connectionType);
```

### Geolocation
```typescript
import { CapacitorService } from './lib/capacitor';

// Get current position
const position = await CapacitorService.getCurrentPosition();
console.log('Lat:', position.coords.latitude);
console.log('Lng:', position.coords.longitude);
```

### File System
```typescript
import { CapacitorService, Directory } from './lib/capacitor';

// Save a file
await CapacitorService.saveFile('myfile.txt', 'content', Directory.Documents);

// Read a file
const result = await CapacitorService.readFile('myfile.txt', Directory.Documents);
```

## Platform Detection

```typescript
import { isMobile, isAndroid, isIOS, isWeb } from './lib/capacitor';

if (isMobile) {
  // Mobile-specific code
}

if (isAndroid) {
  // Android-specific code
}
```

## API Endpoints Needed for Full Mobile Support

Add these endpoints to your backend:

### 1. Push Token Registration
```typescript
POST /api/push-token
Body: { token: string, platform: string }
```

### 2. Send Push Notification
```typescript
POST /api/push-notifications
Body: {
  tokens: string[],
  title: string,
  body: string,
  data?: object
}
```

## Deployment to Google Play Store

### Prerequisites
1. Google Play Developer account ($25 one-time fee)
2. Signed release build (AAB file)
3. App icons, screenshots, descriptions
4. Privacy policy URL

### Steps
1. Create app listing in Google Play Console
2. Upload AAB file (`app-release.aab`)
3. Fill out store listing details
4. Set up pricing and distribution
5. Submit for review

### App Information
- **App Name**: Byjan
- **Package Name**: com.byjan.app
- **Category**: Finance
- **Content Rating**: Everyone
- **Privacy Policy**: [Your privacy policy URL]

## Testing

### Test on Real Device
1. Enable USB debugging on Android device
2. Connect device via USB
3. Run: `npm run mobile:run:android`

### Test on Emulator
1. Install Android Studio
2. Create AVD (Android Virtual Device)
3. Run: `npm run mobile:run:android`

## Troubleshooting

### Build Errors
- Ensure Android SDK is installed
- Check Java version: `java -version` (needs Java 17)
- Clean build: `cd android && ./gradlew clean`

### Firebase Auth Not Working
- Verify `google-services.json` is in correct location
- Add SHA-1/SHA-256 fingerprints to Firebase Console
- Check package name matches exactly: `com.byjan.app`

### Push Notifications Not Working
- Verify FCM is enabled in Firebase Console
- Check device has Google Play Services
- Test with FCM console first
- Verify app has notification permissions

## Important Notes

1. **Web App Unaffected**: All changes are isolated to mobile build. Web app continues to work normally.

2. **Firebase Auth**: Works on both web and mobile with same configuration.

3. **Separate Builds**: Web and mobile are built separately:
   - Web: `npm run build` → `dist/` folder
   - Mobile: `npm run mobile:build:android` → `.apk` or `.aab` file

4. **Development**: Use `npm run mobile:sync` after code changes to update mobile app.

5. **Environment Variables**: Mobile app uses same environment variables as web app.

## Next Steps

1. Download and add `google-services.json` from Firebase Console
2. Create release keystore for signing
3. Build and test on device/emulator
4. Add backend endpoints for push notifications
5. Test all mobile features
6. Create app store assets (icons, screenshots, descriptions)
7. Submit to Google Play Store

## Support

For issues or questions:
- Check Capacitor docs: https://capacitorjs.com/docs
- Firebase docs: https://firebase.google.com/docs
- Android docs: https://developer.android.com

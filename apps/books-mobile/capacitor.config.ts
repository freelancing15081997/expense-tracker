import type { CapacitorConfig } from '@capacitor/cli';

// Same appId as the live Play Store app so this build replaces it in place.
const config: CapacitorConfig = {
  appId: 'com.byjanbooks.app',
  appName: 'Byjan',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    hostname: 'localhost',
    cleartext: false,
    allowNavigation: ['*.googleapis.com', '*.gstatic.com', '*.google.com', '*.firebaseapp.com', 'sdk.cashfree.com', '*.cashfree.com'],
  },
  plugins: {
    CapacitorHttp: { enabled: true },
    FirebaseAuthentication: { skipNativeAuth: true, providers: ['google.com'] },
    SplashScreen: { launchShowDuration: 0, launchAutoHide: true, backgroundColor: '#0B1F3A', showSpinner: false, androidScaleType: 'CENTER_INSIDE' },
    StatusBar: { style: 'LIGHT', backgroundColor: '#0B1F3A' },
    Keyboard: { resizeOnFullScreen: true },
    PushNotifications: { presentationOptions: ['badge', 'sound', 'alert'] },
  },
  android: { allowMixedContent: false, captureInput: true, webContentsDebuggingEnabled: process.env.BYJAN_WEBVIEW_DEBUG === '1' },
};

export default config;

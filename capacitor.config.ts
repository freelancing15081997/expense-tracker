import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.byjanbooks.app',
  appName: 'Byjan',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    iosScheme: 'https',
    hostname: 'localhost',
    cleartext: false,
    // Do NOT allow easypado.com here — that loads the website inside the app WebView
    // during OAuth/SSO fallbacks. External Browser / Custom Tabs do not need this list.
    allowNavigation: [
      '*.googleapis.com',
      '*.gstatic.com',
      '*.google.com',
      '*.firebaseapp.com',
      '*.firebaseio.com',
    ],
  },
  plugins: {
    CapacitorHttp: {
      enabled: true,
    },
    FirebaseAuthentication: {
      skipNativeAuth: true,
      providers: ['google.com'],
    },
    SplashScreen: {
      launchShowDuration: 0,
      launchAutoHide: true,
      backgroundColor: '#0B1F3A',
      showSpinner: false,
      androidScaleType: 'CENTER_INSIDE',
      splashFullScreen: true,
      splashImmersive: true,
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert']
    },
    Keyboard: {
      resizeOnFullScreen: true,
    },
    StatusBar: {
      style: 'LIGHT',
      backgroundColor: '#0B1F3A',
    },
    LocalNotifications: {
      smallIcon: 'ic_stat_byjan',
      iconColor: '#12B8A8',
      sound: 'beep.wav',
    },
  },
  android: {
    allowMixedContent: false,
    captureInput: true,
    // Enable only for local debug installs — never ship Play builds with CDP open.
    webContentsDebuggingEnabled: process.env.BYJAN_WEBVIEW_DEBUG === '1',
  }
};

export default config;

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
    allowNavigation: [
      'easypado.com',
      'www.easypado.com',
      '*.easypado.com',
      'byjan.com',
      '*.byjan.com',
      '*.googleapis.com',
      '*.gstatic.com',
      '*.firebaseapp.com',
      '*.firebaseio.com',
    ],
  },
  plugins: {
    CapacitorHttp: {
      enabled: true,
    },
    FirebaseAuthentication: {
      skipNativeAuth: false,
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
    webContentsDebuggingEnabled: false,
  }
};

export default config;

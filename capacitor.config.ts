import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.byjanbooks.com',
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
      skipNativeAuth: true,
      providers: ['google.com'],
    },
    SplashScreen: {
      launchShowDuration: 2200,
      launchAutoHide: false,
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
      smallIcon: 'ic_stat_icon_config_sample',
      iconColor: '#0B1F3A',
      sound: 'beep.wav',
    },
  },
  android: {
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: true,
  }
};

export default config;

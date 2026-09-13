import { Capacitor } from '@capacitor/core';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { PushNotifications } from '@capacitor/push-notifications';
import { App } from '@capacitor/app';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { Keyboard } from '@capacitor/keyboard';
import { Network } from '@capacitor/network';
import { SplashScreen } from '@capacitor/splash-screen';
import { StatusBar, Style } from '@capacitor/status-bar';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { Geolocation } from '@capacitor/geolocation';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Device } from '@capacitor/device';
import { Browser } from '@capacitor/browser';
import { Toast } from '@capacitor/toast';

export const isMobile = Capacitor.isNativePlatform();
export const platform = Capacitor.getPlatform();
export const isAndroid = platform === 'android';
export const isIOS = platform === 'ios';
export const isWeb = platform === 'web';

export class CapacitorService {
  private static pushToken: string | null = null;
  private static initialized = false;

  static async initialize() {
    if (this.initialized || !isMobile) return;
    
    try {
      await SplashScreen.show({
        showDuration: 2000,
        autoHide: true,
      });

      if (isAndroid) {
        await StatusBar.setStyle({ style: Style.Dark });
        await StatusBar.setBackgroundColor({ color: '#0B1F3A' });
      }

      await this.initializePushNotifications();
      await this.setupAppListeners();
      await this.checkNetworkStatus();
      
      this.initialized = true;
      console.log('Capacitor initialized successfully');
    } catch (error) {
      console.error('Error initializing Capacitor:', error);
    }
  }

  static async initializePushNotifications() {
    if (!isMobile) return;

    try {
      const permission = await PushNotifications.checkPermissions();
      
      if (permission.receive === 'prompt') {
        const result = await PushNotifications.requestPermissions();
        if (result.receive !== 'granted') {
          console.log('Push notification permission denied');
          return;
        }
      }

      await PushNotifications.register();

      PushNotifications.addListener('registration', (token) => {
        console.log('Push registration success, token:', token.value);
        this.pushToken = token.value;
        this.savePushToken(token.value);
      });

      PushNotifications.addListener('registrationError', (error) => {
        console.error('Error on registration:', error);
      });

      PushNotifications.addListener('pushNotificationReceived', (notification) => {
        console.log('Push notification received:', notification);
        this.handleIncomingNotification(notification);
      });

      PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
        console.log('Push notification action performed:', action);
        this.handleNotificationAction(action);
      });
    } catch (error) {
      console.error('Error setting up push notifications:', error);
    }
  }

  private static async savePushToken(token: string) {
    try {
      const response = await fetch('/api/push-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, platform }),
      });
      
      if (!response.ok) {
        console.error('Failed to save push token');
      }
    } catch (error) {
      console.error('Error saving push token:', error);
    }
  }

  private static handleIncomingNotification(notification: any) {
    if (isAndroid) {
      LocalNotifications.schedule({
        notifications: [{
          title: notification.title || 'Byjan',
          body: notification.body || '',
          id: Date.now(),
          schedule: { at: new Date(Date.now() + 1000) },
        }]
      });
    }
  }

  private static handleNotificationAction(action: any) {
    const data = action.notification.data;
    if (data.url) {
      window.location.href = data.url;
    }
  }

  private static async setupAppListeners() {
    App.addListener('appStateChange', ({ isActive }) => {
      console.log('App state changed. Is active:', isActive);
    });

    App.addListener('backButton', ({ canGoBack }) => {
      if (!canGoBack) {
        App.exitApp();
      } else {
        window.history.back();
      }
    });

    App.addListener('appUrlOpen', (data) => {
      console.log('App opened with URL:', data.url);
      const slug = data.url.split('.com').pop();
      if (slug) {
        window.location.href = slug;
      }
    });
  }

  private static async checkNetworkStatus() {
    const status = await Network.getStatus();
    console.log('Network status:', status);

    Network.addListener('networkStatusChange', (status) => {
      console.log('Network status changed:', status);
      if (!status.connected) {
        Toast.show({
          text: 'No internet connection',
          duration: 'long',
        });
      }
    });
  }

  static async takePicture(options: {
    quality?: number;
    allowEditing?: boolean;
    resultType?: CameraResultType;
    source?: CameraSource;
  } = {}) {
    try {
      const image = await Camera.getPhoto({
        quality: options.quality || 90,
        allowEditing: options.allowEditing || false,
        resultType: options.resultType || CameraResultType.DataUrl,
        source: options.source || CameraSource.Prompt,
      });

      return image;
    } catch (error) {
      console.error('Error taking picture:', error);
      throw error;
    }
  }

  static async requestCameraPermission() {
    try {
      const permissions = await Camera.checkPermissions();
      
      if (permissions.camera === 'prompt' || permissions.photos === 'prompt') {
        const result = await Camera.requestPermissions({
          permissions: ['camera', 'photos']
        });
        return result.camera === 'granted' && result.photos === 'granted';
      }

      return permissions.camera === 'granted' && permissions.photos === 'granted';
    } catch (error) {
      console.error('Error requesting camera permission:', error);
      return false;
    }
  }

  static async hapticImpact(style: ImpactStyle = ImpactStyle.Medium) {
    if (isMobile) {
      try {
        await Haptics.impact({ style });
      } catch (error) {
        console.error('Haptics error:', error);
      }
    }
  }

  static async hideKeyboard() {
    if (isMobile) {
      await Keyboard.hide();
    }
  }

  static async shareContent(options: {
    title?: string;
    text?: string;
    url?: string;
    files?: string[];
  }) {
    try {
      await Share.share(options);
    } catch (error) {
      console.error('Error sharing:', error);
    }
  }

  static async getCurrentPosition() {
    try {
      const position = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      });
      return position;
    } catch (error) {
      console.error('Error getting position:', error);
      throw error;
    }
  }

  static async saveFile(fileName: string, data: string, directory: Directory = Directory.Documents) {
    try {
      const result = await Filesystem.writeFile({
        path: fileName,
        data: data,
        directory: directory,
      });
      return result;
    } catch (error) {
      console.error('Error saving file:', error);
      throw error;
    }
  }

  static async readFile(fileName: string, directory: Directory = Directory.Documents) {
    try {
      const result = await Filesystem.readFile({
        path: fileName,
        directory: directory,
      });
      return result;
    } catch (error) {
      console.error('Error reading file:', error);
      throw error;
    }
  }

  static async getDeviceInfo() {
    try {
      const info = await Device.getInfo();
      return info;
    } catch (error) {
      console.error('Error getting device info:', error);
      throw error;
    }
  }

  static async openUrl(url: string) {
    if (isMobile) {
      await Browser.open({ url });
    } else {
      window.open(url, '_blank');
    }
  }

  static async showToast(message: string, duration: 'short' | 'long' = 'short') {
    if (isMobile) {
      await Toast.show({
        text: message,
        duration: duration,
      });
    } else {
      console.log('Toast:', message);
    }
  }

  static async scheduleLocalNotification(options: {
    title: string;
    body: string;
    id: number;
    schedule?: { at: Date };
  }) {
    try {
      const permission = await LocalNotifications.checkPermissions();
      
      if (permission.display === 'prompt') {
        await LocalNotifications.requestPermissions();
      }

      await LocalNotifications.schedule({
        notifications: [options]
      });
    } catch (error) {
      console.error('Error scheduling notification:', error);
    }
  }

  static getPushToken() {
    return this.pushToken;
  }

  static async hideSplashScreen() {
    if (isMobile) {
      await SplashScreen.hide();
    }
  }
}

export {
  Camera,
  CameraResultType,
  CameraSource,
  PushNotifications,
  App,
  Haptics,
  ImpactStyle,
  Keyboard,
  Network,
  SplashScreen,
  StatusBar,
  Filesystem,
  Directory,
  Share,
  Geolocation,
  LocalNotifications,
  Device,
  Browser,
  Toast,
};

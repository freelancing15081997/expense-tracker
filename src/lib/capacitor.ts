import { Capacitor } from '@capacitor/core';
import { apiUrl } from './api';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { PushNotifications } from '@capacitor/push-notifications';
import { App } from '@capacitor/app';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
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
  private static boundUid = '';
  private static lastAlertAt = 0;

  static async initialize() {
    if (this.initialized || !isMobile) return;
    
    try {
      if (isAndroid) {
        await StatusBar.setStyle({ style: Style.Light });
        await StatusBar.setBackgroundColor({ color: '#0B1F3A' });
      }

      await this.initializePushNotifications();
      await this.setupAppListeners();
      await this.checkNetworkStatus();
      
      this.initialized = true;
      window.setTimeout(() => {
        void SplashScreen.hide({ fadeOutDuration: 360 });
      }, 2400);
      console.log('Capacitor initialized successfully');
    } catch (error) {
      console.error('Error initializing Capacitor:', error);
      void SplashScreen.hide({ fadeOutDuration: 200 }).catch(() => undefined);
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
      await this.ensureAlertChannel();

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

  static async bindAccount(uid?: string) {
    this.boundUid = String(uid || '');
    if (this.pushToken) await this.savePushToken(this.pushToken);
    else if (isMobile) {
      try { await PushNotifications.register(); } catch { /* ignore */ }
    }
  }

  private static async ensureAlertChannel() {
    try {
      await LocalNotifications.createChannel({
        id: 'byjan_alerts',
        name: 'Ledger alerts',
        description: 'When a teammate adds or changes an entry',
        importance: 5,
        visibility: 1,
        sound: 'beep.wav',
        vibration: true,
        lights: true,
      });
    } catch {
      /* web or already created */
    }
  }

  private static async savePushToken(token: string) {
    try {
      const { upsertMe } = await import('./me');
      const { authHeaders } = await import('./auth-client');
      const headers = await authHeaders({ 'content-type': 'application/json' });
      if (!headers.Authorization) return;
      await upsertMe({
        pushToken: token,
        pushPlatform: platform,
        pushUpdatedAt: new Date().toISOString(),
      });
      await fetch(apiUrl('/api/notifications'), {
        method: 'POST',
        headers,
        body: JSON.stringify({ op: 'registerPush', token, platform }),
      }).catch(() => undefined);
    } catch (error) {
      console.error('Error saving push token:', error);
    }
  }

  private static handleIncomingNotification(notification: any) {
    void this.alertIncoming({
      title: String(notification?.title || notification?.notification?.title || 'Byjan'),
      body: String(notification?.body || notification?.notification?.body || 'New update in a money book'),
      bookId: String(notification?.data?.bookId || ''),
      foreground: true,
    });
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

  static async hapticTick() {
    await this.hapticImpact(ImpactStyle.Light);
  }

  static playAlertChime() {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.16, ctx.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.28);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
      osc.onended = () => { void ctx.close(); };
    } catch {
      /* audio not available */
    }
  }

  static async alertIncoming(input: { title: string; body: string; bookId?: string; foreground?: boolean }) {
    const now = Date.now();
    if (now - this.lastAlertAt < 1200) return;
    this.lastAlertAt = now;
    this.playAlertChime();
    if (isMobile) {
      try {
        await Haptics.notification({ type: NotificationType.Success });
      } catch { /* ignore */ }
      try {
        await Haptics.vibrate({ duration: 220 });
      } catch { /* ignore */ }
    }
    if (!isMobile || input.foreground) return;
    await this.scheduleLocalNotification({
      title: input.title,
      body: input.body,
      id: now % 2147483647,
    });
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
        notifications: [{
          ...options,
          channelId: 'byjan_alerts',
          sound: 'beep.wav',
        }]
      });
    } catch (error) {
      console.error('Error scheduling notification:', error);
    }
  }

  static getPushToken() {
    return this.pushToken;
  }

  static async hideSplashScreen() {
    if (!isMobile) return;
    try {
      await SplashScreen.hide({ fadeOutDuration: 280 });
    } catch {
      /* splash already gone */
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
  NotificationType,
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

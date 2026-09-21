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
import { getRuntimePrefs } from './app-prefs';

export const isMobile = Capacitor.isNativePlatform();
export const platform = Capacitor.getPlatform();
export const isAndroid = platform === 'android';
export const isIOS = platform === 'ios';
export const isWeb = platform === 'web';

export class CapacitorService {
  private static pushToken: string | null = null;
  private static initialized = false;
  private static pushListenersBound = false;
  private static boundUid = '';
  private static lastAlertAt = 0;

  static async initialize() {
    if (this.initialized || !isMobile) return;
    
    try {
      if (isAndroid) {
        await StatusBar.setStyle({ style: Style.Light });
        await StatusBar.setBackgroundColor({ color: '#3654FF' });
      }

      await this.initializePushNotifications();
      await this.setupAppListeners();
      await this.checkNetworkStatus();
      
      this.initialized = true;
      // Hide native splash as soon as the WebView is ready â€” no artificial 2s delay.
      void SplashScreen.hide({ fadeOutDuration: 180 });
      console.log('Capacitor initialized successfully');
    } catch (error) {
      console.error('Error initializing Capacitor:', error);
      void SplashScreen.hide({ fadeOutDuration: 200 }).catch(() => undefined);
    }
  }

  static async initializePushNotifications() {
    if (!isMobile) return;

    try {
      let receive = (await PushNotifications.checkPermissions()).receive;
      if (receive !== 'granted') {
        receive = (await PushNotifications.requestPermissions()).receive;
      }
      if (receive !== 'granted') {
        console.log('Push notification permission denied');
        return;
      }

      if (!this.pushListenersBound) {
        this.pushListenersBound = true;
        PushNotifications.addListener('registration', (token) => {
          console.log('Push registration success, token:', token.value);
          this.pushToken = token.value;
          try { (window as unknown as { __BYJAN_PUSH_TOKEN?: string }).__BYJAN_PUSH_TOKEN = token.value; } catch { /* ignore */ }
          void this.savePushToken(token.value);
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
      }

      await PushNotifications.register();
      await this.ensureAlertChannel();
    } catch (error) {
      console.error('Error setting up push notifications:', error);
    }
  }

  static async bindAccount(uid?: string) {
    this.boundUid = String(uid || '');
    if (!isMobile) return;
    if (this.pushToken) {
      await this.savePushToken(this.pushToken);
      return;
    }
    try {
      if (!this.initialized) await this.initializePushNotifications();
      else await PushNotifications.register();
    } catch { /* ignore */ }
  }

  private static async ensureAlertChannel() {
    try {
      await LocalNotifications.createChannel({
        id: 'byjan_alerts',
        name: 'Ledger alerts',
        description: 'When a teammate adds or changes an entry',
        importance: 5,
        visibility: 1,
        vibration: true,
        lights: true,
        sound: 'beep.wav',
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
    const data = action?.notification?.data || action?.notification || {};
    const url = String(data.url || '');
    const bookId = String(data.bookId || '');
    const settlementId = String(data.settlementId || data.pay || '');
    const hashIdx = url.indexOf('#');
    if (hashIdx >= 0) {
      window.location.hash = url.slice(hashIdx);
      return;
    }
    if (url.startsWith('/book/') || url.startsWith('/settings') || url.startsWith('/notifications')) {
      window.location.hash = `#${url}`;
      return;
    }
    if (bookId) {
      window.location.hash = settlementId
        ? `#/book/${bookId}?pay=${encodeURIComponent(settlementId)}`
        : `#/book/${bookId}`;
      return;
    }
    window.location.hash = '#/notifications';
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
      const url = String(data.url || '');
      if (/com\.byjanbooks\.app:\/\/auth/i.test(url) || /[?&#]idToken=/i.test(url) || /[?&#]id_token=/i.test(url)) {
        window.dispatchEvent(new CustomEvent('byjan-google-auth', { detail: url }));
        return;
      }
      const slug = url.split('.com').pop();
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

  /**
   * Scan entry point: ask Camera or Photo Library (system Prompt), then optional multi-gallery.
   * Never open gallery-only first — Play users expect to capture with the camera.
   */
  static async captureScanReceipts(options: { limit?: number; quality?: number; preferBatch?: boolean } = {}): Promise<Array<{
    imageDataUrl: string;
    fileName: string;
    mimeType: string;
  }>> {
    const quality = Math.max(80, Math.min(92, Number(options.quality) || 88));
    const limit = Math.max(2, Math.min(40, Number(options.limit) || 24));

    // If caller wants batch multi-select explicitly
    if (options.preferBatch) {
      return this.pickReceiptBatch({ limit, quality });
    }

    // System sheet: Camera | Photos (and Cancel). Matches user expectation on Play builds.
    if (isWeb) {
      return this.pickReceiptBatch({ limit, quality });
    }
    try {
      const photo = await this.takePicture({
        source: CameraSource.Prompt,
        quality,
        width: 1600,
        height: 1600,
        resultType: CameraResultType.DataUrl,
      });
      const dataUrl = photo.dataUrl || (photo.base64String ? `data:image/jpeg;base64,${photo.base64String}` : '');
      if (!dataUrl) throw new Error('No photo data');
      const format = String(photo.format || 'jpeg').toLowerCase();
      const mime = format === 'png' ? 'image/png' : 'image/jpeg';
      return [{
        imageDataUrl: dataUrl,
        fileName: `receipt-${Date.now()}.${format === 'png' ? 'png' : 'jpg'}`,
        mimeType: mime,
      }];
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err || '');
      if (/cancel/i.test(msg)) throw err;
      // Last resort: multi gallery picker
      return this.pickReceiptBatch({ limit, quality });
    }
  }

  static async takePicture(options: {
    quality?: number;
    allowEditing?: boolean;
    resultType?: CameraResultType;
    source?: CameraSource;
    width?: number;
    height?: number;
  } = {}) {
    try {
      const image = await Camera.getPhoto({
        quality: options.quality || 88,
        allowEditing: options.allowEditing || false,
        resultType: options.resultType || CameraResultType.DataUrl,
        source: options.source || CameraSource.Prompt,
        width: options.width || 1600,
        height: options.height || 1600,
        correctOrientation: true,
      });

      return image;
    } catch (error) {
      console.error('Error taking picture:', error);
      throw error;
    }
  }

  /** Convert a webPath / content URI into a data URL for OCR / upload. */
  static async pathToDataUrl(webPath: string, mimeHint = 'image/jpeg'): Promise<string> {
    const res = await fetch(webPath);
    const blob = await res.blob();
    const mime = blob.type || mimeHint;
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('Could not read file'));
      reader.readAsDataURL(blob);
    });
  }

  static async fileToDataUrl(file: File): Promise<{ dataUrl: string; fileName: string; mimeType: string }> {
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('Could not read file'));
      reader.readAsDataURL(file);
    });
    return {
      dataUrl,
      fileName: file.name || `receipt-${Date.now()}`,
      mimeType: file.type || 'application/octet-stream',
    };
  }

  /**
   * Multi-select receipts / documents (images, PDF, CSV, Excel).
   * Native gallery when available; otherwise a multi file picker.
   */
  static async pickReceiptBatch(options: { limit?: number; quality?: number } = {}): Promise<Array<{
    imageDataUrl: string;
    fileName: string;
    mimeType: string;
  }>> {
    const limit = Math.max(2, Math.min(40, Number(options.limit) || 24));
    const quality = options.quality || 82;

    if (isMobile) {
      try {
        const cam = Camera as typeof Camera & {
          pickImages?: (o: Record<string, unknown>) => Promise<{ photos?: Array<{ webPath?: string; format?: string; path?: string }> }>;
          chooseFromGallery?: (o: Record<string, unknown>) => Promise<{ results?: Array<{ webPath?: string; format?: string; mimeType?: string }> }>;
        };
        if (typeof cam.chooseFromGallery === 'function') {
          const { results } = await cam.chooseFromGallery({
            allowMultipleSelection: true,
            quality,
            limit,
            targetWidth: 1600,
            targetHeight: 1600,
          });
          const rows = Array.isArray(results) ? results : [];
          const out = await Promise.all(rows.slice(0, limit).map(async (row, i) => {
            const path = String(row.webPath || '');
            if (!path) return null;
            const mime = String(row.mimeType || (row.format === 'png' ? 'image/png' : 'image/jpeg'));
            const dataUrl = await this.pathToDataUrl(path, mime);
            return { imageDataUrl: dataUrl, fileName: `receipt-${Date.now()}-${i}.${row.format || 'jpg'}`, mimeType: mime };
          }));
          const cleaned = out.filter(Boolean) as Array<{ imageDataUrl: string; fileName: string; mimeType: string }>;
          if (cleaned.length) return cleaned;
        }
        if (typeof cam.pickImages === 'function') {
          const { photos } = await cam.pickImages({ quality, limit, width: 1600, height: 1600 });
          const rows = Array.isArray(photos) ? photos : [];
          const out = await Promise.all(rows.slice(0, limit).map(async (row, i) => {
            const path = String(row.webPath || row.path || '');
            if (!path) return null;
            const mime = row.format === 'png' ? 'image/png' : 'image/jpeg';
            const dataUrl = await this.pathToDataUrl(path, mime);
            return { imageDataUrl: dataUrl, fileName: `receipt-${Date.now()}-${i}.${row.format || 'jpg'}`, mimeType: mime };
          }));
          const cleaned = out.filter(Boolean) as Array<{ imageDataUrl: string; fileName: string; mimeType: string }>;
          if (cleaned.length) return cleaned;
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err || '');
        if (/cancel/i.test(msg)) throw err;
        /* fall through to file input */
      }
    }

    return await new Promise((resolve, reject) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.multiple = true;
      input.accept = 'image/*,application/pdf,.pdf,.csv,.xlsx,.xls,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      input.style.cssText = 'position:fixed;left:0;top:0;opacity:0;width:1px;height:1px;';
      const cleanup = () => { try { input.remove(); } catch { /* */ } };
      input.onchange = () => {
        const files = Array.from(input.files || []).slice(0, limit);
        cleanup();
        if (!files.length) {
          reject(new Error('cancelled'));
          return;
        }
        void Promise.all(files.map((f) => this.fileToDataUrl(f)))
          .then((rows) => resolve(rows.map((r) => ({
            imageDataUrl: r.dataUrl,
            fileName: r.fileName,
            mimeType: r.mimeType,
          }))))
          .catch(reject);
      };
      input.oncancel = () => { cleanup(); reject(new Error('cancelled')); };
      document.body.appendChild(input);
      input.click();
    });
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

  /** Short “recording started” cue. Honors Settings → Voice start sound. */
  static playMicStartCue() {
    try {
      if (!getRuntimePrefs().voiceStartSound) return;
    } catch {
      /* prefs unavailable — still play */
    }
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(720, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(480, ctx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.14, ctx.currentTime + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.22);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.24);
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

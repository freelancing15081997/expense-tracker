import { useState, useEffect, useCallback } from 'react';
import {
  CapacitorService,
  isMobile,
  isAndroid,
  isIOS,
  isWeb,
  CameraResultType,
  CameraSource,
  ImpactStyle,
  Network,
  Directory,
} from '../lib/capacitor';

export interface NetworkStatus {
  connected: boolean;
  connectionType: string;
}

export function useMobileFeatures() {
  const [networkStatus, setNetworkStatus] = useState<NetworkStatus>({
    connected: true,
    connectionType: 'unknown',
  });

  const [pushToken, setPushToken] = useState<string | null>(null);

  useEffect(() => {
    if (isMobile) {
      checkNetworkStatus();
      const token = CapacitorService.getPushToken();
      setPushToken(token);

      const networkListener = Network.addListener('networkStatusChange', (status) => {
        setNetworkStatus({
          connected: status.connected,
          connectionType: status.connectionType,
        });
      });

      return () => {
        networkListener.remove();
      };
    }
  }, []);

  const checkNetworkStatus = async () => {
    if (isMobile) {
      const status = await Network.getStatus();
      setNetworkStatus({
        connected: status.connected,
        connectionType: status.connectionType,
      });
    }
  };

  const takePicture = useCallback(async (options?: {
    quality?: number;
    allowEditing?: boolean;
    source?: CameraSource;
  }) => {
    if (!isMobile) {
      throw new Error('Camera is only available on mobile devices');
    }

    const hasPermission = await CapacitorService.requestCameraPermission();
    if (!hasPermission) {
      throw new Error('Camera permission denied');
    }

    return await CapacitorService.takePicture({
      quality: options?.quality || 90,
      allowEditing: options?.allowEditing || false,
      resultType: CameraResultType.DataUrl,
      source: options?.source || CameraSource.Prompt,
    });
  }, []);

  const selectImage = useCallback(async () => {
    return await takePicture({ source: CameraSource.Photos });
  }, [takePicture]);

  const capturePhoto = useCallback(async () => {
    return await takePicture({ source: CameraSource.Camera });
  }, [takePicture]);

  const hapticFeedback = useCallback(async (style: ImpactStyle = ImpactStyle.Medium) => {
    if (isMobile) {
      await CapacitorService.hapticImpact(style);
    }
  }, []);

  const hideKeyboard = useCallback(async () => {
    if (isMobile) {
      await CapacitorService.hideKeyboard();
    }
  }, []);

  const shareContent = useCallback(async (options: {
    title?: string;
    text?: string;
    url?: string;
    files?: string[];
  }) => {
    await CapacitorService.shareContent(options);
  }, []);

  const getCurrentPosition = useCallback(async () => {
    return await CapacitorService.getCurrentPosition();
  }, []);

  const saveFile = useCallback(async (
    fileName: string,
    data: string,
    directory: Directory = Directory.Documents
  ) => {
    return await CapacitorService.saveFile(fileName, data, directory);
  }, []);

  const readFile = useCallback(async (
    fileName: string,
    directory: Directory = Directory.Documents
  ) => {
    return await CapacitorService.readFile(fileName, directory);
  }, []);

  const scheduleNotification = useCallback(async (options: {
    title: string;
    body: string;
    schedule?: { at: Date };
  }) => {
    await CapacitorService.scheduleLocalNotification({
      title: options.title,
      body: options.body,
      id: Date.now(),
      schedule: options.schedule,
    });
  }, []);

  const showToast = useCallback(async (
    message: string,
    duration: 'short' | 'long' = 'short'
  ) => {
    await CapacitorService.showToast(message, duration);
  }, []);

  const openUrl = useCallback(async (url: string) => {
    await CapacitorService.openUrl(url);
  }, []);

  const getDeviceInfo = useCallback(async () => {
    return await CapacitorService.getDeviceInfo();
  }, []);

  return {
    // Platform info
    isMobile,
    isAndroid,
    isIOS,
    isWeb,
    
    // Network
    networkStatus,
    checkNetworkStatus,
    
    // Push notifications
    pushToken,
    
    // Camera
    takePicture,
    selectImage,
    capturePhoto,
    
    // Haptics
    hapticFeedback,
    
    // Keyboard
    hideKeyboard,
    
    // Share
    shareContent,
    
    // Location
    getCurrentPosition,
    
    // File system
    saveFile,
    readFile,
    
    // Notifications
    scheduleNotification,
    
    // Toast
    showToast,
    
    // Browser
    openUrl,
    
    // Device
    getDeviceInfo,
  };
}

export type UseMobileFeaturesReturn = ReturnType<typeof useMobileFeatures>;

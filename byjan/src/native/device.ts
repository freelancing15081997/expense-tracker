import { AppState, Linking, Platform } from 'react-native';
import { ApiError, paymentsApi } from '../api';

/** Mirrors the You-screen toggles so the lock timer can respect them. */
export const deviceFlags = { lock: true, bio: true };

async function load(name: string): Promise<any | null> {
  try {
    if (name === 'expo-image-picker') return await import('expo-image-picker');
    if (name === 'expo-image-manipulator') return await import('expo-image-manipulator');
    if (name === 'expo-document-picker') return await import('expo-document-picker');
    if (name === 'expo-local-authentication') return await import('expo-local-authentication');
    if (name === 'expo-secure-store') return await import('expo-secure-store');
    if (name === 'expo-notifications') return await import('expo-notifications');
    if (name === 'expo-device') return await import('expo-device');
    if (name === '@react-native-community/netinfo') return await import('@react-native-community/netinfo');
    return null;
  } catch {
    return null;
  }
}

export async function pickImage(from: 'camera' | 'library') {
  const ImagePicker = await load('expo-image-picker');
  if (!ImagePicker) return null;
  const perm = from === 'camera' ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return null;
  const result = from === 'camera'
    ? await ImagePicker.launchCameraAsync({ quality: 0.7, allowsEditing: false })
    : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
  const asset = result.assets?.[0];
  if (!asset) return null;
  let uri = asset.uri;
  let name = asset.fileName || 'photo.jpg';
  let type = asset.mimeType || 'image/jpeg';
  const Manipulator = await load('expo-image-manipulator');
  if (Manipulator) {
    const actions = asset.width && asset.width > 1600 ? [{ resize: { width: 1600 } }] : [];
    try {
      const out = await Manipulator.manipulateAsync(uri, actions, { compress: 0.7, format: Manipulator.SaveFormat?.JPEG });
      uri = out.uri;
      name = name.replace(/\.\w+$/, '') + '.jpg';
      type = 'image/jpeg';
    } catch { /* keep the original file if resize fails */ }
  }
  return { uri, name, type };
}

export async function pickDocument(types?: string[]) {
  const DocumentPicker = await load('expo-document-picker');
  if (!DocumentPicker) return null;
  const result = await DocumentPicker.getDocumentAsync({ type: types || '*/*', copyToCacheDirectory: true, multiple: false });
  const asset = result.assets?.[0];
  if (!asset) return null;
  if (asset.size && asset.size > 10 * 1024 * 1024) throw new Error('FILE_TOO_LARGE');
  return { uri: asset.uri, name: asset.name, type: asset.mimeType || 'application/octet-stream' };
}

export async function biometricUnlock() {
  const Local = await load('expo-local-authentication');
  if (!Local) return 'device-signature';
  const enrolled = await Local.hasHardwareAsync();
  if (!enrolled) return null;
  const result = await Local.authenticateAsync({ promptMessage: 'Unlock Byjan', cancelLabel: 'Use PIN' });
  return result.success ? 'device-signature' : null;
}

export async function saveSession(token: string) {
  const Secure = await load('expo-secure-store');
  if (Secure) await Secure.setItemAsync('byjan.token', token);
}

export async function registerPush() {
  const Notifications = await load('expo-notifications');
  const Device = await load('expo-device');
  if (!Notifications) return { token: 'ExponentPushToken[mock]', platform: Platform.OS };
  const perm = await Notifications.requestPermissionsAsync();
  if (perm.status !== 'granted') return null;
  if (Device && !Device.isDevice) return { token: 'ExponentPushToken[mock]', platform: Platform.OS };
  const token = await Notifications.getExpoPushTokenAsync().catch(() => ({ data: 'ExponentPushToken[mock]' }));
  return { token: token.data as string, platform: Platform.OS };
}

export async function readNetwork() {
  const NetInfo = await load('@react-native-community/netinfo');
  if (!NetInfo) return { wifi: 'Not connected', data: 'No signal', online: false };
  const state = await NetInfo.fetch();
  const online = Boolean(state.isConnected);
  return {
    wifi: state.type === 'wifi' && online ? 'Connected' : 'Not connected',
    data: state.type === 'cellular' && online ? 'Connected' : online ? 'Available' : 'No signal',
    online,
  };
}

const seenQr = new Set<string>();
export function takeQrOnce(payload: string) {
  if (!payload || seenQr.has(payload)) return false;
  seenQr.add(payload);
  setTimeout(() => seenQr.delete(payload), 4000);
  return true;
}

export async function openUpiAndWait(intentUrl: string, paymentId: string, ctx: { amount: number; app: string; to: string }, onWait?: (app: string) => void) {
  if (Platform.OS !== 'web') {
    try { if (await Linking.canOpenURL(intentUrl)) await Linking.openURL(intentUrl); } catch { /* poll anyway */ }
  }
  onWait?.(ctx.app);
  const started = Date.now();
  let last = await paymentsApi.status(paymentId, ctx);
  while (last.status === 'PENDING' && Date.now() - started < 60000) {
    await new Promise(r => setTimeout(r, 2000));
    if (AppState.currentState !== 'active' && Date.now() - started < 55000) continue;
    last = await paymentsApi.status(paymentId, ctx);
  }
  if (last.status === 'PENDING') throw new ApiError(408, 'PENDING', `Still waiting for ${ctx.app}`);
  if (last.status === 'FAILED') throw new ApiError(402, last.code || 'FAILED', last.failReason || 'Payment failed');
  return last;
}

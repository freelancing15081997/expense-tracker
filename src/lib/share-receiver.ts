import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core';

export type SharedPayload = {
  text?: string;
  mimeType?: string;
  fileName?: string;
  dataBase64?: string;
  source?: string;
  receivedAt?: string | number;
  error?: string;
};

type ShareReceiverPlugin = {
  checkPending(): Promise<SharedPayload>;
  addListener(
    eventName: 'shareReceived',
    listenerFunc: (event: SharedPayload) => void,
  ): Promise<PluginListenerHandle>;
};

const ShareReceiver = registerPlugin<ShareReceiverPlugin>('ShareReceiver');

export function shareReceiverAvailable() {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
}

export async function checkPendingShare(): Promise<SharedPayload | null> {
  if (!shareReceiverAvailable()) return null;
  try {
    const payload = await ShareReceiver.checkPending();
    if (!payload?.text && !payload?.dataBase64) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function onShareReceived(handler: (payload: SharedPayload) => void): Promise<() => void> {
  if (!shareReceiverAvailable()) return () => undefined;
  const handle = await ShareReceiver.addListener('shareReceived', handler);
  return () => {
    void handle.remove();
  };
}

function isSupportedShareMime(mime: string, fileName = '') {
  const m = mime.toLowerCase();
  const name = fileName.toLowerCase();
  if (m.startsWith('image/')) return true;
  if (m === 'application/pdf' || name.endsWith('.pdf')) return true;
  if (
    m.includes('spreadsheet')
    || m.includes('excel')
    || m === 'text/csv'
    || m === 'application/csv'
    || name.endsWith('.xlsx')
    || name.endsWith('.xls')
    || name.endsWith('.csv')
  ) return true;
  return false;
}

/** Build a data URL for any supported shared file (image / PDF / Excel / CSV). */
export function sharedFileDataUrl(payload: SharedPayload): string | null {
  if (!payload.dataBase64) return null;
  const mime = String(payload.mimeType || 'application/octet-stream').split(';')[0].trim();
  const fileName = String(payload.fileName || '');
  if (!isSupportedShareMime(mime, fileName)) return null;
  let resolved = mime;
  if (fileName.endsWith('.xlsx') && !mime.includes('sheet') && !mime.includes('excel')) {
    resolved = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  } else if (fileName.endsWith('.xls') && !mime.includes('excel')) {
    resolved = 'application/vnd.ms-excel';
  } else if (fileName.endsWith('.csv') && !mime.includes('csv')) {
    resolved = 'text/csv';
  } else if (fileName.endsWith('.pdf') && mime !== 'application/pdf') {
    resolved = 'application/pdf';
  }
  return `data:${resolved};base64,${payload.dataBase64}`;
}

/** @deprecated use sharedFileDataUrl */
export function sharedImageDataUrl(payload: SharedPayload): string | null {
  return sharedFileDataUrl(payload);
}

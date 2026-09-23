import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core';

export type SharedFile = {
  mimeType?: string;
  fileName?: string;
  dataBase64?: string;
  byteLength?: number;
};

export type SharedPayload = {
  text?: string;
  mimeType?: string;
  fileName?: string;
  dataBase64?: string;
  source?: string;
  receivedAt?: string | number;
  byteLength?: number;
  hasPending?: boolean;
  error?: string;
  files?: SharedFile[];
  fileCount?: number;
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

/** Warm shares send a light event — pull the full image from native pending. */
export async function resolveSharePayload(payload: SharedPayload): Promise<SharedPayload> {
  if (payload.error) return payload;
  // Always drain native pending when flagged — avoids stale/partial bridge payloads on 2nd share.
  if (payload.hasPending || !(payload.dataBase64 && payload.dataBase64.length > 64)) {
    const full = await checkPendingShare();
    if (full && (full.dataBase64 || full.text)) {
      return {
        ...payload,
        ...full,
        text: full.text || payload.text,
        mimeType: full.mimeType || payload.mimeType,
        fileName: full.fileName || payload.fileName,
        dataBase64: full.dataBase64 || payload.dataBase64,
        receivedAt: full.receivedAt || payload.receivedAt,
        files: full.files?.length ? full.files : payload.files,
        fileCount: full.fileCount || payload.fileCount,
      };
    }
  }
  return payload;
}

export async function onShareReceived(handler: (payload: SharedPayload) => void): Promise<() => void> {
  if (!shareReceiverAvailable()) return () => undefined;
  const handle = await ShareReceiver.addListener('shareReceived', handler);
  return () => {
    void handle.remove();
  };
}

function isSupportedShareMime(mime: string, fileName = '', dataBase64 = '') {
  const m = mime.toLowerCase();
  const name = fileName.toLowerCase();
  if (m.startsWith('image/')) return true;
  if (m === 'application/pdf' || name.endsWith('.pdf') || /^JVBER/i.test(String(dataBase64).slice(0, 16))) return true;
  if (
    m.includes('spreadsheet')
    || m.includes('excel')
    || m === 'text/csv'
    || m === 'application/csv'
    || m === 'text/plain'
    || m.includes('msword')
    || m.includes('wordprocessingml')
    || m === 'application/rtf'
    || m === 'text/rtf'
    || m === 'application/octet-stream'
    || name.endsWith('.xlsx')
    || name.endsWith('.xls')
    || name.endsWith('.csv')
    || name.endsWith('.doc')
    || name.endsWith('.docx')
    || name.endsWith('.txt')
    || name.endsWith('.rtf')
    || name.endsWith('.heic')
    || name.endsWith('.heif')
  ) return true;
  return false;
}

/** Build a data URL for any supported shared file (image / PDF / Office / CSV / text). */
export function sharedFileDataUrl(payload: SharedPayload): string | null {
  if (!payload.dataBase64) return null;
  const mime = String(payload.mimeType || 'application/octet-stream').split(';')[0].trim();
  const fileName = String(payload.fileName || '');
  if (!isSupportedShareMime(mime, fileName, payload.dataBase64)) return null;
  let resolved = mime;
  if (fileName.endsWith('.xlsx') && !mime.includes('sheet') && !mime.includes('excel')) {
    resolved = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  } else if (fileName.endsWith('.xls') && !mime.includes('excel')) {
    resolved = 'application/vnd.ms-excel';
  } else if (fileName.endsWith('.csv') && !mime.includes('csv')) {
    resolved = 'text/csv';
  } else if (fileName.endsWith('.docx') && !mime.includes('wordprocessingml')) {
    resolved = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  } else if (fileName.endsWith('.doc') && !mime.includes('msword')) {
    resolved = 'application/msword';
  } else if (fileName.endsWith('.pdf') && mime !== 'application/pdf') {
    resolved = 'application/pdf';
  } else if (/^JVBER/i.test(String(payload.dataBase64 || '').slice(0, 16))) {
    resolved = 'application/pdf';
  } else if (fileName.endsWith('.heic') && !mime.startsWith('image/')) {
    resolved = 'image/heic';
  }
  return `data:${resolved};base64,${payload.dataBase64}`;
}

/** @deprecated use sharedFileDataUrl */
export function sharedImageDataUrl(payload: SharedPayload): string | null {
  return sharedFileDataUrl(payload);
}

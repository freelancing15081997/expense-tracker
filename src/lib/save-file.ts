import { Capacitor } from '@capacitor/core';

function safeFileName(name: string, fallback = 'byjan-file') {
  const cleaned = String(name || fallback).replace(/[^\w.-]+/g, '_').replace(/_+/g, '_').replace(/^_+|_+$/g, '');
  return cleaned.slice(0, 80) || fallback;
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function textToBase64(text: string) {
  return bytesToBase64(new TextEncoder().encode(text));
}

function base64ToBlob(base64: string, mime: string) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime || 'application/octet-stream' });
}

function webDownload(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}

/** Save inside the app first. Public Documents needs a storage permission many phones refuse. */
async function nativeSaveBase64(fileName: string, base64: string) {
  const { Filesystem, Directory } = await import('@capacitor/filesystem');
  const path = `Byjan/${safeFileName(fileName)}`;
  let savedUri = '';
  try {
    await Filesystem.writeFile({ path, data: base64, directory: Directory.Documents, recursive: true });
    savedUri = (await Filesystem.getUri({ path, directory: Directory.Documents })).uri;
  } catch {
    await Filesystem.writeFile({ path, data: base64, directory: Directory.Cache, recursive: true });
    savedUri = (await Filesystem.getUri({ path, directory: Directory.Cache })).uri;
    try {
      const { Share } = await import('@capacitor/share');
      await Share.share({ title: fileName, url: savedUri, dialogTitle: 'Save file' });
    } catch {
      /* share dismissed — the file is still in app storage */
    }
  }
  try {
    const { Toast } = await import('@capacitor/toast');
    await Toast.show({ text: `Saved · ${fileName}`, duration: 'short', position: 'bottom' });
  } catch {
    /* toast optional */
  }
  return savedUri;
}

export async function saveTextFile(fileName: string, text: string, mime = 'text/plain', _title?: string) {
  const name = safeFileName(fileName);
  if (Capacitor.isNativePlatform()) {
    await nativeSaveBase64(name, textToBase64(text));
    return 'downloaded' as const;
  }
  webDownload(new Blob([text], { type: `${mime};charset=utf-8` }), name);
  return 'downloaded' as const;
}

export async function savePdfBase64(fileName: string, base64: string, _title?: string) {
  const name = safeFileName(fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`);
  const data = String(base64 || '').replace(/^data:application\/pdf[^,]*,/i, '');
  if (!data) throw new Error('The PDF was empty.');
  if (Capacitor.isNativePlatform()) {
    await nativeSaveBase64(name, data);
    return 'downloaded' as const;
  }
  webDownload(base64ToBlob(data, 'application/pdf'), name);
  return 'downloaded' as const;
}

export { safeFileName };

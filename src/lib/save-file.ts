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

async function nativeShareBase64(fileName: string, base64: string, title: string) {
  const { Filesystem, Directory } = await import('@capacitor/filesystem');
  const { Share } = await import('@capacitor/share');
  const path = `byjan_${Date.now()}_${fileName}`;
  const shareUri = async (uri: string) => {
    try {
      await Share.share({
        title,
        text: title,
        url: uri,
        dialogTitle: 'Save or share',
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err || '');
      if (/cancel/i.test(message)) return;
      throw err;
    }
  };
  try {
    await Filesystem.writeFile({ path, data: base64, directory: Directory.Cache, recursive: true });
    const uri = await Filesystem.getUri({ path, directory: Directory.Cache });
    await shareUri(uri.uri);
  } catch {
    await Filesystem.writeFile({ path, data: base64, directory: Directory.Documents, recursive: true });
    const uri = await Filesystem.getUri({ path, directory: Directory.Documents });
    await shareUri(uri.uri);
  }
}

export async function saveTextFile(fileName: string, text: string, mime = 'text/plain', title?: string) {
  const name = safeFileName(fileName);
  if (Capacitor.isNativePlatform()) {
    await nativeShareBase64(name, textToBase64(text), title || name);
    return 'shared' as const;
  }
  webDownload(new Blob([text], { type: `${mime};charset=utf-8` }), name);
  return 'downloaded' as const;
}

export async function savePdfBase64(fileName: string, base64: string, title?: string) {
  const name = safeFileName(fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`);
  const data = String(base64 || '').replace(/^data:application\/pdf[^,]*,/i, '');
  if (!data) throw new Error('The PDF was empty.');
  if (Capacitor.isNativePlatform()) {
    await nativeShareBase64(name, data, title || name);
    return 'shared' as const;
  }
  webDownload(base64ToBlob(data, 'application/pdf'), name);
  return 'downloaded' as const;
}

export { safeFileName };

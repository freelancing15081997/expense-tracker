/** Receipt upload for Money — single compress + resilient native upload. */

import { Capacitor, CapacitorHttp } from '@capacitor/core';
import { apiUrl, isNativeApp } from './api';
import { getJwtToken } from './auth-client';
import { newMoneyId } from './money-core';

const MAX_UPLOAD_BYTES = 900 * 1024;
const TARGET_BYTES = 280 * 1024;
const TINY_TARGET_BYTES = 140 * 1024;
/** Fast share path: enough detail for Gemini + OCR, small enough for Vercel body. */
const SHARE_TARGET_BYTES = 420 * 1024;

async function waitForToken() {
  let token = await getJwtToken();
  if (token) return token;
  if (!isNativeApp() && !Capacitor.isNativePlatform()) return null;
  for (let i = 0; i < 8 && !token; i += 1) {
    await new Promise((r) => setTimeout(r, 50));
    token = await getJwtToken();
  }
  return token;
}

function dataUrlToBytes(dataUrl: string): { bytes: Uint8Array; mime: string } {
  const match = String(dataUrl || '').match(/^data:([^;]+);base64,([\s\S]+)$/);
  if (match) {
    const mime = match[1];
    const base64 = match[2].replace(/\s+/g, '');
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return { bytes, mime };
  }
  const raw = String(dataUrl || '').replace(/\s+/g, '');
  if (/^[A-Za-z0-9+/]+=*$/.test(raw) && raw.length > 64) {
    const binary = atob(raw);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return { bytes, mime: 'image/jpeg' };
  }
  throw new Error('Invalid receipt image data');
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

async function compressForUpload(
  dataUrl: string,
  mimeType: string,
  targetBytes = TARGET_BYTES,
): Promise<{ bytes: Uint8Array; mime: string; dataUrl: string }> {
  const toResult = (bytes: Uint8Array, mime: string) => ({
    bytes,
    mime,
    dataUrl: `data:${mime};base64,${bytesToBase64(bytes)}`,
  });

  const fallback = () => {
    const parsed = dataUrlToBytes(dataUrl.startsWith('data:') ? dataUrl : `data:${mimeType};base64,${dataUrl}`);
    return toResult(parsed.bytes, parsed.mime);
  };

  if (!mimeType.startsWith('image/') || typeof document === 'undefined') return fallback();

  try {
    const src = dataUrl.startsWith('data:') ? dataUrl : `data:${mimeType};base64,${dataUrl}`;
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Could not read image'));
      el.src = src;
    });

    // Keep enough OCR detail for UPI digits — avoid crushing below ~960px / q 0.55 on share path.
    const qualities = targetBytes >= 400_000 ? [0.82, 0.68, 0.55] : [0.72, 0.55, 0.4];
    const edges = targetBytes >= 400_000 ? [1600, 1280, 960] : [1280, 960, 720];
    let best: { bytes: Uint8Array; mime: string; dataUrl: string } | null = null;

    for (const maxEdge of edges) {
      const scale = Math.min(1, maxEdge / Math.max(img.width, img.height, 1));
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) break;
      ctx.drawImage(img, 0, 0, w, h);
      for (const q of qualities) {
        const next = canvas.toDataURL('image/jpeg', q);
        const { bytes } = dataUrlToBytes(next);
        best = toResult(bytes, 'image/jpeg');
        if (bytes.length <= targetBytes) return best;
      }
    }
    return best || fallback();
  } catch {
    return fallback();
  }
}

function friendlyUploadError(status: number, raw: string, payload: Record<string, unknown>) {
  const blob = `${raw} ${payload.error || ''}`.toLowerCase();
  if (blob.includes('function_payload_too_large') || blob.includes('request_entity_too_large') || status === 413) {
    return 'Receipt image is too large after compress.';
  }
  if (blob.includes('function_invocation_failed')) {
    return 'Upload server hiccup. Retrying with a smaller photo…';
  }
  if (status === 401 || status === 403) return 'Not allowed to upload to this Money book.';
  if (status === 503) return 'File storage is warming up.';
  if (status === 429) return 'Too many uploads. Try again in a moment.';
  return String(payload.error || (status ? `Upload failed (${status})` : 'Upload failed'));
}

async function parseResponse(status: number, data: unknown): Promise<{ path: string }> {
  let raw = '';
  let payload: Record<string, unknown> = {};
  if (typeof data === 'string') {
    raw = data;
    if (data.trimStart().startsWith('<') || /FUNCTION_INVOCATION_FAILED/i.test(data)) {
      throw new Error(friendlyUploadError(status || 500, data, {}));
    }
    try { payload = JSON.parse(data || '{}'); } catch { payload = { error: data.slice(0, 160) }; }
  } else if (data && typeof data === 'object') {
    payload = data as Record<string, unknown>;
    raw = JSON.stringify(payload);
  }
  if (status < 200 || status >= 300) throw new Error(friendlyUploadError(status, raw, payload));
  const path = String(payload.path || payload.pathname || payload.url || '');
  if (!path) throw new Error('Upload did not return a file path');
  return { path };
}

async function uploadBinaryOnce(input: {
  bookId: string;
  fileId: string;
  ext: string;
  mime: string;
  fileName: string;
  bytes: Uint8Array;
  token: string;
}) {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${input.token}`,
    'Content-Type': input.mime,
    'x-book-id': input.bookId,
    'x-file-id': input.fileId,
    'x-file-ext': input.ext,
    'x-file-name': encodeURIComponent(input.fileName),
    'x-content-type': input.mime,
  };
  const url = apiUrl('/api/blob/upload');
  const body = new Blob([input.bytes.buffer.slice(input.bytes.byteOffset, input.bytes.byteOffset + input.bytes.byteLength) as ArrayBuffer], { type: input.mime });

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body,
      credentials: 'omit',
    });
    const text = await res.text();
    return (await parseResponse(res.status, text)).path;
  } catch (err) {
    if (!(isNativeApp() || Capacitor.isNativePlatform())) throw err;
  }

  const res = await CapacitorHttp.request({
    url,
    method: 'POST',
    headers,
    data: bytesToBase64(input.bytes),
    dataType: 'file',
    connectTimeout: 20000,
    readTimeout: 20000,
  });
  return (await parseResponse(res.status, res.data)).path;
}

export async function prepareReceiptImage(dataUrl: string, mimeType = 'image/jpeg', tiny = false) {
  const target = tiny ? TINY_TARGET_BYTES : SHARE_TARGET_BYTES;
  return compressForUpload(dataUrl, mimeType, target);
}

export async function uploadLedgerFile(bookId: string, file: {
  dataUrl: string;
  fileName?: string;
  mimeType?: string;
}) {
  if (!bookId) throw new Error('Choose a Money book before attaching a file');
  if (!file?.dataUrl) throw new Error('No file to upload');
  const token = await waitForToken();
  if (!token) throw new Error('Sign in again to upload this file');

  const mime = String(file.mimeType || 'application/octet-stream').split(';')[0].trim();
  const fileName = file.fileName || 'shared-file';
  const { bytes } = dataUrlToBytes(file.dataUrl.startsWith('data:') ? file.dataUrl : `data:${mime};base64,${file.dataUrl}`);
  if (!bytes.length || bytes.length > MAX_UPLOAD_BYTES * 4) throw new Error('Shared file is too large');

  const ext = (fileName.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '') || 'bin';
  const fileId = newMoneyId('file').replace(/[^a-zA-Z0-9_-]/g, '_');
  const path = await uploadBinaryOnce({
    bookId,
    fileId,
    ext,
    mime,
    fileName,
    bytes,
    token,
  });
  return { receiptPath: path, receiptName: fileName, receiptUrl: '', dataUrl: file.dataUrl };
}

function isPdfBytes(bytes: Uint8Array): boolean {
  return bytes.length >= 4 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46;
}

/** Upload already-compressed bytes (no second canvas pass). Preserves PDF/docs — never force .jpg. */
export async function uploadPreparedReceipt(bookId: string, prepared: {
  bytes: Uint8Array;
  mime: string;
  dataUrl: string;
  fileName?: string;
}) {
  if (!bookId) throw new Error('Choose a Money book before attaching a receipt');
  const token = await waitForToken();
  if (!token) throw new Error('Sign in again to upload this receipt');

  const mime = String(prepared.mime || 'image/jpeg').split(';')[0].trim();
  const rawName = prepared.fileName || 'receipt.jpg';
  const pdf = mime === 'application/pdf' || /\.pdf$/i.test(rawName) || isPdfBytes(prepared.bytes);

  // PDFs and non-images must keep original bytes + extension (preview + server parse depend on it).
  if (pdf || !mime.startsWith('image/')) {
    let bytes = prepared.bytes;
    let dataUrl = prepared.dataUrl;
    if (!bytes.length || bytes.length > MAX_UPLOAD_BYTES * 4) {
      throw new Error('Document is too large to upload');
    }
    const ext = pdf ? 'pdf' : ((rawName.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '') || 'bin');
    const uploadMime = pdf ? 'application/pdf' : mime;
    const fileName = pdf && !/\.pdf$/i.test(rawName) ? `${rawName.replace(/\.\w+$/, '')}.pdf` : rawName;
    const fileId = newMoneyId('rcpt').replace(/[^a-zA-Z0-9_-]/g, '_');
    const path = await uploadBinaryOnce({
      bookId,
      fileId,
      ext,
      mime: uploadMime,
      fileName,
      bytes,
      token,
    });
    return { receiptPath: path, receiptName: fileName, receiptUrl: '', dataUrl };
  }

  let bytes = prepared.bytes;
  let dataUrl = prepared.dataUrl;
  if (!bytes.length || bytes.length > MAX_UPLOAD_BYTES) {
    const tiny = await compressForUpload(prepared.dataUrl, mime || 'image/jpeg', TINY_TARGET_BYTES);
    bytes = tiny.bytes;
    dataUrl = tiny.dataUrl;
  }
  if (!bytes.length || bytes.length > MAX_UPLOAD_BYTES) throw new Error('Receipt image is too large after compress.');

  const fileName = rawName.replace(/\.\w+$/, '') + '.jpg';
  const fileId = newMoneyId('rcpt').replace(/[^a-zA-Z0-9_-]/g, '_');
  const path = await uploadBinaryOnce({
    bookId,
    fileId,
    ext: 'jpg',
    mime: 'image/jpeg',
    fileName,
    bytes,
    token,
  });
  return { receiptPath: path, receiptName: fileName, receiptUrl: '', dataUrl };
}

export async function uploadLedgerReceipt(bookId: string, file: {
  dataUrl: string;
  fileName?: string;
  mimeType?: string;
  /** Skip re-compress when caller already prepared the image. */
  prepared?: { bytes: Uint8Array; mime: string; dataUrl: string };
}) {
  if (!bookId) throw new Error('Choose a Money book before attaching a receipt');
  if (!file?.dataUrl && !file?.prepared) throw new Error('No receipt image to upload');

  const mime = String(file.mimeType || file.prepared?.mime || 'image/jpeg');
  const looksHeic = /heic|heif/i.test(mime) || /\.hei[cf]$/i.test(String(file.fileName || ''));
  if ((!mime.startsWith('image/') || looksHeic) && !file.prepared) {
    return uploadLedgerFile(bookId, file as { dataUrl: string; fileName?: string; mimeType?: string });
  }

  if (file.prepared) {
    return uploadPreparedReceipt(bookId, {
      ...file.prepared,
      fileName: file.fileName,
    });
  }

  const token = await waitForToken();
  if (!token) throw new Error('Sign in again to upload this receipt');

  const fileName = file.fileName || 'receipt.jpg';
  // Compress once at share size; only shrink further if that upload fails.
  let prepared = await compressForUpload(file.dataUrl, mime, SHARE_TARGET_BYTES);
  let lastError: Error | null = null;

  for (const target of [null, TARGET_BYTES, TINY_TARGET_BYTES] as Array<number | null>) {
    if (target != null) {
      prepared = await compressForUpload(file.dataUrl, mime, target);
    }
    if (!prepared.bytes.length || prepared.bytes.length > MAX_UPLOAD_BYTES) continue;
    const fileId = newMoneyId('rcpt').replace(/[^a-zA-Z0-9_-]/g, '_');
    try {
      const path = await uploadBinaryOnce({
        bookId,
        fileId,
        ext: 'jpg',
        mime: 'image/jpeg',
        fileName: fileName.replace(/\.\w+$/, '.jpg'),
        bytes: prepared.bytes,
        token,
      });
      return { receiptPath: path, receiptName: fileName, receiptUrl: '', dataUrl: prepared.dataUrl };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error('Upload failed');
    }
  }

  throw lastError || new Error('Upload failed');
}

export {
  learnRuleFromCorrection,
  readCategoryTree,
  flattenCategoryNames,
  buildEvidenceTrail,
  equalSplitShares,
  settlementBalances,
  type CategoryNode,
} from './money-helpers';

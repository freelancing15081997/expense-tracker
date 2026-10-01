import { apiUpload } from './api';
import { newId } from './format';

const MAX_IMAGE = 900 * 1024;
const SHARE_TARGET = 420 * 1024;

export type PreparedFile = { bytes: Uint8Array; mime: string; dataUrl: string; base64: string; fileName: string; isImage: boolean; isPdf: boolean };

function b64ToBytes(b64: string) {
  const bin = atob(b64.replace(/\s+/g, ''));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function bytesToB64(bytes: Uint8Array) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
export function splitDataUrl(dataUrl: string) {
  const m = String(dataUrl).match(/^data:([^;]+);base64,([\s\S]+)$/);
  if (!m) return { mime: 'image/jpeg', base64: String(dataUrl).replace(/\s+/g, '') };
  return { mime: m[1], base64: m[2].replace(/\s+/g, '') };
}

async function compressImage(dataUrl: string, target: number) {
  const img = await new Promise<HTMLImageElement>((res, rej) => { const el = new Image(); el.onload = () => res(el); el.onerror = () => rej(new Error('Could not read image')); el.src = dataUrl; });
  // Keep enough detail for UPI reference digits: never go below ~960px.
  for (const edge of [1600, 1280, 960]) {
    const s = Math.min(1, edge / Math.max(img.width, img.height, 1));
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(img.width * s)); c.height = Math.max(1, Math.round(img.height * s));
    const ctx = c.getContext('2d'); if (!ctx) break;
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(img, 0, 0, c.width, c.height);
    for (const q of [0.82, 0.68, 0.55]) {
      const url = c.toDataURL('image/jpeg', q);
      const { base64 } = splitDataUrl(url);
      if (base64.length * 0.75 <= target || (edge === 960 && q === 0.55)) return url;
    }
  }
  return dataUrl;
}

/** Normalise any picked/shared/camera file into upload-ready bytes. PDFs and docs keep original bytes. */
export async function prepareFile(dataUrl: string, fileName = 'receipt.jpg', mimeHint = ''): Promise<PreparedFile> {
  const { mime: m0, base64: b0 } = splitDataUrl(dataUrl);
  const mime = (mimeHint || m0).toLowerCase();
  const isPdf = mime === 'application/pdf' || /\.pdf$/i.test(fileName) || b0.startsWith('JVBER');
  const isImage = !isPdf && mime.startsWith('image/') && !/heic|heif/.test(mime);
  if (isImage) {
    const url = await compressImage(dataUrl, SHARE_TARGET);
    const { base64 } = splitDataUrl(url);
    const bytes = b64ToBytes(base64);
    if (bytes.length > MAX_IMAGE) throw new Error('This photo is too large. Crop it and try again.');
    return { bytes, base64, mime: 'image/jpeg', dataUrl: url, fileName: fileName.replace(/\.\w+$/, '') + '.jpg', isImage: true, isPdf: false };
  }
  const bytes = b64ToBytes(b0);
  if (bytes.length > 8 * 1024 * 1024) throw new Error('This file is larger than 8 MB.');
  return { bytes, base64: b0, mime: isPdf ? 'application/pdf' : mime || 'application/octet-stream', dataUrl, fileName: isPdf && !/\.pdf$/i.test(fileName) ? `${fileName}.pdf` : fileName, isImage: false, isPdf };
}

export async function uploadPrepared(bookId: string, f: PreparedFile) {
  const ext = f.isPdf ? 'pdf' : f.isImage ? 'jpg' : (f.fileName.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '') || 'bin';
  const path = await apiUpload({ bookId, fileId: newId('rcpt').replace(/[^a-zA-Z0-9_-]/g, '_'), ext, mime: f.mime, fileName: f.fileName, base64: f.base64, bytes: f.bytes });
  return { receiptPath: path, receiptName: f.fileName };
}

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = () => rej(new Error('Could not read file')); r.readAsDataURL(file); });
}

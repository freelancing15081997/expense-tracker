import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';

const MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED = new Set(['pdf', 'png', 'jpg', 'jpeg', 'webp', 'csv', 'txt', 'xlsx']);

const EXT_MIME: Record<string, string[]> = {
  pdf: ['application/pdf'],
  png: ['image/png'],
  jpg: ['image/jpeg'],
  jpeg: ['image/jpeg'],
  webp: ['image/webp'],
  csv: ['text/csv', 'application/vnd.ms-excel', 'text/plain'],
  txt: ['text/plain'],
  xlsx: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
};

export function inspectFile(file: File) {
  const name = file.name.replace(/[/\\]/g, '').trim();
  const ext = name.split('.').pop()?.toLowerCase() || '';
  if (!ALLOWED.has(ext)) throw new Error(`File type .${ext || 'unknown'} is not allowed`);
  if (file.size <= 0 || file.size > MAX_BYTES) throw new Error('File must be between 1 byte and 8 MB');
  const declared = (file.type || '').toLowerCase();
  if (declared && !EXT_MIME[ext].includes(declared)) {
    throw new Error('File extension does not match its type');
  }
  return { name, ext, size: file.size, contentType: declared || EXT_MIME[ext][0] };
}

async function readLegacyFirestoreFile(fileId: string) {
  const snap = await getDoc(doc(db, 'erp_files', fileId));
  if (!snap.exists()) throw new Error('File not found');
  const data = snap.data();
  if (!data.chunked) return data.data as string;
  const promises = [];
  for (let i = 0; i < data.totalChunks; i++) {
    promises.push(getDoc(doc(db, 'erp_files', `${fileId}_chunk_${i}`)));
  }
  const chunkSnaps = await Promise.all(promises);
  let fullBase64 = '';
  for (let i = 0; i < data.totalChunks; i++) {
    if (!chunkSnaps[i].exists()) throw new Error(`Missing file chunk ${i}`);
    fullBase64 += chunkSnaps[i].data()?.data || '';
  }
  return fullBase64;
}

export async function storeBooksFile(tenantId: string, fileId: string, file: File) {
  const meta = inspectFile(file);
  const res = await fetch('/api/blob/upload', {
    method: 'POST',
    headers: {
      'content-type': meta.contentType,
      'x-tenant-id': tenantId,
      'x-file-id': fileId,
      'x-file-ext': meta.ext,
      'x-file-name': encodeURIComponent(meta.name),
    },
    body: file,
  });
  const payload = await res.json().catch(() => ({ error: 'Upload failed' }));
  if (!res.ok) throw new Error(payload.error || 'Upload failed');
  const url = String(payload.url || '');
  const pathname = String(payload.pathname || `erp_workspaces/${tenantId}/files/${fileId}.${meta.ext}`);
  if (!url) throw new Error('Upload did not return a file URL');
  return { ...meta, path: url, url, pathname };
}

export async function booksFileUrl(path: string) {
  if (!path) throw new Error('Missing file path');
  if (path.startsWith('https://') || path.startsWith('http://') || path.startsWith('data:')) return path;
  if (path.startsWith('firestore://')) return readLegacyFirestoreFile(path.replace('firestore://', ''));
  throw new Error('File URL is unavailable. Re-upload the file.');
}

export async function removeBooksBlob(path: string) {
  if (!path || path.startsWith('firestore://')) return;
  if (!path.startsWith('http') && !path.startsWith('erp_workspaces/')) return;
  await fetch('/api/blob/delete', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ url: path }),
  }).catch(() => undefined);
}

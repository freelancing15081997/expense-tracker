import { deleteObject, getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { storage } from '../../lib/firebase';

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

export async function storeBooksFile(tenantId: string, fileId: string, file: File) {
  const meta = inspectFile(file);
  const path = `erp_workspaces/${tenantId}/files/${fileId}.${meta.ext}`;
  await uploadBytes(ref(storage, path), file, { contentType: meta.contentType });
  return { ...meta, path };
}

export function booksFileUrl(path: string) {
  return getDownloadURL(ref(storage, path));
}

export function removeBooksBlob(path: string) {
  return deleteObject(ref(storage, path));
}

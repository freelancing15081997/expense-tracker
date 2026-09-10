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
  const { authHeaders } = await import('../../lib/auth-client');
  const res = await fetch('/api/blob/upload', {
    method: 'POST',
    headers: await authHeaders({
      'content-type': meta.contentType,
      'x-tenant-id': tenantId,
      'x-file-id': fileId,
      'x-file-ext': meta.ext,
      'x-file-name': encodeURIComponent(meta.name),
    }),
    body: file,
  });
  const payload = await res.json().catch(() => ({ error: 'Upload failed' }));
  if (res.status === 429) throw new Error(payload.error || 'Blob storage rate limit reached. Wait a minute and try again.');
  if (!res.ok) throw new Error(payload.error || 'Upload failed');
  const url = String(payload.url || '');
  const pathname = String(payload.pathname || `erp_workspaces/${tenantId}/files/${fileId}.${meta.ext}`);
  if (!url) throw new Error('Upload did not return a file URL');
  return { ...meta, path: url, url, pathname };
}

export async function booksFileUrl(path: string) {
  if (!path) throw new Error('Missing file path');
  if (path.startsWith('https://') || path.startsWith('http://') || path.startsWith('data:')) return path;
  if (path.startsWith('erp_workspaces/')) {
    const { authHeaders } = await import('../../lib/auth-client');
    const res = await fetch(`/api/blob/file?path=${encodeURIComponent(path)}`, {
      headers: await authHeaders(),
    });
    if (!res.ok) throw new Error('File URL is unavailable. Re-upload the file.');
    const blob = await res.blob();
    return URL.createObjectURL(blob);
  }
  throw new Error('File URL is unavailable. Re-upload the file to Vercel Blob.');
}

export async function removeBooksBlob(path: string) {
  if (!path || path.startsWith('firestore://')) return;
  if (!path.startsWith('http') && !path.startsWith('erp_workspaces/')) return;
  await fetch('/api/blob/delete', {
    method: 'POST',
    headers: await (await import('../../lib/auth-client')).authHeaders({ 'content-type': 'application/json' }),
    body: JSON.stringify({ url: path }),
  }).catch(() => undefined);
}

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

function safeId(value: string) {
  return String(value || '').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128);
}

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

function uploadError(payload: { error?: string }, status: number) {
  if (status === 429) return payload.error || 'Blob storage rate limit reached. Wait a minute and try again.';
  return payload.error || 'Upload failed';
}

async function uploadViaServer(pathname: string, tenantId: string, fileId: string, file: File, meta: ReturnType<typeof inspectFile>) {
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
  if (!res.ok) throw new Error(uploadError(payload, res.status));
  const storedPath = String(payload.pathname || pathname);
  const url = String(payload.url || storedPath);
  if (!storedPath && !url) throw new Error('Upload did not return a file URL');
  return { ...meta, path: storedPath, url, pathname: storedPath };
}

export async function storeBooksFile(tenantId: string, fileId: string, file: File) {
  const meta = inspectFile(file);
  const safeTenant = safeId(tenantId);
  const safeFile = safeId(fileId);
  if (safeTenant.length < 4 || safeFile.length < 4) throw new Error('Invalid upload path');
  const pathname = `erp_workspaces/${safeTenant}/files/${safeFile}.${meta.ext}`;

  try {
    const { authHeaders } = await import('../../lib/auth-client');
    if (file.size <= 3.5 * 1024 * 1024) {
      return await uploadViaServer(pathname, safeTenant, safeFile, file, meta);
    }
    const { upload } = await import('@vercel/blob/client');
    const blob = await upload(pathname, file, {
      access: 'private',
      handleUploadUrl: '/api/blob/handle',
      headers: await authHeaders(),
      contentType: meta.contentType,
      multipart: file.size > 4 * 1024 * 1024,
      clientPayload: JSON.stringify({ tenantId: safeTenant, fileId: safeFile }),
    });
    const storedPath = blob.pathname || pathname;
    const url = (blob as { downloadUrl?: string }).downloadUrl || blob.url || storedPath;
    if (!url && !storedPath) throw new Error('Upload did not return a file URL');
    return { ...meta, path: storedPath, url, pathname: storedPath };
  } catch (err: any) {
    const message = String(err?.message || '');
    if (/not allowed|sign in required|file type|invalid upload/i.test(message) && !/public access|private store|failed to fetch|404|500|function/i.test(message)) {
      throw err instanceof Error ? err : new Error(message || 'Upload failed');
    }
    return uploadViaServer(pathname, safeTenant, safeFile, file, meta);
  }
}

const fileUrlCache = new Map<string, { url: string; at: number }>();

export async function booksFileUrl(path: string) {
  if (!path) throw new Error('Missing file path');
  if (path.startsWith('data:')) return path;
  const cached = fileUrlCache.get(path);
  if (cached && Date.now() - cached.at < 5 * 60_000) return cached.url;
  const needsProxy =
    path.startsWith('erp_workspaces/') ||
    path.includes('blob.vercel-storage.com');
  if (needsProxy) {
    const { authHeaders } = await import('../../lib/auth-client');
    const res = await fetch(`/api/blob/file?path=${encodeURIComponent(path)}`, {
      headers: await authHeaders(),
    });
    if (!res.ok) throw new Error('File URL is unavailable. Re-upload the file.');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    fileUrlCache.set(path, { url, at: Date.now() });
    return url;
  }
  if (path.startsWith('https://') || path.startsWith('http://')) return path;
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

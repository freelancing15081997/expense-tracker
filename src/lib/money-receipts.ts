/** Receipt upload for Money module (uses Vite API helpers). */

import { apiUrl } from './api';
import { authHeaders } from './auth-client';
import { newMoneyId } from './money-core';

export async function uploadLedgerReceipt(bookId: string, file: {
  dataUrl: string;
  fileName?: string;
  mimeType?: string;
}) {
  const mime = String(file.mimeType || 'image/jpeg');
  const ext = mime.includes('png') ? 'png' : mime.includes('webp') ? 'webp' : mime.includes('pdf') ? 'pdf' : 'jpg';
  const fileId = newMoneyId('rcpt');
  const blob = dataUrlToBlob(file.dataUrl);
  const headers = await authHeaders({
    'content-type': mime,
    'x-book-id': bookId,
    'x-file-id': fileId,
    'x-file-ext': ext,
    'x-file-name': file.fileName || `receipt.${ext}`,
    'x-content-type': mime,
  });
  const res = await fetch(apiUrl('/api/blob/upload'), {
    method: 'POST',
    headers,
    body: blob,
    credentials: 'include',
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(String((payload as { error?: string }).error || `Upload failed (${res.status})`));
  const path = String(
    (payload as { path?: string; pathname?: string; url?: string }).path
    || (payload as { pathname?: string }).pathname
    || (payload as { url?: string }).url
    || `books/${bookId}/files/${fileId}.${ext}`,
  );
  return {
    receiptPath: path,
    receiptName: file.fileName || `receipt.${ext}`,
    receiptUrl: '',
  };
}

function dataUrlToBlob(dataUrl: string) {
  if (dataUrl.startsWith('blob:')) {
    throw new Error('Pass a data URL for receipt upload');
  }
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) {
    const bytes = new TextEncoder().encode(dataUrl);
    return new Blob([bytes]);
  }
  const mime = match[1];
  const binary = atob(match[2]);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i += 1) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
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

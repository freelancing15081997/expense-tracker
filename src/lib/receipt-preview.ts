import type { AttachmentKind } from '../components/ReceiptModal';

/** Detect attachment kind from bytes + filename (fixes PDF stored with wrong MIME). */
export function sniffAttachmentKind(
  bytes: ArrayBuffer | Uint8Array,
  fileName: string,
  blobType = '',
): AttachmentKind {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  if (u8.length >= 4 && u8[0] === 0x25 && u8[1] === 0x50 && u8[2] === 0x44 && u8[3] === 0x46) {
    return 'pdf';
  }
  const n = String(fileName || '').toLowerCase();
  const pathHint = n.endsWith('.pdf') || /\.pdf$/i.test(n);
  const t = String(blobType || '').toLowerCase();
  if (pathHint || t.includes('pdf')) return 'pdf';
  if (t.startsWith('image/') || /\.(png|jpe?g|gif|webp|bmp)$/i.test(n)) return 'image';
  // JPEG magic
  if (u8.length >= 3 && u8[0] === 0xff && u8[1] === 0xd8 && u8[2] === 0xff) return 'image';
  // PNG magic
  if (u8.length >= 4 && u8[0] === 0x89 && u8[1] === 0x50 && u8[2] === 0x4e && u8[3] === 0x47) return 'image';
  return 'file';
}

export function mimeForAttachment(kind: AttachmentKind, blobType = ''): string {
  if (kind === 'pdf') return 'application/pdf';
  if (kind === 'image') {
    const t = String(blobType || '').toLowerCase();
    if (t.startsWith('image/')) return t.split(';')[0];
    return 'image/jpeg';
  }
  return blobType || 'application/octet-stream';
}

export function blobUrlForAttachment(
  bytes: ArrayBuffer,
  kind: AttachmentKind,
  blobType = '',
): string {
  const mime = mimeForAttachment(kind, blobType);
  return URL.createObjectURL(new Blob([bytes], { type: mime }));
}

/** Open PDF on native (Android WebView cannot render blob PDFs in iframe). */
export async function openNativePdfPreview(blobUrl: string, fileName: string): Promise<boolean> {
  const { Capacitor } = await import('@capacitor/core');
  if (!Capacitor.isNativePlatform()) return false;
  try {
    const res = await fetch(blobUrl);
    const buf = new Uint8Array(await res.arrayBuffer());
    let binary = '';
    const chunk = 0x8000;
    for (let i = 0; i < buf.length; i += chunk) {
      binary += String.fromCharCode(...buf.subarray(i, i + chunk));
    }
    const base64 = btoa(binary);
    const safeName = String(fileName || 'receipt.pdf').replace(/[^\w.-]+/g, '_');
    const path = `preview_${Date.now()}_${safeName.endsWith('.pdf') ? safeName : `${safeName}.pdf`}`;
    const { Filesystem, Directory } = await import('@capacitor/filesystem');
    const { Share } = await import('@capacitor/share');
    await Filesystem.writeFile({ path, data: base64, directory: Directory.Cache });
    const uri = await Filesystem.getUri({ path, directory: Directory.Cache });
    await Share.share({ title: fileName || 'PDF receipt', url: uri.uri, dialogTitle: 'Open PDF' });
    return true;
  } catch {
    return false;
  }
}

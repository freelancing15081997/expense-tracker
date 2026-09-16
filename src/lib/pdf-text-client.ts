/** Capacitor / browser PDF text layer via pdf.js (no Node pdf-parse worker). */

function b64ToBytes(base64: string): Uint8Array {
  const clean = String(base64 || '').replace(/^data:[^;]+;base64,/i, '').replace(/\s+/g, '');
  const binary = atob(clean);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export function looksLikePdfBase64(base64: string, mime = '', fileName = '') {
  if (String(mime || '').toLowerCase().includes('pdf')) return true;
  if (/\.pdf$/i.test(fileName || '')) return true;
  const head = String(base64 || '').replace(/^data:[^;]+;base64,/i, '').replace(/\s+/g, '').slice(0, 16);
  return /^JVBER/i.test(head);
}

let workerReady = false;

async function ensurePdfjs() {
  const pdfjs = await import('pdfjs-dist');
  if (!workerReady) {
    pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdf.worker.min.mjs', document.baseURI).href;
    workerReady = true;
  }
  return pdfjs;
}

export async function extractPdfTextClient(base64: string): Promise<string> {
  const bytes = b64ToBytes(base64);
  if (bytes.length < 32 || bytes[0] !== 0x25 || bytes[1] !== 0x50 || bytes[2] !== 0x44 || bytes[3] !== 0x46) {
    return '';
  }
  try {
    const pdfjs = await ensurePdfjs();
    const doc = await pdfjs.getDocument({ data: bytes, verbosity: 0 }).promise;
    try {
      const pages = Math.min(doc.numPages || 1, 3);
      const parts: string[] = [];
      for (let i = 1; i <= pages; i += 1) {
        const page = await doc.getPage(i);
        const content = await page.getTextContent();
        parts.push(content.items.map((item) => ('str' in item ? String(item.str || '') : '')).join(' '));
      }
      return parts.join(' ').replace(/\s+/g, ' ').trim().slice(0, 16_000);
    } finally {
      await doc.destroy();
    }
  } catch (err) {
    console.warn('pdf.js extract failed', err);
    return '';
  }
}

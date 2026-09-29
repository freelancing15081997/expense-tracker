/** On-device PDF text. The worker is bundled into the app; a stream read covers text-layer files if the worker cannot start. */

import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

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
    pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
    workerReady = true;
  }
  return pdfjs;
}

export async function extractPdfTextClient(base64: string): Promise<string> {
  const bytes = b64ToBytes(base64);
  if (bytes.length < 32 || bytes[0] !== 0x25 || bytes[1] !== 0x50 || bytes[2] !== 0x44 || bytes[3] !== 0x46) {
    return '';
  }
  const fromJs = await extractWithPdfJs(bytes);
  const text = fromJs || await extractPdfStreams(bytes);
  return text.replace(/\s+/g, ' ').trim().slice(0, 16_000);
}

async function extractWithPdfJs(bytes: Uint8Array): Promise<string> {
  try {
    const pdfjs = await ensurePdfjs();
    const doc = await pdfjs.getDocument({ data: bytes, verbosity: 0 }).promise;
    try {
      const total = Math.max(1, doc.numPages || 1);
      const wanted = new Set<number>();
      const cap = Math.min(total, 6);
      for (let i = 1; i <= cap; i += 1) wanted.add(i);
      if (total > cap) wanted.add(total);
      const parts: string[] = [];
      for (const i of wanted) {
        const page = await doc.getPage(i);
        const content = await page.getTextContent();
        parts.push(content.items.map((item) => ('str' in item ? String(item.str || '') : '')).join(' '));
      }
      return parts.join('\n');
    } finally {
      await doc.destroy();
    }
  } catch (err) {
    console.warn('pdf.js extract failed', err);
    return '';
  }
}

async function extractPdfStreams(bytes: Uint8Array): Promise<string> {
  const latin = new TextDecoder('latin1').decode(bytes);
  const parts: string[] = [];
  let from = 0;
  while (from < latin.length && parts.join(' ').length < 20_000) {
    const streamAt = latin.indexOf('stream', from);
    if (streamAt < 0) break;
    let dataStart = streamAt + 6;
    if (latin.charCodeAt(dataStart) === 13) dataStart += 1;
    if (latin.charCodeAt(dataStart) === 10) dataStart += 1;
    const end = latin.indexOf('endstream', dataStart);
    if (end < 0) break;
    if (end > dataStart && end - dataStart < 800_000) {
      const cleaned = pdfStreamToText(await inflatePdfStream(bytes.subarray(dataStart, end)));
      if (cleaned.length > 4) parts.push(cleaned);
    }
    from = end + 9;
  }
  return parts.join('\n');
}

async function inflatePdfStream(chunk: Uint8Array): Promise<string> {
  if (typeof DecompressionStream !== 'undefined') {
    try {
      const stream = new Blob([chunk]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
      const buf = new Uint8Array(await new Response(stream).arrayBuffer());
      if (buf.length > 16) return new TextDecoder('latin1').decode(buf);
    } catch {
      /* stored stream */
    }
  }
  return new TextDecoder('latin1').decode(chunk);
}

function pdfStreamToText(stream: string): string {
  if (!stream) return '';
  const parts: string[] = [];
  const re = /\((?:\\.|[^\\)]){1,200}\)/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(stream))) {
    const lit = match[0].slice(1, -1)
      .replace(/\\n/g, ' ')
      .replace(/\\r/g, ' ')
      .replace(/\\t/g, ' ')
      .replace(/\\\(/g, '(')
      .replace(/\\\)/g, ')');
    if (lit.trim()) parts.push(lit);
  }
  return parts.join(' ');
}

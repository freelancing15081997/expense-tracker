import { createRequire } from 'node:module';
import { inflateRawSync } from 'node:zlib';
import { pathToFileURL } from 'node:url';

/** Extract text from PDF bytes for server-side amount parsing (invoices, bills). */

let workerReady = false;

function ensurePdfWorker(PDFParse: { setWorker: (src?: string) => string }) {
  if (workerReady) return;
  try {
    const require = createRequire(import.meta.url);
    const workerPath = require.resolve('pdfjs-dist/legacy/build/pdf.worker.mjs');
    PDFParse.setWorker(pathToFileURL(workerPath).href);
    workerReady = true;
  } catch {
    workerReady = true;
  }
}

export async function extractPdfText(bytes: Buffer): Promise<string> {
  if (!bytes?.length || bytes.length < 32) return '';
  if (bytes[0] !== 0x25 || bytes[1] !== 0x50 || bytes[2] !== 0x44 || bytes[3] !== 0x46) return '';
  const parsed = await extractWithPdfParse(bytes);
  const text = parsed || extractPdfStreams(bytes);
  return text.replace(/\s+/g, ' ').trim().slice(0, 16_000);
}

async function extractWithPdfParse(bytes: Buffer): Promise<string> {
  try {
    const { PDFParse } = await import('pdf-parse');
    ensurePdfWorker(PDFParse);
    const parser = new PDFParse({ data: bytes });
    try {
      const result = await parser.getText();
      return String(result?.text || '');
    } finally {
      await parser.destroy().catch(() => undefined);
    }
  } catch {
    return '';
  }
}

/** Text-layer fallback when the PDF.js worker cannot start. Same stream read the phone already uses. */
function extractPdfStreams(bytes: Buffer): string {
  const latin = bytes.toString('latin1');
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
      const chunk = bytes.subarray(dataStart, end);
      const inflated = inflatePdfStream(chunk);
      const cleaned = pdfStreamToText(inflated);
      if (cleaned.length > 4) parts.push(cleaned);
    }
    from = end + 9;
  }
  return parts.join('\n');
}

function inflatePdfStream(chunk: Buffer): string {
  try {
    const inflated = inflateRawSync(chunk);
    if (inflated.length > 16) return inflated.toString('latin1');
  } catch {
    /* stored stream */
  }
  return chunk.toString('latin1');
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

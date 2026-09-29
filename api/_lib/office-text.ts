import { inflateRawSync } from 'node:zlib';

/** Word, RTF, and plain text. PDF stays in pdf-text.ts. */

export function isOfficeTextFile(mime: string, name: string) {
  const m = String(mime || '').toLowerCase();
  const n = String(name || '').toLowerCase();
  return m.includes('wordprocessing')
    || m.includes('msword')
    || m.includes('rtf')
    || m.startsWith('text/plain')
    || /\.(docx?|rtf|txt)$/i.test(n);
}

export function extractOfficeText(bytes: Buffer, mime: string, name: string): string {
  if (!bytes?.length) return '';
  const m = String(mime || '').toLowerCase();
  const n = String(name || '').toLowerCase();
  let text = '';
  if (n.endsWith('.docx') || m.includes('wordprocessingml')) text = docxText(bytes);
  else if (n.endsWith('.doc') || (m.includes('msword') && !m.includes('openxml'))) text = docBinaryText(bytes);
  else if (n.endsWith('.rtf') || m.includes('rtf')) text = rtfText(bytes);
  else if (n.endsWith('.txt') || m.startsWith('text/')) text = bytes.toString('utf8');
  return text.replace(/\s+/g, ' ').trim().slice(0, 16_000);
}

function docxText(buf: Buffer): string {
  const xml = zipEntry(buf, 'word/document.xml');
  if (!xml) return '';
  return xml
    .replace(/<w:p\b[^>]*>/g, '\n')
    .replace(/<w:tab\/>/g, '\t')
    .replace(/<w:br\/>/g, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, n) => {
      const code = Number(n);
      return Number.isFinite(code) ? String.fromCharCode(code) : '';
    });
}

function rtfText(buf: Buffer): string {
  return buf.toString('latin1')
    .replace(/\\par[d]?/g, '\n')
    .replace(/\\'[0-9a-fA-F]{2}/g, (m) => String.fromCharCode(parseInt(m.slice(2), 16)))
    .replace(/\\[a-z]+-?\d* ?/gi, '')
    .replace(/[{}]/g, '');
}

/** Word 97 .doc stores the body as UTF-16LE runs inside the OLE file. */
function docBinaryText(buf: Buffer): string {
  const parts: string[] = [];
  let run = '';
  const flush = () => {
    if (/[A-Za-z]/.test(run) && run.trim().length >= 4) parts.push(run.trim());
    run = '';
  };
  for (let i = 0; i + 1 < buf.length; i += 2) {
    const c = buf.readUInt16LE(i);
    const ok = c === 9 || c === 10 || c === 13 || c === 0x20b9 || (c >= 32 && c < 127);
    if (ok) run += String.fromCharCode(c);
    else flush();
  }
  flush();
  return parts.join(' ');
}

function zipEntry(buf: Buffer, want: string): string {
  const eocd = findEocd(buf);
  if (eocd < 0) return '';
  const count = buf.readUInt16LE(eocd + 10);
  let cursor = buf.readUInt32LE(eocd + 16);
  for (let i = 0; i < count; i += 1) {
    if (cursor + 46 > buf.length || buf.readUInt32LE(cursor) !== 0x02014b50) return '';
    const method = buf.readUInt16LE(cursor + 10);
    const compressed = buf.readUInt32LE(cursor + 20);
    const nameLen = buf.readUInt16LE(cursor + 28);
    const extraLen = buf.readUInt16LE(cursor + 30);
    const commentLen = buf.readUInt16LE(cursor + 32);
    const localAt = buf.readUInt32LE(cursor + 42);
    const name = buf.slice(cursor + 46, cursor + 46 + nameLen).toString('utf8');
    cursor += 46 + nameLen + extraLen + commentLen;
    if (name !== want) continue;
    if (localAt + 30 > buf.length || buf.readUInt32LE(localAt) !== 0x04034b50) return '';
    const localName = buf.readUInt16LE(localAt + 26);
    const localExtra = buf.readUInt16LE(localAt + 28);
    const start = localAt + 30 + localName + localExtra;
    const end = start + compressed;
    if (end > buf.length) return '';
    const payload = buf.subarray(start, end);
    if (method === 0) return payload.toString('utf8');
    if (method === 8) {
      try { return inflateRawSync(payload).toString('utf8'); } catch { return ''; }
    }
    return '';
  }
  return '';
}

function findEocd(buf: Buffer) {
  const min = Math.max(0, buf.length - 22 - 65535);
  for (let i = buf.length - 22; i >= min; i -= 1) {
    if (buf.readUInt32LE(i) === 0x06054b50) return i;
  }
  return -1;
}

/** Extract text from PDF bytes for server-side amount parsing (invoices, bills). */

export async function extractPdfText(bytes: Buffer): Promise<string> {
  if (!bytes?.length || bytes.length < 32) return '';
  if (bytes[0] !== 0x25 || bytes[1] !== 0x50 || bytes[2] !== 0x44 || bytes[3] !== 0x46) return '';
  try {
    const { PDFParse } = await import('pdf-parse');
    const parser = new PDFParse({ data: bytes });
    try {
      const result = await parser.getText();
      return String(result?.text || '').replace(/\s+/g, ' ').trim().slice(0, 16_000);
    } finally {
      await parser.destroy().catch(() => undefined);
    }
  } catch {
    return '';
  }
}

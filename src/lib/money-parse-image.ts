/** Parse a receipt image via upload → Gemini. Never blocks saving on upload failure. */

import { processReceiptJob } from './money-api';
import type { CapturePreview } from './money-core';
import { newMoneyId } from './money-core';
import { prepareReceiptImage, uploadLedgerReceipt } from './money-receipts';
import { buildCapturePreview } from './money-capture';

function draftPreview(input: {
  fileName?: string;
  hintText?: string;
  receiptPath?: string;
  receiptName?: string;
  reason?: string;
}): CapturePreview {
  const text = String(input.hintText || '').trim();
  if (text) {
    const preview = buildCapturePreview(text, 'share');
    return {
      ...preview,
      id: preview.id || newMoneyId('cap'),
      receiptPath: input.receiptPath,
      receiptName: input.receiptName || input.fileName,
      reasons: [...(preview.reasons || []), input.reason || ''].filter(Boolean),
    };
  }
  return {
    id: newMoneyId('cap'),
    source: 'receipt',
    direction: 'MONEY_OUT',
    amountPaise: 0,
    description: String(input.fileName || 'Shared receipt').replace(/\.[a-z0-9]+$/i, '') || 'Shared receipt',
    merchant: '',
    category: 'Uncategorized',
    paymentMethod: 'cash',
    date: new Date().toISOString().slice(0, 10),
    processingStatus: 'REVIEW_REQUIRED',
    financialStatus: 'DRAFT',
    confidence: 'low',
    reasons: [input.reason || 'Saved — edit amount anytime'],
    raw: text,
    receiptPath: input.receiptPath,
    receiptName: input.receiptName || input.fileName,
  };
}

export async function parseAndStoreReceipt(input: {
  bookId: string;
  dataUrl: string;
  mimeType?: string;
  fileName?: string;
  hintText?: string;
  source?: string;
  onStatus?: (line: string) => void;
}): Promise<{ preview: CapturePreview; receiptPath: string; receiptName: string }> {
  if (!input.bookId) throw new Error('Choose a Money book first');
  if (!input.dataUrl) throw new Error('No receipt image');

  const fileName = input.fileName || `receipt-${Date.now()}.jpg`;
  const say = (line: string) => { try { input.onStatus?.(line); } catch { /* ignore */ } };

  say('Compressing receipt…');
  const prepared = await prepareReceiptImage(input.dataUrl, String(input.mimeType || 'image/jpeg'));

  let receiptPath = '';
  let receiptName = fileName;

  say('Uploading receipt…');
  try {
    const uploaded = await uploadLedgerReceipt(input.bookId, {
      dataUrl: prepared.dataUrl,
      fileName,
      mimeType: prepared.mime,
    });
    receiptPath = uploaded.receiptPath;
    receiptName = uploaded.receiptName || fileName;
  } catch {
    // Upload failed — still save the entry; try tinier upload once more in background later.
    say('Upload slow — reading what we can…');
  }

  if (receiptPath) {
    say('Reading merchant, amount & date…');
    try {
      const result = await processReceiptJob({
        bookId: input.bookId,
        text: input.hintText || '',
        receiptPath,
        receiptName,
        source: input.source || 'share',
        idempotencyKey: `vision_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
        autoConfirm: true,
      });
      if (result.preview) {
        return {
          preview: {
            ...result.preview,
            id: result.preview.id || newMoneyId('cap'),
            receiptPath: result.preview.receiptPath || receiptPath,
            receiptName: result.preview.receiptName || receiptName,
          },
          receiptPath,
          receiptName,
        };
      }
    } catch {
      /* fall through to draft */
    }
  } else if (input.hintText) {
    say('Parsing shared text…');
  }

  return {
    preview: draftPreview({
      fileName,
      hintText: input.hintText,
      receiptPath: receiptPath || undefined,
      receiptName,
      reason: receiptPath
        ? 'Could not fully read amount — edit if needed'
        : 'Receipt will attach when connection is steadier',
    }),
    receiptPath,
    receiptName,
  };
}

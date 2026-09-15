import React, { useEffect, useRef, useState } from 'react';
import { createExpense } from '../lib/expenses';
import { buildCapturePreview, capturePreviewToExpense } from '../lib/money-capture';
import { processReceiptJob } from '../lib/money-api';
import { uploadLedgerReceipt } from '../lib/money-receipts';
import { clearPendingCapture } from './ShareIntentListener';
import type { CapturePreview } from '../lib/money-core';
import { newMoneyId } from '../lib/money-core';
import { isoDay } from '../lib/ledger-advanced';
import type { MoneyContextOption } from '../lib/money-flow';
import {
  ContextSelector,
  MoneySheet,
  ReceiptFlowProgress,
} from './money/MoneyUi';

export type ReceiptLaunch = {
  text?: string;
  imageDataUrl?: string;
  fileName?: string;
  mimeType?: string;
  receiptPath?: string;
  receiptName?: string;
  source?: string;
  preferredBookId?: string;
  requireBookPick?: boolean;
};

type Props = {
  open: boolean;
  launch: ReceiptLaunch | null;
  bookId?: string;
  bookName?: string;
  currency?: string;
  onClose: () => void;
  onConfirmed: (expense: Record<string, unknown>, extras?: { count?: number }) => void;
};

function isSpreadsheet(mime?: string, name?: string) {
  const m = String(mime || '').toLowerCase();
  const n = String(name || '').toLowerCase();
  return m.includes('sheet') || m.includes('excel') || m.includes('csv') || /\.(xlsx|xls|csv)$/i.test(n);
}

function draftPreview(launch: ReceiptLaunch, extra?: Partial<CapturePreview>): CapturePreview {
  const text = String(launch.text || '').trim();
  if (text) {
    const preview = buildCapturePreview(text, launch.source === 'share' ? 'share' : 'receipt');
    return {
      ...preview,
      ...extra,
      id: extra?.id || preview.id || newMoneyId('cap'),
      receiptPath: extra?.receiptPath || launch.receiptPath,
      receiptName: extra?.receiptName || launch.receiptName || launch.fileName,
    };
  }
  const name = String(launch.fileName || '').replace(/\.[a-z0-9]+$/i, '').replace(/[_-]+/g, ' ').trim();
  return {
    id: newMoneyId('cap'),
    source: (launch.source === 'share' ? 'share' : 'receipt') as CapturePreview['source'],
    direction: 'MONEY_OUT',
    amountPaise: 0,
    description: name || 'Shared receipt',
    merchant: name || '',
    category: 'Uncategorized',
    paymentMethod: 'cash',
    date: isoDay(),
    processingStatus: 'REVIEW_REQUIRED',
    financialStatus: 'DRAFT',
    confidence: 'low',
    reasons: ['Could not read amount — edit in the book'],
    raw: '',
    receiptPath: launch.receiptPath,
    receiptName: launch.receiptName || launch.fileName,
    ...extra,
  };
}

async function parseReceiptNow(
  bookId: string,
  launch: ReceiptLaunch,
  onStatus: (line: string) => void,
): Promise<{ preview: CapturePreview; previews: CapturePreview[] }> {
  let receiptPath = launch.receiptPath || '';
  let receiptName = launch.receiptName || launch.fileName || `receipt-${Date.now()}.jpg`;
  let imageBase64 = '';
  let imageMime = launch.mimeType || 'image/jpeg';
  const sheet = isSpreadsheet(imageMime, receiptName);

  if (launch.imageDataUrl) {
    onStatus(sheet ? 'Reading spreadsheet…' : 'Preparing receipt…');
    if (sheet || imageMime === 'application/pdf' || !imageMime.startsWith('image/')) {
      imageBase64 = String(launch.imageDataUrl).replace(/^data:[^;]+;base64,/i, '').replace(/\s+/g, '');
      const uploaded = await uploadLedgerReceipt(bookId, {
        dataUrl: launch.imageDataUrl,
        fileName: receiptName,
        mimeType: imageMime,
      });
      receiptPath = uploaded.receiptPath;
      receiptName = uploaded.receiptName || receiptName;
    } else {
      const { prepareReceiptImage, uploadPreparedReceipt } = await import('../lib/money-receipts');
      const prepared = await prepareReceiptImage(launch.imageDataUrl, imageMime, false);
      imageMime = prepared.mime || 'image/jpeg';
      imageBase64 = String(prepared.dataUrl || '')
        .replace(/^data:[^;]+;base64,/i, '')
        .replace(/\s+/g, '');

      onStatus('Reading amount…');
      // Start upload in parallel; wait on parse first (critical path).
      const uploadPromise = uploadPreparedReceipt(bookId, {
        bytes: prepared.bytes,
        mime: imageMime,
        dataUrl: prepared.dataUrl,
        fileName: receiptName,
      }).catch(() => null);

      const result = await processReceiptJob({
        bookId,
        text: launch.text || '',
        receiptPath: '',
        receiptName,
        source: launch.source || 'share',
        idempotencyKey: `parse_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
        autoConfirm: true,
        imageBase64,
        imageMime,
      });

      const uploaded = await uploadPromise;
      if (uploaded) {
        receiptPath = uploaded.receiptPath || receiptPath;
        receiptName = uploaded.receiptName || receiptName;
      }

      const preview = result.preview
        ? {
            ...result.preview,
            id: result.preview.id || newMoneyId('cap'),
            receiptPath: result.preview.receiptPath || receiptPath,
            receiptName: result.preview.receiptName || receiptName,
          }
        : draftPreview(launch, {
            receiptPath,
            receiptName,
            reasons: [result.error || 'Parser returned no fields'],
          });

      return {
        preview: { ...preview, receiptPath: preview.receiptPath || receiptPath, receiptName: preview.receiptName || receiptName },
        previews: result.previews?.length ? result.previews : [preview],
      };
    }
  }

  onStatus(sheet ? 'Importing rows…' : 'Reading amount, merchant & date…');
  const result = await processReceiptJob({
    bookId,
    text: launch.text || '',
    receiptPath,
    receiptName,
    source: launch.source || 'share',
    idempotencyKey: `parse_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    autoConfirm: true,
    imageBase64: imageBase64 || undefined,
    imageMime,
  });

  if (result.previews?.length) {
    const previews = result.previews.map((p, i) => ({
      ...p,
      id: p.id || `${newMoneyId('cap')}_${i}`,
      receiptPath: p.receiptPath || receiptPath,
      receiptName: p.receiptName || receiptName,
    }));
    return { preview: previews[0], previews };
  }

  if (result.preview) {
    const preview = {
      ...result.preview,
      id: result.preview.id || newMoneyId('cap'),
      receiptPath: result.preview.receiptPath || receiptPath,
      receiptName: result.preview.receiptName || receiptName,
    };
    return { preview, previews: [preview] };
  }

  const preview = draftPreview(launch, {
    receiptPath,
    receiptName,
    reasons: [result.error || 'Parser returned no fields'],
  });
  return { preview, previews: [preview] };
}

type Phase = 'pick' | 'working' | 'failed';

export default function ReceiptCaptureFlow({
  open,
  launch,
  bookId: initialBookId,
  onClose,
  onConfirmed,
}: Props) {
  const [phase, setPhase] = useState<Phase>('working');
  const [contexts, setContexts] = useState<MoneyContextOption[]>([]);
  const [busy, setBusy] = useState(false);
  const [statusLine, setStatusLine] = useState('Reading receipt…');
  const [error, setError] = useState('');
  const [activeBookId, setActiveBookId] = useState('');
  const savingRef = useRef(false);
  const doneRef = useRef(false);

  const saveNow = async (bookId: string) => {
    if (!launch || !bookId || savingRef.current || doneRef.current) return;
    savingRef.current = true;
    setActiveBookId(bookId);
    setBusy(true);
    setPhase('working');
    setError('');
    setStatusLine('Reading receipt…');
    try {
      clearPendingCapture();

      const { preview, previews } = await parseReceiptNow(bookId, launch, setStatusLine);
      const rows = previews.length ? previews : [preview];

      if (launch.imageDataUrl && !launch.text && !isSpreadsheet(launch.mimeType, launch.fileName)
        && !(rows.some((r) => Number(r.amountPaise || 0) > 0))) {
        const why = (preview.reasons && preview.reasons[0]) || 'Could not read amount from receipt';
        throw new Error(why);
      }

      setStatusLine(
        rows.length > 1
          ? `Found ${rows.length} rows — saving…`
          : preview.amountPaise > 0
            ? `Found ₹${(preview.amountPaise / 100).toFixed(2)} — saving…`
            : 'Saving entry…',
      );

      let firstSaved: Record<string, unknown> | null = null;
      for (let i = 0; i < rows.length; i += 1) {
        const row = rows[i];
        if (!(Number(row.amountPaise || 0) > 0) && rows.length > 1) continue;
        const payload = capturePreviewToExpense(row, {
          receiptPath: row.receiptPath,
          receiptName: row.receiptName,
          captureSource: row.source || 'share',
          parseEngine: (row as CapturePreview & { parseEngine?: string }).parseEngine,
        });
        if ((row as CapturePreview & { entryType?: string }).entryType === 'transfer'
          || row.direction === 'TRANSFER') {
          (payload as any).entryType = 'transfer';
        } else if (row.direction === 'MONEY_IN') {
          (payload as any).entryType = 'in';
        }
        const saved = await createExpense(bookId, payload, {
          force: true,
          idempotencyKey: String(row.id || newMoneyId('cap')),
        });
        if (!firstSaved) firstSaved = { ...saved, bookId: String(saved.bookId || bookId) };
      }

      if (!firstSaved) throw new Error('No valid rows to save');

      void (async () => {
        try {
          const { listLedgers } = await import('../lib/ledgers');
          const { notifyTeamOfLedgerChange } = await import('../lib/notify-team');
          const { auth } = await import('../lib/firebase');
          const books = await listLedgers();
          const book = (books || []).find((b) => String(b.id) === String(bookId));
          if (!book) return;
          const amt = Number(firstSaved?.amount || preview.amountPaise / 100 || 0);
          const who = auth.currentUser?.displayName || auth.currentUser?.email || 'Someone';
          await notifyTeamOfLedgerChange({
            book: {
              id: String(book.id),
              name: String(book.name || 'Money book'),
              roles: book.roles as Record<string, { role?: string; email?: string }> | null,
              inboundAddress: (book as { inboundAddress?: string }).inboundAddress,
            },
            actorUid: auth.currentUser?.uid,
            senderName: who,
            action: rows.length > 1 ? 'Imported spreadsheet entries' : 'Shared a receipt',
            detail: rows.length > 1
              ? `${rows.length} entries imported`
              : `${String(firstSaved?.description || preview.description || 'Receipt')} · ₹${amt.toFixed(2)}`,
          });
        } catch (err) {
          console.error('Share notify failed', err);
        }
      })();

      doneRef.current = true;
      onConfirmed(firstSaved, { count: rows.length });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save');
      setPhase('failed');
      setStatusLine('Save failed — retry');
    } finally {
      savingRef.current = false;
      setBusy(false);
    }
  };

  useEffect(() => {
    if (!open || !launch) return;
    let cancelled = false;
    savingRef.current = false;
    doneRef.current = false;
    setError('');
    setStatusLine('Reading receipt…');

    const lockedBook = initialBookId && !launch.requireBookPick
      ? (launch.preferredBookId || initialBookId)
      : (!launch.requireBookPick ? (launch.preferredBookId || initialBookId || '') : '');

    const run = async () => {
      if (lockedBook) {
        setPhase('working');
        await saveNow(lockedBook);
        return;
      }
      setBusy(true);
      try {
        const { listLedgers } = await import('../lib/ledgers');
        const ledgers = await listLedgers();
        if (cancelled) return;
        const bookRows: MoneyContextOption[] = (ledgers || [])
          .filter((b) => b && !b.deleted && !b.deletedAt && !b.archived)
          .map((b) => ({
            id: String(b.id),
            name: String(b.name || 'Money book'),
            currency: String(b.currency || 'INR'),
            score: 10,
            reason: 'Authorized Money book',
            memberCount: b.roles && typeof b.roles === 'object' ? Object.keys(b.roles as object).length : 1,
          }));
        setContexts(bookRows);
        if (bookRows.length === 1) {
          await saveNow(bookRows[0].id);
          return;
        }
        if (initialBookId && !launch.requireBookPick) {
          await saveNow(initialBookId);
          return;
        }
        setPhase('pick');
      } catch {
        if (!cancelled) {
          setError('Could not load Money books');
          setPhase('failed');
        }
      } finally {
        if (!cancelled) setBusy(false);
      }
    };

    void run();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, launch]);

  if (!open || !launch) return null;

  if (phase === 'pick') {
    return (
      <MoneySheet
        open={open}
        onClose={() => { if (!busy) onClose(); }}
        title="Choose Money book"
        subtitle="We’ll read the file, then save entries"
      >
        <ReceiptFlowProgress state="AWAITING_CONTEXT" />
        {error ? (
          <p className="mt-3 text-[12px] text-amber-800 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">{error}</p>
        ) : null}
        <div className="mt-3">
          <ContextSelector
            contexts={contexts}
            selectedId=""
            onSelect={(id) => { void saveNow(id); }}
          />
        </div>
      </MoneySheet>
    );
  }

  return (
    <MoneySheet
      open={open}
      onClose={() => { if (!busy) onClose(); }}
      title={phase === 'failed' ? 'Couldn’t finish' : 'Reading your share'}
      subtitle={phase === 'failed' ? 'Your data is safe.' : 'Finding amount, merchant and date…'}
    >
      <ReceiptFlowProgress state={phase === 'failed' ? 'FAILED' : 'EXTRACTING'} />
      <div className="receipt-proc py-4 text-center">
        {/\u20b9|₹|Found|\d+\s+rows/i.test(statusLine) ? (
          <p className="text-[28px] font-display font-semibold text-[#0B1F3A] tracking-tight">
            {statusLine.replace(/\s*—.*$/, '').replace(/^Found\s+/i, '')}
          </p>
        ) : null}
        <p className="mt-2 text-[13px] text-slate-500 leading-relaxed">{statusLine}</p>
      </div>
      {error ? (
        <p className="mt-3 text-[12px] text-amber-900 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">{error}</p>
      ) : null}
      {phase === 'failed' ? (
        <div className="mt-4 flex gap-2">
          <button type="button" className="flex-1 h-11 rounded-xl border border-slate-200 bg-white text-[13px] font-semibold text-slate-600" onClick={onClose}>
            Go back
          </button>
          <button
            type="button"
            className="flex-1 h-11 rounded-xl bg-[#0B1F3A] text-white text-[13px] font-semibold"
            disabled={busy}
            onClick={() => void saveNow(activeBookId || initialBookId || contexts[0]?.id || '')}
          >
            {busy ? 'Retrying…' : 'Retry'}
          </button>
        </div>
      ) : null}
    </MoneySheet>
  );
}

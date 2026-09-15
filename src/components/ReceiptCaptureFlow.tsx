import React, { useEffect, useRef, useState } from 'react';
import { createExpense } from '../lib/expenses';
import { buildCapturePreview, capturePreviewToExpense } from '../lib/money-capture';
import { processReceiptJob } from '../lib/money-api';
import { uploadLedgerReceipt } from '../lib/money-receipts';
import {
  cacheMoneyBooks,
  clearPendingCapture,
  readCachedMoneyBooks,
  rememberMoneyBook,
} from './ShareIntentListener';
import type { CapturePreview } from '../lib/money-core';
import { newMoneyId } from '../lib/money-core';
import { isoDay } from '../lib/ledger-advanced';
import type { MoneyContextOption } from '../lib/money-flow';
import { ContextSelector } from './money/MoneyUi';
import './share-reading.css';

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
  onConfirmed: (expense: Record<string, unknown>, extras?: { count?: number; needsEdit?: boolean }) => void;
};

const STAGE_COPY: Array<{ min: number; title: string; detail: string }> = [
  { min: 0, title: 'Opening your share', detail: 'Getting the receipt ready…' },
  { min: 12, title: 'Preparing image', detail: 'Optimizing for a fast read…' },
  { min: 28, title: 'Summarizing', detail: 'Reading amount, merchant, date…' },
  { min: 48, title: 'Mapping fields', detail: 'Filling your Money book…' },
  { min: 68, title: 'Checking details', detail: 'Almost ready to save…' },
  { min: 84, title: 'Saving to Money', detail: 'One moment…' },
  { min: 96, title: 'Finishing up', detail: 'You’re all set…' },
];

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
  onStatus: (line: string, pct?: number) => void,
): Promise<{ preview: CapturePreview; previews: CapturePreview[] }> {
  let receiptPath = launch.receiptPath || '';
  let receiptName = launch.receiptName || launch.fileName || `receipt-${Date.now()}.jpg`;
  let imageBase64 = '';
  let imageMime = launch.mimeType || 'image/jpeg';
  const sheet = isSpreadsheet(imageMime, receiptName);
  const isPdf = imageMime === 'application/pdf' || /\.pdf$/i.test(receiptName);
  const rawLen = String(launch.imageDataUrl || '').length;
  // Spreadsheets / huge scans → structured path. Everyday UPI & receipts → OCR + Gemini.
  const useStructuredPath = sheet || (isPdf && rawLen > 1_200_000) || rawLen > 2_400_000;

  const scrubPreview = (preview: CapturePreview): CapturePreview => ({
    ...preview,
    reasons: [],
    parseEngine: undefined,
  } as CapturePreview);

  const safeProcess = async (input: Parameters<typeof processReceiptJob>[0]) => {
    try {
      return await processReceiptJob(input);
    } catch (err) {
      return {
        error: err instanceof Error ? err.message : 'Parse request failed',
        preview: undefined,
        previews: undefined,
      };
    }
  };

  if (launch.imageDataUrl) {
    onStatus(sheet ? 'Reading spreadsheet…' : 'Preparing…', 16);

    if (useStructuredPath || (!imageMime.startsWith('image/') && !isPdf)) {
      imageBase64 = String(launch.imageDataUrl).replace(/^data:[^;]+;base64,/i, '').replace(/\s+/g, '');
      try {
        const uploaded = await uploadLedgerReceipt(bookId, {
          dataUrl: launch.imageDataUrl,
          fileName: receiptName,
          mimeType: imageMime,
        });
        receiptPath = uploaded.receiptPath;
        receiptName = uploaded.receiptName || receiptName;
      } catch {
        // Continue without upload — still try to parse inline bytes.
      }
      onStatus(sheet ? 'Importing rows…' : 'Reading document…', 48);
      const result = await safeProcess({
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
        const previews = result.previews.map((p, i) => scrubPreview({
          ...p,
          id: p.id || `${newMoneyId('cap')}_${i}`,
          receiptPath: p.receiptPath || receiptPath,
          receiptName: p.receiptName || receiptName,
          reasons: [],
        }));
        return { preview: previews[0], previews };
      }
      if (result.preview) {
        return {
          preview: scrubPreview({
            ...result.preview,
            id: result.preview.id || newMoneyId('cap'),
            receiptPath: result.preview.receiptPath || receiptPath,
            receiptName: result.preview.receiptName || receiptName,
            reasons: [],
          }),
          previews: [result.preview],
        };
      }
      return {
        preview: scrubPreview(draftPreview(launch, { receiptPath, receiptName, reasons: [] })),
        previews: [],
      };
    }

    // Normal receipt / UPI → on-device OCR (instant when confident) + Gemini in parallel.
    const { prepareReceiptImage, uploadPreparedReceipt } = await import('../lib/money-receipts');
    const { localParseReceiptImage, prepareOcrImage } = await import('../lib/document-ocr');

    onStatus('Reading on device…', 22);
    const ocrPromise = prepareOcrImage(launch.imageDataUrl, imageMime)
      .then((ocrPrepared) => localParseReceiptImage(ocrPrepared.base64, ocrPrepared.mime, launch.text || ''))
      .catch(() => null);
    const preparedPromise = prepareReceiptImage(launch.imageDataUrl, imageMime, false);

    const [local, prepared] = await Promise.all([ocrPromise, preparedPromise]);
    imageMime = prepared.mime || 'image/jpeg';
    imageBase64 = String(prepared.dataUrl || '')
      .replace(/^data:[^;]+;base64,/i, '')
      .replace(/\s+/g, '');

    const uploadPromise = uploadPreparedReceipt(bookId, {
      bytes: prepared.bytes,
      mime: imageMime,
      dataUrl: prepared.dataUrl,
      fileName: receiptName,
    }).catch(() => null);

    const hintText = [launch.text || '', local?.text || ''].filter(Boolean).join('\n').slice(0, 2000);

    // Instant path: high-confidence on-device OCR (labeled Paid / ₹ amount).
    if (local && local.amount > 0 && (local.confidence === 'high' || (local.score || 0) >= 48)) {
      onStatus(`Found ₹${local.amount.toFixed(2)}…`, 72);
      const uploaded = await uploadPromise;
      if (uploaded) {
        receiptPath = uploaded.receiptPath || receiptPath;
        receiptName = uploaded.receiptName || receiptName;
      }
      const preview = scrubPreview({
        id: newMoneyId('cap'),
        source: (launch.source === 'share' ? 'share' : 'receipt') as CapturePreview['source'],
        direction: local.entryType === 'in' ? 'MONEY_IN' : 'MONEY_OUT',
        amountPaise: Math.round(local.amount * 100),
        description: local.description || local.merchant || receiptName,
        merchant: local.merchant,
        category: 'Uncategorized',
        paymentMethod: local.paymentMethod || 'upi',
        date: local.date,
        processingStatus: 'READY',
        financialStatus: 'DRAFT',
        confidence: local.confidence,
        reasons: [],
        raw: '',
        receiptPath,
        receiptName,
      });
      return { preview, previews: [preview] };
    }

    onStatus('Summarizing with Gemini…', 42);
    let result = await safeProcess({
      bookId,
      text: hintText || launch.text || '',
      receiptPath: '',
      receiptName,
      source: launch.source || 'share',
      idempotencyKey: `parse_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
      autoConfirm: true,
      imageBase64,
      imageMime,
    });

    onStatus('Almost there…', 70);
    const uploaded = await uploadPromise;
    if (uploaded) {
      receiptPath = uploaded.receiptPath || receiptPath;
      receiptName = uploaded.receiptName || receiptName;
    }

    let preview = result.preview
      ? {
          ...result.preview,
          id: result.preview.id || newMoneyId('cap'),
          receiptPath: result.preview.receiptPath || receiptPath,
          receiptName: result.preview.receiptName || receiptName,
          reasons: [],
        }
      : draftPreview(launch, { receiptPath, receiptName, reasons: [] });

    // Prefer labeled local OCR amount when Gemini misses or disagrees.
    const localPaise = local && local.amount > 0 ? Math.round(local.amount * 100) : 0;
    const serverPaise = Number(preview.amountPaise || 0);
    if (localPaise > 0 && (!serverPaise || ((local.score || 0) >= 48 && serverPaise !== localPaise))) {
      preview = {
        ...preview,
        amountPaise: localPaise,
        merchant: local?.merchant || preview.merchant,
        description: local?.description || preview.description,
        paymentMethod: local?.paymentMethod || preview.paymentMethod,
        direction: local?.entryType === 'in' ? 'MONEY_IN' : preview.direction,
        processingStatus: 'READY',
        confidence: local?.confidence || preview.confidence,
        reasons: [],
      };
    }

    if (!(Number(preview.amountPaise || 0) > 0) && (receiptPath || imageBase64)) {
      onStatus('One more look…', 82);
      const retry = await safeProcess({
        bookId,
        text: hintText || launch.text || '',
        receiptPath: receiptPath || '',
        receiptName,
        source: launch.source || 'share',
        idempotencyKey: `parse_r2_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
        autoConfirm: true,
        imageBase64: imageBase64 || undefined,
        imageMime,
      });
      if (retry.preview && Number(retry.preview.amountPaise || 0) > 0) {
        preview = {
          ...retry.preview,
          id: retry.preview.id || preview.id || newMoneyId('cap'),
          receiptPath: retry.preview.receiptPath || receiptPath,
          receiptName: retry.preview.receiptName || receiptName,
          reasons: [],
        };
        result = retry;
      } else if (localPaise > 0) {
        preview = {
          ...preview,
          amountPaise: localPaise,
          merchant: preview.merchant || local?.merchant || '',
          description: preview.description || local?.description || receiptName,
          paymentMethod: preview.paymentMethod || local?.paymentMethod || 'upi',
          processingStatus: 'READY',
          reasons: [],
        };
      }
    }

    const cleaned = scrubPreview({
      ...preview,
      receiptPath: preview.receiptPath || receiptPath,
      receiptName: preview.receiptName || receiptName,
      reasons: [],
    });
    return {
      preview: cleaned,
      previews: result.previews?.length
        ? result.previews.map((p) => scrubPreview({ ...p, reasons: [], receiptPath: p.receiptPath || receiptPath, receiptName: p.receiptName || receiptName }))
        : [cleaned],
    };
  }

  onStatus(sheet ? 'Importing rows…' : 'Reading amount, merchant & date…', 40);
  const result = await safeProcess({
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
    const previews = result.previews.map((p, i) => scrubPreview({
      ...p,
      id: p.id || `${newMoneyId('cap')}_${i}`,
      receiptPath: p.receiptPath || receiptPath,
      receiptName: p.receiptName || receiptName,
      reasons: [],
    }));
    return { preview: previews[0], previews };
  }

  if (result.preview) {
    const preview = scrubPreview({
      ...result.preview,
      id: result.preview.id || newMoneyId('cap'),
      receiptPath: result.preview.receiptPath || receiptPath,
      receiptName: result.preview.receiptName || receiptName,
      reasons: [],
    });
    return { preview, previews: [preview] };
  }

  const preview = scrubPreview(draftPreview(launch, {
    receiptPath,
    receiptName,
    reasons: [],
  }));
  return { preview, previews: [preview] };
}

type Phase = 'pick' | 'working' | 'failed';

function ShareReadingStage({
  pct,
  statusLine,
  failed,
  error,
}: {
  pct: number;
  statusLine: string;
  failed?: boolean;
  error?: string;
}) {
  const stage = [...STAGE_COPY].reverse().find((s) => pct >= s.min) || STAGE_COPY[0];
  const clamped = Math.max(0, Math.min(100, Math.round(pct)));
  return (
    <div className={`sr-stage ${failed ? 'is-failed' : ''}`}>
      <div className="sr-orb" aria-hidden>
        <div className="sr-orb-core" />
        <div className="sr-orb-ring" />
        <div className="sr-orb-glow" />
      </div>
      <p className="sr-kicker">{failed ? 'Needs a moment' : 'Reading share'}</p>
      <h2 className="sr-title">{failed ? 'Couldn’t finish' : stage.title}</h2>
      <p className="sr-detail">{failed ? (error || statusLine) : (statusLine || stage.detail)}</p>
      {!failed ? (
        <div className="sr-meter" role="progressbar" aria-valuenow={clamped} aria-valuemin={0} aria-valuemax={100}>
          <div className="sr-meter-fill" style={{ width: `${clamped}%` }} />
          <span className="sr-pct">{clamped}%</span>
        </div>
      ) : null}
    </div>
  );
}

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
  const [statusLine, setStatusLine] = useState('Opening your share…');
  const [pct, setPct] = useState(8);
  const [error, setError] = useState('');
  const [activeBookId, setActiveBookId] = useState('');
  const savingRef = useRef(false);
  const doneRef = useRef(false);
  const tickRef = useRef<number | null>(null);

  const setProgress = (line: string, nextPct?: number) => {
    setStatusLine(line);
    if (typeof nextPct === 'number') setPct((p) => Math.max(p, nextPct));
  };

  const saveNow = async (bookId: string) => {
    if (!launch || !bookId || savingRef.current || doneRef.current) return;
    savingRef.current = true;
    setActiveBookId(bookId);
    rememberMoneyBook(bookId);
    setBusy(true);
    setPhase('working');
    setError('');
    setPct(14);
    setProgress('Preparing image…', 18);
    try {
      // Keep pending until save succeeds so a failed second attempt can still retry the image.
      if (!launch.imageDataUrl && !launch.text) {
        throw new Error('Shared image was lost — share the receipt again');
      }

      const { preview, previews } = await parseReceiptNow(bookId, launch, setProgress);
      const rows = previews.length ? previews : [preview];
      const anyAmount = rows.some((r) => Number(r.amountPaise || 0) > 0);
      const needsEdit = Boolean(
        launch.imageDataUrl && !launch.text && !isSpreadsheet(launch.mimeType, launch.fileName) && !anyAmount,
      );

      setProgress(
        rows.length > 1
          ? `Found ${rows.length} rows — saving…`
          : anyAmount
            ? `Found ₹${(preview.amountPaise / 100).toFixed(2)} — saving…`
            : 'Saving draft for you to edit…',
        88,
      );

      let firstSaved: Record<string, unknown> | null = null;
      for (let i = 0; i < rows.length; i += 1) {
        const row = rows[i];
        if (!(Number(row.amountPaise || 0) > 0) && rows.length > 1 && anyAmount) continue;
        const payload = capturePreviewToExpense(row, {
          receiptPath: row.receiptPath,
          receiptName: row.receiptName,
          captureSource: row.source || 'share',
        });
        // Never persist parser/engine noise on the expense record.
        delete (payload as any).parseEngine;
        delete (payload as any).parseSource;
        delete (payload as any).reasons;
        delete (payload as any).evidenceReasons;
        if ((row as CapturePreview & { entryType?: string }).entryType === 'transfer'
          || row.direction === 'TRANSFER') {
          (payload as any).entryType = 'transfer';
        } else if (row.direction === 'MONEY_IN') {
          (payload as any).entryType = 'in';
        }
        if (!(Number(row.amountPaise || 0) > 0)) {
          (payload as any).amount = 0;
          (payload as any).status = 'draft';
          (payload as any).notes = [
            String((payload as any).notes || '').trim(),
            'Could not read amount from image — edit amount to finish.',
          ].filter(Boolean).join('\n');
        }
        const saved = await createExpense(bookId, payload, {
          force: true,
          idempotencyKey: String(row.id || newMoneyId('cap')),
        });
        if (!firstSaved) firstSaved = { ...saved, bookId: String(saved.bookId || bookId), _needsEdit: needsEdit };
      }

      if (!firstSaved) throw new Error('No valid rows to save');

      void (async () => {
        try {
          if (needsEdit) return;
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

      setPct(100);
      doneRef.current = true;
      clearPendingCapture();
      onConfirmed(firstSaved, { count: rows.length, needsEdit });
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
    setPct(6);
    setStatusLine('Opening your share…');

    // Soft progress while waiting on books / network.
    tickRef.current = window.setInterval(() => {
      setPct((p) => (p < 22 ? p + 1.2 : p));
    }, 180);

    const run = async () => {
      const cached = readCachedMoneyBooks().map((b) => ({
        id: b.id,
        name: b.name,
        currency: b.currency || 'INR',
        score: 10,
        reason: b.id === launch.preferredBookId ? 'Last used' : 'Authorized Money book',
        memberCount: 1,
      }));
      if (cached.length) setContexts(cached);

      const wantPick = launch.requireBookPick === true || (!launch.preferredBookId && !initialBookId);
      const lockedBook = !wantPick
        ? (launch.preferredBookId || initialBookId || (cached.length === 1 ? cached[0].id : ''))
        : (cached.length === 1 ? cached[0].id : '');

      if (lockedBook && !wantPick) {
        setPhase('working');
        await saveNow(lockedBook);
        return;
      }

      setPhase('pick');
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
            score: String(b.id) === String(launch.preferredBookId || '') ? 20 : 10,
            reason: String(b.id) === String(launch.preferredBookId || '') ? 'Suggested' : 'Authorized Money book',
            memberCount: b.roles && typeof b.roles === 'object' ? Object.keys(b.roles as object).length : 1,
          }))
          .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
        setContexts(bookRows);
        cacheMoneyBooks(bookRows.map((b) => ({ id: b.id, name: b.name, currency: b.currency })));
        if (bookRows.length === 1) {
          await saveNow(bookRows[0].id);
          return;
        }
        if (!bookRows.length) {
          setError('Create a Money book first, then share again.');
          setPhase('failed');
          return;
        }
        setPhase('pick');
        setPct(10);
        setStatusLine('Choose where to save this share');
      } catch {
        if (!cancelled) {
          if (cached.length) {
            setPhase('pick');
            setStatusLine('Choose where to save this share');
          } else {
            setError('Could not load Money books');
            setPhase('failed');
          }
        }
      } finally {
        if (!cancelled) setBusy(false);
      }
    };

    void run();
    return () => {
      cancelled = true;
      if (tickRef.current) window.clearInterval(tickRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, launch]);

  useEffect(() => () => {
    if (tickRef.current) window.clearInterval(tickRef.current);
  }, []);

  if (!open || !launch) return null;

  return (
    <div className="sr-root" role="dialog" aria-modal="true" aria-label="Reading shared receipt">
      <button type="button" className="sr-dim" aria-label="Close" onClick={() => { if (!busy) onClose(); }} />
      <div className="sr-sheet">
        <div className="sr-handle" aria-hidden />
        {phase === 'pick' ? (
          <>
            <p className="sr-kicker">Shared with Byjan</p>
            <h2 className="sr-title" style={{ textAlign: 'left', maxWidth: 'none' }}>Choose Money book</h2>
            <p className="sr-detail" style={{ textAlign: 'left', maxWidth: 'none' }}>
              We’ll read the file, then save the entry here.
            </p>
            {error ? <p className="sr-error">{error}</p> : null}
            <div className="sr-pick">
              <ContextSelector
                contexts={contexts}
                selectedId=""
                onSelect={(id) => { void saveNow(id); }}
              />
            </div>
          </>
        ) : (
          <>
            <ShareReadingStage pct={pct} statusLine={statusLine} failed={phase === 'failed'} error={error} />
            {phase === 'failed' ? (
              <div className="sr-actions">
                <button type="button" className="sr-btn-ghost" onClick={onClose}>Go back</button>
                <button
                  type="button"
                  className="sr-btn"
                  disabled={busy}
                  onClick={() => void saveNow(activeBookId || initialBookId || contexts[0]?.id || '')}
                >
                  {busy ? 'Retrying…' : 'Retry'}
                </button>
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}

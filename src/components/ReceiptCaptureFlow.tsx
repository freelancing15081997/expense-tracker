import React, { useEffect, useRef, useState } from 'react';
import { createExpense, checkDuplicateExpense } from '../lib/expenses';
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
  onConfirmed: (expense: Record<string, unknown>, extras?: { count?: number; needsEdit?: boolean; duplicate?: boolean }) => void;
};

const STAGE_COPY: Array<{ min: number; title: string; detail: string }> = [
  { min: 0, title: 'Opening your share', detail: 'Getting the receipt ready…' },
  { min: 12, title: 'Preparing', detail: 'Getting a clear view of the receipt…' },
  { min: 28, title: 'Reading receipt', detail: 'Looking for amount, merchant, and date…' },
  { min: 48, title: 'Filling details', detail: 'Preparing your Money entry…' },
  { min: 68, title: 'Checking details', detail: 'Almost ready to save…' },
  { min: 84, title: 'Saving', detail: 'Adding it to your Money book…' },
  { min: 96, title: 'Done', detail: 'You’re all set…' },
];

async function sha256Hex(base64: string): Promise<string> {
  const clean = String(base64 || '').replace(/^data:[^;]+;base64,/i, '').replace(/\s+/g, '');
  if (!clean || typeof crypto === 'undefined' || !crypto.subtle) return '';
  try {
    // Cap decode size (~3MB binary) so huge scans stay hashable without OOMing.
    const capped = clean.length > 4_000_000 ? clean.slice(0, 4_000_000) : clean;
    const binary = atob(capped);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
  } catch {
    return '';
  }
}

function formatRupee(amount: unknown) {
  const n = Number(amount || 0);
  if (!Number.isFinite(n)) return '₹—';
  return `₹${n.toLocaleString('en-IN', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;
}

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
  // Spreadsheets / huge blobs → server. Images + PDFs → on-device PP-OCRv4 (PdfRenderer for PDF).
  const useStructuredPath = sheet || rawLen > 2_400_000;

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

    // Image or PDF → on-device PP-OCRv4 (PDF pages rendered via PdfRenderer) + ₹ rules. No Gemini.
    const { prepareReceiptImage, uploadPreparedReceipt } = await import('../lib/money-receipts');
    const { localParseReceiptImage, prepareOcrImage } = await import('../lib/document-ocr');

    onStatus(isPdf ? 'Reading PDF…' : 'Reading receipt…', 22);
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

    onStatus('Reading amount, merchant & date…', 48);

    // Prefer on-device OCR + deterministic ₹ parse. Skip Gemini for mobile share.
    let preview = local && Number(local.amount || 0) > 0
      ? scrubPreview({
          ...draftPreview(launch, {
            amountPaise: Math.round(local.amount * 100),
            merchant: local.merchant || '',
            description: local.description || local.merchant || receiptName,
            paymentMethod: local.paymentMethod || 'upi',
            direction: local.entryType === 'in' ? 'MONEY_IN' : 'MONEY_OUT',
            date: local.date,
            processingStatus: 'READY',
            confidence: local.confidence || 'high',
            receiptPath,
            receiptName,
            reasons: [],
          }),
          id: newMoneyId('cap'),
        })
      : scrubPreview(draftPreview(launch, {
          receiptPath,
          receiptName,
          reasons: [],
          // Keep OCR text for server-side PP-Structure / rules if amount not found locally.
        }));

    // If local OCR has text but no amount yet, ask server for rules/PP-Structure only (no vision image).
    if (!(Number(preview.amountPaise || 0) > 0) && (local?.text || launch.text)) {
      const hintText = [launch.text || '', local?.text || ''].filter(Boolean).join('\n').slice(0, 4000);
      onStatus('Checking amount from text…', 62);
      const result = await safeProcess({
        bookId,
        text: hintText,
        receiptPath: '',
        receiptName,
        source: launch.source || 'share',
        idempotencyKey: `parse_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
        autoConfirm: true,
        // Intentionally omit imageBase64 so money-handlers skips Gemini vision.
      });
      if (result.preview && Number(result.preview.amountPaise || 0) > 0) {
        preview = scrubPreview({
          ...result.preview,
          id: result.preview.id || newMoneyId('cap'),
          receiptPath: result.preview.receiptPath || receiptPath,
          receiptName: result.preview.receiptName || receiptName,
          reasons: [],
        });
      }
    }

    onStatus('Almost ready…', 78);
    const uploaded = await uploadPromise;
    if (uploaded) {
      receiptPath = uploaded.receiptPath || receiptPath;
      receiptName = uploaded.receiptName || receiptName;
    }
    preview = scrubPreview({
      ...preview,
      receiptPath: preview.receiptPath || receiptPath,
      receiptName: preview.receiptName || receiptName,
      reasons: [],
    });

    return {
      preview,
      previews: [preview],
    };
  }

  // Text-only share (no image)
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

type Phase = 'pick' | 'working' | 'failed' | 'duplicate_confirm';

type PendingDup = {
  bookId: string;
  existing: Record<string, unknown>;
  payload: Record<string, unknown>;
  needsEdit: boolean;
  /** Hash hit before parse — Different entry must parse then force-save. */
  resumeParse?: boolean;
};

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
  const [pendingDup, setPendingDup] = useState<PendingDup | null>(null);
  const savingRef = useRef(false);
  const doneRef = useRef(false);
  const tickRef = useRef<number | null>(null);

  const setProgress = (line: string, nextPct?: number) => {
    setStatusLine(line);
    if (typeof nextPct === 'number') setPct((p) => Math.max(p, nextPct));
  };

  const finishDuplicateSame = (existing: Record<string, unknown>, bookId: string) => {
    setPct(100);
    doneRef.current = true;
    clearPendingCapture();
    setPendingDup(null);
    onConfirmed(
      { ...existing, bookId: String(existing.bookId || bookId), _duplicate: true },
      { count: 1, duplicate: true },
    );
    onClose();
  };

  const confirmDuplicateDifferent = async () => {
    if (!pendingDup || savingRef.current || doneRef.current) return;
    if (pendingDup.resumeParse) {
      const bookId = pendingDup.bookId;
      setPendingDup(null);
      await saveNowForced(bookId);
      return;
    }
    savingRef.current = true;
    setBusy(true);
    setError('');
    setPhase('working');
    setProgress('Saving as a new entry…', 90);
    try {
      const payload = {
        ...pendingDup.payload,
        duplicateConfirmedDifferent: true,
      };
      const saved = await createExpense(pendingDup.bookId, payload, {
        force: true,
        idempotencyKey: newMoneyId('cap_force'),
      });
      setPct(100);
      doneRef.current = true;
      clearPendingCapture();
      setPendingDup(null);
      onConfirmed(
        { ...saved, bookId: String(saved.bookId || pendingDup.bookId), _needsEdit: pendingDup.needsEdit },
        { count: 1, needsEdit: pendingDup.needsEdit },
      );
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save');
      setPhase('duplicate_confirm');
      setStatusLine('Couldn’t save — try again');
    } finally {
      savingRef.current = false;
      setBusy(false);
    }
  };

  const saveNowForced = async (bookId: string) => {
    if (!launch || !bookId || savingRef.current || doneRef.current) return;
    savingRef.current = true;
    setActiveBookId(bookId);
    setBusy(true);
    setPhase('working');
    setError('');
    setPendingDup(null);
    setPct(30);
    setProgress('Reading receipt…', 35);
    try {
      const receiptHash = launch.imageDataUrl
        ? await sha256Hex(String(launch.imageDataUrl))
        : '';
      const { preview, previews } = await parseReceiptNow(bookId, launch, setProgress);
      const rows = previews.length ? previews : [preview];
      const anyAmount = rows.some((r) => Number(r.amountPaise || 0) > 0);
      const needsEdit = Boolean(
        launch.imageDataUrl && !launch.text && !isSpreadsheet(launch.mimeType, launch.fileName) && !anyAmount,
      );
      const row = rows.find((r) => Number(r.amountPaise || 0) > 0) || rows[0];
      const payload = capturePreviewToExpense(row, {
        receiptPath: row.receiptPath,
        receiptName: row.receiptName,
        captureSource: row.source || 'share',
        duplicateConfirmedDifferent: true,
      });
      if (receiptHash) (payload as any).receiptHash = receiptHash;
      setProgress('Saving as a new entry…', 92);
      const saved = await createExpense(bookId, payload, {
        force: true,
        idempotencyKey: newMoneyId('cap_force'),
      });
      setPct(100);
      doneRef.current = true;
      clearPendingCapture();
      onConfirmed(
        { ...saved, bookId: String(saved.bookId || bookId), _needsEdit: needsEdit },
        { count: 1, needsEdit },
      );
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not save';
      // Force path must not leave the user stuck on "already recorded".
      if (/already recorded|already on this ledger|matching entry/i.test(msg)) {
        setError('Could not save as a different entry — try again in a moment');
      } else {
        setError(msg);
      }
      setPhase('failed');
      setStatusLine('Couldn’t finish — retry');
    } finally {
      savingRef.current = false;
      setBusy(false);
    }
  };

  const saveNow = async (bookId: string) => {
    if (!launch || !bookId || savingRef.current || doneRef.current) return;
    savingRef.current = true;
    setActiveBookId(bookId);
    rememberMoneyBook(bookId);
    setBusy(true);
    setPhase('working');
    setError('');
    setPendingDup(null);
    setPct(14);
    setProgress('Preparing…', 18);
    try {
      // Keep pending until save succeeds so a failed second attempt can still retry the image.
      if (!launch.imageDataUrl && !launch.text) {
        throw new Error('Shared image was lost — share the receipt again');
      }

      const receiptHash = launch.imageDataUrl
        ? await sha256Hex(String(launch.imageDataUrl))
        : '';

      // Exact same file bytes → ask before spending parse cycles (and before a drifted amount).
      if (receiptHash) {
        setProgress('Checking for duplicates…', 20);
        try {
          const early = await checkDuplicateExpense(bookId, {
            receiptHash,
            allowSoft: false,
          });
          if (early.length) {
            setPendingDup({
              bookId,
              existing: early[0] as Record<string, unknown>,
              payload: { receiptHash, amount: 0, date: isoDay(), description: 'Shared receipt' },
              needsEdit: false,
              resumeParse: true,
            });
            setPhase('duplicate_confirm');
            setStatusLine('Possible duplicate');
            setPct(100);
            return;
          }
        } catch {
          // Best-effort — continue to parse.
        }
      }

      const { preview, previews } = await parseReceiptNow(bookId, launch, setProgress);
      const rows = previews.length ? previews : [preview];
      const anyAmount = rows.some((r) => Number(r.amountPaise || 0) > 0);
      const needsEdit = Boolean(
        launch.imageDataUrl && !launch.text && !isSpreadsheet(launch.mimeType, launch.fileName) && !anyAmount,
      );

      setProgress(
        rows.length > 1
          ? `Found ${rows.length} rows — checking…`
          : anyAmount
            ? `Found ₹${(preview.amountPaise / 100).toFixed(2)} — checking…`
            : 'Checking before save…',
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
        delete (payload as any).parseEngine;
        delete (payload as any).parseSource;
        delete (payload as any).reasons;
        delete (payload as any).evidenceReasons;
        if (receiptHash) (payload as any).receiptHash = receiptHash;
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

        // Hash / UPI / soft merchant+date — ask like inbound email, never silent re-save.
        try {
          const matches = await checkDuplicateExpense(bookId, {
            amount: payload.amount,
            date: payload.date,
            description: payload.description,
            merchant: payload.merchant,
            receiptHash: receiptHash || undefined,
            upiRef: (payload as any).upiRef || undefined,
            allowSoft: true,
          });
          if (matches.length) {
            setPendingDup({
              bookId,
              existing: matches[0] as Record<string, unknown>,
              payload: payload as Record<string, unknown>,
              needsEdit,
            });
            setPhase('duplicate_confirm');
            setStatusLine('Possible duplicate');
            setPct(100);
            return;
          }
        } catch {
          // Duplicate check is best-effort; still try to save.
        }

        try {
          const saved = await createExpense(bookId, payload, {
            force: false,
            idempotencyKey: String(row.id || newMoneyId('cap')),
          });
          if (!firstSaved) firstSaved = { ...saved, bookId: String(saved.bookId || bookId), _needsEdit: needsEdit };
        } catch (err: any) {
          const status = Number(err?.status || 0);
          const msg = String(err?.message || '');
          if (status === 409 || /already on this ledger|already recorded|matching entry/i.test(msg)) {
            const matches = Array.isArray(err?.extra?.matches) ? err.extra.matches : [];
            setPendingDup({
              bookId,
              existing: (matches[0] || payload) as Record<string, unknown>,
              payload: payload as Record<string, unknown>,
              needsEdit,
            });
            setPhase('duplicate_confirm');
            setStatusLine('Possible duplicate');
            setPct(100);
            return;
          }
          throw err;
        }
      }

      if (!firstSaved) throw new Error('Couldn’t save this share — try again');

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
      setStatusLine('Couldn’t finish — retry');
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
    setPendingDup(null);
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

  const existing = pendingDup?.existing;
  const candidate = pendingDup?.payload;
  const existingLabel = existing
    ? `${formatRupee(existing.amount)} · ${String(existing.merchant || existing.description || 'Earlier entry')}`
    : '';
  const candidateLabel = candidate && Number(candidate.amount || 0) > 0
    ? `${formatRupee(candidate.amount)} · ${String(candidate.merchant || candidate.description || 'This share')}`
    : '';
  const amountsDiffer = Boolean(
    existing
    && candidate
    && Number(existing.amount || 0) > 0
    && Number(candidate.amount || 0) > 0
    && Number(existing.amount) !== Number(candidate.amount),
  );

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
        ) : phase === 'duplicate_confirm' && pendingDup ? (
          <>
            <p className="sr-kicker">Possible duplicate</p>
            <h2 className="sr-title" style={{ textAlign: 'left', maxWidth: 'none' }}>
              This looks like an entry already on the ledger
            </h2>
            <p className="sr-detail" style={{ textAlign: 'left', maxWidth: 'none' }}>
              Confirm whether it is the same receipt or a different one — same as inbound email.
            </p>
            <div className="sr-dup-card">
              <p className="sr-dup-label">Already on ledger</p>
              <p className="sr-dup-value">{existingLabel}</p>
              {existing?.date ? <p className="sr-dup-meta">{String(existing.date)}</p> : null}
            </div>
            {candidateLabel ? (
              <div className="sr-dup-card sr-dup-card-new">
                <p className="sr-dup-label">This share read as</p>
                <p className="sr-dup-value">{candidateLabel}</p>
                {amountsDiffer ? (
                  <p className="sr-dup-warn">Amount differs from the saved entry — usually the same receipt re-read.</p>
                ) : null}
              </div>
            ) : (
              <p className="sr-detail" style={{ textAlign: 'left', maxWidth: 'none' }}>
                Same file was already recorded. Nothing new will be added if you choose Same receipt.
              </p>
            )}
            {error ? <p className="sr-error">{error}</p> : null}
            <div className="sr-actions sr-actions-col">
              <button
                type="button"
                className="sr-btn"
                disabled={busy}
                onClick={() => finishDuplicateSame(pendingDup.existing, pendingDup.bookId)}
              >
                Same receipt
              </button>
              <button
                type="button"
                className="sr-btn-ghost"
                disabled={busy}
                onClick={() => { void confirmDuplicateDifferent(); }}
              >
                {busy ? 'Saving…' : 'Different entry'}
              </button>
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

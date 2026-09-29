import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { createExpense, checkDuplicateExpense } from '../lib/expenses';
import { captureAuthorFields, capturePreviewToExpense, ensurePreviewCategory } from '../lib/money-capture';
import { overlayReceiptFields, previewFromReceiptText } from '../lib/receipt-ui';
import { auth } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
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
import { extractReceiptDate, bytesFingerprint, learnKeysFromText } from '../lib/amount-parse';
import { ENTRY_PAY_METHODS } from './UpiBrandMark';
import type { MoneyContextOption } from '../lib/money-flow';
import { ContextSelector } from './money/MoneyUi';
import { confirmMismatchGold, lookupLearnedParse, reportParseMismatch } from '../lib/parse-feedback';
import { enrichPreviewFromText } from '../lib/receipt-fields';
import './share-reading.css';

export type ReceiptLaunch = {
  text?: string;
  imageDataUrl?: string;
  filePath?: string;
  fileName?: string;
  mimeType?: string;
  receiptPath?: string;
  receiptName?: string;
  source?: string;
  preferredBookId?: string;
  requireBookPick?: boolean;
  receivedAt?: string;
  /** Multiple images/docs → create one entry per file, in parallel. */
  batch?: Array<{
    imageDataUrl: string;
    fileName?: string;
    mimeType?: string;
    text?: string;
  }>;
};

type Props = {
  open: boolean;
  launch: ReceiptLaunch | null;
  bookId?: string;
  bookName?: string;
  currency?: string;
  booksSeed?: Array<{ id: string; name: string; currency?: string }>;
  onClose: () => void;
  onConfirmed: (expense: Record<string, unknown>, extras?: { count?: number; needsEdit?: boolean; duplicate?: boolean }) => void;
  /** OCR couldn't read an amount inside the budget — open the normal Add form with receipt attached. */
  onManualForm?: (draft: ManualFormDraft) => void;
};

export type ManualFormDraft = {
  receiptPath?: string;
  receiptName?: string;
  merchant?: string;
  description?: string;
  amount?: number;
  paymentMethod?: string;
  category?: string;
  date?: string;
  ocrText?: string;
};

const REVIEW_CATEGORIES = [
  'Food', 'Meals', 'Groceries', 'Fuel', 'Travel', 'Health', 'Utilities', 'Shopping',
  'Housing', 'Education', 'Insurance', 'Bills', 'Entertainment',
  'Software Subscriptions', 'Office Supplies', 'Transfers', 'Income', 'Uncategorized',
];

/** Upload started during parse; the manual-form fallback awaits it briefly so the entry keeps its receipt. */
const pendingUploadRef: { current: Promise<{ receiptPath?: string; receiptName?: string } | null> | null } = { current: null };
const pendingLearnKeysRef: { current: string[] } = { current: [] };

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
  const text = String(extra?.raw || launch.text || '').trim();
  if (text) {
    const preview = previewFromReceiptText(text, {
      source: launch.source === 'share' ? 'share' : 'receipt',
      ...extra,
    });
    return {
      ...preview,
      id: extra?.id || preview.id || newMoneyId('cap'),
      receiptPath: extra?.receiptPath || launch.receiptPath,
      receiptName: extra?.receiptName || launch.receiptName || launch.fileName,
    };
  }
  return {
    id: newMoneyId('cap'),
    source: (launch.source === 'share' ? 'share' : 'receipt') as CapturePreview['source'],
    direction: 'MONEY_OUT',
    amountPaise: 0,
    description: '',
    merchant: '',
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
  const rawB64 = String(launch.imageDataUrl || '').replace(/^data:[^;]+;base64,/i, '').replace(/\s+/g, '');
  const isPdf = imageMime === 'application/pdf'
    || /\.pdf$/i.test(receiptName)
    || /^JVBER/i.test(rawB64.slice(0, 16));
  // Spreadsheets → structured server import. Large camera photos still go through
  // on-device OCR + compressed vision (Play full-res used to skip OCR entirely).
  const useStructuredPath = sheet;

  const withTimeout = <T,>(p: Promise<T>, ms: number): Promise<T | null> => Promise.race([
    p,
    new Promise<null>((resolve) => { window.setTimeout(() => resolve(null), Math.max(0, ms)); }),
  ]);

  const scrubPreview = (preview: CapturePreview): CapturePreview => {
    const raw = String(preview.raw || launch.text || '');
    const mapped = overlayReceiptFields({
      ...preview,
      reasons: [],
      parseEngine: undefined,
    } as CapturePreview, raw);
    const cleaned = ensurePreviewCategory(mapped);
    return enrichPreviewFromText(cleaned, raw, {
      fileName: receiptName || launch.fileName,
    });
  };

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

  if (launch.imageDataUrl || launch.filePath) {
    onStatus(sheet ? 'Reading spreadsheet…' : 'Preparing…', 16);

    if (launch.imageDataUrl && (useStructuredPath || (!imageMime.startsWith('image/') && !isPdf))) {
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
        imageBase64: (sheet || isPdf) ? (imageBase64 || undefined) : undefined,
        imageMime,
        skipVision: !sheet,
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

    // Image or PDF → on-device PP-OCRv4 (PDF pages rendered via PdfRenderer) + ₹ rules.
    const { prepareReceiptImage, uploadPreparedReceipt } = await import('../lib/money-receipts');
    const { localParseReceiptImage } = await import('../lib/document-ocr');
    const { amountGroundedInText, extractMoneyAmount, extractMoneyEntries } = await import('../lib/amount-parse');

    let preview = scrubPreview(draftPreview(launch, {
      receiptPath,
      receiptName,
      reasons: [],
    }));

    // PDFs use the same native OCR as images (embedded text + page render).
    // The old pdf.js worker was never in the APK, so CRED/Files PDFs opened empty.

    onStatus(isPdf ? 'Reading PDF…' : 'Reading receipt…', 22);
    const parseStarted = Date.now();
    const fromCamera = launch.source === 'camera' || launch.source === 'batch';
    const OCR_MS = 5600;
    const elapsed = () => Date.now() - parseStarted;
    if (isPdf) imageMime = 'application/pdf';
    // Pass original bytes to native OCR — avoid JS re-encode then native downscale (double lossy).
    const ocrPromise = localParseReceiptImage(
      String(launch.imageDataUrl || '').replace(/^data:[^;]+;base64,/i, '').replace(/\s+/g, ''),
      imageMime,
      launch.text || '',
      launch.filePath || '',
    ).catch(() => null);
    const preparedPromise = launch.imageDataUrl
      ? prepareReceiptImage(launch.imageDataUrl, imageMime, false)
      : Promise.resolve({ bytes: new Uint8Array(), mime: imageMime, dataUrl: '' });

    const [local, prepared] = await Promise.all([ocrPromise, preparedPromise]);
    imageMime = isPdf ? 'application/pdf' : (prepared.mime || 'image/jpeg');
    imageBase64 = String(prepared.dataUrl || '')
      .replace(/^data:[^;]+;base64,/i, '')
      .replace(/\s+/g, '');

    // Upload runs in the background — the user never waits on network for an amount.
    const uploadPromise = uploadPreparedReceipt(bookId, {
      bytes: prepared.bytes,
      mime: imageMime,
      dataUrl: prepared.dataUrl,
      fileName: isPdf && !/\.pdf$/i.test(receiptName) ? `${receiptName.replace(/\.\w+$/, '')}.pdf` : receiptName,
    }).catch(() => null);
    pendingUploadRef.current = uploadPromise;

    onStatus('Reading amount, merchant & date…', 48);

    const ocrText = [launch.text || '', local?.text || ''].filter(Boolean).join('\n');
    const learnKeys = [...learnKeysFromText(ocrText), ...(imageBase64 ? [bytesFingerprint(imageBase64)] : [])];
    pendingLearnKeysRef.current = learnKeys;
    const remoteLearnP = lookupLearnedParse({ keys: learnKeys, ocrText }).catch(() => null);
    const stamp = (extra: Partial<CapturePreview> = {}): Partial<CapturePreview> => ({
      ...extra,
      raw: extra.raw || ocrText.slice(0, 8000),
      date: extra.date || extractReceiptDate(ocrText),
    });
    const withOcr = (out: { preview: CapturePreview; previews: CapturePreview[] }) => {
      const raw = ocrText.slice(0, 8000);
      if (!raw) return out;
      const rows = (out.previews.length ? out.previews : [out.preview]).map((r) =>
        scrubPreview({ ...r, raw: r.raw || raw }),
      );
      return { preview: rows[0], previews: rows };
    };
    // Give the upload whatever is left of the budget (min 400ms) so the preview has an attachment.
    const uploadedEarly = await withTimeout(uploadPromise, Math.max(400, OCR_MS - elapsed()));
    if (uploadedEarly) {
      receiptPath = uploadedEarly.receiptPath || receiptPath;
      receiptName = uploadedEarly.receiptName || receiptName;
    }

    const hydrateFromCloud = async (entries: ReturnType<typeof extractMoneyEntries>) => {
      if (entries[0]?.score === 99) return entries;
      await withTimeout(remoteLearnP, Math.min(500, Math.max(80, OCR_MS - elapsed() + 250)));
      return extractMoneyEntries(ocrText);
    };

    // Handwritten / multi-line notes: "Seenu - Rs 1016" + "Raghu - Rs 5016" → many entries.
    // CRED / PhonePe / single UPI: one payable total only.
    const entries = await hydrateFromCloud(extractMoneyEntries(ocrText));
    if (entries.length >= 2) {
      onStatus(`Found ${entries.length} entries — confirm each…`, 78);
      const multi = entries.map((e, i) => scrubPreview({
        ...draftPreview(launch, stamp({
          amountPaise: Math.round(e.amount * 100),
          merchant: e.merchant || '',
          description: e.description || e.merchant || `Entry ${i + 1}`,
          paymentMethod: e.paymentMethod || 'cash',
          direction: e.entryType === 'in' ? 'MONEY_IN' : 'MONEY_OUT',
          date: e.date,
          processingStatus: 'READY',
          confidence: e.confidence || 'high',
          receiptPath,
          receiptName,
          reasons: [],
        })),
        id: newMoneyId(`cap_${i}`),
      }));
      return withOcr({ preview: multi[0], previews: multi });
    }

    // Single payable from OCR text (CRED "amount ₹…", PhonePe Paid to ₹…, Grand Total).
    const textHit = entries[0] || null;
    if (textHit && textHit.amount > 0
      && (textHit.score >= 48 || textHit.confidence === 'high' || textHit.confidence === 'medium')
      && (!ocrText || amountGroundedInText(ocrText, textHit.amount) || textHit.score >= 60)) {
      preview = scrubPreview({
        ...draftPreview(launch, stamp({
          amountPaise: Math.round(textHit.amount * 100),
          merchant: textHit.merchant || '',
          description: textHit.description || '',
          paymentMethod: textHit.paymentMethod || 'upi',
          direction: textHit.entryType === 'in' ? 'MONEY_IN' : 'MONEY_OUT',
          date: textHit.date,
          processingStatus: 'READY',
          confidence: textHit.confidence || 'high',
          receiptPath,
          receiptName,
          reasons: [],
        })),
        id: newMoneyId('cap'),
      });
    }

    // Local-first single payable from on-device parse object (same rules).
    const localAmt = Number(local?.amount || 0);
    const localStrong = localAmt > 0 && (
      local?.confidence === 'high'
      || local?.confidence === 'medium'
      || Number(local?.score || 0) >= 40
      || (ocrText && amountGroundedInText(ocrText, localAmt))
    );

    if (!(Number(preview.amountPaise || 0) > 0) && localStrong) {
      preview = scrubPreview({
        ...draftPreview(launch, stamp({
          amountPaise: Math.round(localAmt * 100),
          merchant: local?.merchant || '',
          description: local?.description || '',
          paymentMethod: local?.paymentMethod || 'upi',
          direction: local?.entryType === 'in' ? 'MONEY_IN' : 'MONEY_OUT',
          date: local?.date,
          processingStatus: 'READY',
          confidence: local?.confidence || 'high',
          receiptPath,
          receiptName,
          reasons: [],
        })),
        id: newMoneyId('cap'),
      });
    }

    // Same vision path for a shared payment screenshot and a camera photo.
    // Share used to stay text-only, so a screenshot scan could read and a share could not.
    const hasPhoto = imageBase64.length > 64 && String(imageMime || '').startsWith('image/');
    if (!(Number(preview.amountPaise || 0) > 0)
      && (ocrText.replace(/\s+/g, '').length >= 20 || hasPhoto)
      && (hasPhoto || elapsed() < OCR_MS - 500)) {
      onStatus('Reading photo…', 62);
      const result = await withTimeout(safeProcess({
        bookId,
        text: ocrText.slice(0, 8000),
        receiptPath,
        receiptName,
        source: launch.source || (fromCamera ? 'camera' : 'share'),
        idempotencyKey: `parse_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
        autoConfirm: true,
        imageMime,
        imageBase64: hasPhoto ? imageBase64 : undefined,
        skipVision: !hasPhoto,
      }), hasPhoto ? 1600 : Math.min(900, Math.max(0, OCR_MS - elapsed())));
      const serverPaise = Number(result?.preview?.amountPaise || 0);
      const serverAmt = serverPaise / 100;
      if (result?.preview && serverPaise > 0 && amountGroundedInText(ocrText, serverAmt)) {
        preview = scrubPreview({
          ...result.preview,
          id: result.preview.id || newMoneyId('cap'),
          receiptPath: result.preview.receiptPath || receiptPath,
          receiptName: result.preview.receiptName || receiptName,
          reasons: [],
        });
      }
    }

    if (!(Number(preview.amountPaise || 0) > 0) && localAmt > 0 && ocrText && amountGroundedInText(ocrText, localAmt)) {
        preview = scrubPreview({
          ...draftPreview(launch, stamp({
            amountPaise: Math.round(localAmt * 100),
            merchant: local?.merchant || '',
            description: local?.description || '',
            paymentMethod: local?.paymentMethod || 'upi',
            direction: local?.entryType === 'in' ? 'MONEY_IN' : 'MONEY_OUT',
            date: local?.date,
            processingStatus: 'READY',
            confidence: local?.confidence || 'medium',
            receiptPath,
            receiptName,
            reasons: [],
          })),
        id: newMoneyId('cap'),
      });
    }

    if (!(Number(preview.amountPaise || 0) > 0) && ocrText) {
      const fromText = entries[0] || extractMoneyAmount(ocrText);
      if (fromText && fromText.amount > 0 && amountGroundedInText(ocrText, fromText.amount)
        && (fromText.score >= 48 || fromText.confidence === 'high' || fromText.confidence === 'medium')) {
        preview = scrubPreview({
          ...draftPreview(launch, stamp({
            amountPaise: Math.round(fromText.amount * 100),
            merchant: fromText.merchant || '',
            description: fromText.description || '',
            paymentMethod: fromText.paymentMethod || 'upi',
            direction: fromText.entryType === 'in' ? 'MONEY_IN' : 'MONEY_OUT',
            date: fromText.date,
            processingStatus: 'READY',
            confidence: fromText.confidence,
            receiptPath,
            receiptName,
            reasons: [],
          })),
          id: newMoneyId('cap'),
        });
      }
    }

    if (!(Number(preview.amountPaise || 0) > 0)) {
      preview = scrubPreview({
        ...preview,
        processingStatus: 'REVIEW_REQUIRED',
        financialStatus: 'DRAFT',
        confidence: 'low',
        receiptPath,
        receiptName,
        reasons: [],
      });
    } else {
      preview = scrubPreview({
        ...preview,
        receiptPath: preview.receiptPath || receiptPath,
        receiptName: preview.receiptName || receiptName,
      });
    }

    if (!preview.receiptPath && pendingUploadRef.current) {
      const late = await withTimeout(pendingUploadRef.current, 4500);
      if (late?.receiptPath) {
        receiptPath = late.receiptPath || receiptPath;
        receiptName = late.receiptName || receiptName;
      }
    }
    preview = {
      ...preview,
      receiptPath: preview.receiptPath || receiptPath,
      receiptName: preview.receiptName || receiptName,
    };

    return withOcr({ preview, previews: [preview] });
  }

  // Text-only share (no image)
  onStatus(sheet ? 'Importing rows…' : 'Reading amount, merchant & date…', 40);
  if (launch.text && !sheet) {
    const localText = scrubPreview(previewFromReceiptText(launch.text, {
      source: launch.source === 'share' ? 'share' : 'receipt',
      receiptPath,
      receiptName,
    }));
    if (Number(localText.amountPaise || 0) > 0) {
      return { preview: localText, previews: [localText] };
    }
  }
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

type Phase = 'pick' | 'working' | 'failed' | 'duplicate_confirm' | 'review';

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
  booksSeed,
  onClose,
  onConfirmed,
  onManualForm,
}: Props) {
  const { userProfile } = useAuth();
  const authorExtras = () => {
    const u = auth.currentUser;
    return captureAuthorFields({
      displayName: userProfile?.displayName || u?.displayName,
      email: userProfile?.email || u?.email,
      uid: userProfile?.uid || u?.uid,
    });
  };
  const [phase, setPhase] = useState<Phase>('working');
  const [contexts, setContexts] = useState<MoneyContextOption[]>([]);
  const [busy, setBusy] = useState(false);
  const [statusLine, setStatusLine] = useState('Opening your share…');
  const [pct, setPct] = useState(8);
  const [error, setError] = useState('');
  const [activeBookId, setActiveBookId] = useState('');
  const [pendingDup, setPendingDup] = useState<PendingDup | null>(null);
  const [review, setReview] = useState<{
    bookId: string;
    rows: CapturePreview[];
    receiptHash: string;
    needsEdit: boolean;
  } | null>(null);
  const [thanksLine, setThanksLine] = useState('');
  const [mismatchBusy, setMismatchBusy] = useState(false);

  const patchReviewRow = (idx: number, patch: Partial<CapturePreview>) => {
    setReview((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        rows: prev.rows.map((r, i) => (i === idx ? { ...r, ...patch } : r)),
      };
    });
  };
  const mismatchIdRef = useRef('');
  const predictedRef = useRef<Array<{ amount: number; merchant?: string; entryType?: string }>>([]);
  const ocrTextRef = useRef('');
  const savingRef = useRef(false);
  const doneRef = useRef(false);
  const parseGenRef = useRef(0);
  const tickRef = useRef<number | null>(null);
  const stageKeyRef = useRef('');
  const launchKey = launch
    ? [
      launch.receivedAt || '',
      launch.source || '',
      launch.fileName || '',
      launch.mimeType || '',
      String(launch.filePath || ''),
      String(launch.imageDataUrl || '').length,
      String(launch.imageDataUrl || '').slice(64, 128),
      String(launch.text || '').slice(0, 160),
      String(launch.batch?.length || 0),
    ].join('|')
    : '';

  const discardAndClose = () => {
    parseGenRef.current += 1;
    doneRef.current = true;
    savingRef.current = false;
    setReview(null);
    setPendingDup(null);
    clearPendingCapture();
    try { window.dispatchEvent(new CustomEvent('byjan-capture-discarded')); } catch { /* ignore */ }
    onClose();
  };

  const setProgress = (line: string, nextPct?: number) => {
    setStatusLine(line);
    if (typeof nextPct === 'number') setPct((p) => Math.max(p, nextPct));
  };

  /** Parallel bulk import: many images/PDFs/sheets → many entries, fast. */
  const saveBatch = async (bookId: string) => {
    if (!launch?.batch?.length || !bookId || savingRef.current || doneRef.current) return;
    savingRef.current = true;
    setActiveBookId(bookId);
    rememberMoneyBook(bookId);
    setBusy(true);
    setPhase('working');
    setError('');
    setPendingDup(null);
    const items = launch.batch;
    const total = items.length;
    setProgress(`Importing ${total} documents…`, 8);
    try {
      const CONCURRENCY = 3;
      const savedRows: Record<string, unknown>[] = [];
      let needsEditCount = 0;
      let doneCount = 0;

      const processOne = async (item: NonNullable<ReceiptLaunch['batch']>[number], index: number) => {
        const one: ReceiptLaunch = {
          source: launch.source || 'batch',
          imageDataUrl: item.imageDataUrl,
          fileName: item.fileName || `receipt-${Date.now()}-${index}`,
          mimeType: item.mimeType || 'image/jpeg',
          text: item.text,
        };
        const { preview, previews } = await parseReceiptNow(bookId, one, () => undefined);
        const rows = (previews.length ? previews : [preview]).filter(Boolean);
        const anyAmount = rows.some((r) => Number(r.amountPaise || 0) > 0);
        const needsEdit = Boolean(
          one.imageDataUrl && !one.text && !isSpreadsheet(one.mimeType, one.fileName) && !anyAmount,
        );
        if (needsEdit) needsEditCount += 1;
        const toSave = rows.length > 1
          ? rows.filter((r) => Number(r.amountPaise || 0) > 0 || !anyAmount)
          : rows;
        const created: Record<string, unknown>[] = [];
        await Promise.all(toSave.map(async (row, ri) => {
          const payload = capturePreviewToExpense(row, {
            ...authorExtras(),
            receiptPath: row.receiptPath,
            receiptName: row.receiptName,
            captureSource: row.source || 'batch',
          });
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
              'Could not read amount — edit to finish.',
            ].filter(Boolean).join('\n');
          }
          try {
            const saved = await createExpense(bookId, payload, {
              force: true,
              idempotencyKey: String(row.id || newMoneyId(`batch_${index}_${ri}`)),
            });
            created.push({ ...saved, bookId, _needsEdit: needsEdit });
          } catch {
            /* keep going — other docs still import */
          }
        }));
        doneCount += 1;
        setProgress(`Imported ${doneCount} of ${total}…`, 12 + Math.round((doneCount / total) * 80));
        return created;
      };

      for (let i = 0; i < items.length; i += CONCURRENCY) {
        const chunk = items.slice(i, i + CONCURRENCY);
        const chunkResults = await Promise.all(chunk.map((item, j) => processOne(item, i + j)));
        for (const list of chunkResults) savedRows.push(...list);
      }

      if (!savedRows.length) throw new Error('Could not import any of these documents');

      setPct(100);
      doneRef.current = true;
      clearPendingCapture();
      onConfirmed(savedRows[0], {
        count: savedRows.length,
        needsEdit: needsEditCount > 0,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bulk import failed');
      setPhase('failed');
      setStatusLine('Couldn’t finish bulk import — retry');
    } finally {
      savingRef.current = false;
      setBusy(false);
    }
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
        ...authorExtras(),
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

  const confirmReview = async () => {
    if (!review || savingRef.current || doneRef.current) return;
    const rows = review.rows.filter((r) => Number(r.amountPaise || 0) > 0);
    if (!rows.length) {
      setError('Enter a valid amount on at least one row before saving');
      return;
    }
    savingRef.current = true;
    setBusy(true);
    setError('');
    try {
      const savedRows: Record<string, unknown>[] = [];
      for (let i = 0; i < rows.length; i += 1) {
        const row = rows[i];
        const payload = capturePreviewToExpense(row, {
          ...authorExtras(),
          receiptPath: row.receiptPath,
          receiptName: row.receiptName,
          captureSource: row.source || 'share',
        });
        delete (payload as any).parseEngine;
        delete (payload as any).parseSource;
        delete (payload as any).reasons;
        delete (payload as any).evidenceReasons;
        if (review.receiptHash) (payload as any).receiptHash = review.receiptHash;
        if (row.direction === 'MONEY_IN') (payload as any).entryType = 'in';
        const saved = await createExpense(review.bookId, payload, {
          force: i > 0,
          idempotencyKey: String(row.id || newMoneyId(`cap_${i}`)),
        });
        savedRows.push({
          ...saved,
          bookId: String(saved.bookId || review.bookId),
          _needsEdit: review.needsEdit,
        });
      }
      setPct(100);
      doneRef.current = true;
      clearPendingCapture();
      if (mismatchIdRef.current || ocrTextRef.current) {
        const goldRows = rows.map((r) => ({
          amount: Number(r.amountPaise || 0) / 100,
          merchant: String(r.merchant || r.description || ''),
          entryType: r.direction === 'MONEY_IN' ? 'in' : 'out',
        }));
        const gold = goldRows[0];
        if (gold && gold.amount > 0) {
          void confirmMismatchGold({
            id: mismatchIdRef.current,
            bookId: review.bookId,
            ocrText: ocrTextRef.current,
            gold: { ...gold, extras: goldRows.length > 1 ? goldRows : undefined },
            saved: true,
            extraKeys: pendingLearnKeysRef.current,
          });
        }
      }
      onConfirmed(savedRows[0], {
        count: savedRows.length,
        needsEdit: review.needsEdit,
      });
      onClose();
    } catch (err: any) {
      const status = Number(err?.status || 0);
      const msg = String(err?.message || '');
      if (status === 409 || /already on this ledger|already recorded|matching entry/i.test(msg)) {
        const matches = Array.isArray(err?.extra?.matches) ? err.extra.matches : [];
        const row = review.rows[0];
        const payload = capturePreviewToExpense(row, {
          ...authorExtras(),
          receiptPath: row.receiptPath,
          receiptName: row.receiptName,
          captureSource: row.source || 'share',
        });
        setPendingDup({
          bookId: review.bookId,
          existing: (matches[0] || payload) as Record<string, unknown>,
          payload: payload as Record<string, unknown>,
          needsEdit: review.needsEdit,
        });
        setPhase('duplicate_confirm');
        return;
      }
      setError(err instanceof Error ? err.message : 'Could not save');
    } finally {
      savingRef.current = false;
      setBusy(false);
    }
  };

  const saveNow = async (bookId: string, gen?: number) => {
    const myGen = gen ?? parseGenRef.current;
    const stillMine = () => parseGenRef.current === myGen;
    if (launch?.batch?.length) {
      if (!stillMine()) return;
      await saveBatch(bookId);
      return;
    }
    if (!launch || !bookId || !stillMine()) return;
    savingRef.current = true;
    doneRef.current = false;
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
      if (!launch.imageDataUrl && !launch.text && !launch.filePath) {
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
      if (!stillMine()) return;
      const rows = previews.length ? previews : [preview];
      const anyAmount = rows.some((r) => Number(r.amountPaise || 0) > 0);
      const needsEdit = Boolean(
        launch.imageDataUrl && !launch.text && !isSpreadsheet(launch.mimeType, launch.fileName) && !anyAmount,
      );

      setProgress(
        rows.length > 1
          ? `Found ${rows.length} entries — review…`
          : anyAmount
            ? `Found ₹${(preview.amountPaise / 100).toFixed(2)} — checking…`
            : 'Opening entry form…',
        88,
      );

      const isSheetImport = isSpreadsheet(launch.mimeType, launch.fileName);

      // No readable amount → never park the user on a blank confirm screen. Open the normal
      // Add form with whatever we did read (merchant/date) and the receipt attached.
      if (!isSheetImport && !anyAmount && onManualForm) {
        const row = rows[0] || preview;
        if (!row.receiptPath && pendingUploadRef.current) {
          const late = await Promise.race([
            pendingUploadRef.current,
            new Promise<null>((resolve) => { window.setTimeout(() => resolve(null), 1200); }),
          ]).catch(() => null);
          if (late?.receiptPath) {
            row.receiptPath = late.receiptPath;
            row.receiptName = late.receiptName || row.receiptName;
          }
        }
        pendingUploadRef.current = null;
        doneRef.current = true;
        clearPendingCapture();
        onManualForm({
          receiptPath: row.receiptPath || launch.receiptPath,
          receiptName: row.receiptName || launch.receiptName || launch.fileName,
          merchant: String(row.merchant || ''),
          description: String(row.description || '') === 'Shared receipt' ? '' : String(row.description || ''),
          paymentMethod: String(row.paymentMethod || 'upi'),
          category: String(row.category || ''),
          date: String(row.date || ''),
          ocrText: String(row.raw || ''),
        });
        onClose();
        return;
      }

      // Always review image/share parses (one or many) so user confirms before save.
      // Spreadsheet multi-import still auto-saves below when source is sheet-like.
      if (!isSheetImport) {
        setReview({
          bookId,
          rows,
          receiptHash,
          needsEdit,
        });
        ocrTextRef.current = String(rows[0]?.raw || launch.text || '');
        predictedRef.current = rows.map((r) => ({
          amount: Number(r.amountPaise || 0) / 100,
          merchant: String(r.merchant || ''),
          entryType: r.direction === 'MONEY_IN' ? 'in' : 'out',
        }));
        setPhase('review');
        setStatusLine(rows.length > 1 ? `Confirm ${rows.length} entries` : 'Confirm before saving');
        setPct(100);
        return;
      }

      let firstSaved: Record<string, unknown> | null = null;
      for (let i = 0; i < rows.length; i += 1) {
        const row = rows[i];
        if (!(Number(row.amountPaise || 0) > 0) && rows.length > 1 && anyAmount) continue;
        const payload = capturePreviewToExpense(row, {
          ...authorExtras(),
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
      if (stillMine()) {
        savingRef.current = false;
        setBusy(false);
      }
    }
  };

  useEffect(() => {
    if (!open || !launch) {
      stageKeyRef.current = '';
      return;
    }
    let cancelled = false;
    const gen = parseGenRef.current + 1;
    parseGenRef.current = gen;
    savingRef.current = false;
    doneRef.current = false;
    const received = String(launch.receivedAt || '');
    const keepStage = stageKeyRef.current === launchKey
      || (received.length > 0 && stageKeyRef.current.startsWith(`${received}|`));
    stageKeyRef.current = launchKey;
    if (!keepStage) {
      setError('');
      setPendingDup(null);
      setReview(null);
      setThanksLine('');
      mismatchIdRef.current = '';
      predictedRef.current = [];
      ocrTextRef.current = '';
      setPct(6);
      setStatusLine('Opening your share…');
    }

    tickRef.current = window.setInterval(() => {
      setPct((p) => (p < 22 ? p + 1.2 : p));
    }, 180);

    const run = async () => {
      // requireBookPick must always show the picker when picking is required.
      // Never auto-save into preferredBookId while picking is required.
      const wantPick = launch.requireBookPick === true
        || (!launch.preferredBookId && !initialBookId);

      const seedFromProps = (booksSeed || []).map((b) => ({
        id: b.id,
        name: b.name,
        currency: b.currency || 'INR',
        score: b.id === launch.preferredBookId ? 20 : 10,
        reason: b.id === launch.preferredBookId ? 'Suggested' : 'Authorized Money book',
        memberCount: 1,
      }));
      const cached = [
        ...seedFromProps,
        ...readCachedMoneyBooks()
          .filter((b) => !seedFromProps.some((s) => s.id === b.id))
          .map((b) => ({
            id: b.id,
            name: b.name,
            currency: b.currency || 'INR',
            score: b.id === launch.preferredBookId ? 20 : 10,
            reason: b.id === launch.preferredBookId ? 'Suggested' : 'Authorized Money book',
            memberCount: 1,
          })),
      ];
      if (cached.length) setContexts(cached);

      if (wantPick) {
        setPhase('pick');
        setBusy(true);
        setStatusLine('Choose where to save this share');
        setPct(10);
      }

      if (!wantPick) {
        const lockedBook = launch.preferredBookId || initialBookId || (cached.length === 1 ? cached[0].id : '');
        if (lockedBook) {
          setPhase('working');
          await saveNow(lockedBook, gen);
          return;
        }
      }

      try {
        const { listLedgers } = await import('../lib/ledgers');
        const ledgers = await listLedgers();
        if (cancelled || savingRef.current || doneRef.current) return;
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

        if (!wantPick && bookRows.length === 1) {
          await saveNow(bookRows[0].id, gen);
          return;
        }
        if (!bookRows.length && !cached.length) {
          setError('Create a Money book first, then share again.');
          setPhase('failed');
          return;
        }

        // 2+ books or explicit pick → stay on picker (keep cached if API empty).
        if (wantPick || bookRows.length > 1 || cached.length > 1) {
          if (bookRows.length) setContexts(bookRows);
          setPhase('pick');
          setPct(10);
          setStatusLine('Choose where to save this share');
        } else if (bookRows.length === 1) {
          await saveNow(bookRows[0].id, gen);
        } else if (cached.length === 1) {
          await saveNow(cached[0].id, gen);
        }
      } catch {
        if (!cancelled) {
          if (cached.length > 1 || wantPick) {
            setPhase('pick');
            if (cached.length) setContexts(cached);
            setStatusLine('Choose where to save this share');
          } else if (cached.length === 1) {
            await saveNow(cached[0].id, gen);
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
  }, [open, launchKey]);

  useEffect(() => () => {
    if (tickRef.current) window.clearInterval(tickRef.current);
  }, []);

  useEffect(() => {
    if (!open || typeof document === 'undefined') return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  const flagMismatch = async () => {
    if (!review || mismatchBusy || thanksLine) return;
    const ocrText = ocrTextRef.current || String(review.rows[0]?.raw || '');
    if (!ocrText.trim()) {
      setThanksLine('Sorry for the inconvenience — we will keep training Byjan. Thanks for your patience.');
      return;
    }
    setMismatchBusy(true);
    try {
      const current = review.rows.map((r) => ({
        amount: Number(r.amountPaise || 0) / 100,
        merchant: String(r.merchant || r.description || ''),
        entryType: r.direction === 'MONEY_IN' ? 'in' : 'out',
      }));
      const predicted = predictedRef.current.length ? predictedRef.current : current;
      const predictedKey = predicted.map((p) => `${p.amount}|${p.merchant || ''}`).join(';');
      const currentKey = current.map((p) => `${p.amount}|${p.merchant || ''}`).join(';');
      const goldRow = current.find((r) => r.amount > 0);
      const gold = goldRow && currentKey !== predictedKey
        ? { ...goldRow, extras: current.filter((r) => r.amount > 0) }
        : undefined;
      const result = await reportParseMismatch({
        bookId: review.bookId,
        ocrText,
        predicted,
        gold,
        extraKeys: pendingLearnKeysRef.current,
      });
      if (result.id) mismatchIdRef.current = result.id;
      setThanksLine(result.thanks);
    } finally {
      setMismatchBusy(false);
    }
  };

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

  const sheet = (
    <div className="sr-root" role="dialog" aria-modal="true" aria-label="Reading shared receipt">
      <button type="button" className="sr-dim" aria-label="Close" onClick={discardAndClose} />
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
            <div className="sr-pick" data-testid="book-pick-sheet">
              {contexts.length === 0 ? (
                <p className="sr-detail" style={{ textAlign: 'left' }}>
                  {busy ? 'Loading Money books…' : 'No Money books found.'}
                </p>
              ) : (
                <ContextSelector
                  contexts={contexts}
                  selectedId=""
                  onSelect={(id) => { void saveNow(id); }}
                />
              )}
            </div>
          </>
        ) : phase === 'review' && review ? (
          <>
            <p className="sr-kicker">Review</p>
            <h2 className="sr-title" style={{ textAlign: 'left', maxWidth: 'none' }}>
              {review.rows.length > 1
                ? `Confirm ${review.rows.length} entries`
                : 'Confirm before it is saved'}
            </h2>
            <p className="sr-detail" style={{ textAlign: 'left', maxWidth: 'none' }}>
              {review.rows.length > 1
                ? 'Each line from the photo is listed below. Fix any field, then save all.'
                : 'Check every field we could read. Uncertain reads stay here until you confirm.'}
            </p>
            {review.rows.map((row, idx) => {
              const cats = Array.from(new Set([
                ...REVIEW_CATEGORIES,
                ...(row.category ? [String(row.category)] : []),
              ]));
              const pay = String(row.paymentMethod || 'upi').toLowerCase();
              const dir = row.direction === 'MONEY_IN' ? 'in' : 'out';
              return (
              <div
                key={row.id || `row_${idx}`}
                style={{
                  marginTop: 12,
                  padding: 12,
                  borderRadius: 12,
                  border: '1px solid rgba(15, 23, 42, 0.08)',
                  background: 'rgba(255,255,255,0.72)',
                }}
              >
                {review.rows.length > 1 ? (
                  <p className="sr-detail" style={{ marginBottom: 8, fontWeight: 600, color: '#0f172a' }}>
                    Entry {idx + 1}
                  </p>
                ) : null}
                {Number(row.amountPaise || 0) <= 0 ? (
                  <p className="sr-dup-warn">Amount was not read clearly — type it below.</p>
                ) : null}
                <label className="sr-field-label">
                  Amount
                  <input
                    className="byjan-input mt-1"
                    type="number"
                    inputMode="decimal"
                    value={row.amountPaise ? row.amountPaise / 100 : ''}
                    onChange={(e) => {
                      const n = Number(e.target.value || 0);
                      patchReviewRow(idx, { amountPaise: Math.round(n * 100) });
                    }}
                  />
                </label>
                <label className="sr-field-label">
                  Name / merchant
                  <input
                    className="byjan-input mt-1"
                    value={String(row.merchant || '')}
                    onChange={(e) => {
                      const merchant = e.target.value;
                      const next = { ...row, merchant, description: row.description === row.merchant ? merchant : row.description };
                      const filled = String(row.category || '').toLowerCase() === 'uncategorized' || !row.category
                        ? ensurePreviewCategory({ ...next, merchant })
                        : next;
                      patchReviewRow(idx, {
                        merchant: filled.merchant,
                        description: filled.description,
                        category: filled.category,
                      });
                    }}
                  />
                </label>
                <label className="sr-field-label">
                  Description
                  <input
                    className="byjan-input mt-1"
                    value={String(row.description || '')}
                    onChange={(e) => patchReviewRow(idx, { description: e.target.value })}
                  />
                </label>
                <label className="sr-field-label">
                  Category
                  <select
                    className="byjan-input mt-1"
                    value={String(row.category || 'Uncategorized')}
                    onChange={(e) => patchReviewRow(idx, { category: e.target.value })}
                  >
                    {cats.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </label>
                <label className="sr-field-label">
                  Date
                  <input
                    className="byjan-input mt-1"
                    type="date"
                    value={String(row.date || '').slice(0, 10)}
                    onChange={(e) => patchReviewRow(idx, { date: e.target.value })}
                  />
                </label>
                <p className="sr-field-label" style={{ marginBottom: 0 }}>Payment</p>
                <div className="sr-chip-row">
                  {ENTRY_PAY_METHODS.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      className={`sr-chip${pay === m.id ? ' is-on' : ''}`}
                      onClick={() => patchReviewRow(idx, { paymentMethod: m.id })}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
                <p className="sr-field-label" style={{ marginBottom: 0 }}>Type</p>
                <div className="sr-chip-row">
                  <button
                    type="button"
                    className={`sr-chip${dir === 'out' ? ' is-on' : ''}`}
                    onClick={() => patchReviewRow(idx, { direction: 'MONEY_OUT' })}
                  >
                    Money out
                  </button>
                  <button
                    type="button"
                    className={`sr-chip${dir === 'in' ? ' is-on' : ''}`}
                    onClick={() => patchReviewRow(idx, { direction: 'MONEY_IN' })}
                  >
                    Money in
                  </button>
                </div>
                {row.upiRef ? (
                  <label className="sr-field-label">
                    UPI / UTR
                    <input
                      className="byjan-input mt-1"
                      value={String(row.upiRef || '')}
                      onChange={(e) => patchReviewRow(idx, { upiRef: e.target.value })}
                    />
                  </label>
                ) : null}
                {row.vpa ? (
                  <label className="sr-field-label">
                    VPA
                    <input
                      className="byjan-input mt-1"
                      value={String(row.vpa || '')}
                      onChange={(e) => patchReviewRow(idx, { vpa: e.target.value })}
                    />
                  </label>
                ) : null}
                {row.fundSource ? (
                  <label className="sr-field-label">
                    Paid from
                    <input
                      className="byjan-input mt-1"
                      value={String(row.fundSource || '')}
                      onChange={(e) => patchReviewRow(idx, { fundSource: e.target.value })}
                    />
                  </label>
                ) : null}
                <label className="sr-field-label">
                  Notes
                  <textarea
                    className="byjan-input mt-1"
                    rows={2}
                    value={String(row.notes || '')}
                    onChange={(e) => patchReviewRow(idx, { notes: e.target.value })}
                  />
                </label>
              </div>
              );
            })}
            {error ? <p className="sr-error">{error}</p> : null}
            {thanksLine ? (
              <p className="sr-thanks" role="status">{thanksLine}</p>
            ) : (
              <button
                type="button"
                className="sr-mismatch"
                disabled={busy || mismatchBusy}
                onClick={() => void flagMismatch()}
              >
                {mismatchBusy ? 'Sending…' : 'Is this a mismatch?'}
              </button>
            )}
            <div className="sr-actions" style={{ marginTop: 16 }}>
              <button type="button" className="sr-btn-ghost" onClick={discardAndClose}>Cancel</button>
              <button type="button" className="sr-btn" disabled={busy} onClick={() => void confirmReview()}>
                {busy
                  ? 'Saving…'
                  : review.rows.length > 1
                    ? `Save ${review.rows.filter((r) => Number(r.amountPaise || 0) > 0).length} entries`
                    : 'Save entry'}
              </button>
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
                <button type="button" className="sr-btn-ghost" onClick={discardAndClose}>Go back</button>
                <button
                  type="button"
                  className="sr-btn"
                  disabled={busy}
                  onClick={() => void saveNow(activeBookId || initialBookId || contexts[0]?.id || '')}
                >
                  {busy ? 'Retrying…' : 'Retry'}
                </button>
              </div>
            ) : (
              <div className="sr-actions">
                <button type="button" className="sr-btn-ghost" onClick={discardAndClose}>Cancel</button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );

  if (typeof document === 'undefined') return sheet;
  return createPortal(sheet, document.body);
}

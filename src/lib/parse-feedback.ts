/**
 * Mismatch feedback: train the receipt parser from OCR TEXT only.
 * The photo is never sent and never stored here — it stays on-device until the user saves an entry.
 * Corrections apply instantly on this device, then sync to the server so another phone can
 * resolve the same UTR / UPI txn / identical file in the background.
 */
import { apiPost } from './api';
import {
  bytesFingerprint,
  learnKeysFromText,
  ocrFingerprint,
  setLearnedParseLookup,
  type LearnedParseHit,
} from './amount-parse';

const LS_KEY = 'byjan.parseOverrides.v1';
const THANKS = [
  'Sorry for the inconvenience — we are pushing toward 100% accuracy so your finances stay smart. Thanks for your patience. Meanwhile, try Voice, Split, or Reports.',
  'Got it. Byjan will learn from this receipt’s details (the photo is not kept unless you save). Thanks for helping us get this right.',
  'Thanks for the flag. We’ll use this to train the parser. Explore People, email-in receipts, or Settlements while we get better.',
  'Sorry that read was off. Your correction trains Byjan for the next similar share — thank you for the patience.',
];

export function mismatchThanksMessage() {
  return THANKS[Math.floor(Math.random() * THANKS.length)];
}

type Gold = LearnedParseHit;

function loadLocal(): Record<string, Gold> {
  try {
    if (typeof localStorage === 'undefined') return {};
    const raw = JSON.parse(localStorage.getItem(LS_KEY) || '{}');
    return raw && typeof raw === 'object' ? raw as Record<string, Gold> : {};
  } catch {
    return {};
  }
}

function saveLocal(map: Record<string, Gold>) {
  try {
    if (typeof localStorage === 'undefined') return;
    const keys = Object.keys(map);
    if (keys.length > 480) {
      for (const k of keys.slice(0, keys.length - 360)) delete map[k];
    }
    localStorage.setItem(LS_KEY, JSON.stringify(map));
  } catch {
    /* quota */
  }
}

let memory = loadLocal();
setLearnedParseLookup((fp) => {
  const hit = memory[fp];
  return hit && Number(hit.amount) > 0 ? hit : null;
});

export function collectLearnKeys(text: string, extraKeys: string[] = []): string[] {
  return [...new Set([...learnKeysFromText(text), ...extraKeys.map(String).filter(Boolean)])];
}

export function rememberLearnedParse(text: string, gold: Gold, extraKeys: string[] = []) {
  if (!(Number(gold.amount) > 0)) return;
  const keys = collectLearnKeys(text, extraKeys);
  if (!keys.length) return;
  const next = { ...memory };
  for (const k of keys) next[k] = gold;
  memory = next;
  saveLocal(memory);
}

export type MismatchPredicted = { amount: number; merchant?: string; entryType?: string };

export async function lookupLearnedParse(input: {
  keys?: string[];
  ocrText?: string;
  imageData?: string;
}): Promise<Gold | null> {
  const extra = input.imageData ? [bytesFingerprint(input.imageData)] : [];
  const keys = collectLearnKeys(input.ocrText || '', [...(input.keys || []), ...extra]).slice(0, 12);
  if (!keys.length) return null;
  for (const k of keys) {
    const local = memory[k];
    if (local && Number(local.amount) > 0) return local;
  }
  try {
    const payload = await apiPost<{ gold?: Gold | null }>('/api/money', {
      op: 'lookupParseOverride',
      keys,
    });
    const gold = payload.gold && Number(payload.gold.amount) > 0 ? payload.gold : null;
    if (gold) rememberLearnedParse(input.ocrText || '', gold, keys);
    return gold;
  } catch {
    return null;
  }
}

export async function reportParseMismatch(input: {
  bookId?: string;
  ocrText: string;
  predicted: MismatchPredicted[];
  gold?: Gold;
  extraKeys?: string[];
}): Promise<{ id?: string; thanks: string }> {
  const thanks = mismatchThanksMessage();
  const ocrText = String(input.ocrText || '').slice(0, 8000);
  if (!ocrText.trim()) return { thanks };
  const keys = collectLearnKeys(ocrText, input.extraKeys);
  if (input.gold && Number(input.gold.amount) > 0) {
    rememberLearnedParse(ocrText, input.gold, keys);
  }
  try {
    const payload = await apiPost<{ id?: string }>('/api/money', {
      op: 'reportMismatch',
      bookId: input.bookId || '',
      ocrText,
      fingerprint: ocrFingerprint(ocrText),
      keys,
      predicted: input.predicted || [],
      gold: input.gold && Number(input.gold.amount) > 0 ? input.gold : null,
    });
    return { id: payload.id, thanks };
  } catch {
    return { thanks };
  }
}

export async function confirmMismatchGold(input: {
  id?: string;
  bookId?: string;
  ocrText: string;
  gold: Gold;
  saved: boolean;
  extraKeys?: string[];
}) {
  const keys = collectLearnKeys(input.ocrText, input.extraKeys);
  if (input.gold && Number(input.gold.amount) > 0) {
    rememberLearnedParse(input.ocrText, input.gold, keys);
  }
  try {
    await apiPost('/api/money', {
      op: 'confirmMismatchGold',
      id: input.id || '',
      bookId: input.bookId || '',
      ocrText: String(input.ocrText || '').slice(0, 8000),
      fingerprint: ocrFingerprint(input.ocrText || ''),
      keys,
      gold: input.gold,
      saved: Boolean(input.saved),
    });
  } catch {
    /* local override already applied */
  }
}

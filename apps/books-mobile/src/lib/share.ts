import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core';

export type SharedFile = { mimeType?: string; fileName?: string; dataBase64?: string; byteLength?: number };
export type SharedPayload = SharedFile & { text?: string; source?: string; receivedAt?: string | number; hasPending?: boolean; error?: string; files?: SharedFile[]; fileCount?: number };

type Plugin = {
  checkPending(): Promise<SharedPayload>;
  addListener(e: 'shareReceived', cb: (p: SharedPayload) => void): Promise<PluginListenerHandle>;
};
const ShareReceiver = registerPlugin<Plugin>('ShareReceiver');
const available = () => Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';

/** One item the capture flow will process. */
export type CaptureInput = { dataUrl?: string; fileName?: string; mimeType?: string; text?: string; source: string };
export type PendingCapture = { items: CaptureInput[]; text?: string; source: string; receivedAt: number; preferredBookId?: string };

let pending: PendingCapture | null = null;
const listeners = new Set<(p: PendingCapture) => void>();
const TTL = 5 * 60 * 1000;

export function setPending(p: PendingCapture) { pending = p; listeners.forEach((l) => l(p)); }
export function takePending(): PendingCapture | null {
  const p = pending; pending = null;
  if (!p || Date.now() - p.receivedAt > TTL) return null;
  return p;
}
export function peekPending() { return pending && Date.now() - pending.receivedAt <= TTL ? pending : null; }
export function onPending(cb: (p: PendingCapture) => void) { listeners.add(cb); return () => { listeners.delete(cb); }; }

function toItems(p: SharedPayload): CaptureInput[] {
  const files = p.files?.length ? p.files : p.dataBase64 ? [p] : [];
  const source = p.source || 'share';
  const items: CaptureInput[] = files.filter((f) => f.dataBase64 && f.dataBase64.length > 64).map((f) => {
    let mime = String(f.mimeType || 'application/octet-stream').split(';')[0];
    if (String(f.dataBase64).startsWith('JVBER')) mime = 'application/pdf';
    return { dataUrl: `data:${mime};base64,${f.dataBase64}`, fileName: f.fileName || 'shared', mimeType: mime, text: p.text, source };
  });
  if (!items.length && p.text) items.push({ text: p.text, source });
  return items;
}

async function drain(light?: SharedPayload) {
  let full = light;
  if (!light || light.hasPending || !light.dataBase64) {
    try { const p = await ShareReceiver.checkPending(); if (p && (p.text || p.dataBase64 || p.files?.length)) full = { ...light, ...p }; } catch { /* no plugin */ }
  }
  if (!full) return;
  if (full.error) throw new Error(full.error);
  const items = toItems(full);
  if (!items.length) return;
  setPending({ items, text: full.text, source: full.source || 'share', receivedAt: Number(full.receivedAt) || Date.now() });
}

/** Starts listening for Android share-sheet shares. Returns cleanup. */
export async function startShareListener(onError: (msg: string) => void) {
  if (!available()) return () => undefined;
  try { await drain(); } catch (e) { onError((e as Error).message); }
  const h = await ShareReceiver.addListener('shareReceived', (p) => { void drain(p).catch((e) => onError((e as Error).message)); });
  return () => { void h.remove(); };
}

/** Deep link: com.byjanbooks.app://capture?text=...&bookId=... */
export function handleCaptureUrl(url: string) {
  try {
    const u = new URL(url.replace(/^com\.byjanbooks\.app:\/\//, 'https://app.byjan/'));
    if (!u.pathname.includes('capture')) return false;
    const text = u.searchParams.get('text') || '';
    if (!text) return false;
    setPending({ items: [{ text, source: 'link' }], text, source: 'link', receivedAt: Date.now(), preferredBookId: u.searchParams.get('bookId') || undefined });
    return true;
  } catch { return false; }
}

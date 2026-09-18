import { Capacitor, registerPlugin } from '@capacitor/core';
import { toPaise } from './money-core';
import { guessCategoryFromText, guessedMerchant } from './bridge-automations';

export type VoiceParse = {
  transcript: string;
  amount: number;
  amountPaise: number;
  merchant: string;
  category: string;
  entryType: 'in' | 'out' | 'transfer';
  bookHint: string;
  confidence: 'high' | 'medium' | 'low';
};

type VoiceCapturePlugin = {
  isAvailable: () => Promise<{ available?: boolean; granted?: boolean }>;
  requestPermission: () => Promise<{ granted?: boolean }>;
  listen: (opts?: { lang?: string; timeoutMs?: number }) => Promise<{
    transcript?: string;
    error?: string;
    denied?: boolean;
  }>;
};

const VoiceCapture = registerPlugin<VoiceCapturePlugin>('VoiceCapture');

const SpeechRecognitionCtor: (new () => any) | null = (() => {
  if (typeof window === 'undefined') return null;
  const w = window as any;
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
})();

export function voiceSupported() {
  if (Capacitor.isNativePlatform()) return true;
  return Boolean(SpeechRecognitionCtor);
}

export function parseVoiceLine(input: string): VoiceParse {
  const transcript = String(input || '').trim();
  const q = transcript.toLowerCase();
  const amtMatch = q.match(/(?:rs\.?|inr|₹|rupees?)\s*([\d,]+(?:\.\d{1,2})?)/i)
    || q.match(/([\d,]+(?:\.\d{1,2})?)\s*(?:rs\.?|rupees?|inr)/i)
    || q.match(/\b(?:paid|spent|received|got)\s+([\d,]+(?:\.\d{1,2})?)/i);
  const amount = amtMatch ? Number(String(amtMatch[1]).replace(/,/g, '')) : 0;
  const toMatch = transcript.match(/\b(?:to|at|for)\s+([A-Za-z][A-Za-z0-9 &._-]{1,40})/i);
  const merchantGuess = guessedMerchant(transcript);
  const merchant = String(toMatch?.[1] || merchantGuess?.merchant || '').replace(/\bfrom\b.*$/i, '').trim();
  const bookHint = (transcript.match(/\bfrom\s+([A-Za-z][A-Za-z0-9 &._-]{1,40})\s*book/i)?.[1] || '').trim();
  const entryType: VoiceParse['entryType'] = /\b(received|got|income|money in|credited)\b/i.test(q)
    ? 'in'
    : /\btransfer\b/i.test(q)
      ? 'transfer'
      : 'out';
  const category = guessCategoryFromText(q, merchant) || merchantGuess?.category || 'Uncategorized';
  const amounts = [...q.matchAll(/([\d,]+(?:\.\d{1,2})?)/g)].map((m) => Number(String(m[1]).replace(/,/g, ''))).filter((n) => n >= 1);
  const uniqueAmts = [...new Set(amounts)];
  const confidence: VoiceParse['confidence'] = amount > 0 && merchant
    ? (uniqueAmts.length > 2 ? 'medium' : 'high')
    : amount > 0
      ? 'medium'
      : 'low';
  return {
    transcript,
    amount: Number.isFinite(amount) ? amount : 0,
    amountPaise: toPaise(Number.isFinite(amount) ? amount : 0),
    merchant,
    category,
    entryType,
    bookHint,
    confidence,
  };
}

async function listenNative(opts?: { lang?: string; timeoutMs?: number }) {
  const res = await VoiceCapture.listen({
    lang: opts?.lang || 'en-IN',
    timeoutMs: opts?.timeoutMs || 12_000,
  });
  return {
    transcript: String(res?.transcript || '').trim(),
    error: res?.error,
    denied: Boolean(res?.denied),
  };
}

function listenWeb(opts?: { lang?: string; timeoutMs?: number }, probeMic = true): Promise<{ transcript: string; error?: string; denied?: boolean }> {
  if (!SpeechRecognitionCtor) {
    return Promise.resolve({ transcript: '', error: 'Speech recognition is not available on this device' });
  }
  const start = async () => {
    if (probeMic && navigator.mediaDevices?.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((t) => t.stop());
      } catch (err) {
        const name = err instanceof DOMException ? err.name : '';
        if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
          return { transcript: '', denied: true, error: 'Microphone permission denied' };
        }
        return { transcript: '', error: 'Could not open the microphone' };
      }
    }
    return new Promise<{ transcript: string; error?: string; denied?: boolean }>((resolve) => {
      const rec = new SpeechRecognitionCtor();
      rec.lang = opts?.lang || 'en-IN';
      rec.interimResults = false;
      rec.maxAlternatives = 1;
      const timer = window.setTimeout(() => {
        try { rec.stop(); } catch { /* ignore */ }
        resolve({ transcript: '', error: 'No speech heard — try again' });
      }, opts?.timeoutMs || 12_000);
      rec.onresult = (ev: { results?: Array<Array<{ transcript?: string }>> }) => {
        window.clearTimeout(timer);
        const text = String(ev.results?.[0]?.[0]?.transcript || '').trim();
        resolve({ transcript: text, error: text ? undefined : 'No speech heard' });
      };
      rec.onerror = (ev: { error?: string }) => {
        window.clearTimeout(timer);
        const err = String(ev.error || '');
        if (err === 'not-allowed') resolve({ transcript: '', denied: true, error: 'Microphone permission denied' });
        else if (err === 'no-speech') resolve({ transcript: '', error: 'No speech heard — try again' });
        else if (err === 'language-not-supported') resolve({ transcript: '', error: 'This language is not supported for voice' });
        else resolve({ transcript: '', error: 'Could not recognise speech' });
      };
      rec.onend = () => window.clearTimeout(timer);
      try {
        rec.start();
      } catch {
        window.clearTimeout(timer);
        resolve({ transcript: '', error: 'Could not start speech recognition' });
      }
    });
  };
  return start();
}

export async function listenVoice(opts?: { lang?: string; timeoutMs?: number }): Promise<{ transcript: string; error?: string; denied?: boolean }> {
  if (Capacitor.isNativePlatform()) {
    try {
      return await listenNative(opts);
    } catch {
      try {
        const perm = await VoiceCapture.requestPermission();
        if (!perm?.granted) {
          return { transcript: '', denied: true, error: 'Microphone permission denied' };
        }
      } catch {
        /* plugin missing on older APKs */
      }
      return listenWeb(opts, false);
    }
  }
  return listenWeb(opts, true);
}

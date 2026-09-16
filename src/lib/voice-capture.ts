import { toPaise } from './money-core';
import { guessedMerchant } from './bridge-automations';

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

const SpeechRecognitionCtor: (new () => any) | null = (() => {
  if (typeof window === 'undefined') return null;
  const w = window as any;
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
})();

export function voiceSupported() {
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
  const guessed = guessedMerchant(transcript) || '';
  const merchant = String(toMatch?.[1] || guessed || '').replace(/\bfrom\b.*$/i, '').trim();
  const bookHint = (transcript.match(/\bfrom\s+([A-Za-z][A-Za-z0-9 &._-]{1,40})\s*book/i)?.[1] || '').trim();
  const entryType: VoiceParse['entryType'] = /\b(received|got|income|money in|credited)\b/i.test(q)
    ? 'in'
    : /\btransfer\b/i.test(q)
      ? 'transfer'
      : 'out';
  let category = 'Uncategorized';
  if (/\bswiggy|zomato|food|lunch|dinner\b/i.test(q)) category = 'Meals';
  else if (/\buber|ola|fuel|petrol\b/i.test(q)) category = 'Travel';
  else if (/\bgrocer|dmart|blinkit\b/i.test(q)) category = 'Groceries';
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

export async function listenVoice(opts?: { lang?: string; timeoutMs?: number }): Promise<{ transcript: string; error?: string; denied?: boolean }> {
  if (!SpeechRecognitionCtor) {
    return { transcript: '', error: 'Speech recognition is not available on this device' };
  }
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

  return new Promise((resolve) => {
    const rec = new SpeechRecognitionCtor();
    rec.lang = opts?.lang || 'en-IN';
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    const timer = window.setTimeout(() => {
      try { rec.stop(); } catch { /* ignore */ }
      resolve({ transcript: '', error: 'No speech heard — try again' });
    }, opts?.timeoutMs || 12_000);
    rec.onresult = (ev) => {
      window.clearTimeout(timer);
      const text = String(ev.results?.[0]?.[0]?.transcript || '').trim();
      resolve({ transcript: text, error: text ? undefined : 'No speech heard' });
    };
    rec.onerror = (ev) => {
      window.clearTimeout(timer);
      const err = String((ev as { error?: string }).error || '');
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
}

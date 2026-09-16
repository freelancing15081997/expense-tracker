import React, { useEffect, useState } from 'react';
import { Loader2, Mic, X } from 'lucide-react';
import { listenVoice, parseVoiceLine, voiceSupported, type VoiceParse } from '../lib/voice-capture';

type Props = {
  open: boolean;
  onClose: () => void;
  onReady: (parsed: VoiceParse) => void;
  onToast: (msg: string, kind?: 'success' | 'error') => void;
};

export default function VoiceEntrySheet({ open, onClose, onReady, onToast }: Props) {
  const [busy, setBusy] = useState(false);
  const [parsed, setParsed] = useState<VoiceParse | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setBusy(false);
    setParsed(null);
    setError('');
  }, [open]);

  if (!open) return null;

  const listen = async () => {
    setBusy(true);
    setError('');
    setParsed(null);
    try {
      if (!voiceSupported()) {
        setError('Voice entry needs a device that supports speech recognition.');
        return;
      }
      const res = await listenVoice();
      if (res.denied) {
        setError(res.error || 'Microphone permission denied');
        return;
      }
      if (res.error || !res.transcript) {
        setError(res.error || 'No speech heard');
        return;
      }
      const next = parseVoiceLine(res.transcript);
      setParsed(next);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[240] flex items-end justify-center">
      <button type="button" className="absolute inset-0 bg-slate-900/45" aria-label="Close" onClick={onClose} />
      <div className="relative w-full max-w-lg rounded-t-3xl bg-white px-5 pt-4 pb-8 shadow-xl">
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-slate-200" />
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Voice</p>
            <h2 className="font-display text-[20px] font-semibold text-[#0B0F1F]">Speak an entry</h2>
            <p className="text-[13px] text-slate-500 mt-0.5">Example: Paid 850 rupees to Swiggy</p>
          </div>
          <button type="button" className="p-2 text-slate-400" onClick={onClose} aria-label="Close"><X className="w-5 h-5" /></button>
        </div>
        {error ? <p className="mt-3 text-sm text-rose-600">{error}</p> : null}
        {parsed ? (
          <div className="mt-4 space-y-2 text-sm">
            <p className="text-slate-500">â€œ{parsed.transcript}â€</p>
            <p><b>â‚¹{parsed.amount || 0}</b> Â· {parsed.entryType === 'in' ? 'Money in' : parsed.entryType === 'transfer' ? 'Transfer' : 'Money out'}</p>
            <p>{parsed.merchant || 'Merchant not heard'} Â· {parsed.category}</p>
            {parsed.confidence !== 'high' ? <p className="text-amber-700">Check this before saving â€” speech was unclear.</p> : null}
          </div>
        ) : null}
        <div className="mt-5 flex gap-2">
          <button type="button" className="byjan-btn-ghost flex-1" onClick={onClose}>Cancel</button>
          {!parsed ? (
            <button type="button" className="byjan-btn flex-1" disabled={busy} onClick={() => void listen()}>
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mic className="w-4 h-4" />}
              {busy ? 'Listeningâ€¦' : 'Start'}
            </button>
          ) : (
            <button
              type="button"
              className="byjan-btn flex-1"
              onClick={() => {
                if (!(parsed.amount > 0)) {
                  onToast('Could not hear an amount â€” edit it on the form', 'error');
                }
                onReady(parsed);
                onClose();
              }}
            >
              Review &amp; save
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

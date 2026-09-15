import React, { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Loader2, X, AlertTriangle, Check } from 'lucide-react';
import { confirmCapture } from '../lib/money-api';
import { type CapturePreview, fromPaise } from '../lib/money-core';
import { getCurrencySymbol } from '../lib/currency';

type Props = {
  open: boolean;
  preview: CapturePreview | null;
  bookId: string;
  currency?: string;
  onClose: () => void;
  onConfirmed: (expense: Record<string, unknown>) => void;
  onToast: (msg: string, kind?: 'success' | 'error') => void;
};

export default function CapturePreviewSheet({
  open,
  preview,
  bookId,
  currency = 'INR',
  onClose,
  onConfirmed,
  onToast,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<CapturePreview | null>(preview);

  React.useEffect(() => {
    setDraft(preview);
  }, [preview]);

  if (!draft) return null;

  const symbol = getCurrencySymbol(currency);
  const needsReview = draft.processingStatus === 'REVIEW_REQUIRED' || draft.confidence !== 'high';

  const confirm = async () => {
    setBusy(true);
    try {
      const expense = await confirmCapture(bookId, draft, draft.id);
      if (!expense) throw new Error('Server did not save the entry');
      onConfirmed(expense);
      onToast('Expense recorded', 'success');
      onClose();
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Could not save', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={(v) => { if (!busy && !v) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-slate-900/45 z-[120]" />
        <Dialog.Content className="record-sheet fixed inset-x-0 bottom-0 z-[130] max-h-[88vh] overflow-y-auto rounded-t-[24px] bg-white px-5 pt-4 pb-8 shadow-[0_-20px_60px_-12px_rgba(11,31,58,0.35)]">
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-slate-200" />
          <div className="flex items-start justify-between gap-3">
            <div>
              <Dialog.Title className="font-display text-[20px] font-semibold text-[#0B1F3A] tracking-[-0.03em]">
                Review before adding
              </Dialog.Title>
              <Dialog.Description className="text-[13px] text-slate-500 mt-0.5">
                Byjan parsed this — confirm before it is saved.
              </Dialog.Description>
            </div>
            <Dialog.Close className="p-2 rounded-xl text-slate-400 hover:text-slate-700" aria-label="Close">
              <X className="w-5 h-5" />
            </Dialog.Close>
          </div>

          {needsReview && (
            <div className="mt-4 flex gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-[13px] text-amber-900">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>Please check amount, merchant, and category before confirming.</span>
            </div>
          )}

          <div className="mt-4 space-y-3">
            <label className="block">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Amount</span>
              <input
                type="number"
                inputMode="decimal"
                className="byjan-input mt-1"
                value={fromPaise(draft.amountPaise) || ''}
                onChange={(e) => setDraft({ ...draft, amountPaise: Math.round(Number(e.target.value || 0) * 100) })}
              />
            </label>
            <label className="block">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Description</span>
              <input
                className="byjan-input mt-1"
                value={draft.description}
                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Category</span>
                <input
                  className="byjan-input mt-1"
                  value={draft.category || ''}
                  onChange={(e) => setDraft({ ...draft, category: e.target.value })}
                />
              </label>
              <label className="block">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Method</span>
                <select
                  className="byjan-input mt-1"
                  value={draft.paymentMethod || 'cash'}
                  onChange={(e) => setDraft({ ...draft, paymentMethod: e.target.value })}
                >
                  <option value="upi">UPI</option>
                  <option value="cash">Cash</option>
                  <option value="card">Card</option>
                  <option value="bank">Bank</option>
                  <option value="wallet">Wallet</option>
                </select>
              </label>
            </div>
          </div>

          <div className="mt-5 flex gap-2">
            <button type="button" className="byjan-btn-ghost flex-1" onClick={onClose} disabled={busy}>Cancel</button>
            <button type="button" className="byjan-btn flex-1" onClick={() => void confirm()} disabled={busy || !draft.amountPaise}>
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Add {symbol}{fromPaise(draft.amountPaise).toLocaleString()}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

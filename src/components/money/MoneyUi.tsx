import React from 'react';
import { Check, Loader2, AlertCircle, X, ChevronRight, RefreshCw, Paperclip } from 'lucide-react';
import { formatPaise } from '../../lib/money-core';
import type { ActivityEvent, MoneyContextOption, ReceiptFlowState } from '../../lib/money-flow';
import { RECEIPT_FLOW_COPY } from '../../lib/money-flow';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function MoneySheet({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[140] flex items-end sm:items-center justify-center">
      <button type="button" className="absolute inset-0 bg-[#07152a]/55 backdrop-blur-[2px]" aria-label="Close" onClick={onClose} />
      <div className="relative w-full sm:max-w-md max-h-[92dvh] overflow-hidden rounded-t-[28px] sm:rounded-[28px] bg-white shadow-[0_-24px_80px_-20px_rgba(11,31,58,0.45)] animate-money-rise">
        <div className="mx-auto mt-3 mb-1 h-1 w-10 rounded-full bg-slate-200 sm:hidden" />
        <div className="flex items-start justify-between gap-3 px-5 pt-4 pb-3 border-b border-slate-100">
          <div className="min-w-0">
            <h2 className="font-display text-[20px] font-semibold tracking-[-0.03em] text-[#0B1F3A]">{title}</h2>
            {subtitle ? <p className="text-[13px] text-slate-500 mt-0.5 leading-snug">{subtitle}</p> : null}
          </div>
          <button type="button" onClick={onClose} className="w-9 h-9 rounded-xl border border-slate-200 text-slate-400 hover:text-slate-700 inline-flex items-center justify-center" aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-5 py-4 overflow-y-auto max-h-[min(70dvh,560px)]">{children}</div>
        {footer ? <div className="px-5 py-4 border-t border-slate-100 bg-[#F8FAFC]">{footer}</div> : null}
      </div>
    </div>
  );
}

export function ReceiptFlowProgress({ state }: { state: ReceiptFlowState | string }) {
  const copy = RECEIPT_FLOW_COPY[state as ReceiptFlowState] || { title: String(state), detail: '' };
  const failed = state === 'FAILED';
  const done = state === 'COMPLETED' || state === 'CREATED';
  return (
    <div className={cn('rounded-2xl border px-4 py-3.5', failed ? 'border-rose-200 bg-rose-50' : done ? 'border-teal-200 bg-teal-50/70' : 'border-slate-200 bg-gradient-to-br from-white to-slate-50')}>
      <div className="flex items-start gap-3">
        <span className={cn('w-10 h-10 rounded-2xl inline-flex items-center justify-center shrink-0', failed ? 'bg-rose-100 text-rose-700' : done ? 'bg-teal-100 text-teal-800' : 'bg-[#0B1F3A] text-white')}>
          {failed ? <AlertCircle className="w-5 h-5" /> : done ? <Check className="w-5 h-5" /> : <Loader2 className="w-5 h-5 animate-spin" />}
        </span>
        <div className="min-w-0">
          <p className="text-[15px] font-semibold text-[#0B1F3A] tracking-[-0.02em]">{copy.title}</p>
          <p className="text-[13px] text-slate-500 mt-0.5 leading-snug">{copy.detail}</p>
        </div>
      </div>
    </div>
  );
}

export function ContextSelector({
  contexts,
  selectedId,
  onSelect,
}: {
  contexts: MoneyContextOption[];
  selectedId?: string | null;
  onSelect: (id: string) => void;
}) {
  if (!contexts.length) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-950">
        No authorized Money book yet. Create one first — your receipt stays safe and nothing was posted.
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {contexts.map((ctx) => {
        const on = selectedId === ctx.id;
        return (
          <button
            key={ctx.id}
            type="button"
            onClick={() => onSelect(ctx.id)}
            className={cn(
              'w-full text-left rounded-2xl border px-3.5 py-3 transition-all',
              on ? 'border-[#0B1F3A] bg-[#0B1F3A] text-white shadow-[0_12px_28px_-16px_rgba(11,31,58,0.7)]' : 'border-slate-200 bg-white hover:border-slate-300',
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className={cn('text-[14px] font-semibold truncate', on ? 'text-white' : 'text-[#0B1F3A]')}>{ctx.name}</p>
                <p className={cn('text-[12px] mt-0.5', on ? 'text-white/70' : 'text-slate-500')}>{ctx.reason}</p>
              </div>
              <ChevronRight className={cn('w-4 h-4 shrink-0', on ? 'text-teal-200' : 'text-slate-300')} />
            </div>
          </button>
        );
      })}
    </div>
  );
}

export function ExpenseSuccessCard({
  amountPaise,
  merchant,
  category,
  bookName,
  receiptAttached,
  symbol = '₹',
  count,
  onView,
  onSplit,
  onDone,
}: {
  amountPaise: number;
  merchant?: string;
  category?: string;
  bookName?: string;
  receiptAttached?: boolean;
  symbol?: string;
  count?: number;
  onView?: () => void;
  onSplit?: () => void;
  onDone: () => void;
}) {
  return (
    <div className="rounded-[24px] border border-teal-100 bg-gradient-to-b from-teal-50/80 to-white p-5 text-center shadow-[0_18px_40px_-24px_rgba(14,163,150,0.55)]">
      <div className="mx-auto w-12 h-12 rounded-full bg-teal-500 text-white inline-flex items-center justify-center shadow-lg shadow-teal-500/30">
        <Check className="w-6 h-6" strokeWidth={2.5} />
      </div>
      <p className="mt-3 text-[13px] font-semibold uppercase tracking-[0.14em] text-teal-700">
        {count && count > 1 ? `${count} entries added` : 'Expense added'}
      </p>
      <p className="mt-1 font-display text-[34px] font-semibold tracking-[-0.04em] text-[#0B1F3A]">{formatPaise(amountPaise, symbol)}</p>
      <div className="mt-4 space-y-1.5 text-[13px] text-slate-600">
        {merchant ? <p className="font-medium text-[#0B1F3A]">{merchant}</p> : null}
        {category ? <p>{category}</p> : null}
        {bookName ? <p className="text-slate-500">Money · {bookName}</p> : null}
        {receiptAttached ? (
          <p className="inline-flex items-center gap-1.5 text-teal-800 justify-center">
            <Paperclip className="w-3.5 h-3.5" /> Receipt attached
          </p>
        ) : null}
      </div>
      <div className="mt-5 flex flex-col gap-2">
        {onSplit ? (
          <button
            type="button"
            onClick={onSplit}
            className="w-full h-12 rounded-2xl bg-gradient-to-b from-[#16325a] to-[#0B1F3A] text-white text-[13px] font-semibold shadow-[0_14px_28px_-14px_rgba(11,31,58,0.9),inset_0_1px_0_rgba(255,255,255,0.18)]"
          >
            Split with team
          </button>
        ) : null}
        <div className="flex gap-2">
          {onView ? (
            <button type="button" onClick={onView} className="flex-1 h-11 rounded-xl border border-slate-200 bg-white text-[13px] font-semibold text-[#0B1F3A]">
              View
            </button>
          ) : null}
          <button type="button" onClick={onDone} className="flex-1 h-11 rounded-xl border border-slate-200 bg-white text-[13px] font-semibold text-[#0B1F3A]">
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

export function ExpenseErrorCard({
  onRetry,
  onViewReceipt,
}: {
  onRetry?: () => void;
  onViewReceipt?: () => void;
}) {
  return (
    <div className="rounded-[24px] border border-rose-100 bg-rose-50/60 p-5 text-center">
      <div className="mx-auto w-12 h-12 rounded-full bg-rose-100 text-rose-700 inline-flex items-center justify-center">
        <AlertCircle className="w-6 h-6" />
      </div>
      <p className="mt-3 font-display text-[18px] font-semibold text-[#0B1F3A]">We couldn’t finish this receipt.</p>
      <p className="mt-1 text-[13px] text-slate-600 leading-relaxed">Your receipt is safe. Nothing was added twice.</p>
      <div className="mt-5 flex gap-2">
        {onRetry ? (
          <button type="button" onClick={onRetry} className="flex-1 h-11 rounded-xl bg-[#0B1F3A] text-white text-[13px] font-semibold inline-flex items-center justify-center gap-2">
            <RefreshCw className="w-4 h-4" /> Try again
          </button>
        ) : null}
        {onViewReceipt ? (
          <button type="button" onClick={onViewReceipt} className="flex-1 h-11 rounded-xl border border-slate-200 bg-white text-[13px] font-semibold text-[#0B1F3A]">
            View receipt
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function ActivityTimeline({ events }: { events: ActivityEvent[] }) {
  if (!events.length) {
    return <p className="text-[13px] text-slate-500 px-1">No activity yet for this expense.</p>;
  }
  return (
    <ol className="relative space-y-0 pl-1">
      {events.map((ev, i) => (
        <li key={ev.id} className="relative flex gap-3 pb-4 last:pb-0">
          {i < events.length - 1 ? <span className="absolute left-[9px] top-5 bottom-0 w-px bg-slate-200" /> : null}
          <span className="relative z-[1] mt-1 w-[18px] h-[18px] rounded-full border-2 border-teal-400 bg-white shrink-0" />
          <div className="min-w-0 pt-0.5">
            <p className="text-[13px] font-semibold text-[#0B1F3A] capitalize">{ev.title}</p>
            {ev.detail ? <p className="text-[12px] text-slate-500 mt-0.5 leading-snug">{ev.detail}</p> : null}
            <p className="text-[11px] text-slate-400 mt-1">{new Date(ev.at).toLocaleString()}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

export function SoftToast({ message }: { message: string }) {
  return (
    <div className="pointer-events-none fixed left-1/2 bottom-[calc(5.75rem+env(safe-area-inset-bottom))] z-[160] -translate-x-1/2 px-4 w-full max-w-sm">
      <div className="rounded-2xl bg-[#0B1F3A] text-white text-[13px] font-semibold px-4 py-3 shadow-2xl shadow-slate-900/35 border border-white/10 text-center tracking-[-0.01em]">
        {message}
      </div>
    </div>
  );
}

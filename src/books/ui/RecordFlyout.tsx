import React from 'react';
import { X } from 'lucide-react';

export default function RecordFlyout({
  title,
  subtitle,
  onClose,
  actions,
  children,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <>
      <div className="fixed inset-0 z-[70] bg-[#0B1F3A]/25 backdrop-blur-[2px]" onClick={onClose} />
      <aside className="fixed inset-y-0 right-0 z-[75] w-full max-w-[480px] bg-white border-l border-slate-200 shadow-[-18px_0_48px_-24px_rgba(11,31,58,0.35)] flex flex-col">
        <header className="shrink-0 px-5 py-4 border-b border-slate-200 flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-[17px] font-semibold text-[#0B1F3A] truncate">{title}</h2>
            {subtitle && <p className="text-xs text-slate-500 mt-0.5 truncate">{subtitle}</p>}
          </div>
          {actions}
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl border border-slate-200 bg-white text-slate-500 hover:text-[#0B1F3A] hover:bg-slate-50 flex items-center justify-center shrink-0"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </header>
        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-4">{children}</div>
      </aside>
    </>
  );
}

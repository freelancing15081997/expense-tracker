import React, { createContext, useContext } from 'react';
import { formatMoney } from '../core/money';

const ShellCtx = createContext(false);
export function BooksPageMode({ embedded, children }: { embedded: boolean; children: React.ReactNode }) {
  return <ShellCtx.Provider value={embedded}>{children}</ShellCtx.Provider>;
}
export function useBooksEmbedded() {
  return useContext(ShellCtx);
}

export function PageShell({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  const embedded = useBooksEmbedded();
  return (
    <div className="space-y-5">
      {!embedded && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="font-display text-[28px] font-semibold tracking-tight text-[#161411]">{title}</h1>
            {subtitle && <p className="text-sm text-[#6b6458] mt-1 leading-relaxed">{subtitle}</p>}
          </div>
          {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
        </div>
      )}
      {embedded && actions && <div className="flex flex-wrap justify-end gap-2">{actions}</div>}
      {children}
    </div>
  );
}

export const Card: React.FC<{ children?: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <div className={`bg-white border border-[#E5E7EB] rounded-2xl shadow-[0_1px_0_rgba(11,31,58,0.04)] ${className}`}>{children}</div>
);

export function Money({ minor, currency }: { minor: number; currency: string }) {
  return <span className="tabular-nums font-medium tracking-tight">{formatMoney(minor, currency)}</span>;
}

export function Status({ value }: { value: string }) {
  const tone: Record<string, string> = {
    posted: 'bg-emerald-50 text-emerald-800 ring-emerald-100',
    paid: 'bg-emerald-50 text-emerald-800 ring-emerald-100',
    draft: 'bg-amber-50 text-amber-900 ring-amber-100',
    reversed: 'bg-[#f3efe6] text-[#6b6458] ring-[#e6e0d4]',
    voided: 'bg-rose-50 text-rose-800 ring-rose-100',
    open: 'bg-sky-50 text-sky-800 ring-sky-100',
    closed: 'bg-[#f3efe6] text-[#6b6458] ring-[#e6e0d4]',
    active: 'bg-emerald-50 text-emerald-800 ring-emerald-100',
    disposed: 'bg-[#f3efe6] text-[#6b6458] ring-[#e6e0d4]',
    pending: 'bg-amber-50 text-amber-900 ring-amber-100',
    approved: 'bg-emerald-50 text-emerald-800 ring-emerald-100',
    rejected: 'bg-rose-50 text-rose-800 ring-rose-100',
    reviewed: 'bg-emerald-50 text-emerald-800 ring-emerald-100',
    linked: 'bg-[#f3efe6] text-[#6b6458] ring-[#e6e0d4]',
    reconciled: 'bg-emerald-50 text-emerald-800 ring-emerald-100',
    overdue: 'bg-rose-50 text-rose-800 ring-rose-100',
    ok: 'bg-emerald-50 text-emerald-800 ring-emerald-100',
    review: 'bg-amber-50 text-amber-900 ring-amber-100',
  };
  return <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-[0.12em] ring-1 ${tone[value] || 'bg-[#f3efe6] text-[#6b6458] ring-[#e6e0d4]'}`}>{value}</span>;
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="block text-[#5c564c] font-medium mb-1.5">{label}</span>
      {children}
    </label>
  );
}

export function FileField({
  label,
  hint,
  accept,
  multiple,
  onFiles,
}: {
  label: string;
  hint?: string;
  accept?: string;
  multiple?: boolean;
  onFiles: (files: File[]) => void;
}) {
  return (
    <Field label={label}>
      <input
        type="file"
        accept={accept}
        multiple={multiple}
        className="block w-full text-sm file:mr-3 file:px-3 file:py-1.5 file:rounded-lg file:border-0 file:bg-[#0B1F3A] file:text-white file:text-xs"
        onChange={(e) => {
          onFiles(Array.from(e.target.files || []));
          e.target.value = '';
        }}
      />
      {hint && <p className="text-xs text-[#6B7280] mt-1">{hint}</p>}
    </Field>
  );
}

export const inputClass = 'w-full border border-[#E5E7EB] rounded-xl px-3 py-2.5 text-sm text-[#0B1F3A] focus:outline-none focus:ring-2 focus:ring-[#12B8A8]/25 focus:border-[#12B8A8] bg-white';
export const btnPrimary = 'px-3.5 py-2 rounded-xl bg-[#0B1F3A] text-white text-sm font-medium hover:bg-[#07152a] disabled:opacity-50 transition-colors';
export const btnGhost = 'px-3.5 py-2 rounded-xl border border-[#E5E7EB] text-[#0B1F3A] text-sm font-medium hover:bg-[#F3F4F6] disabled:opacity-50 transition-colors';
export const btnAccent = 'px-3.5 py-2 rounded-xl bg-[#12B8A8] text-white text-sm font-medium hover:bg-[#0ea396] disabled:opacity-50 transition-colors';

export function Empty({ text }: { text: string }) {
  return <div className="px-5 py-14 text-center text-sm text-[#7a7368]">{text}</div>;
}

export const Kpi: React.FC<{ label: string; children?: React.ReactNode }> = ({ label, children }) => (
  <Card className="p-4">
    <p className="text-[10px] uppercase tracking-[0.16em] text-[#7a7368] font-semibold">{label}</p>
    <div className="mt-2 text-[22px] font-display text-[#161411]">{children}</div>
  </Card>
);

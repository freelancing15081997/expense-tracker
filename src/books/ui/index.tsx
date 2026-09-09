import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { formatMoney } from '../core/money';
import { ActionIcon, FeatureIcon, fileGlyph, type BooksGlyphName } from './icons';

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
  const location = useLocation();
  return (
    <div className="space-y-5">
      {!embedded && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="font-display text-[28px] font-semibold tracking-tight text-[#0B1F3A] flex items-center gap-2.5">
              <FeatureIcon href={location.pathname} className="w-7 h-7 shrink-0" />
              {title}
            </h1>
            {subtitle && <p className="text-sm text-slate-500 mt-1 leading-relaxed">{subtitle}</p>}
          </div>
          {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
        </div>
      )}
      {embedded && actions && <div className="flex flex-wrap justify-end gap-2">{actions}</div>}
      {children}
    </div>
  );
}

export const Card: React.FC<{ children?: React.ReactNode; className?: string; lift?: boolean }> = ({ children, className = '', lift = false }) => (
  <div className={`byjan-card ${lift ? 'byjan-lift' : ''} ${className}`}>{children}</div>
);

export function Money({ minor, currency }: { minor: number; currency: string }) {
  return <span className="tabular-nums font-medium tracking-tight">{formatMoney(minor, currency)}</span>;
}

export function Status({ value }: { value: string }) {
  const tone: Record<string, string> = {
    posted: 'bg-emerald-50 text-emerald-800 ring-emerald-100',
    paid: 'bg-emerald-50 text-emerald-800 ring-emerald-100',
    draft: 'bg-amber-50 text-amber-900 ring-amber-100',
    reversed: 'bg-slate-100 text-slate-600 ring-slate-200',
    voided: 'bg-rose-50 text-rose-800 ring-rose-100',
    open: 'bg-sky-50 text-sky-800 ring-sky-100',
    closed: 'bg-slate-100 text-slate-600 ring-slate-200',
    active: 'bg-emerald-50 text-emerald-800 ring-emerald-100',
    disposed: 'bg-slate-100 text-slate-600 ring-slate-200',
    pending: 'bg-amber-50 text-amber-900 ring-amber-100',
    approved: 'bg-emerald-50 text-emerald-800 ring-emerald-100',
    rejected: 'bg-rose-50 text-rose-800 ring-rose-100',
    reviewed: 'bg-emerald-50 text-emerald-800 ring-emerald-100',
    linked: 'bg-slate-100 text-slate-600 ring-slate-200',
    reconciled: 'bg-emerald-50 text-emerald-800 ring-emerald-100',
    overdue: 'bg-rose-50 text-rose-800 ring-rose-100',
    ok: 'bg-emerald-50 text-emerald-800 ring-emerald-100',
    review: 'bg-amber-50 text-amber-900 ring-amber-100',
  };
  return <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-[0.12em] ring-1 ${tone[value] || 'bg-slate-100 text-slate-600 ring-slate-200'}`}>{value}</span>;
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="block text-slate-600 font-medium mb-1.5">{label}</span>
      {children}
    </label>
  );
}

export const inputClass = 'byjan-input';
export const btnPrimary = 'byjan-btn disabled:opacity-50';
export const btnGhost = 'byjan-btn-ghost disabled:opacity-50';
export const btnAccent = 'byjan-btn-accent disabled:opacity-50';

export function FileField({
  label,
  hint,
  accept,
  multiple,
  files,
  onFiles,
}: {
  label: string;
  hint?: string;
  accept?: string;
  multiple?: boolean;
  files?: File[] | File | null;
  onFiles: (files: File[]) => void;
}) {
  const picked = Array.isArray(files) ? files : files ? [files] : [];
  const [internal, setInternal] = useState<File[]>([]);
  const shown = files === undefined ? internal : picked;
  const previewKey = shown.map((file) => `${file.name}:${file.size}:${file.lastModified}`).join('|');
  const previews = useMemo(
    () => shown.map((file) => ({ file, url: file.type.startsWith('image/') ? URL.createObjectURL(file) : '' })),
    // previewKey uniquely identifies the selected files
    [previewKey],
  );

  useEffect(() => {
    return () => {
      previews.forEach((item) => {
        if (item.url) URL.revokeObjectURL(item.url);
      });
    };
  }, [previews]);

  return (
    <Field label={label}>
      <div className="flex items-center gap-2 flex-wrap">
        <input
          type="file"
          accept={accept}
          multiple={multiple}
          className="block min-w-0 flex-1 text-sm file:mr-3 file:px-3 file:py-1.5 file:rounded-lg file:border-0 file:bg-[#0B1F3A] file:text-white file:text-xs"
          onChange={(e) => {
            const next: File[] = e.target.files ? Array.from(e.target.files) : [];
            if (files === undefined) setInternal(next);
            onFiles(next);
            e.target.value = '';
          }}
        />
        {previews.map((item, index) => (
          <span
            key={`${item.file.name}-${index}`}
            className="w-9 h-9 rounded-lg border border-slate-200 bg-white overflow-hidden shrink-0 flex items-center justify-center shadow-[0_1px_2px_rgba(11,31,58,0.08)]"
            title={item.file.name}
          >
            {item.url ? (
              <img src={item.url} alt="" className="w-full h-full object-cover" />
            ) : (
              <ActionIcon name={fileGlyph(item.file)} className="w-4 h-4" />
            )}
          </span>
        ))}
      </div>
      {hint && <p className="text-xs text-[#6B7280] mt-1">{hint}</p>}
    </Field>
  );
}

export function IconBtn({
  action = 'create',
  variant = 'primary',
  children,
  className = '',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { action?: BooksGlyphName; variant?: 'primary' | 'ghost' }) {
  const cls = variant === 'ghost' ? btnGhost : btnPrimary;
  return (
    <button className={`${cls} ${className}`} {...props}>
      <ActionIcon name={action} className="w-3.5 h-3.5 shrink-0" />
      {children}
    </button>
  );
}

export { FeatureIcon, ActionIcon, GroupIcon } from './icons';
export { BooksLoader } from './BooksLoader';

export function Empty({ text }: { text: string }) {
  return <div className="px-5 py-14 text-center text-sm text-slate-500">{text}</div>;
}

export const Kpi: React.FC<{ label: string; children?: React.ReactNode }> = ({ label, children }) => (
  <Card className="p-4" lift>
    <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500 font-semibold">{label}</p>
    <div className="mt-2 text-[22px] font-display text-[#0B1F3A]">{children}</div>
  </Card>
);

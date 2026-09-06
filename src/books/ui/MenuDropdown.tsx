import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';

export type MenuItem = {
  id: string;
  label: string;
  hint?: string;
  icon?: React.ReactNode;
  suffix?: React.ReactNode;
  onSelect: () => void;
  danger?: boolean;
};

export function MenuDropdown({
  triggerLabel,
  triggerHint,
  header,
  items,
  footer,
}: {
  triggerLabel: string;
  triggerHint?: string;
  header?: { title: string; subtitle: string; mark?: React.ReactNode };
  items: MenuItem[];
  footer?: MenuItem;
}) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  return (
    <div className="relative" ref={box}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="min-w-[220px] w-full flex items-center justify-between gap-3 rounded-2xl border border-[#E5E7EB] bg-white px-4 py-2.5 text-left shadow-sm hover:border-[#0B1F3A]/20 transition-colors"
      >
        <span>
          <span className="block text-sm font-semibold text-[#0B1F3A]">{triggerLabel}</span>
          {triggerHint && <span className="block text-xs text-[#6B7280] mt-0.5">{triggerHint}</span>}
        </span>
        <ChevronDown className={`w-4 h-4 text-[#6B7280] transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>
      <div className={`absolute z-40 left-0 right-0 mt-2 origin-top transition-all duration-200 ${open ? 'opacity-100 translate-y-0 visible' : 'opacity-0 -translate-y-1 invisible'}`}>
        <div className="rounded-[22px] bg-white border border-[#E5E5E5] shadow-[0_18px_50px_rgba(11,31,58,0.12)] overflow-hidden">
          {header && (
            <div className="flex items-center justify-between gap-3 px-5 pt-5 pb-4">
              <div className="min-w-0">
                <p className="font-semibold text-[#111827] truncate">{header.title}</p>
                <p className="text-sm text-[#6B7280] truncate">{header.subtitle}</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-[#F3F4F6] text-[#0B1F3A] flex items-center justify-center shrink-0 overflow-hidden">
                {header.mark || <span className="text-sm font-bold">{header.title.slice(0, 1)}</span>}
              </div>
            </div>
          )}
          {header && <div className="h-px bg-[#EFEFEF] mx-4" />}
          <div className="p-2.5 space-y-0.5 max-h-80 overflow-y-auto">
            {items.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  item.onSelect();
                  setOpen(false);
                }}
                className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm text-[#111827] hover:bg-[#F3F4F6] transition-colors"
              >
                {item.icon && <span className="text-[#374151]">{item.icon}</span>}
                <span className="flex-1 text-left">
                  <span className="block">{item.label}</span>
                  {item.hint && <span className="block text-xs text-[#6B7280]">{item.hint}</span>}
                </span>
                {item.suffix}
              </button>
            ))}
          </div>
          {footer && (
            <>
              <div className="h-px bg-[#EFEFEF] mx-4" />
              <div className="p-2.5">
                <button
                  type="button"
                  onClick={() => {
                    footer.onSelect();
                    setOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm hover:bg-[#F3F4F6] transition-colors ${footer.danger ? 'text-rose-700' : 'text-[#111827]'}`}
                >
                  {footer.icon}
                  {footer.label}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { addMonths, format, isSameDay, isSameMonth, parseISO, startOfMonth } from 'date-fns';
import { formatDisplayDate } from '../../lib/app-prefs';

function daysInGrid(month: Date) {
  const start = startOfMonth(month);
  const weekday = start.getDay();
  const first = new Date(start);
  first.setDate(1 - weekday);
  return Array.from({ length: 42 }, (_, i) => {
    const day = new Date(first);
    day.setDate(first.getDate() + i);
    return day;
  });
}

export function DateField({
  value,
  onChange,
  required,
}: {
  value: string;
  onChange: (iso: string) => void;
  required?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const selected = value ? parseISO(value) : new Date();
  const [month, setMonth] = useState(startOfMonth(selected));
  const box = useRef<HTMLDivElement>(null);
  const days = useMemo(() => daysInGrid(month), [month]);

  useEffect(() => {
    if (value) setMonth(startOfMonth(parseISO(value)));
  }, [value]);

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
        className="byjan-input text-left flex items-center justify-between"
        onClick={() => setOpen((v) => !v)}
      >
        <span>{value ? formatDisplayDate(value) : 'Select date'}</span>
        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Date</span>
      </button>
      {required && <input type="hidden" value={value} required />}
      {open && (
        <div className="absolute z-50 mt-2 w-[280px] rounded-2xl border border-[#E5E7EB] bg-white p-3 shadow-[0_18px_40px_-20px_rgba(11,31,58,0.35)]">
          <div className="flex items-center justify-between mb-2">
            <button type="button" className="p-1 rounded-lg hover:bg-slate-100" onClick={() => setMonth(addMonths(month, -1))} aria-label="Previous month">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <p className="text-sm font-semibold text-[#0B1F3A]">{format(month, 'MMMM yyyy')}</p>
            <button type="button" className="p-1 rounded-lg hover:bg-slate-100" onClick={() => setMonth(addMonths(month, 1))} aria-label="Next month">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400 text-center mb-1">
            {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => <span key={d}>{d}</span>)}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {days.map((day) => {
              const iso = format(day, 'yyyy-MM-dd');
              const active = value && isSameDay(day, selected);
              const inMonth = isSameMonth(day, month);
              return (
                <button
                  key={iso}
                  type="button"
                  onClick={() => {
                    onChange(iso);
                    setOpen(false);
                  }}
                  className={`h-8 rounded-lg text-xs ${
                    active ? 'bg-[#0B1F3A] text-white font-semibold' : inMonth ? 'text-[#0B1F3A] hover:bg-slate-100' : 'text-slate-300'
                  }`}
                >
                  {day.getDate()}
                </button>
              );
            })}
          </div>
          <div className="flex justify-end mt-2">
            <button
              type="button"
              className="text-xs font-semibold text-teal-700 hover:underline"
              onClick={() => {
                onChange(format(new Date(), 'yyyy-MM-dd'));
                setOpen(false);
              }}
            >
              Today
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

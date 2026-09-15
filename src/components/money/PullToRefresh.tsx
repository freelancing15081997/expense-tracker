import React, { useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';

type Props = {
  onRefresh: () => Promise<void> | void;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
};

/**
 * Mobile-first pull-to-refresh. Desktop mouse drag ignored.
 * Only activates when scrollTop === 0.
 */
export default function PullToRefresh({ onRefresh, children, className, disabled }: Props) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const startY = useRef(0);
  const pulling = useRef(false);
  const [offset, setOffset] = useState(0);
  const [busy, setBusy] = useState(false);

  const onTouchStart = (e: React.TouchEvent) => {
    if (disabled || busy) return;
    const el = scrollerRef.current;
    if (!el || el.scrollTop > 0) return;
    startY.current = e.touches[0].clientY;
    pulling.current = true;
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (!pulling.current || busy || disabled) return;
    const el = scrollerRef.current;
    if (!el || el.scrollTop > 0) {
      pulling.current = false;
      setOffset(0);
      return;
    }
    const dy = e.touches[0].clientY - startY.current;
    if (dy > 0) {
      setOffset(Math.min(72, dy * 0.45));
    } else {
      setOffset(0);
    }
  };

  const onTouchEnd = async () => {
    if (!pulling.current) return;
    pulling.current = false;
    if (offset >= 56 && !busy) {
      setBusy(true);
      setOffset(48);
      try {
        await onRefresh();
      } finally {
        setBusy(false);
        setOffset(0);
      }
      return;
    }
    setOffset(0);
  };

  return (
    <div
      ref={scrollerRef}
      className={className || 'h-full overflow-y-auto overscroll-contain'}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={() => { void onTouchEnd(); }}
    >
      <div
        className="flex items-center justify-center text-slate-400 transition-[height] duration-150 overflow-hidden"
        style={{ height: offset || (busy ? 48 : 0) }}
        aria-hidden={!busy && offset < 8}
      >
        <Loader2 className={`w-5 h-5 ${busy || offset >= 56 ? 'animate-spin text-teal-600' : ''}`} />
      </div>
      {children}
    </div>
  );
}

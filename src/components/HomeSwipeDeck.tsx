import React, { useEffect, useRef, useState } from 'react';

type HomeSwipeDeckProps = {
  count: number;
  index: number;
  onIndex: (next: number) => void;
  children: React.ReactNode;
  className?: string;
  label: string;
  intervalMs?: number;
};

export default function HomeSwipeDeck({
  count,
  index,
  onIndex,
  children,
  className = '',
  label,
  intervalMs = 4200,
}: HomeSwipeDeckProps) {
  const paused = useRef(false);
  const startX = useRef(0);
  const swiping = useRef(false);
  const [drag, setDrag] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const [stack, setStack] = useState(() => typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches);

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    const sync = () => setStack(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  useEffect(() => {
    if (stack || count <= 1) return undefined;
    const tick = () => {
      if (paused.current || document.visibilityState !== 'visible') return;
      onIndex((index + 1) % count);
    };
    const id = window.setInterval(tick, intervalMs);
    const onVis = () => { if (document.visibilityState !== 'visible') paused.current = true; };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [stack, count, index, intervalMs, onIndex]);

  const endPointer = (event: React.PointerEvent<HTMLDivElement>) => {
    if (stack) return;
    try {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    } catch { /* ignore */ }
    const dx = event.clientX - startX.current;
    setDrag(0);
    setIsSwiping(false);
    if (count > 1) {
      if (dx <= -48) onIndex((index + 1) % count);
      else if (dx >= 48) onIndex((index - 1 + count) % count);
    }
    window.setTimeout(() => {
      paused.current = false;
      swiping.current = false;
    }, 5000);
  };

  return (
    <div className={`home-swipe${stack ? ' is-stack' : ''}${className ? ` ${className}` : ''}`} aria-label={label} aria-roledescription={stack ? 'list' : 'carousel'}>
      <div
        className="home-swipe-viewport"
        onPointerDown={(event) => {
          if (stack || count <= 1) return;
          paused.current = true;
          swiping.current = false;
          setIsSwiping(false);
          startX.current = event.clientX;
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          if (stack || count <= 1 || !event.currentTarget.hasPointerCapture(event.pointerId)) return;
          const dx = event.clientX - startX.current;
          if (Math.abs(dx) > 8) {
            swiping.current = true;
            setIsSwiping(true);
          }
          setDrag(dx);
        }}
        onPointerUp={endPointer}
        onPointerCancel={endPointer}
        onClickCapture={(event) => {
          if (!swiping.current && !isSwiping) return;
          event.preventDefault();
          event.stopPropagation();
          swiping.current = false;
          setIsSwiping(false);
        }}
      >
        <div
          className="home-swipe-track"
          data-swiping={isSwiping ? '1' : undefined}
          style={stack ? undefined : {
            transform: `translateX(calc(${-index * 100}% + ${drag}px))`,
            transition: drag ? 'none' : undefined,
          }}
        >
          {children}
        </div>
      </div>
      {!stack && count > 1 ? (
        <div className="home-swipe-dots" role="tablist" aria-label={`${label} pages`}>
          {Array.from({ length: count }, (_, i) => (
            <button
              key={i}
              type="button"
              role="tab"
              aria-selected={i === index}
              aria-label={`Show ${i + 1} of ${count}`}
              className={`home-swipe-dot${i === index ? ' is-on' : ''}`}
              onClick={() => {
                paused.current = true;
                onIndex(i);
                window.setTimeout(() => { paused.current = false; }, 5000);
              }}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

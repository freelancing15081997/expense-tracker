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

  useEffect(() => {
    if (count <= 1) return undefined;
    const id = window.setInterval(() => {
      if (paused.current) return;
      onIndex((index + 1) % count);
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [count, index, intervalMs, onIndex]);

  const go = (dir: number) => {
    if (count <= 1) return;
    const next = (index + dir + count) % count;
    onIndex(next);
  };

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (count <= 1) return;
    paused.current = true;
    swiping.current = false;
    startX.current = event.clientX;
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (count <= 1 || !event.currentTarget.hasPointerCapture(event.pointerId)) return;
    const dx = event.clientX - startX.current;
    if (Math.abs(dx) > 8) swiping.current = true;
    setDrag(dx);
  };

  const onPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (count <= 1) {
      paused.current = false;
      return;
    }
    const dx = event.clientX - startX.current;
    setDrag(0);
    if (dx <= -48) go(1);
    else if (dx >= 48) go(-1);
    window.setTimeout(() => { paused.current = false; }, 5000);
  };

  return (
    <div className={`home-swipe ${className}`.trim()} aria-label={label} aria-roledescription="carousel">
      <div
        className="home-swipe-viewport"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onClickCapture={(event) => {
          if (!swiping.current) return;
          event.preventDefault();
          event.stopPropagation();
          swiping.current = false;
        }}
        onPointerCancel={() => { setDrag(0); window.setTimeout(() => { paused.current = false; }, 5000); }}
      >
        <div
          className="home-swipe-track"
          data-swiping={swiping.current ? '1' : undefined}
          style={{
            transform: `translateX(calc(${-index * 100}% + ${drag}px))`,
            transition: drag ? 'none' : undefined,
          }}
        >
          {children}
        </div>
      </div>
      {count > 1 ? (
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

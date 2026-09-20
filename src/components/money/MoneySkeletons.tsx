import React from 'react';

/** Lightweight skeleton blocks for Money screens — no layout jump. */
export function Skel({ className = '' }: { className?: string }) {
  return <span className={`byjan-skel inline-block ${className}`.trim()} aria-hidden />;
}

export function MoneyBookListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Loading money books">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="rounded-2xl border border-slate-200/80 bg-white p-4">
          <div className="flex items-center gap-3">
            <Skel className="w-11 h-11 rounded-xl" />
            <div className="flex-1 space-y-2">
              <Skel className="h-4 w-2/5 rounded-md" />
              <Skel className="h-3 w-1/4 rounded-md" />
            </div>
            <Skel className="h-5 w-16 rounded-md" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function MoneyBookScreenSkeleton() {
  return (
    <div className="h-full min-h-0 overflow-hidden px-4 md:px-6 py-3" aria-busy="true" aria-label="Opening money book">
      <div className="max-w-6xl mx-auto space-y-4">
        <div className="flex items-center gap-3">
          <Skel className="w-9 h-9 rounded-xl" />
          <div className="flex-1 space-y-2">
            <Skel className="h-5 w-40 rounded-md" />
            <Skel className="h-3 w-24 rounded-md" />
          </div>
          <Skel className="h-10 w-28 rounded-full" />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Skel className="h-20 rounded-2xl" />
          <Skel className="h-20 rounded-2xl" />
          <Skel className="h-20 rounded-2xl" />
        </div>
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-2xl border border-slate-200/80 bg-white px-4 py-3 flex items-center gap-3">
              <Skel className="w-10 h-10 rounded-xl" />
              <div className="flex-1 space-y-2">
                <Skel className="h-3.5 w-1/2 rounded-md" />
                <Skel className="h-3 w-1/3 rounded-md" />
              </div>
              <Skel className="h-4 w-14 rounded-md" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function MoneyFeedSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="rounded-2xl border border-slate-200/80 bg-white px-4 py-3 flex items-center gap-3">
          <Skel className="w-10 h-10 rounded-xl shrink-0" />
          <div className="flex-1 space-y-2 min-w-0">
            <Skel className="h-3.5 w-3/5 rounded-md" />
            <Skel className="h-3 w-2/5 rounded-md" />
          </div>
          <Skel className="h-4 w-16 rounded-md shrink-0" />
        </div>
      ))}
    </div>
  );
}

export function MoneyAttentionSkeleton() {
  return (
    <div className="home-attention-skel" aria-busy="true" aria-label="Loading attention">
      <div className="byjan-skel byjan-skel-block h-20 rounded-2xl w-full" />
      <div className="byjan-skel byjan-skel-block h-20 rounded-2xl w-full" />
    </div>
  );
}

import React from 'react';

export default function AppLoader({
  message = 'Loading',
  title,
  overlay = false,
}: {
  message?: string;
  title?: string;
  overlay?: boolean;
}) {
  const heading = title || message;
  const detail = title ? message : 'Preparing your workspace.';
  const body = (
    <div className="flex flex-col items-center justify-center gap-5 text-center" role="status" aria-live="polite">
      <span className="app-loader-stage" aria-hidden>
        <span className="app-loader-halo" />
        <span className="app-loader-ring-a" />
        <span className="app-loader-ring-b" />
        <span className="app-loader-core" />
      </span>
      <div className="space-y-1.5 max-w-xs">
        <p className="font-display text-[15px] font-semibold tracking-tight text-[#0B1F3A]">{heading}</p>
        <p className="text-xs text-slate-500 leading-relaxed">{detail}</p>
      </div>
    </div>
  );
  if (overlay) {
    return (
      <div className="fixed inset-0 z-[9999] bg-[#F5F7FA]/80 backdrop-blur-sm flex items-center justify-center">
        <div className="bg-white border border-[#E6EAF0] rounded-2xl px-10 py-8 min-w-[220px] shadow-[0_24px_48px_-28px_rgba(11,31,58,0.45)]">
          {body}
        </div>
      </div>
    );
  }
  return <div className="flex items-center justify-center min-h-[32vh]">{body}</div>;
}

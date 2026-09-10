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
    <div className="flex flex-col items-center justify-center gap-4 text-center" role="status" aria-live="polite">
      <span className="app-loader-mark" aria-hidden>
        <span className="app-loader-orbit" />
        <span className="font-display text-lg font-semibold tracking-tight">B</span>
      </span>
      <div className="space-y-1 max-w-xs">
        <p className="text-sm font-semibold text-[#0B1F3A]">{heading}</p>
        <p className="text-xs text-slate-500 leading-relaxed">{detail}</p>
      </div>
    </div>
  );
  if (overlay) {
    return (
      <div className="fixed inset-0 z-[9999] bg-slate-900/30 backdrop-blur-[2px] flex items-center justify-center">
        <div className="bg-white rounded-2xl border border-slate-200 px-10 py-8 min-w-[240px]">
          {body}
        </div>
      </div>
    );
  }
  return <div className="flex items-center justify-center min-h-[40vh]">{body}</div>;
}

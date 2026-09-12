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
        <span className="app-loader-mark">
          <span className="app-loader-orbit" />
          <span className="app-loader-orbit-rev" />
          <span className="font-display text-lg font-semibold tracking-tight">B</span>
        </span>
        <span className="app-loader-book">
          <span className="app-loader-book-back" />
          <span className="app-loader-book-page app-loader-book-page-b" />
          <span className="app-loader-book-page app-loader-book-page-a" />
          <span className="app-loader-book-cover" />
          <span className="app-loader-book-spine" />
        </span>
      </span>
      <div className="space-y-2 max-w-xs">
        <p className="text-sm font-semibold text-[#0B1F3A] tracking-tight">{heading}</p>
        <p className="text-xs text-slate-500 leading-relaxed">{detail}</p>
        <span className="app-loader-track" aria-hidden>
          <span className="app-loader-bar" />
        </span>
      </div>
    </div>
  );
  if (overlay) {
    return (
      <div className="fixed inset-0 z-[9999] bg-slate-900/20 backdrop-blur-md flex items-center justify-center">
        <div className="byjan-card px-10 py-8 min-w-[240px]">
          {body}
        </div>
      </div>
    );
  }
  return <div className="flex items-center justify-center min-h-[36vh]">{body}</div>;
}

import React from 'react';

export default function AppLoader({
  message = 'Loading',
  overlay = false,
}: {
  message?: string;
  overlay?: boolean;
}) {
  const body = (
    <div className="flex flex-col items-center justify-center gap-3" role="status" aria-live="polite">
      <span className="app-loader-ring" />
      <p className="text-sm font-medium text-slate-600">{message}</p>
    </div>
  );
  if (overlay) {
    return (
      <div className="fixed inset-0 z-[9999] bg-slate-900/40 backdrop-blur-[2px] flex items-center justify-center">
        <div className="bg-white rounded-2xl border border-slate-200 px-8 py-7 shadow-[0_18px_40px_-20px_rgba(11,31,58,0.4)]">
          {body}
        </div>
      </div>
    );
  }
  return <div className="flex items-center justify-center min-h-[40vh]">{body}</div>;
}

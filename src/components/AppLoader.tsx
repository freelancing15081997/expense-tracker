import React from 'react';
import BrandLogo from './BrandLogo';

export default function AppLoader({
  message = 'Loading',
  title,
  overlay = false,
}: {
  message?: string;
  title?: string;
  overlay?: boolean;
}) {
  const heading = title || 'Byjan';
  const detail = title ? message : message || 'Preparing your workspace.';
  const body = (
    <div className="flex flex-col items-center justify-center gap-5 text-center" role="status" aria-live="polite">
      <div className="relative">
        <span className="absolute inset-[-18px] rounded-[28px] bg-[radial-gradient(circle,rgba(54,84,255,0.28),transparent_68%)]" aria-hidden />
        <BrandLogo size="md" className="relative shadow-none" />
      </div>
      <div className="space-y-1.5 max-w-xs">
        <p className="font-display text-[18px] font-semibold tracking-tight text-[#0B0F1F]">{heading}</p>
        <p className="text-xs text-slate-500 leading-relaxed">{detail}</p>
      </div>
      <span className="app-loader-ios" aria-hidden />
    </div>
  );
  if (overlay) {
    return (
      <div className="fixed inset-0 z-[9999] bg-[#3654FF] flex items-center justify-center">
        <div className="flex flex-col items-center gap-5 px-8">
          <BrandLogo size="lg" className="!w-[148px] !h-[176px] bg-white/95" />
          <p className="font-display text-white text-lg font-semibold tracking-tight">Byjan</p>
          <p className="text-[12px] text-white/70">Trace Financials Easily</p>
          <span className="app-loader-ios app-loader-ios-light" aria-hidden />
        </div>
      </div>
    );
  }
  return <div className="flex items-center justify-center min-h-[32vh]">{body}</div>;
}

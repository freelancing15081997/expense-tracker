import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Capacitor } from '@capacitor/core';
import { X, Download, FileText, CheckCircle2, ExternalLink } from 'lucide-react';
import { openNativeFilePreview } from '../lib/receipt-preview';

export type AttachmentKind = 'image' | 'pdf' | 'file';

export function attachmentKind(name = '', type = ''): AttachmentKind {
  const t = String(type || '').toLowerCase();
  const n = String(name || '').toLowerCase();
  if (t.startsWith('image/') || /\.(png|jpe?g|gif|webp|svg)$/i.test(n)) return 'image';
  if (t.includes('pdf') || n.endsWith('.pdf')) return 'pdf';
  return 'file';
}

interface Props {
  imageUrl: string | null;
  expenseTitle?: string;
  onClose: () => void;
  verified?: boolean;
  loading?: boolean;
  kind?: AttachmentKind;
  fileName?: string;
}

export const ReceiptModal: React.FC<Props> = ({
  imageUrl,
  expenseTitle,
  onClose,
  verified = true,
  loading = false,
  kind = 'image',
  fileName,
}) => {
  const [imageReady, setImageReady] = useState(false);
  const [openingNativePdf, setOpeningNativePdf] = useState(false);
  const isNative = Capacitor.isNativePlatform();

  useEffect(() => {
    setImageReady(false);
    setOpeningNativePdf(false);
  }, [imageUrl]);

  // Lock body scroll + Escape Escape while open (portal escapes transformed ancestors).
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const prevOverflow = document.body.style.overflow;
    const prevTouch = document.body.style.touchAction;
    document.body.style.overflow = 'hidden';
    document.body.style.touchAction = 'none';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.body.style.touchAction = prevTouch;
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  if (!loading && !imageUrl) return null;

  const showLoader = loading || (kind === 'image' && Boolean(imageUrl) && !imageReady);
  const downloadName = fileName || expenseTitle || `attachment-${Date.now()}`;

  const handleDownload = () => {
    if (!imageUrl) return;
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = downloadName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleOpenPdf = async () => {
    if (!imageUrl || openingNativePdf) return;
    setOpeningNativePdf(true);
    try {
      const opened = await openNativeFilePreview(imageUrl, downloadName);
      if (!opened && !isNative) handleDownload();
    } finally {
      setOpeningNativePdf(false);
    }
  };

  const node = (
    <div
      id="receipt-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={loading ? 'Opening attachment' : 'Attachment preview'}
      className="receipt-modal-root"
      onClick={onClose}
    >
      <div
        id="receipt-modal-content"
        className="receipt-modal-sheet"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="receipt-modal-head">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="receipt-modal-icon">
              <FileText className="w-4.5 h-4.5" />
            </span>
            <div className="min-w-0">
              <h3 className="font-semibold text-sm tracking-tight">
                {loading ? 'Opening attachment' : 'Attachment'}
              </h3>
              {expenseTitle && (
                <p className="text-[11px] text-slate-400 truncate max-w-[14rem] sm:max-w-xs">
                  {expenseTitle}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {imageUrl && (
              <button
                id="btn-download-receipt"
                type="button"
                onClick={handleDownload}
                className="receipt-modal-action"
                title="Download"
              >
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">Save</span>
              </button>
            )}
            <button
              id="btn-close-receipt-modal"
              type="button"
              onClick={onClose}
              className="receipt-modal-action"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="receipt-modal-body">
          {showLoader && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-[#F4F6FA]/95">
              <span className="app-loader-ring" />
              <p className="text-sm font-semibold text-slate-600">Opening attachment…</p>
            </div>
          )}
          {kind === 'image' && imageUrl && (
            <div className="receipt-modal-frame">
              <img
                src={imageUrl}
                alt={expenseTitle || 'Attachment'}
                className="receipt-modal-img"
                referrerPolicy="no-referrer"
                onLoad={() => setImageReady(true)}
                onError={() => setImageReady(true)}
              />
            </div>
          )}
          {kind === 'pdf' && imageUrl && !loading && (
            <div className="w-full space-y-3">
              {isNative ? (
                <div className="text-center space-y-4 py-8">
                  <FileText className="w-12 h-12 text-slate-400 mx-auto" />
                  <p className="text-sm text-slate-600">PDF receipts open in your device viewer.</p>
                  <button type="button" onClick={() => void handleOpenPdf()} disabled={openingNativePdf} className="byjan-btn">
                    <ExternalLink className="w-4 h-4" />
                    {openingNativePdf ? 'Opening…' : 'Open PDF'}
                  </button>
                </div>
              ) : (
                <>
                  <object
                    data={imageUrl}
                    type="application/pdf"
                    title={expenseTitle || 'PDF attachment'}
                    className="w-full h-[min(62vh,520px)] rounded-xl bg-white border border-slate-200"
                  >
                    <iframe
                      src={imageUrl}
                      title={expenseTitle || 'PDF attachment'}
                      className="w-full h-[min(62vh,520px)] rounded-xl bg-white border border-slate-200"
                    />
                  </object>
                  <div className="flex justify-center">
                    <button type="button" onClick={handleDownload} className="byjan-btn-ghost text-xs">
                      <Download className="w-4 h-4" />
                      Download PDF
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
          {kind === 'file' && imageUrl && !loading && (
            <div className="text-center space-y-3 py-8">
              <FileText className="w-12 h-12 text-slate-400 mx-auto" />
              <p className="text-sm text-slate-600">This file opens in your device viewer.</p>
              {isNative ? (
                <button type="button" onClick={() => void handleOpenPdf()} disabled={openingNativePdf} className="byjan-btn">
                  <ExternalLink className="w-4 h-4" />
                  {openingNativePdf ? 'Opening…' : `Open ${fileName || 'file'}`}
                </button>
              ) : (
                <button type="button" onClick={handleDownload} className="byjan-btn">
                  <Download className="w-4 h-4" />
                  Download {fileName || 'file'}
                </button>
              )}
            </div>
          )}
        </div>

        <div className="receipt-modal-foot">
          <div className={`flex items-center gap-1.5 font-medium ${verified ? 'text-emerald-600' : 'text-slate-500'}`}>
            {verified && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
            <span>{loading ? 'Fetching file' : verified ? 'Verified proof' : 'Stored attachment'}</span>
          </div>
          <button type="button" onClick={onClose} className="receipt-modal-close-btn">
            Close
          </button>
        </div>
      </div>
    </div>
  );

  if (typeof document === 'undefined') return node;
  return createPortal(node, document.body);
};

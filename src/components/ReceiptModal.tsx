import React, { useEffect, useState } from 'react';
import { X, Download, FileText, CheckCircle2 } from 'lucide-react';

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

  useEffect(() => {
    setImageReady(false);
  }, [imageUrl]);

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

  return (
    <div
      id="receipt-modal-backdrop"
      className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        id="receipt-modal-content"
        className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3.5 bg-slate-900 text-white border-b border-slate-800">
          <div className="flex items-center gap-2.5 min-w-0">
            <FileText className="w-5 h-5 text-emerald-400 shrink-0" />
            <div className="min-w-0">
              <h3 className="font-semibold text-sm">{loading ? 'Opening attachment' : 'Attachment'}</h3>
              {expenseTitle && <p className="text-xs text-slate-400 truncate max-w-xs">{expenseTitle}</p>}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {imageUrl && (
              <button
                id="btn-download-receipt"
                type="button"
                onClick={handleDownload}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs flex items-center gap-1"
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
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-4 overflow-auto flex items-center justify-center bg-slate-100 min-h-[300px] relative">
          {showLoader && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-slate-100">
              <span className="app-loader-ring" />
              <p className="text-sm font-semibold text-slate-600">Opening attachment…</p>
            </div>
          )}
          {kind === 'image' && imageUrl && (
            <div className="bg-white p-2 rounded-xl shadow-lg border border-slate-200 max-w-full">
              <img
                src={imageUrl}
                alt={expenseTitle || 'Attachment'}
                className="max-h-[60vh] max-w-full object-contain rounded-lg"
                referrerPolicy="no-referrer"
                onLoad={() => setImageReady(true)}
                onError={() => setImageReady(true)}
              />
            </div>
          )}
          {kind === 'pdf' && imageUrl && !loading && (
            <iframe
              src={imageUrl}
              title={expenseTitle || 'PDF attachment'}
              className="w-full h-[62vh] rounded-lg bg-white border border-slate-200"
            />
          )}
          {kind === 'file' && imageUrl && !loading && (
            <div className="text-center space-y-3">
              <p className="text-sm text-slate-600">This file cannot be previewed here.</p>
              <button type="button" onClick={handleDownload} className="byjan-btn">
                <Download className="w-4 h-4" />
                Download {fileName || 'file'}
              </button>
            </div>
          )}
        </div>

        <div className="px-5 py-3 bg-white border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
          <div className={`flex items-center gap-1.5 font-medium ${verified ? 'text-emerald-600' : 'text-slate-500'}`}>
            {verified && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
            <span>{loading ? 'Fetching file' : verified ? 'Verified proof' : 'Stored attachment'}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 bg-slate-50 hover:bg-slate-100 font-semibold text-slate-700 rounded-lg border border-slate-200"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

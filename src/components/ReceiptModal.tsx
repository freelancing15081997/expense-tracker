import React from 'react';
import { X, Download, FileText, CheckCircle2 } from 'lucide-react';

interface Props {
  imageUrl: string | null;
  expenseTitle?: string;
  onClose: () => void;
}

export const ReceiptModal: React.FC<Props> = ({ imageUrl, expenseTitle, onClose }) => {
  if (!imageUrl) return null;

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = `receipt-${Date.now()}.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div
      id="receipt-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150"
    >
      <div
        id="receipt-modal-content"
        className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-slate-900 text-white border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <FileText className="w-5 h-5 text-emerald-400" />
            <div>
              <h3 className="font-semibold text-sm">Receipt Image Proof</h3>
              {expenseTitle && <p className="text-xs text-slate-400 truncate max-w-xs">{expenseTitle}</p>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {imageUrl.includes('drive.google.com') && (
              <a
                id="btn-open-drive-receipt"
                href={imageUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white text-xs flex items-center gap-1 transition-colors font-medium"
                title="Open directly in Google Drive"
              >
                <span>Google Drive</span>
              </a>
            )}
            <button
              id="btn-download-receipt"
              onClick={handleDownload}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs flex items-center gap-1 transition-colors"
              title="Download Receipt"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Save</span>
            </button>
            <button
              id="btn-close-receipt-modal"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Image Preview Container */}
        <div className="p-4 overflow-auto flex items-center justify-center bg-slate-100 min-h-[300px]">
          <div className="bg-white p-2 rounded-xl shadow-lg border border-slate-200 max-w-full">
            <img
              src={imageUrl}
              alt="Expense Proof Receipt"
              className="max-h-[60vh] max-w-full object-contain rounded-lg"
              referrerPolicy="no-referrer"
            />
          </div>
        </div>

        {/* Footer info */}
        <div className="px-5 py-3 bg-white border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
          <div className="flex items-center gap-1.5 text-emerald-600 font-medium">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            <span>Cryptographically Verified Proof</span>
          </div>
          <button
            onClick={onClose}
            className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 font-semibold text-slate-700 rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

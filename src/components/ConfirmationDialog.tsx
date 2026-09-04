import React from 'react';
import { AlertCircle, CheckCircle2, AlertTriangle, X, Mail } from 'lucide-react';
import { ConfirmationModalState } from '../types';

interface Props {
  state: ConfirmationModalState;
}

export const ConfirmationDialog: React.FC<Props> = ({ state }) => {
  if (!state.isOpen) return null;

  const getIcon = () => {
    switch (state.actionType) {
      case 'DELETE':
        return <AlertTriangle className="w-6 h-6 text-rose-600" />;
      case 'EDIT':
        return <AlertCircle className="w-6 h-6 text-amber-600" />;
      case 'ADD':
      default:
        return <CheckCircle2 className="w-6 h-6 text-emerald-600" />;
    }
  };

  const getHeaderBg = () => {
    switch (state.actionType) {
      case 'DELETE':
        return 'bg-rose-50 text-rose-900 border-rose-100';
      case 'EDIT':
        return 'bg-amber-50 text-amber-900 border-amber-100';
      case 'ADD':
      default:
        return 'bg-emerald-50 text-emerald-900 border-emerald-100';
    }
  };

  const getConfirmButtonClass = () => {
    switch (state.actionType) {
      case 'DELETE':
        return 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-200';
      case 'EDIT':
        return 'bg-amber-600 hover:bg-amber-700 text-white shadow-amber-200';
      case 'ADD':
      default:
        return 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-200';
    }
  };

  return (
    <div
      id="sheet-confirmation-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
    >
      <div
        id="sheet-confirmation-card"
        className="w-full max-w-lg bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden transform scale-100 transition-all"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className={`flex items-start justify-between px-6 py-4 border-b ${getHeaderBg()}`}>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/80 rounded-lg shadow-xs">
              {getIcon()}
            </div>
            <div>
              <h3 className="font-bold text-lg leading-snug">{state.title}</h3>
              <p className="text-xs opacity-80">Google Sheet In-Cell Action Confirmation</p>
            </div>
          </div>
          <button
            id="btn-close-confirmation"
            onClick={state.onCancel}
            className="p-1 rounded-md text-slate-500 hover:text-slate-800 hover:bg-black/5 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-5 space-y-4">
          <p className="text-sm text-slate-700 font-medium">
            {state.description}
          </p>

          {/* Details breakdown if provided */}
          {state.details && (
            <div className="bg-slate-50 rounded-lg p-3.5 border border-slate-200 text-xs space-y-2">
              {state.details.field && (
                <div className="flex justify-between items-center py-1 border-b border-slate-200">
                  <span className="text-slate-700 font-semibold">Target Field:</span>
                  <span className="font-mono bg-white px-2 py-0.5 rounded border border-slate-200 text-slate-800 font-bold">
                    {state.details.field}
                  </span>
                </div>
              )}

              {state.details.oldValue !== undefined && state.details.newValue !== undefined && (
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div className="bg-rose-50/70 p-2 rounded border border-rose-100">
                    <span className="text-rose-700 block font-semibold mb-1">Previous:</span>
                    <span className="font-mono text-slate-700 line-through break-all block">
                      {String(state.details.oldValue || '—')}
                    </span>
                  </div>
                  <div className="bg-emerald-50/70 p-2 rounded border border-emerald-100">
                    <span className="text-emerald-700 block font-semibold mb-1">New Value:</span>
                    <span className="font-mono text-emerald-900 font-bold break-all block">
                      {String(state.details.newValue || '—')}
                    </span>
                  </div>
                </div>
              )}

              {state.details.summary && (
                <div className="text-slate-600 font-medium pt-1">
                  {state.details.summary}
                </div>
              )}
            </div>
          )}

          {/* Email alert notification disclosure */}
          <div className="flex items-start gap-2.5 bg-blue-50/70 border border-blue-100 rounded-lg p-3 text-xs text-blue-800">
            <Mail className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold">Automatic Mail Broadcast:</span> Upon your confirmation, an instant notification alert will be dispatched to all configured emails in the spreadsheet list.
            </div>
          </div>
        </div>

        {/* Footer Buttons */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 bg-slate-50 border-t border-slate-100">
          <button
            id="btn-cancel-confirmation"
            type="button"
            onClick={state.onCancel}
            className="px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-200/60 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            id="btn-confirm-confirmation"
            type="button"
            onClick={state.onConfirm}
            className={`px-5 py-2 text-sm font-bold rounded-lg shadow-sm transition-all transform active:scale-95 ${getConfirmButtonClass()}`}
          >
            {state.actionType === 'DELETE' ? 'Yes, Delete Record' : state.actionType === 'EDIT' ? 'Save & Notify Team' : 'Confirm & Add Entry'}
          </button>
        </div>
      </div>
    </div>
  );
};

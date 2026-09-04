import React, { useState } from 'react';
import { 
  X, 
  Code2, 
  Copy, 
  Check, 
  Sparkles, 
  ExternalLink, 
  Clock, 
  Bell, 
  FileSpreadsheet,
  CheckCircle2
} from 'lucide-react';
import { GOOGLE_APPS_SCRIPT_CODE } from '../services/googleAppsScriptGenerator';
import { SpreadsheetInfo } from '../services/googleSheetsService';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  spreadsheetInfo: SpreadsheetInfo | null;
}

export const AppsScriptModal: React.FC<Props> = ({
  isOpen,
  onClose,
  spreadsheetInfo,
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(GOOGLE_APPS_SCRIPT_CODE);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-2xl w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-700 px-5 py-4 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-white/15 backdrop-blur-xs">
              <Code2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-base leading-tight">Google Sheets Native In-Sheet Automation</h3>
              <p className="text-emerald-100 text-xs">Run confirmation alerts & monthly emails directly inside Google Sheets</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-emerald-100 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 overflow-y-auto text-xs flex-1">
            {/* Overview */}
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 space-y-1.5 text-emerald-900">
            <div className="flex items-center gap-2 font-bold text-xs">
              <Sparkles className="w-4 h-4 text-emerald-600" />
              <span>Turn Google Sheets into your primary standalone App Interface</span>
            </div>
            <p className="text-[11px] text-emerald-800 leading-relaxed">
              Your roommates do not need to use any external web app. By adding this script to your Google Sheet, Google Sheets gets an <strong>In-Sheet App Sidebar</strong> with interactive forms, live KPI cards, and an <strong>Automated Alert Engine</strong> that immediately emails all active roommates whenever ANY user adds or edits an expense directly in Google Sheets!
            </p>
          </div>

          {/* Quick Setup Steps */}
          <div className="border border-slate-200 rounded-xl p-3.5 bg-slate-50 space-y-2.5">
            <span className="font-bold text-slate-800 text-xs block">2-Minute Setup to Make Google Sheet Your Primary App:</span>
            <ol className="space-y-2 text-slate-600 text-[11px] list-decimal list-inside">
              <li>
                Open your Google Sheet {spreadsheetInfo && (
                  <a
                    href={spreadsheetInfo.spreadsheetUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-bold text-emerald-600 hover:underline ml-1"
                  >
                    <span>({spreadsheetInfo.title})</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </li>
              <li>
                In Google Sheets top menu, click <strong>Extensions</strong> → <strong>Apps Script</strong>.
              </li>
              <li>
                Clear any existing code in the editor, click <strong>Copy Script Code</strong> below, paste it in, and click <strong>Save (💾)</strong>.
              </li>
              <li>
                Refresh your Google Sheet tab. A new top menu <strong>"✨ Expense App"</strong> appears!
              </li>
              <li>
                Click <strong>"✨ Expense App"</strong> → <strong>"🔔 Enable 1-Click Auto Email Notifications"</strong> (grant one-time permission). Now, any edit or addition by ANY roommate in the sheet automatically sends email alerts to all configured mails!
              </li>
              <li>
                Click <strong>"✨ Expense App"</strong> → <strong>"📱 Open In-Sheet App Sidebar"</strong> for the modern mobile/desktop in-sheet app!
              </li>
            </ol>
          </div>

          {/* Features Included in the Script */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
            <div className="p-2.5 rounded-lg border border-slate-200 bg-white space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-slate-800">
                <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                <span>📱 In-Sheet App Sidebar</span>
              </div>
              <p className="text-slate-500">
                A modern app UI inside Google Sheets with category chips, live spend metrics, and 1-click expense logger.
              </p>
            </div>

            <div className="p-2.5 rounded-lg border border-slate-200 bg-white space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-slate-800">
                <Bell className="w-3.5 h-3.5 text-emerald-600" />
                <span>🔔 Automated Edit & Add Alerts</span>
              </div>
              <p className="text-slate-500">
                Whenever anyone types or edits in the sheet, instant email alerts are automatically dispatched to configured emails.
              </p>
            </div>

            <div className="p-2.5 rounded-lg border border-slate-200 bg-white space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-slate-800">
                <Clock className="w-3.5 h-3.5 text-blue-600" />
                <span>📅 Monthly Automated Digest</span>
              </div>
              <p className="text-slate-500">
                Dispatches monthly financial breakdown to all roommates on the 1st of every month automatically.
              </p>
            </div>

            <div className="p-2.5 rounded-lg border border-slate-200 bg-white space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-slate-800">
                <CheckCircle2 className="w-3.5 h-3.5 text-teal-600" />
                <span>📊 Live Dashboard Formulas</span>
              </div>
              <p className="text-slate-500">
                Calculates total group spending, monthly spend, and per-roommate splits in real time without third-party servers.
              </p>
            </div>
          </div>

          {/* Code Viewer & Copy Button */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-700 text-xs">Google Apps Script Code (Code.gs)</span>
              <button
                onClick={handleCopyCode}
                className="flex items-center gap-1.5 px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all shadow-2xs cursor-pointer"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-200" />
                    <span>Copied to Clipboard!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy Script Code</span>
                  </>
                )}
              </button>
            </div>

            <div className="relative">
              <pre className="p-3.5 bg-slate-900 text-emerald-400 rounded-xl text-[11px] font-mono overflow-x-auto max-h-56 border border-slate-800 leading-relaxed selection:bg-emerald-600 selection:text-white">
                {GOOGLE_APPS_SCRIPT_CODE}
              </pre>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-50 px-5 py-3 border-t border-slate-200 flex items-center justify-between shrink-0">
          {spreadsheetInfo && (
            <a
              href={spreadsheetInfo.spreadsheetUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-emerald-700 hover:text-emerald-800 font-bold text-xs"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Open Sheet in Google Sheets</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
          <button
            onClick={onClose}
            className="px-4 py-1.5 border border-slate-300 text-slate-700 hover:bg-slate-100 font-bold rounded-lg text-xs transition-colors ml-auto"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

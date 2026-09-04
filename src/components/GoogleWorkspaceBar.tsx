import React, { useState } from 'react';
import { 
  FileSpreadsheet, 
  ExternalLink, 
  RefreshCw, 
  HardDrive, 
  Mail, 
  CheckCircle2, 
  LogOut, 
  PlusCircle, 
  Link as LinkIcon, 
  Loader2,
  AlertCircle,
  UserPlus,
  Code2,
  Sparkles
} from 'lucide-react';
import { User } from 'firebase/auth';
import { SpreadsheetInfo } from '../services/googleSheetsService';

interface Props {
  user: User | null;
  spreadsheetInfo: SpreadsheetInfo | null;
  isLoggingIn: boolean;
  isSyncing: boolean;
  onLogin: () => void;
  onLogout: () => void;
  onCreateSpreadsheet: () => void;
  onConnectExistingSpreadsheet: (sheetId: string) => void;
  onSyncToSheets: () => void;
  onPullFromSheets: () => void;
  onApplyAppTemplate?: () => void;
  onOpenInviteRoommates?: () => void;
  onOpenAppsScript?: () => void;
}

export const GoogleWorkspaceBar: React.FC<Props> = ({
  user,
  spreadsheetInfo,
  isLoggingIn,
  isSyncing,
  onLogin,
  onLogout,
  onCreateSpreadsheet,
  onConnectExistingSpreadsheet,
  onSyncToSheets,
  onPullFromSheets,
  onApplyAppTemplate,
  onOpenInviteRoommates,
  onOpenAppsScript,
}) => {
  const [isLinkingOpen, setIsLinkingOpen] = useState(false);
  const [existingIdInput, setExistingIdInput] = useState('');

  const handleLinkSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!existingIdInput.trim()) return;
    
    // Support either full URL or raw ID
    let cleanedId = existingIdInput.trim();
    const urlMatch = cleanedId.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (urlMatch) {
      cleanedId = urlMatch[1];
    }
    
    onConnectExistingSpreadsheet(cleanedId);
    setIsLinkingOpen(false);
    setExistingIdInput('');
  };

  return (
    <div className="bg-white border-b border-slate-200 px-3 sm:px-6 py-2.5 shadow-2xs">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs">
        {/* Left: Authentication / Identity */}
        <div className="flex items-center gap-3 flex-wrap">
          {!user ? (
            <div className="flex items-center gap-2.5 flex-wrap">
              <button
                id="btn-google-sign-in"
                onClick={onLogin}
                disabled={isLoggingIn}
                className="gsi-material-button shadow-2xs hover:shadow-xs"
              >
                <div className="gsi-material-button-state"></div>
                <div className="gsi-material-button-content-wrapper">
                  <div className="gsi-material-button-icon">
                    <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" style={{ display: 'block' }}>
                      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                      <path fill="none" d="M0 0h48v48H0z"></path>
                    </svg>
                  </div>
                  <span className="gsi-material-button-contents">
                    {isLoggingIn ? 'Connecting to Google...' : 'Sign in with Google'}
                  </span>
                </div>
              </button>

              <span className="text-[11px] text-slate-500">
                Connect your Google account to sync with real Google Sheets, save receipts to Drive, and send Gmail alerts.
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2.5 flex-wrap">
              {/* User Avatar & Email */}
              <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-full pl-1 pr-3 py-1">
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt={user.displayName || 'User'}
                    className="w-6 h-6 rounded-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-emerald-700 text-white font-bold flex items-center justify-center text-[10px]">
                    {user.displayName?.charAt(0) || user.email?.charAt(0) || 'U'}
                  </div>
                )}
                <div className="flex flex-col">
                  <span className="font-bold text-slate-800 text-[11px] leading-tight">
                    {user.displayName || user.email?.split('@')[0]}
                  </span>
                  <span className="text-[10px] text-slate-500 leading-none">
                    {user.email}
                  </span>
                </div>
              </div>

              {/* Status Badges */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <HardDrive className="w-3 h-3" />
                  Drive Receipts
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-50 text-red-700 border border-red-200">
                  <Mail className="w-3 h-3" />
                  Gmail Alerts
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Right: Google Sheet Integration Details */}
        {user && (
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            {spreadsheetInfo ? (
              <div className="flex items-center gap-2 flex-wrap">
                {/* Linked Sheet Link */}
                <a
                  id="link-open-google-sheet"
                  href={spreadsheetInfo.spreadsheetUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-lg text-xs font-semibold transition-colors shadow-2xs"
                  title="Open live Google Spreadsheet in Google Docs"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="max-w-[140px] truncate">{spreadsheetInfo.title}</span>
                  <ExternalLink className="w-3 h-3 text-emerald-600" />
                </a>

                {/* Push to Sheets button */}
                <button
                  id="btn-sync-to-google-sheet"
                  onClick={onSyncToSheets}
                  disabled={isSyncing}
                  className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-300 rounded-lg text-slate-700 text-xs font-medium transition-colors"
                  title="Push all expenses and configured emails to Google Sheet"
                >
                  <RefreshCw className={`w-3 h-3 text-slate-600 ${isSyncing ? 'animate-spin' : ''}`} />
                  <span>Sync to Sheet</span>
                </button>

                {/* Pull from Sheets button */}
                <button
                  id="btn-pull-from-google-sheet"
                  onClick={onPullFromSheets}
                  disabled={isSyncing}
                  className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-300 rounded-lg text-slate-700 text-xs font-medium transition-colors"
                  title="Pull latest rows from Google Sheet into local view"
                >
                  <span>Pull Data</span>
                </button>

                {/* Apply Modern App Template button */}
                {onApplyAppTemplate && (
                  <button
                    id="btn-apply-app-template"
                    onClick={onApplyAppTemplate}
                    disabled={isSyncing}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-300 rounded-lg text-xs font-bold transition-all shadow-2xs"
                    title="Apply modern App Dashboard, KPI metric cards, dropdowns, and checkboxes directly to Google Sheets"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-teal-600" />
                    <span>Apply App Template</span>
                  </button>
                )}

                {/* Invite Roommate directly in Google Sheets */}
                {onOpenInviteRoommates && (
                  <button
                    id="btn-invite-roommates-sheets"
                    onClick={onOpenInviteRoommates}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all shadow-2xs"
                    title="Invite roommate via Google Drive to edit directly in Google Sheets"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>Invite Roommates</span>
                  </button>
                )}

                {/* Standalone Google Apps Script Automation Guide */}
                {onOpenAppsScript && (
                  <button
                    id="btn-apps-script-guide"
                    onClick={onOpenAppsScript}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-bold transition-colors"
                    title="Get Google Apps Script code for native in-sheet popups and monthly email triggers"
                  >
                    <Code2 className="w-3.5 h-3.5 text-indigo-600" />
                    <span>In-Sheet Automation</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  id="btn-create-google-sheet"
                  onClick={onCreateSpreadsheet}
                  disabled={isSyncing}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors shadow-2xs"
                >
                  {isSyncing ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <PlusCircle className="w-3.5 h-3.5" />
                  )}
                  <span>Create Google Sheet</span>
                </button>

                <button
                  id="btn-link-existing-sheet"
                  onClick={() => setIsLinkingOpen(true)}
                  className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-300 rounded-lg text-slate-700 text-xs font-medium transition-colors"
                >
                  <LinkIcon className="w-3 h-3 text-slate-500" />
                  <span>Link Existing</span>
                </button>
              </div>
            )}

            {/* Logout button */}
            <button
              id="btn-google-sign-out"
              onClick={onLogout}
              className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors"
              title="Sign Out from Google Workspace"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Link Existing Sheet Modal */}
      {isLinkingOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl border border-slate-200">
            <h3 className="text-sm font-bold text-slate-900 mb-1 flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              Link Existing Google Spreadsheet
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Paste the Google Spreadsheet URL or Spreadsheet ID from your browser address bar.
            </p>
            <form onSubmit={handleLinkSubmit} className="space-y-3">
              <div>
                <input
                  type="text"
                  value={existingIdInput}
                  onChange={(e) => setExistingIdInput(e.target.value)}
                  placeholder="https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5n.../edit"
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-emerald-500 font-mono"
                  autoFocus
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsLinkingOpen(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!existingIdInput.trim()}
                  className="px-4 py-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg disabled:opacity-50"
                >
                  Connect Spreadsheet
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

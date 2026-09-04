import React, { useState, useEffect } from 'react';
import { 
  X, 
  UserPlus, 
  Send, 
  CheckCircle2, 
  AlertCircle, 
  ExternalLink, 
  ShieldCheck, 
  FileSpreadsheet,
  Users,
  Loader2
} from 'lucide-react';
import { shareSpreadsheetWithRoommate, listSpreadsheetCollaborators } from '../services/googleDriveService';
import { SpreadsheetInfo } from '../services/googleSheetsService';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  spreadsheetInfo: SpreadsheetInfo | null;
  onRoommateInvited?: (email: string, role: string) => void;
}

export const InviteRoommateModal: React.FC<Props> = ({
  isOpen,
  onClose,
  spreadsheetInfo,
  onRoommateInvited,
}) => {
  const [emailInput, setEmailInput] = useState('');
  const [role, setRole] = useState<'writer' | 'reader'>('writer');
  const [isSending, setIsSending] = useState(false);
  const [resultMessage, setResultMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [collaborators, setCollaborators] = useState<Array<{ id: string; displayName?: string; emailAddress?: string; role: string }>>([]);
  const [isLoadingCollabs, setIsLoadingCollabs] = useState(false);

  useEffect(() => {
    if (isOpen && spreadsheetInfo) {
      loadCollaborators();
    }
  }, [isOpen, spreadsheetInfo]);

  const loadCollaborators = async () => {
    if (!spreadsheetInfo) return;
    setIsLoadingCollabs(true);
    try {
      const list = await listSpreadsheetCollaborators(spreadsheetInfo.spreadsheetId);
      setCollaborators(list);
    } catch {
      // Ignored
    } finally {
      setIsLoadingCollabs(false);
    }
  };

  if (!isOpen) return null;

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput.trim() || !spreadsheetInfo) return;

    setIsSending(true);
    setResultMessage(null);

    try {
      const res = await shareSpreadsheetWithRoommate(spreadsheetInfo.spreadsheetId, emailInput.trim(), role);
      if (res.success) {
        setResultMessage({
          type: 'success',
          text: `Official Google Sheet invitation sent to ${emailInput}! They will receive an email from Google Drive to open and collaborate directly.`,
        });
        if (onRoommateInvited) {
          onRoommateInvited(emailInput.trim(), role);
        }
        setEmailInput('');
        loadCollaborators();
      } else {
        setResultMessage({
          type: 'error',
          text: res.error || 'Failed to send invitation.',
        });
      }
    } catch (err: any) {
      setResultMessage({
        type: 'error',
        text: err.message || 'Error communicating with Google Drive API.',
      });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-600 to-teal-700 px-5 py-4 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-white/15 backdrop-blur-xs">
              <UserPlus className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-base leading-tight">Invite Roommate to Google Sheet</h3>
              <p className="text-emerald-100 text-xs">Direct Google Drive permissions & email invite</p>
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
        <div className="p-5 space-y-4 text-xs">
          {spreadsheetInfo ? (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-start gap-2.5">
              <FileSpreadsheet className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <span className="font-bold text-emerald-950 text-xs block truncate">{spreadsheetInfo.title}</span>
                <span className="text-[11px] text-emerald-700 block">
                  Invited roommates can open this sheet directly at docs.google.com/spreadsheets or inside the Google Sheets mobile app!
                </span>
                <a
                  href={spreadsheetInfo.spreadsheetUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 hover:underline mt-1"
                >
                  <span>Open Sheet in new tab</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          ) : (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center gap-2 text-amber-800">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>Please create or link your Google Spreadsheet first before inviting collaborators.</span>
            </div>
          )}

          {/* Invitation Form */}
          <form onSubmit={handleSendInvite} className="space-y-3">
            <div>
              <label className="block font-bold text-slate-700 text-xs mb-1">
                Roommate's Google Email
              </label>
              <input
                type="email"
                required
                placeholder="roommate@gmail.com"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                disabled={!spreadsheetInfo || isSending}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-hidden disabled:bg-slate-100"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 text-xs mb-1">
                Google Sheets Permission Level
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label className={`flex items-start gap-2 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                  role === 'writer' ? 'border-emerald-600 bg-emerald-50/50' : 'border-slate-200 hover:bg-slate-50'
                }`}>
                  <input
                    type="radio"
                    name="permissionRole"
                    value="writer"
                    checked={role === 'writer'}
                    onChange={() => setRole('writer')}
                    className="mt-0.5 text-emerald-600 focus:ring-emerald-500"
                  />
                  <div>
                    <span className="font-bold text-slate-900 block text-xs">Editor (Full Access)</span>
                    <span className="text-[10px] text-slate-500">Can view, add & edit expenses directly in the sheet</span>
                  </div>
                </label>

                <label className={`flex items-start gap-2 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                  role === 'reader' ? 'border-emerald-600 bg-emerald-50/50' : 'border-slate-200 hover:bg-slate-50'
                }`}>
                  <input
                    type="radio"
                    name="permissionRole"
                    value="reader"
                    checked={role === 'reader'}
                    onChange={() => setRole('reader')}
                    className="mt-0.5 text-emerald-600 focus:ring-emerald-500"
                  />
                  <div>
                    <span className="font-bold text-slate-900 block text-xs">Viewer (Read-Only)</span>
                    <span className="text-[10px] text-slate-500">Can view budget charts & logs but cannot edit cells</span>
                  </div>
                </label>
              </div>
            </div>

            {/* How it works info */}
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 flex items-start gap-2 text-[11px] text-slate-600">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>
                <strong>How it works:</strong> Google Drive sends an official notification email to your roommate with a button to accept and open the Google Sheet directly.
              </span>
            </div>

            {resultMessage && (
              <div className={`p-3 rounded-lg flex items-start gap-2 text-xs ${
                resultMessage.type === 'success'
                  ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                  : 'bg-red-50 border border-red-200 text-red-800'
              }`}>
                {resultMessage.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                )}
                <span>{resultMessage.text}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={!spreadsheetInfo || isSending || !emailInput.trim()}
              className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs flex items-center justify-center gap-2 shadow-xs disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {isSending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Sending Google Drive Invitation...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Send Google Sheet Invitation</span>
                </>
              )}
            </button>
          </form>

          {/* Current Collaborators */}
          {collaborators.length > 0 && (
            <div className="pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-slate-700 text-xs flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-slate-500" />
                  <span>Active Google Sheet Collaborators ({collaborators.length})</span>
                </span>
                {isLoadingCollabs && <Loader2 className="w-3 h-3 animate-spin text-slate-400" />}
              </div>
              <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1">
                {collaborators.map((c) => (
                  <div key={c.id} className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-100 text-[11px]">
                    <div className="flex items-center gap-2 truncate">
                      <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center text-[10px]">
                        {c.displayName?.charAt(0) || c.emailAddress?.charAt(0) || '?'}
                      </div>
                      <span className="font-medium text-slate-800 truncate">{c.emailAddress || c.displayName || 'Collaborator'}</span>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 text-slate-700 capitalize">
                      {c.role === 'owner' ? 'Owner' : c.role === 'writer' ? 'Editor' : 'Viewer'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-slate-50 px-5 py-3 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 border border-slate-300 text-slate-700 hover:bg-slate-100 font-bold rounded-lg text-xs transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

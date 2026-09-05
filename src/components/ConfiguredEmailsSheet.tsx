import React, { useState } from 'react';
import { 
  Mail, 
  Plus, 
  Trash2, 
  Check, 
  Send, 
  Bell, 
  Calendar, 
  ShieldCheck, 
  UserCheck, 
  Sparkles,
  ExternalLink
} from 'lucide-react';
import { ConfiguredEmail, Expense, DailyBudgetSettings } from '../types';

interface Props {
  configuredEmails: ConfiguredEmail[];
  onAddEmail: (newConfig: Omit<ConfiguredEmail, 'id' | 'addedAt'>) => void;
  onUpdateEmail: (id: string, updates: Partial<ConfiguredEmail>) => void;
  onDeleteEmail: (id: string) => void;
  onTriggerMonthlyDigest: () => void;
  onTriggerTestAlert: () => void;
  onOpenOutbox: () => void;
}

export const ConfiguredEmailsSheet: React.FC<Props> = ({
  configuredEmails,
  onAddEmail,
  onUpdateEmail,
  onDeleteEmail,
  onTriggerMonthlyDigest,
  onTriggerTestAlert,
  onOpenOutbox,
}) => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState<'Admin' | 'Member' | 'Auditor'>('Member');
  const [notifyAddEdit, setNotifyAddEdit] = useState(true);
  const [notifyMonthly, setNotifyMonthly] = useState(true);
  const [notifyDaily, setNotifyDaily] = useState(false);
  const [formError, setFormError] = useState('');

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newEmail.trim()) {
      setFormError('Please enter both name and email.');
      return;
    }
    if (!newEmail.includes('@') || !newEmail.includes('.')) {
      setFormError('Please enter a valid email address.');
      return;
    }

    onAddEmail({
      name: newName.trim(),
      email: newEmail.trim(),
      role: newRole,
      notifyOnAddEdit: notifyAddEdit,
      notifyMonthlyDigest: notifyMonthly,
      notifyDailyBudget: notifyDaily,
      active: true,
    });

    setNewName('');
    setNewEmail('');
    setShowAddForm(false);
    setFormError('');
  };

  const activeCount = configuredEmails.filter((c) => c.active).length;

  return (
    <div id="configured-emails-view" className="space-y-6">
      {/* 1. Sheet Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white rounded-xl p-6 shadow-md">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                CONFIGURED SHEET TAB
              </span>
              <span className="text-xs text-slate-400">Sheet: "Configured Mails"</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black">Configured Notification Email Recipients</h2>
            <p className="text-xs sm:text-sm text-slate-300 max-w-2xl">
              All team members configured in this sheet receive immediate email alerts when any user adds or edits an expense, plus automated monthly financial digests.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              id="btn-trigger-monthly-digest"
              onClick={onTriggerMonthlyDigest}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-sm flex items-center gap-2 transition-all transform active:scale-95"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Run Monthly Email Digest Now</span>
            </button>

            <button
              id="btn-view-mail-outbox"
              onClick={onOpenOutbox}
              className="px-3.5 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Sent Mail Logs</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Configured Mails Spreadsheet Grid */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 bg-slate-50/70">
          <div className="flex items-center gap-2">
            <Mail className="w-5 h-5 text-emerald-600" />
            <h3 className="font-bold text-slate-900 text-sm sm:text-base">
              Recipients & Alerts Matrix ({activeCount} Active)
            </h3>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onTriggerTestAlert}
              className="px-3 py-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors flex items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>Send Test Change Alert</span>
            </button>

            <button
              id="btn-add-email-config"
              onClick={() => setShowAddForm(!showAddForm)}
              className="px-3 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs flex items-center gap-1.5 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Recipient</span>
            </button>
          </div>
        </div>

        {/* Inline Add Recipient Form */}
        {showAddForm && (
          <form onSubmit={handleAddSubmit} className="p-4 bg-emerald-50/40 border-b border-emerald-200 text-xs space-y-3">
            <div className="font-bold text-slate-800 flex items-center gap-1.5">
              <UserCheck className="w-4 h-4 text-emerald-600" />
              <span>Add New Configured Email to Sheet</span>
            </div>

            {formError && (
              <div className="text-rose-600 font-semibold">{formError}</div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Full Name</label>
                <input
                  type="text"
                  placeholder="e.g., Sarah Connor"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg focus:outline-hidden focus:border-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Email Address</label>
                <input
                  type="email"
                  placeholder="e.g., sarah@company.com"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg focus:outline-hidden focus:border-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Role in Group</label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as any)}
                  className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg focus:outline-hidden focus:border-emerald-500 font-medium"
                >
                  <option value="Admin">Admin (Full Control)</option>
                  <option value="Member">Member (Add/Edit Expenses)</option>
                  <option value="Auditor">Auditor (View/Monthly Reports)</option>
                </select>
              </div>
            </div>

            {/* Notification Checkboxes */}
            <div className="flex flex-wrap items-center gap-4 pt-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={notifyAddEdit}
                  onChange={(e) => setNotifyAddEdit(e.target.checked)}
                  className="rounded text-emerald-600 focus:ring-emerald-500"
                />
                <span className="text-slate-700 font-medium">Instant Add & Edit Mail Alerts</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={notifyMonthly}
                  onChange={(e) => setNotifyMonthly(e.target.checked)}
                  className="rounded text-emerald-600 focus:ring-emerald-500"
                />
                <span className="text-slate-700 font-medium">Automated Monthly Digest</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={notifyDaily}
                  onChange={(e) => setNotifyDaily(e.target.checked)}
                  className="rounded text-emerald-600 focus:ring-emerald-500"
                />
                <span className="text-slate-700 font-medium">Daily Budget Alerts</span>
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="px-3 py-1.5 font-semibold text-slate-600 hover:text-slate-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs"
              >
                Save Recipient
              </button>
            </div>
          </form>
        )}

        {/* Table of Emails */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100/80 text-slate-600 font-bold border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 min-w-[150px]">Member</th>
                <th className="px-4 py-3 min-w-[200px]">Email Address</th>
                <th className="px-4 py-3 min-w-[100px]">Role</th>
                <th className="px-4 py-3 text-center min-w-[130px]">Instant Edit Alerts</th>
                <th className="px-4 py-3 text-center min-w-[130px]">Monthly Digest</th>
                <th className="px-4 py-3 text-center min-w-[120px]">Daily Reminders</th>
                <th className="px-4 py-3 text-center min-w-[80px]">Status</th>
                <th className="px-4 py-3 text-center min-w-[70px]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {configuredEmails.map((cfg) => (
                <tr key={cfg.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 font-semibold text-slate-900">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-[11px]">
                        {cfg.name.charAt(0)}
                      </div>
                      <span>{cfg.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono text-slate-700">
                    {cfg.email}
                    {cfg.email === 'pujaribadrinath@gmail.com' && (
                      <span className="ml-2 px-1.5 py-0.5 bg-emerald-100 text-emerald-800 rounded text-[10px] font-bold">
                        Primary User
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                      {cfg.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => onUpdateEmail(cfg.id, { notifyOnAddEdit: !cfg.notifyOnAddEdit })}
                      className={`p-1 rounded-md transition-colors ${
                        cfg.notifyOnAddEdit ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'
                      }`}
                      title="Toggle Instant Add & Edit Alerts"
                    >
                      <Check className={`w-4 h-4 ${cfg.notifyOnAddEdit ? 'opacity-100' : 'opacity-20'}`} />
                    </button>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => onUpdateEmail(cfg.id, { notifyMonthlyDigest: !cfg.notifyMonthlyDigest })}
                      className={`p-1 rounded-md transition-colors ${
                        cfg.notifyMonthlyDigest ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'
                      }`}
                      title="Toggle Automated Monthly Digest"
                    >
                      <Check className={`w-4 h-4 ${cfg.notifyMonthlyDigest ? 'opacity-100' : 'opacity-20'}`} />
                    </button>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => onUpdateEmail(cfg.id, { notifyDailyBudget: !cfg.notifyDailyBudget })}
                      className={`p-1 rounded-md transition-colors ${
                        cfg.notifyDailyBudget ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'
                      }`}
                      title="Toggle Daily Budget Reminders"
                    >
                      <Check className={`w-4 h-4 ${cfg.notifyDailyBudget ? 'opacity-100' : 'opacity-20'}`} />
                    </button>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span
                      onClick={() => onUpdateEmail(cfg.id, { active: !cfg.active })}
                      className={`cursor-pointer px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        cfg.active ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-400'
                      }`}
                    >
                      {cfg.active ? 'Active' : 'Paused'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {configuredEmails.length > 1 && (
                      <button
                        onClick={() => onDeleteEmail(cfg.id)}
                        className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                        title="Remove Recipient"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 3. Automated Monthly Notification Engine Status */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-3">
          <div className="flex items-center gap-2 text-emerald-700 font-bold text-sm">
            <Calendar className="w-4 h-4" />
            <span>Automated Monthly Digest Schedule</span>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            The automated scheduler compiles month-end expenses, categorizes all entries, checks overall budget utilization, computes top spenders, and broadcasts an audit email to all active recipients.
          </p>
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1 font-mono text-slate-700">
            <div>• <strong>Trigger:</strong> 1st of every calendar month at 00:00 UTC</div>
            <div>• <strong>Recipients:</strong> {configuredEmails.filter((c) => c.notifyMonthlyDigest && c.active).length} configured emails</div>
            <div>• <strong>Format:</strong> Responsive HTML with KPI cards, tables & receipt links</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-3">
          <div className="flex items-center gap-2 text-orange-600 font-bold text-sm">
            <Bell className="w-4 h-4" />
            <span>Instant Edit & Add Alert Broadcasting</span>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            Whenever any user modifies a cell or adds an expense via the spreadsheet or standard form, everyone on the configured sheet immediately receives an email alert with the diff breakdown.
          </p>
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1 font-mono text-slate-700">
            <div>• <strong>Add Alert:</strong> Dispatches immediately upon confirmation</div>
            <div>• <strong>Edit Alert:</strong> Highlights old value vs new value diff table</div>
            <div>• <strong>Audit Guard:</strong> In-sheet confirmation modal asks before broadcast</div>
          </div>
        </div>
      </div>
    </div>
  );
};

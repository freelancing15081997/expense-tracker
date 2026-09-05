import React, { useState } from 'react';
import { 
  X, 
  Mail, 
  Send, 
  Calendar, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  User, 
  FileText, 
  Sparkles,
  Inbox
} from 'lucide-react';
import { SentNotification } from '../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  notifications: SentNotification[];
}

export const NotificationOutboxModal: React.FC<Props> = ({
  isOpen,
  onClose,
  notifications,
}) => {
  const [selectedNotificationId, setSelectedNotificationId] = useState<string>(
    notifications[0]?.id || ''
  );
  const [filterType, setFilterType] = useState<string>('ALL');

  if (!isOpen) return null;

  const filtered = notifications.filter((n) => {
    if (filterType === 'ALL') return true;
    return n.type === filterType;
  });

  const selectedNotification = notifications.find((n) => n.id === selectedNotificationId) || filtered[0];

  const getBadgeStyle = (type: string) => {
    switch (type) {
      case 'ADD_ALERT':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'EDIT_ALERT':
        return 'bg-orange-100 text-blue-800 border-orange-200';
      case 'DELETE_ALERT':
        return 'bg-rose-100 text-rose-800 border-rose-200';
      case 'MONTHLY_DIGEST':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'DAILY_BUDGET_REMINDER':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      default:
        return 'bg-slate-100 text-slate-800 border-slate-200';
    }
  };

  return (
    <div
      id="notification-outbox-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/70 backdrop-blur-xs"
    >
      <div
        id="notification-outbox-modal"
        className="relative w-full max-w-5xl h-[88vh] bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-base sm:text-lg">Spreadsheet Mail Outbox & Audit Log</h2>
              <p className="text-xs text-slate-400">
                Dispatched email alerts for edits, new entries & monthly automated reports
              </p>
            </div>
          </div>
          <button
            id="btn-close-outbox"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filter Pills */}
        <div className="px-6 py-2.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 shrink-0 text-xs">
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-thin py-0.5">
            {[
              { label: 'All Dispatched', value: 'ALL' },
              { label: '🟢 Add Alerts', value: 'ADD_ALERT' },
              { label: '✏️ Edit Alerts', value: 'EDIT_ALERT' },
              { label: '📅 Monthly Digest', value: 'MONTHLY_DIGEST' },
              { label: '🔔 Daily Reminders', value: 'DAILY_BUDGET_REMINDER' },
            ].map((tab) => (
              <button
                key={tab.value}
                onClick={() => setFilterType(tab.value)}
                className={`px-3 py-1 rounded-full font-semibold transition-colors whitespace-nowrap ${
                  filterType === tab.value
                    ? 'bg-slate-900 text-white'
                    : 'bg-white text-slate-600 hover:bg-slate-200/70 border border-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <span className="text-[11px] text-slate-500 font-mono">
            {filtered.length} total logged broadcasts
          </span>
        </div>

        {/* 2-Column Split View: List on left, HTML Email Preview on right */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          {/* Email List Sidebar */}
          <div className="w-full md:w-2/5 border-r border-slate-200 overflow-y-auto divide-y divide-slate-100 bg-slate-50/50">
            {filtered.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                <Inbox className="w-8 h-8 mx-auto mb-2 opacity-50" />
                No notification alerts found in this category
              </div>
            ) : (
              filtered.map((item) => {
                const isSelected = selectedNotification?.id === item.id;

                return (
                  <div
                    key={item.id}
                    onClick={() => setSelectedNotificationId(item.id)}
                    className={`p-4 cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-white border-l-4 border-l-emerald-600 shadow-xs'
                        : 'hover:bg-slate-100/70'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${getBadgeStyle(item.type)}`}>
                        {item.type.replace('_', ' ')}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    <h4 className="font-bold text-xs text-slate-900 line-clamp-1 mb-1">
                      {item.subject}
                    </h4>

                    <p className="text-[11px] text-slate-600 line-clamp-2 leading-relaxed">
                      {item.summaryText}
                    </p>

                    <div className="flex items-center justify-between text-[10px] text-slate-500 mt-2 font-mono">
                      <span>To: {item.recipients.length} recipients</span>
                      <span className="text-emerald-700 font-semibold flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Delivered
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* HTML Email Body Preview */}
          <div className="w-full md:w-3/5 overflow-y-auto p-4 sm:p-6 bg-slate-100/70 flex flex-col">
            {selectedNotification ? (
              <div className="space-y-4 max-w-2xl mx-auto w-full">
                {/* Email Metadata Header Box */}
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs text-xs space-y-2">
                  <div className="flex justify-between items-start">
                    <span className="text-slate-400 font-mono">SUBJECT:</span>
                    <span className="font-bold text-slate-900 text-sm text-right flex-1 ml-4">
                      {selectedNotification.subject}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-slate-600 border-t border-slate-100 pt-2">
                    <span className="text-slate-400 font-mono">RECIPIENTS:</span>
                    <span className="font-mono text-[11px] font-semibold text-slate-800 text-right truncate max-w-md">
                      {selectedNotification.recipients.join(', ')}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-slate-600 border-t border-slate-100 pt-2">
                    <span className="text-slate-400 font-mono">TRIGGERED BY:</span>
                    <span className="font-medium text-slate-800">
                      {selectedNotification.triggeredBy} • {new Date(selectedNotification.timestamp).toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* Rendered Email Body Box */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-md overflow-hidden">
                  <div className="px-4 py-2 bg-slate-800 text-slate-300 text-[11px] font-mono flex items-center justify-between">
                    <span>INBOX HTML RENDERING PREVIEW</span>
                    <span className="text-emerald-400 font-bold">● Live Format</span>
                  </div>
                  <div
                    className="p-2 sm:p-4 overflow-auto"
                    dangerouslySetInnerHTML={{ __html: selectedNotification.htmlBody }}
                  />
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-slate-400 text-xs">
                Select an email notification from the left list to view its contents
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-white border-t border-slate-200 flex items-center justify-between text-xs text-slate-500 shrink-0">
          <div className="flex items-center gap-1.5 text-emerald-700 font-semibold">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>Instant Mail Broadcast Engine Operational</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

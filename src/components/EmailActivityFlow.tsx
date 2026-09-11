import React, { useEffect, useMemo, useState } from 'react';

type EventRow = {
  id?: string;
  direction?: string;
  status?: string;
  currentStep?: string;
  flow?: Array<string | { step?: string; at?: string; label?: string }>;
  teamNotified?: boolean;
  senderNotified?: boolean;
  createdAt?: string;
  fromEmail?: string;
  amount?: unknown;
  category?: string;
  description?: string;
  reason?: string;
};

const PIPELINE = [
  { id: 'received', label: 'Received', hint: 'Mail arrived' },
  { id: 'member_ok', label: 'Member', hint: 'Sender allowed' },
  { id: 'parsed', label: 'Reading', hint: 'File being read' },
  { id: 'amount', label: 'Amount', hint: 'Figures checked' },
  { id: 'ledger', label: 'Ledger', hint: 'Saved or held' },
  { id: 'notice', label: 'Notice', hint: 'People emailed' },
] as const;

function flowSteps(event?: EventRow | null) {
  if (!event) return [] as Array<{ step: string; at: string; label: string }>;
  return (event.flow || []).map((row) => {
    if (typeof row === 'string') return { step: row, at: '', label: row };
    return { step: String(row.step || ''), at: String(row.at || ''), label: String(row.label || row.step || '') };
  });
}

function pipelineIndex(step: string) {
  if (step === 'received') return 0;
  if (step === 'member_ok') return 1;
  if (step === 'reading' || step === 'parsed') return 2;
  if (step === 'amount_found' || step === 'amount_missing') return 3;
  if (['recorded', 'draft', 'duplicate_detected', 'not_posted', 'accepted'].includes(step)) return 4;
  if (['team_notified', 'sender_notified', 'awaiting_sender_confirm'].includes(step)) return 5;
  return -1;
}

function elapsedLabel(fromIso?: string) {
  if (!fromIso) return '';
  const ms = Date.now() - Date.parse(fromIso);
  if (!Number.isFinite(ms) || ms < 0) return '';
  if (ms < 1000) return `${ms} ms`;
  if (ms < 60_000) return `${Math.round(ms / 100) / 10}s`;
  return `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`;
}

export function EmailActivityFlow({ events }: { events: EventRow[] }) {
  const [, setTick] = useState(0);
  const inbound = useMemo(
    () => events.filter((e) => e.direction !== 'outbound').sort((a, b) => Date.parse(String(b.createdAt || '')) - Date.parse(String(a.createdAt || ''))),
    [events],
  );
  const latest = inbound[0] || null;
  const steps = flowSteps(latest);
  const current = latest?.currentStep || (steps[steps.length - 1]?.step || '');
  const activeIdx = pipelineIndex(current);
    const live = Boolean(latest && (latest.status === 'processing' || latest.status === 'duplicate_pending'));

  useEffect(() => {
    if (!live) return;
    const timer = window.setInterval(() => setTick((n) => n + 1), 250);
    return () => window.clearInterval(timer);
  }, [live, latest?.id, current]);

  const currentAt = steps.find((row) => row.step === current)?.at || latest?.createdAt;
  const wait = live ? elapsedLabel(currentAt) : '';

  const outcome = !latest ? 'Waiting for mail'
    : latest.status === 'accepted' ? 'Saved to the ledger'
    : latest.status === 'amount_missing' ? 'Saved for review — amount missing'
    : latest.status === 'duplicate_pending' ? 'Held — sender must confirm'
    : latest.status === 'duplicate_same' ? 'Same receipt, not added again'
    : latest.status === 'duplicate_new' ? 'Confirmed as a new entry'
    : latest.status === 'unreadable' ? 'File was not a receipt'
    : latest.status === 'rejected' ? 'Sender is not on this ledger'
    : latest.status === 'processing' ? (wait ? `Working — ${PIPELINE[Math.max(activeIdx, 0)]?.label || 'in progress'} ${wait}` : 'Working now')
    : 'Latest mail';

  return (
    <div className="byjan-card overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Live mail path</h3>
          <p className="text-xs text-slate-500 mt-0.5">{outcome}</p>
        </div>
        {wait && latest?.status === 'processing' ? (
          <span className="text-[11px] font-semibold text-teal-800 bg-teal-50 border border-teal-100 rounded-full px-2 py-1 shrink-0">
            {PIPELINE[Math.max(activeIdx, 0)]?.label} · {wait}
          </span>
        ) : null}
      </div>
      <div className="p-4">
        <div className="flex items-center gap-1 overflow-x-auto pb-1">
          {PIPELINE.map((step, index) => {
            const done = activeIdx > index || (!live && latest && activeIdx >= index);
            const active = live && activeIdx === index;
            return (
              <React.Fragment key={step.id}>
                <div className={`min-w-[92px] flex-1 rounded-xl border px-2.5 py-2.5 transition-all duration-300 ${
                  active ? 'border-teal-400 bg-teal-50 shadow-[0_0_0_3px_rgba(18,184,168,0.12)]' : done ? 'border-emerald-200 bg-emerald-50/70' : 'border-slate-200 bg-slate-50'
                }`}>
                  <p className={`text-[10px] font-semibold uppercase tracking-wider ${active ? 'text-teal-700' : done ? 'text-emerald-700' : 'text-slate-400'}`}>
                    {String(index + 1).padStart(2, '0')}
                  </p>
                  <p className={`text-sm font-semibold mt-0.5 ${active ? 'text-[#0B1F3A]' : done ? 'text-emerald-900' : 'text-slate-500'}`}>{step.label}</p>
                  <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                    {active && wait ? `Here · ${wait}` : done ? 'Done' : step.hint}
                  </p>
                </div>
                {index < PIPELINE.length - 1 && (
                  <span className={`hidden sm:block w-4 h-0.5 shrink-0 rounded-full ${done || active ? 'bg-teal-400' : 'bg-slate-200'}`} />
                )}
              </React.Fragment>
            );
          })}
        </div>
        {latest ? (
          <p className="text-xs text-slate-500 mt-3">
            Latest from <span className="font-medium text-slate-700">{latest.fromEmail || 'unknown'}</span>
            {latest.category ? ` · ${latest.category}` : ''}
            {latest.description ? ` · ${latest.description}` : ''}
          </p>
        ) : (
          <p className="text-xs text-slate-500 mt-3">Send a receipt to this ledger address. This path updates as Byjan works.</p>
        )}
      </div>
    </div>
  );
}

export function emailStatusLabel(status: string) {
  switch (status) {
    case 'accepted':
    case 'recorded': return 'Saved';
    case 'processing': return 'Working';
    case 'amount_missing': return 'Needs amount';
    case 'rejected': return 'Not added';
    case 'unreadable': return 'Not a receipt';
    case 'duplicate_pending': return 'Waiting on sender';
    case 'duplicate_same': return 'Same receipt';
    case 'duplicate_new': return 'New entry';
    case 'sent': return 'Sent';
    case 'failed': return 'Failed';
    default: return status || 'Unknown';
  }
}

export function emailStatusClass(status: string) {
  if (['accepted', 'sent', 'duplicate_new', 'recorded'].includes(status)) return 'bg-emerald-50 text-emerald-800 border-emerald-200';
  if (['rejected', 'failed', 'unreadable', 'duplicate_same'].includes(status)) return 'bg-amber-50 text-amber-800 border-amber-200';
  if (['amount_missing', 'duplicate_pending', 'processing'].includes(status)) return 'bg-sky-50 text-sky-800 border-sky-200';
  return 'bg-slate-50 text-slate-700 border-slate-200';
}

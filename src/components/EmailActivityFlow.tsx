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

function prettyMs(ms: number) {
  if (!Number.isFinite(ms) || ms < 0) return '';
  if (ms < 1000) return `${Math.max(1, Math.round(ms))}ms`;
  if (ms < 60_000) return `${Math.round(ms / 100) / 10}s`;
  return `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`;
}

function elapsedLabel(fromIso?: string) {
  if (!fromIso) return '';
  return prettyMs(Date.now() - Date.parse(fromIso));
}

function durationsFor(steps: Array<{ step: string; at: string }>, live: boolean, now: number) {
  const times = PIPELINE.map(() => 0);
  for (let i = 0; i < steps.length; i++) {
    const idx = pipelineIndex(steps[i].step);
    if (idx < 0) continue;
    const start = Date.parse(steps[i].at);
    if (!Number.isFinite(start)) continue;
    const nextAt = steps[i + 1]?.at ? Date.parse(steps[i + 1].at) : (live ? now : start);
    if (!Number.isFinite(nextAt) || nextAt < start) continue;
    times[idx] += nextAt - start;
  }
  return times;
}

export function EmailActivityFlow({ events }: { events: EventRow[] }) {
  const [, setTick] = useState(0);
  const [playIdx, setPlayIdx] = useState(-1);
  const inbound = useMemo(
    () => events.filter((e) => e.direction !== 'outbound').sort((a, b) => Date.parse(String(b.createdAt || '')) - Date.parse(String(a.createdAt || ''))),
    [events],
  );
  const latest = inbound[0] || null;
  const steps = flowSteps(latest);
  const current = latest?.currentStep || (steps[steps.length - 1]?.step || '');
  const realIdx = pipelineIndex(current);
  const live = Boolean(latest && (latest.status === 'processing' || latest.status === 'duplicate_pending'));
  const recent = Boolean(latest?.createdAt && Date.now() - Date.parse(String(latest.createdAt)) < 28_000);
  const shownIdx = playIdx >= 0 ? playIdx : realIdx;
  const now = Date.now();
  const durations = durationsFor(steps, live, now);
  const slowest = durations.reduce((best, ms, index) => (ms > durations[best] ? index : best), 0);

  useEffect(() => {
    if (!live && !recent) return;
    const timer = window.setInterval(() => setTick((n) => n + 1), 250);
    return () => window.clearInterval(timer);
  }, [live, recent, latest?.id, current]);

  useEffect(() => {
    if (!latest) {
      setPlayIdx(-1);
      return;
    }
    if (live) {
      setPlayIdx(Math.max(realIdx, 0));
      return;
    }
    if (recent && realIdx >= 0) {
      setPlayIdx(0);
      let i = 0;
      const timer = window.setInterval(() => {
        i += 1;
        if (i >= realIdx) {
          setPlayIdx(realIdx);
          window.clearInterval(timer);
        } else {
          setPlayIdx(i);
        }
      }, 320);
      return () => window.clearInterval(timer);
    }
    setPlayIdx(realIdx);
  }, [latest?.id, live, realIdx, recent]);

  const currentAt = steps.find((row) => row.step === current)?.at || latest?.createdAt;
  const wait = live ? elapsedLabel(currentAt) : '';
  const slowLabel = !live && durations[slowest] >= 1500 ? PIPELINE[slowest].label : '';

  const outcome = !latest ? 'Waiting for mail'
    : latest.status === 'accepted' ? 'Saved to the ledger'
    : latest.status === 'amount_missing' ? 'Saved for review — amount missing'
    : latest.status === 'duplicate_pending' ? 'Held — waiting for the sender'
    : latest.status === 'duplicate_same' ? 'Same receipt, not added again'
    : latest.status === 'duplicate_new' ? 'Confirmed as a new entry'
    : latest.status === 'unreadable' ? 'File was not a receipt'
    : latest.status === 'rejected' ? 'Sender is not on this ledger'
    : latest.status === 'processing' ? (wait ? `Working on ${PIPELINE[Math.max(shownIdx, 0)]?.label || 'this mail'} · ${wait}` : 'Working now')
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
            {PIPELINE[Math.max(shownIdx, 0)]?.label} · {wait}
          </span>
        ) : slowLabel ? (
          <span className="text-[11px] font-medium text-slate-600 bg-slate-50 border border-slate-200 rounded-full px-2 py-1 shrink-0">
            Slowest · {slowLabel} {prettyMs(durations[slowest])}
          </span>
        ) : null}
      </div>
      <div className="p-4">
        <div className="flex items-center gap-1 overflow-x-auto pb-1">
          {PIPELINE.map((step, index) => {
            const done = shownIdx > index || (!live && latest && shownIdx >= index && !recent) || (recent && shownIdx > index);
            const active = (live || recent) && shownIdx === index && (live || shownIdx < realIdx || latest?.status === 'processing');
            const settled = !live && shownIdx >= index && (!recent || index < shownIdx || shownIdx === realIdx);
            const took = durations[index];
            return (
              <React.Fragment key={step.id}>
                <div className={`mail-step min-w-[92px] flex-1 rounded-xl border px-2.5 py-2.5 transition-all duration-300 ${
                  active ? 'mail-step-live border-teal-400 bg-teal-50' : settled || done ? 'border-emerald-200 bg-emerald-50/70' : 'border-slate-200 bg-slate-50'
                }`}>
                  <p className={`text-[10px] font-semibold uppercase tracking-wider ${active ? 'text-teal-700' : settled || done ? 'text-emerald-700' : 'text-slate-400'}`}>
                    {String(index + 1).padStart(2, '0')}
                  </p>
                  <p className={`text-sm font-semibold mt-0.5 ${active ? 'text-[#0B1F3A]' : settled || done ? 'text-emerald-900' : 'text-slate-500'}`}>{step.label}</p>
                  <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                    {active && wait ? `Here · ${wait}` : took >= 80 ? prettyMs(took) : settled || done ? 'Done' : step.hint}
                  </p>
                </div>
                {index < PIPELINE.length - 1 && (
                  <span className={`hidden sm:block w-4 h-0.5 shrink-0 rounded-full transition-colors duration-300 ${settled || done || active ? 'bg-teal-400' : 'bg-slate-200'}`} />
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
    default: return status ? 'Updated' : 'Unknown';
  }
}

export function emailStatusClass(status: string) {
  if (['accepted', 'sent', 'duplicate_new', 'recorded'].includes(status)) return 'bg-emerald-50 text-emerald-800 border-emerald-200';
  if (['rejected', 'failed', 'unreadable', 'duplicate_same'].includes(status)) return 'bg-amber-50 text-amber-800 border-amber-200';
  if (['amount_missing', 'duplicate_pending', 'processing'].includes(status)) return 'bg-sky-50 text-sky-800 border-sky-200';
  return 'bg-slate-50 text-slate-700 border-slate-200';
}

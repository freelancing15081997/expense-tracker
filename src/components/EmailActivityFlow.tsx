import React, { useEffect, useMemo, useState } from 'react';
import { Check } from 'lucide-react';

export type EventRow = {
  id?: string;
  direction?: string;
  status?: string;
  currentStep?: string;
  flow?: Array<string | { step?: string; at?: string; label?: string }>;
  teamNotified?: boolean;
  senderNotified?: boolean;
  createdAt?: string;
  fromEmail?: string;
  toEmail?: string;
  amount?: unknown;
  category?: string;
  description?: string;
  reason?: string;
  subject?: string;
  action?: string;
  detail?: string;
};

const PIPELINE = [
  { id: 'received', label: 'Received' },
  { id: 'member_ok', label: 'Member' },
  { id: 'parsed', label: 'Reading' },
  { id: 'amount', label: 'Amount' },
  { id: 'ledger', label: 'Ledger' },
  { id: 'notice', label: 'Notice' },
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

export function resolvedStatus(event: EventRow) {
  const raw = String(event.status || '');
  const step = String(event.currentStep || '');
  if (['accepted', 'recorded', 'amount_missing', 'unreadable', 'rejected', 'duplicate_pending', 'duplicate_same', 'duplicate_new', 'sent', 'failed'].includes(raw)) {
    if (raw === 'processing') return raw;
    return raw;
  }
  if (event.teamNotified || step === 'team_notified') {
    if (step === 'not_posted' || raw === 'unreadable') return 'unreadable';
    if (step === 'duplicate_detected' || step === 'awaiting_sender_confirm') return 'duplicate_pending';
    if (step === 'draft' || step === 'amount_missing') return 'amount_missing';
    return 'accepted';
  }
  if (step === 'recorded' || step === 'accepted') return 'accepted';
  if (step === 'draft' || step === 'amount_missing') return 'amount_missing';
  if (step === 'awaiting_sender_confirm' || step === 'duplicate_detected') return 'duplicate_pending';
  if (step === 'not_posted' && raw === 'rejected') return 'rejected';
  if (step === 'not_posted') return 'unreadable';
  return raw || 'processing';
}

function prettyMs(ms: number) {
  if (!Number.isFinite(ms) || ms < 0) return '';
  if (ms < 1000) return `${Math.max(1, Math.round(ms))}ms`;
  if (ms < 60_000) return `${Math.round(ms / 100) / 10}s`;
  return `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`;
}

export function EventMailTrack({ event }: { event: EventRow }) {
  const [, setTick] = useState(0);
  const [playIdx, setPlayIdx] = useState(-1);
  const status = resolvedStatus(event);
  const steps = flowSteps(event);
  const current = event.currentStep || (steps[steps.length - 1]?.step || (status === 'processing' ? 'received' : 'team_notified'));
  const stepIdx = pipelineIndex(current);
  const live = status === 'processing' || status === 'duplicate_pending';
  const createdAgo = event.createdAt ? Date.now() - Date.parse(String(event.createdAt)) : Infinity;
  const recent = Number.isFinite(createdAgo) && createdAgo < 24_000;
  const targetIdx = live ? Math.max(stepIdx, 0) : (stepIdx >= 0 ? stepIdx : PIPELINE.length - 1);
  const shownIdx = playIdx >= 0 ? playIdx : targetIdx;

  useEffect(() => {
    if (!live && !recent) return;
    const timer = window.setInterval(() => setTick((n) => n + 1), 280);
    return () => window.clearInterval(timer);
  }, [live, recent, event.id, current, status]);

  useEffect(() => {
    if (live) {
      setPlayIdx(targetIdx);
      return;
    }
    if (recent && targetIdx > 0) {
      setPlayIdx(0);
      let i = 0;
      const timer = window.setInterval(() => {
        i += 1;
        if (i >= targetIdx) {
          setPlayIdx(targetIdx);
          window.clearInterval(timer);
        } else {
          setPlayIdx(i);
        }
      }, 260);
      return () => window.clearInterval(timer);
    }
    setPlayIdx(targetIdx);
  }, [event.id, live, targetIdx, recent]);

  const currentAt = steps.find((row) => row.step === current)?.at || event.createdAt;
  const wait = live && currentAt ? prettyMs(Date.now() - Date.parse(String(currentAt))) : '';

  return (
    <div className="mail-track" aria-label="Mail status">
      {PIPELINE.map((step, index) => {
        const done = shownIdx > index || (!live && shownIdx >= index);
        const active = live && shownIdx === index;
        return (
          <React.Fragment key={step.id}>
            <div className={`mail-node ${active ? 'is-live' : done ? 'is-done' : 'is-wait'}`}>
              <span className="mail-node-dot">
                {done && !active ? <Check className="w-3 h-3" strokeWidth={3} /> : <span>{index + 1}</span>}
              </span>
              <span className="mail-node-label">{step.label}</span>
              {active && wait ? <span className="mail-node-wait">{wait}</span> : null}
            </div>
            {index < PIPELINE.length - 1 && (
              <span className={`mail-node-line ${done || active ? 'is-on' : ''}`} />
            )}
          </React.Fragment>
        );
      })}
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
    default: return 'Working';
  }
}

export function emailStatusClass(status: string) {
  if (['accepted', 'sent', 'duplicate_new', 'recorded'].includes(status)) return 'bg-emerald-50 text-emerald-800 border-emerald-200';
  if (['rejected', 'failed', 'unreadable', 'duplicate_same'].includes(status)) return 'bg-amber-50 text-amber-800 border-amber-200';
  if (['amount_missing', 'duplicate_pending', 'processing'].includes(status)) return 'bg-sky-50 text-sky-800 border-sky-200';
  return 'bg-slate-50 text-slate-700 border-slate-200';
}

export function EmailActivityFlow({ events }: { events: EventRow[] }) {
  const inbound = useMemo(
    () => events.filter((e) => e.direction !== 'outbound'),
    [events],
  );
  if (!inbound.length) return null;
  return (
    <div className="space-y-3">
      {inbound.map((event) => (
        <EventMailTrack key={event.id || event.createdAt} event={event} />
      ))}
    </div>
  );
}

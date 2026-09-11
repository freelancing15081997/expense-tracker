import React from 'react';

type EventRow = {
  direction?: string;
  status?: string;
  flow?: string[];
  teamNotified?: boolean;
  senderNotified?: boolean;
};

const STEPS: Array<{ id: string; label: string; hint: string; match: (events: EventRow[]) => number }> = [
  {
    id: 'received',
    label: 'Mail received',
    hint: 'Catch-all delivered to Byjan',
    match: (events) => events.filter((e) => e.direction !== 'outbound').length,
  },
  {
    id: 'member',
    label: 'Sender check',
    hint: 'Must be a ledger member',
    match: (events) => events.filter((e) => e.direction !== 'outbound' && e.status !== 'rejected').length,
  },
  {
    id: 'parse',
    label: 'Document read',
    hint: 'Amount, merchant, category',
    match: (events) => events.filter((e) => ['accepted', 'amount_missing', 'duplicate_pending', 'duplicate_same', 'duplicate_new'].includes(String(e.status))).length,
  },
  {
    id: 'duplicate',
    label: 'Duplicate check',
    hint: 'Same image waits for Same / Different',
    match: (events) => events.filter((e) => String(e.status).startsWith('duplicate')).length,
  },
  {
    id: 'ledger',
    label: 'Ledger result',
    hint: 'Recorded, draft, or not posted',
    match: (events) => events.filter((e) => ['accepted', 'amount_missing', 'duplicate_new'].includes(String(e.status))).length,
  },
  {
    id: 'notices',
    label: 'Notices sent',
    hint: 'Sender and ledger team',
    match: (events) => events.filter((e) => e.direction === 'outbound' && e.status === 'sent').length,
  },
];

function statusCounts(events: EventRow[]) {
  const inbound = events.filter((e) => e.direction !== 'outbound');
  const count = (status: string) => inbound.filter((e) => e.status === status).length;
  return {
    received: inbound.length,
    accepted: count('accepted') + count('duplicate_new'),
    draft: count('amount_missing'),
    rejected: count('rejected'),
    unreadable: count('unreadable'),
    duplicatePending: count('duplicate_pending'),
    duplicateSame: count('duplicate_same'),
    outboundSent: events.filter((e) => e.direction === 'outbound' && e.status === 'sent').length,
    outboundFailed: events.filter((e) => e.direction === 'outbound' && e.status === 'failed').length,
  };
}

export function EmailActivityFlow({ events }: { events: EventRow[] }) {
  const counts = statusCounts(events);
  return (
    <div className="byjan-card p-4 space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-slate-900">Email activity flow</h3>
        <p className="text-xs text-slate-500 mt-1">Every inbound receipt and outbound notice for this ledger, shown as the live path Byjan follows.</p>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-2">
        {STEPS.map((step, index) => {
          const n = step.match(events);
          return (
            <div key={step.id} className="relative rounded-xl border border-slate-200 bg-[#F8FAFC] px-3 py-3">
              {index < STEPS.length - 1 && (
                <span className="hidden lg:block absolute top-1/2 -right-2 w-4 h-px bg-slate-300" aria-hidden />
              )}
              <p className="text-[10px] uppercase tracking-wider font-semibold text-slate-500">{String(index + 1).padStart(2, '0')}</p>
              <p className="text-sm font-semibold text-[#0B1F3A] mt-1 leading-tight">{step.label}</p>
              <p className="text-[11px] text-slate-500 mt-1 leading-snug">{step.hint}</p>
              <p className="text-lg font-bold text-[#0B1F3A] mt-2 tabular-nums">{n}</p>
            </div>
          );
        })}
      </div>
      <div className="grid sm:grid-cols-2 gap-3 text-xs text-slate-600">
        <div className="rounded-lg border border-slate-200 p-3 space-y-1.5">
          <p className="text-[10px] uppercase tracking-wider font-semibold text-slate-500">Inbound outcomes</p>
          <p>Recorded on ledger · <span className="font-semibold text-slate-900">{counts.accepted}</span></p>
          <p>Needs review (amount missing) · <span className="font-semibold text-slate-900">{counts.draft}</span></p>
          <p>Sender not a member · <span className="font-semibold text-slate-900">{counts.rejected}</span></p>
          <p>Unreadable / not a receipt · <span className="font-semibold text-slate-900">{counts.unreadable}</span></p>
          <p>Awaiting Same / Different · <span className="font-semibold text-slate-900">{counts.duplicatePending}</span></p>
          <p>Confirmed same (not posted) · <span className="font-semibold text-slate-900">{counts.duplicateSame}</span></p>
        </div>
        <div className="rounded-lg border border-slate-200 p-3 space-y-1.5">
          <p className="text-[10px] uppercase tracking-wider font-semibold text-slate-500">How status moves</p>
          <p>1. Mail arrives at the ledger address.</p>
          <p>2. Sender must belong to the team, or the mail is not added.</p>
          <p>3. Byjan reads the attachment. No amount → sender gets the file back with the error; a draft may be saved.</p>
          <p>4. Same image as an existing entry → sender chooses Same receipt or Different entry in the email.</p>
          <p>5. Recorded entries notify the ledger team. Editing a draft clears Needs review.</p>
          <p>Outbound sent {counts.outboundSent} · failed {counts.outboundFailed}</p>
        </div>
      </div>
    </div>
  );
}

export function emailStatusLabel(status: string) {
  switch (status) {
    case 'accepted': return 'Entry added';
    case 'amount_missing': return 'Amount missing';
    case 'rejected': return 'Not added';
    case 'unreadable': return 'Unreadable';
    case 'duplicate_pending': return 'Awaiting confirm';
    case 'duplicate_same': return 'Duplicate declined';
    case 'duplicate_new': return 'Confirmed new';
    case 'sent': return 'Sent';
    case 'failed': return 'Failed';
    default: return status || 'Unknown';
  }
}

export function emailStatusClass(status: string) {
  if (['accepted', 'sent', 'duplicate_new'].includes(status)) return 'bg-emerald-50 text-emerald-800 border-emerald-200';
  if (['rejected', 'failed', 'unreadable', 'duplicate_same'].includes(status)) return 'bg-amber-50 text-amber-800 border-amber-200';
  if (['amount_missing', 'duplicate_pending'].includes(status)) return 'bg-sky-50 text-sky-800 border-sky-200';
  return 'bg-slate-50 text-slate-700 border-slate-200';
}

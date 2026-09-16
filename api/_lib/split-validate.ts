/** Server-side split checks. Mirrors client allocateSplit — never trust the payload totals. */

export function validateSplitPayload(opts: {
  expenseAmount: number;
  split: Record<string, unknown>;
  memberUids: string[];
}) {
  const participants = Array.isArray(opts.split.participants)
    ? opts.split.participants as Array<Record<string, unknown>>
    : [];
  if (!participants.length) return 'Add at least one participant';
  const method = String(opts.split.method || 'equal');
  const memberSet = new Set(opts.memberUids);
  const seen = new Set<string>();
  for (const p of participants) {
    const uid = String(p.uid || '').trim();
    const email = String(p.email || '').trim().toLowerCase();
    const key = uid || email;
    if (!key) return 'Participant is missing';
    if (seen.has(key)) return 'Duplicate member in split';
    seen.add(key);
    if (uid && !memberSet.has(uid)) return 'Participant is not a member of this book';
  }
  const total = Math.round(Number(opts.expenseAmount || 0) * 100);
  if (!(total > 0)) return 'Expense total must be greater than zero';
  let raw: number[] = [];
  if (method === 'equal') {
    const base = Math.floor(total / participants.length);
    raw = participants.map(() => base);
    raw[0] += total - base * participants.length;
  } else if (method === 'percentage') {
    const pctSum = participants.reduce((s, p) => s + Number(p.percent || 0), 0);
    if (Math.abs(pctSum - 100) > 0.05) return 'Percentages must total 100%';
    raw = participants.map((p) => Math.round((total * Number(p.percent || 0)) / 100));
    raw[0] += total - raw.reduce((s, n) => s + n, 0);
  } else if (method === 'shares') {
    const shareSum = participants.reduce((s, p) => s + Number(p.share || 0), 0);
    if (shareSum <= 0) return 'Shares must be greater than zero';
    raw = participants.map((p) => Math.floor((total * Number(p.share || 0)) / shareSum));
    raw[0] += total - raw.reduce((s, n) => s + n, 0);
  } else {
    raw = participants.map((p) => Math.round(Number(p.amountPaise || 0)));
  }
  const sum = raw.reduce((s, n) => s + n, 0);
  if (sum !== total) return 'Split amounts must equal the expense total';
  if (raw.some((n) => n < 0)) return 'Split amounts cannot be negative';
  return '';
}

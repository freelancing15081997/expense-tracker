/** Feature catalog — same keys as src/lib/features.ts in the live app so /api/me setFeatures stays compatible. */
export type FeatureRow = { key: string; group: 'Money' | 'App' | 'Business'; parent: string | null; label: string; hint: string; smart?: boolean };
export type FeatureMap = Record<string, boolean>;

export const FEATURES: FeatureRow[] = [
  { key: 'money', group: 'Money', parent: null, label: 'Money', hint: 'Money books, entries and ledgers' },
  { key: 'money_capture', group: 'Money', parent: 'money', label: 'Capture', hint: 'Add, scan, voice and change entries' },
  { key: 'money_add', group: 'Money', parent: 'money_capture', label: 'Add / edit entries', hint: 'Add entry button and edit form' },
  { key: 'money_scan', group: 'Money', parent: 'money_capture', label: 'Scan receipts', hint: 'Camera, share and auto-fill', smart: true },
  { key: 'money_voice', group: 'Money', parent: 'money_capture', label: 'Voice entry', hint: 'Speak an entry', smart: true },
  { key: 'money_duplicate', group: 'Money', parent: 'money_capture', label: 'Duplicate entry', hint: 'Copy an existing entry' },
  { key: 'money_flag', group: 'Money', parent: 'money_capture', label: 'Flag entry', hint: 'Star / flag an entry' },
  { key: 'money_delete', group: 'Money', parent: 'money_capture', label: 'Delete entries', hint: 'Remove an entry' },
  { key: 'money_team', group: 'Money', parent: 'money', label: 'People & pay', hint: 'Share books and settle up' },
  { key: 'money_people', group: 'Money', parent: 'money_team', label: 'People & access', hint: 'Invite and set roles' },
  { key: 'money_settle', group: 'Money', parent: 'money_team', label: 'Settlements & UPI', hint: 'Settle balances with UPI' },
  { key: 'money_split', group: 'Money', parent: 'money', label: 'Splits', hint: 'Split a spend' },
  { key: 'money_split_tab', group: 'Money', parent: 'money_split', label: 'Splits tab', hint: 'Book Splits tab' },
  { key: 'money_split_entry', group: 'Money', parent: 'money_split', label: 'Split button', hint: 'Split an entry' },
  { key: 'money_split_equal', group: 'Money', parent: 'money_split', label: 'Split equally', hint: 'Equal split with team' },
  { key: 'money_email', group: 'Money', parent: 'money', label: 'Email', hint: 'Book mailbox and email-in' },
  { key: 'money_email_mailbox', group: 'Money', parent: 'money_email', label: 'Inbound mailbox', hint: 'Forward bills to the book', smart: true },
  { key: 'money_email_report', group: 'Money', parent: 'money_email', label: 'Email report', hint: 'Send PDF report' },
  { key: 'money_insight', group: 'Money', parent: 'money', label: 'Reports & history', hint: 'Reports, analytics and audit' },
  { key: 'money_reports', group: 'Money', parent: 'money_insight', label: 'Money reports', hint: 'Reports across books' },
  { key: 'money_book_analytics', group: 'Money', parent: 'money_insight', label: 'Book reports tab', hint: 'Reports inside a book' },
  { key: 'money_history', group: 'Money', parent: 'money_insight', label: 'History tab', hint: 'Change history' },
  { key: 'money_export', group: 'Money', parent: 'money_insight', label: 'Export & share', hint: 'PDF / Excel export' },
  { key: 'money_ai_insights', group: 'Money', parent: 'money_insight', label: 'Smart insights', hint: 'Spending patterns and nudges', smart: true },
  { key: 'money_live', group: 'Money', parent: 'money', label: 'Live', hint: 'Activity, inbox and upcoming pay' },
  { key: 'money_activity', group: 'Money', parent: 'money_live', label: 'Activity feed', hint: 'What changed' },
  { key: 'money_inbox', group: 'Money', parent: 'money_live', label: 'Financial inbox', hint: 'Receipts waiting for review' },
  { key: 'money_recurring', group: 'Money', parent: 'money_live', label: 'Regular payments', hint: 'Bills, EMI and upcoming pay' },
  { key: 'money_setup', group: 'Money', parent: 'money', label: 'Book setup', hint: 'Create books, purpose, budget, search' },
  { key: 'money_create_book', group: 'Money', parent: 'money_setup', label: 'New money book', hint: 'Create a book' },
  { key: 'money_delete_book', group: 'Money', parent: 'money_setup', label: 'Delete money book', hint: 'Delete a book' },
  { key: 'money_purpose', group: 'Money', parent: 'money_setup', label: 'Purpose templates', hint: 'Trip, home, business…' },
  { key: 'money_search', group: 'Money', parent: 'money_setup', label: 'Smart search', hint: 'Ask in plain words', smart: true },
  { key: 'money_pin', group: 'Money', parent: 'money_setup', label: 'Pin book', hint: 'Pin a book' },
  { key: 'money_budget', group: 'Money', parent: 'money_setup', label: 'Monthly budget', hint: 'Spend budget' },
  { key: 'money_filters', group: 'Money', parent: 'money_setup', label: 'Filters', hint: 'Ledger filters' },
  { key: 'app_notifications', group: 'App', parent: null, label: 'Notifications', hint: 'Bell and push' },
  { key: 'app_notifications_push', group: 'App', parent: 'app_notifications', label: 'Push alerts', hint: 'Device push' },
  { key: 'app_notifications_email', group: 'App', parent: 'app_notifications', label: 'Email alerts', hint: 'Email when a teammate acts' },
  { key: 'app_lock', group: 'App', parent: null, label: 'App lock', hint: 'PIN / fingerprint' },
  { key: 'app_search', group: 'App', parent: null, label: 'Global search', hint: 'Search everything' },
  { key: 'business', group: 'Business', parent: null, label: 'Business', hint: 'Company accounts (web ERP)' },
];

export const featureRow = (k: string) => FEATURES.find((r) => r.key === k);
export const childKeys = (k: string) => FEATURES.filter((r) => r.parent === k).map((r) => r.key);
export const descendants = (k: string): string[] => childKeys(k).flatMap((c) => [c, ...descendants(c)]);
export const ancestors = (k: string): string[] => { const p = featureRow(k)?.parent; return p ? [p, ...ancestors(p)] : []; };
export const allOn = (): FeatureMap => Object.fromEntries(FEATURES.map((r) => [r.key, true]));

/** Turning a parent off turns its children off; turning a child on turns its parents on. */
export function toggleFeature(map: FeatureMap, key: string): FeatureMap {
  const on = !map[key];
  const next = { ...map, [key]: on };
  if (!on) descendants(key).forEach((k) => { next[k] = false; });
  else ancestors(key).forEach((k) => { next[k] = true; });
  return next;
}
export const on = (map: FeatureMap | undefined, key: string) => !!map && map[key] === true && ancestors(key).every((a) => map[a] !== false);

export type FeatureNode = FeatureRow & { children: FeatureNode[] };
export function tree(group?: FeatureRow['group']): FeatureNode[] {
  const rows = group ? FEATURES.filter((r) => r.group === group) : FEATURES;
  const walk = (p: string | null): FeatureNode[] => rows.filter((r) => r.parent === p).map((r) => ({ ...r, children: walk(r.key) }));
  return walk(null);
}

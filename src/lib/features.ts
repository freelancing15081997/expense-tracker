import { BOOKS_TREE, type BooksBranch } from '../books/catalog/modules';

export type FeatureGroup = 'Money' | 'App' | 'Business';
export type FeatureKind = 'feature' | 'module' | 'action';

export type FeatureRow = {
  key: string;
  group: FeatureGroup;
  parent: string | null;
  kind: FeatureKind;
  label: string;
  hint: string;
  href?: string;
};

const CORE_FEATURES: FeatureRow[] = [
  { key: 'money', group: 'Money', parent: null, kind: 'feature', label: 'Money', hint: 'Home money books, tabs, and ledgers' },

  { key: 'money_capture', group: 'Money', parent: 'money', kind: 'module', label: 'Capture', hint: 'Add, scan, voice, and change entries' },
  { key: 'money_add', group: 'Money', parent: 'money_capture', kind: 'action', label: 'Add / edit entries', hint: 'Add entry button and edit form' },
  { key: 'money_scan', group: 'Money', parent: 'money_capture', kind: 'action', label: 'Scan receipts', hint: 'Camera / receipt capture button' },
  { key: 'money_voice', group: 'Money', parent: 'money_capture', kind: 'action', label: 'Voice entry', hint: 'Mic / Speak an entry button' },
  { key: 'money_duplicate', group: 'Money', parent: 'money_capture', kind: 'action', label: 'Duplicate entry', hint: 'Copy an existing entry' },
  { key: 'money_flag', group: 'Money', parent: 'money_capture', kind: 'action', label: 'Flag entry', hint: 'Star / flag an entry' },
  { key: 'money_delete', group: 'Money', parent: 'money_capture', kind: 'action', label: 'Delete entries', hint: 'Remove expense button' },

  { key: 'money_team', group: 'Money', parent: 'money', kind: 'module', label: 'People & pay', hint: 'Share the book and settle balances' },
  { key: 'money_people', group: 'Money', parent: 'money_team', kind: 'action', label: 'People & access', hint: 'Invite, roles, and member sheet' },
  { key: 'money_settle', group: 'Money', parent: 'money_team', kind: 'action', label: 'Settlements & UPI', hint: 'Pending pay strip and settlement pay' },

  { key: 'money_split', group: 'Money', parent: 'money', kind: 'module', label: 'Splits', hint: 'Split a spend with the team' },
  { key: 'money_split_tab', group: 'Money', parent: 'money_split', kind: 'action', label: 'Splits tab', hint: 'Book Splits tab' },
  { key: 'money_split_entry', group: 'Money', parent: 'money_split', kind: 'action', label: 'Split button', hint: 'Split / Edit split on an entry' },
  { key: 'money_split_equal', group: 'Money', parent: 'money_split', kind: 'action', label: 'Split equally', hint: 'Split equally with team checkbox' },

  { key: 'money_email', group: 'Money', parent: 'money', kind: 'module', label: 'Email', hint: 'Mailbox, send, announce, and email reports' },
  { key: 'money_email_tab', group: 'Money', parent: 'money_email', kind: 'action', label: 'Email tab', hint: 'Book Email tab' },
  { key: 'money_email_mailbox', group: 'Money', parent: 'money_email', kind: 'action', label: 'Inbound mailbox', hint: 'See mail that created entries' },
  { key: 'money_email_send', group: 'Money', parent: 'money_email', kind: 'action', label: 'Send book email', hint: 'Compose / send from Email tab' },
  { key: 'money_announce', group: 'Money', parent: 'money_email', kind: 'action', label: 'Announce', hint: 'Megaphone announcement to the team' },
  { key: 'money_email_report', group: 'Money', parent: 'money_email', kind: 'action', label: 'Email report', hint: 'Send PDF report by email' },

  { key: 'money_insight', group: 'Money', parent: 'money', kind: 'module', label: 'Reports & history', hint: 'Spend reports, book analytics, and audit' },
  { key: 'money_reports', group: 'Money', parent: 'money_insight', kind: 'action', label: 'Money reports', hint: 'Reports screen across money books' },
  { key: 'money_book_analytics', group: 'Money', parent: 'money_insight', kind: 'action', label: 'Book reports tab', hint: 'Reports tab inside a money book' },
  { key: 'money_history', group: 'Money', parent: 'money_insight', kind: 'action', label: 'History tab', hint: 'Change history inside a money book' },
  { key: 'money_export', group: 'Money', parent: 'money_insight', kind: 'action', label: 'Export & share', hint: 'Download PDF and share exports' },

  { key: 'money_live', group: 'Money', parent: 'money', kind: 'module', label: 'Live', hint: 'Activity, inbox, and upcoming pay' },
  { key: 'money_activity', group: 'Money', parent: 'money_live', kind: 'action', label: 'Activity feed', hint: 'Activity tab and what is happening' },
  { key: 'money_inbox', group: 'Money', parent: 'money_live', kind: 'action', label: 'Financial inbox', hint: 'Attention strip on Home' },
  { key: 'money_recurring', group: 'Money', parent: 'money_live', kind: 'action', label: 'Regular payments', hint: 'Detected bills, EMI, and upcoming pay' },

  { key: 'money_setup', group: 'Money', parent: 'money', kind: 'module', label: 'Book setup', hint: 'Create books, purpose, pin, budget, search' },
  { key: 'money_create_book', group: 'Money', parent: 'money_setup', kind: 'action', label: 'New money book', hint: 'New book button on Home' },
  { key: 'money_delete_book', group: 'Money', parent: 'money_setup', kind: 'action', label: 'Delete money book', hint: 'Delete this ledger button' },
  { key: 'money_purpose', group: 'Money', parent: 'money_setup', kind: 'action', label: 'Purpose templates', hint: 'Trip, wedding, vehicle and other book setups' },
  { key: 'money_search', group: 'Money', parent: 'money_setup', kind: 'action', label: 'Search money', hint: 'Find books and entries from search' },
  { key: 'money_pin', group: 'Money', parent: 'money_setup', kind: 'action', label: 'Pin book', hint: 'Pin / unpin a money book' },
  { key: 'money_budget', group: 'Money', parent: 'money_setup', kind: 'action', label: 'Monthly budget', hint: 'Set a monthly spend budget' },
  { key: 'money_filters', group: 'Money', parent: 'money_setup', kind: 'action', label: 'Filters & columns', hint: 'Ledger filters and column picker' },

  { key: 'app_notifications', group: 'App', parent: null, kind: 'feature', label: 'Notifications', hint: 'Bell inbox and push alerts' },
  { key: 'app_notifications_bell', group: 'App', parent: 'app_notifications', kind: 'action', label: 'Bell inbox', hint: 'Header bell and notification sheet' },
  { key: 'app_notifications_push', group: 'App', parent: 'app_notifications', kind: 'action', label: 'Push alerts', hint: 'Device push when a teammate acts' },
  { key: 'app_notifications_email', group: 'App', parent: 'app_notifications', kind: 'action', label: 'Email alerts', hint: 'Email when a teammate acts' },
  { key: 'app_lock', group: 'App', parent: null, kind: 'feature', label: 'App lock', hint: 'PIN / biometric lock in Settings' },
  { key: 'app_search', group: 'App', parent: null, kind: 'feature', label: 'Global search', hint: 'Search bar and Ctrl+K' },
  { key: 'business', group: 'Business', parent: null, kind: 'feature', label: 'Business', hint: 'Company accounts workspace' },
  { key: 'sales', group: 'Business', parent: 'business', kind: 'module', label: 'Sales & invoices', hint: 'Customers, invoices, quotes, collections' },
  { key: 'buying', group: 'Business', parent: 'business', kind: 'module', label: 'Buying & bills', hint: 'Suppliers and bills you owe' },
  { key: 'bank', group: 'Business', parent: 'business', kind: 'module', label: 'Bank', hint: 'Bank moves and business spends' },
  { key: 'accounts', group: 'Business', parent: 'business', kind: 'module', label: 'Accounts', hint: 'Account list, journals, month close' },
  { key: 'operations', group: 'Business', parent: 'business', kind: 'module', label: 'Stock & projects', hint: 'Inventory, assets, projects, budgets' },
  { key: 'tax', group: 'Business', parent: 'business', kind: 'module', label: 'GST & tax', hint: 'Tax, GST entities, companies' },
  { key: 'reports', group: 'Business', parent: 'business', kind: 'module', label: 'Business reports', hint: 'Reports, insights, accountant, change log' },
  { key: 'company_settings', group: 'Business', parent: 'business', kind: 'module', label: 'Company settings', hint: 'Inbox, approvals, and business settings' },
];

function booksHrefParent(href: string): string {
  const path = String(href || '').split('?')[0];
  if (/^\/books\/(customers|estimates|quotes|sales-orders|invoices|credit-notes|debit-notes|statements|collections)(\/|$)/.test(path)) return 'sales';
  if (/^\/books\/(vendors|purchase-requests|purchase-orders|purchase-receipts|bills|vendor-credits|payment-run)(\/|$)/.test(path)) return 'buying';
  if (/^\/books\/(banking|expenses)(\/|$)/.test(path)) return 'bank';
  if (/^\/books\/(chart-of-accounts|journals|recurring|ledger|periods|close)(\/|$)/.test(path)) return 'accounts';
  if (/^\/books\/(inventory|assets|projects|budgets|forecast|revenue|leases)(\/|$)/.test(path)) return 'operations';
  if (/^\/books\/(tax|entities|companies)(\/|$)/.test(path)) return 'tax';
  if (/^\/books\/(reports|workbench|insights|audit)(\/|$)/.test(path)) return 'reports';
  if (/^\/books\/(inbox|approvals|settings)(\/|$)/.test(path)) return 'company_settings';
  return 'business';
}

export function actionKeyFromHref(href: string) {
  return `act_${String(href || '').replace(/^\//, '').replace(/[^\w]+/g, '_')}`;
}

const DOC_VERBS = [
  { suffix: 'create', label: 'Create', hint: 'New record button' },
  { suffix: 'edit', label: 'Edit', hint: 'Edit button' },
  { suffix: 'post', label: 'Post / confirm', hint: 'Post or confirm button' },
  { suffix: 'print', label: 'Print / PDF', hint: 'Print or download PDF' },
  { suffix: 'email', label: 'Email', hint: 'Send this document by email' },
  { suffix: 'void', label: 'Void / reverse', hint: 'Void, reverse, or cancel' },
] as const;

const RECORD_VERBS = [
  { suffix: 'create', label: 'Create', hint: 'Add button' },
  { suffix: 'edit', label: 'Edit', hint: 'Edit button' },
] as const;

function verbsForHref(href: string): ReadonlyArray<{ suffix: string; label: string; hint: string }> {
  const path = String(href || '').split('?')[0];
  if (/\/(invoices|estimates|quotes|sales-orders|credit-notes|debit-notes|bills|purchase-orders|purchase-requests|purchase-receipts|vendor-credits|journals|recurring|expenses)$/.test(path)) {
    return DOC_VERBS;
  }
  if (/\/(customers|vendors|chart-of-accounts|inventory|assets|projects|budgets|forecast|revenue|leases|tax|entities|companies)$/.test(path)) {
    return RECORD_VERBS;
  }
  if (/\/(banking|payment-run|close|periods)$/.test(path)) {
    return [{ suffix: 'post', label: 'Post / confirm', hint: 'Post or confirm button' }];
  }
  if (/\/settings$/.test(path)) {
    return [{ suffix: 'manage', label: 'Change settings', hint: 'Save company settings' }];
  }
  return [];
}

const BUSINESS_ACTIONS: FeatureRow[] = BOOKS_TREE.flatMap((branch) =>
  branch.items.map((item) => ({
    key: actionKeyFromHref(item.href),
    group: 'Business' as const,
    parent: booksHrefParent(item.href),
    kind: 'action' as const,
    label: item.name,
    hint: `${branch.name} · ${item.name}`,
    href: item.href,
  })),
);

const BUSINESS_VERBS: FeatureRow[] = BUSINESS_ACTIONS.flatMap((row) =>
  verbsForHref(row.href || '').map((verb) => ({
    key: `${row.key}_${verb.suffix}`,
    group: 'Business' as const,
    parent: row.key,
    kind: 'action' as const,
    label: verb.label,
    hint: `${row.label} · ${verb.hint}`,
    href: row.href,
  })),
);

export const FEATURE_CATALOG: FeatureRow[] = [...CORE_FEATURES, ...BUSINESS_ACTIONS, ...BUSINESS_VERBS];

export type FeatureKey = string;
export type FeatureMap = Record<string, boolean>;

const MEMBER_ON = new Set([
  'money',
  'money_capture',
  'money_add',
  'money_scan',
  'money_voice',
  'money_duplicate',
  'money_flag',
  'money_delete',
  'money_team',
  'money_people',
  'money_settle',
  'money_split',
  'money_split_tab',
  'money_split_entry',
  'money_split_equal',
  'money_email',
  'money_email_tab',
  'money_email_mailbox',
  'money_email_send',
  'money_announce',
  'money_email_report',
  'money_insight',
  'money_reports',
  'money_book_analytics',
  'money_history',
  'money_export',
  'money_live',
  'money_inbox',
  'money_recurring',
  'money_setup',
  'money_create_book',
  'money_delete_book',
  'money_purpose',
  'money_search',
  'money_pin',
  'money_budget',
  'money_filters',
  'app_notifications',
  'app_notifications_bell',
  'app_notifications_push',
  'app_notifications_email',
  'app_search',
  'app_lock',
]);

export const DEFAULT_FEATURES = Object.fromEntries(FEATURE_CATALOG.map((row) => [row.key, true])) as FeatureMap;

/** Invited / external users: Money on by default; Business and extras off until a super user enables them. */
export const MEMBER_FEATURES = Object.fromEntries(
  FEATURE_CATALOG.map((row) => [row.key, MEMBER_ON.has(row.key)]),
) as FeatureMap;

export const FEATURE_GROUPS: FeatureGroup[] = ['Money', 'App', 'Business'];

export function featureRow(key: string): FeatureRow | undefined {
  return FEATURE_CATALOG.find((row) => row.key === key);
}

export function childKeys(parent: string): string[] {
  return FEATURE_CATALOG.filter((row) => row.parent === parent).map((row) => row.key);
}

export function descendantKeys(parent: string): string[] {
  const kids = childKeys(parent);
  return kids.flatMap((key) => [key, ...descendantKeys(key)]);
}

export function ancestorKeys(key: string): string[] {
  const row = featureRow(key);
  if (!row?.parent) return [];
  return [row.parent, ...ancestorKeys(row.parent)];
}

export type FeatureNode = FeatureRow & { children: FeatureNode[] };

export function buildFeatureTree(group?: FeatureGroup): FeatureNode[] {
  const rows = group ? FEATURE_CATALOG.filter((row) => row.group === group) : FEATURE_CATALOG;
  const byParent = new Map<string | null, FeatureRow[]>();
  for (const row of rows) {
    const list = byParent.get(row.parent) || [];
    list.push(row);
    byParent.set(row.parent, list);
  }
  const walk = (parent: string | null): FeatureNode[] =>
    (byParent.get(parent) || []).map((row) => ({ ...row, children: walk(row.key) }));
  return walk(null);
}

export function applyFeatureToggle(draft: FeatureMap, key: string): FeatureMap {
  const on = !draft[key];
  const next: FeatureMap = { ...draft, [key]: on };
  if (!on) {
    for (const child of descendantKeys(key)) next[child] = false;
  } else {
    for (const ancestor of ancestorKeys(key)) next[ancestor] = true;
  }
  return normalizeFeatures(next, next);
}

export function normalizeFeatures(raw: unknown, fallback: FeatureMap = DEFAULT_FEATURES): FeatureMap {
  const next: FeatureMap = { ...fallback };
  const rec = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  for (const row of FEATURE_CATALOG) {
    if (Object.prototype.hasOwnProperty.call(rec, row.key)) next[row.key] = Boolean(rec[row.key]);
  }
  for (const row of FEATURE_CATALOG) {
    if (Object.prototype.hasOwnProperty.call(rec, row.key)) continue;
    let ancestor = row.parent;
    while (ancestor) {
      if (Object.prototype.hasOwnProperty.call(rec, ancestor)) {
        next[row.key] = Boolean(rec[ancestor]);
        break;
      }
      ancestor = featureRow(ancestor)?.parent || null;
    }
  }
  let bubbling = true;
  while (bubbling) {
    bubbling = false;
    for (const row of FEATURE_CATALOG) {
      if (!next[row.key] || !row.parent) continue;
      if (Object.prototype.hasOwnProperty.call(rec, row.parent)) continue;
      if (!next[row.parent]) {
        next[row.parent] = true;
        bubbling = true;
      }
    }
  }
  let changed = true;
  while (changed) {
    changed = false;
    for (const row of FEATURE_CATALOG) {
      if (row.parent && !next[row.parent] && next[row.key]) {
        next[row.key] = false;
        changed = true;
      }
    }
  }
  return next;
}

export function featureOn(map: Partial<FeatureMap> | undefined, key: FeatureKey): boolean {
  // Profile not loaded yet — deny gated UI until /api/me effective features arrive.
  if (!map) return false;
  if (map[key] === undefined) return false;
  return Boolean(map[key]);
}

export function anyFeatureOn(map: Partial<FeatureMap> | undefined): boolean {
  return FEATURE_CATALOG.some((row) => featureOn(map, row.key));
}

export function hrefFeature(href: string): FeatureKey | null {
  const path = String(href || '').split('?')[0];
  if (!path || path === '/' || path === '/access' || path === '/settings' || path.startsWith('/invite')) return null;
  const action = FEATURE_CATALOG.find((row) => row.href === path);
  if (action) return action.key;
  if (path === '/expenses' || path.startsWith('/book/')) return 'money';
  if (path === '/reports' || path.startsWith('/insights')) return 'money_reports';
  if (path === '/activity') return 'money_activity';
  if (path.startsWith('/regular-payments')) return 'money_recurring';
  if (!path.startsWith('/books')) return null;
  return booksHrefParent(path);
}

export function allowsHref(map: Partial<FeatureMap> | undefined, href: string): boolean {
  const key = hrefFeature(href);
  if (!key) return true;
  if (href.startsWith('/books') && !featureOn(map, 'business')) return false;
  if (
    (href === '/expenses' || href.startsWith('/book/') || href === '/reports' || href === '/activity'
      || href.startsWith('/regular-payments') || href.startsWith('/insights'))
    && !featureOn(map, 'money')
  ) return false;
  return featureOn(map, key);
}

export function allowsBooksAction(map: Partial<FeatureMap> | undefined, href: string, verb: string): boolean {
  if (!map) return true;
  if (!featureOn(map, 'business')) return false;
  const parent = booksHrefParent(href);
  if (parent !== 'business' && !featureOn(map, parent)) return false;
  const act = actionKeyFromHref(href);
  if (featureRow(act) && !featureOn(map, act)) return false;
  const mapped = verb === 'reverse' || verb === 'void'
    ? 'void'
    : verb === 'manage_settings'
      ? 'manage'
      : verb === 'close_period'
        ? 'post'
        : verb;
  const verbKey = `${act}_${mapped}`;
  if (featureRow(verbKey)) return featureOn(map, verbKey);
  return true;
}

export function filterBooksTree(map: Partial<FeatureMap> | undefined, tree: BooksBranch[] = BOOKS_TREE): BooksBranch[] {
  if (!featureOn(map, 'business')) return [];
  return tree
    .map((branch) => ({ ...branch, items: branch.items.filter((item) => allowsHref(map, item.href)) }))
    .filter((branch) => branch.items.length > 0);
}

export function grantsOnBook(raw: unknown): Record<string, FeatureMap> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: Record<string, FeatureMap> = {};
  for (const [uid, value] of Object.entries(raw as Record<string, unknown>)) {
    if (uid) out[uid] = normalizeFeatures(value);
  }
  return out;
}

export function featuresFromBooks(uid: string, books: Array<{ featureAccess?: unknown }>, base?: unknown): FeatureMap {
  let next = normalizeFeatures(base);
  for (const book of books) {
    const granted = grantsOnBook(book.featureAccess)[uid];
    if (granted) next = granted;
  }
  return next;
}

function bookGrantRaw(raw: unknown, uid: string): unknown | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  if (!Object.prototype.hasOwnProperty.call(raw, uid)) return undefined;
  return (raw as Record<string, unknown>)[uid];
}

export function hasExplicitFeatureOverride(raw: unknown): boolean {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return false;
  return Object.keys(raw as Record<string, unknown>).length > 0;
}

export function appRoleFromBooks(
  uid: string,
  books: Array<{ ownerId?: string; roles?: Record<string, { role?: string }> }>,
): string {
  let rank = 0;
  let ownsBook = false;
  for (const book of books || []) {
    const role = String(book.roles?.[uid]?.role || (book.ownerId === uid ? 'owner' : '')).toLowerCase();
    if (role === 'owner') {
      ownsBook = true;
      continue;
    }
    if (role === 'admin') rank = Math.max(rank, 3);
    else if (role === 'contributor') rank = Math.max(rank, 2);
    else if (role === 'viewer') rank = Math.max(rank, 1);
  }
  if (ownsBook) return 'DEFAULT_USER';
  if (rank >= 3) return 'admin';
  if (rank === 2) return 'contributor';
  if (rank === 1) return 'viewer';
  return 'DEFAULT_USER';
}

export function resolveFeatures(
  uid: string,
  isSuperUser: boolean,
  books: Array<{ featureAccess?: unknown; ownerId?: string; roles?: Record<string, { role?: string }> }>,
  profileFeatures?: unknown,
  roleKey?: string,
  rolePermissions?: Record<string, Partial<FeatureMap>>,
): FeatureMap {
  if (isSuperUser) return { ...DEFAULT_FEATURES };
  /* Prefer person Access override as absolute. Book grants are legacy only. */
  if (hasExplicitFeatureOverride(profileFeatures)) {
    return normalizeFeatures(profileFeatures, MEMBER_FEATURES);
  }
  let features = { ...MEMBER_FEATURES };
  const roles = rolePermissions || {};
  if (roles.DEFAULT_USER) {
    features = normalizeFeatures(roles.DEFAULT_USER, features);
  }
  const specificKey = roleKey && roleKey !== 'DEFAULT_USER' ? roleKey : '';
  if (specificKey && roles[specificKey]) {
    features = normalizeFeatures(roles[specificKey], features);
  }
  for (let i = books.length - 1; i >= 0; i -= 1) {
    const grant = bookGrantRaw(books[i].featureAccess, uid);
    if (grant !== undefined) {
      return normalizeFeatures(grant, features);
    }
  }
  return features;
}

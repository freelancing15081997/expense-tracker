import { BOOKS_TREE, type BooksBranch } from '../books/catalog/modules';

export const FEATURE_CATALOG = [
  { key: 'money', group: 'Money', label: 'Money', hint: 'Money tab and money books' },
  { key: 'money_add', group: 'Money', label: 'Add money entries', hint: 'Record money in and out' },
  { key: 'money_people', group: 'Money', label: 'Invite people on money books', hint: 'People button inside a money book' },
  { key: 'business', group: 'Business', label: 'Business', hint: 'Business tab and company accounts' },
  { key: 'sales', group: 'Business', label: 'Sales & invoices', hint: 'Customers, invoices, quotes' },
  { key: 'buying', group: 'Business', label: 'Buying & bills', hint: 'Suppliers and bills you owe' },
  { key: 'bank', group: 'Business', label: 'Bank', hint: 'Bank moves and business spends' },
  { key: 'accounts', group: 'Business', label: 'Accounts', hint: 'Account list, journals, month close' },
  { key: 'operations', group: 'Business', label: 'Stock & projects', hint: 'Inventory, assets, projects' },
  { key: 'tax', group: 'Business', label: 'GST & tax', hint: 'Tax, GST entities, companies' },
  { key: 'reports', group: 'Business', label: 'Reports', hint: 'Reports, insights, change log' },
  { key: 'company_settings', group: 'Business', label: 'Company settings', hint: 'Business settings and approvals' },
] as const;

export type FeatureKey = (typeof FEATURE_CATALOG)[number]['key'];
export type FeatureMap = Record<FeatureKey, boolean>;

export const DEFAULT_FEATURES = Object.fromEntries(FEATURE_CATALOG.map((row) => [row.key, true])) as FeatureMap;
export const MEMBER_FEATURES = Object.fromEntries(FEATURE_CATALOG.map((row) => [row.key, row.group === 'Money'])) as FeatureMap;

export function normalizeFeatures(raw: unknown, fallback: FeatureMap = DEFAULT_FEATURES): FeatureMap {
  const next = { ...fallback };
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return next;
  const rec = raw as Record<string, unknown>;
  for (const row of FEATURE_CATALOG) {
    if (Object.prototype.hasOwnProperty.call(rec, row.key)) next[row.key] = Boolean(rec[row.key]);
  }
  return next;
}

export function featureOn(map: Partial<FeatureMap> | undefined, key: FeatureKey): boolean {
  if (!map || map[key] === undefined) {
    return FEATURE_CATALOG.find((row) => row.key === key)?.group === 'Money';
  }
  return Boolean(map[key]);
}

export function anyFeatureOn(map: Partial<FeatureMap> | undefined): boolean {
  return FEATURE_CATALOG.some((row) => featureOn(map, row.key));
}

export function hrefFeature(href: string): FeatureKey | null {
  const path = String(href || '').split('?')[0];
  if (!path || path === '/' || path === '/access' || path === '/settings' || path.startsWith('/invite')) return null;
  if (path === '/expenses' || path.startsWith('/book/') || path === '/reports' || path.startsWith('/regular-payments') || path.startsWith('/insights')) return 'money';
  if (!path.startsWith('/books')) return null;
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

export function allowsHref(map: Partial<FeatureMap> | undefined, href: string): boolean {
  const key = hrefFeature(href);
  if (!key) return true;
  if (href.startsWith('/books') && !featureOn(map, 'business')) return false;
  if ((href === '/expenses' || href.startsWith('/book/') || href === '/reports' || href.startsWith('/regular-payments') || href.startsWith('/insights')) && !featureOn(map, 'money')) return false;
  return featureOn(map, key);
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

export function resolveFeatures(
  uid: string,
  isSuperUser: boolean,
  books: Array<{ featureAccess?: unknown }>,
  profileFeatures?: unknown,
  roleKey?: string,
  rolePermissions?: Record<string, Partial<FeatureMap>>,
): FeatureMap {
  const defaultBase = isSuperUser ? DEFAULT_FEATURES : MEMBER_FEATURES;
  /* Effective: USER OVERRIDE > ROLE PERMISSION > SECURE DEFAULT */
  let features = { ...defaultBase };
  if (roleKey && rolePermissions?.[roleKey]) {
    features = normalizeFeatures(rolePermissions[roleKey], features);
  } else if (!isSuperUser && roleKey === 'DEFAULT_USER') {
    features = { ...MEMBER_FEATURES };
  }

  if (profileFeatures != null) {
    features = normalizeFeatures(profileFeatures, features);
  }

  for (let i = books.length - 1; i >= 0; i -= 1) {
    const grant = bookGrantRaw(books[i].featureAccess, uid);
    if (grant !== undefined) {
      features = normalizeFeatures(grant, features);
      return features;
    }
  }
  return features;
}

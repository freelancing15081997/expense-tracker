/** Canonical feature permissions across Byjan tools. Seeded into Neon; not UI-only toggles. */

export type RbacPermissionDef = {
  id: string;
  tool: 'app' | 'expense_tracker' | 'books' | 'admin';
  feature: string;
  action: string;
  label: string;
  description: string;
  sortOrder: number;
};

export const RBAC_PERMISSIONS: RbacPermissionDef[] = [
  { id: 'dashboard.view', tool: 'app', feature: 'dashboard', action: 'view', label: 'View dashboard', description: 'Open the main Byjan home dashboard.', sortOrder: 10 },
  { id: 'settings.view', tool: 'app', feature: 'settings', action: 'view', label: 'View settings', description: 'Open account and workspace preferences.', sortOrder: 20 },
  { id: 'settings.manage', tool: 'app', feature: 'settings', action: 'manage', label: 'Manage settings', description: 'Update profile, categories, and app preferences.', sortOrder: 30 },

  { id: 'expenses.view', tool: 'expense_tracker', feature: 'expenses', action: 'view', label: 'View expenses', description: 'Browse expense tracker ledgers and entries.', sortOrder: 100 },
  { id: 'expenses.create', tool: 'expense_tracker', feature: 'expenses', action: 'create', label: 'Add expenses', description: 'Create ledger entries and upload receipts.', sortOrder: 110 },
  { id: 'expenses.edit', tool: 'expense_tracker', feature: 'expenses', action: 'edit', label: 'Edit expenses', description: 'Update existing ledger entries.', sortOrder: 120 },
  { id: 'expenses.delete', tool: 'expense_tracker', feature: 'expenses', action: 'delete', label: 'Delete expenses', description: 'Soft-delete ledger entries.', sortOrder: 130 },
  { id: 'ledgers.view', tool: 'expense_tracker', feature: 'ledgers', action: 'view', label: 'View ledgers', description: 'Open shared expense ledgers.', sortOrder: 140 },
  { id: 'ledgers.create', tool: 'expense_tracker', feature: 'ledgers', action: 'create', label: 'Create ledgers', description: 'Create new expense tracker ledgers.', sortOrder: 150 },
  { id: 'ledgers.manage', tool: 'expense_tracker', feature: 'ledgers', action: 'manage', label: 'Manage ledgers', description: 'Rename, archive, or delete ledgers you manage.', sortOrder: 160 },
  { id: 'ledgers.invite', tool: 'expense_tracker', feature: 'ledgers', action: 'invite', label: 'Invite to ledgers', description: 'Invite collaborators to expense ledgers.', sortOrder: 170 },
  { id: 'inbound.email', tool: 'expense_tracker', feature: 'inbound', action: 'use', label: 'Inbound email capture', description: 'Use ledger inbound mailboxes for expense capture.', sortOrder: 180 },

  { id: 'books.access', tool: 'books', feature: 'books', action: 'access', label: 'Access Books', description: 'Open the Books ERP workspace.', sortOrder: 200 },
  { id: 'books.dashboard.view', tool: 'books', feature: 'dashboard', action: 'view', label: 'Books dashboards', description: 'Finance dashboard, CFO view, and control tower.', sortOrder: 210 },
  { id: 'books.accounting.view', tool: 'books', feature: 'accounting', action: 'view', label: 'View accounting', description: 'Chart of accounts, journals, ledger, and periods.', sortOrder: 220 },
  { id: 'books.accounting.post', tool: 'books', feature: 'accounting', action: 'post', label: 'Post accounting', description: 'Create and post journal entries and recurring items.', sortOrder: 230 },
  { id: 'books.accounting.close', tool: 'books', feature: 'accounting', action: 'close', label: 'Close periods', description: 'Close and reopen accounting periods.', sortOrder: 240 },
  { id: 'books.sales.view', tool: 'books', feature: 'sales', action: 'view', label: 'View sales', description: 'Customers, quotes, invoices, and collections.', sortOrder: 250 },
  { id: 'books.sales.manage', tool: 'books', feature: 'sales', action: 'manage', label: 'Manage sales', description: 'Create and edit sales documents.', sortOrder: 260 },
  { id: 'books.purchases.view', tool: 'books', feature: 'purchases', action: 'view', label: 'View purchases', description: 'Vendors, POs, bills, and payment runs.', sortOrder: 270 },
  { id: 'books.purchases.manage', tool: 'books', feature: 'purchases', action: 'manage', label: 'Manage purchases', description: 'Create and edit purchase documents.', sortOrder: 280 },
  { id: 'books.banking.view', tool: 'books', feature: 'banking', action: 'view', label: 'View banking', description: 'Banking and Books expenses.', sortOrder: 290 },
  { id: 'books.banking.manage', tool: 'books', feature: 'banking', action: 'manage', label: 'Manage banking', description: 'Record bank transfers and Books expenses.', sortOrder: 300 },
  { id: 'books.operations.view', tool: 'books', feature: 'operations', action: 'view', label: 'View operations', description: 'Inventory, assets, projects, budgets, and leases.', sortOrder: 310 },
  { id: 'books.operations.manage', tool: 'books', feature: 'operations', action: 'manage', label: 'Manage operations', description: 'Create and edit operations records.', sortOrder: 320 },
  { id: 'books.control.view', tool: 'books', feature: 'control', action: 'view', label: 'View control', description: 'Tax, reports, inbox, approvals, and audit.', sortOrder: 330 },
  { id: 'books.control.manage', tool: 'books', feature: 'control', action: 'manage', label: 'Manage control', description: 'Act on approvals, inbox, and control workflows.', sortOrder: 340 },
  { id: 'books.settings.manage', tool: 'books', feature: 'settings', action: 'manage', label: 'Books settings', description: 'Rename workspace and manage Books company settings.', sortOrder: 350 },
  { id: 'books.users.manage', tool: 'books', feature: 'users', action: 'manage', label: 'Books users & access', description: 'Invite people into a Books company and grant a subset of the tenant’s Books features.', sortOrder: 360 },

  { id: 'admin.access', tool: 'admin', feature: 'admin', action: 'access', label: 'Access admin', description: 'Open the platform Access & roles console (super users only).', sortOrder: 400 },
  { id: 'admin.users', tool: 'admin', feature: 'users', action: 'manage', label: 'Manage users', description: 'Invite, assign roles, and disable platform members.', sortOrder: 410 },
  { id: 'admin.roles', tool: 'admin', feature: 'roles', action: 'manage', label: 'Manage roles', description: 'Edit the default external role and custom role permission matrix.', sortOrder: 420 },
];

/** Single platform org. Signup users join as Default external; only super users see admin RBAC. */
export const PLATFORM_ORG_ID = 'org_platform';
export const PLATFORM_ORG_NAME = 'Byjan';

/**
 * Always-on platform controllers. These emails always receive Super user (full permissions).
 * Override / extend with env SUPER_USER_EMAILS (comma-separated).
 * Sign up or sign in with these emails to operate Access & roles.
 */
export const BASE_SUPER_USER_EMAILS = [
  'pujaribadrinath@gmail.com',
  'freelancing15081997@gmail.com',
] as const;


/**
 * Platform system roles.
 * - super_user: full access + Access & roles. Only a super user can promote another.
 * - external: default for signup / migrated users. Product baseline (no admin); supers can edit the matrix.
 */
export type SystemRoleKey = 'super_user' | 'external';

const ALL = () => RBAC_PERMISSIONS.map((p) => p.id);

export const SYSTEM_ROLE_DEFS: Array<{
  key: SystemRoleKey;
  name: string;
  description: string;
  /** When true, seed always overwrites permissions. When false, create empty once and preserve edits. */
  syncPermissions: boolean;
  permissions: string[] | '*' | 'product';
}> = [
  {
    key: 'super_user',
    name: 'Super user',
    description: 'Internal platform operator. Full product access plus Access & roles. Only a super user can create another super user.',
    syncPermissions: true,
    permissions: '*',
  },
  {
    key: 'external',
    name: 'Default external',
    description: 'Assigned to signup / migrated users. Keeps normal product access (no Access & roles). Super users can tighten or expand this matrix anytime.',
    syncPermissions: false,
    // Product baseline so existing users keep working after migration. Never includes admin.*.
    permissions: 'product',
  },
];

/** Client route gating — paths match HashRouter routes in App + Books catalog. */
export const ROUTE_PERMISSIONS: Array<{ match: RegExp; anyOf: string[] }> = [
  { match: /^\/$/, anyOf: ['dashboard.view'] },
  { match: /^\/expenses/, anyOf: ['expenses.view', 'ledgers.view'] },
  { match: /^\/book\//, anyOf: ['expenses.view', 'ledgers.view'] },
  { match: /^\/settings/, anyOf: ['settings.view', 'settings.manage'] },
  { match: /^\/admin/, anyOf: ['admin.access'] },
  { match: /^\/books\/(cfo|control-tower)(\/|$)/, anyOf: ['books.dashboard.view', 'books.access'] },
  { match: /^\/books\/(chart-of-accounts|journals|recurring|ledger|periods|close)(\/|$)/, anyOf: ['books.accounting.view'] },
  { match: /^\/books\/(customers|estimates|quotes|sales-orders|invoices|credit-notes|debit-notes|statements|collections)(\/|$)/, anyOf: ['books.sales.view'] },
  { match: /^\/books\/(vendors|purchase-requests|purchase-orders|purchase-receipts|bills|vendor-credits|payment-run)(\/|$)/, anyOf: ['books.purchases.view'] },
  { match: /^\/books\/(banking|expenses)(\/|$)/, anyOf: ['books.banking.view'] },
  { match: /^\/books\/(inventory|assets|projects|budgets|forecast|revenue|leases)(\/|$)/, anyOf: ['books.operations.view'] },
  { match: /^\/books\/(tax|reports|entities|companies|workbench|inbox|approvals|insights|audit)(\/|$)/, anyOf: ['books.control.view'] },
  { match: /^\/books\/settings(\/|$)/, anyOf: ['books.settings.manage', 'books.users.manage', 'books.control.view'] },
  { match: /^\/books(\/|$)/, anyOf: ['books.access', 'books.dashboard.view'] },
];

export function permissionIdsForRole(key: SystemRoleKey): string[] {
  const def = SYSTEM_ROLE_DEFS.find((r) => r.key === key);
  if (!def) return [];
  if (def.permissions === '*') return ALL();
  if (def.permissions === 'product') return ALL().filter((id) => !id.startsWith('admin.'));
  return [...def.permissions];
}

/** Product features only — used as the safe Default external baseline during migration. */
export function productPermissionIds(): string[] {
  return ALL().filter((id) => !id.startsWith('admin.'));
}


export function requiredPermissionForPath(pathname: string): string[] | null {
  const path = pathname.replace(/\/ledger\/.+$/, '/ledger') || '/';
  for (const row of ROUTE_PERMISSIONS) {
    if (row.match.test(path)) return row.anyOf;
  }
  return null;
}

export function isAdminPermission(permissionId: string) {
  return permissionId.startsWith('admin.');
}

export function isBooksPermission(permissionId: string) {
  return permissionId.startsWith('books.');
}

import { apiPost } from './api';
import {
  grantsOnBook,
  MEMBER_FEATURES,
  normalizeFeatures,
  type FeatureMap,
} from './features';
import { listLedgers, updateLedger, type LedgerBook } from './ledgers';
import { getRolePermissions } from './money-api';
import { emailIsSuperUser } from './super-users';

export type MeProfile = {
  uid: string;
  email?: string;
  displayName?: string;
  defaultCurrency?: string;
  customCategories?: string[];
  photoURL?: string;
  appPrefs?: Record<string, unknown>;
  orgUiDefaults?: Record<string, unknown> | null;
  features?: FeatureMap;
  featureOverride?: FeatureMap | null;
  hasFeatureOverride?: boolean;
  isSuperUser?: boolean;
  status?: string;
  rolePermissions?: Record<string, Partial<FeatureMap>>;
  [key: string]: unknown;
};

export type AccessPerson = {
  uid: string;
  email: string;
  displayName: string;
  features: FeatureMap;
  hasFeatureOverride?: boolean;
  featureOverride?: FeatureMap | null;
};

let rolePermCache: { at: number; roles: Record<string, Partial<FeatureMap>> } | null = null;

export function invalidateRolePermissionCache() {
  rolePermCache = null;
}

async function loadRolePermissionMap() {
  if (rolePermCache && Date.now() - rolePermCache.at < 20_000) return rolePermCache.roles;
  try {
    const roles = await getRolePermissions();
    rolePermCache = { at: Date.now(), roles: roles || {} };
    return rolePermCache.roles;
  } catch {
    return rolePermCache?.roles || {};
  }
}

function managesBook(book: LedgerBook, uid: string) {
  const role = String(book.roles?.[uid]?.role || '');
  return role === 'owner' || book.ownerId === uid;
}

function personOnBook(book: LedgerBook, uid: string) {
  return Boolean(book.roles?.[uid] || book.ownerId === uid);
}

/**
 * Profile for the signed-in user.
 * Server returns effective `features` — do not re-resolve on the client
 * (that was overwriting Access & roles saves).
 */
export async function getMe() {
  const payload = await apiPost<{
    user?: MeProfile | null;
    orgUiDefaults?: Record<string, unknown> | null;
    rolePermissions?: Record<string, Partial<FeatureMap>>;
  }>('/api/me', { op: 'get' });
  const user = payload.user || null;
  if (!user) return null;
  if (payload.orgUiDefaults && !user.orgUiDefaults) user.orgUiDefaults = payload.orgUiDefaults;
  if (payload.rolePermissions) {
    rolePermCache = { at: Date.now(), roles: payload.rolePermissions };
    user.rolePermissions = payload.rolePermissions;
  }
  const accountStatus = String(user.status || '').toLowerCase();
  if (accountStatus === 'deleted' || accountStatus === 'deactivated') {
    return { ...user, features: { ...MEMBER_FEATURES }, isSuperUser: false };
  }
  const isSuperUser = emailIsSuperUser(user.email) || user.isSuperUser === true;
  const features = user.features && typeof user.features === 'object'
    ? normalizeFeatures(user.features, MEMBER_FEATURES)
    : { ...MEMBER_FEATURES };
  return {
    ...user,
    features,
    hasFeatureOverride: user.hasFeatureOverride === true,
    featureOverride: user.featureOverride && typeof user.featureOverride === 'object'
      ? user.featureOverride as FeatureMap
      : null,
    isSuperUser,
  };
}

export async function upsertMe(patch: Record<string, unknown>) {
  const { isSuperUser: _super, features: _features, featureOverride: _fo, hasFeatureOverride: _hfo, ...safe } = patch;
  const payload = await apiPost<{ user: MeProfile }>('/api/me', { op: 'upsert', patch: safe });
  return payload.user;
}

export async function saveOrgUiDefaults(chrome: Record<string, unknown>) {
  const payload = await apiPost<{ orgUiDefaults?: Record<string, unknown> }>('/api/me', {
    op: 'setOrgUi',
    chrome,
  });
  return payload.orgUiDefaults || chrome;
}

function personFromRole(uid: string, email: string): AccessPerson {
  return {
    uid,
    email,
    displayName: email.split('@')[0] || 'Person',
    features: { ...MEMBER_FEATURES },
    hasFeatureOverride: false,
    featureOverride: null,
  };
}

/** People list for Access & roles — editor uses stored override when present. */
export async function listAccessPeople(actorEmail?: string): Promise<AccessPerson[]> {
  if (!emailIsSuperUser(actorEmail)) return [];
  const map = new Map<string, AccessPerson>();
  try {
    const books = await listLedgers();
    for (const book of books) {
      for (const [uid, row] of Object.entries(book.roles || {})) {
        if (map.has(uid)) continue;
        map.set(uid, personFromRole(uid, String(row.email || '')));
      }
    }
  } catch {
    /* books optional */
  }
  try {
    const payload = await apiPost<{ people?: AccessPerson[] }>('/api/me', { op: 'people' });
    if (Array.isArray(payload.people)) {
      for (const row of payload.people) {
        const uid = String(row.uid || '');
        if (!uid) continue;
        const override = row.hasFeatureOverride === true && row.features && typeof row.features === 'object'
          ? normalizeFeatures(row.featureOverride || row.features, MEMBER_FEATURES)
          : row.featureOverride && typeof row.featureOverride === 'object'
            ? normalizeFeatures(row.featureOverride, MEMBER_FEATURES)
            : null;
        const features = override
          || (row.features && typeof row.features === 'object'
            ? normalizeFeatures(row.features, MEMBER_FEATURES)
            : { ...MEMBER_FEATURES });
        map.set(uid, {
          uid,
          email: String(row.email || map.get(uid)?.email || ''),
          displayName: String(row.displayName || map.get(uid)?.displayName || row.email || 'Person'),
          hasFeatureOverride: Boolean(override) || row.hasFeatureOverride === true,
          featureOverride: override,
          features,
        });
      }
    }
  } catch {
    /* older API */
  }
  return [...map.values()].sort(
    (a, b) => a.displayName.localeCompare(b.displayName) || a.email.localeCompare(b.email),
  );
}

export async function setPersonFeatures(userId: string, features: FeatureMap, actorUid: string, actorEmail?: string) {
  if (!emailIsSuperUser(actorEmail)) {
    throw new Error('Only a super user can change access.');
  }
  try {
    const payload = await apiPost<{ user?: MeProfile }>('/api/me', { op: 'setFeatures', userId, features });
    if (payload?.user) return payload.user;
  } catch (err) {
    const status = err && typeof err === 'object' && 'status' in err ? Number((err as { status?: number }).status) : 0;
    const message = err instanceof Error ? err.message : '';
    if (status === 403) throw err;
    if (status && status !== 400) throw err;
    if (message && !/unknown profile operation/i.test(message)) throw err;
  }

  // Legacy fallback only if API does not support setFeatures.
  const books = await listLedgers();
  const targets = books.filter((book) => personOnBook(book, userId) && (managesBook(book, actorUid) || emailIsSuperUser(actorEmail)));
  if (!targets.length) throw new Error('That person is not on a money book you can update yet.');
  for (const book of targets) {
    const current = grantsOnBook(book.featureAccess);
    await updateLedger(book.id, { featureAccess: { ...current, [userId]: features } });
  }
  return { uid: userId, features, hasFeatureOverride: true };
}

import { apiPost } from './api';
import { MEMBER_FEATURES, grantsOnBook, resolveFeatures, type FeatureMap } from './features';
import { listLedgers, updateLedger, type LedgerBook } from './ledgers';
import { emailIsSuperUser } from './super-users';

export type MeProfile = {
  uid: string;
  email?: string;
  displayName?: string;
  defaultCurrency?: string;
  customCategories?: string[];
  photoURL?: string;
  appPrefs?: Record<string, unknown>;
  features?: FeatureMap;
  isSuperUser?: boolean;
  createdAt?: unknown;
  [key: string]: unknown;
};

export type AccessPerson = {
  uid: string;
  email: string;
  displayName: string;
  features: FeatureMap;
};

function managesBook(book: LedgerBook, uid: string) {
  const role = String(book.roles?.[uid]?.role || '');
  return role === 'owner' || book.ownerId === uid;
}

function isAppSuperUser(email?: string | null) {
  return emailIsSuperUser(email);
}

function personOnBook(book: LedgerBook, uid: string) {
  return Boolean(book.roles?.[uid] || book.ownerId === uid);
}

export async function getMe() {
  const payload = await apiPost<{ user?: MeProfile | null }>('/api/me', { op: 'get' });
  const user = payload.user || null;
  if (!user) return null;
  const uid = String(user.uid || '');
  const isSuperUser = isAppSuperUser(user.email);
  let features = resolveFeatures(uid, isSuperUser, [], user.features);
  try {
    const books = await listLedgers();
    features = resolveFeatures(uid, isSuperUser, books as Array<{ featureAccess?: unknown }>, user.features);
  } catch {
    /* keep profile defaults */
  }
  return { ...user, features, isSuperUser };
}

export async function upsertMe(patch: Record<string, unknown>) {
  const { isSuperUser: _super, features: _features, ...safe } = patch;
  const payload = await apiPost<{ user: MeProfile }>('/api/me', { op: 'upsert', patch: safe });
  return payload.user;
}

function personFromRole(uid: string, email: string): AccessPerson {
  return {
    uid,
    email,
    displayName: email.split('@')[0] || 'Person',
    features: { ...MEMBER_FEATURES },
  };
}

export async function listAccessPeople(actorEmail?: string): Promise<AccessPerson[]> {
  if (!emailIsSuperUser(actorEmail)) return [];
  const books = await listLedgers();
  const map = new Map<string, AccessPerson>();
  for (const book of books) {
    for (const [uid, row] of Object.entries(book.roles || {})) {
      if (map.has(uid)) continue;
      map.set(uid, personFromRole(uid, String(row.email || '')));
    }
  }
  try {
    const payload = await apiPost<{ people?: AccessPerson[] }>('/api/me', { op: 'people' });
    if (Array.isArray(payload.people)) {
      for (const row of payload.people) {
        const uid = String(row.uid || '');
        if (!uid) continue;
        const current = map.get(uid);
        map.set(uid, {
          uid,
          email: String(row.email || current?.email || ''),
          displayName: String(row.displayName || current?.displayName || row.email || 'Person'),
          features: row.features && typeof row.features === 'object'
            ? row.features as FeatureMap
            : current?.features || { ...MEMBER_FEATURES },
        });
      }
    }
  } catch {
    /* older API: people already gathered from books */
  }
  return [...map.values()].map((person) => ({
    ...person,
    features: resolveFeatures(person.uid, emailIsSuperUser(person.email), books as Array<{ featureAccess?: unknown }>, person.features),
  })).sort((a, b) => a.displayName.localeCompare(b.displayName) || a.email.localeCompare(b.email));
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

  const books = await listLedgers();
  const targets = books.filter((book) => personOnBook(book, userId) && (managesBook(book, actorUid) || emailIsSuperUser(actorEmail)));
  if (!targets.length) throw new Error('That person is not on a money book you can update yet.');
  for (const book of targets) {
    const current = grantsOnBook(book.featureAccess);
    await updateLedger(book.id, { featureAccess: { ...current, [userId]: features } });
  }
  return { uid: userId, features };
}

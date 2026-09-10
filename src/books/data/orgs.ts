import { collection, doc, getDoc, getDocs, setDoc, updateDoc, newDocId, type Firestore } from '../../lib/store';
import { clean } from '../core/clean';
import { childWorkspaceId, MAX_ORG_DEPTH, type OrgRecord } from '../core/hierarchy';
import { assertCan } from '../core/permissions';
import type { BooksRole, FinanceTenant } from '../core/types';
import { BooksError } from '../engine/journal';
import { col, seedWorkspace, tenantRef, writeTenantMeta } from './repo';

function orgIndexCol(db: Firestore, uid: string) {
  return collection(db, 'erp_workspaces', uid, 'org_index');
}

function asOrg(id: string, data: Record<string, unknown>, fallback?: Partial<OrgRecord>): OrgRecord {
  return {
    id,
    name: String(data.name || fallback?.name || 'Company'),
    parentId: (data.parentId as string | null | undefined) ?? fallback?.parentId ?? null,
    depth: Number(data.depth ?? fallback?.depth ?? 0),
    kind: (data.kind as OrgRecord['kind']) || fallback?.kind || 'company',
    role: String(data.role || fallback?.role || 'owner'),
  };
}

export async function listOrgDirectory(db: Firestore, uid: string, rootName: string): Promise<OrgRecord[]> {
  const root: OrgRecord = {
    id: uid,
    name: rootName || 'Books',
    parentId: null,
    depth: 0,
    kind: 'root',
    role: 'owner',
  };
  const snap = await getDocs(orgIndexCol(db, uid));
  const children = snap.docs.map((row) => asOrg(row.id, row.data() as Record<string, unknown>));
  const byId = new Map<string, OrgRecord>([[root.id, root]]);
  for (const row of children) {
    if (row.id === uid) continue;
    byId.set(row.id, row);
  }
  return [...byId.values()];
}

export async function createChildWorkspace(
  db: Firestore,
  input: {
    uid: string;
    email: string;
    displayName: string;
    parentId: string;
    name: string;
    role: BooksRole;
  },
) {
  assertCan(input.role, 'manage_settings');
  const name = input.name.trim();
  if (name.length < 2) throw new BooksError('Company name is required');
  const parentSnap = await getDoc(tenantRef(db, input.parentId));
  if (!parentSnap.exists()) throw new BooksError('Parent company was not found');
  const parent = { id: input.parentId, ...parentSnap.data() } as FinanceTenant;
  const depth = Number(parent.depth || 0) + 1;
  if (depth > MAX_ORG_DEPTH) throw new BooksError(`Companies can nest ${MAX_ORG_DEPTH} levels under the root workspace`);
  const tenantId = childWorkspaceId(input.uid, newDocId());
  const kind = depth === 1 ? 'company' : 'subsidiary';
  await setDoc(doc(orgIndexCol(db, input.uid), tenantId), clean({
    name,
    parentId: input.parentId,
    depth,
    kind,
    role: 'owner',
    createdAt: new Date().toISOString(),
  }));
  await writeTenantMeta(db, {
    tenantId,
    uid: input.uid,
    email: input.email,
    name,
    parentId: input.parentId,
    depth,
    kind,
  });
  await seedWorkspace(db, tenantId, input.uid, name);
  return tenantId;
}

export async function syncOrgIndexName(db: Firestore, uid: string, tenantId: string, name: string) {
  if (tenantId === uid) return;
  const ref = doc(orgIndexCol(db, uid), tenantId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  await updateDoc(ref, { name });
}

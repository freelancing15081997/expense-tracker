export const MAX_ORG_DEPTH = 3;
export const BOOKS_WORKSPACE_EVENT = 'byjan:books-workspace';

export type OrgRecord = {
  id: string;
  name: string;
  parentId: string | null;
  depth: number;
  kind: 'root' | 'company' | 'subsidiary';
  role: string;
};

export function ownsWorkspace(uid: string, workspaceId: string) {
  if (!uid || !workspaceId) return false;
  return workspaceId === uid || workspaceId.startsWith(`${uid}_`);
}

export function childWorkspaceId(uid: string, suffix: string) {
  return `${uid}_${suffix}`;
}

function activeKey(uid: string) {
  return `byjan_books_workspace_${uid}`;
}

export function readActiveWorkspace(uid: string) {
  try {
    const id = sessionStorage.getItem(activeKey(uid)) || '';
    return ownsWorkspace(uid, id) ? id : uid;
  } catch {
    return uid;
  }
}

export function writeActiveWorkspace(uid: string, workspaceId: string) {
  if (!ownsWorkspace(uid, workspaceId)) return;
  try {
    sessionStorage.setItem(activeKey(uid), workspaceId);
  } catch {
    // private mode
  }
}

export function selectWorkspace(uid: string, workspaceId: string) {
  writeActiveWorkspace(uid, workspaceId);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(BOOKS_WORKSPACE_EVENT, { detail: { id: workspaceId } }));
  }
}

export function buildOrgTree(rows: OrgRecord[]) {
  const byParent = new Map<string | null, OrgRecord[]>();
  for (const row of rows) {
    const key = row.parentId;
    const list = byParent.get(key) || [];
    list.push(row);
    byParent.set(key, list);
  }
  for (const list of byParent.values()) {
    list.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  }
  const walk = (parentId: string | null, depth: number): Array<OrgRecord & { indent: number }> => {
    const children = byParent.get(parentId) || [];
    return children.flatMap((row) => [{ ...row, indent: depth }, ...walk(row.id, depth + 1)]);
  };
  const rooted = walk(null, 0);
  if (rooted.length) return rooted;
  return rows.map((row) => ({ ...row, indent: row.depth || 0 }));
}

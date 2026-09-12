import { apiPost } from './api';

export type RbacPermission = {
  id: string;
  tool: string;
  feature: string;
  action: string;
  label: string;
  description: string;
  sortOrder: number;
};

export type RbacRole = {
  id: string;
  orgId: string;
  key: string;
  name: string;
  description: string;
  isSystem: boolean;
  permissionIds: string[];
  memberCount: number;
};

export type RbacMember = {
  orgId: string;
  uid: string;
  roleId: string;
  roleKey: string;
  roleName: string;
  email: string;
  displayName: string;
  status: string;
  invitedBy: string;
  createdAt?: string;
  updatedAt?: string;
};

export type RbacInvite = {
  id: string;
  orgId: string;
  email: string;
  roleId: string;
  roleKey: string;
  roleName: string;
  status: string;
  invitedBy: string;
  token: string;
  createdAt?: string;
  expiresAt?: string | null;
};

export type RbacOrg = {
  id: string;
  name: string;
  ownerUid: string;
};

export type RbacSession = {
  org: RbacOrg;
  member: RbacMember;
  permissions: string[];
  roles: RbacRole[];
  permissionCatalog: RbacPermission[];
};

export async function fetchRbacSession(displayName = '') {
  const payload = await apiPost<{ session: RbacSession }>('/api/rbac', { op: 'session', displayName });
  return payload.session;
}

export async function fetchRbacMembers() {
  return apiPost<{
    org: RbacOrg;
    member: RbacMember;
    members: RbacMember[];
    roles: RbacRole[];
    permissions: string[];
    permissionCatalog: RbacPermission[];
  }>('/api/rbac', { op: 'listMembers' });
}

export async function fetchRbacInvites() {
  const payload = await apiPost<{ invites: RbacInvite[] }>('/api/rbac', { op: 'listInvites' });
  return payload.invites || [];
}

export async function inviteRbacMember(email: string, roleId: string) {
  return apiPost<{ joined: boolean; uid?: string; invite?: RbacInvite }>('/api/rbac', {
    op: 'inviteMember',
    email,
    roleId,
  });
}

export async function updateRbacMember(uid: string, patch: { roleId?: string; status?: string }) {
  const payload = await apiPost<{ member: RbacMember | null }>('/api/rbac', {
    op: 'updateMember',
    uid,
    ...patch,
  });
  return payload.member;
}

export async function removeRbacMember(uid: string) {
  return apiPost<{ ok: boolean }>('/api/rbac', { op: 'removeMember', uid });
}

export async function cancelRbacInvite(inviteId: string) {
  return apiPost<{ ok: boolean }>('/api/rbac', { op: 'cancelInvite', inviteId });
}

export async function createRbacRole(input: { name: string; description?: string; permissionIds: string[] }) {
  const payload = await apiPost<{ role: RbacRole | null }>('/api/rbac', { op: 'createRole', ...input });
  return payload.role;
}

export async function updateRbacRole(input: {
  roleId: string;
  name?: string;
  description?: string;
  permissionIds?: string[];
}) {
  const payload = await apiPost<{ role: RbacRole | null }>('/api/rbac', { op: 'updateRole', ...input });
  return payload.role;
}

export async function deleteRbacRole(roleId: string) {
  return apiPost<{ ok: boolean }>('/api/rbac', { op: 'deleteRole', roleId });
}

export async function renameRbacOrg(name: string) {
  const payload = await apiPost<{ org: RbacOrg | null }>('/api/rbac', { op: 'renameOrg', name });
  return payload.org;
}

export function hasPermission(permissions: string[] | null | undefined, id: string) {
  return Boolean(permissions?.includes(id));
}

export function hasAnyPermission(permissions: string[] | null | undefined, ids: string[]) {
  return ids.some((id) => hasPermission(permissions, id));
}

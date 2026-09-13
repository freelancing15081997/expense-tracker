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
  grantIds?: string[];
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
  isSuperUser?: boolean;
};

export async function fetchRbacSession(displayName = '') {
  const payload = await apiPost<{ session: RbacSession }>('/api/rbac', { op: 'session', displayName });
  return payload.session;
}

export async function fetchRbacMembers(input: { query?: string; page?: number; pageSize?: number } = {}) {
  return apiPost<{
    org: RbacOrg;
    member: RbacMember;
    members: RbacMember[];
    roles: RbacRole[];
    permissions: string[];
    permissionCatalog: RbacPermission[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }>('/api/rbac', {
    op: 'listMembers',
    query: input.query || '',
    page: input.page || 1,
    pageSize: input.pageSize || 25,
  });
}

export async function fetchRbacInvites() {
  const payload = await apiPost<{ invites: RbacInvite[] }>('/api/rbac', { op: 'listInvites' });
  return payload.invites || [];
}

export async function inviteRbacMember(email: string, roleId: string, permissionIds: string[] = []) {
  return apiPost<{ joined: boolean; uid?: string; invite?: RbacInvite }>('/api/rbac', {
    op: 'inviteMember',
    email,
    roleId,
    permissionIds,
  });
}

export async function createRbacUser(input: {
  email: string;
  displayName?: string;
  password?: string;
  roleId: string;
  permissionIds?: string[];
}) {
  return apiPost<{
    joined: boolean;
    uid?: string;
    provisioned?: boolean;
    grantIds?: string[];
    member?: RbacMember | null;
    invite?: RbacInvite;
  }>('/api/rbac', {
    op: 'createUser',
    email: input.email,
    displayName: input.displayName || '',
    password: input.password || '',
    roleId: input.roleId,
    permissionIds: input.permissionIds || [],
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


export async function grantBooksFeatures(input: { email?: string; uid?: string; permissionIds: string[] }) {
  return apiPost<{ pending?: boolean; joined?: boolean; email?: string; uid?: string; permissionIds?: string[]; inviteId?: string }>('/api/rbac', {
    op: 'grantBooksFeatures',
    ...input,
  });
}

export async function revokeBooksFeatures(input: { uid: string; permissionIds?: string[] }) {
  return apiPost<{ ok: boolean; permissionIds: string[] }>('/api/rbac', {
    op: 'revokeBooksFeatures',
    ...input,
  });
}

export async function setMemberPrivileges(uid: string, permissionIds: string[]) {
  return apiPost<{ ok: boolean; uid: string; grantIds: string[]; effectiveIds: string[] }>('/api/rbac', {
    op: 'setMemberPrivileges',
    uid,
    permissionIds,
  });
}

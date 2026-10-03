/** Book actions a super user (Owner) always keeps. */
export const ACTIONS = ['add', 'editAll', 'del', 'approve', 'invite', 'export'] as const;
export type Action = (typeof ACTIONS)[number];

export function ownerPerms(): Record<Action, boolean> {
  return { add: true, editAll: true, del: true, approve: true, invite: true, export: true };
}

/** Owner cannot be reduced. Other roles take the requested permissions. */
export function applyRoleUpdate(
  role: string,
  perms: Record<string, boolean> | undefined,
  approvalLimit: number | null | undefined,
  currentLimit: number | null,
): { perms: Record<string, boolean>; approvalLimit: number | null } {
  if (role === 'Owner') return { perms: ownerPerms(), approvalLimit: null };
  return {
    perms: { ...(perms ?? {}) },
    approvalLimit: approvalLimit === undefined ? currentLimit : approvalLimit,
  };
}

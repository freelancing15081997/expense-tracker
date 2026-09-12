import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ApiError, apiJson, withDomainApi } from './_pg-tables.js';
import {
  cancelOrgInvite,
  createCustomRole,
  deleteCustomRole,
  getRbacSession,
  grantBooksFeatures,
  inviteOrgMember,
  listOrgInvites,
  listOrgMembers,
  removeOrgMember,
  renameOrg,
  revokeBooksFeatures,
  setMemberPrivileges,
  updateCustomRole,
  updateOrgMember,
} from './_lib/rbac.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  await withDomainApi(req as any, res as any, async (user, body) => {
    const op = String(body.op || 'session');
    const displayName = String(body.displayName || '').trim();

    if (op === 'session') {
      apiJson(res as any, 200, { session: await getRbacSession(user, displayName) });
      return;
    }

    if (op === 'listMembers') {
      const payload = await listOrgMembers(user);
      apiJson(res as any, 200, {
        org: payload.org,
        member: payload.member,
        members: payload.members,
        roles: payload.roles,
        permissions: payload.permissions,
        permissionCatalog: payload.permissionCatalog,
      });
      return;
    }

    if (op === 'listInvites') {
      const payload = await listOrgInvites(user);
      apiJson(res as any, 200, { invites: payload.invites });
      return;
    }

    if (op === 'inviteMember') {
      apiJson(res as any, 200, await inviteOrgMember(user, {
        email: String(body.email || ''),
        roleId: String(body.roleId || ''),
      }));
      return;
    }

    if (op === 'updateMember') {
      apiJson(res as any, 200, {
        member: await updateOrgMember(user, {
          uid: String(body.uid || ''),
          roleId: body.roleId != null ? String(body.roleId) : undefined,
          status: body.status != null ? String(body.status) : undefined,
        }),
      });
      return;
    }

    if (op === 'removeMember') {
      apiJson(res as any, 200, await removeOrgMember(user, String(body.uid || '')));
      return;
    }

    if (op === 'cancelInvite') {
      apiJson(res as any, 200, await cancelOrgInvite(user, String(body.inviteId || '')));
      return;
    }

    if (op === 'createRole') {
      apiJson(res as any, 200, {
        role: await createCustomRole(user, {
          name: String(body.name || ''),
          description: body.description != null ? String(body.description) : '',
          permissionIds: Array.isArray(body.permissionIds) ? body.permissionIds.map(String) : [],
        }),
      });
      return;
    }

    if (op === 'updateRole') {
      apiJson(res as any, 200, {
        role: await updateCustomRole(user, {
          roleId: String(body.roleId || ''),
          name: body.name != null ? String(body.name) : undefined,
          description: body.description != null ? String(body.description) : undefined,
          permissionIds: Array.isArray(body.permissionIds) ? body.permissionIds.map(String) : undefined,
        }),
      });
      return;
    }

    if (op === 'deleteRole') {
      apiJson(res as any, 200, await deleteCustomRole(user, String(body.roleId || '')));
      return;
    }

    if (op === 'renameOrg') {
      apiJson(res as any, 200, { org: await renameOrg(user, String(body.name || '')) });
      return;
    }

    if (op === 'grantBooksFeatures') {
      apiJson(res as any, 200, await grantBooksFeatures(user, {
        email: body.email != null ? String(body.email) : undefined,
        uid: body.uid != null ? String(body.uid) : undefined,
        permissionIds: Array.isArray(body.permissionIds) ? body.permissionIds.map(String) : [],
      }));
      return;
    }

    if (op === 'revokeBooksFeatures') {
      apiJson(res as any, 200, await revokeBooksFeatures(user, {
        uid: String(body.uid || ''),
        permissionIds: Array.isArray(body.permissionIds) ? body.permissionIds.map(String) : undefined,
      }));
      return;
    }

    if (op === 'setMemberPrivileges') {
      apiJson(res as any, 200, await setMemberPrivileges(user, {
        uid: String(body.uid || ''),
        permissionIds: Array.isArray(body.permissionIds) ? body.permissionIds.map(String) : [],
      }));
      return;
    }

    throw new ApiError(400, 'Unknown RBAC operation');
  });
}

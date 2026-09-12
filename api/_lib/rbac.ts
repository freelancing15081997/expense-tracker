import { randomBytes } from 'node:crypto';
import {
  ApiError,
  getLedgerSql,
  ledgerGetUser,
  ledgerUpsertUser,
  newLedgerId,
} from '../_pg-tables.js';
import type { ApiUser } from './pg-tables';
import {
  RBAC_PERMISSIONS,
  SYSTEM_ROLE_DEFS,
  permissionIdsForRole,
  type SystemRoleKey,
} from './rbac-catalog';

type Sql = {
  (strings: TemplateStringsArray, ...values: unknown[]): Promise<Record<string, unknown>[]>;
};

function rows<T extends Record<string, unknown> = Record<string, unknown>>(result: unknown): T[] {
  return Array.isArray(result) ? (result as T[]) : [];
}

function text(value: unknown) {
  return value == null ? '' : String(value);
}

function emailOf(value: unknown) {
  return text(value).trim().toLowerCase();
}

function newId(prefix: string) {
  return `${prefix}${randomBytes(10).toString('hex')}`;
}

let rbacReady = false;

export async function ensureRbacSchema(sql?: Sql) {
  const db = (sql || (await getLedgerSql())) as Sql;

  await db`
    CREATE TABLE IF NOT EXISTS orgs (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL DEFAULT '',
      owner_uid TEXT NOT NULL DEFAULT '',
      data JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await db`CREATE INDEX IF NOT EXISTS orgs_owner_idx ON orgs (owner_uid)`;

  await db`
    CREATE TABLE IF NOT EXISTS rbac_permissions (
      id TEXT PRIMARY KEY,
      tool TEXT NOT NULL,
      feature TEXT NOT NULL,
      action TEXT NOT NULL,
      label TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL DEFAULT '',
      sort_order INT NOT NULL DEFAULT 0,
      data JSONB NOT NULL DEFAULT '{}'::jsonb,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await db`
    CREATE TABLE IF NOT EXISTS rbac_roles (
      id TEXT PRIMARY KEY,
      org_id TEXT NOT NULL,
      key TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      is_system BOOLEAN NOT NULL DEFAULT FALSE,
      data JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (org_id, key)
    )
  `;
  await db`CREATE INDEX IF NOT EXISTS rbac_roles_org_idx ON rbac_roles (org_id)`;

  await db`
    CREATE TABLE IF NOT EXISTS rbac_role_permissions (
      role_id TEXT NOT NULL,
      permission_id TEXT NOT NULL,
      PRIMARY KEY (role_id, permission_id)
    )
  `;

  await db`
    CREATE TABLE IF NOT EXISTS org_members (
      org_id TEXT NOT NULL,
      uid TEXT NOT NULL,
      role_id TEXT NOT NULL,
      email TEXT,
      display_name TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      invited_by TEXT,
      data JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (org_id, uid)
    )
  `;
  await db`CREATE INDEX IF NOT EXISTS org_members_uid_idx ON org_members (uid)`;
  await db`CREATE INDEX IF NOT EXISTS org_members_email_idx ON org_members (email)`;

  await db`
    CREATE TABLE IF NOT EXISTS org_invites (
      id TEXT PRIMARY KEY,
      org_id TEXT NOT NULL,
      email TEXT NOT NULL,
      role_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      invited_by TEXT,
      token TEXT NOT NULL,
      data JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at TIMESTAMPTZ
    )
  `;
  await db`CREATE INDEX IF NOT EXISTS org_invites_org_idx ON org_invites (org_id, status)`;
  await db`CREATE INDEX IF NOT EXISTS org_invites_email_idx ON org_invites (email, status)`;
  await db`CREATE UNIQUE INDEX IF NOT EXISTS org_invites_token_idx ON org_invites (token)`;

  for (const perm of RBAC_PERMISSIONS) {
    await db`
      INSERT INTO rbac_permissions (id, tool, feature, action, label, description, sort_order, updated_at)
      VALUES (
        ${perm.id}, ${perm.tool}, ${perm.feature}, ${perm.action},
        ${perm.label}, ${perm.description}, ${perm.sortOrder}, NOW()
      )
      ON CONFLICT (id) DO UPDATE SET
        tool = EXCLUDED.tool,
        feature = EXCLUDED.feature,
        action = EXCLUDED.action,
        label = EXCLUDED.label,
        description = EXCLUDED.description,
        sort_order = EXCLUDED.sort_order,
        updated_at = NOW()
    `;
  }

  rbacReady = true;
}

async function sqlReady() {
  const sql = (await getLedgerSql()) as Sql;
  if (!rbacReady) await ensureRbacSchema(sql);
  return sql;
}

export type OrgRecord = {
  id: string;
  name: string;
  ownerUid: string;
  createdAt?: string;
  updatedAt?: string;
};

export type RoleRecord = {
  id: string;
  orgId: string;
  key: string;
  name: string;
  description: string;
  isSystem: boolean;
  permissionIds: string[];
  memberCount: number;
};

export type MemberRecord = {
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

export type InviteRecord = {
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

export type RbacSession = {
  org: OrgRecord;
  member: MemberRecord;
  permissions: string[];
  roles: RoleRecord[];
  permissionCatalog: typeof RBAC_PERMISSIONS;
};

async function seedSystemRoles(sql: Sql, orgId: string) {
  const map: Record<string, string> = {};
  for (const def of SYSTEM_ROLE_DEFS) {
    const existing = rows<{ id: string }>(
      await sql`SELECT id FROM rbac_roles WHERE org_id = ${orgId} AND key = ${def.key} LIMIT 1`,
    )[0];
    const roleId = text(existing?.id) || newId('role_');
    await sql`
      INSERT INTO rbac_roles (id, org_id, key, name, description, is_system, updated_at)
      VALUES (${roleId}, ${orgId}, ${def.key}, ${def.name}, ${def.description}, TRUE, NOW())
      ON CONFLICT (org_id, key) DO UPDATE SET
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        is_system = TRUE,
        updated_at = NOW()
    `;
    const saved = rows<{ id: string }>(
      await sql`SELECT id FROM rbac_roles WHERE org_id = ${orgId} AND key = ${def.key} LIMIT 1`,
    )[0];
    const id = text(saved?.id) || roleId;
    map[def.key] = id;

    const wanted = new Set(permissionIdsForRole(def.key as SystemRoleKey));
    const current = rows<{ permission_id: string }>(
      await sql`SELECT permission_id FROM rbac_role_permissions WHERE role_id = ${id}`,
    ).map((r) => text(r.permission_id));
    const have = new Set(current);

    for (const permissionId of wanted) {
      if (have.has(permissionId)) continue;
      await sql`
        INSERT INTO rbac_role_permissions (role_id, permission_id)
        VALUES (${id}, ${permissionId})
        ON CONFLICT DO NOTHING
      `;
    }
    for (const permissionId of have) {
      if (wanted.has(permissionId)) continue;
      await sql`DELETE FROM rbac_role_permissions WHERE role_id = ${id} AND permission_id = ${permissionId}`;
    }
  }
  return map;
}

async function getOrg(sql: Sql, orgId: string): Promise<OrgRecord | null> {
  const row = rows<{ id: string; name: string; owner_uid: string; created_at: string; updated_at: string }>(
    await sql`SELECT id, name, owner_uid, created_at, updated_at FROM orgs WHERE id = ${orgId} LIMIT 1`,
  )[0];
  if (!row) return null;
  return {
    id: text(row.id),
    name: text(row.name),
    ownerUid: text(row.owner_uid),
    createdAt: text(row.created_at),
    updatedAt: text(row.updated_at),
  };
}

async function rolePermissions(sql: Sql, roleId: string) {
  return rows<{ permission_id: string }>(
    await sql`SELECT permission_id FROM rbac_role_permissions WHERE role_id = ${roleId}`,
  ).map((r) => text(r.permission_id)).filter(Boolean);
}

async function listRoles(sql: Sql, orgId: string): Promise<RoleRecord[]> {
  const list = rows<{
    id: string;
    org_id: string;
    key: string;
    name: string;
    description: string;
    is_system: boolean;
    member_count: string | number;
  }>(
    await sql`
      SELECT r.id, r.org_id, r.key, r.name, r.description, r.is_system,
        COALESCE((
          SELECT COUNT(*) FROM org_members m
          WHERE m.role_id = r.id AND m.status = 'active'
        ), 0) AS member_count
      FROM rbac_roles r
      WHERE r.org_id = ${orgId}
      ORDER BY r.is_system DESC, r.name ASC
    `,
  );
  const out: RoleRecord[] = [];
  for (const row of list) {
    out.push({
      id: text(row.id),
      orgId: text(row.org_id),
      key: text(row.key),
      name: text(row.name),
      description: text(row.description),
      isSystem: Boolean(row.is_system),
      permissionIds: await rolePermissions(sql, text(row.id)),
      memberCount: Number(row.member_count || 0),
    });
  }
  return out;
}

async function getMember(sql: Sql, orgId: string, uid: string): Promise<MemberRecord | null> {
  const row = rows<{
    org_id: string;
    uid: string;
    role_id: string;
    email: string;
    display_name: string;
    status: string;
    invited_by: string;
    created_at: string;
    updated_at: string;
    role_key: string;
    role_name: string;
  }>(
    await sql`
      SELECT m.org_id, m.uid, m.role_id, m.email, m.display_name, m.status, m.invited_by,
        m.created_at, m.updated_at, r.key AS role_key, r.name AS role_name
      FROM org_members m
      JOIN rbac_roles r ON r.id = m.role_id
      WHERE m.org_id = ${orgId} AND m.uid = ${uid}
      LIMIT 1
    `,
  )[0];
  if (!row) return null;
  return {
    orgId: text(row.org_id),
    uid: text(row.uid),
    roleId: text(row.role_id),
    roleKey: text(row.role_key),
    roleName: text(row.role_name),
    email: emailOf(row.email),
    displayName: text(row.display_name),
    status: text(row.status) || 'active',
    invitedBy: text(row.invited_by),
    createdAt: text(row.created_at),
    updatedAt: text(row.updated_at),
  };
}

async function createPersonalOrg(sql: Sql, user: ApiUser, displayName: string) {
  const orgId = `org_${user.uid}`;
  const label = text(displayName) || emailOf(user.email).split('@')[0] || 'Owner';
  const name = `${label}'s workspace`;
  await sql`
    INSERT INTO orgs (id, name, owner_uid, data, created_at, updated_at)
    VALUES (${orgId}, ${name}, ${user.uid}, ${JSON.stringify({ kind: 'personal' })}::jsonb, NOW(), NOW())
    ON CONFLICT (id) DO UPDATE SET updated_at = NOW()
  `;
  const roles = await seedSystemRoles(sql, orgId);
  const ownerRoleId = roles.owner;
  const email = emailOf(user.email);
  await sql`
    INSERT INTO org_members (org_id, uid, role_id, email, display_name, status, invited_by, updated_at)
    VALUES (${orgId}, ${user.uid}, ${ownerRoleId}, ${email}, ${label}, 'active', ${user.uid}, NOW())
    ON CONFLICT (org_id, uid) DO UPDATE SET
      role_id = EXCLUDED.role_id,
      email = COALESCE(NULLIF(EXCLUDED.email, ''), org_members.email),
      display_name = COALESCE(NULLIF(EXCLUDED.display_name, ''), org_members.display_name),
      status = 'active',
      updated_at = NOW()
  `;
  await ledgerUpsertUser(user.uid, {
    email,
    displayName: label,
    orgId,
    updatedAt: new Date().toISOString(),
  }, true);
  return orgId;
}

export async function ensureUserOrg(user: ApiUser, displayName = ''): Promise<string> {
  const sql = await sqlReady();
  const profile = await ledgerGetUser(user.uid);
  const preferred = text(profile?.orgId);
  if (preferred) {
    const member = await getMember(sql, preferred, user.uid);
    if (member?.status === 'active') {
      await seedSystemRoles(sql, preferred);
      return preferred;
    }
  }

  const byUid = rows<{ org_id: string }>(
    await sql`
      SELECT org_id FROM org_members
      WHERE uid = ${user.uid} AND status = 'active'
      ORDER BY created_at ASC
      LIMIT 1
    `,
  )[0];
  if (byUid?.org_id) {
    await seedSystemRoles(sql, text(byUid.org_id));
    await ledgerUpsertUser(user.uid, { orgId: text(byUid.org_id) }, true);
    return text(byUid.org_id);
  }

  const email = emailOf(user.email || profile?.email);
  if (email) {
    const invite = rows<{ id: string; org_id: string; role_id: string }>(
      await sql`
        SELECT id, org_id, role_id FROM org_invites
        WHERE email = ${email} AND status = 'pending'
        ORDER BY created_at ASC
        LIMIT 1
      `,
    )[0];
    if (invite) {
      const label = text(displayName || profile?.displayName || email.split('@')[0] || 'Member');
      await sql`
        INSERT INTO org_members (org_id, uid, role_id, email, display_name, status, invited_by, updated_at)
        VALUES (
          ${text(invite.org_id)}, ${user.uid}, ${text(invite.role_id)},
          ${email}, ${label}, 'active', ${user.uid}, NOW()
        )
        ON CONFLICT (org_id, uid) DO UPDATE SET
          role_id = EXCLUDED.role_id,
          email = EXCLUDED.email,
          display_name = EXCLUDED.display_name,
          status = 'active',
          updated_at = NOW()
      `;
      await sql`
        UPDATE org_invites
        SET status = 'accepted', updated_at = NOW(),
          data = COALESCE(data, '{}'::jsonb) || ${JSON.stringify({ acceptedBy: user.uid })}::jsonb
        WHERE id = ${text(invite.id)}
      `;
      await seedSystemRoles(sql, text(invite.org_id));
      await ledgerUpsertUser(user.uid, { orgId: text(invite.org_id), email, displayName: label }, true);
      return text(invite.org_id);
    }
  }

  return createPersonalOrg(sql, user, text(displayName || profile?.displayName || ''));
}

export async function getRbacSession(user: ApiUser, displayName = ''): Promise<RbacSession> {
  const sql = await sqlReady();
  const orgId = await ensureUserOrg(user, displayName);
  const org = await getOrg(sql, orgId);
  if (!org) throw new ApiError(500, 'Organization missing');
  const member = await getMember(sql, orgId, user.uid);
  if (!member || member.status !== 'active') {
    throw new ApiError(403, 'You are not an active member of this organization');
  }
  return {
    org,
    member,
    permissions: await rolePermissions(sql, member.roleId),
    roles: await listRoles(sql, orgId),
    permissionCatalog: RBAC_PERMISSIONS,
  };
}

export async function requireOrgPermission(user: ApiUser, permissionId: string, displayName = '') {
  const session = await getRbacSession(user, displayName);
  if (!session.permissions.includes(permissionId)) {
    throw new ApiError(403, `Missing permission: ${permissionId}`);
  }
  return session;
}

export async function requireAnyOrgPermission(user: ApiUser, permissionIds: string[], displayName = '') {
  const session = await getRbacSession(user, displayName);
  if (!permissionIds.some((id) => session.permissions.includes(id))) {
    throw new ApiError(403, `Missing permission: ${permissionIds.join(' | ')}`);
  }
  return session;
}

export async function userHasPermission(user: ApiUser, permissionId: string) {
  try {
    const session = await getRbacSession(user);
    return session.permissions.includes(permissionId);
  } catch {
    return false;
  }
}

export async function listOrgMembers(user: ApiUser) {
  const session = await requireOrgPermission(user, 'admin.users');
  const sql = await sqlReady();
  const list = rows<{
    org_id: string;
    uid: string;
    role_id: string;
    email: string;
    display_name: string;
    status: string;
    invited_by: string;
    created_at: string;
    updated_at: string;
    role_key: string;
    role_name: string;
  }>(
    await sql`
      SELECT m.org_id, m.uid, m.role_id, m.email, m.display_name, m.status, m.invited_by,
        m.created_at, m.updated_at, r.key AS role_key, r.name AS role_name
      FROM org_members m
      JOIN rbac_roles r ON r.id = m.role_id
      WHERE m.org_id = ${session.org.id}
      ORDER BY
        CASE m.status WHEN 'active' THEN 0 WHEN 'invited' THEN 1 ELSE 2 END,
        COALESCE(NULLIF(m.display_name, ''), m.email) ASC
    `,
  );
  return {
    ...session,
    members: list.map((row): MemberRecord => ({
      orgId: text(row.org_id),
      uid: text(row.uid),
      roleId: text(row.role_id),
      roleKey: text(row.role_key),
      roleName: text(row.role_name),
      email: emailOf(row.email),
      displayName: text(row.display_name),
      status: text(row.status) || 'active',
      invitedBy: text(row.invited_by),
      createdAt: text(row.created_at),
      updatedAt: text(row.updated_at),
    })),
  };
}

export async function listOrgInvites(user: ApiUser) {
  const session = await requireOrgPermission(user, 'admin.users');
  const sql = await sqlReady();
  const list = rows<{
    id: string;
    org_id: string;
    email: string;
    role_id: string;
    status: string;
    invited_by: string;
    token: string;
    created_at: string;
    expires_at: string | null;
    role_key: string;
    role_name: string;
  }>(
    await sql`
      SELECT i.id, i.org_id, i.email, i.role_id, i.status, i.invited_by, i.token,
        i.created_at, i.expires_at, r.key AS role_key, r.name AS role_name
      FROM org_invites i
      JOIN rbac_roles r ON r.id = i.role_id
      WHERE i.org_id = ${session.org.id} AND i.status = 'pending'
      ORDER BY i.created_at DESC
    `,
  );
  return {
    ...session,
    invites: list.map((row): InviteRecord => ({
      id: text(row.id),
      orgId: text(row.org_id),
      email: emailOf(row.email),
      roleId: text(row.role_id),
      roleKey: text(row.role_key),
      roleName: text(row.role_name),
      status: text(row.status),
      invitedBy: text(row.invited_by),
      token: text(row.token),
      createdAt: text(row.created_at),
      expiresAt: row.expires_at ? text(row.expires_at) : null,
    })),
  };
}

async function assertRoleInOrg(sql: Sql, orgId: string, roleId: string) {
  const row = rows<{ id: string; key: string; name: string; is_system: boolean }>(
    await sql`SELECT id, key, name, is_system FROM rbac_roles WHERE id = ${roleId} AND org_id = ${orgId} LIMIT 1`,
  )[0];
  if (!row) throw new ApiError(400, 'Role not found in this organization');
  return row;
}

async function countActiveOwners(sql: Sql, orgId: string) {
  const row = rows<{ count: string | number }>(
    await sql`
      SELECT COUNT(*) AS count
      FROM org_members m
      JOIN rbac_roles r ON r.id = m.role_id
      WHERE m.org_id = ${orgId} AND m.status = 'active' AND r.key = 'owner'
    `,
  )[0];
  return Number(row?.count || 0);
}

export async function inviteOrgMember(user: ApiUser, input: { email: string; roleId: string }) {
  const session = await requireOrgPermission(user, 'admin.users');
  const sql = await sqlReady();
  const email = emailOf(input.email);
  if (!email || !email.includes('@')) throw new ApiError(400, 'Valid email required');
  const role = await assertRoleInOrg(sql, session.org.id, text(input.roleId));
  if (text(role.key) === 'owner' && session.member.roleKey !== 'owner') {
    throw new ApiError(403, 'Only an owner can invite another owner');
  }

  const existingMember = rows<{ uid: string; status: string }>(
    await sql`
      SELECT uid, status FROM org_members
      WHERE org_id = ${session.org.id} AND lower(COALESCE(email, '')) = ${email}
      LIMIT 1
    `,
  )[0];
  if (existingMember && text(existingMember.status) === 'active') {
    throw new ApiError(409, 'That user is already a member');
  }

  const existingUser = rows<{ id: string; data: unknown }>(
    await sql`SELECT id, data FROM users WHERE lower(COALESCE(email, '')) = ${email} LIMIT 1`,
  )[0];

  if (existingUser?.id) {
    const data = (existingUser.data && typeof existingUser.data === 'object' ? existingUser.data : {}) as Record<string, unknown>;
    const displayName = text(data.displayName) || email.split('@')[0];
    await sql`
      INSERT INTO org_members (org_id, uid, role_id, email, display_name, status, invited_by, updated_at)
      VALUES (
        ${session.org.id}, ${text(existingUser.id)}, ${text(role.id)},
        ${email}, ${displayName}, 'active', ${user.uid}, NOW()
      )
      ON CONFLICT (org_id, uid) DO UPDATE SET
        role_id = EXCLUDED.role_id,
        email = EXCLUDED.email,
        display_name = EXCLUDED.display_name,
        status = 'active',
        updated_at = NOW()
    `;
    await ledgerUpsertUser(text(existingUser.id), { orgId: session.org.id, email }, true);
    return { joined: true as const, uid: text(existingUser.id) };
  }

  await sql`
    UPDATE org_invites
    SET status = 'cancelled', updated_at = NOW()
    WHERE org_id = ${session.org.id} AND email = ${email} AND status = 'pending'
  `;
  const id = newId('oinv_');
  const token = newId('otk_');
  const expires = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
  await sql`
    INSERT INTO org_invites (
      id, org_id, email, role_id, status, invited_by, token, data, created_at, updated_at, expires_at
    )
    VALUES (
      ${id}, ${session.org.id}, ${email}, ${text(role.id)}, 'pending', ${user.uid}, ${token},
      ${JSON.stringify({ orgName: session.org.name, roleKey: text(role.key), roleName: text(role.name) })}::jsonb,
      NOW(), NOW(), ${expires}::timestamptz
    )
  `;
  return {
    joined: false as const,
    invite: {
      id,
      orgId: session.org.id,
      email,
      roleId: text(role.id),
      roleKey: text(role.key),
      roleName: text(role.name),
      status: 'pending',
      invitedBy: user.uid,
      token,
      expiresAt: expires,
    } satisfies InviteRecord,
  };
}

export async function updateOrgMember(user: ApiUser, input: { uid: string; roleId?: string; status?: string }) {
  const session = await requireOrgPermission(user, 'admin.users');
  const sql = await sqlReady();
  const targetUid = text(input.uid);
  if (!targetUid) throw new ApiError(400, 'Member required');
  const target = await getMember(sql, session.org.id, targetUid);
  if (!target) throw new ApiError(404, 'Member not found');

  let nextRoleId = target.roleId;
  if (input.roleId) {
    const role = await assertRoleInOrg(sql, session.org.id, text(input.roleId));
    if (text(role.key) === 'owner' && session.member.roleKey !== 'owner') {
      throw new ApiError(403, 'Only an owner can assign the owner role');
    }
    if (target.roleKey === 'owner' && text(role.key) !== 'owner') {
      if ((await countActiveOwners(sql, session.org.id)) <= 1) {
        throw new ApiError(400, 'Keep at least one active owner');
      }
    }
    nextRoleId = text(role.id);
  }

  let nextStatus = target.status;
  if (input.status) {
    const status = text(input.status);
    if (!['active', 'disabled'].includes(status)) throw new ApiError(400, 'Invalid status');
    if (status === 'disabled') {
      if (targetUid === user.uid) throw new ApiError(400, 'You cannot disable your own account');
      if (target.roleKey === 'owner' && (await countActiveOwners(sql, session.org.id)) <= 1) {
        throw new ApiError(400, 'Keep at least one active owner');
      }
    }
    nextStatus = status;
  }

  await sql`
    UPDATE org_members
    SET role_id = ${nextRoleId}, status = ${nextStatus}, updated_at = NOW()
    WHERE org_id = ${session.org.id} AND uid = ${targetUid}
  `;
  return getMember(sql, session.org.id, targetUid);
}

export async function removeOrgMember(user: ApiUser, uidToRemove: string) {
  const session = await requireOrgPermission(user, 'admin.users');
  const sql = await sqlReady();
  const targetUid = text(uidToRemove);
  if (!targetUid) throw new ApiError(400, 'Member required');
  if (targetUid === user.uid) throw new ApiError(400, 'You cannot remove yourself');
  const target = await getMember(sql, session.org.id, targetUid);
  if (!target) throw new ApiError(404, 'Member not found');
  if (target.roleKey === 'owner' && (await countActiveOwners(sql, session.org.id)) <= 1) {
    throw new ApiError(400, 'Keep at least one active owner');
  }
  await sql`DELETE FROM org_members WHERE org_id = ${session.org.id} AND uid = ${targetUid}`;
  return { ok: true };
}

export async function cancelOrgInvite(user: ApiUser, inviteId: string) {
  const session = await requireOrgPermission(user, 'admin.users');
  const sql = await sqlReady();
  await sql`
    UPDATE org_invites
    SET status = 'cancelled', updated_at = NOW()
    WHERE id = ${text(inviteId)} AND org_id = ${session.org.id} AND status = 'pending'
  `;
  return { ok: true };
}

export async function createCustomRole(user: ApiUser, input: {
  name: string;
  description?: string;
  permissionIds?: string[];
}) {
  const session = await requireOrgPermission(user, 'admin.roles');
  const sql = await sqlReady();
  const name = text(input.name).trim();
  if (!name) throw new ApiError(400, 'Role name required');
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 40) || newLedgerId();
  const key = `custom_${slug}`;
  const id = newId('role_');
  try {
    await sql`
      INSERT INTO rbac_roles (id, org_id, key, name, description, is_system, updated_at)
      VALUES (${id}, ${session.org.id}, ${key}, ${name}, ${text(input.description)}, FALSE, NOW())
    `;
  } catch {
    throw new ApiError(409, 'A role with a similar name already exists');
  }
  const allowed = new Set(RBAC_PERMISSIONS.map((p) => p.id));
  for (const permissionId of input.permissionIds || []) {
    if (!allowed.has(permissionId)) continue;
    await sql`
      INSERT INTO rbac_role_permissions (role_id, permission_id)
      VALUES (${id}, ${permissionId})
      ON CONFLICT DO NOTHING
    `;
  }
  return (await listRoles(sql, session.org.id)).find((r) => r.id === id) || null;
}

export async function updateCustomRole(user: ApiUser, input: {
  roleId: string;
  name?: string;
  description?: string;
  permissionIds?: string[];
}) {
  const session = await requireOrgPermission(user, 'admin.roles');
  const sql = await sqlReady();
  const role = await assertRoleInOrg(sql, session.org.id, text(input.roleId));

  if (input.name != null) {
    if (Boolean(role.is_system)) throw new ApiError(400, 'System role names are fixed');
    const name = text(input.name).trim();
    if (!name) throw new ApiError(400, 'Role name required');
    await sql`UPDATE rbac_roles SET name = ${name}, updated_at = NOW() WHERE id = ${text(role.id)}`;
  }
  if (input.description != null) {
    await sql`
      UPDATE rbac_roles SET description = ${text(input.description)}, updated_at = NOW()
      WHERE id = ${text(role.id)}
    `;
  }
  if (input.permissionIds) {
    if (Boolean(role.is_system) && (text(role.key) === 'owner' || text(role.key) === 'admin')) {
      throw new ApiError(400, 'Owner and Admin always retain full permissions');
    }
    const allowed = new Set(RBAC_PERMISSIONS.map((p) => p.id));
    const next = [...new Set(input.permissionIds.filter((id) => allowed.has(id)))];
    await sql`DELETE FROM rbac_role_permissions WHERE role_id = ${text(role.id)}`;
    for (const permissionId of next) {
      await sql`
        INSERT INTO rbac_role_permissions (role_id, permission_id)
        VALUES (${text(role.id)}, ${permissionId})
        ON CONFLICT DO NOTHING
      `;
    }
  }
  return (await listRoles(sql, session.org.id)).find((r) => r.id === text(role.id)) || null;
}

export async function deleteCustomRole(user: ApiUser, roleId: string) {
  const session = await requireOrgPermission(user, 'admin.roles');
  const sql = await sqlReady();
  const role = await assertRoleInOrg(sql, session.org.id, text(roleId));
  if (Boolean(role.is_system)) throw new ApiError(400, 'System roles cannot be deleted');
  const members = rows<{ count: string | number }>(
    await sql`SELECT COUNT(*) AS count FROM org_members WHERE role_id = ${text(role.id)}`,
  )[0];
  if (Number(members?.count || 0) > 0) {
    throw new ApiError(400, 'Reassign members before deleting this role');
  }
  await sql`DELETE FROM rbac_role_permissions WHERE role_id = ${text(role.id)}`;
  await sql`DELETE FROM rbac_roles WHERE id = ${text(role.id)}`;
  return { ok: true };
}

export async function renameOrg(user: ApiUser, name: string) {
  const session = await requireAnyOrgPermission(user, ['admin.access', 'admin.users', 'admin.roles']);
  const sql = await sqlReady();
  const next = text(name).trim();
  if (!next) throw new ApiError(400, 'Organization name required');
  await sql`UPDATE orgs SET name = ${next}, updated_at = NOW() WHERE id = ${session.org.id}`;
  return getOrg(sql, session.org.id);
}

export { RBAC_PERMISSIONS };

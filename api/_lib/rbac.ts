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
  BASE_SUPER_USER_EMAILS,
  PLATFORM_ORG_ID,
  PLATFORM_ORG_NAME,
  RBAC_PERMISSIONS,
  SYSTEM_ROLE_DEFS,
  isAdminPermission,
  isBooksPermission,
  permissionIdsForRole,
  productPermissionIds,
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

/** Always includes the two hard-coded base controllers; env can add more. */
function superUserEmailsFromEnv() {
  const raw = String(process.env.SUPER_USER_EMAILS || process.env.BYJAN_SUPER_USER_EMAILS || '').trim();
  const fromEnv = raw
    ? raw.split(/[,;\s]+/).map((e) => e.trim().toLowerCase()).filter(Boolean)
    : [];
  return [...new Set([...BASE_SUPER_USER_EMAILS.map((e) => e.toLowerCase()), ...fromEnv])];
}

function isAllowlistedSuper(email: string) {
  const list = superUserEmailsFromEnv();
  return Boolean(email && list.includes(email));
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

  await db`
    CREATE TABLE IF NOT EXISTS org_member_grants (
      org_id TEXT NOT NULL,
      uid TEXT NOT NULL,
      permission_id TEXT NOT NULL,
      granted_by TEXT,
      data JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (org_id, uid, permission_id)
    )
  `;
  await db`CREATE INDEX IF NOT EXISTS org_member_grants_uid_idx ON org_member_grants (uid)`;


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
  grantIds?: string[];
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
  isSuperUser: boolean;
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

    const current = rows<{ permission_id: string }>(
      await sql`SELECT permission_id FROM rbac_role_permissions WHERE role_id = ${id}`,
    ).map((r) => text(r.permission_id));
    const have = new Set(current);

    // Default external: seed product baseline once if empty so migration does not lock users out.
    // Never overwrite after a super user customizes the matrix.
    if (!def.syncPermissions) {
      if (have.size === 0) {
        const baseline =
          def.permissions === 'product'
            ? productPermissionIds()
            : permissionIdsForRole(def.key as SystemRoleKey);
        for (const permissionId of baseline) {
          await sql`
            INSERT INTO rbac_role_permissions (role_id, permission_id)
            VALUES (${id}, ${permissionId})
            ON CONFLICT DO NOTHING
          `;
        }
      }
      continue;
    }

    const wanted = new Set(permissionIdsForRole(def.key as SystemRoleKey));

    for (const permissionId of Array.from(wanted)) {
      if (have.has(permissionId)) continue;
      await sql`
        INSERT INTO rbac_role_permissions (role_id, permission_id)
        VALUES (${id}, ${permissionId})
        ON CONFLICT DO NOTHING
      `;
    }
    for (const permissionId of Array.from(have)) {
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

async function memberGrants(sql: Sql, orgId: string, uid: string) {
  return rows<{ permission_id: string }>(
    await sql`
      SELECT permission_id FROM org_member_grants
      WHERE org_id = ${orgId} AND uid = ${uid}
    `,
  ).map((r) => text(r.permission_id)).filter(Boolean);
}

async function memberGrantsByUid(sql: Sql, orgId: string, uids: string[]) {
  const map = new Map<string, string[]>();
  for (const uid of uids) map.set(uid, []);
  if (!uids.length) return map;
  const grantRows = rows<{ uid: string; permission_id: string }>(
    await sql`
      SELECT uid, permission_id FROM org_member_grants
      WHERE org_id = ${orgId} AND uid = ANY(${uids})
    `,
  );
  for (const row of grantRows) {
    const uid = text(row.uid);
    const list = map.get(uid) || [];
    list.push(text(row.permission_id));
    map.set(uid, list);
  }
  return map;
}

async function effectivePermissions(sql: Sql, orgId: string, uid: string, roleId: string, roleKey = '') {
  // Super users always get the full catalog — never depend on a partially seeded role matrix.
  if (roleKey === 'super_user') {
    return RBAC_PERMISSIONS.map((p) => p.id);
  }
  if (!roleKey && roleId) {
    const role = rows<{ key: string }>(
      await sql`SELECT key FROM rbac_roles WHERE id = ${roleId} LIMIT 1`,
    )[0];
    if (text(role?.key) === 'super_user') {
      return RBAC_PERMISSIONS.map((p) => p.id);
    }
  }
  const fromRole = await rolePermissions(sql, roleId);
  const grants = await memberGrants(sql, orgId, uid);
  // Non-super users must never receive admin.* — otherwise Access & roles appears in the nav
  // and then fails when they open it.
  return [...new Set([...fromRole, ...grants])].filter((id) => !isAdminPermission(id));
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
      ORDER BY
        CASE r.key WHEN 'super_user' THEN 0 WHEN 'external' THEN 1 ELSE 2 END,
        r.is_system DESC, r.name ASC
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

async function ensurePlatformOrg(sql: Sql, bootstrapOwnerUid = '') {
  const existing = await getOrg(sql, PLATFORM_ORG_ID);
  if (!existing) {
    await sql`
      INSERT INTO orgs (id, name, owner_uid, data, created_at, updated_at)
      VALUES (
        ${PLATFORM_ORG_ID}, ${PLATFORM_ORG_NAME}, ${bootstrapOwnerUid},
        ${JSON.stringify({ kind: 'platform' })}::jsonb, NOW(), NOW()
      )
      ON CONFLICT (id) DO NOTHING
    `;
  }
  await seedSystemRoles(sql, PLATFORM_ORG_ID);
  return PLATFORM_ORG_ID;
}

async function upsertPlatformMember(
  sql: Sql,
  user: ApiUser,
  roleId: string,
  displayName: string,
  invitedBy: string,
) {
  const email = emailOf(user.email);
  const label = text(displayName) || email.split('@')[0] || 'User';
  await sql`
    INSERT INTO org_members (org_id, uid, role_id, email, display_name, status, invited_by, updated_at)
    VALUES (${PLATFORM_ORG_ID}, ${user.uid}, ${roleId}, ${email}, ${label}, 'active', ${invitedBy}, NOW())
    ON CONFLICT (org_id, uid) DO UPDATE SET
      email = COALESCE(NULLIF(EXCLUDED.email, ''), org_members.email),
      display_name = COALESCE(NULLIF(EXCLUDED.display_name, ''), org_members.display_name),
      status = 'active',
      updated_at = NOW()
  `;
  await ledgerUpsertUser(user.uid, {
    email,
    displayName: label,
    orgId: PLATFORM_ORG_ID,
    updatedAt: new Date().toISOString(),
  }, true);
}

async function applyInviteBooksGrants(sql: Sql, orgId: string, uid: string, inviteData: unknown) {
  const data = (inviteData && typeof inviteData === 'object' ? inviteData : {}) as Record<string, unknown>;
  const grants = Array.isArray(data.booksGrants)
    ? data.booksGrants.map((g) => text(g)).filter((id) => isBooksPermission(id))
    : [];
  for (const permissionId of grants) {
    await sql`
      INSERT INTO org_member_grants (org_id, uid, permission_id, granted_by, created_at)
      VALUES (${orgId}, ${uid}, ${permissionId}, ${text(data.invitedBy) || uid}, NOW())
      ON CONFLICT DO NOTHING
    `;
  }
}

async function applyInvitePrivilegeGrants(sql: Sql, orgId: string, uid: string, inviteData: unknown) {
  const data = (inviteData && typeof inviteData === 'object' ? inviteData : {}) as Record<string, unknown>;
  await applyInviteBooksGrants(sql, orgId, uid, inviteData);
  const catalog = new Set(RBAC_PERMISSIONS.map((p) => p.id));
  const raw = Array.isArray(data.permissionIds)
    ? data.permissionIds
    : Array.isArray(data.grants)
      ? data.grants
      : [];
  const grants = raw
    .map((g) => text(g))
    .filter((id) => catalog.has(id) && !isAdminPermission(id));
  for (const permissionId of grants) {
    await sql`
      INSERT INTO org_member_grants (org_id, uid, permission_id, granted_by, created_at)
      VALUES (${orgId}, ${uid}, ${permissionId}, ${text(data.invitedBy) || uid}, NOW())
      ON CONFLICT DO NOTHING
    `;
  }
}

const FIREBASE_WEB_API_KEY =
  process.env.FIREBASE_API_KEY
  || process.env.VITE_FIREBASE_API_KEY
  || 'AIzaSyDQUXdMTTUOONPbua5cWm75Jn-7-SkRwjE';

async function provisionFirebaseAuthUser(input: { email: string; password: string; displayName: string }) {
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${FIREBASE_WEB_API_KEY}`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        email: input.email,
        password: input.password,
        displayName: input.displayName,
        returnSecureToken: false,
      }),
    },
  );
  const payload = (await res.json().catch(() => ({}))) as {
    localId?: string;
    email?: string;
    error?: { message?: string };
  };
  if (!res.ok || !payload.localId) {
    const msg = String(payload.error?.message || 'Could not create login for this user');
    if (msg.includes('EMAIL_EXISTS')) {
      throw Object.assign(new ApiError(409, 'That email already has a login. Search People or use Invite instead.'), {
        code: 'EMAIL_EXISTS',
      });
    }
    throw new ApiError(400, msg.replace(/_/g, ' ').toLowerCase());
  }
  return { uid: text(payload.localId), email: emailOf(payload.email || input.email) };
}

async function replaceMemberGrants(
  sql: Sql,
  orgId: string,
  uid: string,
  grantedBy: string,
  permissionIds: string[],
) {
  const catalog = new Set(RBAC_PERMISSIONS.map((p) => p.id));
  const next = [...new Set(permissionIds.map((id) => text(id)).filter(Boolean))]
    .filter((id) => catalog.has(id) && !isAdminPermission(id));
  await sql`DELETE FROM org_member_grants WHERE org_id = ${orgId} AND uid = ${uid}`;
  for (const permissionId of next) {
    await sql`
      INSERT INTO org_member_grants (org_id, uid, permission_id, granted_by, created_at)
      VALUES (${orgId}, ${uid}, ${permissionId}, ${grantedBy}, NOW())
      ON CONFLICT DO NOTHING
    `;
  }
  return next;
}


/** Legacy personal-org roles from the first RBAC cut. Existing members keep those role_ids until remapped. */
const LEGACY_PRIVILEGED_ROLE_KEYS = new Set(['owner', 'admin', 'manager', 'accountant', 'contributor', 'viewer']);

async function migrateLegacyPlatformMembership(sql: Sql, user: ApiUser, email: string, roles: Record<string, string>) {
  const member = await getMember(sql, PLATFORM_ORG_ID, user.uid);
  if (!member) return null;

  const allowlisted = isAllowlistedSuper(email);
  const key = text(member.roleKey);

  // Keep real super users; promote allowlisted emails.
  if (key === 'super_user' || allowlisted) {
    if (allowlisted && key !== 'super_user' && roles.super_user) {
      await sql`
        UPDATE org_members SET role_id = ${roles.super_user}, updated_at = NOW()
        WHERE org_id = ${PLATFORM_ORG_ID} AND uid = ${user.uid}
      `;
      return getMember(sql, PLATFORM_ORG_ID, user.uid);
    }
    return member;
  }

  // Remap leftover owner/admin/manager/... memberships onto Default external.
  if (LEGACY_PRIVILEGED_ROLE_KEYS.has(key) && roles.external) {
    await sql`
      UPDATE org_members SET role_id = ${roles.external}, updated_at = NOW()
      WHERE org_id = ${PLATFORM_ORG_ID} AND uid = ${user.uid}
    `;
    return getMember(sql, PLATFORM_ORG_ID, user.uid);
  }

  return member;
}

async function stripAdminFromNonSuperRoles(sql: Sql, orgId: string) {
  // Delete by permission_id prefix so we do not depend on rbac_permissions join matching.
  await sql`
    DELETE FROM rbac_role_permissions rp
    USING rbac_roles r
    WHERE rp.role_id = r.id
      AND r.org_id = ${orgId}
      AND r.key <> 'super_user'
      AND rp.permission_id LIKE 'admin.%'
  `;
  // Also clear any leftover admin.* per-user grants on non-super members.
  await sql`
    DELETE FROM org_member_grants g
    USING org_members m
    LEFT JOIN rbac_roles r ON r.id = m.role_id
    WHERE g.org_id = ${orgId}
      AND g.uid = m.uid
      AND m.org_id = ${orgId}
      AND COALESCE(r.key, '') <> 'super_user'
      AND g.permission_id LIKE 'admin.%'
  `;
}


export async function ensureUserOrg(user: ApiUser, displayName = ''): Promise<string> {
  const sql = await sqlReady();
  const profile = await ledgerGetUser(user.uid);
  const label = text(displayName || profile?.displayName || '');
  const email = emailOf(user.email || profile?.email);

  await ensurePlatformOrg(sql, user.uid);
  const roles = await seedSystemRoles(sql, PLATFORM_ORG_ID);

  if (email) {
    const invite = rows<{ id: string; org_id: string; role_id: string; data: unknown }>(
      await sql`
        SELECT id, org_id, role_id, data FROM org_invites
        WHERE email = ${email} AND status = 'pending' AND org_id = ${PLATFORM_ORG_ID}
        ORDER BY created_at ASC
        LIMIT 1
      `,
    )[0];
    if (invite) {
      const name = label || email.split('@')[0] || 'Member';
      await sql`
        INSERT INTO org_members (org_id, uid, role_id, email, display_name, status, invited_by, updated_at)
        VALUES (
          ${PLATFORM_ORG_ID}, ${user.uid}, ${text(invite.role_id)},
          ${email}, ${name}, 'active', ${user.uid}, NOW()
        )
        ON CONFLICT (org_id, uid) DO UPDATE SET
          role_id = EXCLUDED.role_id,
          email = EXCLUDED.email,
          display_name = EXCLUDED.display_name,
          status = 'active',
          updated_at = NOW()
      `;
      await applyInvitePrivilegeGrants(sql, PLATFORM_ORG_ID, user.uid, invite.data);
      await sql`
        UPDATE org_invites
        SET status = 'accepted', updated_at = NOW(),
          data = COALESCE(data, '{}'::jsonb) || ${JSON.stringify({ acceptedBy: user.uid })}::jsonb
        WHERE id = ${text(invite.id)}
      `;
      await ledgerUpsertUser(user.uid, { orgId: PLATFORM_ORG_ID, email, displayName: name }, true);
      return PLATFORM_ORG_ID;
    }
  }

  let member = await getMember(sql, PLATFORM_ORG_ID, user.uid);
  const superCount = await countActiveSuperUsers(sql, PLATFORM_ORG_ID);
  const allowlisted = isAllowlistedSuper(email);
  const bootstrapSuper = !superUserEmailsFromEnv().length && superCount === 0 && !member;

  if (!member) {
    // Also absorb legacy personal-org owners who never joined the platform org yet.
    const legacy = rows<{ org_id: string; role_key: string }>(
      await sql`
        SELECT m.org_id, r.key AS role_key
        FROM org_members m
        JOIN rbac_roles r ON r.id = m.role_id
        WHERE m.uid = ${user.uid} AND m.status = 'active' AND m.org_id <> ${PLATFORM_ORG_ID}
        ORDER BY m.created_at ASC
        LIMIT 1
      `,
    )[0];

    const asSuper = allowlisted || bootstrapSuper;
    const roleId = asSuper ? roles.super_user : roles.external;
    if (asSuper) {
      await sql`
        UPDATE orgs SET owner_uid = ${user.uid}, updated_at = NOW()
        WHERE id = ${PLATFORM_ORG_ID}
      `;
    }
    await upsertPlatformMember(sql, user, roleId, label, user.uid);

    // Disable leftover personal-org memberships so old Owner roles cannot be used.
    if (legacy?.org_id) {
      await sql`
        UPDATE org_members
        SET status = 'disabled', updated_at = NOW()
        WHERE uid = ${user.uid} AND org_id <> ${PLATFORM_ORG_ID} AND status = 'active'
      `;
    }

    await stripAdminFromNonSuperRoles(sql, PLATFORM_ORG_ID);
    return PLATFORM_ORG_ID;
  }

  // Existing platform members: demote legacy owner/admin/etc. to Default external.
  member = await migrateLegacyPlatformMembership(sql, user, email, roles) || member;

  await sql`
    UPDATE org_members
    SET status = 'disabled', updated_at = NOW()
    WHERE uid = ${user.uid} AND org_id <> ${PLATFORM_ORG_ID} AND status = 'active'
  `;

  if (text(profile?.orgId) && text(profile?.orgId) !== PLATFORM_ORG_ID) {
    await ledgerUpsertUser(user.uid, { orgId: PLATFORM_ORG_ID }, true);
  }

  await seedSystemRoles(sql, PLATFORM_ORG_ID);
  await stripAdminFromNonSuperRoles(sql, PLATFORM_ORG_ID);
  return PLATFORM_ORG_ID;
}


async function remappedAllLegacyMembers(sql: Sql) {
  const roles = await seedSystemRoles(sql, PLATFORM_ORG_ID);
  if (!roles.external || !roles.super_user) return;
  const allow = new Set(superUserEmailsFromEnv());

  // Promote the two base controller emails (and any env supers) whenever they exist in Neon.
  for (const email of allow) {
    await sql`
      UPDATE org_members
      SET role_id = ${roles.super_user}, status = 'active', updated_at = NOW()
      WHERE org_id = ${PLATFORM_ORG_ID}
        AND lower(email) = ${email}
        AND role_id <> ${roles.super_user}
    `;
  }

  const legacy = rows<{ uid: string; email: string; role_key: string }>(
    await sql`
      SELECT m.uid, m.email, r.key AS role_key
      FROM org_members m
      JOIN rbac_roles r ON r.id = m.role_id
      WHERE m.org_id = ${PLATFORM_ORG_ID}
        AND m.status = 'active'
        AND r.key IN ('owner', 'admin', 'manager', 'accountant', 'contributor', 'viewer')
    `,
  );
  for (const row of legacy) {
    const email = emailOf(row.email);
    const nextRole = allow.has(email) ? roles.super_user : roles.external;
    if (!nextRole) continue;
    await sql`
      UPDATE org_members SET role_id = ${nextRole}, updated_at = NOW()
      WHERE org_id = ${PLATFORM_ORG_ID} AND uid = ${text(row.uid)}
    `;
  }
  await stripAdminFromNonSuperRoles(sql, PLATFORM_ORG_ID);
}


export async function getRbacSession(user: ApiUser, displayName = ''): Promise<RbacSession> {
  const sql = await sqlReady();
  await remappedAllLegacyMembers(sql);
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
    permissions: await effectivePermissions(sql, orgId, user.uid, member.roleId, member.roleKey),
    roles: await listRoles(sql, orgId),
    permissionCatalog: RBAC_PERMISSIONS,
    isSuperUser: member.roleKey === 'super_user',
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

/**
 * Bring every registered Neon user (and any active legacy-org member) into org_platform
 * so Access → People can list and grant features without waiting for each person to re-login.
 */
async function syncRegisteredUsersIntoPlatform(sql: Sql) {
  await ensurePlatformOrg(sql, '');
  const roles = await seedSystemRoles(sql, PLATFORM_ORG_ID);
  const externalRoleId = text(roles.external);
  const superRoleId = text(roles.super_user);
  if (!externalRoleId) return;

  // Backfill every Neon user missing from the platform org (large batches so People is never empty).
  const missing = rows<{ id: string; email: string | null; display_name: string | null; data: unknown }>(
    await sql`
      SELECT u.id, u.email, u.display_name, u.data
      FROM users u
      WHERE NOT EXISTS (
        SELECT 1 FROM org_members m
        WHERE m.org_id = ${PLATFORM_ORG_ID} AND m.uid = u.id
      )
      ORDER BY u.updated_at DESC NULLS LAST
      LIMIT 5000
    `,
  );
  for (const u of missing) {
    const uid = text(u.id);
    if (!uid) continue;
    const data = (u.data && typeof u.data === 'object' ? u.data : {}) as Record<string, unknown>;
    const email = emailOf(u.email || data.email);
    const label = text(u.display_name || data.displayName) || email.split('@')[0] || 'User';
    const roleId = isAllowlistedSuper(email) && superRoleId ? superRoleId : externalRoleId;
    await sql`
      INSERT INTO org_members (org_id, uid, role_id, email, display_name, status, invited_by, updated_at)
      VALUES (${PLATFORM_ORG_ID}, ${uid}, ${roleId}, ${email}, ${label}, 'active', ${uid}, NOW())
      ON CONFLICT (org_id, uid) DO NOTHING
    `;
  }

  const legacy = rows<{ uid: string; email: string | null; display_name: string | null }>(
    await sql`
      SELECT DISTINCT ON (m.uid) m.uid, m.email, m.display_name
      FROM org_members m
      WHERE m.status = 'active'
        AND m.org_id <> ${PLATFORM_ORG_ID}
        AND NOT EXISTS (
          SELECT 1 FROM org_members p
          WHERE p.org_id = ${PLATFORM_ORG_ID} AND p.uid = m.uid
        )
      ORDER BY m.uid, m.updated_at DESC NULLS LAST
      LIMIT 2000
    `,
  );
  for (const row of legacy) {
    const uid = text(row.uid);
    if (!uid) continue;
    const email = emailOf(row.email);
    const label = text(row.display_name) || email.split('@')[0] || 'User';
    const roleId = isAllowlistedSuper(email) && superRoleId ? superRoleId : externalRoleId;
    await sql`
      INSERT INTO org_members (org_id, uid, role_id, email, display_name, status, invited_by, updated_at)
      VALUES (${PLATFORM_ORG_ID}, ${uid}, ${roleId}, ${email}, ${label}, 'active', ${uid}, NOW())
      ON CONFLICT (org_id, uid) DO NOTHING
    `;
  }

  if (typeof remappedAllLegacyMembers === 'function') {
    await remappedAllLegacyMembers(sql);
  }
}

export async function listOrgMembers(
  user: ApiUser,
  input: { query?: string; page?: number; pageSize?: number } = {},
) {
  // Super users open Access with admin.access; listing must not hard-require admin.users alone.
  const session = await requireAnyOrgPermission(user, ['admin.access', 'admin.users', 'admin.roles']);
  const sql = await sqlReady();
  // Never let backfill failures blank the People list — still return existing org_members.
  try {
    await syncRegisteredUsersIntoPlatform(sql);
  } catch (err) {
    console.error('[rbac] syncRegisteredUsersIntoPlatform failed', err);
  }

  const pageSize = Math.min(100, Math.max(10, Number(input.pageSize) || 25));
  const page = Math.max(1, Number(input.page) || 1);
  const offset = (page - 1) * pageSize;
  const q = text(input.query).trim().toLowerCase();
  const like = q ? `%${q}%` : '';

  const countRow = q
    ? rows<{ count: string | number }>(
        await sql`
          SELECT COUNT(*) AS count
          FROM org_members m
          LEFT JOIN rbac_roles r ON r.id = m.role_id
          WHERE m.org_id = ${session.org.id}
            AND (
              lower(COALESCE(m.email, '')) LIKE ${like}
              OR lower(COALESCE(m.display_name, '')) LIKE ${like}
              OR lower(COALESCE(r.name, '')) LIKE ${like}
              OR lower(COALESCE(r.key, '')) LIKE ${like}
            )
        `,
      )[0]
    : rows<{ count: string | number }>(
        await sql`SELECT COUNT(*) AS count FROM org_members WHERE org_id = ${session.org.id}`,
      )[0];
  const total = Number(countRow?.count || 0);

  const list = q
    ? rows<{
        org_id: string;
        uid: string;
        role_id: string;
        email: string;
        display_name: string;
        status: string;
        invited_by: string;
        created_at: string;
        updated_at: string;
        role_key: string | null;
        role_name: string | null;
      }>(
        await sql`
          SELECT m.org_id, m.uid, m.role_id, m.email, m.display_name, m.status, m.invited_by,
            m.created_at, m.updated_at, r.key AS role_key, r.name AS role_name
          FROM org_members m
          LEFT JOIN rbac_roles r ON r.id = m.role_id
          WHERE m.org_id = ${session.org.id}
            AND (
              lower(COALESCE(m.email, '')) LIKE ${like}
              OR lower(COALESCE(m.display_name, '')) LIKE ${like}
              OR lower(COALESCE(r.name, '')) LIKE ${like}
              OR lower(COALESCE(r.key, '')) LIKE ${like}
            )
          ORDER BY
            CASE m.status WHEN 'active' THEN 0 WHEN 'invited' THEN 1 ELSE 2 END,
            CASE COALESCE(r.key, '') WHEN 'super_user' THEN 0 WHEN 'external' THEN 1 ELSE 2 END,
            COALESCE(NULLIF(m.display_name, ''), m.email) ASC
          LIMIT ${pageSize} OFFSET ${offset}
        `,
      )
    : rows<{
        org_id: string;
        uid: string;
        role_id: string;
        email: string;
        display_name: string;
        status: string;
        invited_by: string;
        created_at: string;
        updated_at: string;
        role_key: string | null;
        role_name: string | null;
      }>(
        await sql`
          SELECT m.org_id, m.uid, m.role_id, m.email, m.display_name, m.status, m.invited_by,
            m.created_at, m.updated_at, r.key AS role_key, r.name AS role_name
          FROM org_members m
          LEFT JOIN rbac_roles r ON r.id = m.role_id
          WHERE m.org_id = ${session.org.id}
          ORDER BY
            CASE m.status WHEN 'active' THEN 0 WHEN 'invited' THEN 1 ELSE 2 END,
            CASE COALESCE(r.key, '') WHEN 'super_user' THEN 0 WHEN 'external' THEN 1 ELSE 2 END,
            COALESCE(NULLIF(m.display_name, ''), m.email) ASC
          LIMIT ${pageSize} OFFSET ${offset}
        `,
      );

  const members: MemberRecord[] = [];
  const uids = list.map((row) => text(row.uid)).filter(Boolean);
  const grantsByUid = await memberGrantsByUid(sql, session.org.id, uids);
  for (const row of list) {
    const uid = text(row.uid);
    members.push({
      orgId: text(row.org_id),
      uid,
      roleId: text(row.role_id),
      roleKey: text(row.role_key) || 'external',
      roleName: text(row.role_name) || 'Default external',
      email: emailOf(row.email),
      displayName: text(row.display_name),
      status: text(row.status) || 'active',
      invitedBy: text(row.invited_by),
      createdAt: text(row.created_at),
      updatedAt: text(row.updated_at),
      grantIds: grantsByUid.get(uid) || [],
    });
  }
  return {
    ...session,
    members,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
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

async function countActiveSuperUsers(sql: Sql, orgId: string) {
  const row = rows<{ count: string | number }>(
    await sql`
      SELECT COUNT(*) AS count
      FROM org_members m
      JOIN rbac_roles r ON r.id = m.role_id
      WHERE m.org_id = ${orgId} AND m.status = 'active' AND r.key = 'super_user'
    `,
  )[0];
  return Number(row?.count || 0);
}

function sanitizeExtraPermissionIds(permissionIds: unknown) {
  const catalog = new Set(RBAC_PERMISSIONS.map((p) => p.id));
  return [...new Set((Array.isArray(permissionIds) ? permissionIds : []).map((id) => text(id)).filter(Boolean))]
    .filter((id) => catalog.has(id) && !isAdminPermission(id));
}

export async function inviteOrgMember(user: ApiUser, input: {
  email: string;
  roleId: string;
  permissionIds?: string[];
}) {
  const session = await requireOrgPermission(user, 'admin.users');
  const sql = await sqlReady();
  const email = emailOf(input.email);
  if (!email || !email.includes('@')) throw new ApiError(400, 'Valid email required');
  const role = await assertRoleInOrg(sql, session.org.id, text(input.roleId));
  if (text(role.key) === 'super_user' && session.member.roleKey !== 'super_user') {
    throw new ApiError(403, 'Only a super user can invite another super user');
  }
  const extraGrants = sanitizeExtraPermissionIds(input.permissionIds);
  if (extraGrants.length && session.member.roleKey !== 'super_user') {
    throw new ApiError(403, 'Only a super user can assign per-user privileges');
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
    if (extraGrants.length) {
      await replaceMemberGrants(sql, session.org.id, text(existingUser.id), user.uid, extraGrants);
    }
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
      ${JSON.stringify({
        orgName: session.org.name,
        roleKey: text(role.key),
        roleName: text(role.name),
        invitedBy: user.uid,
        permissionIds: extraGrants,
      })}::jsonb,
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

/**
 * Super / admin.users: create or invite a person with a role and optional extra features.
 * With a password, provisions Firebase Auth + Neon membership immediately.
 * Without a password, joins existing Neon users or creates a pending invite that applies grants on first sign-in.
 */
export async function createOrgUser(user: ApiUser, input: {
  email: string;
  displayName?: string;
  password?: string;
  roleId: string;
  permissionIds?: string[];
}) {
  const session = await requireOrgPermission(user, 'admin.users');
  const sql = await sqlReady();
  const email = emailOf(input.email);
  if (!email || !email.includes('@')) throw new ApiError(400, 'Valid email required');
  const displayName = text(input.displayName).trim() || email.split('@')[0] || 'User';
  const password = text(input.password);
  const role = await assertRoleInOrg(sql, session.org.id, text(input.roleId));
  if (text(role.key) === 'super_user' && session.member.roleKey !== 'super_user') {
    throw new ApiError(403, 'Only a super user can assign the super user role');
  }
  const extraGrants = sanitizeExtraPermissionIds(input.permissionIds);
  if (extraGrants.length && session.member.roleKey !== 'super_user') {
    throw new ApiError(403, 'Only a super user can assign per-user privileges');
  }

  const existingMember = rows<{ uid: string; status: string }>(
    await sql`
      SELECT uid, status FROM org_members
      WHERE org_id = ${session.org.id} AND lower(COALESCE(email, '')) = ${email}
      LIMIT 1
    `,
  )[0];
  if (existingMember && text(existingMember.status) === 'active') {
    throw new ApiError(409, 'That user is already a member — search People to edit them');
  }

  let uid = '';
  let provisioned = false;

  if (password) {
    if (password.length < 8) throw new ApiError(400, 'Password must be at least 8 characters');
    try {
      const created = await provisionFirebaseAuthUser({ email, password, displayName });
      uid = created.uid;
      provisioned = true;
    } catch (err: any) {
      if (err?.code === 'EMAIL_EXISTS' || String(err?.message || '').includes('already has a login')) {
        const existingUser = rows<{ id: string }>(
          await sql`SELECT id FROM users WHERE lower(COALESCE(email, '')) = ${email} LIMIT 1`,
        )[0];
        if (!existingUser?.id) {
          throw new ApiError(409, 'That email already has a login. Leave password blank to invite, or search People after they sign in once.');
        }
        uid = text(existingUser.id);
      } else {
        throw err;
      }
    }
  } else {
    const existingUser = rows<{ id: string }>(
      await sql`SELECT id FROM users WHERE lower(COALESCE(email, '')) = ${email} LIMIT 1`,
    )[0];
    if (existingUser?.id) uid = text(existingUser.id);
  }

  if (uid) {
    await ledgerUpsertUser(uid, { orgId: session.org.id, email, displayName }, true);
    await sql`
      INSERT INTO org_members (org_id, uid, role_id, email, display_name, status, invited_by, updated_at)
      VALUES (
        ${session.org.id}, ${uid}, ${text(role.id)},
        ${email}, ${displayName}, 'active', ${user.uid}, NOW()
      )
      ON CONFLICT (org_id, uid) DO UPDATE SET
        role_id = EXCLUDED.role_id,
        email = EXCLUDED.email,
        display_name = EXCLUDED.display_name,
        status = 'active',
        updated_at = NOW()
    `;
    const grantIds = await replaceMemberGrants(sql, session.org.id, uid, user.uid, extraGrants);
    return {
      joined: true as const,
      uid,
      provisioned,
      grantIds,
      member: await getMember(sql, session.org.id, uid),
    };
  }

  // No account yet — pending invite carries role + feature grants for first sign-in.
  return inviteOrgMember(user, {
    email,
    roleId: text(role.id),
    permissionIds: extraGrants,
  });
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
    if (text(role.key) === 'super_user' && session.member.roleKey !== 'super_user') {
      throw new ApiError(403, 'Only a super user can assign the super user role');
    }
    if (target.roleKey === 'super_user' && text(role.key) !== 'super_user') {
      if ((await countActiveSuperUsers(sql, session.org.id)) <= 1) {
        throw new ApiError(400, 'Keep at least one active super user');
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
      if (target.roleKey === 'super_user' && (await countActiveSuperUsers(sql, session.org.id)) <= 1) {
        throw new ApiError(400, 'Keep at least one active super user');
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
  if (target.roleKey === 'super_user' && (await countActiveSuperUsers(sql, session.org.id)) <= 1) {
    throw new ApiError(400, 'Keep at least one active super user');
  }
  await sql`DELETE FROM org_member_grants WHERE org_id = ${session.org.id} AND uid = ${targetUid}`;
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
  if (session.member.roleKey !== 'super_user') {
    throw new ApiError(403, 'Only a super user can create roles');
  }
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
  for (const permissionId of sanitizeRolePermissionIds(input.permissionIds || [], key)) {
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
  if (session.member.roleKey !== 'super_user') {
    throw new ApiError(403, 'Only a super user can edit roles');
  }
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
    if (text(role.key) === 'super_user') {
      throw new ApiError(400, 'Super user always retains full permissions');
    }
    const next = sanitizeRolePermissionIds(input.permissionIds, text(role.key));
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
  if (session.member.roleKey !== 'super_user') {
    throw new ApiError(403, 'Only a super user can delete roles');
  }
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


function sanitizeRolePermissionIds(permissionIds: string[], roleKey: string) {
  const allowed = new Set(RBAC_PERMISSIONS.map((p) => p.id));
  let next = [...new Set(permissionIds.filter((id) => allowed.has(id)))];
  if (roleKey !== 'super_user') next = next.filter((id) => !isAdminPermission(id));
  return next;
}

export async function grantBooksFeatures(user: ApiUser, input: {
  email?: string;
  uid?: string;
  permissionIds: string[];
}) {
  const session = await requireAnyOrgPermission(user, ['books.users.manage', 'books.settings.manage']);
  const sql = await sqlReady();
  const wanted = [...new Set((input.permissionIds || []).map((id) => text(id)).filter(Boolean))];
  if (!wanted.length) throw new ApiError(400, 'Select at least one Books feature');
  for (const id of wanted) {
    if (!isBooksPermission(id)) throw new ApiError(400, `Only Books features can be granted here: ${id}`);
    if (!session.permissions.includes(id) && !session.isSuperUser) {
      throw new ApiError(403, `You cannot grant a feature you do not have: ${id}`);
    }
  }
  if (!wanted.includes('books.access') && (session.permissions.includes('books.access') || session.isSuperUser)) {
    wanted.push('books.access');
  }

  let targetUid = text(input.uid);
  const email = emailOf(input.email);
  if (!targetUid && email) {
    const byEmail = rows<{ id: string }>(
      await sql`SELECT id FROM users WHERE lower(COALESCE(email, '')) = ${email} LIMIT 1`,
    )[0];
    targetUid = text(byEmail?.id);
    if (!targetUid) {
      const external = rows<{ id: string }>(
        await sql`SELECT id FROM rbac_roles WHERE org_id = ${session.org.id} AND key = 'external' LIMIT 1`,
      )[0];
      if (!external?.id) throw new ApiError(500, 'Default external role missing');
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
          ${id}, ${session.org.id}, ${email}, ${text(external.id)}, 'pending', ${user.uid}, ${token},
          ${JSON.stringify({
            orgName: session.org.name,
            roleKey: 'external',
            roleName: 'Default external',
            booksGrants: wanted,
            invitedByBooksTenant: true,
            invitedBy: user.uid,
          })}::jsonb,
          NOW(), NOW(), ${expires}::timestamptz
        )
      `;
      return { pending: true as const, email, permissionIds: wanted, inviteId: id };
    }
  }
  if (!targetUid) throw new ApiError(400, 'User email or uid required');

  const existing = await getMember(sql, session.org.id, targetUid);
  if (!existing) {
    const external = rows<{ id: string }>(
      await sql`SELECT id FROM rbac_roles WHERE org_id = ${session.org.id} AND key = 'external' LIMIT 1`,
    )[0];
    if (!external?.id) throw new ApiError(500, 'Default external role missing');
    const userRow = rows<{ email: string; data: unknown }>(
      await sql`SELECT email, data FROM users WHERE id = ${targetUid} LIMIT 1`,
    )[0];
    const data = (userRow?.data && typeof userRow.data === 'object' ? userRow.data : {}) as Record<string, unknown>;
    const displayName = text(data.displayName) || emailOf(userRow?.email).split('@')[0] || 'User';
    await sql`
      INSERT INTO org_members (org_id, uid, role_id, email, display_name, status, invited_by, updated_at)
      VALUES (
        ${session.org.id}, ${targetUid}, ${text(external.id)},
        ${emailOf(userRow?.email) || email}, ${displayName}, 'active', ${user.uid}, NOW()
      )
      ON CONFLICT (org_id, uid) DO NOTHING
    `;
  }

  for (const permissionId of wanted) {
    await sql`
      INSERT INTO org_member_grants (org_id, uid, permission_id, granted_by, created_at)
      VALUES (${session.org.id}, ${targetUid}, ${permissionId}, ${user.uid}, NOW())
      ON CONFLICT DO NOTHING
    `;
  }
  return {
    pending: false as const,
    uid: targetUid,
    permissionIds: await memberGrants(sql, session.org.id, targetUid),
  };
}

export async function revokeBooksFeatures(user: ApiUser, input: { uid: string; permissionIds?: string[] }) {
  const session = await requireAnyOrgPermission(user, ['books.users.manage', 'books.settings.manage']);
  const sql = await sqlReady();
  const targetUid = text(input.uid);
  if (!targetUid) throw new ApiError(400, 'User required');
  if (input.permissionIds?.length) {
    for (const permissionId of input.permissionIds) {
      if (!isBooksPermission(permissionId)) continue;
      await sql`
        DELETE FROM org_member_grants
        WHERE org_id = ${session.org.id} AND uid = ${targetUid} AND permission_id = ${permissionId}
      `;
    }
  } else {
    await sql`
      DELETE FROM org_member_grants
      WHERE org_id = ${session.org.id} AND uid = ${targetUid} AND permission_id LIKE 'books.%'
    `;
  }
  return { ok: true, permissionIds: await memberGrants(sql, session.org.id, targetUid) };
}

/**
 * Super-user only: replace a member's extra privilege grants (on top of their role).
 * Admin.* cannot be granted here — promote the member to Super user instead.
 */
export async function setMemberPrivileges(user: ApiUser, input: { uid: string; permissionIds?: string[] }) {
  const session = await requireOrgPermission(user, 'admin.users');
  if (session.member.roleKey !== 'super_user') {
    throw new ApiError(403, 'Only a super user can edit per-user privileges');
  }
  const sql = await sqlReady();
  const targetUid = text(input.uid);
  if (!targetUid) throw new ApiError(400, 'User required');
  const member = await getMember(sql, session.org.id, targetUid);
  if (!member) throw new ApiError(404, 'Member not found');
  if (member.roleKey === 'super_user') {
    throw new ApiError(400, 'Super users already have every privilege');
  }

  const catalog = new Set(RBAC_PERMISSIONS.map((p) => p.id));
  const next = [...new Set((input.permissionIds || []).map((id) => text(id)).filter(Boolean))]
    .filter((id) => catalog.has(id) && !isAdminPermission(id));

  await sql`DELETE FROM org_member_grants WHERE org_id = ${session.org.id} AND uid = ${targetUid}`;
  for (const permissionId of next) {
    await sql`
      INSERT INTO org_member_grants (org_id, uid, permission_id, granted_by, created_at)
      VALUES (${session.org.id}, ${targetUid}, ${permissionId}, ${user.uid}, NOW())
      ON CONFLICT DO NOTHING
    `;
  }
  return {
    ok: true as const,
    uid: targetUid,
    grantIds: await memberGrants(sql, session.org.id, targetUid),
    effectiveIds: await effectivePermissions(sql, session.org.id, targetUid, member.roleId, member.roleKey),
  };
}


export { RBAC_PERMISSIONS, PLATFORM_ORG_ID };


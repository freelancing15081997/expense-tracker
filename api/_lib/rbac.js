// api/_lib/rbac.ts
import { randomBytes } from "node:crypto";
import {
  ApiError,
  getLedgerSql,
  ledgerGetUser,
  ledgerUpsertUser,
  newLedgerId
} from "../_pg-tables.js";

// api/_lib/rbac-catalog.ts
var RBAC_PERMISSIONS = [
  { id: "dashboard.view", tool: "app", feature: "dashboard", action: "view", label: "View dashboard", description: "Open the main Byjan home dashboard.", sortOrder: 10 },
  { id: "settings.view", tool: "app", feature: "settings", action: "view", label: "View settings", description: "Open account and workspace preferences.", sortOrder: 20 },
  { id: "settings.manage", tool: "app", feature: "settings", action: "manage", label: "Manage settings", description: "Update profile, categories, and app preferences.", sortOrder: 30 },
  { id: "expenses.view", tool: "expense_tracker", feature: "expenses", action: "view", label: "View expenses", description: "Browse expense tracker ledgers and entries.", sortOrder: 100 },
  { id: "expenses.create", tool: "expense_tracker", feature: "expenses", action: "create", label: "Add expenses", description: "Create ledger entries and upload receipts.", sortOrder: 110 },
  { id: "expenses.edit", tool: "expense_tracker", feature: "expenses", action: "edit", label: "Edit expenses", description: "Update existing ledger entries.", sortOrder: 120 },
  { id: "expenses.delete", tool: "expense_tracker", feature: "expenses", action: "delete", label: "Delete expenses", description: "Soft-delete ledger entries.", sortOrder: 130 },
  { id: "ledgers.view", tool: "expense_tracker", feature: "ledgers", action: "view", label: "View ledgers", description: "Open shared expense ledgers.", sortOrder: 140 },
  { id: "ledgers.create", tool: "expense_tracker", feature: "ledgers", action: "create", label: "Create ledgers", description: "Create new expense tracker ledgers.", sortOrder: 150 },
  { id: "ledgers.manage", tool: "expense_tracker", feature: "ledgers", action: "manage", label: "Manage ledgers", description: "Rename, archive, or delete ledgers you manage.", sortOrder: 160 },
  { id: "ledgers.invite", tool: "expense_tracker", feature: "ledgers", action: "invite", label: "Invite to ledgers", description: "Invite collaborators to expense ledgers.", sortOrder: 170 },
  { id: "inbound.email", tool: "expense_tracker", feature: "inbound", action: "use", label: "Inbound email capture", description: "Use ledger inbound mailboxes for expense capture.", sortOrder: 180 },
  { id: "books.access", tool: "books", feature: "books", action: "access", label: "Access Books", description: "Open the Books ERP workspace.", sortOrder: 200 },
  { id: "books.dashboard.view", tool: "books", feature: "dashboard", action: "view", label: "Books dashboards", description: "Finance dashboard, CFO view, and control tower.", sortOrder: 210 },
  { id: "books.accounting.view", tool: "books", feature: "accounting", action: "view", label: "View accounting", description: "Chart of accounts, journals, ledger, and periods.", sortOrder: 220 },
  { id: "books.accounting.post", tool: "books", feature: "accounting", action: "post", label: "Post accounting", description: "Create and post journal entries and recurring items.", sortOrder: 230 },
  { id: "books.accounting.close", tool: "books", feature: "accounting", action: "close", label: "Close periods", description: "Close and reopen accounting periods.", sortOrder: 240 },
  { id: "books.sales.view", tool: "books", feature: "sales", action: "view", label: "View sales", description: "Customers, quotes, invoices, and collections.", sortOrder: 250 },
  { id: "books.sales.manage", tool: "books", feature: "sales", action: "manage", label: "Manage sales", description: "Create and edit sales documents.", sortOrder: 260 },
  { id: "books.purchases.view", tool: "books", feature: "purchases", action: "view", label: "View purchases", description: "Vendors, POs, bills, and payment runs.", sortOrder: 270 },
  { id: "books.purchases.manage", tool: "books", feature: "purchases", action: "manage", label: "Manage purchases", description: "Create and edit purchase documents.", sortOrder: 280 },
  { id: "books.banking.view", tool: "books", feature: "banking", action: "view", label: "View banking", description: "Banking and Books expenses.", sortOrder: 290 },
  { id: "books.banking.manage", tool: "books", feature: "banking", action: "manage", label: "Manage banking", description: "Record bank transfers and Books expenses.", sortOrder: 300 },
  { id: "books.operations.view", tool: "books", feature: "operations", action: "view", label: "View operations", description: "Inventory, assets, projects, budgets, and leases.", sortOrder: 310 },
  { id: "books.operations.manage", tool: "books", feature: "operations", action: "manage", label: "Manage operations", description: "Create and edit operations records.", sortOrder: 320 },
  { id: "books.control.view", tool: "books", feature: "control", action: "view", label: "View control", description: "Tax, reports, inbox, approvals, and audit.", sortOrder: 330 },
  { id: "books.control.manage", tool: "books", feature: "control", action: "manage", label: "Manage control", description: "Act on approvals, inbox, and control workflows.", sortOrder: 340 },
  { id: "books.settings.manage", tool: "books", feature: "settings", action: "manage", label: "Books settings", description: "Rename workspace and manage Books company settings.", sortOrder: 350 },
  { id: "admin.access", tool: "admin", feature: "admin", action: "access", label: "Access admin", description: "Open the Access & roles console.", sortOrder: 400 },
  { id: "admin.users", tool: "admin", feature: "users", action: "manage", label: "Manage users", description: "Invite, assign roles, and disable organization members.", sortOrder: 410 },
  { id: "admin.roles", tool: "admin", feature: "roles", action: "manage", label: "Manage roles", description: "Create roles and edit the feature permission matrix.", sortOrder: 420 }
];
var ALL = () => RBAC_PERMISSIONS.map((p) => p.id);
var SYSTEM_ROLE_DEFS = [
  {
    key: "owner",
    name: "Owner",
    description: "Full access to every tool, including user and role administration.",
    permissions: "*"
  },
  {
    key: "admin",
    name: "Admin",
    description: "Administer people and roles, and use all product features.",
    permissions: "*"
  },
  {
    key: "manager",
    name: "Manager",
    description: "Run expense trackers and Books day-to-day without admin console access.",
    permissions: ALL().filter((id) => !id.startsWith("admin."))
  },
  {
    key: "accountant",
    name: "Accountant",
    description: "Accounting-focused Books access with expense visibility.",
    permissions: [
      "dashboard.view",
      "settings.view",
      "expenses.view",
      "ledgers.view",
      "books.access",
      "books.dashboard.view",
      "books.accounting.view",
      "books.accounting.post",
      "books.accounting.close",
      "books.sales.view",
      "books.sales.manage",
      "books.purchases.view",
      "books.purchases.manage",
      "books.banking.view",
      "books.banking.manage",
      "books.control.view",
      "books.control.manage"
    ]
  },
  {
    key: "contributor",
    name: "Contributor",
    description: "Add and edit expenses; limited Books create access.",
    permissions: [
      "dashboard.view",
      "settings.view",
      "settings.manage",
      "expenses.view",
      "expenses.create",
      "expenses.edit",
      "ledgers.view",
      "inbound.email",
      "books.access",
      "books.dashboard.view",
      "books.accounting.view",
      "books.accounting.post",
      "books.sales.view",
      "books.sales.manage",
      "books.purchases.view",
      "books.purchases.manage",
      "books.banking.view",
      "books.banking.manage",
      "books.operations.view",
      "books.control.view"
    ]
  },
  {
    key: "viewer",
    name: "Viewer",
    description: "Read-only access across dashboards, ledgers, and Books.",
    permissions: [
      "dashboard.view",
      "settings.view",
      "expenses.view",
      "ledgers.view",
      "books.access",
      "books.dashboard.view",
      "books.accounting.view",
      "books.sales.view",
      "books.purchases.view",
      "books.banking.view",
      "books.operations.view",
      "books.control.view"
    ]
  }
];
function permissionIdsForRole(key) {
  const def = SYSTEM_ROLE_DEFS.find((r) => r.key === key);
  if (!def) return [];
  if (def.permissions === "*") return ALL();
  return [...def.permissions];
}

// api/_lib/rbac.ts
function rows(result) {
  return Array.isArray(result) ? result : [];
}
function text(value) {
  return value == null ? "" : String(value);
}
function emailOf(value) {
  return text(value).trim().toLowerCase();
}
function newId(prefix) {
  return `${prefix}${randomBytes(10).toString("hex")}`;
}
var rbacReady = false;
async function ensureRbacSchema(sql) {
  const db = sql || await getLedgerSql();
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
  const sql = await getLedgerSql();
  if (!rbacReady) await ensureRbacSchema(sql);
  return sql;
}
async function seedSystemRoles(sql, orgId) {
  const map = {};
  for (const def of SYSTEM_ROLE_DEFS) {
    const existing = rows(
      await sql`SELECT id FROM rbac_roles WHERE org_id = ${orgId} AND key = ${def.key} LIMIT 1`
    )[0];
    const roleId = text(existing?.id) || newId("role_");
    await sql`
      INSERT INTO rbac_roles (id, org_id, key, name, description, is_system, updated_at)
      VALUES (${roleId}, ${orgId}, ${def.key}, ${def.name}, ${def.description}, TRUE, NOW())
      ON CONFLICT (org_id, key) DO UPDATE SET
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        is_system = TRUE,
        updated_at = NOW()
    `;
    const saved = rows(
      await sql`SELECT id FROM rbac_roles WHERE org_id = ${orgId} AND key = ${def.key} LIMIT 1`
    )[0];
    const id = text(saved?.id) || roleId;
    map[def.key] = id;
    const wanted = new Set(permissionIdsForRole(def.key));
    const current = rows(
      await sql`SELECT permission_id FROM rbac_role_permissions WHERE role_id = ${id}`
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
async function getOrg(sql, orgId) {
  const row = rows(
    await sql`SELECT id, name, owner_uid, created_at, updated_at FROM orgs WHERE id = ${orgId} LIMIT 1`
  )[0];
  if (!row) return null;
  return {
    id: text(row.id),
    name: text(row.name),
    ownerUid: text(row.owner_uid),
    createdAt: text(row.created_at),
    updatedAt: text(row.updated_at)
  };
}
async function rolePermissions(sql, roleId) {
  return rows(
    await sql`SELECT permission_id FROM rbac_role_permissions WHERE role_id = ${roleId}`
  ).map((r) => text(r.permission_id)).filter(Boolean);
}
async function listRoles(sql, orgId) {
  const list = rows(
    await sql`
      SELECT r.id, r.org_id, r.key, r.name, r.description, r.is_system,
        COALESCE((
          SELECT COUNT(*) FROM org_members m
          WHERE m.role_id = r.id AND m.status = 'active'
        ), 0) AS member_count
      FROM rbac_roles r
      WHERE r.org_id = ${orgId}
      ORDER BY r.is_system DESC, r.name ASC
    `
  );
  const out = [];
  for (const row of list) {
    out.push({
      id: text(row.id),
      orgId: text(row.org_id),
      key: text(row.key),
      name: text(row.name),
      description: text(row.description),
      isSystem: Boolean(row.is_system),
      permissionIds: await rolePermissions(sql, text(row.id)),
      memberCount: Number(row.member_count || 0)
    });
  }
  return out;
}
async function getMember(sql, orgId, uid) {
  const row = rows(
    await sql`
      SELECT m.org_id, m.uid, m.role_id, m.email, m.display_name, m.status, m.invited_by,
        m.created_at, m.updated_at, r.key AS role_key, r.name AS role_name
      FROM org_members m
      JOIN rbac_roles r ON r.id = m.role_id
      WHERE m.org_id = ${orgId} AND m.uid = ${uid}
      LIMIT 1
    `
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
    status: text(row.status) || "active",
    invitedBy: text(row.invited_by),
    createdAt: text(row.created_at),
    updatedAt: text(row.updated_at)
  };
}
async function createPersonalOrg(sql, user, displayName) {
  const orgId = `org_${user.uid}`;
  const label = text(displayName) || emailOf(user.email).split("@")[0] || "Owner";
  const name = `${label}'s workspace`;
  await sql`
    INSERT INTO orgs (id, name, owner_uid, data, created_at, updated_at)
    VALUES (${orgId}, ${name}, ${user.uid}, ${JSON.stringify({ kind: "personal" })}::jsonb, NOW(), NOW())
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
    updatedAt: (/* @__PURE__ */ new Date()).toISOString()
  }, true);
  return orgId;
}
async function ensureUserOrg(user, displayName = "") {
  const sql = await sqlReady();
  const profile = await ledgerGetUser(user.uid);
  const preferred = text(profile?.orgId);
  if (preferred) {
    const member = await getMember(sql, preferred, user.uid);
    if (member?.status === "active") {
      await seedSystemRoles(sql, preferred);
      return preferred;
    }
  }
  const byUid = rows(
    await sql`
      SELECT org_id FROM org_members
      WHERE uid = ${user.uid} AND status = 'active'
      ORDER BY created_at ASC
      LIMIT 1
    `
  )[0];
  if (byUid?.org_id) {
    await seedSystemRoles(sql, text(byUid.org_id));
    await ledgerUpsertUser(user.uid, { orgId: text(byUid.org_id) }, true);
    return text(byUid.org_id);
  }
  const email = emailOf(user.email || profile?.email);
  if (email) {
    const invite = rows(
      await sql`
        SELECT id, org_id, role_id FROM org_invites
        WHERE email = ${email} AND status = 'pending'
        ORDER BY created_at ASC
        LIMIT 1
      `
    )[0];
    if (invite) {
      const label = text(displayName || profile?.displayName || email.split("@")[0] || "Member");
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
  return createPersonalOrg(sql, user, text(displayName || profile?.displayName || ""));
}
async function getRbacSession(user, displayName = "") {
  const sql = await sqlReady();
  const orgId = await ensureUserOrg(user, displayName);
  const org = await getOrg(sql, orgId);
  if (!org) throw new ApiError(500, "Organization missing");
  const member = await getMember(sql, orgId, user.uid);
  if (!member || member.status !== "active") {
    throw new ApiError(403, "You are not an active member of this organization");
  }
  return {
    org,
    member,
    permissions: await rolePermissions(sql, member.roleId),
    roles: await listRoles(sql, orgId),
    permissionCatalog: RBAC_PERMISSIONS
  };
}
async function requireOrgPermission(user, permissionId, displayName = "") {
  const session = await getRbacSession(user, displayName);
  if (!session.permissions.includes(permissionId)) {
    throw new ApiError(403, `Missing permission: ${permissionId}`);
  }
  return session;
}
async function requireAnyOrgPermission(user, permissionIds, displayName = "") {
  const session = await getRbacSession(user, displayName);
  if (!permissionIds.some((id) => session.permissions.includes(id))) {
    throw new ApiError(403, `Missing permission: ${permissionIds.join(" | ")}`);
  }
  return session;
}
async function userHasPermission(user, permissionId) {
  try {
    const session = await getRbacSession(user);
    return session.permissions.includes(permissionId);
  } catch {
    return false;
  }
}
async function listOrgMembers(user) {
  const session = await requireOrgPermission(user, "admin.users");
  const sql = await sqlReady();
  const list = rows(
    await sql`
      SELECT m.org_id, m.uid, m.role_id, m.email, m.display_name, m.status, m.invited_by,
        m.created_at, m.updated_at, r.key AS role_key, r.name AS role_name
      FROM org_members m
      JOIN rbac_roles r ON r.id = m.role_id
      WHERE m.org_id = ${session.org.id}
      ORDER BY
        CASE m.status WHEN 'active' THEN 0 WHEN 'invited' THEN 1 ELSE 2 END,
        COALESCE(NULLIF(m.display_name, ''), m.email) ASC
    `
  );
  return {
    ...session,
    members: list.map((row) => ({
      orgId: text(row.org_id),
      uid: text(row.uid),
      roleId: text(row.role_id),
      roleKey: text(row.role_key),
      roleName: text(row.role_name),
      email: emailOf(row.email),
      displayName: text(row.display_name),
      status: text(row.status) || "active",
      invitedBy: text(row.invited_by),
      createdAt: text(row.created_at),
      updatedAt: text(row.updated_at)
    }))
  };
}
async function listOrgInvites(user) {
  const session = await requireOrgPermission(user, "admin.users");
  const sql = await sqlReady();
  const list = rows(
    await sql`
      SELECT i.id, i.org_id, i.email, i.role_id, i.status, i.invited_by, i.token,
        i.created_at, i.expires_at, r.key AS role_key, r.name AS role_name
      FROM org_invites i
      JOIN rbac_roles r ON r.id = i.role_id
      WHERE i.org_id = ${session.org.id} AND i.status = 'pending'
      ORDER BY i.created_at DESC
    `
  );
  return {
    ...session,
    invites: list.map((row) => ({
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
      expiresAt: row.expires_at ? text(row.expires_at) : null
    }))
  };
}
async function assertRoleInOrg(sql, orgId, roleId) {
  const row = rows(
    await sql`SELECT id, key, name, is_system FROM rbac_roles WHERE id = ${roleId} AND org_id = ${orgId} LIMIT 1`
  )[0];
  if (!row) throw new ApiError(400, "Role not found in this organization");
  return row;
}
async function countActiveOwners(sql, orgId) {
  const row = rows(
    await sql`
      SELECT COUNT(*) AS count
      FROM org_members m
      JOIN rbac_roles r ON r.id = m.role_id
      WHERE m.org_id = ${orgId} AND m.status = 'active' AND r.key = 'owner'
    `
  )[0];
  return Number(row?.count || 0);
}
async function inviteOrgMember(user, input) {
  const session = await requireOrgPermission(user, "admin.users");
  const sql = await sqlReady();
  const email = emailOf(input.email);
  if (!email || !email.includes("@")) throw new ApiError(400, "Valid email required");
  const role = await assertRoleInOrg(sql, session.org.id, text(input.roleId));
  if (text(role.key) === "owner" && session.member.roleKey !== "owner") {
    throw new ApiError(403, "Only an owner can invite another owner");
  }
  const existingMember = rows(
    await sql`
      SELECT uid, status FROM org_members
      WHERE org_id = ${session.org.id} AND lower(COALESCE(email, '')) = ${email}
      LIMIT 1
    `
  )[0];
  if (existingMember && text(existingMember.status) === "active") {
    throw new ApiError(409, "That user is already a member");
  }
  const existingUser = rows(
    await sql`SELECT id, data FROM users WHERE lower(COALESCE(email, '')) = ${email} LIMIT 1`
  )[0];
  if (existingUser?.id) {
    const data = existingUser.data && typeof existingUser.data === "object" ? existingUser.data : {};
    const displayName = text(data.displayName) || email.split("@")[0];
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
    return { joined: true, uid: text(existingUser.id) };
  }
  await sql`
    UPDATE org_invites
    SET status = 'cancelled', updated_at = NOW()
    WHERE org_id = ${session.org.id} AND email = ${email} AND status = 'pending'
  `;
  const id = newId("oinv_");
  const token = newId("otk_");
  const expires = new Date(Date.now() + 14 * 24 * 60 * 60 * 1e3).toISOString();
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
    joined: false,
    invite: {
      id,
      orgId: session.org.id,
      email,
      roleId: text(role.id),
      roleKey: text(role.key),
      roleName: text(role.name),
      status: "pending",
      invitedBy: user.uid,
      token,
      expiresAt: expires
    }
  };
}
async function updateOrgMember(user, input) {
  const session = await requireOrgPermission(user, "admin.users");
  const sql = await sqlReady();
  const targetUid = text(input.uid);
  if (!targetUid) throw new ApiError(400, "Member required");
  const target = await getMember(sql, session.org.id, targetUid);
  if (!target) throw new ApiError(404, "Member not found");
  let nextRoleId = target.roleId;
  if (input.roleId) {
    const role = await assertRoleInOrg(sql, session.org.id, text(input.roleId));
    if (text(role.key) === "owner" && session.member.roleKey !== "owner") {
      throw new ApiError(403, "Only an owner can assign the owner role");
    }
    if (target.roleKey === "owner" && text(role.key) !== "owner") {
      if (await countActiveOwners(sql, session.org.id) <= 1) {
        throw new ApiError(400, "Keep at least one active owner");
      }
    }
    nextRoleId = text(role.id);
  }
  let nextStatus = target.status;
  if (input.status) {
    const status = text(input.status);
    if (!["active", "disabled"].includes(status)) throw new ApiError(400, "Invalid status");
    if (status === "disabled") {
      if (targetUid === user.uid) throw new ApiError(400, "You cannot disable your own account");
      if (target.roleKey === "owner" && await countActiveOwners(sql, session.org.id) <= 1) {
        throw new ApiError(400, "Keep at least one active owner");
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
async function removeOrgMember(user, uidToRemove) {
  const session = await requireOrgPermission(user, "admin.users");
  const sql = await sqlReady();
  const targetUid = text(uidToRemove);
  if (!targetUid) throw new ApiError(400, "Member required");
  if (targetUid === user.uid) throw new ApiError(400, "You cannot remove yourself");
  const target = await getMember(sql, session.org.id, targetUid);
  if (!target) throw new ApiError(404, "Member not found");
  if (target.roleKey === "owner" && await countActiveOwners(sql, session.org.id) <= 1) {
    throw new ApiError(400, "Keep at least one active owner");
  }
  await sql`DELETE FROM org_members WHERE org_id = ${session.org.id} AND uid = ${targetUid}`;
  return { ok: true };
}
async function cancelOrgInvite(user, inviteId) {
  const session = await requireOrgPermission(user, "admin.users");
  const sql = await sqlReady();
  await sql`
    UPDATE org_invites
    SET status = 'cancelled', updated_at = NOW()
    WHERE id = ${text(inviteId)} AND org_id = ${session.org.id} AND status = 'pending'
  `;
  return { ok: true };
}
async function createCustomRole(user, input) {
  const session = await requireOrgPermission(user, "admin.roles");
  const sql = await sqlReady();
  const name = text(input.name).trim();
  if (!name) throw new ApiError(400, "Role name required");
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 40) || newLedgerId();
  const key = `custom_${slug}`;
  const id = newId("role_");
  try {
    await sql`
      INSERT INTO rbac_roles (id, org_id, key, name, description, is_system, updated_at)
      VALUES (${id}, ${session.org.id}, ${key}, ${name}, ${text(input.description)}, FALSE, NOW())
    `;
  } catch {
    throw new ApiError(409, "A role with a similar name already exists");
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
async function updateCustomRole(user, input) {
  const session = await requireOrgPermission(user, "admin.roles");
  const sql = await sqlReady();
  const role = await assertRoleInOrg(sql, session.org.id, text(input.roleId));
  if (input.name != null) {
    if (Boolean(role.is_system)) throw new ApiError(400, "System role names are fixed");
    const name = text(input.name).trim();
    if (!name) throw new ApiError(400, "Role name required");
    await sql`UPDATE rbac_roles SET name = ${name}, updated_at = NOW() WHERE id = ${text(role.id)}`;
  }
  if (input.description != null) {
    await sql`
      UPDATE rbac_roles SET description = ${text(input.description)}, updated_at = NOW()
      WHERE id = ${text(role.id)}
    `;
  }
  if (input.permissionIds) {
    if (Boolean(role.is_system) && (text(role.key) === "owner" || text(role.key) === "admin")) {
      throw new ApiError(400, "Owner and Admin always retain full permissions");
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
async function deleteCustomRole(user, roleId) {
  const session = await requireOrgPermission(user, "admin.roles");
  const sql = await sqlReady();
  const role = await assertRoleInOrg(sql, session.org.id, text(roleId));
  if (Boolean(role.is_system)) throw new ApiError(400, "System roles cannot be deleted");
  const members = rows(
    await sql`SELECT COUNT(*) AS count FROM org_members WHERE role_id = ${text(role.id)}`
  )[0];
  if (Number(members?.count || 0) > 0) {
    throw new ApiError(400, "Reassign members before deleting this role");
  }
  await sql`DELETE FROM rbac_role_permissions WHERE role_id = ${text(role.id)}`;
  await sql`DELETE FROM rbac_roles WHERE id = ${text(role.id)}`;
  return { ok: true };
}
async function renameOrg(user, name) {
  const session = await requireAnyOrgPermission(user, ["admin.access", "admin.users", "admin.roles"]);
  const sql = await sqlReady();
  const next = text(name).trim();
  if (!next) throw new ApiError(400, "Organization name required");
  await sql`UPDATE orgs SET name = ${next}, updated_at = NOW() WHERE id = ${session.org.id}`;
  return getOrg(sql, session.org.id);
}
export {
  RBAC_PERMISSIONS,
  cancelOrgInvite,
  createCustomRole,
  deleteCustomRole,
  ensureRbacSchema,
  ensureUserOrg,
  getRbacSession,
  inviteOrgMember,
  listOrgInvites,
  listOrgMembers,
  removeOrgMember,
  renameOrg,
  requireAnyOrgPermission,
  requireOrgPermission,
  updateCustomRole,
  updateOrgMember,
  userHasPermission
};

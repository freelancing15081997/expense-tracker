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
  { id: "books.users.manage", tool: "books", feature: "users", action: "manage", label: "Books users & access", description: "Invite people into a Books company and grant a subset of the tenant\u2019s Books features.", sortOrder: 360 },
  { id: "admin.access", tool: "admin", feature: "admin", action: "access", label: "Access admin", description: "Open the platform Access & roles console (super users only).", sortOrder: 400 },
  { id: "admin.users", tool: "admin", feature: "users", action: "manage", label: "Manage users", description: "Invite, assign roles, and disable platform members.", sortOrder: 410 },
  { id: "admin.roles", tool: "admin", feature: "roles", action: "manage", label: "Manage roles", description: "Edit the default external role and custom role permission matrix.", sortOrder: 420 }
];
var PLATFORM_ORG_ID = "org_platform";
var PLATFORM_ORG_NAME = "Byjan";
var BASE_SUPER_USER_EMAILS = [
  "pujaribadrinath@gmail.com",
  "freelancing15081997@gmail.com"
];
var ALL = () => RBAC_PERMISSIONS.map((p) => p.id);
var SYSTEM_ROLE_DEFS = [
  {
    key: "super_user",
    name: "Super user",
    description: "Internal platform operator. Full product access plus Access & roles. Only a super user can create another super user.",
    syncPermissions: true,
    permissions: "*"
  },
  {
    key: "external",
    name: "Default external",
    description: "Assigned to signup / migrated users. Keeps normal product access (no Access & roles). Super users can tighten or expand this matrix anytime.",
    syncPermissions: false,
    // Product baseline so existing users keep working after migration. Never includes admin.*.
    permissions: "product"
  }
];
function permissionIdsForRole(key) {
  const def = SYSTEM_ROLE_DEFS.find((r) => r.key === key);
  if (!def) return [];
  if (def.permissions === "*") return ALL();
  if (def.permissions === "product") return ALL().filter((id) => !id.startsWith("admin."));
  return [...def.permissions];
}
function productPermissionIds() {
  return ALL().filter((id) => !id.startsWith("admin."));
}
function isAdminPermission(permissionId) {
  return permissionId.startsWith("admin.");
}
function isBooksPermission(permissionId) {
  return permissionId.startsWith("books.");
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
function superUserEmailsFromEnv() {
  const raw = String(process.env.SUPER_USER_EMAILS || process.env.BYJAN_SUPER_USER_EMAILS || "").trim();
  const fromEnv = raw ? raw.split(/[,;\s]+/).map((e) => e.trim().toLowerCase()).filter(Boolean) : [];
  return [.../* @__PURE__ */ new Set([...BASE_SUPER_USER_EMAILS.map((e) => e.toLowerCase()), ...fromEnv])];
}
function isAllowlistedSuper(email) {
  const list = superUserEmailsFromEnv();
  return Boolean(email && list.includes(email));
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
    const current = rows(
      await sql`SELECT permission_id FROM rbac_role_permissions WHERE role_id = ${id}`
    ).map((r) => text(r.permission_id));
    const have = new Set(current);
    if (!def.syncPermissions) {
      if (have.size === 0) {
        const baseline = def.permissions === "product" ? productPermissionIds() : permissionIdsForRole(def.key);
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
    const wanted = new Set(permissionIdsForRole(def.key));
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
async function memberGrants(sql, orgId, uid) {
  return rows(
    await sql`
      SELECT permission_id FROM org_member_grants
      WHERE org_id = ${orgId} AND uid = ${uid}
    `
  ).map((r) => text(r.permission_id)).filter(Boolean);
}
async function effectivePermissions(sql, orgId, uid, roleId) {
  const fromRole = await rolePermissions(sql, roleId);
  const grants = await memberGrants(sql, orgId, uid);
  return [.../* @__PURE__ */ new Set([...fromRole, ...grants])];
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
      ORDER BY
        CASE r.key WHEN 'super_user' THEN 0 WHEN 'external' THEN 1 ELSE 2 END,
        r.is_system DESC, r.name ASC
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
async function ensurePlatformOrg(sql, bootstrapOwnerUid = "") {
  const existing = await getOrg(sql, PLATFORM_ORG_ID);
  if (!existing) {
    await sql`
      INSERT INTO orgs (id, name, owner_uid, data, created_at, updated_at)
      VALUES (
        ${PLATFORM_ORG_ID}, ${PLATFORM_ORG_NAME}, ${bootstrapOwnerUid},
        ${JSON.stringify({ kind: "platform" })}::jsonb, NOW(), NOW()
      )
      ON CONFLICT (id) DO NOTHING
    `;
  }
  await seedSystemRoles(sql, PLATFORM_ORG_ID);
  return PLATFORM_ORG_ID;
}
async function upsertPlatformMember(sql, user, roleId, displayName, invitedBy) {
  const email = emailOf(user.email);
  const label = text(displayName) || email.split("@")[0] || "User";
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
    updatedAt: (/* @__PURE__ */ new Date()).toISOString()
  }, true);
}
async function applyInviteBooksGrants(sql, orgId, uid, inviteData) {
  const data = inviteData && typeof inviteData === "object" ? inviteData : {};
  const grants = Array.isArray(data.booksGrants) ? data.booksGrants.map((g) => text(g)).filter((id) => isBooksPermission(id)) : [];
  for (const permissionId of grants) {
    await sql`
      INSERT INTO org_member_grants (org_id, uid, permission_id, granted_by, created_at)
      VALUES (${orgId}, ${uid}, ${permissionId}, ${text(data.invitedBy) || uid}, NOW())
      ON CONFLICT DO NOTHING
    `;
  }
}
async function applyInvitePrivilegeGrants(sql, orgId, uid, inviteData) {
  const data = inviteData && typeof inviteData === "object" ? inviteData : {};
  await applyInviteBooksGrants(sql, orgId, uid, inviteData);
  const catalog = new Set(RBAC_PERMISSIONS.map((p) => p.id));
  const raw = Array.isArray(data.permissionIds) ? data.permissionIds : Array.isArray(data.grants) ? data.grants : [];
  const grants = raw.map((g) => text(g)).filter((id) => catalog.has(id) && !isAdminPermission(id));
  for (const permissionId of grants) {
    await sql`
      INSERT INTO org_member_grants (org_id, uid, permission_id, granted_by, created_at)
      VALUES (${orgId}, ${uid}, ${permissionId}, ${text(data.invitedBy) || uid}, NOW())
      ON CONFLICT DO NOTHING
    `;
  }
}
var FIREBASE_WEB_API_KEY = process.env.FIREBASE_API_KEY || process.env.VITE_FIREBASE_API_KEY || "AIzaSyDQUXdMTTUOONPbua5cWm75Jn-7-SkRwjE";
async function provisionFirebaseAuthUser(input) {
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${FIREBASE_WEB_API_KEY}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: input.email,
        password: input.password,
        displayName: input.displayName,
        returnSecureToken: false
      })
    }
  );
  const payload = await res.json().catch(() => ({}));
  if (!res.ok || !payload.localId) {
    const msg = String(payload.error?.message || "Could not create login for this user");
    if (msg.includes("EMAIL_EXISTS")) {
      throw Object.assign(new ApiError(409, "That email already has a login. Search People or use Invite instead."), {
        code: "EMAIL_EXISTS"
      });
    }
    throw new ApiError(400, msg.replace(/_/g, " ").toLowerCase());
  }
  return { uid: text(payload.localId), email: emailOf(payload.email || input.email) };
}
async function replaceMemberGrants(sql, orgId, uid, grantedBy, permissionIds) {
  const catalog = new Set(RBAC_PERMISSIONS.map((p) => p.id));
  const next = [...new Set(permissionIds.map((id) => text(id)).filter(Boolean))].filter((id) => catalog.has(id) && !isAdminPermission(id));
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
var LEGACY_PRIVILEGED_ROLE_KEYS = /* @__PURE__ */ new Set(["owner", "admin", "manager", "accountant", "contributor", "viewer"]);
async function migrateLegacyPlatformMembership(sql, user, email, roles) {
  const member = await getMember(sql, PLATFORM_ORG_ID, user.uid);
  if (!member) return null;
  const allowlisted = isAllowlistedSuper(email);
  const key = text(member.roleKey);
  if (key === "super_user" || allowlisted) {
    if (allowlisted && key !== "super_user" && roles.super_user) {
      await sql`
        UPDATE org_members SET role_id = ${roles.super_user}, updated_at = NOW()
        WHERE org_id = ${PLATFORM_ORG_ID} AND uid = ${user.uid}
      `;
      return getMember(sql, PLATFORM_ORG_ID, user.uid);
    }
    return member;
  }
  if (LEGACY_PRIVILEGED_ROLE_KEYS.has(key) && roles.external) {
    await sql`
      UPDATE org_members SET role_id = ${roles.external}, updated_at = NOW()
      WHERE org_id = ${PLATFORM_ORG_ID} AND uid = ${user.uid}
    `;
    return getMember(sql, PLATFORM_ORG_ID, user.uid);
  }
  return member;
}
async function stripAdminFromNonSuperRoles(sql, orgId) {
  const rows_ = rows(
    await sql`
      SELECT r.id AS role_id, r.key
      FROM rbac_roles r
      WHERE r.org_id = ${orgId} AND r.key <> 'super_user'
    `
  );
  for (const row of rows_) {
    await sql`
      DELETE FROM rbac_role_permissions rp
      USING rbac_permissions p
      WHERE rp.role_id = ${text(row.role_id)}
        AND rp.permission_id = p.id
        AND p.id LIKE 'admin.%'
    `;
  }
}
async function ensureUserOrg(user, displayName = "") {
  const sql = await sqlReady();
  const profile = await ledgerGetUser(user.uid);
  const label = text(displayName || profile?.displayName || "");
  const email = emailOf(user.email || profile?.email);
  await ensurePlatformOrg(sql, user.uid);
  const roles = await seedSystemRoles(sql, PLATFORM_ORG_ID);
  if (email) {
    const invite = rows(
      await sql`
        SELECT id, org_id, role_id, data FROM org_invites
        WHERE email = ${email} AND status = 'pending' AND org_id = ${PLATFORM_ORG_ID}
        ORDER BY created_at ASC
        LIMIT 1
      `
    )[0];
    if (invite) {
      const name = label || email.split("@")[0] || "Member";
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
    const legacy = rows(
      await sql`
        SELECT m.org_id, r.key AS role_key
        FROM org_members m
        JOIN rbac_roles r ON r.id = m.role_id
        WHERE m.uid = ${user.uid} AND m.status = 'active' AND m.org_id <> ${PLATFORM_ORG_ID}
        ORDER BY m.created_at ASC
        LIMIT 1
      `
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
async function remappedAllLegacyMembers(sql) {
  const roles = await seedSystemRoles(sql, PLATFORM_ORG_ID);
  if (!roles.external || !roles.super_user) return;
  const allow = new Set(superUserEmailsFromEnv());
  for (const email of allow) {
    await sql`
      UPDATE org_members
      SET role_id = ${roles.super_user}, status = 'active', updated_at = NOW()
      WHERE org_id = ${PLATFORM_ORG_ID}
        AND lower(email) = ${email}
        AND role_id <> ${roles.super_user}
    `;
  }
  const legacy = rows(
    await sql`
      SELECT m.uid, m.email, r.key AS role_key
      FROM org_members m
      JOIN rbac_roles r ON r.id = m.role_id
      WHERE m.org_id = ${PLATFORM_ORG_ID}
        AND m.status = 'active'
        AND r.key IN ('owner', 'admin', 'manager', 'accountant', 'contributor', 'viewer')
    `
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
async function getRbacSession(user, displayName = "") {
  const sql = await sqlReady();
  await remappedAllLegacyMembers(sql);
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
    permissions: await effectivePermissions(sql, orgId, user.uid, member.roleId),
    roles: await listRoles(sql, orgId),
    permissionCatalog: RBAC_PERMISSIONS,
    isSuperUser: member.roleKey === "super_user"
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
async function syncRegisteredUsersIntoPlatform(sql) {
  await ensurePlatformOrg(sql, "");
  const roles = await seedSystemRoles(sql, PLATFORM_ORG_ID);
  const externalRoleId = text(roles.external);
  const superRoleId = text(roles.super_user);
  if (!externalRoleId) return;
  const missing = rows(
    await sql`
      SELECT u.id, u.email, u.display_name, u.data
      FROM users u
      WHERE NOT EXISTS (
        SELECT 1 FROM org_members m
        WHERE m.org_id = ${PLATFORM_ORG_ID} AND m.uid = u.id
      )
      ORDER BY u.updated_at DESC NULLS LAST
      LIMIT 500
    `
  );
  for (const u of missing) {
    const uid = text(u.id);
    if (!uid) continue;
    const data = u.data && typeof u.data === "object" ? u.data : {};
    const email = emailOf(u.email || data.email);
    const label = text(u.display_name || data.displayName) || email.split("@")[0] || "User";
    const roleId = isAllowlistedSuper(email) && superRoleId ? superRoleId : externalRoleId;
    await sql`
      INSERT INTO org_members (org_id, uid, role_id, email, display_name, status, invited_by, updated_at)
      VALUES (${PLATFORM_ORG_ID}, ${uid}, ${roleId}, ${email}, ${label}, 'active', ${uid}, NOW())
      ON CONFLICT (org_id, uid) DO NOTHING
    `;
  }
  const legacy = rows(
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
      LIMIT 200
    `
  );
  for (const row of legacy) {
    const uid = text(row.uid);
    if (!uid) continue;
    const email = emailOf(row.email);
    const label = text(row.display_name) || email.split("@")[0] || "User";
    const roleId = isAllowlistedSuper(email) && superRoleId ? superRoleId : externalRoleId;
    await sql`
      INSERT INTO org_members (org_id, uid, role_id, email, display_name, status, invited_by, updated_at)
      VALUES (${PLATFORM_ORG_ID}, ${uid}, ${roleId}, ${email}, ${label}, 'active', ${uid}, NOW())
      ON CONFLICT (org_id, uid) DO NOTHING
    `;
  }
  if (typeof remappedAllLegacyMembers === "function") {
    await remappedAllLegacyMembers(sql);
  }
}
async function listOrgMembers(user, input = {}) {
  const session = await requireAnyOrgPermission(user, ["admin.access", "admin.users", "admin.roles"]);
  const sql = await sqlReady();
  await syncRegisteredUsersIntoPlatform(sql);
  const pageSize = Math.min(100, Math.max(10, Number(input.pageSize) || 25));
  const page = Math.max(1, Number(input.page) || 1);
  const offset = (page - 1) * pageSize;
  const q = text(input.query).trim().toLowerCase();
  const like = q ? `%${q}%` : "";
  const countRow = q ? rows(
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
        `
  )[0] : rows(
    await sql`SELECT COUNT(*) AS count FROM org_members WHERE org_id = ${session.org.id}`
  )[0];
  const total = Number(countRow?.count || 0);
  const list = q ? rows(
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
        `
  ) : rows(
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
        `
  );
  const members = [];
  for (const row of list) {
    const uid = text(row.uid);
    members.push({
      orgId: text(row.org_id),
      uid,
      roleId: text(row.role_id),
      roleKey: text(row.role_key) || "external",
      roleName: text(row.role_name) || "Default external",
      email: emailOf(row.email),
      displayName: text(row.display_name),
      status: text(row.status) || "active",
      invitedBy: text(row.invited_by),
      createdAt: text(row.created_at),
      updatedAt: text(row.updated_at),
      grantIds: await memberGrants(sql, session.org.id, uid)
    });
  }
  return {
    ...session,
    members,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize))
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
async function countActiveSuperUsers(sql, orgId) {
  const row = rows(
    await sql`
      SELECT COUNT(*) AS count
      FROM org_members m
      JOIN rbac_roles r ON r.id = m.role_id
      WHERE m.org_id = ${orgId} AND m.status = 'active' AND r.key = 'super_user'
    `
  )[0];
  return Number(row?.count || 0);
}
function sanitizeExtraPermissionIds(permissionIds) {
  const catalog = new Set(RBAC_PERMISSIONS.map((p) => p.id));
  return [...new Set((Array.isArray(permissionIds) ? permissionIds : []).map((id) => text(id)).filter(Boolean))].filter((id) => catalog.has(id) && !isAdminPermission(id));
}
async function inviteOrgMember(user, input) {
  const session = await requireOrgPermission(user, "admin.users");
  const sql = await sqlReady();
  const email = emailOf(input.email);
  if (!email || !email.includes("@")) throw new ApiError(400, "Valid email required");
  const role = await assertRoleInOrg(sql, session.org.id, text(input.roleId));
  if (text(role.key) === "super_user" && session.member.roleKey !== "super_user") {
    throw new ApiError(403, "Only a super user can invite another super user");
  }
  const extraGrants = sanitizeExtraPermissionIds(input.permissionIds);
  if (extraGrants.length && session.member.roleKey !== "super_user") {
    throw new ApiError(403, "Only a super user can assign per-user privileges");
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
    if (extraGrants.length) {
      await replaceMemberGrants(sql, session.org.id, text(existingUser.id), user.uid, extraGrants);
    }
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
      ${JSON.stringify({
    orgName: session.org.name,
    roleKey: text(role.key),
    roleName: text(role.name),
    invitedBy: user.uid,
    permissionIds: extraGrants
  })}::jsonb,
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
async function createOrgUser(user, input) {
  const session = await requireOrgPermission(user, "admin.users");
  const sql = await sqlReady();
  const email = emailOf(input.email);
  if (!email || !email.includes("@")) throw new ApiError(400, "Valid email required");
  const displayName = text(input.displayName).trim() || email.split("@")[0] || "User";
  const password = text(input.password);
  const role = await assertRoleInOrg(sql, session.org.id, text(input.roleId));
  if (text(role.key) === "super_user" && session.member.roleKey !== "super_user") {
    throw new ApiError(403, "Only a super user can assign the super user role");
  }
  const extraGrants = sanitizeExtraPermissionIds(input.permissionIds);
  if (extraGrants.length && session.member.roleKey !== "super_user") {
    throw new ApiError(403, "Only a super user can assign per-user privileges");
  }
  const existingMember = rows(
    await sql`
      SELECT uid, status FROM org_members
      WHERE org_id = ${session.org.id} AND lower(COALESCE(email, '')) = ${email}
      LIMIT 1
    `
  )[0];
  if (existingMember && text(existingMember.status) === "active") {
    throw new ApiError(409, "That user is already a member \u2014 search People to edit them");
  }
  let uid = "";
  let provisioned = false;
  if (password) {
    if (password.length < 8) throw new ApiError(400, "Password must be at least 8 characters");
    try {
      const created = await provisionFirebaseAuthUser({ email, password, displayName });
      uid = created.uid;
      provisioned = true;
    } catch (err) {
      if (err?.code === "EMAIL_EXISTS" || String(err?.message || "").includes("already has a login")) {
        const existingUser = rows(
          await sql`SELECT id FROM users WHERE lower(COALESCE(email, '')) = ${email} LIMIT 1`
        )[0];
        if (!existingUser?.id) {
          throw new ApiError(409, "That email already has a login. Leave password blank to invite, or search People after they sign in once.");
        }
        uid = text(existingUser.id);
      } else {
        throw err;
      }
    }
  } else {
    const existingUser = rows(
      await sql`SELECT id FROM users WHERE lower(COALESCE(email, '')) = ${email} LIMIT 1`
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
      joined: true,
      uid,
      provisioned,
      grantIds,
      member: await getMember(sql, session.org.id, uid)
    };
  }
  return inviteOrgMember(user, {
    email,
    roleId: text(role.id),
    permissionIds: extraGrants
  });
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
    if (text(role.key) === "super_user" && session.member.roleKey !== "super_user") {
      throw new ApiError(403, "Only a super user can assign the super user role");
    }
    if (target.roleKey === "super_user" && text(role.key) !== "super_user") {
      if (await countActiveSuperUsers(sql, session.org.id) <= 1) {
        throw new ApiError(400, "Keep at least one active super user");
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
      if (target.roleKey === "super_user" && await countActiveSuperUsers(sql, session.org.id) <= 1) {
        throw new ApiError(400, "Keep at least one active super user");
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
  if (target.roleKey === "super_user" && await countActiveSuperUsers(sql, session.org.id) <= 1) {
    throw new ApiError(400, "Keep at least one active super user");
  }
  await sql`DELETE FROM org_member_grants WHERE org_id = ${session.org.id} AND uid = ${targetUid}`;
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
  if (session.member.roleKey !== "super_user") {
    throw new ApiError(403, "Only a super user can create roles");
  }
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
  for (const permissionId of sanitizeRolePermissionIds(input.permissionIds || [], key)) {
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
  if (session.member.roleKey !== "super_user") {
    throw new ApiError(403, "Only a super user can edit roles");
  }
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
    if (text(role.key) === "super_user") {
      throw new ApiError(400, "Super user always retains full permissions");
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
async function deleteCustomRole(user, roleId) {
  const session = await requireOrgPermission(user, "admin.roles");
  if (session.member.roleKey !== "super_user") {
    throw new ApiError(403, "Only a super user can delete roles");
  }
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
function sanitizeRolePermissionIds(permissionIds, roleKey) {
  const allowed = new Set(RBAC_PERMISSIONS.map((p) => p.id));
  let next = [...new Set(permissionIds.filter((id) => allowed.has(id)))];
  if (roleKey !== "super_user") next = next.filter((id) => !isAdminPermission(id));
  return next;
}
async function grantBooksFeatures(user, input) {
  const session = await requireAnyOrgPermission(user, ["books.users.manage", "books.settings.manage"]);
  const sql = await sqlReady();
  const wanted = [...new Set((input.permissionIds || []).map((id) => text(id)).filter(Boolean))];
  if (!wanted.length) throw new ApiError(400, "Select at least one Books feature");
  for (const id of wanted) {
    if (!isBooksPermission(id)) throw new ApiError(400, `Only Books features can be granted here: ${id}`);
    if (!session.permissions.includes(id) && !session.isSuperUser) {
      throw new ApiError(403, `You cannot grant a feature you do not have: ${id}`);
    }
  }
  if (!wanted.includes("books.access") && (session.permissions.includes("books.access") || session.isSuperUser)) {
    wanted.push("books.access");
  }
  let targetUid = text(input.uid);
  const email = emailOf(input.email);
  if (!targetUid && email) {
    const byEmail = rows(
      await sql`SELECT id FROM users WHERE lower(COALESCE(email, '')) = ${email} LIMIT 1`
    )[0];
    targetUid = text(byEmail?.id);
    if (!targetUid) {
      const external = rows(
        await sql`SELECT id FROM rbac_roles WHERE org_id = ${session.org.id} AND key = 'external' LIMIT 1`
      )[0];
      if (!external?.id) throw new ApiError(500, "Default external role missing");
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
          ${id}, ${session.org.id}, ${email}, ${text(external.id)}, 'pending', ${user.uid}, ${token},
          ${JSON.stringify({
        orgName: session.org.name,
        roleKey: "external",
        roleName: "Default external",
        booksGrants: wanted,
        invitedByBooksTenant: true,
        invitedBy: user.uid
      })}::jsonb,
          NOW(), NOW(), ${expires}::timestamptz
        )
      `;
      return { pending: true, email, permissionIds: wanted, inviteId: id };
    }
  }
  if (!targetUid) throw new ApiError(400, "User email or uid required");
  const existing = await getMember(sql, session.org.id, targetUid);
  if (!existing) {
    const external = rows(
      await sql`SELECT id FROM rbac_roles WHERE org_id = ${session.org.id} AND key = 'external' LIMIT 1`
    )[0];
    if (!external?.id) throw new ApiError(500, "Default external role missing");
    const userRow = rows(
      await sql`SELECT email, data FROM users WHERE id = ${targetUid} LIMIT 1`
    )[0];
    const data = userRow?.data && typeof userRow.data === "object" ? userRow.data : {};
    const displayName = text(data.displayName) || emailOf(userRow?.email).split("@")[0] || "User";
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
    pending: false,
    uid: targetUid,
    permissionIds: await memberGrants(sql, session.org.id, targetUid)
  };
}
async function revokeBooksFeatures(user, input) {
  const session = await requireAnyOrgPermission(user, ["books.users.manage", "books.settings.manage"]);
  const sql = await sqlReady();
  const targetUid = text(input.uid);
  if (!targetUid) throw new ApiError(400, "User required");
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
async function setMemberPrivileges(user, input) {
  const session = await requireOrgPermission(user, "admin.users");
  if (session.member.roleKey !== "super_user") {
    throw new ApiError(403, "Only a super user can edit per-user privileges");
  }
  const sql = await sqlReady();
  const targetUid = text(input.uid);
  if (!targetUid) throw new ApiError(400, "User required");
  const member = await getMember(sql, session.org.id, targetUid);
  if (!member) throw new ApiError(404, "Member not found");
  if (member.roleKey === "super_user") {
    throw new ApiError(400, "Super users already have every privilege");
  }
  const catalog = new Set(RBAC_PERMISSIONS.map((p) => p.id));
  const next = [...new Set((input.permissionIds || []).map((id) => text(id)).filter(Boolean))].filter((id) => catalog.has(id) && !isAdminPermission(id));
  await sql`DELETE FROM org_member_grants WHERE org_id = ${session.org.id} AND uid = ${targetUid}`;
  for (const permissionId of next) {
    await sql`
      INSERT INTO org_member_grants (org_id, uid, permission_id, granted_by, created_at)
      VALUES (${session.org.id}, ${targetUid}, ${permissionId}, ${user.uid}, NOW())
      ON CONFLICT DO NOTHING
    `;
  }
  return {
    ok: true,
    uid: targetUid,
    grantIds: await memberGrants(sql, session.org.id, targetUid),
    effectiveIds: await effectivePermissions(sql, session.org.id, targetUid, member.roleId)
  };
}
export {
  PLATFORM_ORG_ID,
  RBAC_PERMISSIONS,
  cancelOrgInvite,
  createCustomRole,
  createOrgUser,
  deleteCustomRole,
  ensureRbacSchema,
  ensureUserOrg,
  getRbacSession,
  grantBooksFeatures,
  inviteOrgMember,
  listOrgInvites,
  listOrgMembers,
  removeOrgMember,
  renameOrg,
  requireAnyOrgPermission,
  requireOrgPermission,
  revokeBooksFeatures,
  setMemberPrivileges,
  updateCustomRole,
  updateOrgMember,
  userHasPermission
};

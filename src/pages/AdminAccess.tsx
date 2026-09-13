import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronRight, Loader2, Plus, Search, Shield, Trash2, UserPlus } from 'lucide-react';
import { useRbac } from '../context/RbacContext';
import { useToast } from '../context/ToastContext';
import { RBAC_PERMISSIONS } from '../lib/rbac-catalog';
import {
  cancelRbacInvite,
  createRbacRole,
  createRbacUser,
  deleteRbacRole,
  fetchRbacInvites,
  fetchRbacMembers,
  removeRbacMember,
  renameRbacOrg,
  setMemberPrivileges,
  updateRbacMember,
  updateRbacRole,
  type RbacInvite,
  type RbacMember,
  type RbacPermission,
  type RbacRole,
} from '../lib/rbac';

type Mode = 'defaults' | 'people' | 'roles';

const PEOPLE_PAGE_SIZE = 25;

const TOOL_LABELS: Record<string, string> = {
  app: 'App',
  expense_tracker: 'Expense Tracker',
  books: 'Books',
  admin: 'Admin',
};

const FEATURE_LABELS: Record<string, string> = {
  dashboard: 'Dashboard',
  settings: 'Settings',
  expenses: 'Expenses',
  ledgers: 'Ledgers',
  inbound: 'Inbound',
  books: 'Books access',
  accounting: 'Accounting',
  sales: 'Sales',
  purchases: 'Purchases',
  banking: 'Banking',
  operations: 'Operations',
  control: 'Control',
  users: 'Users',
  admin: 'Admin console',
};

function initials(name: string, email: string) {
  const base = (name || email || '?').trim();
  const parts = base.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return base.slice(0, 2).toUpperCase();
}

function isAdminPerm(id: string) {
  return id.startsWith('admin.');
}

type TreeNode = {
  tool: string;
  toolLabel: string;
  features: {
    feature: string;
    featureLabel: string;
    permissions: RbacPermission[];
  }[];
};

function buildTree(catalog: RbacPermission[], hideAdmin: boolean): TreeNode[] {
  const filtered = hideAdmin ? catalog.filter((p) => !isAdminPerm(p.id) && p.tool !== 'admin') : catalog;
  const byTool = new Map<string, Map<string, RbacPermission[]>>();
  for (const perm of [...filtered].sort((a, b) => a.sortOrder - b.sortOrder)) {
    if (!byTool.has(perm.tool)) byTool.set(perm.tool, new Map());
    const byFeature = byTool.get(perm.tool)!;
    if (!byFeature.has(perm.feature)) byFeature.set(perm.feature, []);
    byFeature.get(perm.feature)!.push(perm);
  }
  const toolOrder = ['app', 'expense_tracker', 'books', 'admin'];
  return [...byTool.entries()]
    .sort(([a], [b]) => {
      const ai = toolOrder.indexOf(a);
      const bi = toolOrder.indexOf(b);
      return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi);
    })
    .map(([tool, features]) => ({
      tool,
      toolLabel: TOOL_LABELS[tool] || tool,
      features: [...features.entries()].map(([feature, permissions]) => ({
        feature,
        featureLabel: FEATURE_LABELS[feature] || feature.replace(/_/g, ' '),
        permissions,
      })),
    }));
}

function IosSwitch({
  checked,
  disabled,
  onChange,
  title,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: () => void;
  title?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={title}
      title={title}
      disabled={disabled}
      onClick={onChange}
      className={`rbac-switch${checked ? ' is-on' : ''}${disabled ? ' is-locked' : ''}`}
    >
      <span className="rbac-switch-knob" />
    </button>
  );
}

function PrivilegeTree({
  tree,
  selectedIds,
  lockedIds,
  lockedHint,
  disabled,
  onToggle,
}: {
  tree: TreeNode[];
  selectedIds: Set<string>;
  lockedIds?: Set<string>;
  lockedHint?: string;
  disabled?: boolean;
  onToggle: (id: string) => void;
}) {
  const [openTools, setOpenTools] = useState<Record<string, boolean>>({});
  const [openFeatures, setOpenFeatures] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const tools: Record<string, boolean> = {};
    const features: Record<string, boolean> = {};
    for (const node of tree) {
      tools[node.tool] = true;
      for (const f of node.features) features[`${node.tool}:${f.feature}`] = true;
    }
    setOpenTools(tools);
    setOpenFeatures(features);
  }, [tree]);

  return (
    <div className="rbac-tree">
      {tree.length === 0 ? (
        <p className="rbac-empty">
          No features loaded yet. Refresh Access & roles, or confirm you still have admin access.
        </p>
      ) : null}
      {tree.map((node) => {
        const toolOpen = openTools[node.tool] !== false;
        const toolPermIds = node.features.flatMap((f) => f.permissions.map((p) => p.id));
        const toolOnCount = toolPermIds.filter((id) => selectedIds.has(id) || lockedIds?.has(id)).length;
        return (
          <div key={node.tool} className="rbac-tree-tool">
            <button
              type="button"
              className="rbac-tree-row rbac-tree-tool-row"
              onClick={() => setOpenTools((prev) => ({ ...prev, [node.tool]: !toolOpen }))}
            >
              <ChevronRight className={`rbac-chevron${toolOpen ? ' is-open' : ''}`} />
              <span className="rbac-tree-title">{node.toolLabel}</span>
              <span className="rbac-tree-meta">
                {toolOnCount}/{toolPermIds.length}
              </span>
            </button>
            {toolOpen &&
              node.features.map((feat) => {
                const key = `${node.tool}:${feat.feature}`;
                const featOpen = openFeatures[key] !== false;
                return (
                  <div key={key} className="rbac-tree-feature">
                    <button
                      type="button"
                      className="rbac-tree-row rbac-tree-feature-row"
                      onClick={() => setOpenFeatures((prev) => ({ ...prev, [key]: !featOpen }))}
                    >
                      <ChevronRight className={`rbac-chevron${featOpen ? ' is-open' : ''}`} />
                      <span className="rbac-tree-title">{feat.featureLabel}</span>
                      <span className="rbac-tree-meta">{feat.permissions.length}</span>
                    </button>
                    {featOpen &&
                      feat.permissions.map((perm) => {
                        const fromRole = Boolean(lockedIds?.has(perm.id));
                        const on = fromRole || selectedIds.has(perm.id);
                        const locked = disabled || fromRole;
                        return (
                          <div key={perm.id} className="rbac-tree-row rbac-tree-action-row">
                            <div className="rbac-tree-action-copy">
                              <span className="rbac-tree-title">{perm.label}</span>
                              <span className="rbac-tree-desc">{perm.description}</span>
                              {fromRole && lockedHint ? (
                                <span className="rbac-tree-lock-hint">{lockedHint}</span>
                              ) : null}
                            </div>
                            <IosSwitch
                              checked={on}
                              disabled={locked}
                              title={perm.label}
                              onChange={() => {
                                if (!locked) onToggle(perm.id);
                              }}
                            />
                          </div>
                        );
                      })}
                  </div>
                );
              })}
          </div>
        );
      })}
    </div>
  );
}

export default function AdminAccess() {
  const { session, can, refresh } = useRbac();
  const { addToast } = useToast();

  const canAccess = can('admin.access');
  const canUsers = can('admin.users');
  const canRoles = can('admin.roles');

  const [mode, setMode] = useState<Mode>(() => {
    if (canAccess || canUsers) return 'people';
    if (canRoles) return 'defaults';
    return 'roles';
  });
  const [loading, setLoading] = useState(true);
  const [listBusy, setListBusy] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [members, setMembers] = useState<RbacMember[]>([]);
  const [memberTotal, setMemberTotal] = useState(0);
  const [memberPage, setMemberPage] = useState(1);
  const [memberTotalPages, setMemberTotalPages] = useState(1);
  const [roles, setRoles] = useState<RbacRole[]>([]);
  const [invites, setInvites] = useState<RbacInvite[]>([]);
  const [catalog, setCatalog] = useState<RbacPermission[]>(
    () => (session?.permissionCatalog?.length ? session.permissionCatalog : [...RBAC_PERMISSIONS]),
  );
  const [orgName, setOrgName] = useState('');
  const [queryInput, setQueryInput] = useState('');
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState('');
  const [selectedUid, setSelectedUid] = useState('');
  const [selectedRoleId, setSelectedRoleId] = useState('');
  const [creatingRole, setCreatingRole] = useState(false);
  const [creatingUser, setCreatingUser] = useState(false);
  const [roleDraft, setRoleDraft] = useState({ name: '', description: '', permissionIds: [] as string[] });
  const [grantDraft, setGrantDraft] = useState<string[]>([]);
  const [createDraft, setCreateDraft] = useState({
    email: '',
    displayName: '',
    password: '',
    roleId: '',
    permissionIds: [] as string[],
  });

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const next = queryInput.trim();
      setQuery((curr) => {
        if (curr === next) return curr;
        setMemberPage(1);
        return next;
      });
    }, 320);
    return () => window.clearTimeout(timer);
  }, [queryInput]);

  const applyMemberPayload = useCallback((memberPayload: Awaited<ReturnType<typeof fetchRbacMembers>>, keepSelection = true) => {
    const nextMembers = Array.isArray(memberPayload?.members) ? memberPayload.members : [];
    const nextRoles = Array.isArray(memberPayload?.roles) ? memberPayload.roles : [];
    setMembers(nextMembers);
    setMemberTotal(Number(memberPayload?.total) || 0);
    setMemberPage(Number(memberPayload?.page) || 1);
    setMemberTotalPages(Number(memberPayload?.totalPages) || 1);
    setRoles(nextRoles);
    setCatalog(
      memberPayload?.permissionCatalog?.length
        ? memberPayload.permissionCatalog
        : session?.permissionCatalog?.length
          ? session.permissionCatalog
          : [...RBAC_PERMISSIONS],
    );
    setOrgName(memberPayload?.org?.name || '');

    const external = nextRoles.find((r) => r.key === 'external');
    setSelectedRoleId((curr) => curr || external?.id || nextRoles[0]?.id || '');
    setCreateDraft((curr) => ({
      ...curr,
      roleId: curr.roleId || external?.id || nextRoles[0]?.id || '',
    }));
    setSelectedUid((curr) => {
      if (keepSelection && curr && nextMembers.some((m) => m.uid === curr)) return curr;
      if (keepSelection && curr && !nextMembers.some((m) => m.uid === curr)) return curr;
      const firstAssignable =
        nextMembers.find((m) => m.roleKey !== 'super_user' && m.status === 'active')
        || nextMembers.find((m) => m.roleKey !== 'super_user')
        || nextMembers[0];
      return firstAssignable?.uid || '';
    });
  }, [session?.permissionCatalog]);

  const loadMembers = useCallback(async (opts?: { page?: number; query?: string; silent?: boolean }) => {
    const page = opts?.page ?? memberPage;
    const q = opts?.query ?? query;
    if (opts?.silent) setListBusy(true);
    else setLoading(true);
    setLoadError('');
    try {
      if (session?.permissionCatalog?.length) {
        setCatalog(session.permissionCatalog);
      } else {
        setCatalog((curr) => (curr.length ? curr : [...RBAC_PERMISSIONS]));
      }

      const memberPayload = await fetchRbacMembers({
        query: q,
        page,
        pageSize: PEOPLE_PAGE_SIZE,
      });
      applyMemberPayload(memberPayload, true);
      if (canUsers) setInvites(await fetchRbacInvites().catch(() => []));
    } catch (err: any) {
      const message = err?.message || 'Failed to load access settings';
      setLoadError(message);
      addToast(message, 'error');
      if (session?.permissionCatalog?.length) setCatalog(session.permissionCatalog);
      else setCatalog([...RBAC_PERMISSIONS]);
    } finally {
      setLoading(false);
      setListBusy(false);
    }
  }, [addToast, applyMemberPayload, canUsers, memberPage, query, session?.permissionCatalog]);

  useEffect(() => {
    void loadMembers({ page: memberPage, query, silent: !loading && members.length > 0 });
    // Intentionally keyed to search/page — loadMembers identity changes with those values.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memberPage, query]);

  const externalRole = useMemo(() => roles.find((r) => r.key === 'external') || null, [roles]);
  const selectedRole = useMemo(
    () => (creatingRole ? null : roles.find((r) => r.id === selectedRoleId) || null),
    [roles, selectedRoleId, creatingRole],
  );
  const selectedMember = useMemo(
    () => members.find((m) => m.uid === selectedUid) || null,
    [members, selectedUid],
  );
  const memberRole = useMemo(
    () => (selectedMember ? roles.find((r) => r.id === selectedMember.roleId) || null : null),
    [roles, selectedMember],
  );

  useEffect(() => {
    if (mode === 'defaults' && externalRole) {
      setRoleDraft({
        name: externalRole.name,
        description: externalRole.description,
        permissionIds: [...externalRole.permissionIds],
      });
      setCreatingRole(false);
      setSelectedRoleId(externalRole.id);
    }
  }, [mode, externalRole]);

  useEffect(() => {
    if (mode !== 'roles' || creatingRole) return;
    const role = roles.find((r) => r.id === selectedRoleId);
    if (!role) return;
    setRoleDraft({
      name: role.name,
      description: role.description,
      permissionIds: [...role.permissionIds],
    });
  }, [mode, roles, selectedRoleId, creatingRole]);

  useEffect(() => {
    if (!selectedMember) {
      setGrantDraft([]);
      return;
    }
    setGrantDraft([...(selectedMember.grantIds || [])]);
  }, [selectedMember]);

  const defaultsTree = useMemo(() => buildTree(catalog, true), [catalog]);
  const rolesTree = useMemo(() => {
    const hideAdmin = !selectedRole || selectedRole.key !== 'super_user';
    return buildTree(catalog, hideAdmin);
  }, [catalog, selectedRole]);
  const peopleTree = useMemo(() => buildTree(catalog, true), [catalog]);

  const roleLockedIds = useMemo(() => new Set(memberRole?.permissionIds || []), [memberRole]);
  const grantSelected = useMemo(() => new Set(grantDraft), [grantDraft]);
  const roleSelected = useMemo(() => new Set(roleDraft.permissionIds), [roleDraft.permissionIds]);
  const createSelected = useMemo(() => new Set(createDraft.permissionIds), [createDraft.permissionIds]);
  const createRole = useMemo(
    () => roles.find((r) => r.id === createDraft.roleId) || null,
    [roles, createDraft.roleId],
  );
  const createRoleLockedIds = useMemo(() => new Set(createRole?.permissionIds || []), [createRole]);

  const superLocked = Boolean(selectedRole?.key === 'super_user');
  const memberIsSuper = selectedMember?.roleKey === 'super_user';
  const createIsSuper = createRole?.key === 'super_user';

  const segments = useMemo(() => {
    const items: { id: Mode; label: string; show: boolean }[] = [
      { id: 'defaults', label: 'Defaults', show: canRoles },
      // Anyone who can open Access can see People; mutations still require admin.users.
      { id: 'people', label: 'People', show: canAccess || canUsers },
      { id: 'roles', label: 'Roles', show: canRoles },
    ];
    return items.filter((i) => i.show);
  }, [canAccess, canRoles, canUsers]);

  useEffect(() => {
    if (!segments.some((s) => s.id === mode) && segments[0]) setMode(segments[0].id);
  }, [segments, mode]);

  const toggleRolePerm = (id: string) => {
    if (superLocked) return;
    setRoleDraft((prev) => ({
      ...prev,
      permissionIds: prev.permissionIds.includes(id)
        ? prev.permissionIds.filter((x) => x !== id)
        : [...prev.permissionIds, id],
    }));
  };

  const toggleGrant = (id: string) => {
    if (memberIsSuper || roleLockedIds.has(id)) return;
    setGrantDraft((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const toggleCreateGrant = (id: string) => {
    if (createIsSuper || createRoleLockedIds.has(id)) return;
    setCreateDraft((prev) => ({
      ...prev,
      permissionIds: prev.permissionIds.includes(id)
        ? prev.permissionIds.filter((x) => x !== id)
        : [...prev.permissionIds, id],
    }));
  };

  const startCreateUser = () => {
    setCreatingUser(true);
    setSelectedUid('');
    setCreateDraft((prev) => ({
      email: '',
      displayName: '',
      password: '',
      roleId: prev.roleId || externalRole?.id || roles[0]?.id || '',
      permissionIds: [],
    }));
  };

  const onCreateUser = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!canUsers || !createDraft.email || !createDraft.roleId) return;
    setBusy('create-user');
    try {
      const result = await createRbacUser({
        email: createDraft.email,
        displayName: createDraft.displayName,
        password: createDraft.password,
        roleId: createDraft.roleId,
        permissionIds: createIsSuper ? [] : createDraft.permissionIds.filter((id) => !isAdminPerm(id)),
      });
      if (result.joined) {
        addToast(
          result.provisioned
            ? 'User created with login, role, and features'
            : 'User added with role and features',
          'success',
        );
        if (result.uid) setSelectedUid(result.uid);
      } else {
        addToast('Invite saved — role and features apply on their first sign-in', 'success');
      }
      setCreatingUser(false);
      setCreateDraft((prev) => ({ ...prev, email: '', displayName: '', password: '', permissionIds: [] }));
      setQueryInput('');
      setQuery('');
      setMemberPage(1);
      await loadMembers({ page: 1, query: '', silent: false });
      await refresh();
    } catch (err: any) {
      addToast(err?.message || 'Could not create user', 'error');
    } finally {
      setBusy('');
    }
  };

  const onRenameOrg = async () => {
    setBusy('org');
    try {
      await renameRbacOrg(orgName);
      addToast('Organization name updated', 'success');
      await refresh();
      await loadMembers({ silent: true });
    } catch (err: any) {
      addToast(err?.message || 'Could not rename organization', 'error');
    } finally {
      setBusy('');
    }
  };

  const onChangeMemberRole = async (uid: string, roleId: string) => {
    setBusy(`role:${uid}`);
    try {
      await updateRbacMember(uid, { roleId });
      addToast('Role updated', 'success');
      await loadMembers({ silent: true });
      await refresh();
    } catch (err: any) {
      addToast(err?.message || 'Could not update role', 'error');
    } finally {
      setBusy('');
    }
  };

  const onToggleMember = async (member: RbacMember) => {
    const next = member.status === 'active' ? 'disabled' : 'active';
    setBusy(`status:${member.uid}`);
    try {
      await updateRbacMember(member.uid, { status: next });
      addToast(next === 'active' ? 'Member re-enabled' : 'Member disabled', 'success');
      await loadMembers({ silent: true });
    } catch (err: any) {
      addToast(err?.message || 'Could not update member', 'error');
    } finally {
      setBusy('');
    }
  };

  const onRemoveMember = async (uid: string) => {
    if (!window.confirm('Remove this member from the organization?')) return;
    setBusy(`remove:${uid}`);
    try {
      await removeRbacMember(uid);
      addToast('Member removed', 'success');
      if (selectedUid === uid) setSelectedUid('');
      await loadMembers({ silent: true });
    } catch (err: any) {
      addToast(err?.message || 'Could not remove member', 'error');
    } finally {
      setBusy('');
    }
  };

  const onCancelInvite = async (inviteId: string) => {
    setBusy(`invite:${inviteId}`);
    try {
      await cancelRbacInvite(inviteId);
      addToast('Invite cancelled', 'success');
      await loadMembers({ silent: true });
    } catch (err: any) {
      addToast(err?.message || 'Could not cancel invite', 'error');
    } finally {
      setBusy('');
    }
  };

  const onSavePrivileges = async () => {
    if (!selectedMember || memberIsSuper) return;
    setBusy('grants');
    try {
      const result = await setMemberPrivileges(selectedMember.uid, grantDraft.filter((id) => !isAdminPerm(id)));
      setGrantDraft(result.grantIds || []);
      addToast('Privileges saved', 'success');
      await loadMembers({ silent: true });
      await refresh();
    } catch (err: any) {
      addToast(err?.message || 'Could not save privileges', 'error');
    } finally {
      setBusy('');
    }
  };

  const startCreateRole = () => {
    setCreatingRole(true);
    setSelectedRoleId('');
    setRoleDraft({
      name: '',
      description: '',
      permissionIds: catalog
        .filter((p) => !isAdminPerm(p.id) && (p.action === 'view' || p.id === 'books.access' || p.id === 'dashboard.view'))
        .map((p) => p.id),
    });
  };

  const onSaveRole = async () => {
    if (!canRoles) return;
    setBusy('role-save');
    try {
      const permissionIds = roleDraft.permissionIds.filter((id) => {
        if (creatingRole) return !isAdminPerm(id);
        if (selectedRole?.key === 'super_user') return true;
        return !isAdminPerm(id);
      });

      if (creatingRole) {
        const role = await createRbacRole({
          name: roleDraft.name,
          description: roleDraft.description,
          permissionIds,
        });
        addToast('Role created', 'success');
        setCreatingRole(false);
        if (role?.id) setSelectedRoleId(role.id);
      } else if (selectedRole) {
        await updateRbacRole({
          roleId: selectedRole.id,
          name: selectedRole.isSystem ? undefined : roleDraft.name,
          description: roleDraft.description,
          permissionIds: selectedRole.key === 'super_user' ? undefined : permissionIds,
        });
        addToast('Role saved', 'success');
      }
      await loadMembers({ silent: true });
      await refresh();
    } catch (err: any) {
      addToast(err?.message || 'Could not save role', 'error');
    } finally {
      setBusy('');
    }
  };

  const onSaveDefaults = async () => {
    if (!canRoles || !externalRole) return;
    setBusy('defaults-save');
    try {
      await updateRbacRole({
        roleId: externalRole.id,
        description: roleDraft.description,
        permissionIds: roleDraft.permissionIds.filter((id) => !isAdminPerm(id)),
      });
      addToast('Default privileges updated', 'success');
      await loadMembers({ silent: true });
      await refresh();
    } catch (err: any) {
      addToast(err?.message || 'Could not save defaults', 'error');
    } finally {
      setBusy('');
    }
  };

  const onDeleteRole = async () => {
    if (!selectedRole || selectedRole.isSystem) return;
    if (!window.confirm(`Delete role "${selectedRole.name}"?`)) return;
    setBusy('role-delete');
    try {
      await deleteRbacRole(selectedRole.id);
      addToast('Role deleted', 'success');
      setSelectedRoleId(externalRole?.id || '');
      await loadMembers({ silent: true });
      await refresh();
    } catch (err: any) {
      addToast(err?.message || 'Could not delete role', 'error');
    } finally {
      setBusy('');
    }
  };

  if (!canAccess) {
    return (
      <div className="rbac-shell">
        <div className="rbac-panel rbac-denied">
          <Shield className="rbac-denied-icon" />
          <h1 className="font-display rbac-denied-title">Access restricted</h1>
          <p className="rbac-lede">Only a platform super user can open Access & roles.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rbac-shell">
      <header className="rbac-hero">
        <p className="rbac-kicker">Byjan</p>
        <h1 className="font-display rbac-hero-title">Access & roles</h1>
        <p className="rbac-lede">
          Set what every signup inherits, then tune people and custom roles with the same privilege tree.
        </p>
        <div className="rbac-segment" role="tablist" aria-label="Access modes">
          {segments.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={mode === item.id}
              className={`rbac-segment-btn${mode === item.id ? ' is-active' : ''}`}
              onClick={() => setMode(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </header>

      {loadError ? (
        <div className="rbac-panel rbac-banner" style={{ marginBottom: 12 }}>
          <p className="rbac-panel-sub" style={{ margin: 0 }}>
            {loadError}
          </p>
          <button type="button" className="rbac-ghost" onClick={() => void loadMembers({ silent: false })}>
            Retry
          </button>
        </div>
      ) : null}

      {loading ? (
        <div className="rbac-panel rbac-loading">
          <Loader2 className="rbac-spin" />
          Loading access settings…
        </div>
      ) : mode === 'defaults' ? (
        <section className="rbac-panel">
          <div className="rbac-panel-head">
            <div>
              <h2 className="font-display rbac-panel-title">Default product features</h2>
              <p className="rbac-panel-sub">
                Turn on App / Expense Tracker / Books features here so every Default external user gets them.
                Then use People to give one person extra features on top.
              </p>
            </div>
            {canRoles && (
              <button
                type="button"
                className="rbac-primary"
                disabled={busy === 'defaults-save' || !externalRole}
                onClick={() => void onSaveDefaults()}
              >
                {busy === 'defaults-save' ? <Loader2 className="rbac-spin" /> : null}
                Save defaults
              </button>
            )}
          </div>
          {!externalRole ? (
            <p className="rbac-empty">Default external role is missing.</p>
          ) : (
            <PrivilegeTree
              tree={defaultsTree}
              selectedIds={roleSelected}
              disabled={!canRoles}
              onToggle={toggleRolePerm}
            />
          )}
        </section>
      ) : mode === 'people' ? (
        <div className="rbac-split">
          <aside className="rbac-panel rbac-rail">
            <div className="rbac-search">
              <Search className="rbac-search-icon" />
              <input
                value={queryInput}
                onChange={(e) => setQueryInput(e.target.value)}
                placeholder="Search by name, email, or role"
                aria-label="Search people"
              />
            </div>
            <div className="rbac-list-meta">
              <span>
                {memberTotal.toLocaleString()} {memberTotal === 1 ? 'person' : 'people'}
                {query ? ` matching “${query}”` : ''}
              </span>
              {listBusy ? <Loader2 className="rbac-spin rbac-spin-sm" /> : null}
            </div>
            <div className="rbac-person-list">
              {members.map((member) => (
                <button
                  key={member.uid}
                  type="button"
                  className={`rbac-person${!creatingUser && selectedUid === member.uid ? ' is-active' : ''}`}
                  onClick={() => {
                    setCreatingUser(false);
                    setSelectedUid(member.uid);
                  }}
                >
                  <span className="rbac-avatar">{initials(member.displayName, member.email)}</span>
                  <span className="rbac-person-copy">
                    <span className="rbac-person-name">{member.displayName || 'Unnamed'}</span>
                    <span className="rbac-person-meta">
                      {member.roleName}
                      {member.status !== 'active' ? ` · ${member.status}` : ''}
                    </span>
                  </span>
                </button>
              ))}
              {members.length === 0 && (
                <p className="rbac-empty">
                  {loadError
                    ? 'Could not load people. Use Retry above.'
                    : query
                      ? 'No people match this search.'
                      : 'No people in the platform org yet. Create a user, or ask teammates to sign in once so they appear here.'}
                </p>
              )}
            </div>

            {memberTotalPages > 1 && (
              <div className="rbac-pager">
                <button
                  type="button"
                  className="rbac-ghost"
                  disabled={memberPage <= 1 || listBusy}
                  onClick={() => setMemberPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </button>
                <span className="rbac-pager-label">
                  Page {memberPage} of {memberTotalPages}
                </span>
                <button
                  type="button"
                  className="rbac-ghost"
                  disabled={memberPage >= memberTotalPages || listBusy}
                  onClick={() => setMemberPage((p) => Math.min(memberTotalPages, p + 1))}
                >
                  Next
                </button>
              </div>
            )}

            {canUsers && (
              <div className="rbac-invite">
                <button type="button" className="rbac-ghost rbac-new-role" onClick={startCreateUser}>
                  <UserPlus className="w-4 h-4" />
                  Create user
                </button>
              </div>
            )}

            {invites.length > 0 && (
              <div className="rbac-invites">
                <h3 className="rbac-section-label">Pending invites</h3>
                {invites.map((invite) => (
                  <div key={invite.id} className="rbac-invite-row">
                    <div>
                      <p className="rbac-person-name">{invite.email}</p>
                      <p className="rbac-person-meta">{invite.roleName}</p>
                    </div>
                    <button
                      type="button"
                      className="rbac-ghost"
                      disabled={busy === `invite:${invite.id}`}
                      onClick={() => void onCancelInvite(invite.id)}
                    >
                      Cancel
                    </button>
                  </div>
                ))}
              </div>
            )}
          </aside>

          <section className="rbac-panel rbac-detail">
            {creatingUser ? (
              <form onSubmit={(e) => void onCreateUser(e)}>
                <div className="rbac-panel-head">
                  <div>
                    <h2 className="font-display rbac-panel-title">Create user</h2>
                    <p className="rbac-panel-sub">
                      Assign a role and optional extra features. With a password they can sign in immediately;
                      without one, an invite applies the same access on first sign-in.
                    </p>
                  </div>
                  <div className="rbac-detail-actions">
                    <button
                      type="button"
                      className="rbac-ghost"
                      onClick={() => setCreatingUser(false)}
                    >
                      Cancel
                    </button>
                    <button type="submit" className="rbac-primary" disabled={busy === 'create-user'}>
                      {busy === 'create-user' ? <Loader2 className="rbac-spin" /> : null}
                      Save user
                    </button>
                  </div>
                </div>

                <div className="rbac-role-fields">
                  <label className="rbac-field">
                    <span>Email</span>
                    <input
                      required
                      type="email"
                      value={createDraft.email}
                      onChange={(e) => setCreateDraft((prev) => ({ ...prev, email: e.target.value }))}
                      placeholder="name@company.com"
                    />
                  </label>
                  <label className="rbac-field">
                    <span>Display name</span>
                    <input
                      value={createDraft.displayName}
                      onChange={(e) => setCreateDraft((prev) => ({ ...prev, displayName: e.target.value }))}
                      placeholder="Optional"
                    />
                  </label>
                  <label className="rbac-field">
                    <span>Temporary password</span>
                    <input
                      type="password"
                      autoComplete="new-password"
                      value={createDraft.password}
                      onChange={(e) => setCreateDraft((prev) => ({ ...prev, password: e.target.value }))}
                      placeholder="Optional · min 8 characters"
                    />
                  </label>
                  <label className="rbac-field">
                    <span>Role</span>
                    <select
                      value={createDraft.roleId}
                      onChange={(e) => setCreateDraft((prev) => ({ ...prev, roleId: e.target.value }))}
                    >
                      {roles.map((role) => (
                        <option key={role.id} value={role.id}>
                          {role.name}
                          {role.key === 'external' ? ' · signup default' : ''}
                          {role.key === 'super_user' ? ' · platform' : ''}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                {createIsSuper ? (
                  <p className="rbac-banner">
                    Super users already hold every privilege. Extra feature toggles are not needed.
                  </p>
                ) : (
                  <>
                    <div className="rbac-panel-head rbac-panel-head-tight">
                      <div>
                        <h3 className="rbac-section-label">Extra features for this person</h3>
                        <p className="rbac-panel-sub">
                          Role privileges stay locked on. Turn on anything else they need beyond the role.
                        </p>
                      </div>
                    </div>
                    <PrivilegeTree
                      tree={peopleTree}
                      selectedIds={createSelected}
                      lockedIds={createRoleLockedIds}
                      lockedHint="from role"
                      onToggle={toggleCreateGrant}
                    />
                  </>
                )}
              </form>
            ) : !selectedMember ? (
              <p className="rbac-empty">Search for a person, or create a user to assign role and features.</p>
            ) : (
              <>
                <div className="rbac-panel-head">
                  <div className="rbac-detail-identity">
                    <span className="rbac-avatar rbac-avatar-lg">
                      {initials(selectedMember.displayName, selectedMember.email)}
                    </span>
                    <div>
                      <h2 className="font-display rbac-panel-title">
                        {selectedMember.displayName || 'Unnamed'}
                      </h2>
                      <p className="rbac-panel-sub">{selectedMember.email}</p>
                    </div>
                  </div>
                  <div className="rbac-detail-actions">
                    <button
                      type="button"
                      className="rbac-ghost"
                      disabled={!canUsers || busy.startsWith('status:')}
                      onClick={() => void onToggleMember(selectedMember)}
                    >
                      {selectedMember.status === 'active' ? 'Disable' : 'Enable'}
                    </button>
                    <button
                      type="button"
                      className="rbac-ghost is-danger"
                      disabled={!canUsers || busy.startsWith('remove:')}
                      onClick={() => void onRemoveMember(selectedMember.uid)}
                      title="Remove member"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <label className="rbac-field">
                  <span>Role</span>
                  <select
                    value={selectedMember.roleId}
                    disabled={!canUsers || busy === `role:${selectedMember.uid}`}
                    onChange={(e) => void onChangeMemberRole(selectedMember.uid, e.target.value)}
                  >
                    {roles.map((role) => (
                      <option key={role.id} value={role.id}>
                        {role.name}
                        {role.key === 'external' ? ' · signup default' : ''}
                        {role.key === 'super_user' ? ' · platform' : ''}
                      </option>
                    ))}
                  </select>
                </label>

                {memberIsSuper ? (
                  <p className="rbac-banner">
                    Super users already hold every privilege. Promote or demote via role only.
                  </p>
                ) : (
                  <>
                    <div className="rbac-panel-head rbac-panel-head-tight">
                      <div>
                        <h3 className="rbac-section-label">Feature access for this person</h3>
                        <p className="rbac-panel-sub">
                          Expand App, Expense Tracker, or Books. Locked switches are already on from their role —
                          turn on extra features here, then Save privileges.
                        </p>
                      </div>
                      {canUsers && (
                        <button
                          type="button"
                          className="rbac-primary"
                          disabled={busy === 'grants'}
                          onClick={() => void onSavePrivileges()}
                        >
                          {busy === 'grants' ? <Loader2 className="rbac-spin" /> : null}
                          Save privileges
                        </button>
                      )}
                    </div>
                    <PrivilegeTree
                      tree={peopleTree}
                      selectedIds={grantSelected}
                      lockedIds={roleLockedIds}
                      lockedHint="from role"
                      disabled={!canUsers}
                      onToggle={toggleGrant}
                    />
                  </>
                )}
              </>
            )}
          </section>
        </div>
      ) : (
        <div className="rbac-split">
          <aside className="rbac-panel rbac-rail">
            {canRoles && (
              <button type="button" className="rbac-ghost rbac-new-role" onClick={startCreateRole}>
                <Plus className="w-4 h-4" />
                New role
              </button>
            )}
            <div className="rbac-person-list">
              {roles.map((role) => (
                <button
                  key={role.id}
                  type="button"
                  className={`rbac-person${
                    !creatingRole && selectedRoleId === role.id ? ' is-active' : ''
                  }`}
                  onClick={() => {
                    setCreatingRole(false);
                    setSelectedRoleId(role.id);
                  }}
                >
                  <span className="rbac-person-copy">
                    <span className="rbac-person-name">{role.name}</span>
                    <span className="rbac-person-meta">
                      {role.memberCount} people · {role.permissionIds.length} privileges
                      {role.key === 'external' ? ' · default' : ''}
                      {role.key === 'super_user' ? ' · locked' : ''}
                    </span>
                  </span>
                </button>
              ))}
            </div>

            <div className="rbac-org">
              <h3 className="rbac-section-label">Organization</h3>
              <label className="rbac-field">
                <span>Name</span>
                <input value={orgName} onChange={(e) => setOrgName(e.target.value)} />
              </label>
              <button
                type="button"
                className="rbac-ghost"
                disabled={busy === 'org'}
                onClick={() => void onRenameOrg()}
              >
                {busy === 'org' ? 'Saving…' : 'Save name'}
              </button>
            </div>
          </aside>

          <section className="rbac-panel rbac-detail">
            <div className="rbac-panel-head">
              <div className="rbac-role-fields">
                <label className="rbac-field">
                  <span>Role name</span>
                  <input
                    value={roleDraft.name}
                    onChange={(e) => setRoleDraft((prev) => ({ ...prev, name: e.target.value }))}
                    disabled={!creatingRole && Boolean(selectedRole?.isSystem)}
                  />
                </label>
                <label className="rbac-field">
                  <span>Description</span>
                  <textarea
                    rows={2}
                    value={roleDraft.description}
                    onChange={(e) => setRoleDraft((prev) => ({ ...prev, description: e.target.value }))}
                    disabled={superLocked && !creatingRole}
                  />
                </label>
              </div>
              <div className="rbac-detail-actions">
                {canRoles && (
                  <button
                    type="button"
                    className="rbac-primary"
                    disabled={busy === 'role-save' || (!creatingRole && !selectedRole)}
                    onClick={() => void onSaveRole()}
                  >
                    {busy === 'role-save' ? <Loader2 className="rbac-spin" /> : null}
                    {creatingRole ? 'Create role' : 'Save role'}
                  </button>
                )}
                {canRoles && selectedRole && !selectedRole.isSystem && !creatingRole && (
                  <button
                    type="button"
                    className="rbac-ghost is-danger"
                    disabled={busy === 'role-delete'}
                    onClick={() => void onDeleteRole()}
                    title="Delete role"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {superLocked && (
              <p className="rbac-banner">
                Super user privileges are locked. Create a custom role to tailor product access.
              </p>
            )}

            {(creatingRole || selectedRole) && (
              <PrivilegeTree
                tree={creatingRole ? defaultsTree : rolesTree}
                selectedIds={roleSelected}
                disabled={!canRoles || superLocked}
                onToggle={toggleRolePerm}
              />
            )}
          </section>
        </div>
      )}
    </div>
  );
}

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Check,
  ChevronRight,
  Loader2,
  Plus,
  Search,
  Shield,
  ShieldCheck,
  Trash2,
  UserPlus,
  Users,
} from 'lucide-react';
import { useRbac } from '../context/RbacContext';
import { useToast } from '../context/ToastContext';
import {
  cancelRbacInvite,
  createRbacRole,
  deleteRbacRole,
  fetchRbacInvites,
  fetchRbacMembers,
  inviteRbacMember,
  removeRbacMember,
  renameRbacOrg,
  updateRbacMember,
  updateRbacRole,
  type RbacInvite,
  type RbacMember,
  type RbacPermission,
  type RbacRole,
} from '../lib/rbac';

const TOOL_LABELS: Record<string, string> = {
  app: 'App',
  expense_tracker: 'Expense Tracker',
  books: 'Books',
  admin: 'Admin',
};

function initials(name: string, email: string) {
  const base = (name || email || '?').trim();
  const parts = base.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return base.slice(0, 2).toUpperCase();
}

function StatusPill({ status }: { status: string }) {
  const tone =
    status === 'active'
      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
      : status === 'disabled'
        ? 'bg-rose-50 text-rose-700 border-rose-200'
        : 'bg-amber-50 text-amber-800 border-amber-200';
  return (
    <span className={`inline-flex h-6 items-center rounded-full border px-2.5 text-[11px] font-semibold capitalize ${tone}`}>
      {status}
    </span>
  );
}

export default function AdminAccess() {
  const { session, can, refresh } = useRbac();
  const { addToast } = useToast();
  const [tab, setTab] = useState<'users' | 'roles'>('users');
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<RbacMember[]>([]);
  const [roles, setRoles] = useState<RbacRole[]>([]);
  const [invites, setInvites] = useState<RbacInvite[]>([]);
  const [catalog, setCatalog] = useState<RbacPermission[]>([]);
  const [query, setQuery] = useState('');
  const [orgName, setOrgName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRoleId, setInviteRoleId] = useState('');
  const [busy, setBusy] = useState('');
  const [selectedRoleId, setSelectedRoleId] = useState('');
  const [creatingRole, setCreatingRole] = useState(false);
  const [roleDraft, setRoleDraft] = useState({ name: '', description: '', permissionIds: [] as string[] });

  const canUsers = can('admin.users');
  const canRoles = can('admin.roles');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const memberPayload = await fetchRbacMembers();
      setMembers(memberPayload.members);
      setRoles(memberPayload.roles);
      setCatalog(memberPayload.permissionCatalog || []);
      setOrgName(memberPayload.org.name);
      if (canUsers) setInvites(await fetchRbacInvites().catch(() => []));
      setSelectedRoleId((curr) => curr || memberPayload.roles[0]?.id || '');
      setInviteRoleId((curr) => {
        if (curr) return curr;
        const preferred =
          memberPayload.roles.find((r) => r.key === 'external')
          || memberPayload.roles.find((r) => !r.isSystem)
          || memberPayload.roles[0];
        return preferred?.id || '';
      });
    } catch (err: any) {
      addToast(err?.message || 'Failed to load access settings', 'error');
    } finally {
      setLoading(false);
    }
  }, [addToast, canUsers]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (creatingRole) return;
    const role = roles.find((r) => r.id === selectedRoleId);
    if (!role) return;
    setRoleDraft({
      name: role.name,
      description: role.description,
      permissionIds: [...role.permissionIds],
    });
  }, [roles, selectedRoleId, creatingRole]);

  const filteredMembers = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return members;
    return members.filter((m) =>
      [m.displayName, m.email, m.roleName, m.status].some((v) => String(v || '').toLowerCase().includes(q)),
    );
  }, [members, query]);

  const permissionsByTool = useMemo(() => {
    const map = new Map<string, RbacPermission[]>();
    for (const perm of catalog) {
      const list = map.get(perm.tool) || [];
      list.push(perm);
      map.set(perm.tool, list);
    }
    return [...map.entries()];
  }, [catalog]);

  const selectedRole = roles.find((r) => r.id === selectedRoleId) || null;
  const lockedPermissions = !creatingRole && Boolean(selectedRole && (selectedRole.key === 'super_user'));

  const onInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canUsers) return;
    setBusy('invite');
    try {
      const result = await inviteRbacMember(inviteEmail, inviteRoleId);
      addToast(result.joined ? 'Member added to the organization' : 'Invite created — they join on next sign-in', 'success');
      setInviteEmail('');
      await load();
      await refresh();
    } catch (err: any) {
      addToast(err?.message || 'Invite failed', 'error');
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
      await load();
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
      await load();
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
      await load();
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
      await load();
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
      await load();
    } catch (err: any) {
      addToast(err?.message || 'Could not cancel invite', 'error');
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
        .filter((p) => p.action === 'view' || p.id === 'books.access' || p.id === 'dashboard.view')
        .map((p) => p.id),
    });
  };

  const togglePermission = (permissionId: string) => {
    if (lockedPermissions) return;
    setRoleDraft((prev) => ({
      ...prev,
      permissionIds: prev.permissionIds.includes(permissionId)
        ? prev.permissionIds.filter((id) => id !== permissionId)
        : [...prev.permissionIds, permissionId],
    }));
  };

  const onSaveRole = async () => {
    if (!canRoles) return;
    setBusy('role-save');
    try {
      if (creatingRole) {
        const role = await createRbacRole({ name: roleDraft.name, description: roleDraft.description, permissionIds: roleDraft.permissionIds });
        addToast('Role created', 'success');
        setCreatingRole(false);
        if (role?.id) setSelectedRoleId(role.id);
      } else if (selectedRole) {
        await updateRbacRole({
          roleId: selectedRole.id,
          name: selectedRole.isSystem ? undefined : roleDraft.name,
          description: roleDraft.description,
          permissionIds: lockedPermissions ? undefined : roleDraft.permissionIds,
        });
        addToast('Role saved', 'success');
      }
      await load();
      await refresh();
    } catch (err: any) {
      addToast(err?.message || 'Could not save role', 'error');
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
      setSelectedRoleId('');
      await load();
      await refresh();
    } catch (err: any) {
      addToast(err?.message || 'Could not delete role', 'error');
    } finally {
      setBusy('');
    }
  };

  if (!can('admin.access')) {
    return (
      <div className="max-w-xl mx-auto mt-16 rounded-3xl border border-slate-200 bg-white/90 p-8 text-center shadow-[var(--byjan-shadow)]">
        <Shield className="w-10 h-10 text-slate-400 mx-auto" />
        <h1 className="font-display text-2xl font-semibold text-[#0B1F3A] mt-4 tracking-[-0.03em]">Access restricted</h1>
        <p className="text-sm text-slate-500 mt-2 leading-relaxed">
          Only a platform super user can open Access & roles. External signup users never see this console.
        </p>
      </div>
    );
  }

  return (
    <div className="h-full min-h-0 overflow-auto pb-8">
      <div className="relative overflow-hidden rounded-[28px] border border-white/60 bg-[linear-gradient(135deg,rgba(11,31,58,0.96),rgba(11,31,58,0.88)_42%,rgba(18,184,168,0.55))] text-white px-6 py-7 md:px-8 md:py-8 shadow-[0_24px_60px_-28px_rgba(11,31,58,0.55)]">
        <div className="absolute inset-0 opacity-40 pointer-events-none" style={{ background: 'radial-gradient(600px 220px at 85% 0%, rgba(255,255,255,0.35), transparent 60%)' }} />
        <div className="relative flex flex-col md:flex-row md:items-end md:justify-between gap-6">
          <div>
            <p className="text-[11px] font-semibold tracking-[0.22em] uppercase text-white/70">Access control</p>
            <h1 className="font-display text-[34px] md:text-[40px] font-semibold tracking-[-0.04em] leading-none mt-2">Roles & people</h1>
            <p className="text-sm text-white/75 mt-3 max-w-xl leading-relaxed">
              Super users only. Signup users get Default external with no features until you assign them. Promote another super user from Users. Books company access is managed under Books → Settings.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <div className="rounded-2xl bg-white/10 border border-white/15 px-4 py-3 backdrop-blur-sm min-w-[140px]">
              <p className="text-[10px] uppercase tracking-[0.16em] text-white/60">Members</p>
              <p className="font-display text-2xl font-semibold mt-1">{members.filter((m) => m.status === 'active').length}</p>
            </div>
            <div className="rounded-2xl bg-white/10 border border-white/15 px-4 py-3 backdrop-blur-sm min-w-[140px]">
              <p className="text-[10px] uppercase tracking-[0.16em] text-white/60">Roles</p>
              <p className="font-display text-2xl font-semibold mt-1">{roles.length}</p>
            </div>
            <div className="rounded-2xl bg-white/10 border border-white/15 px-4 py-3 backdrop-blur-sm min-w-[140px]">
              <p className="text-[10px] uppercase tracking-[0.16em] text-white/60">Your role</p>
              <p className="font-display text-lg font-semibold mt-1.5 capitalize">{session?.member.roleName || '—'}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="rounded-[24px] border border-slate-200/80 bg-white/90 backdrop-blur-sm shadow-[var(--byjan-shadow)] overflow-hidden">
          <div className="flex items-center gap-1 p-2 border-b border-slate-100 bg-slate-50/70">
            {([
              { id: 'users' as const, label: 'Users', icon: Users, show: canUsers },
              { id: 'roles' as const, label: 'Roles & features', icon: ShieldCheck, show: canRoles },
            ]).filter((item) => item.show).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={`h-10 px-4 rounded-xl text-sm font-semibold inline-flex items-center gap-2 transition-colors ${
                  tab === item.id ? 'bg-[#0B1F3A] text-white' : 'text-slate-600 hover:bg-white'
                }`}
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="flex items-center justify-center gap-2 py-24 text-slate-500">
              <Loader2 className="w-5 h-5 animate-spin" />
              Loading access settings…
            </div>
          ) : tab === 'users' ? (
            <div className="p-4 md:p-5 space-y-5">
              <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
                <div className="relative flex-1 max-w-md">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search members"
                    className="w-full h-11 pl-10 pr-3 rounded-2xl border border-slate-200 bg-white text-sm outline-none focus:border-[#12B8A8] focus:ring-4 focus:ring-teal-500/10"
                  />
                </div>
                <p className="text-xs text-slate-500">{filteredMembers.length} people</p>
              </div>

              <div className="overflow-x-auto rounded-2xl border border-slate-100">
                <table className="w-full min-w-[720px] text-left">
                  <thead className="bg-slate-50/80 text-[11px] uppercase tracking-[0.14em] text-slate-400">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Member</th>
                      <th className="px-4 py-3 font-semibold">Role</th>
                      <th className="px-4 py-3 font-semibold">Status</th>
                      <th className="px-4 py-3 font-semibold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMembers.map((member) => (
                      <tr key={member.uid} className="border-t border-slate-100 hover:bg-slate-50/60 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <span className="w-10 h-10 rounded-2xl bg-[linear-gradient(145deg,#0B1F3A,#16436F)] text-white text-xs font-semibold inline-flex items-center justify-center">
                              {initials(member.displayName, member.email)}
                            </span>
                            <span>
                              <span className="block text-sm font-semibold text-[#0B1F3A]">{member.displayName || 'Unnamed'}</span>
                              <span className="block text-xs text-slate-500">{member.email}</span>
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <select
                            className="h-10 px-3 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-700 outline-none focus:border-[#12B8A8]"
                            value={member.roleId}
                            disabled={!canUsers || busy === `role:${member.uid}`}
                            onChange={(e) => void onChangeMemberRole(member.uid, e.target.value)}
                          >
                            {roles.map((role) => (
                              <option key={role.id} value={role.id}>{role.name}{role.key === 'external' ? ' · signup default' : role.key === 'super_user' ? ' · platform' : ''}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-4 py-3"><StatusPill status={member.status} /></td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              className="h-9 px-3 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-white"
                              disabled={!canUsers || busy.startsWith('status:')}
                              onClick={() => void onToggleMember(member)}
                            >
                              {member.status === 'active' ? 'Disable' : 'Enable'}
                            </button>
                            <button
                              type="button"
                              className="h-9 w-9 rounded-xl border border-rose-100 text-rose-600 hover:bg-rose-50 inline-flex items-center justify-center"
                              disabled={!canUsers || busy.startsWith('remove:')}
                              onClick={() => void onRemoveMember(member.uid)}
                              title="Remove member"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {invites.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-[#0B1F3A] mb-3">Pending invites</h3>
                  <div className="space-y-2">
                    {invites.map((invite) => (
                      <div key={invite.id} className="flex items-center justify-between gap-3 rounded-2xl border border-amber-100 bg-amber-50/50 px-4 py-3">
                        <div>
                          <p className="text-sm font-semibold text-[#0B1F3A]">{invite.email}</p>
                          <p className="text-xs text-slate-500 mt-0.5">Role: {invite.roleName}</p>
                        </div>
                        <button
                          type="button"
                          className="h-9 px-3 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-600"
                          onClick={() => void onCancelInvite(invite.id)}
                        >
                          Cancel
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="grid lg:grid-cols-[240px_minmax(0,1fr)] min-h-[560px]">
              <aside className="border-b lg:border-b-0 lg:border-r border-slate-100 p-3 space-y-1 bg-slate-50/40">
                {canRoles && (
                  <button
                    type="button"
                    onClick={startCreateRole}
                    className="w-full h-10 rounded-xl border border-dashed border-slate-300 text-sm font-semibold text-slate-600 hover:border-[#12B8A8] hover:text-[#0B1F3A] inline-flex items-center justify-center gap-2 mb-2"
                  >
                    <Plus className="w-4 h-4" /> New role
                  </button>
                )}
                {roles.map((role) => (
                  <button
                    key={role.id}
                    type="button"
                    onClick={() => {
                      setCreatingRole(false);
                      setSelectedRoleId(role.id);
                    }}
                    className={`w-full text-left rounded-2xl px-3 py-2.5 transition-colors ${
                      !creatingRole && selectedRoleId === role.id ? 'bg-[#0B1F3A] text-white' : 'hover:bg-white text-slate-700'
                    }`}
                  >
                    <span className="block text-sm font-semibold">{role.name}</span>
                    <span className={`block text-[11px] mt-0.5 ${!creatingRole && selectedRoleId === role.id ? 'text-white/70' : 'text-slate-500'}`}>
                      {role.memberCount} members · {role.permissionIds.length} permissions
                    </span>
                  </button>
                ))}
              </aside>

              <div className="p-4 md:p-5 space-y-5">
                <div className="flex flex-col md:flex-row md:items-start gap-3 md:justify-between">
                  <div className="flex-1 space-y-3">
                    <label className="block">
                      <span className="text-xs font-semibold text-slate-500 uppercase tracking-[0.12em]">Role name</span>
                      <input
                        value={roleDraft.name}
                        onChange={(e) => setRoleDraft((prev) => ({ ...prev, name: e.target.value }))}
                        disabled={!creatingRole && selectedRole?.isSystem}
                        className="mt-1.5 w-full h-11 px-3 rounded-2xl border border-slate-200 text-sm font-semibold text-[#0B1F3A] outline-none focus:border-[#12B8A8] disabled:bg-slate-50"
                      />
                    </label>
                    <label className="block">
                      <span className="text-xs font-semibold text-slate-500 uppercase tracking-[0.12em]">Description</span>
                      <textarea
                        value={roleDraft.description}
                        onChange={(e) => setRoleDraft((prev) => ({ ...prev, description: e.target.value }))}
                        rows={2}
                        className="mt-1.5 w-full px-3 py-2.5 rounded-2xl border border-slate-200 text-sm text-slate-700 outline-none focus:border-[#12B8A8]"
                      />
                    </label>
                  </div>
                  <div className="flex gap-2">
                    {canRoles && (
                      <button
                        type="button"
                        onClick={() => void onSaveRole()}
                        disabled={busy === 'role-save'}
                        className="h-11 px-4 rounded-2xl bg-[#0B1F3A] text-white text-sm font-semibold inline-flex items-center gap-2"
                      >
                        {busy === 'role-save' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                        Save role
                      </button>
                    )}
                    {canRoles && selectedRole && !selectedRole.isSystem && !creatingRole && (
                      <button
                        type="button"
                        onClick={() => void onDeleteRole()}
                        className="h-11 w-11 rounded-2xl border border-rose-100 text-rose-600 inline-flex items-center justify-center"
                        title="Delete role"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {lockedPermissions && (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
                    Owner and Admin always keep the full permission set. Create a custom role to tailor feature access.
                  </div>
                )}

                <div className="space-y-4">
                  {permissionsByTool.map(([tool, perms]) => (
                    <div key={tool}>
                      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400 mb-2">{TOOL_LABELS[tool] || tool}</p>
                      <div className="grid sm:grid-cols-2 gap-2">
                        {perms.map((perm) => {
                          const on = roleDraft.permissionIds.includes(perm.id);
                          return (
                            <button
                              key={perm.id}
                              type="button"
                              disabled={lockedPermissions}
                              onClick={() => togglePermission(perm.id)}
                              className={`text-left rounded-2xl border px-3 py-3 transition-all ${
                                on
                                  ? 'border-teal-200 bg-teal-50/70 shadow-[inset_3px_0_0_#12B8A8]'
                                  : 'border-slate-200 bg-white hover:border-slate-300'
                              } ${lockedPermissions ? 'opacity-70 cursor-not-allowed' : ''}`}
                            >
                              <span className="flex items-start justify-between gap-2">
                                <span>
                                  <span className="block text-sm font-semibold text-[#0B1F3A]">{perm.label}</span>
                                  <span className="block text-[11px] text-slate-500 mt-1 leading-relaxed">{perm.description}</span>
                                </span>
                                <span className={`mt-0.5 w-5 h-5 rounded-md border inline-flex items-center justify-center ${on ? 'bg-[#12B8A8] border-[#12B8A8] text-white' : 'border-slate-300 text-transparent'}`}>
                                  <Check className="w-3.5 h-3.5" />
                                </span>
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </section>

        <aside className="space-y-5">
          {canUsers && (
            <form onSubmit={onInvite} className="rounded-[24px] border border-slate-200/80 bg-white/90 p-5 shadow-[var(--byjan-shadow)] space-y-4">
              <div className="flex items-center gap-2">
                <span className="w-10 h-10 rounded-2xl bg-teal-50 text-teal-700 border border-teal-100 inline-flex items-center justify-center">
                  <UserPlus className="w-5 h-5" />
                </span>
                <div>
                  <h2 className="text-sm font-semibold text-[#0B1F3A]">Invite member</h2>
                  <p className="text-xs text-slate-500">Existing accounts join immediately.</p>
                </div>
              </div>
              <label className="block">
                <span className="text-xs font-semibold text-slate-500">Email</span>
                <input
                  required
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="mt-1.5 w-full h-11 px-3 rounded-2xl border border-slate-200 text-sm outline-none focus:border-[#12B8A8]"
                  placeholder="name@company.com"
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-slate-500">Role</span>
                <select
                  value={inviteRoleId}
                  onChange={(e) => setInviteRoleId(e.target.value)}
                  className="mt-1.5 w-full h-11 px-3 rounded-2xl border border-slate-200 text-sm outline-none focus:border-[#12B8A8]"
                >
                  {roles.map((role) => (
                    <option key={role.id} value={role.id}>{role.name}</option>
                  ))}
                </select>
              </label>
              <button
                type="submit"
                disabled={busy === 'invite'}
                className="w-full h-11 rounded-2xl bg-[#12B8A8] text-white text-sm font-semibold inline-flex items-center justify-center gap-2 shadow-[0_10px_20px_-12px_rgba(18,184,168,0.9)]"
              >
                {busy === 'invite' ? <Loader2 className="w-4 h-4 animate-spin" /> : <ChevronRight className="w-4 h-4" />}
                Send invite
              </button>
            </form>
          )}

          <div className="rounded-[24px] border border-slate-200/80 bg-white/90 p-5 shadow-[var(--byjan-shadow)] space-y-3">
            <div className="flex items-center gap-2">
              <span className="w-10 h-10 rounded-2xl bg-slate-100 text-[#0B1F3A] border border-slate-200 inline-flex items-center justify-center">
                <Shield className="w-5 h-5" />
              </span>
              <div>
                <h2 className="text-sm font-semibold text-[#0B1F3A]">Organization</h2>
                <p className="text-xs text-slate-500">Workspace identity for this access realm.</p>
              </div>
            </div>
            <input
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              className="w-full h-11 px-3 rounded-2xl border border-slate-200 text-sm font-semibold text-[#0B1F3A] outline-none focus:border-[#12B8A8]"
            />
            <button
              type="button"
              onClick={() => void onRenameOrg()}
              disabled={busy === 'org'}
              className="w-full h-11 rounded-2xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              {busy === 'org' ? 'Saving…' : 'Save name'}
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}

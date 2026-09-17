import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ChevronDown, Loader2, Search, Shield } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { invalidateRolePermissionCache, listAccessPeople, setPersonFeatures, type AccessPerson } from '../lib/me';
import {
  FEATURE_GROUPS,
  MEMBER_FEATURES,
  applyFeatureToggle,
  buildFeatureTree,
  descendantKeys,
  featureRow,
  normalizeFeatures,
  type FeatureMap,
  type FeatureNode,
} from '../lib/features';
import { getRolePermissions, setRolePermissions } from '../lib/money-api';
import { ROLE_FEATURE_DEFAULTS } from '../lib/money-flow';
import { CapacitorService } from '../lib/capacitor';

function personQuery(person: AccessPerson) {
  return `${person.displayName} ${person.email}`.toLowerCase();
}

function nodeMatches(node: FeatureNode, needle: string): boolean {
  if (!needle) return true;
  if (`${node.label} ${node.hint} ${node.key}`.toLowerCase().includes(needle)) return true;
  return node.children.some((child) => nodeMatches(child, needle));
}

function countOn(map: FeatureMap, keys: string[]) {
  return keys.filter((key) => map[key]).length;
}

function FeatureTree({
  map,
  locked,
  query,
  onToggle,
}: {
  map: FeatureMap;
  locked: boolean;
  query: string;
  onToggle: (key: string) => void;
}) {
  const needle = query.trim().toLowerCase();
  const [open, setOpen] = useState<Record<string, boolean>>({ money: true, business: true, app_notifications: true });

  return (
    <div className="access-tree" data-access-tree="true">
      <div className="access-tree-toolbar">
        <button
          type="button"
          className="access-tree-tool"
          onClick={() => setOpen(Object.fromEntries(FEATURE_GROUPS.flatMap((group) => buildFeatureTree(group).flatMap(function walk(node: FeatureNode): Array<[string, boolean]> {
            return [[node.key, true], ...node.children.flatMap(walk)];
          }))))}
        >
          Expand all
        </button>
        <button type="button" className="access-tree-tool" onClick={() => setOpen({})}>
          Collapse all
        </button>
      </div>
      {FEATURE_GROUPS.map((group) => {
        const roots = buildFeatureTree(group).filter((node) => nodeMatches(node, needle));
        if (!roots.length) return null;
        const groupKeys = roots.flatMap((node) => [node.key, ...descendantKeys(node.key)]);
        const onCount = countOn(map, groupKeys);
        return (
          <section key={group} className="access-feature-group">
            <div className="access-feature-group-head">
              <p className="access-feature-group-label">{group}</p>
              <span className="access-count">{onCount}/{groupKeys.length} on</span>
            </div>
            {roots.map((node) => (
              <TreeNode
                key={node.key}
                node={node}
                depth={0}
                map={map}
                locked={locked}
                needle={needle}
                open={open}
                setOpen={setOpen}
                onToggle={onToggle}
              />
            ))}
          </section>
        );
      })}
    </div>
  );
}

function TreeNode({
  node,
  depth,
  map,
  locked,
  needle,
  open,
  setOpen,
  onToggle,
}: {
  node: FeatureNode;
  depth: number;
  map: FeatureMap;
  locked: boolean;
  needle: string;
  open: Record<string, boolean>;
  setOpen: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  onToggle: (key: string) => void;
  key?: string;
}) {
  if (!nodeMatches(node, needle)) return null;
  const checked = Boolean(map[node.key]);
  const parentOff = Boolean(node.parent && !map[node.parent]);
  const disabled = locked || parentOff;
  const kids = node.children.filter((child) => nodeMatches(child, needle));
  const expanded = Boolean(needle) || (open[node.key] ?? (node.kind !== 'action' || depth < 2));
  const childOn = countOn(map, kids.map((child) => child.key));

  return (
    <div className={`access-tree-block depth-${Math.min(depth, 3)}`} data-feature-key={node.key}>
      <div className={`access-tree-row ${node.kind}`}>
        {kids.length > 0 ? (
          <button
            type="button"
            className="access-expand"
            aria-expanded={expanded}
            aria-label={expanded ? `Collapse ${node.label}` : `Expand ${node.label}`}
            onClick={() => setOpen((curr) => ({ ...curr, [node.key]: !expanded }))}
          >
            <ChevronDown className={`w-4 h-4 transition-transform ${expanded ? 'rotate-0' : '-rotate-90'}`} />
          </button>
        ) : (
          <span className="access-expand is-spacer" aria-hidden />
        )}
        <button
          type="button"
          className="access-feature-row"
          disabled={disabled}
          onClick={() => onToggle(node.key)}
          aria-checked={checked}
          role="switch"
          data-kind={node.kind}
        >
          <span className="min-w-0 text-left">
            <span className="block text-sm font-semibold text-[#0B1F3A]">
              {node.label}
              {kids.length > 0 ? <span className="access-child-count">{childOn}/{kids.length}</span> : null}
            </span>
            <span className="block text-[12px] text-slate-500">{node.hint}</span>
          </span>
          <span className={`access-switch ${checked ? 'is-on' : ''}`} aria-hidden="true">
            <i />
          </span>
        </button>
      </div>
      {kids.length > 0 && expanded ? (
        <div className={`access-tree-children ${node.kind === 'module' ? 'is-actions' : ''}`}>
          {kids.map((child) => (
            <TreeNode
              key={child.key}
              node={child}
              depth={depth + 1}
              map={map}
              locked={locked}
              needle={needle}
              open={open}
              setOpen={setOpen}
              onToggle={onToggle}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default function AccessControl() {
  const { currentUser, userProfile, refreshUserProfile } = useAuth();
  const { addToast } = useToast();
  const uid = currentUser?.uid || '';
  const [people, setPeople] = useState<AccessPerson[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [featureQuery, setFeatureQuery] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [draft, setDraft] = useState<FeatureMap | null>(null);
  const [saving, setSaving] = useState(false);
  const [roleKey, setRoleKey] = useState('DEFAULT_USER');
  const [roleDraft, setRoleDraft] = useState<FeatureMap>({ ...MEMBER_FEATURES });
  const [roleSaving, setRoleSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const next = await listAccessPeople(userProfile?.email || currentUser?.email || '');
      setPeople(next);
      try {
        const roles = await getRolePermissions();
        const defaults = (ROLE_FEATURE_DEFAULTS.DEFAULT_USER || MEMBER_FEATURES) as FeatureMap;
        const current = roles.DEFAULT_USER || roles[roleKey] || defaults;
        setRoleDraft(normalizeFeatures({ ...MEMBER_FEATURES, ...current }));
      } catch {
        /* role API optional until migrated */
      }
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Could not load people', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [uid]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return people;
    return people.filter((person) => personQuery(person).includes(needle));
  }, [people, query]);

  const selected = people.find((person) => person.uid === selectedId) || null;
  const isYou = selected?.uid === uid;

  const openPerson = (person: AccessPerson) => {
    void CapacitorService.hapticTick();
    setSelectedId(person.uid);
    setDraft(normalizeFeatures(person.features, MEMBER_FEATURES));
    setFeatureQuery('');
  };

  const toggle = (key: string) => {
    if (!draft || isYou) return;
    const row = featureRow(key);
    if (row?.parent && !draft[row.parent]) return;
    setDraft(applyFeatureToggle(draft, key));
  };

  const save = async () => {
    if (!selected || !draft || isYou) return;
    setSaving(true);
    try {
      await setPersonFeatures(selected.uid, draft, uid, userProfile?.email || currentUser?.email || '');
      setPeople((curr) => curr.map((person) => (
        person.uid === selected.uid ? { ...person, features: { ...draft } } : person
      )));
      addToast(`Access updated for ${selected.displayName || selected.email}`, 'success');
      void CapacitorService.hapticImpact();
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Could not save access', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="access-shell ios-page">
      <div className="flex items-center gap-2 mb-1">
        <Link to="/" className="p-2 -ml-2 rounded-xl text-slate-500" aria-label="Back to Home">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Super user</p>
          <h1 className="font-display text-[26px] font-semibold tracking-[-0.04em] text-[#0B1F3A]">Access & roles</h1>
        </div>
      </div>
      <p className="text-[13px] text-slate-500 mb-4">
        Every Money, App, and Business feature, module, and action. Turn a parent off to hide its children. Signed in as {userProfile?.email || currentUser?.email}.
      </p>

      <label className="access-search">
        <Search className="w-4 h-4 text-slate-400" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search people by name or email"
          autoComplete="off"
        />
      </label>

      {loading ? (
        <div className="access-card flex items-center justify-center py-10">
          <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
        </div>
      ) : people.length === 0 ? (
        <div className="access-card p-5">
          <Shield className="w-8 h-8 text-slate-300 mb-2" />
          <p className="font-semibold text-[#0B1F3A]">No people to search yet</p>
          <p className="text-sm text-slate-500 mt-1">
            Invite someone from a money book’s People button. After they join, they show up here so you can control what they can use.
          </p>
        </div>
      ) : (
        <div className="access-split">
          <div className="access-card overflow-hidden">
            {filtered.length === 0 ? (
              <p className="p-4 text-sm text-slate-500">No person matches “{query.trim()}”.</p>
            ) : filtered.map((person) => {
              const on = selectedId === person.uid;
              return (
                <button
                  key={person.uid}
                  type="button"
                  className={`access-person-btn ${on ? 'is-on' : ''}`}
                  onClick={() => openPerson(person)}
                >
                  <span className="access-avatar">{(person.displayName || person.email || '?').charAt(0).toUpperCase()}</span>
                  <span className="min-w-0 text-left">
                    <span className="block text-sm font-semibold text-[#0B1F3A] truncate">{person.displayName || 'Person'}</span>
                    <span className="block text-[12px] text-slate-500 truncate">{person.email || person.uid}</span>
                  </span>
                  {person.uid === uid ? <span className="access-you">You</span> : null}
                </button>
              );
            })}
          </div>

          {selected && draft ? (
            <div className="access-card p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Features</p>
              <h2 className="font-display text-[20px] font-semibold tracking-[-0.03em] text-[#0B1F3A] mt-1">{selected.displayName}</h2>
              <p className="text-[13px] text-slate-500 mb-3">{selected.email}</p>
              {isYou ? (
                <p className="text-sm text-slate-500 mb-2">You always keep full access. Pick someone else to turn features on or off.</p>
              ) : (
                <p className="text-sm text-slate-500 mb-3">Off means that person will not see the feature, its screens, or its actions the next time they open the app.</p>
              )}
              <label className="access-search !mb-3">
                <Search className="w-4 h-4 text-slate-400" />
                <input
                  type="search"
                  value={featureQuery}
                  onChange={(e) => setFeatureQuery(e.target.value)}
                  placeholder="Search features, modules, actions"
                  autoComplete="off"
                />
              </label>
              <FeatureTree map={draft} locked={isYou} query={featureQuery} onToggle={toggle} />
              {!isYou && (
                <button type="button" className="byjan-btn w-full mt-3" disabled={saving} onClick={() => void save()}>
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save access'}
                </button>
              )}
            </div>
          ) : (
            <div className="access-card p-5">
              <p className="font-semibold text-[#0B1F3A]">Pick a person</p>
              <p className="text-sm text-slate-500 mt-1">Search the list, tap a name, then choose what they can use.</p>
            </div>
          )}
        </div>
      )}

      {!loading && (
        <div className="access-card p-4 mt-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Role defaults</p>
          <h2 className="font-display text-[18px] font-semibold tracking-[-0.03em] text-[#0B1F3A] mt-1">ROLE → FEATURE</h2>
          <p className="text-[13px] text-slate-500 mb-3">Effective access is User override → Role → secure default. New actions inherit the parent module until you set them.</p>
          <div className="flex flex-wrap gap-2 mb-3">
            {['DEFAULT_USER', 'viewer', 'contributor', 'admin'].map((key) => (
              <button
                key={key}
                type="button"
                className={`byjan-chip ${roleKey === key ? 'is-on' : ''}`}
                data-on={roleKey === key}
                onClick={() => {
                  setRoleKey(key);
                  void getRolePermissions().then((roles) => {
                    const base = (ROLE_FEATURE_DEFAULTS[key] || MEMBER_FEATURES) as FeatureMap;
                    setRoleDraft(normalizeFeatures({ ...MEMBER_FEATURES, ...base, ...(roles[key] || {}) }));
                  }).catch(() => {
                    setRoleDraft(normalizeFeatures({ ...MEMBER_FEATURES, ...(ROLE_FEATURE_DEFAULTS[key] || {}) }));
                  });
                }}
              >
                {key}
              </button>
            ))}
          </div>
          <label className="access-search !mb-3">
            <Search className="w-4 h-4 text-slate-400" />
            <input
              type="search"
              value={featureQuery}
              onChange={(e) => setFeatureQuery(e.target.value)}
              placeholder="Search role features"
              autoComplete="off"
            />
          </label>
          <FeatureTree
            map={roleDraft}
            locked={false}
            query={featureQuery}
            onToggle={(key) => setRoleDraft((curr) => applyFeatureToggle(curr, key))}
          />
          <button
            type="button"
            className="byjan-btn w-full mt-3"
            disabled={roleSaving}
            onClick={() => {
              setRoleSaving(true);
              void setRolePermissions(roleKey, roleDraft as unknown as Record<string, boolean>)
                .then(() => {
                  invalidateRolePermissionCache();
                  addToast('Role permissions saved. Default users pick this up the next time they open the app.', 'success');
                  void refreshUserProfile();
                  void load();
                })
                .catch((err) => addToast(err instanceof Error ? err.message : 'Could not save role', 'error'))
                .finally(() => setRoleSaving(false));
            }}
          >
            {roleSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : `Save ${roleKey} role`}
          </button>
        </div>
      )}
    </div>
  );
}

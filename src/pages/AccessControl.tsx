import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Loader2, Search, Shield } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { listAccessPeople, setPersonFeatures, type AccessPerson } from '../lib/me';
import { FEATURE_CATALOG, MEMBER_FEATURES, type FeatureKey, type FeatureMap } from '../lib/features';
import { getRolePermissions, setRolePermissions } from '../lib/money-api';
import { ROLE_FEATURE_DEFAULTS } from '../lib/money-flow';
import { CapacitorService } from '../lib/capacitor';

function personQuery(person: AccessPerson) {
  return `${person.displayName} ${person.email}`.toLowerCase();
}

export default function AccessControl() {
  const { currentUser, userProfile } = useAuth();
  const { addToast } = useToast();
  const uid = currentUser?.uid || '';
  const [people, setPeople] = useState<AccessPerson[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
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
        setRoleDraft({ ...MEMBER_FEATURES, ...current } as FeatureMap);
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
    setDraft({ ...person.features });
  };

  const toggle = (key: FeatureKey) => {
    if (!draft || isYou) return;
    if (key === 'money_add' || key === 'money_people') {
      if (!draft.money) return;
    }
    if (key !== 'money' && key !== 'money_add' && key !== 'money_people' && key !== 'business') {
      if (!draft.business) return;
    }
    setDraft({ ...draft, [key]: !draft[key] });
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

  const groups = ['Money', 'Business'] as const;

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
        Search a person, then turn app features on or off. Signed in as {userProfile?.email || currentUser?.email}.
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
                <p className="text-sm text-slate-500 mb-3">Off means that person will not see the feature the next time they open the app.</p>
              )}
              {groups.map((group) => (
                <div key={group} className="access-feature-group">
                  <p className="access-feature-group-label">{group}</p>
                  {FEATURE_CATALOG.filter((row) => row.group === group).map((row) => {
                    const checked = Boolean(draft[row.key]);
                    const locked = Boolean(
                      isYou
                      || ((row.key === 'money_add' || row.key === 'money_people') && !draft.money)
                      || (row.group === 'Business' && row.key !== 'business' && !draft.business),
                    );
                    return (
                      <button
                        key={row.key}
                        type="button"
                        className="access-feature-row"
                        disabled={locked}
                        onClick={() => toggle(row.key)}
                        aria-checked={checked}
                        role="switch"
                      >
                        <span className="min-w-0 text-left">
                          <span className="block text-sm font-semibold text-[#0B1F3A]">{row.label}</span>
                          <span className="block text-[12px] text-slate-500">{row.hint}</span>
                        </span>
                        <span className={`access-switch ${checked ? 'is-on' : ''}`} aria-hidden="true">
                          <i />
                        </span>
                      </button>
                    );
                  })}
                </div>
              ))}
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
          <p className="text-[13px] text-slate-500 mb-3">Effective access is User override → Role → secure default. New features stay off unless configured.</p>
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
                    setRoleDraft({ ...MEMBER_FEATURES, ...base, ...(roles[key] || {}) } as FeatureMap);
                  }).catch(() => {
                    setRoleDraft({ ...MEMBER_FEATURES, ...(ROLE_FEATURE_DEFAULTS[key] || {}) } as FeatureMap);
                  });
                }}
              >
                {key}
              </button>
            ))}
          </div>
          {FEATURE_CATALOG.filter((row) => row.group === 'Money' || row.key === 'business' || row.key === 'reports' || row.key === 'company_settings').map((row) => (
            <button
              key={row.key}
              type="button"
              className="access-feature-row"
              onClick={() => setRoleDraft((curr) => ({ ...curr, [row.key]: !curr[row.key] }))}
              role="switch"
              aria-checked={Boolean(roleDraft[row.key])}
            >
              <span className="min-w-0 text-left">
                <span className="block text-sm font-semibold text-[#0B1F3A]">{row.label}</span>
                <span className="block text-[12px] text-slate-500">{row.hint}</span>
              </span>
              <span className={`access-switch ${roleDraft[row.key] ? 'is-on' : ''}`} aria-hidden="true"><i /></span>
            </button>
          ))}
          <button
            type="button"
            className="byjan-btn w-full mt-3"
            disabled={roleSaving}
            onClick={() => {
              setRoleSaving(true);
              void setRolePermissions(roleKey, roleDraft as unknown as Record<string, boolean>)
                .then(() => addToast('Role permissions saved', 'success'))
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

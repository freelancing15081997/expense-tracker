import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useBooks } from '../../context/BooksProvider';
import { useRbac } from '../../../context/RbacContext';
import { RBAC_PERMISSIONS } from '../../../lib/rbac-catalog';
import type { BooksRole } from '../../core/types';
import { booksFileUrl } from '../../storage/adapter';
import { Card, Field, FileField, IconBtn, inputClass, PageShell, Status } from '../../ui';
import { BOOKS_CATALOG } from '../../catalog';

export default function BooksSettings() {
  const { tenant, periods, role, can, rename, close, reopen, uploadFile, inviteMember, removeMember } = useBooks();
  const { can: canPlatform, session, refresh: refreshRbac } = useRbac();
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<BooksRole>('contributor');
  const [inviteFeatures, setInviteFeatures] = useState<string[]>([]);
  const [usersBusy, setUsersBusy] = useState('');
  const [usersMessage, setUsersMessage] = useState('');
  const [name, setName] = useState(tenant?.name || '');
  const [gstin, setGstin] = useState(tenant?.gstin || '');
  const [address, setAddress] = useState(tenant?.address || '');
  const [city, setCity] = useState(tenant?.city || '');
  const [state, setState] = useState(tenant?.state || '');
  const [pincode, setPincode] = useState(tenant?.pincode || '');
  const [phone, setPhone] = useState(tenant?.phone || '');
  const [email, setEmail] = useState(tenant?.email || '');
  const [website, setWebsite] = useState(tenant?.website || '');
  const [invoiceFooter, setInvoiceFooter] = useState(tenant?.invoiceFooter || '');
  const [message, setMessage] = useState('');
  const [logoUrl, setLogoUrl] = useState('');

  useEffect(() => {
    setName(tenant?.name || '');
    setGstin(tenant?.gstin || '');
    setAddress(tenant?.address || '');
    setCity(tenant?.city || '');
    setState(tenant?.state || '');
    setPincode(tenant?.pincode || '');
    setPhone(tenant?.phone || '');
    setEmail(tenant?.email || '');
    setWebsite(tenant?.website || '');
    setInvoiceFooter(tenant?.invoiceFooter || '');
  }, [tenant]);

  useEffect(() => {
    if (!tenant?.logoPath) {
      setLogoUrl('');
      return;
    }
    booksFileUrl(tenant.logoPath).then(setLogoUrl).catch(() => setLogoUrl(''));
  }, [tenant?.logoPath]);

  const profile = {
    gstin,
    address,
    city,
    state,
    pincode,
    phone,
    email,
    website,
    invoiceFooter,
  };

  return (
    <PageShell title="Books Settings" subtitle="Company identity used on invoices, bills, and statements. Currency is locked to the tenant base currency used by every journal.">
      <Card className="p-4 space-y-4">
        <div className="grid md:grid-cols-2 gap-3">
          <Field label="Legal / workspace name">
            <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} disabled={!can('manage_settings')} />
          </Field>
          <Field label="GSTIN">
            <input className={inputClass} value={gstin} onChange={(e) => setGstin(e.target.value)} disabled={!can('manage_settings')} />
          </Field>
          <Field label="Address">
            <input className={inputClass} value={address} onChange={(e) => setAddress(e.target.value)} disabled={!can('manage_settings')} />
          </Field>
          <Field label="City">
            <input className={inputClass} value={city} onChange={(e) => setCity(e.target.value)} disabled={!can('manage_settings')} />
          </Field>
          <Field label="State">
            <input className={inputClass} value={state} onChange={(e) => setState(e.target.value)} disabled={!can('manage_settings')} />
          </Field>
          <Field label="PIN">
            <input className={inputClass} value={pincode} onChange={(e) => setPincode(e.target.value)} disabled={!can('manage_settings')} />
          </Field>
          <Field label="Phone">
            <input className={inputClass} value={phone} onChange={(e) => setPhone(e.target.value)} disabled={!can('manage_settings')} />
          </Field>
          <Field label="Email">
            <input className={inputClass} value={email} onChange={(e) => setEmail(e.target.value)} disabled={!can('manage_settings')} />
          </Field>
          <Field label="Website">
            <input className={inputClass} value={website} onChange={(e) => setWebsite(e.target.value)} disabled={!can('manage_settings')} />
          </Field>
        </div>
        <Field label="Default invoice / bill footer">
          <textarea className={inputClass} rows={3} value={invoiceFooter} onChange={(e) => setInvoiceFooter(e.target.value)} disabled={!can('manage_settings')} />
        </Field>
        <p className="text-sm text-slate-500">Base currency: <strong>{tenant?.baseCurrency}</strong> · Your role: <strong>{role}</strong></p>
        <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 text-sm space-y-1">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">This workspace</p>
          <p>Company: <strong>{tenant?.name}</strong></p>
          <p className="text-slate-600">Create another isolated company or subsidiary from <Link className="underline" to="/books/companies">Companies</Link>. Switch from the Workspace menu in the header. Expense Tracker ledgers stay separate.</p>
        </div>
        {logoUrl && (
          <div className="w-20 h-20 rounded-2xl border border-[#E5E7EB] overflow-hidden bg-white">
            <img src={logoUrl} alt="Company logo" className="w-full h-full object-contain" />
          </div>
        )}
        {can('manage_settings') && (
          <FileField
            label="Company logo (shown on invoices, bills, and statements)"
            accept="image/png,image/jpeg,image/webp"
            hint="Uploads the image to Cloudflare R2, then stores the path with the company record."
            onFiles={async (files) => {
              const file = files[0];
              if (!file) return;
              try {
                const stored = await uploadFile({ domain: 'workspace-logo', file });
                try {
                  setLogoUrl(await booksFileUrl(stored.path));
                } catch {
                  setLogoUrl('');
                }
                if (stored.quotaBlocked) {
                  setMessage(stored.message || 'Logo is stored. Wait a minute, then click Save company profile.');
                  return;
                }
                await rename(name || tenant?.name || 'Byjan Books', stored.path, profile);
                setMessage('Company logo saved.');
              } catch (err: any) {
                setMessage(err.message || 'Logo upload failed');
              }
            }}
          />
        )}
        {can('manage_settings') && (
            <IconBtn
              action="save"
              onClick={async () => {
                try {
                  await rename(name, undefined, profile);
                  setMessage('Company profile saved');
                } catch (err: any) {
                  setMessage(err.message || 'Save failed');
                }
              }}
            >
              Save company profile
            </IconBtn>
        )}
        {message && <p className="text-sm text-slate-600">{message}</p>}
      </Card>
      
      {can('manage_settings') && canPlatform('books.users.manage') && (
        <Card className="p-4 space-y-4">
          <div>
            <h2 className="font-semibold">Users & access</h2>
            <p className="text-sm text-slate-500 mt-1">
              Invite people to this Books company. You can only grant Books features that your account already has.
              New users still need a Byjan login; after they sign in, refresh to see them in this company.
            </p>
          </div>
          <div className="space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Company members</p>
            <ul className="space-y-2 text-sm">
              {Object.entries(tenant?.members || {}).map(([uid, member]) => {
                const m = member as { email?: string; role?: string; featureIds?: string[] };
                return (
                <li key={uid} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-3 py-2">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{m.email || uid}</p>
                    <p className="text-xs text-slate-500 capitalize">{m.role}{m.featureIds?.length ? ` · ${m.featureIds.length} features` : ''}</p>
                  </div>
                  {uid !== tenant?.ownerId && (
                    <button
                      type="button"
                      className="text-rose-700 text-xs underline"
                      disabled={usersBusy === `rm:${uid}`}
                      onClick={async () => {
                        if (!window.confirm('Remove this member from the Books company?')) return;
                        setUsersBusy(`rm:${uid}`);
                        try {
                          await removeMember(uid);
                          setUsersMessage('Member removed');
                        } catch (err: any) {
                          setUsersMessage(err?.message || 'Could not remove member');
                        } finally {
                          setUsersBusy('');
                        }
                      }}
                    >
                      Remove
                    </button>
                  )}
                </li>
                );
              })}
              {Object.keys(tenant?.pendingInvites || {}).length > 0 && (
                <li className="text-xs text-amber-700">
                  Pending invites: {Object.keys(tenant?.pendingInvites || {}).join(', ')}
                </li>
              )}
            </ul>
          </div>
          <form
            className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3"
            onSubmit={async (e) => {
              e.preventDefault();
              setUsersBusy('invite');
              setUsersMessage('');
              try {
                await inviteMember(inviteEmail, inviteRole, inviteFeatures);
                await refreshRbac();
                setInviteEmail('');
                setInviteFeatures([]);
                setUsersMessage('Invite sent. They will join this company after signing in.');
              } catch (err: any) {
                setUsersMessage(err?.message || 'Invite failed');
              } finally {
                setUsersBusy('');
              }
            }}
          >
            <div className="grid md:grid-cols-2 gap-3">
              <Field label="Email">
                <input className={inputClass} value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="colleague@company.com" required />
              </Field>
              <Field label="Books role">
                <select className={inputClass} value={inviteRole} onChange={(e) => setInviteRole(e.target.value as BooksRole)}>
                  <option value="admin">Admin</option>
                  <option value="contributor">Contributor</option>
                  <option value="viewer">Viewer</option>
                  <option value="auditor">Auditor</option>
                </select>
              </Field>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Books features to grant</p>
              <div className="grid sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                {RBAC_PERMISSIONS.filter((p) => p.id.startsWith('books.') && canPlatform(p.id)).map((perm) => {
                  const checked = inviteFeatures.includes(perm.id);
                  return (
                    <label key={perm.id} className="flex items-start gap-2 text-sm">
                      <input
                        type="checkbox"
                        className="mt-1"
                        checked={checked}
                        onChange={() => setInviteFeatures((prev) => checked ? prev.filter((id) => id !== perm.id) : [...prev, perm.id])}
                      />
                      <span>
                        <span className="font-medium">{perm.label}</span>
                        <span className="block text-xs text-slate-500">{perm.id}</span>
                      </span>
                    </label>
                  );
                })}
              </div>
              {!canPlatform('books.access') && (
                <p className="text-xs text-rose-700 mt-2">You need Books features on your own account before you can grant them.</p>
              )}
            </div>
            <IconBtn action="create" type="submit" busy={usersBusy === 'invite'} disabled={!inviteEmail.trim() || usersBusy === 'invite'}>
              Invite to Books
            </IconBtn>
            {usersMessage && <p className="text-sm text-slate-600">{usersMessage}</p>}
          </form>
        </Card>
      )}

      <Card className="p-4">
        <h2 className="font-semibold mb-3">Accounting periods</h2>
        <ul className="space-y-2">
          {periods.sort((a, b) => b.id.localeCompare(a.id)).map((period) => (
            <li key={period.id} className="flex items-center justify-between text-sm">
              <span>{period.id}</span>
              <span className="flex items-center gap-2">
                <Status value={period.status} />
                {period.status === 'open' && can('close_period') && (
                  <button className="text-slate-600 underline" onClick={() => close(period.id)}>Close</button>
                )}
                {period.status === 'closed' && can('close_period') && (
                  <button className="text-slate-600 underline" onClick={() => reopen(period.id)}>Reopen</button>
                )}
              </span>
            </li>
          ))}
        </ul>
      </Card>
      <Card className="p-4 space-y-4">
        <h2 className="font-semibold">Requirement coverage</h2>
        <p className="text-sm text-slate-500">Live items post real journals. Adapter items are interfaces only — they are not fake operational screens.</p>
        {BOOKS_CATALOG.map((group) => (
          <div key={group.domain}>
            <h3 className="text-xs uppercase tracking-wide text-slate-500 font-bold mb-1">{group.domain}</h3>
            <ul className="text-sm space-y-1">
              {group.items.map((item) => (
                <li key={item.name} className="flex justify-between gap-3">
                  <span>{item.name}</span>
                  <span className={item.status === 'live' ? 'text-emerald-700' : 'text-slate-400'}>{item.status}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </Card>
    </PageShell>
  );
}

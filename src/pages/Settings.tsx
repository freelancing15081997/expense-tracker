import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useAppPrefs } from '../context/AppPrefsContext';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { upsertMe } from '../lib/me';
import { Save, AlertCircle, CheckCircle2, Shield, BellRing, CircleHelp, UserX, Trash2, Settings as SettingsIcon } from 'lucide-react';
import { disableLock, lockConfig, lockIsEnabledFor, setLockPin, updateLockOptions } from '../lib/app-lock';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/Select';
import { useBooksTenantMeta } from '../lib/tenant';
import type { AppPrefs, DateFormat, ListPageSize, NumberLocale, UiDensity } from '../lib/app-prefs';
import { useToast } from '../context/ToastContext';
import UpiSetupSheet from '../components/UpiSetupSheet';
import { pingSelfNotification } from '../lib/notifications';
import { useFeatures } from '../lib/use-features';
import { deactivateAccount, deleteAccount, setAuthNotice } from '../lib/support';
import { deleteCurrentAuthUser, logout } from '../lib/firebase';

function Switch({ on, onChange, label, hint }: { on: boolean; onChange: (v: boolean) => void; label: string; hint: string }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!on)}
      className="w-full flex items-start gap-3 text-left py-3 border-b border-slate-100 last:border-0"
    >
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-[#0B1F3A]">{label}</span>
        <span className="block text-xs text-slate-500 mt-0.5 leading-relaxed">{hint}</span>
      </span>
      <span className={`mt-0.5 relative w-11 h-6 rounded-full shrink-0 transition-colors ${on ? 'bg-[#12B8A8]' : 'bg-slate-200'}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${on ? 'left-5' : 'left-0.5'}`} />
      </span>
    </button>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-slate-700 mb-1.5">{label}</span>
      {children}
      {hint && <span className="mt-1.5 block text-xs text-slate-500">{hint}</span>}
    </label>
  );
}

export default function Settings() {
  const { userProfile, refreshUserProfile, isSuperUser } = useAuth();
  const { on: hasFeature } = useFeatures();
  const tenant = useBooksTenantMeta();
  const { prefs, setPref, savePrefs } = useAppPrefs();
  const { addToast } = useToast();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState(userProfile?.displayName || '');
  const [categories, setCategories] = useState<string[]>(userProfile?.customCategories || []);
  const [newCategory, setNewCategory] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [upiOpen, setUpiOpen] = useState(false);
  const [appVersion, setAppVersion] = useState('');
  const [lockPin, setLockPinInput] = useState('');
  const [lockPin2, setLockPin2] = useState('');
  const [lockBio, setLockBio] = useState(false);
  const [lockOn, setLockOn] = useState(() => lockConfig().enabled);
  const [lockAuto, setLockAuto] = useState(() => String(lockConfig().options.autoLockMs));
  const [lockIdle, setLockIdle] = useState(() => String(lockConfig().options.idleLockMs));
  const [lockShuffle, setLockShuffle] = useState(() => lockConfig().options.shufflePad);
  const [lockBioFirst, setLockBioFirst] = useState(() => lockConfig().options.bioFirst);
  const [lockHide, setLockHide] = useState(() => lockConfig().options.hideContent);
  const [pingBusy, setPingBusy] = useState(false);
  const [accountBusy, setAccountBusy] = useState<'off' | 'deactivate' | 'delete'>('off');
  const [confirmText, setConfirmText] = useState('');

  useEffect(() => {
    setDisplayName(userProfile?.displayName || '');
    setCategories(userProfile?.customCategories || []);
  }, [userProfile?.displayName, userProfile?.customCategories]);

  useEffect(() => {
    if (searchParams.get('upi') === '1') setUpiOpen(true);
  }, [searchParams]);

  useEffect(() => {
    void import('@capacitor/app').then(({ App }) => App.getInfo())
      .then((info) => setAppVersion(String(info?.version || '')))
      .catch(() => setAppVersion(''));
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userProfile) return;
    setLoading(true);
    setMessage('');
    setError('');
    try {
      const cleaned = [...new Set(categories.map((c) => c.trim()).filter(Boolean))];
      await savePrefs(prefs);
      await upsertMe({
        displayName,
        defaultCurrency: prefs.defaultCurrency,
        customCategories: cleaned,
        appPrefs: prefs,
      });
      setCategories(cleaned);
      await refreshUserProfile();
      setMessage('Settings saved. Global categories now appear in every ledger entry form.');
      addToast('Settings saved', 'success');
    } catch (err: any) {
      setError(err?.message || 'Failed to update settings.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddCategory = (e: React.FormEvent) => {
    e.preventDefault();
    const cat = newCategory.trim();
    if (cat && !categories.includes(cat)) {
      setCategories([...categories, cat]);
      setNewCategory('');
    }
  };

  const handleDeactivate = async () => {
    if (confirmText.trim().toUpperCase() !== 'DEACTIVATE') {
      addToast('Type DEACTIVATE to confirm', 'error');
      return;
    }
    setAccountBusy('deactivate');
    try {
      await deactivateAccount();
      setAuthNotice('This Byjan account is deactivated. Email byjanbooks@gmail.com if you want it turned back on.');
      await logout();
      navigate('/login', { replace: true });
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Could not deactivate this account', 'error');
    } finally {
      setAccountBusy('off');
    }
  };

  const handleDeleteAccount = async () => {
    if (confirmText.trim().toUpperCase() !== 'DELETE') {
      addToast('Type DELETE to confirm', 'error');
      return;
    }
    setAccountBusy('delete');
    try {
      await deleteAccount();
      setAuthNotice('Your Byjan account was deleted.');
      await deleteCurrentAuthUser();
      navigate('/login', { replace: true });
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Could not delete this account', 'error');
    } finally {
      setAccountBusy('off');
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-28 md:pb-10">
    <form onSubmit={handleSave} className="space-y-6">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Preferences</p>
        <h1 className="font-display text-[28px] font-semibold tracking-[-0.04em] text-[#0B1F3A]">Settings</h1>
        <p className="text-sm text-slate-500 mt-1">These options apply everywhere. Sign out is on your photo in the top-right.{appVersion ? ` App ${appVersion}.` : ''}</p>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <div className="byjan-card p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Account</p>
          <p className="text-sm font-semibold text-slate-900 mt-1 truncate">{userProfile?.displayName || 'Signed in'}</p>
          <p className="text-xs text-slate-500 mt-1 truncate">{userProfile?.email}</p>
        </div>
        <div className="byjan-card p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{tenant ? 'Business company' : 'Money books'}</p>
          <p className="text-sm font-semibold text-slate-900 mt-1">{tenant?.name || 'Shared daily money'}</p>
          <p className="text-xs text-slate-500 mt-1">{tenant ? 'Company letterhead lives in Business → Settings.' : 'Money books are for daily spend. Business is for invoices and GST.'}</p>
        </div>
        {isSuperUser && (
        <Link to="/access" className="byjan-card p-4 sm:col-span-2 block">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5" /> Access & people
          </p>
          <p className="text-sm font-semibold text-slate-900 mt-1">Access & roles</p>
          <p className="text-xs text-slate-500 mt-1">Search people and turn features on or off. Invite someone to a money book from that book’s People button.</p>
        </Link>
        )}
        <Link to="/help" className="byjan-card p-4 sm:col-span-2 block">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
            <CircleHelp className="w-3.5 h-3.5" /> Support
          </p>
          <p className="text-sm font-semibold text-slate-900 mt-1">Help & tickets</p>
          <p className="text-xs text-slate-500 mt-1">Common answers, then send an issue to Byjan Books. You can see every ticket you opened.</p>
        </Link>
      </div>

      {message && (
        <div className="bg-emerald-50 text-emerald-800 p-3 rounded-xl text-sm font-medium border border-emerald-200 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" /> {message}
        </div>
      )}
      {error && (
        <div className="bg-rose-50 text-rose-800 p-3 rounded-xl text-sm font-medium border border-rose-200 flex items-center gap-2">
          <AlertCircle className="w-4 h-4" /> {error}
        </div>
      )}

      <section className="byjan-card overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 bg-[#F8FAFC]">
          <h2 className="text-base font-semibold text-slate-900">Profile</h2>
        </div>
        <div className="p-5 grid md:grid-cols-2 gap-5">
          <Field label="Email">
            <input type="email" disabled value={userProfile?.email || ''} className="byjan-input bg-slate-50 text-slate-500" />
          </Field>
          <Field label="Display name">
            <input className="byjan-input" required value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
          </Field>
        </div>
      </section>

      {hasFeature('money_settle') && (
      <section className="byjan-card overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 bg-[#F8FAFC]">
          <h2 className="text-base font-semibold text-slate-900">UPI for settlements</h2>
          <p className="text-xs text-slate-500 mt-1">Teammates pay your split shares to this ID. We never ask for your UPI PIN.</p>
        </div>
        <div className="p-5 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[#0B1F3A] truncate">{userProfile?.upiId || 'No UPI ID yet'}</p>
            <p className="text-xs text-slate-500 mt-1">
              {userProfile?.upiStatus
                ? `Status: ${userProfile.upiStatus === 'SELF_CONFIRMED' ? 'Confirmed by you' : userProfile.upiStatus}`
                : 'Required after you join a book that uses Split.'}
            </p>
          </div>
          <button type="button" className="byjan-btn !h-10 shrink-0" onClick={() => setUpiOpen(true)}>
            {userProfile?.upiId ? 'Update UPI ID' : 'Add UPI ID'}
          </button>
        </div>
      </section>
      )}

      <section className="byjan-card overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 bg-[#F8FAFC]">
          <h2 className="text-base font-semibold text-slate-900">Regional</h2>
          <p className="text-xs text-slate-500 mt-1">Number and date formatting for Business, money books, search, and reports.</p>
        </div>
        <div className="p-5 grid md:grid-cols-2 gap-5">
          <Field label="Default currency" hint="Used when you create a new money book. Posted Business entries keep the company currency.">
            <Select value={prefs.defaultCurrency} onValueChange={(v) => setPref('defaultCurrency', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="INR">INR (₹)</SelectItem>
                <SelectItem value="USD">USD ($)</SelectItem>
                <SelectItem value="EUR">EUR (€)</SelectItem>
                <SelectItem value="GBP">GBP (£)</SelectItem>
                <SelectItem value="AUD">AUD (A$)</SelectItem>
                <SelectItem value="SGD">SGD (S$)</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Number format">
            <Select value={prefs.numberFormat} onValueChange={(v) => setPref('numberFormat', v as NumberLocale)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="en-IN">Indian grouping (12,34,567.00)</SelectItem>
                <SelectItem value="en-US">US grouping (1,234,567.00)</SelectItem>
                <SelectItem value="en-GB">UK grouping (1,234,567.00)</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Date format">
            <Select value={prefs.dateFormat} onValueChange={(v) => setPref('dateFormat', v as DateFormat)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="iso">ISO (2026-09-10)</SelectItem>
                <SelectItem value="dmy">DMY (10/09/2026)</SelectItem>
                <SelectItem value="mdy">MDY (09/10/2026)</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Week starts on">
            <Select value={String(prefs.weekStartsOn)} onValueChange={(v) => setPref('weekStartsOn', Number(v) as 0 | 1)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Monday</SelectItem>
                <SelectItem value="0">Sunday</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          {hasFeature('business') && (
          <Field label="Fiscal year start month" hint="Used when Books opens a new accounting period.">
            <Select value={String(prefs.fiscalYearStartMonth)} onValueChange={(v) => setPref('fiscalYearStartMonth', Number(v))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {['January','February','March','April','May','June','July','August','September','October','November','December'].map((name, i) => (
                  <SelectItem key={name} value={String(i + 1)}>{name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          )}
          {hasFeature('business') && (
          <Field label="Default payment terms (days)">
            <input
              className="byjan-input"
              type="number"
              min={0}
              max={365}
              value={prefs.defaultPaymentTermsDays}
              onChange={(e) => setPref('defaultPaymentTermsDays', Math.max(0, Number(e.target.value) || 0))}
            />
          </Field>
          )}
        </div>
      </section>

      <section className="byjan-card overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 bg-[#F8FAFC]">
          <h2 className="text-base font-semibold text-slate-900">Display</h2>
          <p className="text-xs text-slate-500 mt-1">These apply to the whole app immediately — Home, books, Help, and this screen.</p>
        </div>
        <div className="p-5 grid md:grid-cols-2 gap-5">
          <Field label="Density">
            <Select value={prefs.uiDensity} onValueChange={(v) => setPref('uiDensity', v as UiDensity)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="comfortable">Comfortable</SelectItem>
                <SelectItem value="compact">Compact</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Icon size" hint="Every Lucide icon in the app, including tabs and toolbars.">
            <Select value={prefs.iconSize} onValueChange={(v) => setPref('iconSize', v as AppPrefs['iconSize'])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="sm">Small</SelectItem>
                <SelectItem value="md">Medium</SelectItem>
                <SelectItem value="lg">Large</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Text size" hint="Scales type across Byjan, not only this page.">
            <Select value={prefs.fontSize} onValueChange={(v) => setPref('fontSize', v as AppPrefs['fontSize'])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="sm">Small</SelectItem>
                <SelectItem value="md">Medium</SelectItem>
                <SelectItem value="lg">Large</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Corner shape" hint="Cards, buttons, fields, and sheets.">
            <Select value={prefs.cornerRadius} onValueChange={(v) => setPref('cornerRadius', v as AppPrefs['cornerRadius'])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="sharp">Sharp</SelectItem>
                <SelectItem value="soft">Soft</SelectItem>
                <SelectItem value="round">Round</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Rows per list">
            <Select value={String(prefs.listPageSize)} onValueChange={(v) => setPref('listPageSize', Number(v) as ListPageSize)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="25">25</SelectItem>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          {hasFeature('business') && (
          <Field label="Default cash / bank posting">
            <Select value={prefs.defaultCashAccount} onValueChange={(v) => setPref('defaultCashAccount', v as AppPrefs['defaultCashAccount'])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="bank">Bank</SelectItem>
                <SelectItem value="cash">Cash</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          )}
          <div className="display-preview md:col-span-2">
            <SettingsIcon className="text-[#0B1F3A]" />
            <div>
              <strong>Live preview</strong>
              <span>Icons, type, and corners should change on this row and on every other screen.</span>
            </div>
            <button type="button" className="byjan-btn ml-auto">Sample</button>
          </div>
        </div>
        {hasFeature('business') && (
        <div className="px-5 pb-2">
          <Switch on={prefs.showAccountCodes} onChange={(v) => setPref('showAccountCodes', v)} label="Show account codes" hint="Chart, journals, and document account pickers include the code." />
          <Switch on={prefs.showZeroBalances} onChange={(v) => setPref('showZeroBalances', v)} label="Show zero-balance accounts" hint="Keep empty accounts visible on the chart and trial balance." />
          <Switch on={prefs.interstateDefault} onChange={(v) => setPref('interstateDefault', v)} label="Default new invoices to interstate GST" hint="IGST vs CGST/SGST. Still overridable per document." />
        </div>
        )}
      </section>

      {hasFeature('business') && (
      <section className="byjan-card overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 bg-[#F8FAFC]">
          <h2 className="text-base font-semibold text-slate-900">Posting and control</h2>
        </div>
        <div className="px-5">
          <Switch on={prefs.confirmPosting} onChange={(v) => setPref('confirmPosting', v)} label="Confirm before posting" hint="Ask before journals, invoices, bills, transfers, and recurring runs hit the ledger." />
          <Switch on={prefs.confirmDeletes} onChange={(v) => setPref('confirmDeletes', v)} label="Confirm before void / reverse" hint="Ask before voiding a document or reversing a journal." />
          <Switch on={prefs.showToasts} onChange={(v) => setPref('showToasts', v)} label="Toast notifications" hint="Success toasts after saves. Errors always show." />
          <Switch on={prefs.autoRefreshBooks} onChange={(v) => setPref('autoRefreshBooks', v)} label="Refresh Books after each save" hint="Turn off to keep the current screen until you reload. Posted amounts still write." />
          <Switch on={prefs.roundHalfUp} onChange={(v) => setPref('roundHalfUp', v)} label="Round halves up" hint="Tax and money remain integer paise. This is the display rounding convention." />
          <Switch on={prefs.keyboardShortcuts} onChange={(v) => setPref('keyboardShortcuts', v)} label="Keyboard shortcuts" hint="Ctrl+K search and Ctrl+Shift+K command palette." />
        </div>
      </section>
      )}

      {hasFeature('business') && (
      <section className="byjan-card overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 bg-[#F8FAFC]">
          <h2 className="text-base font-semibold text-slate-900">Notifications and print</h2>
        </div>
        <div className="px-5">
          <Switch on={prefs.notifyOverdue} onChange={(v) => setPref('notifyOverdue', v)} label="Highlight overdue invoices" hint="Collections and statements flag past-due posted invoices." />
          <Switch on={prefs.notifyApprovals} onChange={(v) => setPref('notifyApprovals', v)} label="Surface pending approvals" hint="Control tower and dashboard include the approvals queue." />
          <Switch on={prefs.printShowLogo} onChange={(v) => setPref('printShowLogo', v)} label="Print workspace logo" hint="Invoices and bills include the Books logo when one is uploaded." />
          <Switch on={prefs.printShowGstin} onChange={(v) => setPref('printShowGstin', v)} label="Print GSTIN" hint="Show GSTIN on printable documents." />
        </div>
      </section>
      )}

      {hasFeature('money') && (
      <section className="byjan-card overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 bg-[#F8FAFC]">
          <h2 className="text-base font-semibold text-slate-900">Money book categories</h2>
          <p className="text-xs text-slate-500 mt-1">Saved on your account and shown when you add a record. Categories created inside one book stay on that book only.</p>
        </div>
        <div className="p-5">
          <div className="flex gap-2 mb-4">
            <input className="byjan-input" value={newCategory} onChange={(e) => setNewCategory(e.target.value)} placeholder="New category" />
            <button type="button" className="byjan-btn" onClick={handleAddCategory}>Add</button>
          </div>
          <div className="flex flex-wrap gap-2 min-h-[48px]">
            {categories.length === 0 && <p className="text-sm text-slate-500">No custom categories.</p>}
            {categories.map((cat) => (
              <span key={cat} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-white border border-slate-200">
                {cat}
                <button type="button" className="text-slate-400 hover:text-rose-500" onClick={() => setCategories(categories.filter((c) => c !== cat))}>×</button>
              </span>
            ))}
          </div>
        </div>
      </section>
      )}

      <section className="byjan-card overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 bg-[#F8FAFC]">
          <h2 className="text-base font-semibold text-slate-900">Security</h2>
          <p className="text-xs text-slate-500 mt-1">These controls are already enforced on this browser session.</p>
        </div>
        <div className="p-5 space-y-3 text-sm text-slate-600">
          <p>Idle sign-out after 30 minutes without activity. Maximum session length is 12 hours.</p>
          <p>Deleted entries leave your lists. Similar entries are checked before they are saved again.</p>
          <p>Use Sign out on your photo in the top-right.</p>
          {hasFeature('app_lock') && (
          <div className="pt-3 border-t border-slate-100 space-y-3">
            <p className="text-sm font-semibold text-[#0B1F3A]">App lock</p>
            <p className="text-xs text-slate-500">PIN is hashed on this device. Biometrics use the system prompt. We never store the PIN itself.</p>
            <input className="byjan-input" type="password" inputMode="numeric" maxLength={8} placeholder="New PIN (4–8 digits)" value={lockPin} onChange={(e) => setLockPinInput(e.target.value.replace(/\D/g, '').slice(0, 8))} />
            <input className="byjan-input" type="password" inputMode="numeric" maxLength={8} placeholder="Confirm PIN" value={lockPin2} onChange={(e) => setLockPin2(e.target.value.replace(/\D/g, '').slice(0, 8))} />
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={lockBio} onChange={(e) => setLockBio(e.target.checked)} />
              Prefer fingerprint / face when available
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                className="byjan-btn !h-10"
                onClick={() => {
                  if (lockPin !== lockPin2) { addToast('PINs do not match', 'error'); return; }
                  void setLockPin(userProfile?.uid || '', lockPin, lockBio)
                    .then(() => {
                      updateLockOptions({
                        biometric: lockBio,
                        autoLockMs: Number(lockAuto),
                        idleLockMs: Number(lockIdle),
                        shufflePad: lockShuffle,
                        bioFirst: lockBioFirst,
                        hideContent: lockHide,
                      });
                      setLockOn(true);
                      setLockPinInput('');
                      setLockPin2('');
                      addToast('App lock on', 'success');
                    })
                    .catch((err) => addToast(err instanceof Error ? err.message : 'Could not set PIN', 'error'));
                }}
              >
                {lockOn ? 'Update PIN' : 'Enable lock'}
              </button>
              {lockOn ? (
                <button type="button" className="byjan-btn-ghost !h-10" onClick={() => { disableLock(); setLockOn(false); addToast('App lock off', 'success'); }}>
                  Turn off
                </button>
              ) : null}
            </div>
            {lockOn ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3 space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Advanced</p>
                <Field label="Lock after leaving the app">
                  <Select value={lockAuto} onValueChange={(v) => { setLockAuto(v); try { updateLockOptions({ autoLockMs: Number(v) }); } catch { /* lock off */ } }}>
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">Immediately</SelectItem>
                      <SelectItem value="8000">After 8 seconds</SelectItem>
                      <SelectItem value="30000">After 30 seconds</SelectItem>
                      <SelectItem value="60000">After 1 minute</SelectItem>
                      <SelectItem value="300000">After 5 minutes</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Lock while idle in the app">
                  <Select value={lockIdle} onValueChange={(v) => { setLockIdle(v); try { updateLockOptions({ idleLockMs: Number(v) }); } catch { /* ignore */ } }}>
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">Off</SelectItem>
                      <SelectItem value="60000">After 1 minute idle</SelectItem>
                      <SelectItem value="180000">After 3 minutes idle</SelectItem>
                      <SelectItem value="300000">After 5 minutes idle</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Switch on={lockBioFirst} onChange={(v) => { setLockBioFirst(v); try { updateLockOptions({ bioFirst: v }); } catch { /* ignore */ } }} label="Offer fingerprint first" hint="Shows the system biometric prompt as soon as the lock screen opens." />
                <Switch on={lockShuffle} onChange={(v) => { setLockShuffle(v); try { updateLockOptions({ shufflePad: v }); } catch { /* ignore */ } }} label="Shuffle PIN pad" hint="Rearranges digits each time so shoulder-surfing is harder." />
                <Switch on={lockHide} onChange={(v) => { setLockHide(v); try { updateLockOptions({ hideContent: v }); } catch { /* ignore */ } }} label="Hide contents while locked" hint="Lock screen copy stays generic. Amounts stay behind the gate." />
              </div>
            ) : null}
            {lockOn && lockIsEnabledFor(userProfile?.uid || '') ? <p className="text-xs text-emerald-700">Lock is on for this account.</p> : null}
          </div>
          )}
          {hasFeature('app_notifications') && (
          <div className="pt-3 border-t border-slate-100">
            <p className="text-sm font-semibold text-[#0B1F3A]">Device alerts</p>
            <p className="text-xs text-slate-500 mt-1">Sends a real push to the Android token on this account. Nothing is faked.</p>
            <button
              type="button"
              className="byjan-btn-ghost !h-10 mt-2"
              disabled={pingBusy}
              onClick={() => {
                setPingBusy(true);
                void pingSelfNotification()
                  .then(() => addToast('Push sent — check this phone', 'success'))
                  .catch((err) => addToast(err instanceof Error ? err.message : 'Could not send push', 'error'))
                  .finally(() => setPingBusy(false));
              }}
            >
              <BellRing className="w-4 h-4" />
              {pingBusy ? 'Sending…' : 'Send test notification'}
            </button>
          </div>
          )}
        </div>
      </section>

      <div className="flex justify-end">
        <button type="submit" disabled={loading} className="byjan-btn">
          {loading && <span className="app-loader-ring app-loader-ring-sm" />}
          <Save className="w-4 h-4" />
          {loading ? 'Saving settings' : 'Save settings'}
        </button>
      </div>

      <UpiSetupSheet
        open={upiOpen}
        initialUpiId={userProfile?.upiId || ''}
        initialName={userProfile?.upiDisplayName || userProfile?.displayName || ''}
        onClose={() => setUpiOpen(false)}
        onSaved={() => void refreshUserProfile()}
        onToast={addToast}
      />
    </form>

    <section className="byjan-card p-4 space-y-4 border-rose-100">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-rose-400">Account</p>
        <h2 className="text-base font-semibold text-[#0B1F3A] mt-1">Deactivate or delete</h2>
        <p className="text-xs text-slate-500 mt-1 leading-relaxed">
          Deactivate keeps your books but blocks sign-in until you email byjanbooks@gmail.com.
          Delete removes this login, owned money books, and the Firebase account. Shared books you do not own stay with their owners.
        </p>
      </div>
      <label className="block">
        <span className="block text-sm font-medium text-slate-700 mb-1.5">Type DEACTIVATE or DELETE to confirm</span>
        <input
          className="w-full h-10 rounded-xl border border-slate-200 px-3 text-sm"
          value={confirmText}
          onChange={(event) => setConfirmText(event.target.value)}
          placeholder="DEACTIVATE or DELETE"
          autoComplete="off"
        />
      </label>
      <div className="flex flex-col sm:flex-row gap-2">
        <button
          type="button"
          className="byjan-btn-ghost !h-10 text-amber-800 border-amber-200"
          disabled={accountBusy !== 'off'}
          onClick={() => void handleDeactivate()}
        >
          <UserX className="w-4 h-4" />
          {accountBusy === 'deactivate' ? 'Deactivating…' : 'Deactivate account'}
        </button>
        <button
          type="button"
          className="byjan-btn-ghost !h-10 text-rose-700 border-rose-200"
          disabled={accountBusy !== 'off'}
          onClick={() => void handleDeleteAccount()}
        >
          <Trash2 className="w-4 h-4" />
          {accountBusy === 'delete' ? 'Deleting…' : 'Delete account'}
        </button>
      </div>
    </section>
    </div>
  );
}

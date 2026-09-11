import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useAppPrefs } from '../context/AppPrefsContext';
import { db } from '../lib/firebase';
import { doc, updateDoc } from '../lib/store';
import { Save, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/Select';
import { useBooksTenantMeta } from '../lib/tenant';
import type { AppPrefs, DateFormat, ListPageSize, NumberLocale, UiDensity } from '../lib/app-prefs';
import { useToast } from '../context/ToastContext';

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
  const { userProfile, refreshUserProfile } = useAuth();
  const tenant = useBooksTenantMeta();
  const { prefs, setPref, savePrefs } = useAppPrefs();
  const { addToast } = useToast();
  const [displayName, setDisplayName] = useState(userProfile?.displayName || '');
  const [categories, setCategories] = useState<string[]>(userProfile?.customCategories || []);
  const [newCategory, setNewCategory] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    setDisplayName(userProfile?.displayName || '');
    setCategories(userProfile?.customCategories || []);
  }, [userProfile?.displayName, userProfile?.customCategories]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userProfile) return;
    setLoading(true);
    setMessage('');
    setError('');
    try {
      const cleaned = [...new Set(categories.map((c) => c.trim()).filter(Boolean))];
      await savePrefs(prefs);
      await updateDoc(doc(db, 'users', userProfile.uid), {
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

  return (
    <form onSubmit={handleSave} className="max-w-5xl mx-auto space-y-6 pb-10">
      <div>
        <h1 className="font-display text-2xl font-semibold text-[#0B1F3A]">Settings</h1>
        <p className="text-sm text-slate-500 mt-1">These preferences apply to the dashboard, Expense Tracker, and Books — not just the screen you are on.</p>
      </div>

      {tenant && (
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="byjan-card p-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Account</p>
            <p className="text-sm font-semibold text-slate-900 mt-1">{userProfile?.email}</p>
            <p className="text-xs text-slate-500 mt-1">Signed-in identity for every module.</p>
          </div>
          <div className="byjan-card p-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Books workspace</p>
            <p className="text-sm font-semibold text-slate-900 mt-1">{tenant.name}</p>
            <p className="text-xs text-slate-500 mt-1">Company letterhead still lives in Books → Settings.</p>
          </div>
        </div>
      )}

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

      <section className="byjan-card overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 bg-[#F8FAFC]">
          <h2 className="text-base font-semibold text-slate-900">Regional</h2>
          <p className="text-xs text-slate-500 mt-1">Number and date formatting for Books, Expense Tracker, search, and reports.</p>
        </div>
        <div className="p-5 grid md:grid-cols-2 gap-5">
          <Field label="Default currency" hint="Used for new expense ledgers. Posted Books journals keep the workspace base currency.">
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
        </div>
      </section>

      <section className="byjan-card overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 bg-[#F8FAFC]">
          <h2 className="text-base font-semibold text-slate-900">Display</h2>
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
          <Field label="Default cash / bank posting">
            <Select value={prefs.defaultCashAccount} onValueChange={(v) => setPref('defaultCashAccount', v as AppPrefs['defaultCashAccount'])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="bank">Bank</SelectItem>
                <SelectItem value="cash">Cash</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </div>
        <div className="px-5 pb-2">
          <Switch on={prefs.showAccountCodes} onChange={(v) => setPref('showAccountCodes', v)} label="Show account codes" hint="Chart, journals, and document account pickers include the code." />
          <Switch on={prefs.showZeroBalances} onChange={(v) => setPref('showZeroBalances', v)} label="Show zero-balance accounts" hint="Keep empty accounts visible on the chart and trial balance." />
          <Switch on={prefs.interstateDefault} onChange={(v) => setPref('interstateDefault', v)} label="Default new invoices to interstate GST" hint="IGST vs CGST/SGST. Still overridable per document." />
        </div>
      </section>

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

      <section className="byjan-card overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 bg-[#F8FAFC]">
          <h2 className="text-base font-semibold text-slate-900">Expense Tracker categories</h2>
          <p className="text-xs text-slate-500 mt-1">Saved on your account and shown in every ledger’s entry dropdown. Categories created inside one ledger stay on that ledger only.</p>
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

      <div className="flex justify-end">
        <button type="submit" disabled={loading} className="byjan-btn">
          <Save className="w-4 h-4" />
          {loading ? 'Saving…' : 'Save settings'}
        </button>
      </div>
    </form>
  );
}

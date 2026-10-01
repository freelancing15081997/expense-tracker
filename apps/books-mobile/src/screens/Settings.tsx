import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { CreditCard, Gauge, Sparkles, Bell, Lock, LogOut, Trash2, HelpCircle, Shield, ChevronRight, AtSign, User as UserIcon, ShieldCheck, Coins } from 'lucide-react';
import { Preferences } from '@capacitor/preferences';
import { App as CapApp } from '@capacitor/app';
import { useSession } from '../lib/session';
import { logout } from '../lib/firebase';
import { saveMyUpi } from '../lib/money';
import { acceptInvite } from '../lib/books';
import { apiPost } from '../lib/api';
import { AppBar, Avatar, Field, Toggle, Seg, useConfirm, useToast } from '../ui';
import { Press, Sheet, Stagger, Item, MeterBar, SuccessMark, BrandLoader as BrandLoaderInline, motion } from '../motion';
import { meterLabel, type MeterKey } from '../lib/saas';
import { fail, tick } from '../lib/haptics';

const VERSION = '2.0.0';

export function Settings() {
  const s = useSession(); const nav = useNavigate(); const toast = useToast(); const confirm = useConfirm();
  const [edit, setEdit] = useState<'name' | 'upi' | 'pin' | null>(null);
  const [name, setName] = useState(s.me?.displayName || '');
  const [upi, setUpi] = useState(s.me?.upiId || ''); const [upiName, setUpiName] = useState(s.me?.upiDisplayName || '');
  const [err, setErr] = useState('');
  const [lockOn, setLockOn] = useState(false);
  const prefs = (s.me?.appPrefs || {}) as { pushOn?: boolean; emailOn?: boolean; currency?: string };
  useEffect(() => { void Preferences.get({ key: 'byjan.pin' }).then((r) => setLockOn(!!r.value)); }, []);
  const statusLabel = s.sub?.status === 'trialing' ? `Trial · ends ${s.sub.trialEndsAt?.slice(0, 10)}` : s.sub?.status === 'past_due' ? 'Payment due' : s.sub?.status === 'active' ? `Renews ${s.sub.currentPeriodEnd?.slice(0, 10)}` : 'Free plan';
  const savePref = (patch: Record<string, unknown>) => s.saveMe({ appPrefs: { ...prefs, ...patch } }).catch((e) => toast({ text: e.message, tone: 'error' }));

  return (
    <div className="screen">
      <AppBar title="More" rule />
      <Stagger>
        <Item className="list-row" onClick={() => { setName(s.me?.displayName || ''); setEdit('name'); }} style={{ minHeight: 76 }}>
          <Avatar name={s.me?.displayName || s.user?.email || ''} src={s.user?.photoURL || undefined} size={48} />
          <div className="grow"><p className="t" style={{ fontSize: 17 }}>{s.me?.displayName || 'Add your name'}</p><p className="s">{s.user?.email}</p></div>
          {s.isOwner && <span className="badge ink">Owner</span>}<ChevronRight size={18} color="var(--faint)" />
        </Item>

        <Item><div className="h-section">Plan</div></Item>
        <Item className="list">
          <div className="list-row" onClick={() => nav('/billing')}><CreditCard size={20} /><div className="grow"><p className="t">{s.plan?.name || 'Free'}</p><p className="s">{statusLabel}</p></div>{s.sub?.status === 'past_due' && <span className="badge red">Pay now</span>}<ChevronRight size={18} color="var(--faint)" /></div>
          <div className="list-row" onClick={() => nav('/usage')}><Gauge size={20} /><div className="grow"><p className="t">Usage this month</p><UsageMini /></div><ChevronRight size={18} color="var(--faint)" /></div>
          <div className="list-row" onClick={() => nav('/plans')}><Sparkles size={20} /><div className="grow"><p className="t">Plans & offers</p>{s.offers[0] && <p className="s" style={{ color: 'var(--teal-700)' }}>{s.offers[0].title}</p>}</div><ChevronRight size={18} color="var(--faint)" /></div>
        </Item>

        <Item><div className="h-section">Payments</div></Item>
        <Item className="list">
          <div className="list-row" onClick={() => { setUpi(s.me?.upiId || ''); setUpiName(s.me?.upiDisplayName || ''); setErr(''); setEdit('upi'); }}><AtSign size={20} /><div className="grow"><p className="t">My UPI ID</p><p className="s mono">{s.me?.upiId || 'Add so people can pay you back'}</p></div><ChevronRight size={18} color="var(--faint)" /></div>
          <div className="list-row" style={{ cursor: 'default' }}><Coins size={20} /><div className="grow"><p className="t">Default currency</p></div>
            <div style={{ width: 170 }}><Seg id="defcur" value={prefs.currency || s.me?.defaultCurrency || 'INR'} onChange={(v) => { void savePref({ currency: v }); void s.saveMe({ defaultCurrency: v }); }} options={[{ value: 'INR', label: '₹' }, { value: 'USD', label: '$' }, { value: 'AED', label: 'AED' }]} /></div></div>
        </Item>

        <Item><div className="h-section">App</div></Item>
        <Item className="list" style={{ padding: '0 16px' }}>
          {s.can('app_notifications_push') && <Toggle on={prefs.pushOn !== false} onChange={(v) => savePref({ pushOn: v })} label={<span className="row" style={{ gap: 8 }}><Bell size={18} />Push alerts</span>} hint="When someone adds, edits or settles" />}
          {s.can('app_notifications_email') && <Toggle on={prefs.emailOn !== false} onChange={(v) => savePref({ emailOn: v })} label={<span className="row" style={{ gap: 8 }}><Bell size={18} />Email alerts</span>} />}
          {s.can('app_lock') && <Toggle on={lockOn} onChange={async (v) => { if (v) setEdit('pin'); else { await Preferences.remove({ key: 'byjan.pin' }); setLockOn(false); toast({ text: 'App lock off' }); } }} label={<span className="row" style={{ gap: 8 }}><Lock size={18} />App lock</span>} hint="Ask for a PIN when Byjan opens" />}
        </Item>

        {s.isOwner && (
          <>
            <Item><div className="h-section">Byjan owner</div></Item>
            <Item className="list"><div className="list-row" onClick={() => nav('/owner')}><ShieldCheck size={20} color="var(--teal-700)" /><div className="grow"><p className="t">Owner console</p><p className="s">Users, access, plans, offers, usage, payments</p></div><ChevronRight size={18} color="var(--faint)" /></div></Item>
          </>
        )}

        <Item><div className="h-section">Help</div></Item>
        <Item className="list">
          <a className="list-row" href="mailto:byjanbooks@gmail.com?subject=Byjan%20help" style={{ color: 'inherit' }}><HelpCircle size={20} /><span className="t grow">Contact support</span></a>
          <a className="list-row" href="https://www.easypado.com/privacy.html" target="_blank" rel="noreferrer" style={{ color: 'inherit' }}><Shield size={20} /><span className="t grow">Privacy policy</span></a>
          <div className="list-row" onClick={async () => { const { ok } = await confirm({ title: 'Sign out?', confirm: 'Sign out' }); if (ok) await logout(); }}><LogOut size={20} /><span className="t grow">Sign out</span></div>
          <div className="list-row" onClick={async () => {
            const { ok, reason } = await confirm({ title: 'Delete your account?', body: 'Your books, entries and receipts are permanently removed after 30 days. Active subscriptions are cancelled. This can’t be undone.', confirm: 'Delete account', danger: true, reason: true, reasonLabel: 'Why are you leaving?' });
            if (!ok) return;
            try { await apiPost('/api/me', { op: 'deleteAccount', reason }); toast({ text: 'Account scheduled for deletion' }); await logout(); } catch (e) { toast({ text: (e as Error).message, tone: 'error' }); }
          }} style={{ color: 'var(--red-700)' }}><Trash2 size={20} /><span className="t grow">Delete account</span></div>
        </Item>
        <Item><p className="hint pad" style={{ padding: 16 }}>Byjan {VERSION}</p></Item>
      </Stagger>

      <Sheet open={edit === 'name'} onClose={() => setEdit(null)} title="Your name" footer={<Press className="btn btn-primary btn-block" onClick={async () => { if (!name.trim()) return; await s.saveMe({ displayName: name.trim() }); setEdit(null); toast({ text: 'Saved' }); }}>Save</Press>}>
        <Field label={<><UserIcon size={14} />Name people see in shared books</>}><input className="input" value={name} onChange={(e) => setName(e.target.value)} autoFocus /></Field>
      </Sheet>
      <Sheet open={edit === 'upi'} onClose={() => setEdit(null)} title="My UPI ID" footer={<Press className="btn btn-primary btn-block" onClick={async () => {
        if (!/^[a-z0-9._-]{2,64}@[a-z]{2,32}$/i.test(upi.trim())) { setErr('UPI ID looks like name@bank'); return; }
        try { await saveMyUpi(upi.trim().toLowerCase(), upiName.trim()); await s.refreshMe(); setEdit(null); toast({ text: 'UPI ID saved' }); } catch (e) { setErr((e as Error).message); }
      }}>Save</Press>}>
        <Field label="UPI ID" error={err} hint="Only people in your books can see it, to pay you back."><input className={`input mono ${err ? 'bad' : ''}`} value={upi} autoCapitalize="off" placeholder="name@okaxis" onChange={(e) => { setUpi(e.target.value); setErr(''); }} /></Field>
        <Field label="Name on UPI" optional><input className="input" value={upiName} onChange={(e) => setUpiName(e.target.value)} /></Field>
        <p className="hint">By saving you confirm this UPI ID belongs to you.</p>
      </Sheet>
      <PinSetup open={edit === 'pin'} onClose={() => setEdit(null)} onDone={() => { setLockOn(true); setEdit(null); toast({ text: 'App lock on' }); }} />
    </div>
  );
}

function UsageMini() {
  const s = useSession();
  const m = s.usage?.meters?.receipt_scans;
  if (!m || m.limit < 0) return <p className="s">Unlimited on your plan</p>;
  return <div style={{ marginTop: 6 }}><MeterBar pct={m.used / Math.max(1, m.limit + m.extra)} height={4} /><p className="s" style={{ marginTop: 4 }}>{meterLabel('receipt_scans' as MeterKey)}: {m.used} of {m.limit + m.extra}</p></div>;
}

async function hash(pin: string) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`byjan:${pin}`));
  return Array.from(new Uint8Array(b)).map((x) => x.toString(16).padStart(2, '0')).join('');
}

function PinPad({ value, onChange, error }: { value: string; onChange: (v: string) => void; error?: boolean }) {
  return (
    <div className="stack" style={{ alignItems: 'center', gap: 22 }}>
      <motion.div className="row" style={{ gap: 14 }} animate={error ? { x: [0, -10, 10, -6, 6, 0] } : {}} transition={{ duration: 0.35 }}>
        {[0, 1, 2, 3].map((i) => <motion.span key={i} animate={{ scale: value.length > i ? 1.15 : 1, background: value.length > i ? 'var(--teal-700)' : 'var(--line-2)' }} style={{ width: 14, height: 14, borderRadius: 7 }} />)}
      </motion.div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 72px)', gap: 12 }}>
        {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'].map((k) => k ? (
          <Press key={k} className="btn btn-secondary" style={{ height: 64, justifyContent: 'center', font: '500 22px var(--font)' }} onClick={() => { tick(); onChange(k === '⌫' ? value.slice(0, -1) : (value + k).slice(0, 4)); }}>{k}</Press>
        ) : <span key="blank" />)}
      </div>
    </div>
  );
}

function PinSetup({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const [a, setA] = useState(''); const [b, setB] = useState(''); const [stage, setStage] = useState<1 | 2>(1); const [bad, setBad] = useState(false);
  useEffect(() => { if (open) { setA(''); setB(''); setStage(1); } }, [open]);
  useEffect(() => { if (stage === 1 && a.length === 4) setTimeout(() => setStage(2), 150); }, [a]);
  useEffect(() => {
    if (stage !== 2 || b.length !== 4) return;
    if (a !== b) { fail(); setBad(true); setTimeout(() => { setBad(false); setB(''); }, 400); return; }
    void hash(a).then((h) => Preferences.set({ key: 'byjan.pin', value: h })).then(onDone);
  }, [b]);
  return (
    <Sheet open={open} onClose={onClose} title={stage === 1 ? 'Choose a 4-digit PIN' : 'Enter it again'}>
      <PinPad value={stage === 1 ? a : b} onChange={stage === 1 ? setA : setB} error={bad} />
    </Sheet>
  );
}

/** Locks the app on open and after 60s in the background. */
export function AppLockGate({ children }: { children: React.ReactNode }) {
  const [locked, setLocked] = useState<boolean | null>(null);
  const [pin, setPin] = useState(''); const [bad, setBad] = useState(false); const [tries, setTries] = useState(0);
  const away = useRef(0);
  useEffect(() => {
    void Preferences.get({ key: 'byjan.pin' }).then((r) => setLocked(!!r.value));
    const h = CapApp.addListener('appStateChange', async (st) => {
      if (!st.isActive) { away.current = Date.now(); return; }
      const r = await Preferences.get({ key: 'byjan.pin' });
      if (r.value && away.current && Date.now() - away.current > 60_000) setLocked(true);
    });
    return () => { void h.then((x) => x.remove()); };
  }, []);
  useEffect(() => {
    if (pin.length !== 4) return;
    void (async () => {
      const r = await Preferences.get({ key: 'byjan.pin' });
      if (r.value === (await hash(pin))) { setLocked(false); setPin(''); setTries(0); }
      else { fail(); setBad(true); setTries((t) => t + 1); setTimeout(() => { setBad(false); setPin(''); }, 400); }
    })();
  }, [pin]);
  if (locked === null) return null;
  if (!locked) return <>{children}</>;
  return (
    <div className="screen no-nav" style={{ justifyContent: 'center', alignItems: 'center', gap: 28 }}>
      <img src="/brand/byjan-mark.svg" alt="" width={56} height={56} />
      <p style={{ font: '600 18px var(--font)' }}>Enter your PIN</p>
      <PinPad value={pin} onChange={setPin} error={bad} />
      {tries >= 3 && <button className="btn btn-ghost" onClick={async () => { await Preferences.remove({ key: 'byjan.pin' }); await logout(); }}>Forgot PIN? Sign out</button>}
    </div>
  );
}

export function InviteAccept() {
  const { code = '' } = useParams(); const nav = useNavigate();
  const [state, setState] = useState<'busy' | 'ok' | 'fail'>('busy'); const [msg, setMsg] = useState('');
  useEffect(() => {
    void acceptInvite(code).then((r) => { setState('ok'); setTimeout(() => nav(r.bookId ? `/book/${r.bookId}` : '/', { replace: true }), 1100); })
      .catch((e) => { setState('fail'); setMsg((e as Error).message); });
  }, [code]);
  return (
    <div className="screen no-nav" style={{ justifyContent: 'center', alignItems: 'center', gap: 16, padding: 24 }}>
      {state === 'busy' && <BrandLoaderInline label="Joining the book…" />}
      {state === 'ok' && <><SuccessMark confettiOn /><p style={{ font: '600 18px var(--font)' }}>You’re in</p></>}
      {state === 'fail' && <><p style={{ font: '600 18px var(--font)' }}>This invite can’t be used</p><p className="hint">{msg || 'It may have expired. Ask for a new link.'}</p><Press className="btn btn-secondary" onClick={() => nav('/')}>Go to Home</Press></>}
    </div>
  );
}

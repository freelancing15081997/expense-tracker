import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Mail, Lock, User as UserIcon, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence, Press, Stagger, Item } from '../motion';
import { Field, Logo, Mark, useToast } from '../ui';
import { signInEmail, registerEmail, resetPassword, signInGoogle, resendVerification, reloadUser, logout } from '../lib/firebase';
import { useSession } from '../lib/session';

const SLIDES = [
  { k: 'SHARE ANY RECEIPT', t: 'Share a UPI screenshot. Every field fills itself.', b: 'PhonePe, Google Pay, Paytm, bank SMS, PDFs, photos — share to Byjan and the amount, date, payee, UPI ref and category are filled in.' },
  { k: 'BOOKS FOR EVERYTHING', t: 'One book per trip, home, shop or event.', b: 'Invite people, split spends and settle up over UPI without leaving the app.' },
  { k: 'ALWAYS IN ORDER', t: 'Reports that explain your money.', b: 'Where it went, who paid, what’s pending — and a clean PDF whenever you need it.' },
];

export function Welcome() {
  const [i, setI] = useState(0);
  const nav = useNavigate();
  return (
    <div className="screen no-nav" style={{ background: 'var(--navy)', color: '#fff', padding: 'calc(20px + var(--safe-t)) 20px calc(24px + var(--safe-b))', gap: 20 }}>
      <Logo white height={28} />
      <div className="grow" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', minHeight: 360 }}>
        <motion.div initial={{ scale: 0.6, opacity: 0, rotate: -12 }} animate={{ scale: 1, opacity: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 200, damping: 16 }} style={{ marginBottom: 28 }}>
          <Mark white size={72} />
        </motion.div>
        <AnimatePresence mode="wait">
          <motion.div key={i} initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }} transition={{ duration: 0.3 }}
            drag="x" dragConstraints={{ left: 0, right: 0 }} onDragEnd={(_, info) => { if (info.offset.x < -60) setI((x) => Math.min(SLIDES.length - 1, x + 1)); if (info.offset.x > 60) setI((x) => Math.max(0, x - 1)); }}>
            <p className="kicker" style={{ color: '#5EEAD4' }}>{SLIDES[i].k}</p>
            <h1 style={{ marginTop: 12, font: '600 30px/1.12 var(--font)', letterSpacing: '-.02em' }}>{SLIDES[i].t}</h1>
            <p style={{ marginTop: 12, color: 'rgba(255,255,255,.78)', fontSize: 15.5 }}>{SLIDES[i].b}</p>
          </motion.div>
        </AnimatePresence>
        <div className="row" style={{ marginTop: 22, gap: 6 }}>
          {SLIDES.map((_, j) => <motion.span key={j} onClick={() => setI(j)} animate={{ width: j === i ? 26 : 8, background: j === i ? '#12B8A8' : 'rgba(255,255,255,.3)' }} style={{ height: 8, borderRadius: 4, cursor: 'pointer' }} />)}
        </div>
      </div>
      <div className="stack" style={{ gap: 10 }}>
        <Press className="btn btn-primary btn-block" style={{ background: 'var(--teal)', color: 'var(--navy)', fontWeight: 600 }} onClick={() => nav('/signup')}>Create free account<ArrowRight size={18} className="btn-trail" /></Press>
        <Press className="btn btn-block" style={{ border: '1px solid rgba(255,255,255,.3)', color: '#fff' }} onClick={() => nav('/signin')}>I already have an account</Press>
      </div>
    </div>
  );
}

function GoogleButton() {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  return (
    <Press className="btn btn-secondary btn-block" disabled={busy} onClick={async () => { setBusy(true); try { await signInGoogle(); } catch (e) { toast({ text: (e as Error).message, tone: 'error' }); } finally { setBusy(false); } }}>
      <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="" width={18} height={18} />{busy ? 'Opening Google…' : 'Continue with Google'}
    </Press>
  );
}

function AuthFrame({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <div className="screen no-nav" style={{ padding: 'calc(20px + var(--safe-t)) 20px calc(24px + var(--safe-b))' }}>
      <Link to="/welcome"><Logo height={24} /></Link>
      <div style={{ marginTop: 36, paddingBottom: 18, borderBottom: '2px solid var(--ink)' }}>
        <h1 className="h-display">{title}</h1>
        {sub && <p style={{ marginTop: 8, color: 'var(--ink-2)' }}>{sub}</p>}
      </div>
      <Stagger className="stack" style={{ marginTop: 20, gap: 16 }}>{children}</Stagger>
    </div>
  );
}

const emailOk = (e: string) => /^\S+@\S+\.\S+$/.test(e.trim());

export function SignIn() {
  const [email, setEmail] = useState(''); const [pw, setPw] = useState('');
  const [err, setErr] = useState<{ email?: string; pw?: string; form?: string }>({});
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const x: typeof err = {};
    if (!emailOk(email)) x.email = 'Enter a valid email';
    if (!pw) x.pw = 'Enter your password';
    setErr(x); if (Object.keys(x).length) return;
    setBusy(true);
    try { await signInEmail(email, pw); } catch (e2) { setErr({ form: (e2 as Error).message }); } finally { setBusy(false); }
  };
  return (
    <AuthFrame title="Welcome back" sub="Sign in to your money books.">
      <Item><GoogleButton /></Item>
      <Item><div className="row hint"><span className="grow" style={{ height: 1, background: 'var(--line)' }} />or with email<span className="grow" style={{ height: 1, background: 'var(--line)' }} /></div></Item>
      <form onSubmit={submit} className="stack" style={{ gap: 14 }}>
        {err.form && <div role="alert" className="banner warning" style={{ borderRadius: 8 }}>{err.form}</div>}
        <Item><Field label={<><Mail size={14} />Email</>} error={err.email}><input className={`input ${err.email ? 'bad' : ''}`} type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Field></Item>
        <Item><Field label={<><Lock size={14} />Password</>} error={err.pw}><input className={`input ${err.pw ? 'bad' : ''}`} type="password" autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} /></Field></Item>
        <Item><Press type="submit" className="btn btn-primary btn-block" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}<ArrowRight size={18} className="btn-trail" /></Press></Item>
      </form>
      <Item><div className="row" style={{ justifyContent: 'space-between' }}><Link to="/forgot">Forgot password?</Link><Link to="/signup">Create account</Link></div></Item>
    </AuthFrame>
  );
}

export function SignUp() {
  const [name, setName] = useState(''); const [email, setEmail] = useState(''); const [pw, setPw] = useState(''); const [agree, setAgree] = useState(false);
  const [err, setErr] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const x: Record<string, string> = {};
    if (!name.trim()) x.name = 'Enter your name';
    if (!emailOk(email)) x.email = 'Enter a valid email';
    if (pw.length < 8) x.pw = 'Use at least 8 characters';
    if (!agree) x.agree = 'Accept the terms to continue';
    setErr(x); if (Object.keys(x).length) return;
    setBusy(true);
    try { await registerEmail(name, email, pw); } catch (e2) { setErr({ form: (e2 as Error).message }); } finally { setBusy(false); }
  };
  return (
    <AuthFrame title="Create your account" sub="Free forever plan. Upgrade only if you need more.">
      <Item><GoogleButton /></Item>
      <form onSubmit={submit} className="stack" style={{ gap: 14 }}>
        {err.form && <div role="alert" className="banner warning" style={{ borderRadius: 8 }}>{err.form}</div>}
        <Item><Field label={<><UserIcon size={14} />Full name</>} error={err.name}><input className={`input ${err.name ? 'bad' : ''}`} autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} /></Field></Item>
        <Item><Field label={<><Mail size={14} />Email</>} error={err.email}><input className={`input ${err.email ? 'bad' : ''}`} type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Field></Item>
        <Item><Field label={<><Lock size={14} />Password</>} error={err.pw} hint="At least 8 characters"><input className={`input ${err.pw ? 'bad' : ''}`} type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} /></Field></Item>
        <Item>
          <label className="row" style={{ alignItems: 'flex-start' }}><input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} style={{ width: 20, height: 20, accentColor: 'var(--teal-700)', marginTop: 1 }} />
            <span className="hint" style={{ fontSize: 13.5 }}>I agree to the <a href="https://www.easypado.com/privacy.html" target="_blank" rel="noreferrer">privacy policy</a> and terms.</span></label>
          {err.agree && <span className="err">{err.agree}</span>}
        </Item>
        <Item><Press type="submit" className="btn btn-primary btn-block" disabled={busy}>{busy ? 'Creating…' : 'Create account'}<ArrowRight size={18} className="btn-trail" /></Press></Item>
      </form>
      <Item><Link to="/signin">I already have an account</Link></Item>
    </AuthFrame>
  );
}

export function Forgot() {
  const [email, setEmail] = useState(''); const [sent, setSent] = useState(false); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  return (
    <AuthFrame title="Reset password" sub={sent ? `We sent a reset link to ${email}. Check spam too.` : 'We’ll email you a link to set a new password.'}>
      {!sent ? (
        <form className="stack" style={{ gap: 14 }} onSubmit={async (e) => {
          e.preventDefault(); if (!emailOk(email)) { setErr('Enter a valid email'); return; }
          setBusy(true); try { await resetPassword(email); setSent(true); } catch (e2) { setErr((e2 as Error).message); } finally { setBusy(false); }
        }}>
          <Item><Field label="Email" error={err}><input className={`input ${err ? 'bad' : ''}`} type="email" value={email} onChange={(e) => { setEmail(e.target.value); setErr(''); }} /></Field></Item>
          <Item><Press type="submit" className="btn btn-primary btn-block" disabled={busy}>{busy ? 'Sending…' : 'Send reset link'}</Press></Item>
        </form>
      ) : <Item><Link to="/signin" className="btn btn-secondary btn-block">Back to sign in</Link></Item>}
    </AuthFrame>
  );
}

export function VerifyEmail() {
  const { user } = useSession();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [cool, setCool] = useState(0);
  return (
    <AuthFrame title="Check your email" sub={`Open the link we sent to ${user?.email}. Then come back here.`}>
      <Item><Press className="btn btn-primary btn-block" disabled={busy} onClick={async () => {
        setBusy(true);
        try { const u = await reloadUser(); if (u?.emailVerified) window.location.replace('/'); else toast({ text: 'Not verified yet — tap the link in the email first.' }); } finally { setBusy(false); }
      }}>{busy ? 'Checking…' : 'I’ve verified my email'}</Press></Item>
      <Item><Press className="btn btn-secondary btn-block" disabled={cool > 0} onClick={async () => {
        await resendVerification(); toast({ text: 'Sent again' }); setCool(30);
        const t = setInterval(() => setCool((c) => { if (c <= 1) { clearInterval(t); return 0; } return c - 1; }), 1000);
      }}>{cool ? `Resend in ${cool}s` : 'Resend email'}</Press></Item>
      <Item><button className="btn btn-ghost" onClick={() => void logout()}>Use a different account</button></Item>
    </AuthFrame>
  );
}

export function useReturnTo() {
  const loc = useLocation() as { state?: { returnTo?: string } };
  return loc.state?.returnTo || '/';
}

import React from 'react';
import { css } from '../ui/css.js';
import Hx from '../ui/Hx.jsx';
import * as auth from './authApi.js';
import ByjanMark from '../brand/ByjanMark.jsx';

const PH = 'https://unpkg.com/@phosphor-icons/core@2.1.1/assets/';
const Ic = ({ n, s = 16, c = 'currentColor' }) => <span style={{ flex: 'none', width: s, height: s, background: c, WebkitMask: `url(${PH + n}) center/contain no-repeat`, mask: `url(${PH + n}) center/contain no-repeat` }} />;
const H2 = ({ children }) => <h2 style={css("font:650 28px/1.15 'Geist';letter-spacing:-.03em")}>{children}</h2>;
const Sub = ({ children }) => <p style={css("margin-top:8px;font:450 14px/1.5 'Geist';color:#667085;text-wrap:pretty")}>{children}</p>;
const Label = ({ children, mt = 20 }) => <label style={css(`display:block;margin-top:${mt}px;font:600 12.5px 'Geist';color:#344054`)}>{children}</label>;
const Err = ({ t }) => t ? <p role="alert" style={css("margin-top:12px;padding:10px 12px;border-radius:10px;background:#FEF3F2;color:#B42318;font:500 13px/1.4 'Geist'")}>{t}</p> : null;
const Badge = ({ ic, bg = '#D5F5EC', fg = '#0F7A60' }) => <span style={css(`width:48px;height:48px;border-radius:14px;background:${bg};color:${fg};display:grid;place-items:center`)}><Ic n={ic} s={24} /></span>;
const BackLink = ({ onClick, children = '← Back' }) => <button type="button" onClick={onClick} style={css("border:0;background:transparent;cursor:pointer;padding:0;font:600 13px 'Geist';color:#475467")}>{children}</button>;
const inputS = "margin-top:6px;width:100%;height:48px;border-radius:12px;background:#fff;border:1px solid #D0D5DD;padding:0 14px;font:500 15px 'Geist';color:#0A1020";
const Spinner = () => <span style={css("width:16px;height:16px;border-radius:50%;border:2px solid rgba(255,255,255,.4);border-top-color:#fff;animation:spin .7s linear infinite")} />;

function Cta({ children, busy, ok = true, onClick, type = 'submit', mt = 20 }) {
  return (
    <Hx as="button" type={type} onClick={onClick} disabled={busy}
      s={`margin-top:${mt}px;width:100%;height:48px;border:0;border-radius:12px;cursor:pointer;background:linear-gradient(180deg,#1fc39b,#17b18c);color:#fff;font:650 14.5px 'Geist';box-shadow:inset 0 1px 0 rgba(255,255,255,.3),0 10px 20px -12px rgba(23,177,140,.9);display:flex;align-items:center;justify-content:center;gap:10px;opacity:${ok && !busy ? 1 : .55}`}
      h="filter:brightness(1.04)" a="filter:brightness(.94)">
      {busy ? <Spinner /> : null}{children}
    </Hx>
  );
}
function Ghost({ children, onClick, mt = 0 }) {
  return <Hx as="button" type="button" onClick={onClick} s={`margin-top:${mt}px;width:100%;height:48px;border-radius:12px;cursor:pointer;background:#fff;border:1px solid #D0D5DD;font:600 14px 'Geist';color:#344054;display:flex;align-items:center;justify-content:center;gap:10px`} h="background:#F9FAFB" a="background:#F2F4F7">{children}</Hx>;
}

const pwScore = p => !p ? 0 : p.length < 8 ? 1 : Math.min(4, 1 + (/[0-9]/.test(p) ? 1 : 0) + (/[^A-Za-z0-9]/.test(p) ? 1 : 0) + (/[A-Z]/.test(p) && /[a-z]/.test(p) ? 1 : 0));
const Or = () => <div style={css("margin:22px 0;display:flex;align-items:center;gap:12px;font:500 12px 'Geist';color:#98A2B3")}><span style={css("flex:1;height:1px;background:#EAECF0")} />or<span style={css("flex:1;height:1px;background:#EAECF0")} /></div>;
function PwField({ v, show, ac, ph, onChange, onToggle }) {
  return (
    <div style={css("margin-top:6px;display:flex;align-items:center;height:48px;border-radius:12px;background:#fff;border:1px solid #D0D5DD")}>
      <input type={show ? 'text' : 'password'} autoComplete={ac} value={v} onChange={e => onChange(e.target.value)} placeholder={ph} aria-label="Password"
        style={css("flex:1;min-width:0;height:100%;border:0 !important;box-shadow:none !important;background:transparent;padding:0 14px;font:500 15px 'Geist'")} />
      <button type="button" onClick={onToggle} style={css("border:0;background:transparent;cursor:pointer;padding:0 14px;font:600 12.5px 'Geist';color:#475467")}>{show ? 'Hide' : 'Show'}</button>
    </div>
  );
}
const OUT = {
  manual: ['You’re signed out', 'We cleared this browser’s session. Your other devices stay signed in.', 'duotone/sign-out-duotone.svg', '#D5F5EC', '#0F7A60'],
  manualAll: ['You’re signed out', 'You’re signed out here and on your other devices. We cleared this browser’s session.', 'duotone/sign-out-duotone.svg', '#D5F5EC', '#0F7A60'],
  expired: ['Session expired', 'You were signed out after a while without activity. Your drafts are saved and will be there when you sign back in.', 'duotone/clock-countdown-duotone.svg', '#FEF0C7', '#B54708'],
  revoked: ['You’ve been signed out', 'Your session was ended from another device or by an admin. Sign in again to continue.', 'duotone/shield-warning-duotone.svg', '#FEF0C7', '#B54708'],
  reused: ['Signed out for safety', 'We noticed your sign-in being used from somewhere unexpected, so we signed you out everywhere. Sign in again and consider changing your password.', 'duotone/shield-warning-duotone.svg', '#FEE4E2', '#B42318'],
  other: ['You’re signed out', 'You signed out in another tab.', 'duotone/sign-out-duotone.svg', '#D5F5EC', '#0F7A60'],
};

export default class AuthScreens extends React.Component {
  state = { screen: this.props.reason ? 'out' : 'signin', name: '', email: '', pw: '', showPw: false, agree: false, mfa: '', recovery: false, trust: true, challengeId: null, err: '', busy: false };
  go = (screen, o) => this.setState({ screen, err: '', busy: false, ...(o || {}) });
  run = async (fn) => { if (this.state.busy) return; this.setState({ busy: true, err: '' }); try { await fn(); } catch (e) { this.setState({ err: e.message || 'Something went wrong. Try again.' }); } finally { if (this._mounted !== false) this.setState({ busy: false }); } };
  done = (r) => { if (r.mfa) return this.go('mfa', { challengeId: r.challengeId, mfa: '' }); this._mounted = false; this.props.onSignedIn(r.user); };

  submitSignin = e => {
    e.preventDefault(); const s = this.state;
    if (!/^\S+@\S+\.\S+$/.test(s.email)) return this.setState({ err: 'Enter a valid email address.' });
    if (!s.pw) return this.setState({ err: 'Enter your password.' });
    this.run(async () => this.done(await auth.passwordSignIn(s.email.trim(), s.pw)));
  };
  submitSignup = e => {
    e.preventDefault(); const s = this.state;
    if (s.name.trim().length < 2) return this.setState({ err: 'Enter your full name.' });
    if (!/^\S+@\S+\.\S+$/.test(s.email)) return this.setState({ err: 'Enter a valid email address.' });
    if (pwScore(s.pw) < 2) return this.setState({ err: 'Use at least 8 characters with a number or symbol.' });
    if (!s.agree) return this.setState({ err: 'Please accept the Terms and Privacy policy.' });
    this.run(async () => this.done(await auth.emailSignUp(s.name.trim(), s.email.trim(), s.pw)));
  };
  submitMfa = e => { e && e.preventDefault(); const s = this.state; if (!s.recovery && s.mfa.length !== 6) return this.setState({ err: 'Enter all 6 digits.' }); this.run(async () => this.done(await auth.mfaChallenge(s.challengeId, s.mfa, s.recovery, s.trust))); };
  sendReset = e => { e.preventDefault(); if (!/\S+@\S+/.test(this.state.email)) return this.setState({ err: 'Enter a valid email address.' }); this.run(async () => { await auth.sendPasswordReset(this.state.email.trim()); this.go('sent'); }); };

  render() {
    const s = this.state;
    return (
      <div className="bj-auth" style={css("min-height:100dvh;display:flex;flex-wrap:wrap;background:#F7FAFA")}>
        <style>{`
          .bj-auth-brand{flex:1 1 420px;min-height:100dvh;position:relative;overflow:hidden;background:radial-gradient(80% 70% at 20% 10%,rgba(47,211,168,.22),transparent 60%),radial-gradient(60% 60% at 90% 90%,rgba(47,211,168,.10),transparent 60%),#0f1c36;color:#fff;padding:48px;display:flex;flex-direction:column;justify-content:space-between;gap:40px}
          .bj-auth-form{flex:1 1 460px;display:flex;align-items:center;justify-content:center;padding:48px 24px}
          .bj-auth-mobile{display:none}
          @media (max-width:900px){
            .bj-auth{flex-direction:column}
            .bj-auth-brand{display:none}
            .bj-auth-mobile{display:flex;align-items:center;gap:10px;padding:20px 24px 0}
            .bj-auth-form{flex:1 1 auto;align-items:flex-start;padding:20px 24px 32px;min-height:0}
            .bj-auth-form h2{font-size:24px !important}
          }
        `}</style>
        <div className="bj-auth-brand">
          <div style={css("display:flex;align-items:center;gap:12px")}>
            <ByjanMark size={48} theme="dark" />
            <div><p style={css("font:600 26px/1 'Poppins';letter-spacing:-.03em")}>byjan</p><p style={css("margin-top:5px;font:600 10px 'Geist';letter-spacing:.2em;color:#2fd3a8")}>BUSINESS</p></div>
          </div>
          <div style={css("max-width:440px")}>
            <h1 style={css("font:650 40px/1.08 'Geist';letter-spacing:-.04em;text-wrap:pretty")}>Your books, your clients and your GST, in one place.</h1>
            <p style={css("margin-top:16px;font:450 15px/1.55 'Geist';color:#B8C4D6")}>One account opens every business, CA practice and Dhani workspace you belong to.</p>
          </div>
          <div style={css("display:flex;align-items:center;gap:10px;font:500 12.5px 'Geist';color:#B8C4D6")}><Ic n="duotone/shield-check-duotone.svg" c="#2fd3a8" />Data stored in India · 2-step sign-in for owners and admins</div>
        </div>

        <div className="bj-auth-mobile">
          <ByjanMark size={36} />
          <div><p style={css("font:600 18px/1 'Poppins';letter-spacing:-.03em;color:#0A1020")}>byjan</p><p style={css("margin-top:3px;font:600 9px 'Geist';letter-spacing:.18em;color:#17b18c")}>BUSINESS</p></div>
        </div>

        <div className="bj-auth-form">
          <div key={s.screen} style={css("width:100%;max-width:400px;animation:rise .35s ease both")}>
            {s.screen === 'signin' ? this.signin() : null}
            {s.screen === 'signup' ? this.signup() : null}
            {s.screen === 'mfa' ? this.mfaView() : null}
            {s.screen === 'forgot' ? this.forgot() : null}
            {s.screen === 'sent' ? this.sent() : null}
            {s.screen === 'out' ? this.out() : null}
          </div>
        </div>
      </div>
    );
  }

  signin() {
    const s = this.state, ok = s.email && s.pw;
    return (
      <form onSubmit={this.submitSignin} noValidate>
        <H2>Sign in</H2><Sub>Welcome back. Sign in with your work email.</Sub>
        <Label>Work email</Label>
        <input autoFocus type="email" autoComplete="username" value={s.email} onChange={e => this.setState({ email: e.target.value, err: '' })} placeholder="you@company.in" style={css(inputS)} />
        <div style={css("margin-top:14px;display:flex;justify-content:space-between;align-items:baseline")}>
          <Label mt={0}>Password</Label>
          <a href="#" onClick={e => { e.preventDefault(); this.go('forgot'); }} style={css("font:600 12.5px 'Geist'")}>Forgot password?</a>
        </div>
        <PwField v={s.pw} show={s.showPw} ac="current-password" ph="Your password" onChange={pw => this.setState({ pw, err: '' })} onToggle={() => this.setState({ showPw: !s.showPw })} />
        <Err t={s.err} />
        <Cta busy={s.busy} ok={ok}>{s.busy ? 'Signing in…' : 'Sign in'}</Cta>
        <Or />
        <Ghost onClick={() => this.run(async () => this.done(await auth.googleSignIn()))}><Ic n="bold/google-logo-bold.svg" s={18} />Continue with Google</Ghost>
        <p style={css("margin-top:24px;font:500 13.5px 'Geist';color:#667085")}>New to Byjan? <a href="#" onClick={e => { e.preventDefault(); this.go('signup', { pw: '', showPw: false }); }} style={css("font-weight:600")}>Create an account</a></p>
        {auth.MOCK ? <p style={css("margin-top:10px;font:450 12px 'Geist';color:#98A2B3")}>Demo mode: any email works. Password “wrong123” shows the error; 2-step code “000000” fails.</p> : null}
      </form>
    );
  }

  signup() {
    const s = this.state, sc = pwScore(s.pw), ok = s.name.trim() && s.email && sc >= 2 && s.agree;
    const SC = [['#E4E7EC', ''], ['#F04438', 'Too weak'], ['#F79009', 'Okay'], ['#17b18c', 'Strong'], ['#17b18c', 'Very strong']][sc];
    return (
      <form onSubmit={this.submitSignup} noValidate>
        <BackLink onClick={() => this.go('signin', { pw: '' })}>← Back to sign in</BackLink>
        <div style={css("margin-top:18px")}><H2>Create your account</H2></div>
        <Sub>Free to start. You can add your business or CA practice next.</Sub>
        <Label>Full name</Label>
        <input autoFocus autoComplete="name" value={s.name} onChange={e => this.setState({ name: e.target.value, err: '' })} placeholder="Ravi Sharma" style={css(inputS)} />
        <Label mt={14}>Work email</Label>
        <input type="email" autoComplete="email" value={s.email} onChange={e => this.setState({ email: e.target.value, err: '' })} placeholder="you@company.in" style={css(inputS)} />
        <Label mt={14}>Password</Label>
        <PwField v={s.pw} show={s.showPw} ac="new-password" ph="At least 8 characters" onChange={pw => this.setState({ pw, err: '' })} onToggle={() => this.setState({ showPw: !s.showPw })} />
        <div style={css("margin-top:8px;display:flex;align-items:center;gap:10px")}>
          <div style={css("flex:1;display:grid;grid-template-columns:repeat(4,1fr);gap:4px")}>{[1, 2, 3, 4].map(i => <span key={i} style={css(`height:4px;border-radius:99px;background:${i <= sc ? SC[0] : '#E4E7EC'}`)} />)}</div>
          <span style={css("width:78px;font:600 11.5px 'Geist';color:#667085;text-align:right")}>{SC[1]}</span>
        </div>
        <label style={css("margin-top:16px;display:flex;align-items:flex-start;gap:10px;font:500 13px/1.45 'Geist';color:#344054;cursor:pointer")}>
          <input type="checkbox" checked={s.agree} onChange={() => this.setState({ agree: !s.agree, err: '' })} style={css("margin-top:2px;width:16px;height:16px;accent-color:#17b18c")} />
          <span>I agree to Byjan’s <a href="/terms">Terms</a> and <a href="/privacy">Privacy policy</a>.</span>
        </label>
        <Err t={s.err} />
        <Cta busy={s.busy} ok={ok}>{s.busy ? 'Creating account…' : 'Create account'}</Cta>
        <Or />
        <Ghost onClick={() => this.run(async () => this.done(await auth.googleSignIn()))}><Ic n="bold/google-logo-bold.svg" s={18} />Sign up with Google</Ghost>
      </form>
    );
  }

  mfaView() {
    const s = this.state;
    return (
      <form onSubmit={this.submitMfa} noValidate>
        <Badge ic="duotone/shield-check-duotone.svg" />
        <div style={css("margin-top:18px")}><H2>2-step sign-in</H2></div>
        <Sub>{s.recovery ? 'Enter one of the 10 recovery codes you saved when you turned on 2-step. Each works once.' : 'Your role needs a second step. Enter the 6-digit code from your authenticator app.'}</Sub>
        <input autoFocus key={String(s.recovery)} value={s.mfa} aria-label={s.recovery ? 'Recovery code' : 'Authenticator code'} inputMode={s.recovery ? 'text' : 'numeric'} autoComplete="one-time-code" placeholder={s.recovery ? 'XXXXX-XXXXX' : '000000'}
          onChange={e => this.setState({ mfa: s.recovery ? e.target.value.toUpperCase().slice(0, 11) : e.target.value.replace(/\D/g, '').slice(0, 6), err: '' })}
          style={css("margin-top:22px;width:100%;height:52px;border-radius:12px;background:#fff;border:1px solid #D0D5DD;padding:0 14px;font:600 20px 'Geist Mono';letter-spacing:.2em")} />
        <label style={css("margin-top:14px;display:flex;align-items:center;gap:10px;font:500 13px 'Geist';color:#344054;cursor:pointer")}>
          <input type="checkbox" checked={s.trust} onChange={() => this.setState({ trust: !s.trust })} style={css("width:16px;height:16px;accent-color:#17b18c")} />Don’t ask again on this computer for 30 days
        </label>
        <Err t={s.err} />
        <Cta busy={s.busy} ok={s.recovery ? s.mfa.replace(/\W/g, '').length >= 10 : s.mfa.length === 6}>{s.busy ? 'Checking…' : 'Verify'}</Cta>
        <div style={css("margin-top:16px;display:flex;justify-content:space-between;font:600 13px 'Geist'")}>
          <a href="#" onClick={e => { e.preventDefault(); this.setState({ recovery: !s.recovery, mfa: '', err: '' }); }}>{s.recovery ? 'Use authenticator app' : 'Use a recovery code'}</a>
          <a href="#" onClick={e => { e.preventDefault(); auth.clearLocal(); this.go('signin', { pw: '' }); }} style={css("color:#667085")}>Cancel</a>
        </div>
      </form>
    );
  }

  forgot() {
    const s = this.state;
    return (
      <form onSubmit={this.sendReset} noValidate>
        <BackLink onClick={() => this.go('signin')}>← Back to sign in</BackLink>
        <div style={css("margin-top:18px")}><H2>Reset your password</H2></div>
        <Sub>Enter your email and we’ll send a link to set a new one. The link works for 1 hour.</Sub>
        <input autoFocus type="email" value={s.email} onChange={e => this.setState({ email: e.target.value, err: '' })} placeholder="you@company.in" aria-label="Email" style={css(inputS + ';margin-top:22px')} />
        <Err t={s.err} />
        <Cta mt={16} busy={s.busy} ok={/\S+@\S+/.test(s.email)}>{s.busy ? 'Sending…' : 'Send reset link'}</Cta>
      </form>
    );
  }

  sent() {
    return (
      <div>
        <Badge ic="duotone/envelope-simple-duotone.svg" />
        <div style={css("margin-top:18px")}><H2>Check your email</H2></div>
        <Sub>If <b style={css("color:#0A1020;font-weight:600")}>{this.state.email}</b> has a Byjan account, a reset link is on its way. After you reset, every device is signed out.</Sub>
        <Ghost mt={22} onClick={() => this.go('signin', { tab: 'email', pw: '' })}>Back to sign in</Ghost>
      </div>
    );
  }

  out() {
    const [t, sub, ic, bg, fg] = OUT[this.props.reason] || OUT.manual;
    return (
      <div>
        <Badge ic={ic} bg={bg} fg={fg} />
        <div style={css("margin-top:18px")}><H2>{t}</H2></div>
        <Sub>{sub}</Sub>
        <Cta type="button" mt={22} onClick={() => { this.props.onClearReason && this.props.onClearReason(); this.go('signin', { otp: '', pw: '', mfa: '' }); }}>Sign in again</Cta>
        <p style={css("margin-top:14px;font:450 12.5px/1.5 'Geist';color:#98A2B3")}>On a shared computer? Close this browser window too.</p>
      </div>
    );
  }
}

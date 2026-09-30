import React from 'react';
import { css } from '../ui/css.js';
import Hx from '../ui/Hx.jsx';
import App from '../App.jsx';
import AuthScreens from './AuthScreens.jsx';
import ByjanLoader from '../brand/ByjanLoader.jsx';
import * as auth from './authApi.js';

const WARN_S = 60;
const ACT_KEY = 'byjanLastActive';

// Decides what's on screen: splash while restoring, sign-in screens, or the app.
// Owns sign-out (confirm dialog, all-devices option), idle timeout and cross-tab sign-out.
export default class AuthGate extends React.Component {
  state = { phase: 'checking', user: null, reason: null, confirm: false, allDev: false, busy: false, warn: false, secs: WARN_S };

  async componentDidMount() {
    auth.setOnSessionLost(reason => this.end(reason));
    try { this.bc = new BroadcastChannel('byjan-auth'); this.bc.onmessage = e => { if (e.data === 'signout' && this.state.phase === 'in') { auth.clearLocal(); this.end('other'); } }; } catch (e) {}
    const user = await auth.restore();
    this.setState(user ? { phase: 'in', user } : { phase: 'out' }, () => user && this.startIdle());
  }
  componentWillUnmount() { this.stopIdle(); this.bc && this.bc.close(); }

  signedIn = user => this.setState({ phase: 'in', user, reason: null }, () => this.startIdle());

  // Called from the profile menu.
  askSignOut = () => this.setState({ confirm: true, allDev: false });

  doSignOut = async () => {
    this.setState({ busy: true });
    await auth.signOut({ allDevices: this.state.allDev });
    try { this.bc && this.bc.postMessage('signout'); } catch (e) {}
    this.end(this.state.allDev ? 'manualAll' : 'manual');
  };

  end = reason => {
    this.stopIdle();
    this.setState({ phase: 'out', user: null, reason, confirm: false, busy: false, warn: false });
  };

  idleMs() { return (this.state.user?.sessionTimeoutMin || auth.IDLE_MIN) * 60000; }
  mark = () => {
    const now = Date.now();
    if (now - (this._last || 0) < 5000) return;
    this._last = now;
    try { localStorage.setItem(ACT_KEY, String(now)); } catch (e) {}
  };
  startIdle() {
    this.stopIdle(); this._last = 0; this.mark();
    ['mousemove', 'keydown', 'mousedown', 'scroll', 'touchstart'].forEach(ev => window.addEventListener(ev, this.mark, { passive: true, capture: true }));
    this._iv = setInterval(() => {
      if (this.state.warn) return;
      let last = this._last; try { last = Math.max(last, Number(localStorage.getItem(ACT_KEY)) || 0); } catch (e) {}
      const left = this.idleMs() - (Date.now() - last);
      if (left <= WARN_S * 1000) this.warn(Math.max(1, Math.round(left / 1000)));
    }, 5000);
  }
  stopIdle() {
    clearInterval(this._iv); clearInterval(this._cd);
    ['mousemove', 'keydown', 'mousedown', 'scroll', 'touchstart'].forEach(ev => window.removeEventListener(ev, this.mark, { capture: true }));
  }
  warn(secs) {
    this.setState({ warn: true, secs });
    clearInterval(this._cd);
    this._cd = setInterval(() => {
      if (this.state.secs <= 1) { clearInterval(this._cd); auth.signOut().finally(() => this.end('expired')); }
      else this.setState(s => ({ secs: s.secs - 1 }));
    }, 1000);
  }
  stay = () => { clearInterval(this._cd); this._last = 0; this.mark(); this.setState({ warn: false }); };

  render() {
    const s = this.state;
    if (s.phase === 'checking') return <div style={css("height:100vh;display:grid;place-items:center;background:#F7FAFA")}><ByjanLoader size={72} /></div>;
    if (s.phase === 'out') return <AuthScreens key={s.reason || 'in'} reason={s.reason} onSignedIn={this.signedIn} onClearReason={() => this.setState({ reason: null })} />;
    return (
      <>
        <App user={s.user} onAskSignOut={this.askSignOut} />
        {s.confirm ? (
          <Backdrop>
            <h3 style={css("font:650 19px 'Geist';letter-spacing:-.02em")}>Sign out of Byjan?</h3>
            <p style={css("margin-top:8px;font:450 14px/1.5 'Geist';color:#667085")}>Unsaved changes on this page will be lost. You can sign back in any time.</p>
            {s.user?.otherDevices ? (
              <label style={css("margin-top:16px;display:flex;align-items:flex-start;gap:10px;padding:12px;border-radius:12px;background:#F7F8FA;cursor:pointer")}>
                <input type="checkbox" checked={s.allDev} onChange={() => this.setState({ allDev: !s.allDev })} style={css("margin-top:2px;width:16px;height:16px;accent-color:#17b18c")} />
                <span><span style={css("display:block;font:600 13.5px 'Geist';color:#344054")}>Also sign out my other devices</span><span style={css("display:block;margin-top:2px;font:450 12.5px 'Geist';color:#667085")}>{s.user.otherDevices} other {s.user.otherDevices === 1 ? 'device is' : 'devices are'} signed in</span></span>
              </label>
            ) : null}
            <div style={css("margin-top:20px;display:flex;justify-content:flex-end;gap:10px")}>
              <Btn onClick={() => this.setState({ confirm: false })} disabled={s.busy}>Cancel</Btn>
              <Btn danger autoFocus onClick={this.doSignOut} disabled={s.busy}>{s.busy ? <Spin /> : null}{s.busy ? 'Signing out…' : 'Sign out'}</Btn>
            </div>
          </Backdrop>
        ) : null}
        {s.warn ? (
          <Backdrop z={95}>
            <div style={css("display:flex;align-items:center;gap:14px")}>
              <span style={css("flex:none;width:56px;height:56px;border-radius:50%;background:#FEF0C7;color:#B54708;display:grid;place-items:center;font:650 18px 'Geist Mono'")}>{s.secs}</span>
              <div><h3 style={css("font:650 18px 'Geist';letter-spacing:-.02em")}>Still there?</h3><p style={css("margin-top:4px;font:450 13.5px/1.45 'Geist';color:#667085")}>For your safety you’ll be signed out in {s.secs} seconds. Drafts are saved.</p></div>
            </div>
            <div style={css("margin-top:20px;display:flex;justify-content:flex-end;gap:10px")}>
              <Btn onClick={() => { clearInterval(this._cd); auth.signOut().finally(() => this.end('manual')); }}>Sign out</Btn>
              <Btn primary autoFocus onClick={this.stay}>Stay signed in</Btn>
            </div>
          </Backdrop>
        ) : null}
      </>
    );
  }
}

const Spin = () => <span style={css("width:14px;height:14px;border-radius:50%;border:2px solid rgba(255,255,255,.4);border-top-color:#fff;animation:spin .7s linear infinite")} />;
function Backdrop({ children, z = 90 }) {
  return (
    <div style={css(`position:fixed;inset:0;z-index:${z};background:rgba(10,16,32,.42);display:flex;align-items:center;justify-content:center;padding:24px;animation:fade .15s ease both`)}>
      <div role="dialog" aria-modal="true" style={css("width:100%;max-width:420px;padding:24px;background:#fff;border-radius:22px;box-shadow:0 30px 60px -20px rgba(11,31,58,.5);animation:zoomIn .18s ease both")}>{children}</div>
    </div>
  );
}
function Btn({ children, primary, danger, ...rest }) {
  const bg = danger ? 'background:#D92D20;color:#fff;border:0' : primary ? 'background:linear-gradient(180deg,#1fc39b,#17b18c);color:#fff;border:0' : 'background:#fff;color:#344054;border:1px solid #D0D5DD';
  const h = danger ? 'background:#B42318' : primary ? 'filter:brightness(1.05)' : 'background:#F9FAFB';
  return <Hx as="button" {...rest} s={`height:42px;padding:0 16px;border-radius:11px;cursor:pointer;font:650 13.5px 'Geist';display:flex;align-items:center;gap:8px;${bg}`} h={h}>{children}</Hx>;
}

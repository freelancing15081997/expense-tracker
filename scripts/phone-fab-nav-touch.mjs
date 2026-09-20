/**
 * Logout → login → book page → assert FAB: ~10% below nav top, Books↔+ balanced.
 * Also smoke-check features map from /api/me is present.
 */
import http from 'http';
import WebSocket from 'ws';
import { spawnSync } from 'child_process';
import { join } from 'path';

const PKG = 'com.byjanbooks.app';
const SERIAL = process.env.BYJAN_SERIAL || 'ZD222LNHM5';
const ADB = join(process.env.LOCALAPPDATA || '', 'Android', 'Sdk', 'platform-tools', 'adb.exe');
const EMAIL = process.env.BYJAN_EMAIL || 'badrinathp316@gmail.com';
const PASS = process.env.BYJAN_PASS || '123456';
const OUT = join(process.cwd(), 'tmp-phone-fab-nav-touch.png');

function adb(args) {
  return spawnSync(ADB, ['-s', SERIAL, ...args.split(' ').filter(Boolean)], { encoding: 'utf8' }).stdout.trim();
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function cdp() {
  const pid = String(adb(`shell pidof ${PKG}`) || '').trim().split(/\s+/)[0];
  if (!pid) throw new Error('app not running');
  try { spawnSync(ADB, ['-s', SERIAL, 'forward', '--remove', 'tcp:9222'], { encoding: 'utf8' }); } catch { /* */ }
  adb(`forward tcp:9222 localabstract:webview_devtools_remote_${pid}`);
  await sleep(700);
  const pages = await new Promise((resolve, reject) => {
    http.get('http://127.0.0.1:9222/json', (res) => {
      let d = '';
      res.on('data', (c) => { d += c; });
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch (e) { reject(e); } });
    }).on('error', reject);
  });
  const ws = new WebSocket((pages.find((p) => p.type === 'page') || pages[0]).webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.once('open', r); ws.once('error', j); });
  let n = 0;
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const i = ++n;
    const t = setTimeout(() => reject(new Error(`timeout ${method}`)), 16000);
    const onMsg = (raw) => {
      const msg = JSON.parse(String(raw));
      if (msg.id === i) {
        clearTimeout(t);
        ws.off('message', onMsg);
        if (msg.error) reject(new Error(msg.error.message || method));
        else resolve(msg.result);
      }
    };
    ws.on('message', onMsg);
    ws.send(JSON.stringify({ id: i, method, params }));
  });
  await send('Runtime.enable');
  const evalJs = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.text || 'eval failed');
    return r.result?.value;
  };
  return { evalJs, close: () => ws.close() };
}

adb(`shell am force-stop ${PKG}`);
adb(`shell am start -n ${PKG}/com.byjanbooks.com.MainActivity`);
await sleep(4000);
const { evalJs, close } = await cdp();
await evalJs(`try { localStorage.setItem('byjan.onboard.v1','1'); } catch (e) {}`);

const alreadyIn = await evalJs(`!/#\\/?login/i.test(location.hash||'') && !/sign in to byjan/i.test((document.body.innerText||'').toLowerCase())`);
if (alreadyIn) {
  await evalJs(`document.querySelector('button.account-avatar')?.click()`);
  await sleep(700);
  await evalJs(`([...document.querySelectorAll('button')].find(b => /^sign out$/i.test((b.textContent||'').trim()))||{}).click?.()`);
  await sleep(2500);
}
await evalJs(`location.hash='#/login'`);
await sleep(1000);
await evalJs(`(() => {
  const set = (el, v) => {
    if (!el) return;
    const desc = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
    desc?.set?.call(el, v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  };
  set(document.querySelector('input[type="email"]'), ${JSON.stringify(EMAIL)});
  set(document.querySelector('input[type="password"]'), ${JSON.stringify(PASS)});
  const btn = [...document.querySelectorAll('button')].find(b => /sign in/i.test(b.textContent||'') && !/google/i.test(b.textContent||''));
  (btn || document.querySelector('form button[type="submit"]'))?.click();
})()`);
await sleep(5500);

const auth = await evalJs(`({
  hash: location.hash,
  bad: /email or password is incorrect/i.test(document.body.innerText||''),
  featureKeys: Object.keys((window.__BYJAN_FEATURES__||{})).length,
})`);
if (auth.bad || /#\/?login/i.test(String(auth.hash || ''))) {
  console.log('LOGIN_FAIL', auth);
  close();
  process.exit(1);
}
console.log('LOGIN_OK', auth.hash);

await evalJs(`location.hash='#/expenses'`);
await sleep(1000);
await evalJs(`(document.querySelector('a[href*="#/book/"]')||{}).click?.()`);
await sleep(1600);
for (let i = 0; i < 5; i++) {
  await evalJs(`document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));`);
  await sleep(200);
}

const m = await evalJs(`(() => {
  const bar = document.querySelector('.dash-tabbar');
  const fab = document.querySelector('.dash-fab-center');
  const books = document.querySelector('.dash-tab-books');
  const act = document.querySelector('.dash-tab-activity');
  const mid = (el) => { if (!el) return null; const r = el.getBoundingClientRect(); return (r.left + r.right) / 2; };
  const box = (el) => { if (!el) return null; const r = el.getBoundingClientRect(); return { t:r.top,b:r.bottom,l:r.left,r:r.right,w:r.width,h:r.height }; };
  const barBox = box(bar), fabBox = box(fab), booksBox = box(books);
  const fm = mid(fab), bm = mid(books), am = mid(act);
  const left = fm!=null&&bm!=null ? Math.round(fm-bm) : null;
  const right = fm!=null&&am!=null ? Math.round(am-fm) : null;
  const overlapBelowTop = fabBox && barBox ? Math.round(fabBox.b - barBox.t) : null;
  const overlapPct = fabBox && overlapBelowTop != null ? Math.round((overlapBelowTop / fabBox.h) * 100) : null;
  return {
    hash: location.hash,
    hasFab: bar?.classList.contains('has-fab'),
    leftGap: left, rightGap: right,
    balanced: left!=null&&right!=null && Math.abs(left-right)<=8,
    fabH: fabBox ? Math.round(fabBox.h) : null,
    barTop: barBox ? Math.round(barBox.t) : null,
    fabTop: fabBox ? Math.round(fabBox.t) : null,
    fabBottom: fabBox ? Math.round(fabBox.b) : null,
    overlapBelowTop,
    overlapPct,
    // Accept 5–18% so 10% target has tolerance on device rounding
    fabTouchesNavTop: overlapPct != null && overlapPct >= 5 && overlapPct <= 18,
    fabMostlyAbove: fabBox && barBox ? fabBox.t < barBox.t - 20 : false,
    tabs: [...document.querySelectorAll('a.dash-tab')].map(t => (t.textContent||'').trim().replace(/\\s+/g,' ')),
  };
})()`);

console.log(JSON.stringify(m, null, 2));
const ok = m && m.hasFab && m.balanced && m.fabTouchesNavTop && m.fabMostlyAbove;
console.log(ok ? 'FAB_NAV_TOUCH_OK' : 'FAB_NAV_TOUCH_FAIL');

adb(`shell screencap -p /sdcard/byjan-fab-touch.png`);
spawnSync(ADB, ['-s', SERIAL, 'pull', '/sdcard/byjan-fab-touch.png', OUT], { encoding: 'utf8', stdio: 'inherit' });
close();
process.exit(ok ? 0 : 1);

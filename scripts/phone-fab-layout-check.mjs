/**
 * Force logout (UI Sign out) → login → open book → measure FAB balance + raise.
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
const OUT = join(process.cwd(), 'tmp-phone-retest-04-book.png');

function adb(args) {
  return spawnSync(ADB, ['-s', SERIAL, ...args.split(' ').filter(Boolean)], { encoding: 'utf8' }).stdout.trim();
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function cdp() {
  const pid = String(adb(`shell pidof ${PKG}`) || '').trim().split(/\s+/)[0];
  if (!pid) throw new Error('app not running');
  try { spawnSync(ADB, ['-s', SERIAL, 'forward', '--remove', 'tcp:9222'], { encoding: 'utf8' }); } catch { /* */ }
  adb(`forward tcp:9222 localabstract:webview_devtools_remote_${pid}`);
  await sleep(800);
  const pages = await new Promise((resolve, reject) => {
    http.get('http://127.0.0.1:9222/json', (res) => {
      let d = '';
      res.on('data', (c) => { d += c; });
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch (e) { reject(e); } });
    }).on('error', reject);
  });
  const page = pages.find((p) => p.type === 'page') || pages[0];
  const ws = new WebSocket(page.webSocketDebuggerUrl);
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
console.log('STEP logout', { alreadyIn });
if (alreadyIn) {
  await evalJs(`document.querySelector('button.account-avatar')?.click()`);
  await sleep(800);
  const signedOut = await evalJs(`(() => {
    const btn = [...document.querySelectorAll('button')].find(b => /^sign out$/i.test((b.textContent||'').trim()));
    btn?.click();
    return Boolean(btn);
  })()`);
  console.log('signedOutClick', signedOut);
  await sleep(2800);
}

await evalJs(`location.hash = '#/login'`);
await sleep(1200);
await evalJs(`(() => {
  const skip = [...document.querySelectorAll('button')].find(b => /skip|get started/i.test(b.textContent||'') && !/google|sign in/i.test(b.textContent||''));
  skip?.click();
})()`);
await sleep(500);

console.log('STEP login');
await evalJs(`(() => {
  const set = (el, v) => {
    if (!el) return;
    const desc = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
    desc?.set?.call(el, v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  };
  set(document.querySelector('input[type="email"]'), ${JSON.stringify(EMAIL)});
  set(document.querySelector('input[type="password"]'), ${JSON.stringify(PASS)});
  const btn = [...document.querySelectorAll('button')].find(b => /sign in/i.test(b.textContent||'') && !/google/i.test(b.textContent||''));
  (btn || document.querySelector('form button[type="submit"]'))?.click();
})()`);
await sleep(5500);

const auth = await evalJs(`(() => ({
  hash: location.hash,
  incorrect: /email or password is incorrect/i.test(document.body.innerText||''),
}))()`);
console.log('AUTH', JSON.stringify(auth));
if (auth.incorrect || /#\/?login/i.test(String(auth.hash || ''))) {
  console.log('LOGIN_FAIL');
  close();
  process.exit(1);
}
console.log('LOGIN_OK');

await evalJs(`location.hash = '#/expenses'`);
await sleep(1100);
await evalJs(`(document.querySelector('a[href*="#/book/"]') || {}).click?.()`);
await sleep(1600);
await evalJs(`if (/[?&]pay=/.test(location.hash)) location.hash = location.hash.replace(/[?&]pay=[^&]*/g, '').replace(/\\?&/, '?').replace(/\\?$/, '');`);
await sleep(400);
for (let i = 0; i < 5; i++) {
  await evalJs(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));`);
  await sleep(200);
}

const m = await evalJs(`(() => {
  const bar = document.querySelector('.dash-tabbar');
  const fab = document.querySelector('.dash-fab-center');
  const books = document.querySelector('.dash-tab-books');
  const act = document.querySelector('.dash-tab-activity');
  const mid = (el) => { if (!el) return null; const r = el.getBoundingClientRect(); return (r.left + r.right) / 2; };
  const box = (el) => { if (!el) return null; const r = el.getBoundingClientRect(); return { t: r.top, b: r.bottom, l: r.left, r: r.right, w: r.width, h: r.height }; };
  const fm = mid(fab), bm = mid(books), am = mid(act);
  const left = fm != null && bm != null ? Math.round(fm - bm) : null;
  const right = fm != null && am != null ? Math.round(am - fm) : null;
  const fabBox = box(fab), booksBox = box(books), barBox = box(bar);
  const raised = fabBox && booksBox ? Math.round(booksBox.t - fabBox.t) : null;
  const cs = bar ? getComputedStyle(bar) : null;
  return {
    hash: location.hash,
    hasFab: bar?.classList.contains('has-fab'),
    dataTabs: bar?.getAttribute('data-tabs'),
    areas: cs?.gridTemplateAreas,
    cols: cs?.gridTemplateColumns,
    children: [...(bar?.children || [])].map((c) => c.className),
    spacer: Boolean(document.querySelector('.dash-tab-spacer')),
    spacerDisplay: document.querySelector('.dash-tab-spacer') ? getComputedStyle(document.querySelector('.dash-tab-spacer')).display : null,
    booksMid: bm, fabMid: fm, actMid: am,
    leftGap: left, rightGap: right,
    balanced: left != null && right != null && Math.abs(left - right) <= 8,
    raisedPx: raised,
    fabAboveIcons: raised != null && raised >= 8,
    fabVis: !!(fabBox && fabBox.h > 40 && fabBox.t < innerHeight),
    fab: fabBox, books: booksBox, bar: barBox,
  };
})()`);

console.log(JSON.stringify(m, null, 2));
const ok = m && m.hasFab && m.fabVis && m.balanced && m.fabAboveIcons;
console.log(ok ? 'FAB_LAYOUT_OK' : 'FAB_LAYOUT_FAIL');

adb(`shell screencap -p /sdcard/byjan-nav-final.png`);
spawnSync(ADB, ['-s', SERIAL, 'pull', '/sdcard/byjan-nav-final.png', OUT], { encoding: 'utf8', stdio: 'inherit' });
close();
process.exit(ok ? 0 : 1);

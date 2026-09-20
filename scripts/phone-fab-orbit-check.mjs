/**
 * Open FAB and assert Voice/Add/Scan surround the + (not clustered in the tab bar).
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
if (alreadyIn) {
  await evalJs(`document.querySelector('button.account-avatar')?.click()`);
  await sleep(800);
  await evalJs(`(() => {
    const btn = [...document.querySelectorAll('button')].find(b => /^sign out$/i.test((b.textContent||'').trim()));
    btn?.click();
    return Boolean(btn);
  })()`);
  await sleep(2800);
}
await evalJs(`location.hash = '#/login'`);
await sleep(1200);
await evalJs(`(() => {
  const skip = [...document.querySelectorAll('button')].find(b => /skip|get started/i.test(b.textContent||'') && !/google|sign in/i.test(b.textContent||''));
  skip?.click();
})()`);
await sleep(500);
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

await evalJs(`location.hash = '#/expenses'`);
await sleep(1100);
await evalJs(`(() => {
  const a = document.querySelector('a[href*="/book/"]') || [...document.querySelectorAll('a')].find(x => /#\\/book\\//.test(x.getAttribute('href')||''));
  a?.click();
  return a?.getAttribute('href') || null;
})()`);
await sleep(2200);

// Dismiss pay sheet if open so FAB is free
await evalJs(`(() => {
  document.querySelector('.dash-fab-scrim')?.click();
  const close = [...document.querySelectorAll('button')].find(b => /close|cancel|✕|×/i.test(b.getAttribute('aria-label')||'') || b.textContent?.trim() === '×');
  close?.click();
  return true;
})()`);
await sleep(600);

await evalJs(`document.querySelector('.dash-fab-center')?.click()`);
await sleep(900);

const m = await evalJs(`(() => {
  const fab = document.querySelector('.dash-fab-center');
  const lift = document.querySelector('.dash-fab-lift');
  const orbit = document.querySelector('.dash-fab-orbit');
  const items = [...document.querySelectorAll('.dash-fab-item')];
  const mid = (el) => { if (!el) return null; const r = el.getBoundingClientRect(); return { x:(r.left+r.right)/2, y:(r.top+r.bottom)/2, t:r.top, b:r.bottom }; };
  const fm = mid(fab);
  const pts = items.map((el) => {
    const btn = el.querySelector('.dash-fab-btn') || el;
    const p = mid(btn);
    const label = (el.querySelector('.dash-fab-label')?.textContent || el.textContent || '').trim();
    return {
      label,
      x: Math.round(p.x),
      y: Math.round(p.y),
      dx: Math.round(p.x - fm.x),
      dy: Math.round(p.y - fm.y),
      aboveFab: p.y < fm.y - 20,
      dist: Math.round(Math.hypot(p.x - fm.x, p.y - fm.y)),
    };
  });
  const allAbove = pts.length >= 1 && pts.every((p) => p.aboveFab);
  const spreadX = pts.length >= 2 ? Math.max(...pts.map((p) => p.dx)) - Math.min(...pts.map((p) => p.dx)) : 0;
  const fanned = spreadX >= 100; // left and right wings
  const around = allAbove && fanned && pts.every((p) => p.dist >= 55 && p.dist <= 140);
  return {
    open: fab?.getAttribute('data-open') === 'true',
    hasLift: !!lift,
    hasOrbit: !!orbit,
    fab: fm ? { x: Math.round(fm.x), y: Math.round(fm.y) } : null,
    items: pts,
    allAbove,
    fanned,
    around,
  };
})()`);

console.log(JSON.stringify(m, null, 2));
const ok = m && m.open && m.hasLift && m.hasOrbit && m.around;
console.log(ok ? 'FAB_ORBIT_OK' : 'FAB_ORBIT_FAIL');

adb(`shell screencap -p /sdcard/byjan-fab-orbit.png`);
spawnSync(ADB, ['-s', SERIAL, 'pull', '/sdcard/byjan-fab-orbit.png', join(process.cwd(), 'byjan-fab-orbit.png')], { encoding: 'utf8' });

close();
process.exit(ok ? 0 : 1);

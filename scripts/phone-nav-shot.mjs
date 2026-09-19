/**
 * Close overlays, open a book, screencap bottom nav.
 */
import http from 'http';
import WebSocket from 'ws';
import { spawnSync } from 'child_process';
import { join } from 'path';

const PKG = 'com.byjanbooks.app';
const SERIAL = process.env.BYJAN_SERIAL || 'ZD222LNHM5';
const ADB = join(process.env.LOCALAPPDATA || '', 'Android', 'Sdk', 'platform-tools', 'adb.exe');
const OUT = join(process.cwd(), 'tmp-phone-retest-04-book.png');

function adb(args) {
  const r = spawnSync(ADB, ['-s', SERIAL, ...args.split(' ').filter(Boolean)], { encoding: 'utf8' });
  return (r.stdout || '').trim();
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
  const page = pages.find((p) => p.type === 'page') || pages[0];
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.once('open', r); ws.once('error', j); });
  let n = 0;
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const i = ++n;
    const t = setTimeout(() => reject(new Error(`timeout ${method}`)), 14000);
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
  return { ws, evalJs, close: () => ws.close() };
}

adb(`shell am force-stop ${PKG}`);
adb(`shell am start -n ${PKG}/com.byjanbooks.com.MainActivity`);
await sleep(3500);
const { evalJs, close } = await cdp();
await evalJs(`location.hash='#/expenses'`);
await sleep(800);
await evalJs(`(document.querySelector('a[href*="#/book/"]')||{}).click?.()`);
await sleep(1200);
for (let i = 0; i < 5; i++) {
  await evalJs(`document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));`);
  await sleep(250);
}
await evalJs(`([...document.querySelectorAll('button,[role=button]')].find(b=>/^close$|^×$|^✕$/i.test((b.getAttribute('aria-label')||b.textContent||'').trim()))||{}).click?.()`);
await sleep(500);
const info = await evalJs(`(() => {
  const fab = document.querySelector('.dash-fab-center');
  const books = document.querySelector('.dash-tab-books');
  const act = document.querySelector('.dash-tab-activity');
  const mid = (el) => { if (!el) return null; const r = el.getBoundingClientRect(); return (r.left + r.right) / 2; };
  const fm = mid(fab), bm = mid(books), am = mid(act);
  return {
    hash: location.hash,
    fabVis: !!(fab && (() => { const r = fab.getBoundingClientRect(); return r.height > 40 && r.top < innerHeight; })()),
    left: fm != null && bm != null ? Math.round(fm - bm) : null,
    right: fm != null && am != null ? Math.round(am - fm) : null,
    sheet: !!(document.querySelector('[role="dialog"]') || document.body.innerText.match(/Edit expense|Add expense/i)),
  };
})()`);
console.log(JSON.stringify(info));
close();
adb(`shell screencap -p /sdcard/byjan-nav-final.png`);
spawnSync(ADB, ['-s', SERIAL, 'pull', '/sdcard/byjan-nav-final.png', OUT], { encoding: 'utf8', stdio: 'inherit' });
console.log(info.fabVis && info.left === info.right && !info.sheet ? 'NAV_SHOT_OK' : 'NAV_SHOT_CHECK');

/**
 * Navigate to an open money book and assert FAB + tab balance.
 */
import http from 'http';
import WebSocket from 'ws';
import { spawnSync } from 'child_process';
import { join } from 'path';
import { copyFileSync } from 'fs';

const PKG = 'com.byjanbooks.app';
const SERIAL = process.env.BYJAN_SERIAL || 'ZD222LNHM5';
const ADB = join(process.env.LOCALAPPDATA || '', 'Android', 'Sdk', 'platform-tools', 'adb.exe');
const EMAIL = process.env.BYJAN_EMAIL || 'badrinathp316@gmail.com';
const PASS = process.env.BYJAN_PASS || '123456';

function adb(args) {
  const r = spawnSync(ADB, ['-s', SERIAL, ...args.split(' ').filter(Boolean)], { encoding: 'utf8' });
  return (r.stdout || '').trim();
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function cdp() {
  const pid = String(adb(`shell pidof ${PKG}`) || '').trim().split(/\s+/)[0];
  if (!pid) throw new Error('app not running');
  try { spawnSync(ADB, ['-s', SERIAL, 'forward', '--remove', 'tcp:9222'], { encoding: 'utf8' }); } catch {}
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

await sleep(2500);
const { evalJs, close } = await cdp();

let signedIn = await evalJs(`!/#\\/(login|register)/i.test(location.hash) && !/sign in to byjan/i.test(document.body.innerText||'')`);
if (!signedIn) {
  await evalJs(`location.hash='#/login'`);
  await sleep(900);
  await evalJs(`(() => {
    const set = (el, v) => { if (!el) return; el.focus(); el.value = v; el.dispatchEvent(new Event('input',{bubbles:true})); };
    set(document.querySelector('input[type="email"]'), ${JSON.stringify(EMAIL)});
    set(document.querySelector('input[type="password"]'), ${JSON.stringify(PASS)});
    const btn = [...document.querySelectorAll('button')].find(b => /sign in/i.test(b.textContent||'') && !/google/i.test(b.textContent||''));
    (btn || document.querySelector('form button[type="submit"]'))?.click();
  })()`);
  await sleep(4000);
}

const bookHref = await evalJs(`(() => {
  const a = [...document.querySelectorAll('a[href*="#/book/"]')].find(Boolean)
    || [...document.querySelectorAll('a')].find(x => /#\\/book\\//.test(x.getAttribute('href')||''));
  return a ? (a.getAttribute('href') || '') : '';
})()`);
if (bookHref) {
  const hash = bookHref.includes('#') ? bookHref.slice(bookHref.indexOf('#')) : bookHref;
  await evalJs(`location.hash = ${JSON.stringify(hash.startsWith('#') ? hash : '#/')}`);
} else {
  await evalJs(`location.hash='#/expenses'`);
  await sleep(1200);
  await evalJs(`(() => {
    const a = [...document.querySelectorAll('a')].find(x => /#\\/book\\//.test(x.getAttribute('href')||''));
    if (a) location.hash = a.getAttribute('href').slice(a.getAttribute('href').indexOf('#'));
  })()`);
}
await sleep(1800);

const info = await evalJs(`(() => {
  const bar = document.querySelector('.dash-tabbar');
  const fab = document.querySelector('.dash-fab-center');
  const books = document.querySelector('.dash-tab-books');
  const home = document.querySelector('.dash-tab-home');
  const act = document.querySelector('.dash-tab-activity');
  const more = document.querySelector('.dash-tab-more');
  const mid = (el) => { if (!el) return null; const r = el.getBoundingClientRect(); return (r.left + r.right) / 2; };
  const box = (el) => { if (!el) return null; const r = el.getBoundingClientRect(); return { t:r.top,b:r.bottom,l:r.left,r:r.right,w:r.width,h:r.height,vis:r.width>8&&r.height>8&&r.bottom>0&&r.top<innerHeight }; };
  const fabMid = mid(fab); const booksMid = mid(books); const homeMid = mid(home); const actMid = mid(act); const moreMid = mid(more);
  const leftGap = fabMid != null && booksMid != null ? fabMid - booksMid : null;
  const rightGap = fabMid != null && actMid != null ? actMid - fabMid : null;
  return {
    hash: location.hash,
    hasFabClass: bar?.classList.contains('has-fab'),
    children: bar ? [...bar.children].map(c => c.className) : [],
    areas: bar ? getComputedStyle(bar).gridTemplateAreas : null,
    fab: box(fab),
    books: box(books),
    homeMid, booksMid, fabMid, actMid, moreMid,
    leftGap: leftGap != null ? Math.round(leftGap) : null,
    rightGap: rightGap != null ? Math.round(rightGap) : null,
    balanced: leftGap != null && rightGap != null ? Math.abs(leftGap - rightGap) < 28 : false,
    fabVisible: Boolean(fab && box(fab)?.vis && (box(fab)?.h||0) > 40),
    plusGlyph: Boolean(fab?.querySelector('svg')),
  };
})()`);

console.log(JSON.stringify(info, null, 2));
adb('shell screencap -p /sdcard/byjan-fab-check.png');
spawnSync(ADB, ['-s', SERIAL, 'pull', '/sdcard/byjan-fab-check.png', 'tmp-phone-retest-04b-fab-open.png'], { encoding: 'utf8' });
close();

const ok = info.fabVisible && info.plusGlyph && info.balanced && info.hasFabClass;
if (!ok) {
  console.error('FAB_CHECK_FAIL');
  process.exit(1);
}
console.log('FAB_CHECK_OK');

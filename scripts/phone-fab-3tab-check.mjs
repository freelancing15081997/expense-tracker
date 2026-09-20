/**
 * Test the REAL broken case: book page FAB with Activity OFF (3 menus + +).
 * Force money_activity off in the live session, then measure Books↔+↔spacer.
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
const OUT = join(process.cwd(), 'tmp-phone-nav-3tab.png');

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
await sleep(5000);

const auth = await evalJs(`({ hash: location.hash, bad: /email or password is incorrect/i.test(document.body.innerText||'') })`);
if (auth.bad || /#\/?login/i.test(String(auth.hash || ''))) {
  console.log('LOGIN_FAIL', auth);
  close();
  process.exit(1);
}
console.log('LOGIN_OK');

// Open book
await evalJs(`location.hash='#/expenses'`);
await sleep(1000);
await evalJs(`(document.querySelector('a[href*="#/book/"]')||{}).click?.()`);
await sleep(1500);
for (let i = 0; i < 4; i++) {
  await evalJs(`document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));`);
  await sleep(200);
}

const before = await evalJs(`({
  tabs: [...document.querySelectorAll('.dash-tab')].map(t => (t.textContent||'').trim().replace(/\\s+/g,' ') || t.className),
  hasActivityLink: Boolean(document.querySelector('a.dash-tab-activity')),
  hasSpacer: Boolean(document.querySelector('.dash-tab-spacer')),
})`);
console.log('BEFORE_FORCE', JSON.stringify(before));

// Force Activity OFF in the live DOM the way Layout would: remove Activity link, ensure spacer in activity slot
const forced = await evalJs(`(() => {
  const bar = document.querySelector('.dash-tabbar.has-fab');
  if (!bar) return { ok: false, reason: 'no-fab-bar' };
  const act = bar.querySelector('a.dash-tab-activity, .dash-tab-activity:not(.dash-tab-spacer)');
  if (act && act.tagName === 'A') {
    const spacer = document.createElement('span');
    spacer.className = 'dash-tab dash-tab-activity dash-tab-spacer';
    spacer.setAttribute('aria-hidden', 'true');
    act.replaceWith(spacer);
  } else if (!bar.querySelector('.dash-tab-spacer')) {
    const fab = bar.querySelector('.dash-fab-slot');
    const spacer = document.createElement('span');
    spacer.className = 'dash-tab dash-tab-activity dash-tab-spacer';
    spacer.setAttribute('aria-hidden', 'true');
    if (fab && fab.nextSibling) bar.insertBefore(spacer, fab.nextSibling);
    else bar.appendChild(spacer);
  }
  bar.setAttribute('data-tabs', '5');
  // Hide any leftover Activity text nodes
  return {
    ok: true,
    tabs: [...bar.querySelectorAll('.dash-tab')].map(t => (t.textContent||'').trim().replace(/\\s+/g,' ') || t.className),
    children: [...bar.children].map(c => c.className),
    spacerDisplay: getComputedStyle(bar.querySelector('.dash-tab-spacer')).display,
  };
})()`);
console.log('FORCED_3TAB', JSON.stringify(forced));
await sleep(300);

const m = await evalJs(`(() => {
  const bar = document.querySelector('.dash-tabbar');
  const fab = document.querySelector('.dash-fab-center');
  const books = document.querySelector('.dash-tab-books');
  const act = document.querySelector('.dash-tab-activity'); // spacer or link
  const mid = (el) => { if (!el) return null; const r = el.getBoundingClientRect(); return (r.left + r.right) / 2; };
  const box = (el) => { if (!el) return null; const r = el.getBoundingClientRect(); return { t:r.top,b:r.bottom,l:r.left,r:r.right,w:r.width,h:r.height }; };
  const fm = mid(fab), bm = mid(books), am = mid(act);
  const left = fm!=null&&bm!=null ? Math.round(fm-bm) : null;
  const right = fm!=null&&am!=null ? Math.round(am-fm) : null;
  const fabBox = box(fab), booksBox = box(books);
  const raised = fabBox && booksBox ? Math.round(booksBox.t - fabBox.t) : null;
  const cs = bar ? getComputedStyle(bar) : null;
  const visibleTabLabels = [...document.querySelectorAll('a.dash-tab')].map(t => (t.textContent||'').trim().replace(/\\s+/g,' '));
  return {
    visibleTabLabels,
    menuCount: visibleTabLabels.length,
    hasSpacer: Boolean(document.querySelector('.dash-tab-spacer')),
    spacerDisplay: document.querySelector('.dash-tab-spacer') ? getComputedStyle(document.querySelector('.dash-tab-spacer')).display : null,
    areas: cs?.gridTemplateAreas,
    cols: cs?.gridTemplateColumns,
    booksMid: bm, fabMid: fm, rightSlotMid: am,
    leftGap: left, rightGap: right,
    balanced: left!=null&&right!=null && Math.abs(left-right)<=8,
    raisedPx: raised,
    fabAboveIcons: raised!=null && raised>=8,
    fabVis: !!(fabBox && fabBox.h>40),
    children: [...(bar?.children||[])].map(c=>c.className),
  };
})()`);

console.log(JSON.stringify(m, null, 2));
const ok = m && m.menuCount === 3 && m.hasSpacer && m.spacerDisplay !== 'none' && m.balanced && m.fabAboveIcons && m.fabVis;
console.log(ok ? 'NAV_3TAB_FAB_OK' : 'NAV_3TAB_FAB_FAIL');

adb(`shell screencap -p /sdcard/byjan-nav-3tab.png`);
spawnSync(ADB, ['-s', SERIAL, 'pull', '/sdcard/byjan-nav-3tab.png', OUT], { encoding: 'utf8', stdio: 'inherit' });
close();
process.exit(ok ? 0 : 1);

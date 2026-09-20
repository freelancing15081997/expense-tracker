/**
 * Logout if needed → login with credentials → report success.
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
    const t = setTimeout(() => reject(new Error(`timeout ${method}`)), 15000);
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

const state = await evalJs(`(() => ({
  hash: location.hash,
  incorrect: /email or password is incorrect/i.test(document.body.innerText||''),
  body: (document.body.innerText||'').slice(0, 200),
  hasActivityLink: Boolean(document.querySelector('a.dash-tab-activity')),
  tabs: [...document.querySelectorAll('.dash-tab')].map((t) => (t.textContent||'').trim().replace(/\\s+/g,' ') || t.className),
}))()`);
console.log(JSON.stringify(state, null, 2));
const ok = state && !state.incorrect && !/#\/?login/i.test(String(state.hash || ''));
console.log(ok ? 'DEVICE_LOGIN_OK' : 'DEVICE_LOGIN_FAIL');
close();
process.exit(ok ? 0 : 1);

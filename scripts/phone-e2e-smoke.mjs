/**
 * Read-only phone smoke: Home, Books ledger tools, Settings, Help, Reports.
 */
import { execSync } from 'node:child_process';
import { join } from 'node:path';

const SERIAL = process.env.BYJAN_SERIAL || 'ZD222LNHM5';
const PKG = 'com.byjanbooks.app';
const EMAIL = 'badrinathp316@gmail.com';
const PASS = '123456';
const ADB = process.platform === 'win32'
  ? join(process.env.LOCALAPPDATA || '', 'Android', 'Sdk', 'platform-tools', 'adb.exe')
  : 'adb';

const fails = [];
function adb(args) {
  return execSync(`"${ADB}" -s ${SERIAL} ${args}`, { encoding: 'utf8' }).trim();
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function cdp(url) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    const pending = new Map();
    let n = 0;
    const send = (method, params = {}) =>
      new Promise((res, rej) => {
        const id = ++n;
        pending.set(id, { res, rej });
        ws.send(JSON.stringify({ id, method, params }));
      });
    ws.addEventListener('open', () => resolve({ ws, send }));
    ws.addEventListener('error', reject);
    ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(String(ev.data));
      if (msg.id && pending.has(msg.id)) {
        const { res, rej } = pending.get(msg.id);
        pending.delete(msg.id);
        if (msg.error) rej(new Error(JSON.stringify(msg.error)));
        else res(msg.result);
      }
    });
  });
}

async function evalJs(send, expression) {
  const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (result?.exceptionDetails) throw new Error(result.exceptionDetails.text || 'eval');
  return result?.result?.value;
}

function check(name, pass, data) {
  console.log(pass ? 'PASS' : 'FAIL', name, JSON.stringify(data));
  if (!pass) fails.push(name);
}

async function attach() {
  adb(`shell am force-stop ${PKG}`);
  await sleep(700);
  try { adb(`shell am start -n ${PKG}/com.byjanbooks.com.MainActivity`); }
  catch { adb(`shell monkey -p ${PKG} -c android.intent.category.LAUNCHER 1`); }
  await sleep(4000);
  let pid = '';
  for (let i = 0; i < 10; i++) {
    pid = String(adb(`shell pidof ${PKG}`) || '').trim().split(/\s+/)[0];
    if (pid) break;
    await sleep(600);
  }
  try { execSync(`"${ADB}" -s ${SERIAL} forward --remove tcp:9222`, { stdio: 'ignore' }); } catch { /* */ }
  adb(`forward tcp:9222 localabstract:webview_devtools_remote_${pid}`);
  for (let i = 0; i < 12; i++) {
    await sleep(600);
    try {
      const list = await fetch('http://127.0.0.1:9222/json').then((r) => r.json());
      const page = (Array.isArray(list) ? list : []).find((t) => t.webSocketDebuggerUrl);
      if (page?.webSocketDebuggerUrl) return page.webSocketDebuggerUrl;
    } catch { /* retry */ }
  }
  throw new Error('no webview');
}

const { send, ws } = await cdp(await attach());
await send('Runtime.enable');

const loginIfNeeded = async () => {
  const state = await evalJs(send, `({ hash: location.hash, tabs: document.querySelectorAll('.dash-tab').length, text: (document.body.innerText||'').slice(0,200) })`);
  if (state.tabs && !/sign in|welcome back/i.test(state.text)) return;
  await evalJs(send, `(() => {
    [...document.querySelectorAll('button')].find((b) => /skip|continue to sign in/i.test(b.textContent || ''))?.click();
    return true;
  })()`);
  await sleep(600);
  await evalJs(send, `(() => {
    const set = (el, v) => {
      if (!el) return;
      Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(el, v);
      el.dispatchEvent(new Event('input', { bubbles: true }));
    };
    set(document.querySelector('input[type="email"]'), ${JSON.stringify(EMAIL)});
    set(document.querySelector('input[type="password"]'), ${JSON.stringify(PASS)});
    [...document.querySelectorAll('button')].find((b) => /sign in/i.test(b.textContent || ''))?.click();
    return true;
  })()`);
  await sleep(4000);
};

await loginIfNeeded();
await evalJs(send, `location.hash = '#/'`);
await sleep(1200);
const home = await evalJs(send, `({
  tabs: [...document.querySelectorAll('.dash-tab')].map((t) => t.textContent.trim()),
  crashed: /This screen could not open|Minified React error/i.test(document.body.innerText || ''),
})`);
check('home', home.tabs.includes('Home') && home.tabs.includes('More') && !home.crashed, home);

await evalJs(send, `document.querySelector('.dash-tab-more')?.click()`);
await sleep(1400);
const settings = await evalJs(send, `(() => {
  const text = document.body.innerText || '';
  return {
    hash: location.hash,
    heading: /Settings/i.test(text) && /Preferences/i.test(text),
    display: /Text size|Icon size|Display/i.test(text),
    help: /Help/i.test(text),
    crashed: /This screen could not open|Minified React error|Maximum update depth/i.test(text),
  };
})()`);
check('settings', settings.heading && settings.display && !settings.crashed, settings);

await evalJs(send, `location.hash = '#/settings'`);
await sleep(1400);
const upi = await evalJs(send, `(() => {
  const text = document.body.innerText || '';
  return {
    hash: location.hash,
    upi: /UPI for settlements|Your UPI|Add UPI ID|Update UPI ID|No UPI ID yet/i.test(text),
    emailHint: /real inbox|notifications/i.test(text),
    crashed: /This screen could not open|Minified React error|Maximum update depth/i.test(text),
  };
})()`);
check('settings-upi-email', /settings/i.test(upi.hash) && upi.upi && upi.emailHint && !upi.crashed, upi);

await evalJs(send, `location.hash = '#/help'`);
await sleep(1200);
const help = await evalJs(send, `({ hash: location.hash, ok: /Help|ticket/i.test(document.body.innerText || ''), crashed: /This screen could not open|Minified React error/i.test(document.body.innerText || '') })`);
check('help', /help/i.test(help.hash) && help.ok && !help.crashed, help);

await evalJs(send, `location.hash = '#/reports'`);
await sleep(1500);
const reports = await evalJs(send, `({ hash: location.hash, ok: /Reports|insights|Period snapshot/i.test(document.body.innerText || '') })`);
check('reports', /reports/i.test(reports.hash) && reports.ok, reports);

await evalJs(send, `location.hash = '#/expenses'`);
await sleep(1400);
await evalJs(send, `(() => {
  const links = [...document.querySelectorAll('a[href*="book/"]')];
  const ledger = links.find((a) => !/pay=/.test(a.getAttribute('href') || ''));
  (ledger || links[0])?.click();
  return true;
})()`);
await sleep(2200);
const book = await evalJs(send, `(() => {
  const text = document.body.innerText || '';
  return {
    hash: location.hash,
    pay: /pay=/.test(location.hash),
    filter: Boolean(document.querySelector('button[title="Filters"]')),
    download: Boolean(document.querySelector('button[title="Download report"], button[title="Export"]')),
    crashed: /This screen could not open|Minified React error/i.test(text),
  };
})()`);
check('book-ledger-tools', /book\//i.test(book.hash) && !book.pay && book.filter && book.download && !book.crashed, book);

if (book.download) {
  await evalJs(send, `document.querySelector('button[title="Download report"], button[title="Export"]')?.click()`);
  await sleep(600);
  const menu = await evalJs(send, `({ pdf: /PDF report/i.test(document.body.innerText || ''), csv: /CSV/i.test(document.body.innerText || '') })`);
  check('book-export-menu', menu.pdf && menu.csv, menu);
}

await evalJs(send, `location.hash = '#/'`);
await sleep(400);
ws.close();
console.log(fails.length ? `SMOKE_FAIL ${fails.join(',')}` : 'SMOKE_OK');
if (fails.length) process.exit(2);

/**
 * Thorough phone retest — FAB +, tabs, home, books, pay, settings, minor actions.
 */
import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync, copyFileSync } from 'node:fs';
import { join } from 'node:path';

const SERIAL = process.env.BYJAN_SERIAL || 'ZD222LNHM5';
const PKG = 'com.byjanbooks.app';
const EMAIL = 'badrinathp316@gmail.com';
const PASS = '123456';
const OUT = join(process.cwd(), 'tmp-retest');
mkdirSync(OUT, { recursive: true });

const ADB = process.platform === 'win32'
  ? join(process.env.LOCALAPPDATA || '', 'Android', 'Sdk', 'platform-tools', 'adb.exe')
  : 'adb';

const fails = [];
const steps = [];

function adb(args) {
  return execSync(`"${ADB}" -s ${SERIAL} ${args}`, { encoding: 'utf8' }).trim();
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function shot(name) {
  try {
    adb('shell screencap -p /sdcard/byjan-retest.png');
    const dest = join(OUT, `${name}.png`);
    execSync(`"${ADB}" -s ${SERIAL} pull /sdcard/byjan-retest.png "${dest}"`, { stdio: 'pipe' });
    copyFileSync(dest, join(process.cwd(), `tmp-phone-retest-${name}.png`));
  } catch (e) {
    steps.push({ name: `shot:${name}`, pass: false, data: String(e.message || e) });
  }
}

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
        pending.delete(id);
        if (msg.error) rej(new Error(JSON.stringify(msg.error)));
        else res(msg.result);
      }
    });
  });
}

// fix typo in above - pending.delete(msg.id) not id
function cdpFixed(url) {
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
  steps.push({ name, pass, data });
  console.log(pass ? 'PASS' : 'FAIL', name, JSON.stringify(data));
  if (!pass) fails.push(name);
}

async function attach() {
  adb(`shell am force-stop ${PKG}`);
  await sleep(800);
  try { adb(`shell am start -n ${PKG}/com.byjanbooks.com.MainActivity`); }
  catch { adb(`shell monkey -p ${PKG} -c android.intent.category.LAUNCHER 1`); }
  await sleep(4500);
  let pid = '';
  for (let i = 0; i < 12; i++) {
    pid = String(adb(`shell pidof ${PKG}`) || '').trim().split(/\s+/)[0];
    if (pid) break;
    await sleep(500);
  }
  try { execSync(`"${ADB}" -s ${SERIAL} forward --remove tcp:9222`, { stdio: 'ignore' }); } catch { /* */ }
  adb(`forward tcp:9222 localabstract:webview_devtools_remote_${pid}`);
  for (let i = 0; i < 15; i++) {
    await sleep(500);
    try {
      const list = await fetch('http://127.0.0.1:9222/json').then((r) => r.json());
      const page = (Array.isArray(list) ? list : []).find((t) => t.webSocketDebuggerUrl);
      if (page?.webSocketDebuggerUrl) return page.webSocketDebuggerUrl;
    } catch { /* */ }
  }
  throw new Error('no webview');
}

const { send, ws } = await cdpFixed(await attach());
await send('Runtime.enable');

await evalJs(send, `(() => {
  [...document.querySelectorAll('button')].find((b) => /skip|continue to sign in/i.test(b.textContent || ''))?.click();
  return true;
})()`);
await sleep(700);
const needLogin = await evalJs(send, `/sign in|welcome back/i.test(document.body.innerText||'')`);
if (needLogin) {
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
  await sleep(4500);
}

await evalJs(send, `location.hash = '#/'`);
await sleep(1600);
shot('01-home');

const fab = await evalJs(send, `(() => {
  const bar = document.querySelector('.dash-tabbar');
  const btn = document.querySelector('.dash-fab-center');
  const anchor = document.querySelector('.dash-fab-anchor');
  const tabs = [...document.querySelectorAll('.dash-tab')].map((t) => (t.textContent || '').trim());
  if (!btn) {
    return {
      exists: false,
      tabs,
      dataFab: bar?.getAttribute('data-fab'),
      dataTabs: bar?.getAttribute('data-tabs'),
      hasFabClass: bar?.classList.contains('has-fab'),
      barDisplay: bar ? getComputedStyle(bar).display : null,
      barHtml: bar ? bar.outerHTML.slice(0, 500) : null,
    };
  }
  const r = btn.getBoundingClientRect();
  const ar = anchor?.getBoundingClientRect();
  const cs = getComputedStyle(btn);
  const acs = anchor ? getComputedStyle(anchor) : null;
  const vh = window.innerHeight;
  const vw = window.innerWidth;
  return {
    exists: true,
    tabs,
    dataFab: bar?.getAttribute('data-fab'),
    dataTabs: bar?.getAttribute('data-tabs'),
    hasFabClass: bar?.classList.contains('has-fab'),
    visible: r.width > 20 && r.height > 20 && r.bottom > 0 && r.top < vh && cs.visibility !== 'hidden' && cs.display !== 'none' && Number(cs.opacity) > 0.2,
    rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), top: Math.round(r.top), bottom: Math.round(r.bottom) },
    anchorRect: ar ? { x: Math.round(ar.x), y: Math.round(ar.y), w: Math.round(ar.width), h: Math.round(ar.height) } : null,
    opacity: cs.opacity,
    zIndex: cs.zIndex,
    pointerEvents: cs.pointerEvents,
    transform: cs.transform,
    anchorTransform: acs?.transform || null,
    anchorPointer: acs?.pointerEvents || null,
    viewport: { vw, vh },
    clippedOffTop: r.bottom < 0,
    clippedOffBottom: r.top > vh,
    underNav: bar ? r.bottom > bar.getBoundingClientRect().top + 8 : null,
    label: btn.getAttribute('aria-label'),
  };
})()`);

check('fab-exists', Boolean(fab.exists), fab);
check('fab-visible', Boolean(fab.exists && fab.visible), {
  visible: fab.visible,
  rect: fab.rect,
  underNav: fab.underNav,
  opacity: fab.opacity,
  pointerEvents: fab.pointerEvents,
  anchorPointer: fab.anchorPointer,
});

if (fab.exists) {
  await evalJs(send, `document.querySelector('.dash-fab-center')?.click()`);
  await sleep(900);
  shot('02-fab-open');
  const orbit = await evalJs(send, `(() => {
    const items = [...document.querySelectorAll('.dash-fab-item')].map((el) => ({
      label: (el.querySelector('.dash-fab-label')?.textContent || '').trim(),
      rect: (() => { const r = el.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height), y: Math.round(r.y) }; })(),
    }));
    const open = document.querySelector('.dash-fab-center')?.getAttribute('data-open');
    const scrim = Boolean(document.querySelector('.dash-fab-scrim'));
    return { open, scrim, items, count: items.length };
  })()`);
  check('fab-orbit-open', orbit.open === 'true' && orbit.count >= 1, orbit);
  await evalJs(send, `document.querySelector('.dash-fab-scrim')?.click() || document.querySelector('.dash-fab-center')?.click()`);
  await sleep(500);
}

const home = await evalJs(send, `(() => {
  const text = document.body.innerText || '';
  return {
    crashed: /This screen could not open|Minified React error/i.test(text),
    hasAmount: /₹|Rs|INR|\\d/.test(text),
    pills: [...document.querySelectorAll('.home-pill')].map((b) => (b.textContent || '').trim()),
    invite: Boolean(document.querySelector('.home-invite-rail')),
    attention: Boolean(document.querySelector('.home-attention')),
    inbox: Boolean(document.querySelector('[aria-label="Financial inbox"]')),
    upcoming: Boolean(document.querySelector('[aria-label="Upcoming payments"]')),
    pay: Boolean(document.querySelector('[aria-label="Pending payments"]')),
    qa: [...document.querySelectorAll('.home-qa-tile')].map((a) => (a.textContent || '').trim()),
  };
})()`);
check('home-screen', !home.crashed && home.pills.length >= 1, home);

await evalJs(send, `document.querySelector('.dash-tab-books')?.click()`);
await sleep(1400);
shot('03-books');
const books = await evalJs(send, `(() => {
  const cards = document.querySelectorAll('.md3-book').length;
  const text = document.body.innerText || '';
  return { cards, crashed: /Minified React error/i.test(text), hash: location.hash };
})()`);
check('books-list', books.cards >= 0 && !books.crashed, books);

const bookLink = await evalJs(send, `(() => {
  const a = document.querySelector('.md3-book-main') || document.querySelector('a[href*="#/book/"]');
  if (a) { a.click(); return a.getAttribute('href') || true; }
  return false;
})()`);
await sleep(1800);
shot('04-book');
const book = await evalJs(send, `(() => {
  const text = document.body.innerText || '';
  const entries = document.querySelectorAll('.entry-card-mobile, .mb-entry').length;
  const tabs = [...document.querySelectorAll('.book-tab')].map((t) => (t.textContent || '').trim());
  const fab = document.querySelector('.dash-fab-center');
  const fr = fab?.getBoundingClientRect();
  return {
    hash: location.hash,
    entries,
    tabs,
    filter: Boolean(document.querySelector('[title="Filters"], .byjan-tool-btn')),
    download: Boolean(document.querySelector('[title="Download report"]')),
    crashed: /Minified React error|This screen could not open/i.test(text),
    fabVisible: fab ? (fr.width > 20 && fr.top < innerHeight && fr.bottom > 0) : false,
    fabY: fr ? Math.round(fr.y) : null,
  };
})()`);
check('book-open', Boolean(bookLink) && !book.crashed, { bookLink, ...book });
check('fab-on-book', book.fabVisible === true, { fabVisible: book.fabVisible, fabY: book.fabY });

await evalJs(send, `document.querySelector('[title="Download report"]')?.click()`);
await sleep(700);
const exportMenu = await evalJs(send, `(() => {
  const text = document.body.innerText || '';
  return { pdf: /PDF/i.test(text), csv: /CSV/i.test(text) };
})()`);
check('export-menu', exportMenu.pdf && exportMenu.csv, exportMenu);
await evalJs(send, `document.querySelector('.fixed.inset-0')?.click()`);
await sleep(400);

await evalJs(send, `document.querySelector('.dash-tab-activity')?.click()`);
await sleep(1200);
shot('05-activity');
const activity = await evalJs(send, `({ hash: location.hash, crashed: /Minified React error/i.test(document.body.innerText||'') })`);
check('activity', /activity/i.test(activity.hash) && !activity.crashed, activity);

await evalJs(send, `document.querySelector('.dash-tab-more')?.click()`);
await sleep(1200);
shot('06-more');
const settings = await evalJs(send, `(() => {
  const text = document.body.innerText || '';
  return {
    hash: location.hash,
    display: /display|icon|type|font/i.test(text),
    upi: /upi/i.test(text),
    help: Boolean([...document.querySelectorAll('a,button')].find((el) => /help/i.test(el.textContent||''))),
    crashed: /Minified React error/i.test(text),
  };
})()`);
check('settings', /settings/i.test(settings.hash) && settings.display && !settings.crashed, settings);

await evalJs(send, `location.hash = '#/reports'`);
await sleep(1200);
shot('07-reports');
const reports = await evalJs(send, `({ hash: location.hash, ok: /report/i.test(document.body.innerText||''), crashed: /Minified React error/i.test(document.body.innerText||'') })`);
check('reports', /reports/i.test(reports.hash) && !reports.crashed, reports);

await evalJs(send, `location.hash = '#/help'`);
await sleep(1000);
const help = await evalJs(send, `({ hash: location.hash, ok: /help|faq|support/i.test(document.body.innerText||'') })`);
check('help', /help/i.test(help.hash) && help.ok, help);

await evalJs(send, `location.hash = '#/'`);
await sleep(1000);
if (home.pills.includes('Add') || home.pills.some((p) => /add/i.test(p))) {
  await evalJs(send, `[...document.querySelectorAll('.home-pill')].find((b) => /add/i.test(b.textContent||''))?.click()`);
  await sleep(1000);
  shot('08-add-pick');
  const pick = await evalJs(send, `(() => {
    const sheet = document.querySelector('[role="dialog"], .book-pick, .bps-sheet');
    const text = document.body.innerText || '';
    return { open: Boolean(sheet) || /pick a book|choose a book|select book/i.test(text), text: text.slice(0, 180) };
  })()`);
  check('home-add-pick', pick.open, pick);
  await evalJs(send, `document.querySelector('[aria-label="Close"], .bps-close, button')?.closest('[role="dialog"]')`);
  await evalJs(send, `(() => {
    [...document.querySelectorAll('button')].find((b) => /close|cancel/i.test(b.textContent||'') || b.getAttribute('aria-label')==='Close')?.click();
    document.querySelector('.fixed.inset-0')?.click();
    return true;
  })()`);
  await sleep(500);
}

await evalJs(send, `location.hash = '#/'`);
await sleep(800);
shot('99-final');

writeFileSync(join(OUT, 'report.json'), JSON.stringify({ fails, steps }, null, 2));
console.log(fails.length ? `RETEST_FAIL ${fails.join(',')}` : 'RETEST_OK');
ws.close();
process.exit(fails.length ? 1 : 0);

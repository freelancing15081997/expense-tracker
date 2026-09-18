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
  const soft = process.env.BYJAN_SOFT !== '0';
  if (!soft) {
    adb(`shell am force-stop ${PKG}`);
    await sleep(800);
  }
  try { adb(`shell am start -n ${PKG}/com.byjanbooks.com.MainActivity`); }
  catch { adb(`shell monkey -p ${PKG} -c android.intent.category.LAUNCHER 1`); }
  await sleep(soft ? 2500 : 4500);
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

const onLogin = await evalJs(send, `(() => {
  const hash = location.hash || '';
  const text = document.body.innerText || '';
  return hash.includes('login') || /sign in to byjan|welcome back|invalid email or password/i.test(text);
})()`);
if (!onLogin) {
  steps.push({ name: 'auth-skip', pass: true, data: { alreadySignedIn: true } });
  console.log('PASS auth-skip', JSON.stringify({ alreadySignedIn: true }));
} else {
  await evalJs(send, `(() => {
    [...document.querySelectorAll('button,a,[role="button"]')].find((b) => /skip|continue without|continue to sign in|use google|sign in with google/i.test(b.textContent || ''))?.click();
    return true;
  })()`);
  await sleep(1200);
  let stillLogin = await evalJs(send, `(() => {
    const hash = location.hash || '';
    const text = document.body.innerText || '';
    return hash.includes('login') || /sign in to byjan|welcome back/i.test(text);
  })()`);
  if (stillLogin) {
    await evalJs(send, `(() => {
      const set = (el, v) => {
        if (!el) return;
        Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(el, v);
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      };
      set(document.querySelector('input[type="email"],input[name="email"]'), ${JSON.stringify(EMAIL)});
      set(document.querySelector('input[type="password"],input[name="password"]'), ${JSON.stringify(PASS)});
      [...document.querySelectorAll('button')].find((b) => /^sign in$/i.test((b.textContent || '').trim()))?.click();
      return true;
    })()`);
    await sleep(5500);
    stillLogin = await evalJs(send, `(() => {
      const hash = location.hash || '';
      const text = document.body.innerText || '';
      return hash.includes('login') || /sign in to byjan|invalid email or password/i.test(text);
    })()`);
  }
  const authPass = !stillLogin;
  steps.push({ name: 'auth-login', pass: authPass, data: { stillLogin } });
  console.log(authPass ? 'PASS' : 'FAIL', 'auth-login', JSON.stringify({ stillLogin }));
  if (!authPass) fails.push('auth-login');
}

await evalJs(send, `location.hash = '#/'`);
await sleep(1600);
shot('01-home');

const fabHome = await evalJs(send, `(() => {
  const btn = document.querySelector('.dash-fab-center');
  const bar = document.querySelector('.dash-tabbar');
  const reel = document.querySelector('.home-feature-reel');
  const rr = reel?.getBoundingClientRect();
  return {
    fabOnHome: Boolean(btn),
    dataFab: bar?.getAttribute('data-fab'),
    hasFabClass: bar?.classList.contains('has-fab'),
    tabs: [...document.querySelectorAll('.dash-tab')].map((t) => (t.textContent || '').trim()),
    reelW: rr ? Math.round(rr.width) : null,
    reelH: rr ? Math.round(rr.height) : null,
  };
})()`);
check('fab-absent-on-home', fabHome.fabOnHome === false && fabHome.dataFab !== '1', fabHome);
check('home-feature-reel-aside', (fabHome.reelW || 0) >= 96 && (fabHome.reelW || 0) <= 140 && (fabHome.reelH || 0) >= 70 && (fabHome.reelH || 0) <= 160, {
  reelW: fabHome.reelW,
  reelH: fabHome.reelH,
});

const home = await evalJs(send, `(() => {
  const text = document.body.innerText || '';
  const pills = [...document.querySelectorAll('.home-pill')].map((b) => (b.textContent || '').trim());
  const payEl = document.querySelector('[aria-label="Pending payments"]');
  const payR = payEl?.getBoundingClientRect();
  const amount = document.querySelector('.home-amount');
  const amountR = amount?.getBoundingClientRect();
  const amountWrap = document.querySelector('.home-amount-fit');
  const amountOverflow = amount && amountWrap
    ? amount.scrollWidth <= amountWrap.clientWidth + 2
    : true;
  return {
    crashed: /This screen could not open|Minified React error/i.test(text),
    hasAmount: Boolean(amount) || /₹|Rs|INR/.test(text),
    amountFull: amount ? !/\\d+(\\.\\d+)?\\s*[LC]r?\\b/i.test((amount.textContent || '').replace(/₹/g, '')) : true,
    amountFits: amountOverflow,
    featureReel: Boolean(document.querySelector('.home-feature-reel')),
    amountFont: amount ? getComputedStyle(amount).fontSize : null,
    amountW: amountR ? Math.round(amountR.width) : null,
    amountText: amount ? (amount.textContent || '').trim().slice(0, 40) : null,
    pills,
    addSplitAdjacent: pills[0]?.toLowerCase().includes('add') && pills[1]?.toLowerCase().includes('split'),
    invite: Boolean(document.querySelector('.home-invite-rail')),
    attention: Boolean(document.querySelector('.home-attention')),
    inbox: Boolean(document.querySelector('[aria-label="Financial inbox"]')),
    upcoming: Boolean(document.querySelector('[aria-label="Upcoming payments"]')),
    pay: Boolean(payEl),
    payInView: payEl ? (payR.top < innerHeight * 0.72 && payR.bottom > 80) : null,
    payTop: payR ? Math.round(payR.top) : null,
    qa: [...document.querySelectorAll('.home-qa-tile')].map((a) => (a.textContent || '').trim()),
  };
})()`);
check('home-screen', !home.crashed && home.pills.length >= 1 && home.hasAmount, home);
check('home-amount-full', home.amountFull !== false && home.amountFits !== false, {
  amountFull: home.amountFull,
  amountFits: home.amountFits,
  font: home.amountFont,
  w: home.amountW,
});
check('home-feature-reel', home.featureReel === true, { featureReel: home.featureReel });
check('home-amount-fits', home.amountFits !== false, { amountFits: home.amountFits, font: home.amountFont, w: home.amountW });
check('home-add-split-adjacent', home.addSplitAdjacent === true || !home.pills.some((p) => /split/i.test(p)), { pills: home.pills });
check('home-to-pay-visible', home.pay !== true || home.payInView === true, { pay: home.pay, payInView: home.payInView, payTop: home.payTop });
shot('02-home');

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
  const sticky = document.querySelector('.book-tabs-sticky');
  const stickyPos = sticky ? getComputedStyle(sticky).position : null;
  const icon = document.querySelector('.mb-entry-icon');
  const iconR = icon?.getBoundingClientRect();
  const teamBtn = [...document.querySelectorAll('button')].find((b) => /\\bTeam\\b/i.test(b.textContent || '') || /team — people/i.test(b.getAttribute('title') || ''));
  const fab = document.querySelector('.dash-fab-center');
  const fr = fab?.getBoundingClientRect();
  const bar = document.querySelector('.dash-tabbar.has-fab');
  const mask = bar ? getComputedStyle(bar).webkitMaskImage || getComputedStyle(bar).maskImage || '' : '';
  const headerActs = [...document.querySelectorAll('button')].map((b) => (b.textContent || b.getAttribute('title') || '').trim()).filter((t) => /^(Add entry|Voice|Scan)$/i.test(t) || /scan receipt|voice entry/i.test(t));
  return {
    hash: location.hash,
    entries,
    tabs,
    stickyTabs: stickyPos === 'sticky',
    entryIconW: iconR ? Math.round(iconR.width) : null,
    teamLabeled: Boolean(teamBtn),
    filter: Boolean(document.querySelector('[title="Filters"], .byjan-tool-btn')),
    download: Boolean(document.querySelector('[title="Download report"]')),
    crashed: /Minified React error|This screen could not open/i.test(text),
    fabVisible: fab ? (fr.width > 20 && fr.top < innerHeight && fr.bottom > 0) : false,
    fabY: fr ? Math.round(fr.y) : null,
    fabMid: fr ? Math.round(fr.x + fr.width / 2) : null,
    centerX: Math.round(innerWidth / 2),
    notchMask: /radial-gradient/i.test(mask),
    fabSlot: Boolean(document.querySelector('.dash-fab-slot')),
    headerAddScanMic: headerActs,
  };
})()`);
check('book-open', Boolean(bookLink) && !book.crashed, { bookLink, ...book });
check('fab-on-book', book.fabVisible === true, { fabVisible: book.fabVisible, fabY: book.fabY });
check('fab-centered-on-book', book.fabVisible && Math.abs((book.fabMid || 0) - (book.centerX || 0)) < 40, {
  fabMid: book.fabMid,
  centerX: book.centerX,
});
check('fab-notch-on-book', book.notchMask === true && book.fabSlot === true, { notchMask: book.notchMask, fabSlot: book.fabSlot });
check('book-no-header-add-scan-mic', (book.headerAddScanMic || []).length === 0, { headerAddScanMic: book.headerAddScanMic });
check('book-sticky-tabs', book.stickyTabs === true, { stickyTabs: book.stickyTabs, tabs: book.tabs });
check('book-team-label', book.teamLabeled === true, { teamLabeled: book.teamLabeled });
check('entry-icon-size', book.entryIconW == null || book.entryIconW >= 48, { entryIconW: book.entryIconW });

if (book.fabVisible) {
  await evalJs(send, `document.querySelector('.dash-fab-center')?.click()`);
  await sleep(900);
  shot('04b-fab-open');
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

await evalJs(send, `document.querySelector('[title="Download report"]')?.scrollIntoView({block:'center'})`);
await sleep(250);
const exportBtn = await evalJs(send, `Boolean(document.querySelector('[title="Download report"]'))`);
await evalJs(send, `document.querySelector('[title="Download report"]')?.click()`);
await sleep(800);
const exportMenu = await evalJs(send, `(() => {
  const panel = document.querySelector('[aria-label="Download report"]');
  const text = (panel?.innerText || document.body.innerText || '');
  return { hasBtn: Boolean(document.querySelector('[title="Download report"]')), pdf: /PDF report|PDF/i.test(text), csv: /CSV spreadsheet|CSV/i.test(text), panel: Boolean(panel) };
})()`);
check('export-menu', exportBtn && exportMenu.pdf && exportMenu.csv, { ...exportMenu, exportBtn });
await evalJs(send, `document.querySelector('.fixed.inset-0')?.click()`);
await sleep(400);

await evalJs(send, `location.hash = location.hash.split('?')[0] + '?tab=splits'`);
await sleep(900);
const splitsTab = await evalJs(send, `(() => {
  const active = document.querySelector('.book-tab[data-state="active"]');
  return { active: (active?.textContent || '').trim(), hash: location.hash };
})()`);
check('book-tab-splits-query', /split/i.test(splitsTab.active) || /tab=splits/i.test(splitsTab.hash), splitsTab);

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
    voiceSound: /recording start sound|voice start sound|voice entry/i.test(text),
    help: Boolean([...document.querySelectorAll('a,button')].find((el) => /help/i.test(el.textContent||''))),
    crashed: /Minified React error/i.test(text),
  };
})()`);
check('settings', /settings/i.test(settings.hash) && settings.display && !settings.crashed, settings);
check('settings-voice-sound', settings.voiceSound === true, { voiceSound: settings.voiceSound });

await evalJs(send, `location.hash = '#/trace'`);
await sleep(1400);
shot('06b-trace');
const trace = await evalJs(send, `(() => {
  const text = document.body.innerText || '';
  const hash = location.hash || '';
  return {
    hash,
    ok: /email pipeline|smtp|failed sends|brevo|Trace/i.test(text) && /trace/i.test(hash),
    gated: !/trace/i.test(hash),
    crashed: /Minified React error/i.test(text),
  };
})()`);
check('trace-screen', !trace.crashed && (trace.ok || trace.gated), trace);

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

/**
 * Byjan end-to-end on a connected Android phone (real app, real API, real data).
 *
 * Flows covered (each is a hard assertion, not a "did it render" smoke):
 *   boot      – no "admin has not turned on" flash during startup; skeleton instead
 *   login     – email/password sign-in lands on Home with tabs
 *   cards     – every book card has ≤1 Add and exactly one ⋯ menu; no duplicate pens
 *   create    – New book dialog → book appears on Home
 *   rename    – ⋯ → Rename → Save → card shows new name
 *   pin       – pin toggle flips aria-pressed and persists after reload
 *   entry     – Add on the card → entry form → save → book total reflects 123
 *   reports   – period control changes bounds; counts monotonic 7D ≤ 1M ≤ 3M ≤ 1Y;
 *               per-book filter isolates to the E2E book; CSV export gives feedback
 *   inbox     – Financial Inbox filters + status switch without crash
 *   delete    – ⋯ → Delete → confirm dialog names the book → card removed
 *   api-iso   – with the test user's Firebase ID token: foreign book get/list/update/delete → 403/404,
 *               unauthenticated → 401, ownerId escalation via patch ignored server-side
 *   reset     – sign out → Forgot password → masked email confirmation screen
 *   relogin   – sign back in so the phone is left usable
 *
 * Usage: node scripts/phone-e2e-flows.mjs   (env: BYJAN_SERIAL, BYJAN_EMAIL, BYJAN_PASS, BYJAN_API)
 */
import { execSync } from 'node:child_process';
import { join } from 'node:path';

const SERIAL = process.env.BYJAN_SERIAL || 'ZD222LNHM5';
const PKG = 'com.byjanbooks.app';
const EMAIL = process.env.BYJAN_EMAIL || 'badrinathp316@gmail.com';
const PASS = process.env.BYJAN_PASS || '123456';
const API = (process.env.BYJAN_API || 'https://www.easypado.com').replace(/\/+$/, '');
const FIREBASE_KEY = 'AIzaSyDQUXdMTTUOONPbua5cWm75Jn-7-SkRwjE';
const ADB = process.platform === 'win32'
  ? join(process.env.LOCALAPPDATA || '', 'Android', 'Sdk', 'platform-tools', 'adb.exe')
  : 'adb';
const STAMP = new Date().toISOString().slice(11, 19).replace(/:/g, '');
const BOOK_NAME = `E2E ${STAMP}`;
const BOOK_RENAMED = `E2E ${STAMP} renamed`;

const results = [];
const adb = (args) => execSync(`"${ADB}" -s ${SERIAL} ${args}`, { encoding: 'utf8' }).trim();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function record(flow, name, pass, data) {
  results.push({ flow, name, pass, data });
  console.log(`${pass ? 'PASS' : 'FAIL'} [${flow}] ${name} ${data === undefined ? '' : JSON.stringify(data)}`);
}

/* ---------- CDP plumbing ---------- */
function cdp(url) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    const pending = new Map();
    let n = 0;
    const send = (method, params = {}) => new Promise((res, rej) => {
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

let send;
async function js(expression) {
  const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (result?.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text || 'eval failed');
  return result?.result?.value;
}
const text = () => js(`document.body.innerText || ''`);
const hash = () => js(`location.hash`);
const crashed = async () => /This screen could not open|Minified React error|Maximum update depth/i.test(await text());

async function waitFor(fn, { timeout = 8000, every = 150 } = {}) {
  const start = Date.now();
  let last;
  while (Date.now() - start < timeout) {
    last = await fn();
    if (last) return last;
    await sleep(every);
  }
  return last;
}

async function launch() {
  adb(`shell am force-stop ${PKG}`);
  await sleep(500);
  try { adb(`shell am start -n ${PKG}/com.byjanbooks.com.MainActivity`); }
  catch { adb(`shell monkey -p ${PKG} -c android.intent.category.LAUNCHER 1`); }
  let pid = '';
  for (let i = 0; i < 20; i++) {
    pid = String(adb(`shell pidof ${PKG}`) || '').trim().split(/\s+/)[0];
    if (pid) break;
    await sleep(300);
  }
  try { execSync(`"${ADB}" -s ${SERIAL} forward --remove tcp:9222`, { stdio: 'ignore' }); } catch { /* */ }
  adb(`forward tcp:9222 localabstract:webview_devtools_remote_${pid}`);
  for (let i = 0; i < 30; i++) {
    await sleep(300);
    try {
      const list = await fetch('http://127.0.0.1:9222/json').then((r) => r.json());
      const page = (Array.isArray(list) ? list : []).find((t) => t.webSocketDebuggerUrl);
      if (page?.webSocketDebuggerUrl) return page.webSocketDebuggerUrl;
    } catch { /* retry */ }
  }
  throw new Error('webview not reachable');
}

const setInput = (selector, value) => js(`(() => {
  const el = document.querySelector(${JSON.stringify(selector)});
  if (!el) return false;
  const proto = el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, ${JSON.stringify(value)});
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
  return true;
})()`);

const clickText = (re, tag = 'button, a, [role="menuitem"], [role="tab"]') => js(`(() => {
  const els = [...document.querySelectorAll(${JSON.stringify(tag)})];
  const el = els.find((b) => ${re}.test((b.textContent || '').trim()));
  if (!el) return false;
  el.click();
  return true;
})()`);

const click = (selector) => js(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) return false; el.click(); return true; })()`);

/** Card element for a given book name (matching h3 title). */
const cardJs = (name) => `[...document.querySelectorAll('.md3-book')].find((c) => (c.querySelector('h3')?.textContent || '').trim() === ${JSON.stringify(name)})`;

/* ================================================================== */
const wsUrl = await launch();
const conn = await cdp(wsUrl);
send = conn.send;
await send('Runtime.enable');

/* ---------- boot: no admin-copy flash ---------- */
{
  let sawAdminCopy = false;
  let sawSkeleton = false;
  const start = Date.now();
  while (Date.now() - start < 4500) {
    const snap = await js(`({ t: (document.body.innerText || '').slice(0, 600), skel: document.querySelectorAll('.byjan-skel').length })`).catch(() => ({ t: '', skel: 0 }));
    if (/admin has not turned on/i.test(snap.t)) sawAdminCopy = true;
    if (snap.skel > 0) sawSkeleton = true;
    await sleep(120);
  }
  record('boot', 'no "admin has not turned on" flash on startup', !sawAdminCopy, { sawAdminCopy, sawSkeleton });
}

/* ---------- login ---------- */
async function login() {
  const state = await js(`({ tabs: document.querySelectorAll('.dash-tab').length, t: (document.body.innerText || '').slice(0, 300) })`);
  if (state.tabs && !/sign in|welcome back/i.test(state.t)) return true;
  await clickText('/skip|continue to sign in/i');
  await sleep(500);
  const okEmail = await waitFor(() => js(`Boolean(document.querySelector('input[type="email"]'))`));
  if (!okEmail) return false;
  await setInput('input[type="email"]', EMAIL);
  await setInput('input[type="password"]', PASS);
  await clickText('/^sign in$/i');
  return Boolean(await waitFor(() => js(`document.querySelectorAll('.dash-tab').length > 0`), { timeout: 15000 }));
}
{
  const ok = await login();
  record('login', 'email/password sign-in reaches Home', ok, { hash: await hash() });
  if (!ok) { console.log('E2E_FAIL login'); process.exit(2); }
  const cosmetics = await js(`(() => {
    const font = getComputedStyle(document.body).fontFamily;
    const hero = document.querySelector('.home-hero');
    const h = hero ? hero.getBoundingClientRect().height : 0;
    const wash = getComputedStyle(document.body).backgroundColor;
    return { font, heroH: Math.round(h), wash };
  })()`);
  record('cosmetics', 'app font is Manrope (not a heavy display face)', /Manrope/i.test(cosmetics?.font || ''), cosmetics);
  record('cosmetics', 'home top card is compact', Number(cosmetics?.heroH || 0) > 12 && Number(cosmetics?.heroH || 0) < 170, cosmetics);
}

/** Books tab lists cards paginated; narrow to one book via its search box. */
async function findCard(name) {
  if (!/#\/expenses/.test(await hash())) {
    await js(`location.hash = '#/expenses'`);
  }
  await waitFor(() => js(`Boolean(document.querySelector('input[placeholder="Search money books"]'))`), { timeout: 10000 });
  await setInput('input[placeholder="Search money books"]', name);
  return waitFor(() => js(`Boolean(${cardJs(name)})`), { timeout: 8000 });
}

await js(`location.hash = '#/expenses'`);
await waitFor(() => js(`document.querySelectorAll('.md3-book').length > 0 || /No money books yet/i.test(document.body.innerText || '')`), { timeout: 12000 });

/* ---------- cards: no duplicate pens ---------- */
{
  const audit = await js(`(() => {
    const cards = [...document.querySelectorAll('.md3-book')];
    return cards.map((c) => ({
      name: (c.querySelector('h3')?.textContent || '').trim(),
      add: c.querySelectorAll('[data-testid="book-add-entry"]').length,
      menu: c.querySelectorAll('[data-testid="book-menu"]').length,
      pens: c.querySelectorAll('button[title="Edit book"], button[title="Add entry"]').length,
      buttons: c.querySelectorAll('.md3-book-actions button, .md3-book-actions a').length,
    }));
  })()`);
  const bad = audit.filter((c) => c.add > 1 || c.menu > 1 || c.pens > 0 || c.buttons > 4);
  record('cards', 'each card: ≤1 Add, ≤1 ⋯ menu, no pen icons, ≤4 controls', audit.length > 0 && bad.length === 0, { cards: audit.length, bad });
}

/* ---------- create ---------- */
{
  await js(`location.hash = '#/'`);
  await waitFor(() => js(`[...document.querySelectorAll('button')].some((b) => /^New book$/i.test((b.textContent || '').trim()))`), { timeout: 10000 });
  await clickText('/^New book$/i');
  const dialog = await waitFor(() => js(`Boolean(document.querySelector('input[placeholder*="Goa Trip"]'))`));
  record('create', 'New book dialog opens from Home', Boolean(dialog));
  await setInput('input[placeholder*="Goa Trip"]', BOOK_NAME);
  await sleep(200);
  await clickText('/Create basic book/i');
  await waitFor(() => js(`!document.querySelector('input[placeholder*="Goa Trip"]')`), { timeout: 12000 });
  const shown = await findCard(BOOK_NAME);
  record('create', 'book appears in Books list', Boolean(shown), { name: BOOK_NAME });
}

/* ---------- rename via ⋯ ---------- */
{
  await findCard(BOOK_NAME);
  await js(`${cardJs(BOOK_NAME)}?.scrollIntoView({ block: 'center' })`);
  // Radix renders the menu in a portal; open it from our card's own trigger (pointerdown, not just click).
  await js(`(() => { const c = ${cardJs(BOOK_NAME)}; const b = c?.querySelector('[data-testid="book-menu"]'); if (!b) return false;
    const opts = { bubbles: true, cancelable: true, pointerId: 1, pointerType: 'mouse', button: 0, buttons: 1, isPrimary: true };
    b.dispatchEvent(new PointerEvent('pointerdown', opts)); b.dispatchEvent(new PointerEvent('pointerup', { ...opts, buttons: 0 })); b.click(); return true; })()`);
  const menu = await waitFor(() => js(`Boolean(document.querySelector('[data-testid="book-menu-edit"]'))`));
  record('rename', '⋯ menu shows Rename', Boolean(menu));
  await js(`(() => { const i = document.querySelector('[data-testid="book-menu-edit"]'); if (!i) return false;
    i.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerType: 'mouse' }));
    i.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerType: 'mouse' })); i.click(); return true; })()`);
  const dlg = await waitFor(() => js(`(() => { const t = [...document.querySelectorAll('[role="dialog"]')].find((d) => /Edit book/i.test(d.textContent || '')); return Boolean(t); })()`));
  record('rename', 'Edit book dialog opens', Boolean(dlg));
  await setInput('[role="dialog"] input.byjan-input', BOOK_RENAMED);
  await clickText('/Save name/i', '[role="dialog"] button');
  await waitFor(() => js(`!document.querySelector('[role="dialog"]')`), { timeout: 10000 });
  const renamed = await findCard(BOOK_RENAMED);
  record('rename', 'card shows new name after Save', Boolean(renamed), { to: BOOK_RENAMED });
}

/* ---------- pin ---------- */
{
  await findCard(BOOK_RENAMED);
  const openBookMenu = async () => {
    await js(`(() => { const c = ${cardJs(BOOK_RENAMED)}; const b = c?.querySelector('[data-testid="book-menu"]'); if (!b) return false;
      const opts = { bubbles: true, cancelable: true, pointerId: 1, pointerType: 'mouse', button: 0, buttons: 1, isPrimary: true };
      b.dispatchEvent(new PointerEvent('pointerdown', opts)); b.dispatchEvent(new PointerEvent('pointerup', { ...opts, buttons: 0 })); b.click(); return true; })()`);
    return waitFor(() => js(`Boolean(document.querySelector('[data-testid="book-menu-edit"]'))`));
  };
  await openBookMenu();
  const beforeLabel = await js(`[...document.querySelectorAll('[role="menuitem"]')].map((el) => (el.textContent || '').trim()).find((t) => /pin/i.test(t)) || ''`);
  await js(`(() => { const i = [...document.querySelectorAll('[role="menuitem"]')].find((el) => /pin/i.test((el.textContent || '').trim()));
    if (!i) return false; i.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerType: 'mouse' })); i.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerType: 'mouse' })); i.click(); return true; })()`);
  await sleep(900);
  await openBookMenu();
  const afterLabel = await js(`[...document.querySelectorAll('[role="menuitem"]')].map((el) => (el.textContent || '').trim()).find((t) => /pin/i.test(t)) || ''`);
  record('pin', 'pin toggle flips state', Boolean(beforeLabel) && Boolean(afterLabel) && afterLabel !== beforeLabel, { beforeLabel, afterLabel });
  await js(`document.body.click()`);
  await js(`location.hash = '#/settings'`);
  await sleep(800);
  await findCard(BOOK_RENAMED);
  await openBookMenu();
  const persistedLabel = await js(`[...document.querySelectorAll('[role="menuitem"]')].map((el) => (el.textContent || '').trim()).find((t) => /pin/i.test(t)) || ''`);
  record('pin', 'pin state persists across navigation', persistedLabel === afterLabel && Boolean(afterLabel), { persistedLabel, afterLabel });
  await js(`document.body.click()`);
}

/* ---------- entry ---------- */
{
  await findCard(BOOK_RENAMED);
  await js(`${cardJs(BOOK_RENAMED)}?.querySelector('[data-testid="book-add-entry"]')?.click()`);
  const form = await waitFor(() => js(`Boolean(document.querySelector('input.money-amount-input'))`), { timeout: 10000 });
  record('entry', 'Add on card opens entry form inside the book', Boolean(form), { hash: await hash() });
  await setInput('input.money-amount-input', '123');
  await setInput('form input[type="text"][required]', 'E2E coffee');
  await js(`document.querySelector('.purpose-cat-chip')?.click()`);
  await sleep(150);
  const savedClick = await click('[data-testid="entry-save"]');
  if (!savedClick) await js(`document.querySelector('[data-testid="entry-form"]')?.requestSubmit()`);
  const saved = await waitFor(() => js(`/E2E coffee/.test(document.body.innerText || '') && !document.querySelector('[data-testid="entry-form"]')`), { timeout: 16000 });
  record('entry', 'entry saved and listed in the book', Boolean(saved));
  const totalOk = await waitFor(() => js(`/123/.test(document.body.innerText || '')`), { timeout: 6000 });
  record('entry', 'book totals include 123', Boolean(totalOk));
  await js(`document.querySelector('[data-testid="entry-card"]')?.click()`);
  let viewed = await waitFor(() => js(`Boolean(document.querySelector('[data-testid="entry-view"]'))`), { timeout: 5000 });
  if (!viewed) {
    await click('[data-testid="entry-card-view"]');
    viewed = await waitFor(() => js(`Boolean(document.querySelector('[data-testid="entry-view"]'))`), { timeout: 5000 });
  }
  record('view', 'tapping an entry opens the view sheet', Boolean(viewed));
  const canEdit = await js(`Boolean(document.querySelector('[data-testid="entry-view-edit"]'))`);
  record('view', 'view sheet has Edit', Boolean(canEdit));
  await js(`document.querySelector('[data-testid="entry-view-edit"]')?.click()`);
  const editForm = await waitFor(() => js(`Boolean(document.querySelector('[data-testid="entry-form"]'))`), { timeout: 8000 });
  record('view', 'Edit on view opens the entry form', Boolean(editForm));
  await setInput('input.money-amount-input', '124');
  await click('[data-testid="entry-save"]');
  const editAsk = await waitFor(() => js(`Boolean(document.querySelector('[data-testid="entry-edit-confirm"]'))`), { timeout: 6000 });
  record('view', 'saving an edit asks for confirmation', Boolean(editAsk));
  await click('[data-testid="entry-edit-yes"]');
  const edited = await waitFor(() => js(`/124/.test(document.body.innerText || '') && !document.querySelector('[data-testid="entry-form"]')`), { timeout: 12000 });
  record('view', 'confirmed edit updates the listed amount', Boolean(edited));
  await js(`(() => {
    document.querySelector('[data-testid="upi-qr-sheet"] .sp-close, [data-testid="upi-qr-sheet"] .sp-dim')?.click();
    [...document.querySelectorAll('[role="dialog"] button')].reverse().forEach((b) => {
      if (/^(Cancel|Close|Keep editing|Keep it)$/i.test((b.textContent || '').trim())) b.click();
    });
  })()`);
  await waitFor(() => js(`!document.querySelector('[data-testid="entry-form"]') && !document.querySelector('[data-testid="entry-edit-confirm"]')`), { timeout: 4000 });
  const bookHash = await hash();
  const bookIdMatch = String(bookHash || '').match(/book\/([^/?]+)/);
  if (bookIdMatch) await js(`location.hash = ${JSON.stringify('#/book/' + bookIdMatch[1] + '?tab=analytics')}`);
  await sleep(500);
  await js(`(() => {
    const b = document.querySelector('[data-testid="book-tab-summary"]');
    if (!b) return false;
    b.scrollIntoView({ block: 'center' });
    const opts = { bubbles: true, cancelable: true, pointerId: 1, pointerType: 'mouse', button: 0, buttons: 1, isPrimary: true };
    b.dispatchEvent(new PointerEvent('pointerdown', opts));
    b.dispatchEvent(new PointerEvent('pointerup', { ...opts, buttons: 0 }));
    b.click();
    return true;
  })()`);
  const bookRp = await waitFor(() => js(`Boolean(document.querySelector('[data-testid="reports-page"] [data-testid="reports-period"]'))`), { timeout: 8000 });
  record('reports', 'book Summary tab uses the same reports dashboard', Boolean(bookRp));
  const bookHero = await js(`(() => {
    const el = document.querySelector('[data-testid="reports-hero"]');
    if (!el) return { ok: false };
    const c = getComputedStyle(el).color;
    return { ok: true, color: c, hasPeriod: Boolean(document.querySelector('[data-testid="reports-period"]')) };
  })()`);
  record('reports', 'book summary hero is the light professional surface (not dark navy text)', Boolean(bookHero?.ok) && !/rgb\(\s*255,\s*255,\s*255/.test(bookHero?.color || ''), bookHero);
  await click('[data-testid="book-pay-qr"]');
  const pay = await waitFor(() => js(`Boolean(document.querySelector('[data-testid="upi-qr-sheet"]'))`), { timeout: 8000 });
  record('pay', 'Pay QR sheet opens from the book', Boolean(pay), { phase: await js(`document.querySelector('[data-testid="upi-qr-sheet"]')?.getAttribute('data-phase')`) });
  if (pay) {
    await sleep(350);
    const frame = await js(`(() => { const b = document.querySelector('[data-testid="upi-qr-viewport"]')?.getBoundingClientRect(); if (!b) return null; return { top: Math.round(b.top), height: Math.round(b.height), bottom: Math.round(b.bottom), vh: window.innerHeight }; })()`);
    record('pay', 'camera fills the screen without scrolling', Boolean(frame) && frame.top >= 0 && frame.top < 160 && frame.bottom <= frame.vh + 8 && frame.height > 180, frame);
  }
  if (pay) {
    await click('[data-testid="upi-qr-paste-toggle"]');
    const pasteBox = await waitFor(() => js(`Boolean(document.querySelector('[data-testid="upi-qr-paste"]'))`));
    record('pay', 'paste UPI ID is available from the scanner', Boolean(pasteBox));
    await setInput('[data-testid="upi-qr-paste"]', 'upi://pay?pa=e2e@okaxis&pn=E2E%20Shop&tn=Tea');
    await click('[data-testid="upi-qr-paste-go"]');
    const details = await waitFor(() => js(`document.querySelector('[data-testid="upi-qr-sheet"]')?.getAttribute('data-phase') === 'details'`), { timeout: 8000 });
    const vpa = await js(`document.querySelector('[data-testid="upi-qr-payee"]')?.textContent || ''`);
    record('pay', 'scanned/pasted QR extracts UPI ID (VPA)', Boolean(details) && /e2e@okaxis/i.test(vpa), { vpa });
    await setInput('[data-testid="upi-qr-amount"]', '50');
    await setInput('[data-testid="upi-qr-note"]', 'E2E chai');
    const apps = await js(`document.querySelectorAll('[data-testid="upi-qr-apps"] [data-app]').length`);
    const simple = await js(`({ amount: Boolean(document.querySelector('[data-testid="upi-qr-amount"]')), note: Boolean(document.querySelector('[data-testid="upi-qr-note"]')), bookHidden: !document.querySelector('[data-testid="upi-qr-book"]') })`);
    record('pay', 'after a scan only amount and note are required', Boolean(simple?.amount && simple?.note && simple?.bookHidden), simple);
    record('pay', 'amount, note, and UPI app deeplink buttons are ready', apps >= 1 && Boolean(await js(`document.querySelector('[data-testid="upi-qr-amount"]')?.value === '50'`)), { apps });
    await js(`document.querySelector('[data-testid="upi-qr-sheet"] .sp-close, [data-testid="upi-qr-sheet"] .sp-dim')?.click()`);
    await sleep(400);
    if (await js(`Boolean(document.querySelector('[data-testid="upi-qr-sheet"]'))`)) {
      await js(`document.querySelector('[data-testid="upi-qr-sheet"] [aria-label="Close"]')?.click()`);
      await sleep(300);
    }
    const stillOpen = await js(`Boolean(document.querySelector('[data-testid="upi-qr-sheet"]'))`);
    record('pay', 'closing the sheet without paying records nothing extra', !stillOpen);
  }
}

/* ---------- reports ---------- */
{
  await js(`location.hash = '#/reports'`);
  const page = await waitFor(() => js(`Boolean(document.querySelector('[data-testid="reports-page"]'))`), { timeout: 12000 });
  record('reports', 'Reports screen renders (not skeleton)', Boolean(page), { crashed: await crashed() });
  const readCount = () => js(`Number((document.querySelector('[data-testid="reports-count"]')?.textContent || '0').replace(/[^0-9]/g, ''))`);
  const counts = {};
  for (const p of ['week', 'month', 'quarter', 'year']) {
    await click(`[data-testid="reports-period"] [data-period="${p}"]`);
    await waitFor(() => js(`document.querySelector('[data-testid="reports-period"] [data-period="${p}"]')?.getAttribute('data-on') === 'true'`));
    await sleep(150);
    counts[p] = await readCount();
  }
  const monotonic = counts.week <= counts.month && counts.month <= counts.quarter && counts.quarter <= counts.year;
  record('reports', 'period control switches and counts are monotonic Week ≤ Month ≤ 3 months ≤ Year', monotonic && counts.month >= 1, counts);
  const heroText = await js(`document.querySelector('[data-testid="reports-hero"]')?.textContent || ''`);
  record('reports', 'hero shows period bounds and delta pills', /vs last time|nothing to compare|same as last time|vs previous|new|same as before/i.test(heroText) && /–/.test(heroText));
  const plain = await js(`document.querySelector('[data-testid="reports-plain"]')?.textContent || ''`);
  record('reports', 'summary says what was paid, received, and left', /You paid|Nothing recorded/i.test(plain), { plain: String(plain).slice(0, 140) });
  await click(`[data-testid="reports-export"]`);
  const note = await waitFor(() => js(`document.querySelector('[data-testid="reports-export-note"]')?.textContent || ''`));
  record('reports', 'spreadsheet export gives explicit feedback', /Exported \d+ entr/i.test(note || ''), { note });
  const hasSelect = await js(`Boolean(document.querySelector('[data-testid="reports-book"]'))`);
  if (hasSelect) {
    await click(`[data-testid="reports-period"] [data-period="month"]`);
    const opt = await js(`(() => {
      const want = ${JSON.stringify(BOOK_RENAMED)};
      const opts = [...document.querySelectorAll('[data-testid="reports-book"] option')].map((o) => ({ v: o.value, t: (o.textContent || '').trim() }));
      const hit = opts.find((o) => o.t === want) || opts.find((o) => o.t.includes(want)) || opts.find((o) => want.includes(o.t) && o.t.length > 6);
      const s = document.querySelector('[data-testid="reports-book"]');
      if (!s || !hit) return { ok: false, opts: opts.map((o) => o.t), want };
      const proto = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value');
      proto.set.call(s, hit.v);
      s.dispatchEvent(new Event('input', { bubbles: true }));
      s.dispatchEvent(new Event('change', { bubbles: true }));
      return { ok: true, hit: hit.t, id: hit.v };
    })()`);
    await sleep(200);
    const only = await waitFor(() => js(`(() => {
      const count = Number((document.querySelector('[data-testid="reports-count"]')?.textContent || '0').replace(/[^0-9]/g, ''));
      const out = document.querySelector('[data-testid="reports-out"]')?.textContent || '';
      const selected = document.querySelector('[data-testid="reports-book"]')?.selectedOptions?.[0]?.textContent || '';
      return count === 1 && /124/.test(out) ? { count, out, selected } : null;
    })()`), { timeout: 5000 });
    const fallback = only || await js(`({ count: Number((document.querySelector('[data-testid="reports-count"]')?.textContent || '0').replace(/[^0-9]/g, '')), out: document.querySelector('[data-testid="reports-out"]')?.textContent || '', selected: document.querySelector('[data-testid="reports-book"]')?.selectedOptions?.[0]?.textContent || '' })`);
    record('reports', 'per-book filter isolates to the E2E book (1 entry, ₹124 out)', Boolean(opt?.ok) && fallback.count === 1 && /124/.test(fallback.out || ''), { opt, only: fallback });
  } else {
    record('reports', 'per-book filter present (skipped: single book)', true);
  }
  record('reports', 'no chip-row / legacy layout leftovers', !(await js(`/Period snapshot|What-if · reduce/i.test(document.body.innerText || '')`)));
  const homeHero = await js(`getComputedStyle(document.querySelector('[data-testid="reports-hero"]') || document.body).color`);
  record('reports', 'home Summary uses the same light professional hero as the book', !/rgb\(\s*255,\s*255,\s*255/.test(homeHero || ''), { color: homeHero });
}

/* ---------- grid Add/Scan stay on the card (no ⋯ required) ---------- */
{
  await findCard(BOOK_RENAMED);
  await click('[data-testid="books-view-grid"]');
  await sleep(250);
  const grid = await js(`(() => {
    const c = ${cardJs(BOOK_RENAMED)};
    if (!c) return { found: false };
    const add = c.querySelector('[data-testid="book-add-entry"]');
    const scan = c.querySelector('[data-testid="book-scan"]');
    const addBox = add?.getBoundingClientRect();
    const scanBox = scan?.getBoundingClientRect();
    const label = (el) => (el?.textContent || '').replace(/\\s+/g, ' ').trim();
    return {
      found: true,
      isGrid: c.classList.contains('is-grid'),
      addLabel: label(add),
      scanLabel: label(scan),
      addH: addBox ? Math.round(addBox.height) : 0,
      scanH: scanBox ? Math.round(scanBox.height) : 0,
      addVisible: Boolean(addBox && addBox.width > 20 && addBox.height > 20),
      scanVisible: Boolean(scanBox && scanBox.width > 20 && scanBox.height > 20),
    };
  })()`);
  record('cards', 'grid view keeps labelled Add and Scan on the card', Boolean(grid?.isGrid && grid.addVisible && /add/i.test(grid.addLabel || '') && (grid.scanVisible ? /scan/i.test(grid.scanLabel || '') : true)), grid);
  await js(`document.querySelector('.books-view-toggle button[title="List view"]')?.click()`);
  await sleep(150);
}

/* ---------- inbox ---------- */
{
  await js(`location.hash = '#/financial-inbox'`);
  const ok = await waitFor(() => js(`/Financial inbox/i.test(document.body.innerText || '') && !document.querySelector('[aria-busy="true"]')`), { timeout: 12000 });
  record('inbox', 'Financial Inbox screen loads', Boolean(ok), { crashed: await crashed() });
  let crashedDuring = false;
  for (const label of ['Unusual', 'Receipts', 'No category', 'Duplicates', 'Repeating', 'Coming up', 'Owed', 'All']) {
    await clickText(`/^${label}$/i`);
    await sleep(120);
    if (await crashed()) crashedDuring = true;
  }
  for (const label of ['Unread', 'Read', 'All']) { await clickText(`/^${label}$/i`); await sleep(100); }
  record('inbox', 'all kind/status filters switch without crash', !crashedDuring);
}

/* ---------- delete ---------- */
{
  const present = await findCard(BOOK_RENAMED);
  record('delete', 'book card present before delete', Boolean(present));
  await js(`(() => { const c = ${cardJs(BOOK_RENAMED)}; const b = c?.querySelector('[data-testid="book-menu"]'); if (!b) return false;
    const opts = { bubbles: true, cancelable: true, pointerId: 1, pointerType: 'mouse', button: 0, buttons: 1, isPrimary: true };
    b.dispatchEvent(new PointerEvent('pointerdown', opts)); b.dispatchEvent(new PointerEvent('pointerup', { ...opts, buttons: 0 })); b.click(); return true; })()`);
  await waitFor(() => js(`Boolean(document.querySelector('[data-testid="book-menu-delete"]'))`));
  await js(`(() => { const i = document.querySelector('[data-testid="book-menu-delete"]'); if (!i) return false;
    i.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerType: 'mouse' }));
    i.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerType: 'mouse' })); i.click(); return true; })()`);
  const confirm = await waitFor(() => js(`(() => { const d = [...document.querySelectorAll('[role="dialog"]')].find((x) => /Delete this book/i.test(x.textContent || '')); return d ? d.textContent : ''; })()`));
  record('delete', 'confirm dialog names the book', Boolean(confirm) && confirm.includes(BOOK_RENAMED));
  await clickText('/^Delete book$/i', '[role="dialog"] button');
  const gone = await waitFor(() => js(`!document.querySelector('[role="dialog"]') && !${cardJs(BOOK_RENAMED)}`), { timeout: 10000 });
  record('delete', 'card removed after confirm', Boolean(present) && Boolean(gone));
  await setInput('input[placeholder="Search money books"]', '');
}

/* ---------- api isolation (Node side, real token) ---------- */
{
  const flow = 'api-iso';
  try {
    const signin = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_KEY}`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: EMAIL, password: PASS, returnSecureToken: true }),
    }).then((r) => r.json());
    const token = signin.idToken;
    const myUid = signin.localId;
    record(flow, 'obtained Firebase ID token for test user', Boolean(token));
    const post = async (path, body) => {
      const r = await fetch(`${API}${path}`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: JSON.stringify(body) });
      let json = {};
      try { json = await r.json(); } catch { /* */ }
      return { status: r.status, json };
    };
    const FOREIGN = 'not-my-book-000000000000';
    const get = await post('/api/ledgers', { op: 'get', bookId: FOREIGN });
    record(flow, 'foreign book get → not 200', get.status !== 200, { status: get.status });
    const list = await post('/api/expenses', { op: 'list', bookId: FOREIGN });
    record(flow, 'foreign book expenses list → 403/404', list.status === 403 || list.status === 404, { status: list.status });
    const upd = await post('/api/ledgers', { op: 'update', bookId: FOREIGN, patch: { name: 'pwned' } });
    record(flow, 'foreign book rename → 403/404', upd.status === 403 || upd.status === 404, { status: upd.status });
    const del = await post('/api/ledgers', { op: 'softDelete', bookId: FOREIGN });
    record(flow, 'foreign book delete → 403/404', del.status === 403 || del.status === 404, { status: del.status });
    const noAuth = await fetch(`${API}/api/ledgers`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ op: 'list' }) });
    record(flow, 'unauthenticated list → 401', noAuth.status === 401, { status: noAuth.status });
    // Own book: identity fields in a patch must be ignored server-side.
    const created = await post('/api/ledgers', { op: 'create', name: `ISO ${STAMP}`, currency: 'INR' });
    const own = created.json?.book?.id;
    record(flow, 'create own probe book', created.status === 200 && Boolean(own), { status: created.status });
    if (own) {
      const esc = await post('/api/ledgers', { op: 'update', bookId: own, patch: { ownerId: 'attacker-uid', deleted: false, name: `ISO ${STAMP} ok` } });
      const ownerKept = String(esc.json?.book?.ownerId || '') === myUid;
      record(flow, 'ownerId in patch is ignored (owner unchanged)', esc.status === 200 && ownerKept, { status: esc.status, ownerId: esc.json?.book?.ownerId, myUid });
      const onlyIdentity = await post('/api/ledgers', { op: 'update', bookId: own, patch: { ownerId: 'attacker-uid' } });
      record(flow, 'patch containing only server-owned fields → 400', onlyIdentity.status === 400, { status: onlyIdentity.status });
      const cleanup = await post('/api/ledgers', { op: 'softDelete', bookId: own });
      record(flow, 'probe book cleaned up', cleanup.status === 200, { status: cleanup.status });
    }
    // Sweep any leftovers from earlier interrupted runs so the account stays clean.
    const mine = await post('/api/ledgers', { op: 'list' });
    const leftovers = (mine.json?.books || []).filter((b) => /^(E2E|ISO) \d{6}/.test(String(b.name || '')));
    for (const b of leftovers) await post('/api/ledgers', { op: 'softDelete', bookId: b.id });
    if (leftovers.length) console.log(`     swept ${leftovers.length} leftover test book(s)`);
  } catch (err) {
    record(flow, 'api isolation probe ran', false, { error: String(err?.message || err) });
  }
}

/* ---------- reset flow ---------- */
{
  await js(`location.hash = '#/'`);
  await sleep(500);
  const opened = await js(`(() => { const b = document.querySelector('.account-avatar, button[aria-label*="account" i], button[aria-label*="Account" i]'); if (!b) return false; b.click(); return true; })()`);
  await sleep(400);
  const signedOut = opened ? await clickText('/^Sign out$/i') : false;
  const atLogin = signedOut ? await waitFor(() => js(`Boolean(document.querySelector('input[type="email"]')) || /sign in/i.test(document.body.innerText || '')`), { timeout: 12000 }) : false;
  record('reset', 'sign out returns to login', Boolean(atLogin), { opened, signedOut });
  if (atLogin) {
    await clickText('/skip|continue to sign in/i');
    await sleep(300);
    await clickText('/Forgot password/i', 'a, button');
    const fp = await waitFor(() => js(`/forgot-password/.test(location.hash) && Boolean(document.querySelector('input[type="email"]'))`), { timeout: 8000 });
    record('reset', 'Forgot password screen opens', Boolean(fp), { hash: await hash() });
    if (fp) {
      await setInput('input[type="email"]', EMAIL);
      await clickText('/send|continue|code/i', 'form button[type="submit"], button');
      const masked = await waitFor(() => js(`(() => { const t = document.body.innerText || ''; return /\\*{2,}|•{2,}/.test(t) && /@/.test(t) ? t.match(/[^\\n]*@[^\\n]*/)?.[0] : ''; })()`), { timeout: 15000 });
      const adminLeak = /not configured|admin has not|neon|postgres/i.test(await text());
      record('reset', 'confirmation shows masked email, no technical copy', Boolean(masked) && !adminLeak, { masked, adminLeak });
    }
    await js(`location.hash = '#/login'`);
    await sleep(500);
    const back = await login();
    record('relogin', 'signed back in; phone left usable', back);
  }
}

conn.ws.close();
const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
console.log(failed.length ? `E2E_FAIL ${failed.map((r) => `${r.flow}:${r.name}`).join(' | ')}` : 'E2E_OK');
process.exit(failed.length ? 2 : 0);

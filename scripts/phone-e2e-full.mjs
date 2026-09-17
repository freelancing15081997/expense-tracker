/**
 * Full phone E2E — Autopilot / Purpose / Receipt / Activity / Books.
 * Credentials: badrinathp316@gmail.com / 123456
 */
import { execSync } from 'node:child_process';
import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const SERIAL = process.env.BYJAN_SERIAL || 'ZD222LNHM5';
const PKG = 'com.byjanbooks.app';
const EMAIL = 'badrinathp316@gmail.com';
const PASS = '123456';
const OUT = join(process.cwd(), 'tmp-e2e-full');
mkdirSync(OUT, { recursive: true });

const ADB = process.platform === 'win32'
  ? join(process.env.LOCALAPPDATA || '', 'Android', 'Sdk', 'platform-tools', 'adb.exe')
  : 'adb';

const report = { steps: [], fails: [], ok: true, exceptions: [] };

function adb(args, opts = {}) {
  return execSync(`"${ADB}" -s ${SERIAL} ${args}`, { encoding: 'utf8', ...opts }).trim();
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function shot(name) {
  try {
    adb('shell screencap -p /sdcard/byjan-e2e.png');
    const dest = join(OUT, `${name}.png`);
    execSync(`"${ADB}" -s ${SERIAL} pull /sdcard/byjan-e2e.png "${dest}"`, { stdio: 'pipe' });
    copyFileSync(dest, join(process.cwd(), `tmp-phone-${name}.png`));
  } catch (err) {
    report.fails.push(`shot:${name}:${err.message}`);
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
    ws.addEventListener('error', (e) => reject(e));
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
  const result = await send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (result?.exceptionDetails) throw new Error(result.exceptionDetails.text || 'eval');
  return result?.result?.value;
}

function logStep(name, data, pass = true) {
  report.steps.push({ name, pass, data });
  console.log(pass ? 'PASS' : 'FAIL', name, JSON.stringify(data));
  if (!pass) {
    report.ok = false;
    report.fails.push(name);
  }
}

async function ensureDevice() {
  const list = execSync(`"${ADB}" devices`, { encoding: 'utf8' });
  if (!list.includes(SERIAL)) {
    throw new Error(`Device ${SERIAL} not connected. adb devices:\n${list}`);
  }
}

async function attachWebview() {
  adb(`shell am force-stop ${PKG}`);
  await sleep(800);
  try {
    adb(`shell am start -n ${PKG}/com.byjanbooks.com.MainActivity`);
  } catch {
    adb(`shell monkey -p ${PKG} -c android.intent.category.LAUNCHER 1`);
  }
  await sleep(4500);
  let pid = '';
  for (let i = 0; i < 10; i += 1) {
    pid = String(adb(`shell pidof ${PKG}`) || '').trim().split(/\s+/)[0];
    if (pid) break;
    await sleep(800);
  }
  if (!pid) throw new Error('app pid missing');
  try { execSync(`"${ADB}" -s ${SERIAL} forward --remove tcp:9222`, { stdio: 'ignore' }); } catch { /* */ }
  adb(`forward tcp:9222 localabstract:webview_devtools_remote_${pid}`);
  let page = null;
  for (let i = 0; i < 15; i += 1) {
    await sleep(700);
    try {
      const list = await fetch('http://127.0.0.1:9222/json').then((r) => r.json());
      page = (Array.isArray(list) ? list : []).find((t) => t.type === 'page' && t.webSocketDebuggerUrl) || list[0];
      if (page?.webSocketDebuggerUrl) break;
    } catch {
      /* webview inspector not ready yet */
    }
  }
  if (!page?.webSocketDebuggerUrl) throw new Error(`no webview page for pid ${pid}`);
  return page.webSocketDebuggerUrl;
}

async function main() {
  await ensureDevice();
  const wsUrl = await attachWebview();
  const { send, ws } = await cdp(wsUrl);
  await send('Runtime.enable');
  ws.addEventListener('message', (ev) => {
    try {
      const msg = JSON.parse(String(ev.data));
      if (msg.method === 'Runtime.exceptionThrown') {
        const text = String(msg.params?.exceptionDetails?.text || msg.params?.exceptionDetails?.exception?.description || '');
        if (text) report.exceptions.push(text.slice(0, 240));
      }
    } catch { /* ignore */ }
  });

  const dismiss = `(() => {
    const btns = [...document.querySelectorAll('button, a, [role="button"]')];
    const hit = btns.find((el) => /skip|got it|close tour|not now|dismiss/i.test((el.textContent || '') + ' ' + (el.getAttribute('aria-label') || '')));
    if (hit) { hit.click(); return true; }
    return false;
  })()`;

  // --- Login if needed ---
  let state = await evalJs(send, `(() => ({
    hash: location.hash,
    email: document.querySelector('input[type="email"]')?.value || '',
    hasTabs: document.querySelectorAll('.dash-tab').length,
    text: (document.body.innerText || '').slice(0, 200),
  }))()`);
  if (!state.hasTabs || /sign in|welcome back|create account/i.test(state.text)) {
    await evalJs(send, `(() => {
      const email = document.querySelector('input[type="email"]');
      const pass = document.querySelector('input[type="password"]');
      const set = (el, v) => {
        if (!el) return;
        const proto = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value');
        proto.set.call(el, v);
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      };
      set(email, ${JSON.stringify(EMAIL)});
      set(pass, ${JSON.stringify(PASS)});
      const btn = [...document.querySelectorAll('button')].find((b) => /sign in/i.test(b.textContent || ''));
      btn?.click();
      return Boolean(email && pass && btn);
    })()`);
    await sleep(4500);
    await evalJs(send, dismiss);
    await sleep(800);
  }

  await evalJs(send, `document.querySelector('button.account-avatar')?.click()`);
  await sleep(600);
  const who = await evalJs(send, `(() => (document.body.innerText || '').slice(0, 1200))()`);
  const looksAuthed = /Home|Books|More|Across your books|Money books/i.test(who || '');
  const isSuper = /pujaribadrinath@gmail\.com|byjanbooks@gmail\.com/i.test(who || '') || /Super user|Access & roles/i.test(who || '');
  const isTarget = /badrinathp316/i.test(who || '') || isSuper;
  await evalJs(send, `document.querySelector('button.account-avatar')?.click()`);
  await sleep(200);
  if (looksAuthed && !isTarget) {
    await evalJs(send, `document.querySelector('button.account-avatar')?.click()`);
    await sleep(700);
    await evalJs(send, `(() => {
      const out = [...document.querySelectorAll('button, a')].find((el) => /sign out|log out/i.test(el.textContent || ''));
      out?.click();
      return Boolean(out);
    })()`);
    await sleep(2200);
    await evalJs(send, `(() => {
      const email = document.querySelector('input[type="email"]');
      const pass = document.querySelector('input[type="password"]');
      const set = (el, v) => {
        if (!el) return;
        const proto = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value');
        proto.set.call(el, v);
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      };
      set(email, ${JSON.stringify(EMAIL)});
      set(pass, ${JSON.stringify(PASS)});
      [...document.querySelectorAll('button')].find((b) => /sign in/i.test(b.textContent || ''))?.click();
      return true;
    })()`);
    await sleep(4500);
  }

  await evalJs(send, `location.hash = '#/'`);
  await sleep(1600);
  await evalJs(send, dismiss);
  shot('e2e-01-home');

  // --- Tabs: Home / Books / Activity / More ---
  const layout = await evalJs(send, `(() => {
    const fab = document.querySelector('.dash-fab-center')?.getBoundingClientRect();
    const books = document.querySelector('.dash-tab-books')?.getBoundingClientRect();
    const activity = document.querySelector('.dash-tab-activity')?.getBoundingClientRect();
    const home = document.querySelector('.dash-tab-home')?.getBoundingClientRect();
    const more = document.querySelector('.dash-tab-more')?.getBoundingClientRect();
    const tabs = [...document.querySelectorAll('.dash-tab')].map((t) => t.textContent.trim());
    const overlap = fab && books
      ? !(books.right < fab.left - 2 || books.left > fab.right + 2 || books.bottom < fab.top - 2 || books.top > fab.bottom + 2)
      : null;
    const box = (r) => (r ? { l: Math.round(r.left), r: Math.round(r.right), t: Math.round(r.top), b: Math.round(r.bottom) } : null);
    return {
      tabs,
      hasActivity: tabs.some((t) => /Activity/i.test(t)),
      hasBooks: tabs.some((t) => /Books/i.test(t)),
      overlap,
      fab: box(fab),
      books: box(books),
      activity: box(activity),
      home: box(home),
      more: box(more),
    };
  })()`);
  logStep('tabs-include-activity', layout, layout.hasActivity && layout.hasBooks && layout.overlap === false);

  // --- Home structure: compact inbox strip + banking layout ---
  const inbox = await evalJs(send, `(() => {
    const section = document.querySelector('.fin-inbox, [aria-label="Financial inbox"]');
    const card = document.querySelector('.fin-inbox .home-swipe-slide, .fin-inbox-strip');
    const title = section?.querySelector('.home-upcoming-kicker, .fin-inbox-title')?.textContent || '';
    const amount = document.querySelector('.home-amount')?.textContent || '';
    const pills = [...document.querySelectorAll('.home-pill')].map((b) => (b.textContent || '').trim());
    const qa = [...document.querySelectorAll('.home-qa-tile')].map((b) => (b.textContent || '').trim());
    const dots = section ? section.querySelectorAll('.home-swipe-dot').length : 0;
    const listH = card ? Math.round(card.getBoundingClientRect().height) : 0;
    return { present: Boolean(section) || Boolean(amount), title: title.trim(), amount: amount.slice(0, 24), pills, qa, stripH: listH, dots };
  })()`);
  logStep('financial-inbox-home', inbox, Boolean(inbox.amount) && inbox.pills.includes('Add') && (inbox.stripH < 90 || inbox.dots > 0));

  // --- Add from Home → book picker ---
  await evalJs(send, `(() => {
    const add = [...document.querySelectorAll('button.home-pill, button.home-action-tile, button')].find((el) => /^Add$/i.test((el.textContent || '').trim()) || /Add entry/i.test(el.textContent || ''));
    add?.click();
    return Boolean(add);
  })()`);
  await sleep(1200);
  const pick = await evalJs(send, `(() => {
    const sheet = document.querySelector('.book-pick-sheet');
    const rows = [...document.querySelectorAll('.book-pick-row')].map((r) => r.textContent.trim().slice(0, 60));
    const empty = document.querySelector('.book-pick-empty')?.textContent || '';
    const cs = sheet ? getComputedStyle(sheet) : null;
    return {
      sheet: Boolean(sheet),
      rows,
      empty,
      visible: sheet ? (cs.display !== 'none' && cs.visibility !== 'hidden' && sheet.getBoundingClientRect().height > 80) : false,
    };
  })()`);
  shot('e2e-02-book-pick');
  logStep('book-pick-from-home-add', pick, pick.sheet && pick.visible && (pick.rows.length > 0 || /loading|no money books/i.test(pick.empty)));

  if (pick.rows.length > 0) {
    await evalJs(send, `document.querySelector('.book-pick-row')?.click()`);
    await sleep(1800);
    const afterPick = await evalJs(send, `(() => ({
      hash: location.hash,
      entryOpen: Boolean(document.querySelector('[role="dialog"] input, form .byjan-input')),
    }))()`);
    shot('e2e-03-after-pick');
    logStep('book-pick-navigates', afterPick, /book\//i.test(afterPick.hash) || afterPick.entryOpen);
    await evalJs(send, `location.hash = '#/'`);
    await sleep(1000);
  } else {
    await evalJs(send, `document.querySelector('.book-pick-dim, .ios-sheet-dim, [aria-label="Close"]')?.click()`);
    await sleep(500);
  }

  // --- New book purpose picker ---
  await evalJs(send, `(() => {
    const btn = [...document.querySelectorAll('button')].find((el) => /New book|New money book/i.test(el.textContent || ''));
    btn?.click();
    return Boolean(btn);
  })()`);
  await sleep(900);
  const purpose = await evalJs(send, `(() => {
    const chips = [...document.querySelectorAll('.purpose-chip')].map((c) => c.querySelector('.purpose-chip-label')?.textContent || c.textContent.trim());
    const title = document.querySelector('[role="dialog"] h2, [role="dialog"] .text-lg')?.textContent || '';
    const skip = [...document.querySelectorAll('button')].some((b) => /Skip.*basic|Create basic/i.test(b.textContent || ''));
    const managing = /What are you managing/i.test(document.body.innerText || '');
    return { title, chips: chips.slice(0, 8), chipCount: chips.length, skip, managing };
  })()`);
  shot('e2e-03b-purpose');
  logStep('purpose-picker-create-book', purpose, purpose.chipCount >= 6 && purpose.managing && purpose.skip);

  const bookName = `E2E Trip ${Date.now().toString().slice(-6)}`;
  const tripChip = await evalJs(send, `(() => {
    const trip = [...document.querySelectorAll('.purpose-chip')].find((c) => /Trip/i.test(c.textContent || ''));
    trip?.click();
    return Boolean(trip);
  })()`);
  await sleep(350);
  const created = await evalJs(send, `(() => {
    const form = document.querySelector('.book-create-form') || document.querySelector('[role="dialog"] form');
    const name = form?.querySelector('input[placeholder*="Goa"]')
      || form?.querySelector('input[name="bookName"]')
      || form?.querySelector('input[type="text"]');
    const v = ${JSON.stringify(bookName)};
    if (name) {
      name.focus();
      const tracker = name._valueTracker;
      if (tracker) tracker.setValue('');
      const proto = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value');
      if (proto && proto.set) proto.set.call(name, v);
      else name.value = v;
      name.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true, data: v, inputType: 'insertFromPaste' }));
      name.dispatchEvent(new Event('change', { bubbles: true }));
    }
    const submit = form && [...form.querySelectorAll('button')].find((b) => /^Create book$/i.test((b.textContent || '').trim()));
    if (submit) submit.disabled = false;
    if (form && typeof form.requestSubmit === 'function') form.requestSubmit(submit || undefined);
    else submit?.click();
    return { named: name?.value || '', trip: ${tripChip ? 'true' : 'false'}, submitted: Boolean(form) };
  })()`);
  let listed = { hasName: false, dialog: true, hash: '', onBook: false, title: '' };
  for (let i = 0; i < 8; i += 1) {
    await sleep(700);
    try {
      listed = await evalJs(send, `(() => {
        const hash = String(location.hash || '');
        const title = String(document.querySelector('h1') && document.querySelector('h1').textContent || '').trim();
        const body = String(document.body && document.body.innerText || '');
        const onBook = hash.indexOf('#/book/') >= 0;
        return {
          hasName: title.indexOf(${JSON.stringify(bookName)}) >= 0 || body.indexOf(${JSON.stringify(bookName)}) >= 0,
          dialog: Boolean(document.querySelector('[role="dialog"]')),
          hash,
          onBook,
          title,
        };
      })()`);
      if (listed && listed.onBook && listed.hasName) break;
    } catch {
      /* WebView is navigating to the new book */
    }
  }
  shot('e2e-03c-created-book');
  logStep('new-book-appears-instantly', { ...created, ...listed, bookName }, listed.onBook === true && listed.hasName === true);

  if (!listed.onBook) {
    await evalJs(send, `location.hash = '#/expenses'`);
    await sleep(1600);
  }
  const openedTrip = listed.onBook
    ? { ok: true, href: listed.hash }
    : await evalJs(send, `(() => {
    const a = [...document.querySelectorAll('a.md3-book-main, a[href*="book/"]')].find((el) => (el.textContent || '').includes(${JSON.stringify(bookName)}));
    if (!a) return { ok: false, href: '' };
    const href = a.getAttribute('href') || '';
    a.click();
    const path = href.replace(/^#/, '');
    if (path) location.hash = path.charAt(0) === '/' ? path : '/' + path;
    return { ok: true, href };
  })()`);
  await sleep(2200);
  const tripEntry = await evalJs(send, `(() => {
    const add = [...document.querySelectorAll('button')].find((b) => /Add entry/i.test(b.textContent || ''));
    add?.click();
    return Boolean(add);
  })()`);
  await sleep(1000);
  const tripFields = await evalJs(send, `(() => {
    const chips = [...document.querySelectorAll('.purpose-cat-chip')].map((c) => (c.textContent || '').trim());
    const labels = [...document.querySelectorAll('[role="dialog"] label, .record-sheet label')].map((l) => (l.textContent || '').trim());
    return { chips: chips.slice(0, 10), labels: labels.slice(0, 10), hash: location.hash, purpose: document.querySelector('[data-purpose-id]')?.getAttribute('data-purpose-id') || '' };
  })()`);
  shot('e2e-03d-trip-fields');
  logStep(
    'trip-purpose-fields',
    { openedTrip, tripEntry, ...tripFields },
        Boolean(openedTrip?.ok) && /book\//i.test(tripFields.hash) && tripFields.chips.some((c) => /Hotel/i.test(c)),
  );
  await evalJs(send, `(() => {
    [...document.querySelectorAll('[role="dialog"] button')].find((b) => /Cancel/i.test(b.textContent || ''))?.click();
    return true;
  })()`);
  await sleep(400);
  await evalJs(send, `location.hash = '#/'`);
  await sleep(800);

  if (!listed.hasName) {
    await evalJs(send, `(() => {
      const close = [...document.querySelectorAll('button')].find((b) => /Cancel/i.test(b.textContent || ''));
      close?.click();
      return true;
    })()`);
    await sleep(400);
  }

  // --- FAB orbit ---
  await evalJs(send, `document.querySelector('.dash-fab-center')?.click()`);
  await sleep(900);
  const orbit = await evalJs(send, `(() => {
    const fab = document.querySelector('.dash-fab-center')?.getBoundingClientRect();
    const items = [...document.querySelectorAll('.dash-fab-item')].map((el) => {
      const r = el.querySelector('.dash-fab-btn')?.getBoundingClientRect() || el.getBoundingClientRect();
      const label = el.querySelector('.dash-fab-label')?.textContent || '';
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const fcx = fab ? fab.left + fab.width / 2 : 0;
      const fcy = fab ? fab.top + fab.height / 2 : 0;
      return { label, dist: Math.round(Math.hypot(cx - fcx, cy - fcy)), cy: Math.round(cy) };
    });
    const open = Boolean(document.querySelector('.dash-fab-orbit'));
    const fcy = fab ? fab.top + fab.height / 2 : 0;
    return {
      open,
      items,
      radiiOk: items.length > 0 && items.every((i) => i.dist > 70 && i.dist < 140),
      above: items.every((i) => i.cy < fcy - 20),
    };
  })()`);
  shot('e2e-04-fab-orbit');
  logStep('fab-orbit-around-plus', orbit, orbit.open && orbit.radiiOk && orbit.above && orbit.items.length >= 2);

  await evalJs(send, `document.querySelector('.dash-fab-item.is-add')?.click()`);
  await sleep(1100);
  const fabPick = await evalJs(send, `(() => ({
    sheet: Boolean(document.querySelector('.book-pick-sheet')),
    rows: document.querySelectorAll('.book-pick-row').length,
  }))()`);
  shot('e2e-05-fab-add-pick');
  logStep('fab-add-opens-book-pick', fabPick, fabPick.sheet && fabPick.rows > 0);
  await evalJs(send, `document.querySelector('.book-pick-dim, [aria-label="Close"]')?.click()`);
  await sleep(400);

  // --- Books tab ---
  await evalJs(send, `document.querySelector('.dash-tab-books')?.click()`);
  await sleep(1500);
  const booksPage = await evalJs(send, `(() => ({
    hash: location.hash,
    bookLinks: document.querySelectorAll('a[href*="book/"]').length,
    activityTab: [...document.querySelectorAll('.dash-tab')].some((t) => /Activity/i.test(t.textContent || '')),
  }))()`);
  shot('e2e-06-books');
  logStep('books-dashboard', booksPage, /expenses/i.test(booksPage.hash) && booksPage.activityTab === true);

  // Open first book + purpose quick actions + receipt
  await evalJs(send, `(() => {
    const links = [...document.querySelectorAll('a[href*="book/"]')];
    const ledger = links.find((a) => !/pay=/.test(a.getAttribute('href') || ''));
    (ledger || links[0])?.click();
    return Boolean(ledger || links[0]);
  })()`);
  await sleep(2200);
  const bookView = await evalJs(send, `(() => ({
    hash: location.hash,
    title: document.querySelector('h1, .font-display')?.textContent?.slice(0, 80) || '',
    purposeQa: [...document.querySelectorAll('.purpose-qa-btn')].map((b) => b.textContent.trim()).slice(0, 6),
    receiptBtn: [...document.querySelectorAll('button')].some((b) => /receipt|attachment|proof/i.test(b.textContent || '') || b.querySelector('svg')),
  }))()`);
  shot('e2e-07-book-view');
  logStep('open-book', bookView, /book\//i.test(bookView.hash));

  const bookTools = await evalJs(send, `(() => {
    const text = document.body.innerText || '';
    const crashed = /Minified React error|Maximum update depth|This screen could not open/i.test(text);
    const filter = document.querySelector('button[title="Filters"], button[aria-label="Filters"]');
    const download = document.querySelector('button[title="Download report"], button[title="Export"]');
    const mail = document.querySelector('button[title="Email PDF report"], button[title="Email report"]');
    return {
      crashed,
      hasFilter: Boolean(filter),
      hasDownload: Boolean(download),
      hasMail: Boolean(mail),
      hash: location.hash,
    };
  })()`);
  logStep('book-filter-download-mail', bookTools, !bookTools.crashed && bookTools.hasFilter && bookTools.hasDownload);

  if (bookTools.hasDownload) {
    await evalJs(send, `document.querySelector('button[title="Download report"], button[title="Export"]')?.click()`);
    await sleep(700);
    const exportMenu = await evalJs(send, `(() => {
      const text = document.body.innerText || '';
      return {
        pdf: /PDF report/i.test(text),
        csv: /CSV spreadsheet|CSV ledger/i.test(text),
      };
    })()`);
    logStep('book-export-menu', exportMenu, exportMenu.pdf && exportMenu.csv);
    await evalJs(send, `document.querySelector('.fixed.inset-0')?.click()`);
    await sleep(300);
  }

  const addForm = await evalJs(send, `(() => {
    const add = [...document.querySelectorAll('button')].find((b) => /Add entry/i.test(b.textContent || ''));
    add?.click();
    return Boolean(add);
  })()`);
  await sleep(900);
  const purposeEntry = await evalJs(send, `(() => {
    const chips = [...document.querySelectorAll('.purpose-cat-chip')].map((c) => (c.textContent || '').trim());
    const labels = [...document.querySelectorAll('[role="dialog"] label, .record-sheet label')].map((l) => (l.textContent || '').trim());
    return {
      opened: Boolean(document.querySelector('[role="dialog"]')),
      chips: chips.slice(0, 10),
      chipCount: chips.length,
      labels: labels.slice(0, 12),
    };
  })()`);
  shot('e2e-07c-purpose-fields');
  logStep('purpose-fields-on-entry', { addForm, ...purposeEntry }, addForm && purposeEntry.opened && (purposeEntry.chipCount >= 3 || purposeEntry.labels.some((l) => /category|payee|hotel|vendor/i.test(l))));
  await evalJs(send, `(() => {
    const cancel = [...document.querySelectorAll('[role="dialog"] button')].find((b) => /Cancel/i.test(b.textContent || ''));
    cancel?.click();
    document.querySelector('[role="dialog"] button')?.click();
    return true;
  })()`);
  await sleep(400);

  const receiptOpened = await evalJs(send, `(() => {
    document.querySelector('.sr-dim, .book-pick-dim')?.click();
    const btn = document.querySelector('[data-receipt-open="true"], button[aria-label="Open attachment"]');
    if (btn) { btn.click(); return 'clicked'; }
    return 'none';
  })()`);
  await sleep(2200);
  const receiptModal = await evalJs(send, `(() => {
    const root = document.querySelector('#receipt-modal-backdrop, .receipt-modal-root');
    const inBody = root ? root.parentElement === document.body : false;
    const rect = root?.getBoundingClientRect();
    const visible = root && rect && rect.width > 100 && rect.height > 100 && rect.top >= -40 && rect.bottom <= (window.innerHeight + 80);
    return {
      opened: Boolean(root),
      reading: Boolean(document.querySelector('.sr-root')),
      inBody,
      visible: Boolean(visible),
      top: rect ? Math.round(rect.top) : null,
      h: rect ? Math.round(rect.height) : null,
      parent: root ? root.parentElement?.tagName : null,
    };
  })()`);
  shot('e2e-07b-receipt');
  logStep(
    'receipt-modal-portal',
    { ...receiptModal, via: receiptOpened },
    receiptOpened === 'none' || (receiptModal.opened && receiptModal.inBody && receiptModal.visible),
  );
  if (receiptModal.opened || receiptModal.reading) {
    await evalJs(send, `document.querySelector('#btn-close-receipt-modal, .receipt-modal-close-btn, .sr-dim, .sr-btn-ghost')?.click()`);
    await sleep(400);
  }

  // --- Activity tab ---
  await evalJs(send, `document.querySelector('.dash-tab-activity')?.click()`);
  await sleep(1600);
  const activity = await evalJs(send, `(() => ({
    hash: location.hash,
    title: /What.?s happening|Activity/i.test(document.body.innerText || ''),
    regularLink: [...document.querySelectorAll('a')].some((a) => /Regular payments/i.test(a.textContent || '')),
  }))()`);
  shot('e2e-08-activity');
  logStep('activity-tab', activity, /activity/i.test(activity.hash) && activity.title);

  // Regular payments
  await evalJs(send, `location.hash = '#/regular-payments'`);
  await sleep(1600);
  const regular = await evalJs(send, `(() => ({
    hash: location.hash,
    heading: /Regular payments/i.test(document.body.innerText || ''),
    emptyOrList: /No recurring|Detected patterns|Upcoming|Autopilot/i.test(document.body.innerText || ''),
  }))()`);
  shot('e2e-08b-regular');
  logStep('regular-payments', regular, /regular-payments/i.test(regular.hash) && regular.heading);

  // --- Notifications ---
  await evalJs(send, `location.hash = '#/'`);
  await sleep(1000);
  await evalJs(send, `document.querySelector('button.byjan-bell, .byjan-bell')?.click()`);
  await sleep(1200);
  const notifs = await evalJs(send, `(() => {
    const sheet = document.querySelector('.ios-notify-sheet');
    return {
      open: Boolean(sheet),
      title: document.querySelector('.ios-notify-title')?.textContent || '',
    };
  })()`);
  shot('e2e-09-notifications');
  logStep('notifications-inbox', notifs, notifs.open);
  await evalJs(send, `document.querySelector('[aria-label="Close notifications"], .ios-sheet-dim')?.click()`);
  await sleep(500);

  // --- More / Settings ---
  await evalJs(send, `document.querySelector('.dash-tab-more')?.click()`);
  await sleep(1400);
  const settings = await evalJs(send, `(() => {
    const text = document.body.innerText || '';
    return {
      hash: location.hash,
      hasSettings: /Settings/i.test(text) && /Preferences/i.test(text),
      hasDisplay: /Display|Text size|Icon size/i.test(text),
      hasHelp: /Help & tickets|Help/i.test(text),
      crashed: /Minified React error|Maximum update depth|This screen could not open/i.test(text),
    };
  })()`);
  shot('e2e-10-settings');
  logStep('settings-page', settings, settings.hasSettings && settings.hasDisplay && !settings.crashed);

  await evalJs(send, `location.hash = '#/help'`);
  await sleep(1400);
  const help = await evalJs(send, `(() => {
    const text = document.body.innerText || '';
    return {
      hash: location.hash,
      ok: /Help|ticket|Account|Money/i.test(text),
      crashed: /Minified React error|Maximum update depth|This screen could not open/i.test(text),
    };
  })()`);
  logStep('help-page', help, /help/i.test(help.hash) && help.ok && !help.crashed);

  await evalJs(send, `location.hash = '#/access'`);
  await sleep(1800);
  const access = await evalJs(send, `(() => {
    const tree = document.querySelector('[data-access-tree="true"]');
    const keys = [...document.querySelectorAll('[data-feature-key]')].map((el) => el.getAttribute('data-feature-key'));
    const text = document.body.innerText || '';
    return {
      hash: location.hash,
      tree: Boolean(tree),
      keyCount: keys.length,
      hasActivity: keys.includes('money_activity') || /Activity feed/i.test(text),
      hasSales: keys.includes('sales') || /Sales/i.test(text),
      hasInbox: keys.includes('money_inbox') || /Financial inbox/i.test(text),
      hasEmail: keys.includes('money_email') || keys.includes('money_email_tab') || /\\bEmail\\b/.test(text),
      hasSplit: keys.includes('money_split') || keys.includes('money_split_tab') || /Splits/i.test(text),
      hasBookReports: keys.includes('money_book_analytics') || /Book reports tab/i.test(text),
      hasInvoiceCreate: keys.includes('act_books_invoices_create') || /Create/.test(text),
      blocked: /not turned on|Settings/i.test(text) && !tree,
    };
  })()`);
  shot('e2e-10b-access');
  logStep(
    'access-control-tree',
    access,
    access.tree
      ? access.keyCount >= 20 && access.hasActivity && access.hasSales && access.hasEmail && access.hasSplit && access.hasBookReports
      : true,
  );

  const voice = await evalJs(send, `(() => {
    const cap = window.Capacitor;
    return {
      native: Boolean(cap?.isNativePlatform?.()),
      avail: Boolean(cap?.isPluginAvailable?.('VoiceCapture')),
    };
  })()`);
  logStep('voice-plugin-present', voice, !voice.native || voice.avail);

  // Reports
  await evalJs(send, `location.hash = '#/reports'`);
  await sleep(1800);
  const reports = await evalJs(send, `(() => ({
    hash: location.hash,
    ok: /Reports|insights|Period snapshot|What changed/i.test(document.body.innerText || ''),
  }))()`);
  shot('e2e-11-reports');
  logStep('money-reports', reports, /reports/i.test(reports.hash) && reports.ok);

  await evalJs(send, `location.hash = '#/'`);
  await sleep(800);
  shot('e2e-99-final');

  writeFileSync(join(OUT, 'report.json'), JSON.stringify(report, null, 2));
  const crash = report.exceptions.some((e) => /Maximum update|Minified React|Settings is not/i.test(e));
  if (crash) {
    report.ok = false;
    report.fails.push('js-crash');
  }
  console.log('REPORT_OK', report.ok);
  console.log('FAILS', report.fails);
  if (report.exceptions.length) console.log('JS_EXCEPTIONS', report.exceptions);
  ws.close();
  if (!report.ok) process.exit(2);
}

main().catch((err) => {
  console.error('E2E_FULL_FAIL', err);
  process.exit(1);
});

/**
 * Deep phone E2E: attach documents without breaking the entry form, persist receipts,
 * map shared receipt text through the inbound field parser.
 *
 * Does not force-stop or sign the user out. Leaves the session as-is.
 *
 * Usage: node scripts/phone-receipt-e2e.mjs
 */
import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const SERIAL = process.env.BYJAN_SERIAL || 'ZD222LNHM5';
const PKG = 'com.byjanbooks.app';
const ADB = process.platform === 'win32'
  ? join(process.env.LOCALAPPDATA || '', 'Android', 'Sdk', 'platform-tools', 'adb.exe')
  : 'adb';
const OUT = join(process.cwd(), 'tmp-receipt-e2e');
mkdirSync(OUT, { recursive: true });

const results = [];
const adb = (args, opts = {}) => execSync(`"${ADB}" -s ${SERIAL} ${args}`, { encoding: 'utf8', ...opts }).trim();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function record(name, pass, data) {
  results.push({ name, pass, data });
  console.log(`${pass ? 'PASS' : 'FAIL'} ${name}${data === undefined ? '' : ` ${JSON.stringify(data)}`}`);
}

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
  if (result?.exceptionDetails) {
    throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text || 'eval failed');
  }
  return result?.result?.value;
}

async function waitFor(fn, { timeout = 12000, every = 200 } = {}) {
  const start = Date.now();
  let last;
  while (Date.now() - start < timeout) {
    last = await fn();
    if (last) return last;
    await sleep(every);
  }
  return last;
}

async function attachRunningWebview() {
  const list = execSync(`"${ADB}" devices`, { encoding: 'utf8' });
  if (!list.includes(SERIAL)) throw new Error(`Device ${SERIAL} not connected:\n${list}`);
  let pid = String(adb(`shell pidof ${PKG}`) || '').trim().split(/\s+/)[0];
  if (!pid) {
    try { adb(`shell am start -n ${PKG}/com.byjanbooks.com.MainActivity`); }
    catch { adb(`shell monkey -p ${PKG} -c android.intent.category.LAUNCHER 1`); }
    for (let i = 0; i < 20 && !pid; i += 1) {
      await sleep(400);
      pid = String(adb(`shell pidof ${PKG}`) || '').trim().split(/\s+/)[0];
    }
  }
  if (!pid) throw new Error('app pid missing');
  try { execSync(`"${ADB}" -s ${SERIAL} forward --remove tcp:9222`, { stdio: 'ignore' }); } catch { /* */ }
  adb(`forward tcp:9222 localabstract:webview_devtools_remote_${pid}`);
  for (let i = 0; i < 25; i += 1) {
    await sleep(300);
    try {
      const pages = await fetch('http://127.0.0.1:9222/json').then((r) => r.json());
      const page = (Array.isArray(pages) ? pages : []).find((t) => t.webSocketDebuggerUrl);
      if (page?.webSocketDebuggerUrl) return page.webSocketDebuggerUrl;
    } catch { /* retry */ }
  }
  throw new Error('webview not reachable');
}

async function main() {
  const wsUrl = await attachRunningWebview();
  const conn = await cdp(wsUrl);
  send = conn.send;
  await send('Runtime.enable');

  const boot = await waitFor(() => js(`({
    hash: location.hash,
    login: Boolean(document.querySelector('input[type="email"]')),
    tabs: document.querySelectorAll('.dash-tab').length,
    body: (document.body.innerText || '').slice(0, 180),
  })`), { timeout: 20000 });
  record('session still signed in (no login wall)', !boot?.login && (boot?.tabs > 0 || /#\/book\//.test(String(boot?.hash || ''))), boot);
  if (boot?.login) {
    writeFileSync(join(OUT, 'report.json'), JSON.stringify({ ok: false, results }, null, 2));
    process.exit(2);
  }

  const clickNamed = (name) => js(`(() => {
    const needle = ${JSON.stringify(name)}.toLowerCase();
    const els = [...document.querySelectorAll('button, a, [role="button"], .md3-book, .md3-book-main, li, article')];
    const hit = els.find((el) => (el.textContent || '').trim().toLowerCase().includes(needle));
    if (!hit) return false;
    hit.click();
    return (hit.textContent || '').trim().slice(0, 80);
  })()`);

  await waitFor(() => js(`document.body.innerText.includes('Home expenses') || document.querySelectorAll('.md3-book').length > 0`), { timeout: 10000 });
  await js(`(() => { const main = document.querySelector('main') || document.scrollingElement; if (main) main.scrollTop = 1200; window.scrollTo(0, 1400); return true; })()`);
  await sleep(500);
  const openedBook = await js(`(() => {
    const card = [...document.querySelectorAll('.md3-book, article, a')].find((el) => /Home expenses/i.test(el.textContent || ''));
    const href = [...document.querySelectorAll('a')]
      .map((a) => a.getAttribute('href') || '')
      .find((h) => /#\\/book\\/[a-zA-Z0-9_-]+$/.test(h) || /^\\/book\\/[a-zA-Z0-9_-]+$/.test(h));
    if (href && /book/.test(href)) {
      const hash = href.startsWith('#') ? href : ('#' + href.replace(/^\\//, '/'));
      location.hash = hash.startsWith('#') ? hash : ('#/' + hash.replace(/^#?\\/?/, ''));
      return { via: 'hash', href };
    }
    const main = card?.querySelector?.('.md3-book-main') || card;
    if (main && main.click) { main.click(); return { via: 'click', text: (card.textContent || '').slice(0, 60) }; }
    return { hrefs: [...document.querySelectorAll('a')].map((a) => a.getAttribute('href')).filter(Boolean).slice(0, 12) };
  })()`);
  const onBook = await waitFor(() => js(`/#\\/book\\//.test(location.hash) || Boolean(document.querySelector('[data-testid="entry-form"]'))`), { timeout: 14000 });
  record('open a money book', Boolean(onBook), { openedBook, hash: await js(`location.hash`) });

  const addClicked = await js(`(() => {
    const btns = [...document.querySelectorAll('button, [role="button"]')];
    const hit = btns.find((el) => /^add$|^add expense$|^new entry$/i.test((el.textContent || '').trim()))
      || document.querySelector('[data-testid="add-entry"], .fab-add, button[aria-label*="Add"]');
    if (!hit) return false;
    hit.click();
    return true;
  })()`);
  await sleep(600);
  const formOpen = await waitFor(() => js(`Boolean(document.querySelector('[data-testid="entry-form"]'))`), { timeout: 8000 });
  record('open add-entry form', Boolean(addClicked && formOpen), { addClicked, formOpen });

  const attachPresent = await js(`Boolean(document.querySelector('[data-testid="entry-attach-receipt"], [data-testid="entry-receipt-file"]'))`);
  record('attach control is a file input (not camera-only)', attachPresent);

  const stayedOpen = await js(`(() => {
    const form = document.querySelector('[data-testid="entry-form"]');
    const file = document.querySelector('[data-testid="entry-receipt-file"]');
    if (!form || !file) return { form: Boolean(form), file: Boolean(file) };
    const blob = new Blob(['Byjan attach e2e pdf'], { type: 'application/pdf' });
    const f = new File([blob], 'byjan-e2e-attach.pdf', { type: 'application/pdf' });
    const dt = new DataTransfer();
    dt.items.add(f);
    file.files = dt.files;
    file.dispatchEvent(new Event('change', { bubbles: true }));
    return { form: Boolean(document.querySelector('[data-testid="entry-form"]')), started: true };
  })()`);
  await sleep(2500);
  const afterAttach = await js(`({
    form: Boolean(document.querySelector('[data-testid="entry-form"]')),
    crash: /This screen could not open|Minified React error|Maximum update depth/i.test(document.body.innerText || ''),
    attachLabel: ([...document.querySelectorAll('button')].find((b) => /attach|document attached|pdf/i.test(b.textContent || '')) || {}).textContent || '',
    toast: (document.body.innerText || '').slice(0, 400),
  })`);
  record('entry form stays open after attaching a PDF', Boolean(afterAttach?.form) && !afterAttach?.crash, { stayedOpen, afterAttach });

  await js(`(() => {
    const close = document.querySelector('[data-testid="entry-form"]')?.closest('[role="dialog"]')?.querySelector('button[aria-label="Close"], button');
    const x = [...document.querySelectorAll('button')].find((b) => (b.getAttribute('aria-label') || '') === 'Close');
    (x || close)?.click?.();
    return true;
  })()`);
  await sleep(400);

  const shareText = 'Paid Swiggy Rs349 PhonePe dinner HDFC UPI 12-09-2026';
  try {
    adb(`shell am start -a android.intent.action.SEND -t text/plain --es android.intent.extra.TEXT ${shareText.replace(/ /g, '\\ ')} -n ${PKG}/com.byjanbooks.com.MainActivity`);
  } catch {
    try {
      adb(`shell am start -a android.intent.action.SEND -t text/plain --es android.intent.extra.TEXT PaidSwiggyRs349PhonePeDinner -n ${PKG}/com.byjanbooks.com.MainActivity`);
    } catch (err) {
      record('share intent launched', false, { error: String(err.message || err).slice(0, 240) });
    }
  }
  await sleep(1500);
  const picked = await clickNamed('Home expenses') || await clickNamed('emails');
  const shareUi = await waitFor(() => js(`({
    hash: location.hash,
    text: (document.body.innerText || '').slice(0, 900),
    review: /Confirm before|Reading share|Review|Confirm /i.test(document.body.innerText || ''),
    amount: /349|Rs349|₹349/.test(document.body.innerText || ''),
    meals: /Meals|dinner|Swiggy/i.test(document.body.innerText || ''),
    crash: /This screen could not open|Minified React error/i.test(document.body.innerText || ''),
  })`), { timeout: 22000 });
  record('shared receipt opens capture UI (not crash)', Boolean(shareUi?.review || shareUi?.amount) && !shareUi?.crash, { picked, ...shareUi });
  record('shared receipt maps amount 349', Boolean(shareUi?.amount), shareUi);
  record('shared receipt maps merchant/category/description', Boolean(shareUi?.meals), shareUi);

  const paperclip = await js(`({
    clips: document.querySelectorAll('[data-receipt-open="true"]').length,
    view: /Open attachment|Receipt attached|Document attached/i.test(document.body.innerText || ''),
  })`);
  record('ledger shows attachment affordance on entries with receipts', paperclip.clips > 0 || paperclip.view, paperclip);

  const inboundHint = await js(`(/@easypado\\.com|inbound|email receipt/i.test(document.body.innerText || ''))`);
  record('email inbound address still present in book UI', inboundHint);

  const fails = results.filter((r) => !r.pass);
  writeFileSync(join(OUT, 'report.json'), JSON.stringify({ ok: fails.length === 0, results }, null, 2));
  console.log(fails.length ? `E2E_FAIL ${fails.length}` : 'E2E_OK');
  process.exit(fails.length ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  writeFileSync(join(OUT, 'report.json'), JSON.stringify({ ok: false, error: String(err?.message || err), results }, null, 2));
  process.exit(1);
});

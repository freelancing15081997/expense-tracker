/**
 * Closed-app tray: sign in, register FCM, leave the app, ping / add-entry, check shade.
 * Credentials: badrinathp316@gmail.com / 123456
 */
import { execSync } from 'node:child_process';
import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const SERIAL = process.env.BYJAN_SERIAL || 'ZD222LNHM5';
const EMAIL = 'badrinathp316@gmail.com';
const PASS = '123456';
const API = 'https://www.easypado.com';
const PKG = 'com.byjanbooks.com';
const OUT = join(process.cwd(), 'tmp-e2e-full');
mkdirSync(OUT, { recursive: true });

const report = { steps: [], fails: [], ok: true };

function adb(args, opts = {}) {
  return execSync(`adb -s ${SERIAL} ${args}`, { encoding: 'utf8', ...opts }).trim();
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function logStep(name, data, pass = true) {
  report.steps.push({ name, pass, data });
  console.log(pass ? 'PASS' : 'FAIL', name, JSON.stringify(data));
  if (!pass) {
    report.ok = false;
    report.fails.push(name);
  }
}

function shot(name) {
  try {
    adb('shell screencap -p /sdcard/byjan-e2e.png');
    const dest = join(OUT, `${name}.png`);
    execSync(`adb -s ${SERIAL} pull /sdcard/byjan-e2e.png "${dest}"`, { stdio: 'pipe' });
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

async function attachWebview() {
  adb(`shell am force-stop ${PKG}`);
  adb(`shell am start -n ${PKG}/.MainActivity`);
  await sleep(4000);
  let pid = '';
  for (let i = 0; i < 10; i += 1) {
    pid = adb(`shell pidof ${PKG}`);
    if (pid) break;
    await sleep(800);
  }
  if (!pid) throw new Error('app pid missing');
  try { execSync(`adb -s ${SERIAL} forward --remove tcp:9222`, { stdio: 'ignore' }); } catch { /* */ }
  adb(`forward tcp:9222 localabstract:webview_devtools_remote_${pid}`);
  await sleep(700);
  const list = await fetch('http://127.0.0.1:9222/json').then((r) => r.json());
  const page = list.find((t) => t.type === 'page' && t.webSocketDebuggerUrl) || list[0];
  if (!page) throw new Error('no webview page');
  return { wsUrl: page.webSocketDebuggerUrl, pid };
}

function grantNotify() {
  try { adb(`shell pm grant ${PKG} android.permission.POST_NOTIFICATIONS`); } catch { /* older API */ }
  try { adb(`shell dumpsys deviceidle whitelist +${PKG}`); } catch { /* */ }
  try { adb(`shell cmd appops set ${PKG} RUN_IN_BACKGROUND allow`); } catch { /* */ }
  try { adb(`shell cmd appops set ${PKG} RUN_ANY_IN_BACKGROUND allow`); } catch { /* */ }
}

function shadeDump() {
  let dump = '';
  try {
    dump = adb('shell "dumpsys notification | grep -F pkg=com.byjanbooks.com"');
  } catch {
    try { dump = adb('shell dumpsys notification'); } catch { dump = ''; }
  }
  const posted = dump.split('\n').filter((line) => line.includes('pkg=com.byjanbooks.com')).slice(0, 12);
  const records = posted.filter((line) => /NotificationRecord/.test(line));
  const fcmRecords = records.filter((line) => !/id=910017/.test(line));
  const byjan = fcmRecords.length > 0;
  return { byjan, posted: records, fcm: fcmRecords, len: dump.length };
}

async function apiPost(idToken, path, body) {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${idToken}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { json = { raw: text.slice(0, 400) }; }
  return { status: res.status, json };
}

function fillLoginExpr() {
  return `(() => {
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
  })()`;
}

async function main() {
  const list = execSync('adb devices', { encoding: 'utf8' });
  if (!list.includes(SERIAL)) throw new Error(`Device ${SERIAL} not connected\n${list}`);
  grantNotify();
  logStep('device', { serial: SERIAL, grant: true });

  try { adb('shell cmd notification cancel-all'); } catch { /* */ }

  const { wsUrl } = await attachWebview();
  const { send, ws } = await cdp(wsUrl);
  await send('Runtime.enable');
  await send('Console.enable').catch(() => undefined);

  const dismiss = `(() => {
    const btns = [...document.querySelectorAll('button, a, [role="button"]')];
    const hit = btns.find((el) => /skip|got it|close tour|not now|dismiss|allow/i.test((el.textContent || '') + ' ' + (el.getAttribute('aria-label') || '')));
    if (hit) { hit.click(); return true; }
    return false;
  })()`;

  let state = await evalJs(send, `(() => ({
    hash: location.hash,
    hasTabs: document.querySelectorAll('.dash-tab').length,
    text: (document.body.innerText || '').slice(0, 240),
  }))()`);
  if (!state.hasTabs || /sign in|welcome back|create account/i.test(state.text)) {
    await evalJs(send, fillLoginExpr());
    await sleep(4500);
    await evalJs(send, dismiss);
  }
  await evalJs(send, dismiss);
  await sleep(5000);

  const nativePush = await evalJs(send, `(async () => {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const plugin = window.Capacitor?.Plugins?.PushNotifications;
    if (!plugin) return { error: 'no-plugin', token: '' };
    let token = window.__BYJAN_PUSH_TOKEN || '';
    try {
      await plugin.addListener('registration', (t) => {
        token = String(t && t.value || '');
        window.__BYJAN_PUSH_TOKEN = token;
      });
    } catch (err) {
      return { error: String(err && err.message || err), token };
    }
    try { await plugin.register(); } catch (err) { return { error: String(err && err.message || err), token }; }
    for (let i = 0; i < 25; i += 1) {
      token = window.__BYJAN_PUSH_TOKEN || token;
      if (token) return { token, i };
      await wait(400);
    }
    return { token, i: 25 };
  })()`).catch((err) => ({ error: String(err.message || err), token: '' }));
  logStep('native-token', { len: String(nativePush?.token || '').length, error: nativePush?.error || null }, Boolean(nativePush?.token));
  const tokenMeta = { pushToken: String(nativePush?.token || '') };

  const authSnap = await evalJs(send, `(async () => {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    let email = '';
    let idToken = '';
    let pushToken = '';
    for (let i = 0; i < 25; i += 1) {
      pushToken = window.__BYJAN_PUSH_TOKEN || pushToken;
      try {
        const key = Object.keys(localStorage).find((k) => k.startsWith('firebase:authUser')) || '';
        const raw = key ? localStorage.getItem(key) : '';
        if (raw) {
          const parsed = JSON.parse(raw);
          email = parsed?.email || parsed?.providerData?.[0]?.email || email;
          idToken = parsed?.stsTokenManager?.accessToken || idToken;
        }
      } catch {}
      if (idToken) return { email, idToken, pushToken, i };
      await wait(400);
    }
    return { email, idToken, pushToken, i: 25 };
  })()`);

  let idToken = String(authSnap?.idToken || '');
  let email = String(authSnap?.email || '');
  if (!idToken) {
    const authRes = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=AIzaSyDQUXdMTTUOONPbua5cWm75Jn-7-SkRwjE`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: EMAIL, password: PASS, returnSecureToken: true }),
    });
    const authJson = await authRes.json();
    idToken = String(authJson.idToken || '');
    email = String(authJson.email || EMAIL);
  }
  if (authSnap) {
    authSnap.idToken = idToken;
    authSnap.email = email;
  }
  logStep('auth-token', {
    email,
    hasId: Boolean(idToken),
    pushLen: String(authSnap?.pushToken || tokenMeta.pushToken || '').length,
  }, Boolean(idToken));

  if (idToken && tokenMeta.pushToken) {
    const saved = await apiPost(idToken, '/api/notifications', { op: 'registerPush', token: tokenMeta.pushToken, platform: 'android' });
    logStep('register-push', { status: saved.status, json: saved.json }, saved.status < 400);
  }

  try {
    await evalJs(send, `(async () => {
      const plugin = window.Capacitor?.Plugins?.LocalNotifications;
      if (!plugin) return { skipped: true };
      await plugin.schedule({
        notifications: [{
          id: 910017,
          title: 'Byjan',
          body: 'Local tray control',
          schedule: { at: new Date(Date.now() + 2500).toISOString() },
          channelId: 'byjan_alerts',
        }],
      });
      return { ok: true };
    })()`);
  } catch { /* ignore */ }

  let pingWhileOpen = null;
  if (authSnap?.idToken) {
    pingWhileOpen = await apiPost(authSnap.idToken, '/api/notifications', { op: 'pingSelf' });
    logStep('ping-open', { status: pingWhileOpen.status, json: pingWhileOpen.json }, pingWhileOpen.status < 400);
  }

  const books = authSnap?.idToken
    ? await apiPost(authSnap.idToken, '/api/ledgers', { op: 'list' })
    : { status: 0, json: {} };
  const bookList = Array.isArray(books.json?.books) ? books.json.books : [];
  const shared = bookList.find((b) => Object.keys(b.roles || {}).length > 1) || bookList[0];
  logStep('books', { count: bookList.length, shared: shared ? { id: shared.id, name: shared.name, members: Object.keys(shared.roles || {}).length } : null }, bookList.length > 0);

  ws.close();
  adb('shell input keyevent KEYCODE_HOME');
  await sleep(1200);
  let focus = '';
  try { focus = adb('shell "dumpsys window | grep mCurrentFocus"'); } catch {
    try { focus = adb('shell dumpsys window'); } catch { focus = ''; }
  }
  logStep('left-app', { focus: String(focus).slice(0, 220) }, !String(focus).includes(PKG));

  await sleep(2800);
  const localShade = shadeDump();
  logStep('tray-local', { byjan: localShade.byjan, posted: localShade.posted }, true);
  try { adb(`shell cmd notification cancel ${PKG} 910017`); } catch { /* */ }

  let pingClosed = null;
  if (authSnap?.idToken) {
    pingClosed = await apiPost(authSnap.idToken, '/api/notifications', { op: 'pingSelf' });
    logStep('ping-closed', { status: pingClosed.status, json: pingClosed.json }, pingClosed.status < 400 && pingClosed.json?.sent !== false);
  }

  await sleep(3500);
  try { adb('shell cmd statusbar expand-notifications'); } catch { /* */ }
  await sleep(900);
  shot('e2e-closed-push-shade');
  const shade = shadeDump();
  logStep('tray-after-ping', { byjan: shade.byjan, posted: shade.posted, fcm: shade.fcm }, shade.byjan);

  let createRes = null;
  if (authSnap?.idToken && shared?.id) {
    createRes = await apiPost(authSnap.idToken, '/api/expenses', {
      op: 'create',
      bookId: shared.id,
      expense: {
        amount: 1,
        description: `Closed-app push probe ${Date.now()}`,
        category: 'Other',
        date: new Date().toISOString().slice(0, 10),
        paidAt: new Date().toISOString().slice(0, 10),
      },
    });
    logStep('entry-create', { status: createRes.status, error: createRes.json?.error || null, id: createRes.json?.expense?.id || null }, createRes.status < 400);
    await sleep(3500);
    const shade2 = shadeDump();
    logStep('tray-after-entry', { byjan: shade2.byjan, posted: shade2.posted }, true);
  }

  try { adb('shell cmd statusbar collapse'); } catch { /* */ }

  writeFileSync(join(OUT, 'closed-push-report.json'), JSON.stringify(report, null, 2));
  console.log('REPORT_OK', report.ok);
  console.log('FAILS', report.fails);
  if (!report.ok) process.exitCode = 1;
}

main().catch((err) => {
  console.error('CLOSED_PUSH_E2E', err);
  process.exit(1);
});

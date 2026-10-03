import assert from 'node:assert/strict';
import test from 'node:test';
import { buildApp } from './app.ts';
import { signBody } from './crypto.ts';
import { reset } from './store.ts';

async function session() {
  const app = buildApp();
  const send = await app.inject({ method: 'POST', url: '/v1/auth/otp/send', payload: { phone: '+919845012345' } });
  const { requestId } = send.json();
  const verify = await app.inject({ method: 'POST', url: '/v1/auth/otp/verify', payload: { requestId, code: '246810' } });
  assert.equal(verify.statusCode, 200);
  const body = verify.json();
  return { app, token: body.token as string, refresh: body.refreshToken as string };
}

test('otp, refresh rotation, book and entry', async () => {
  reset();
  const { app, token, refresh } = await session();
  const bad = await app.inject({ method: 'POST', url: '/v1/auth/otp/verify', payload: { requestId: 'nope', code: '000000' } });
  assert.equal(bad.statusCode, 400);
  const refreshed = await app.inject({ method: 'POST', url: '/v1/auth/refresh', payload: { refreshToken: refresh } });
  assert.equal(refreshed.statusCode, 200);
  const again = await app.inject({ method: 'POST', url: '/v1/auth/refresh', payload: { refreshToken: refresh } });
  assert.equal(again.statusCode, 401);
  const books = await app.inject({ method: 'GET', url: '/v1/books', headers: { authorization: `Bearer ${token}` } });
  assert.equal(books.statusCode, 200);
  assert.ok(books.json().length >= 1);
  const created = await app.inject({
    method: 'POST', url: '/v1/entries', headers: { authorization: `Bearer ${token}` },
    payload: { bookId: 'goa', amount: 100, title: 'Chai', category: 'Food', paidBy: 'AK', split: { members: ['AK', 'PS', 'RV'] } },
  });
  assert.equal(created.statusCode, 200);
  await app.close();
});

test('payment becomes SUCCESS only after a signed webhook or sandbox status', async () => {
  reset();
  const { app, token } = await session();
  const intent = await app.inject({
    method: 'POST', url: '/v1/payments/upi/intent', headers: { authorization: `Bearer ${token}` },
    payload: { toVpa: 'meera@okaxis', amount: 800, note: 'Settle', app: 'GPay' },
  });
  const { paymentId } = intent.json();
  const forged = await app.inject({ method: 'POST', url: '/v1/payments/webhook', payload: { paymentId, status: 'SUCCESS' }, headers: { 'x-byjan-signature': 'nope' } });
  assert.equal(forged.statusCode, 401);
  const raw = JSON.stringify({ paymentId, status: 'SUCCESS', utr: '999' });
  const signed = await app.inject({ method: 'POST', url: '/v1/payments/webhook', payload: raw, headers: { 'content-type': 'application/json', 'x-byjan-signature': signBody(raw) } });
  assert.equal(signed.statusCode, 200);
  const status = await app.inject({ method: 'GET', url: `/v1/payments/${paymentId}` });
  assert.equal(status.json().status, 'SUCCESS');
  await app.close();
});

test('owner keeps every action and a stored entry is fetched back', async () => {
  reset();
  const { app, token } = await session();
  const stripped = { add: false, editAll: false, del: false, approve: false, invite: false, export: false };
  const put = await app.inject({
    method: 'PUT', url: '/v1/books/site/roles/Owner', headers: { authorization: `Bearer ${token}` },
    payload: { perms: stripped, approvalLimit: 1000 },
  });
  const owner = put.json() as { perms: Record<string, boolean>; approvalLimit: number | null };
  for (const key of Object.keys(stripped)) assert.equal(owner.perms[key], true);
  assert.equal(owner.approvalLimit, null);
  const roles = await app.inject({ method: 'GET', url: '/v1/books/site/roles', headers: { authorization: `Bearer ${token}` } });
  const saved = (roles.json() as { role: string; perms: Record<string, boolean> }[]).find(r => r.role === 'Owner');
  assert.equal(saved?.perms.export, true);
  const created = await app.inject({
    method: 'POST', url: '/v1/entries', headers: { authorization: `Bearer ${token}` },
    payload: { bookId: 'goa', amount: 1240, title: 'Lunch', category: 'Food', paidBy: 'AK', split: { members: ['AK', 'PS'] } },
  });
  const id = created.json().id as string;
  const fetched = await app.inject({ method: 'GET', url: `/v1/entries/${id}`, headers: { authorization: `Bearer ${token}` } });
  assert.equal(fetched.statusCode, 200);
  assert.equal(fetched.json().amount, 1240);
  assert.equal(fetched.json().title, 'Lunch');
  const invited = await app.inject({
    method: 'POST', url: '/v1/books/goa/invites', headers: { authorization: `Bearer ${token}` },
    payload: { contacts: ['a@byjan.app', 'b@byjan.app', 'c@byjan.app'], role: 'Contributor' },
  });
  assert.equal(invited.json().sent, 3);
  const started = performance.now();
  for (let i = 0; i < 200; i++) {
    const row = await app.inject({
      method: 'POST', url: '/v1/entries', headers: { authorization: `Bearer ${token}` },
      payload: { bookId: 'home', amount: i + 1, title: `Row ${i}`, category: 'Other', paidBy: 'AK' },
    });
    const back = await app.inject({ method: 'GET', url: `/v1/entries/${row.json().id}`, headers: { authorization: `Bearer ${token}` } });
    assert.equal(back.json().amount, i + 1);
  }
  const elapsed = performance.now() - started;
  assert.ok(elapsed < 3000, `200 save/fetch round trips took ${elapsed.toFixed(0)}ms`);
  await app.close();
});

test('upi qr parse and health', async () => {
  const app = buildApp();
  const health = await app.inject({ method: 'GET', url: '/v1/health' });
  assert.deepEqual(health.json(), { ok: true });
  const qr = await app.inject({ method: 'POST', url: '/v1/upi/qr/parse', payload: { payload: 'upi://pay?pa=chai@icici&pn=Chai%20Point' } });
  assert.equal(qr.json().vpa, 'chai@icici');
  const bad = await app.inject({ method: 'POST', url: '/v1/upi/qr/parse', payload: { payload: 'https://example.com' } });
  assert.equal(bad.statusCode, 422);
  await app.close();
});

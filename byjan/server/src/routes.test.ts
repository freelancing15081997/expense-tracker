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

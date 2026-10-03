import assert from 'node:assert/strict';
import test from 'node:test';
import { splitPaise, smartSettle } from './money.ts';
import { issueSession, readJwt, signBody, verifyBody } from './crypto.ts';

test('split parts add up to the total, including leftovers', () => {
  const parts = splitPaise(100, [1, 1, 1]);
  assert.deepEqual(parts, [34, 33, 33]);
  assert.equal(parts.reduce((a, b) => a + b, 0), 100);
});

test('uneven weights still sum to the total', () => {
  const parts = splitPaise(1000, [1, 2, 3]);
  assert.equal(parts.reduce((a, b) => a + b, 0), 1000);
  assert.deepEqual(parts, [167, 333, 500]);
});

test('smart settle uses the fewest transfers', () => {
  const transfers = smartSettle([
    { id: 'a', netPaise: -300 },
    { id: 'b', netPaise: -200 },
    { id: 'c', netPaise: 500 },
  ]);
  assert.equal(transfers.length, 2);
  assert.equal(transfers.reduce((a, t) => a + t.paise, 0), 500);
});

test('access token expires check and refresh type', () => {
  const { token, refreshToken } = issueSession('u_ak');
  const access = readJwt(token);
  const refresh = readJwt(refreshToken);
  assert.equal(access?.sub, 'u_ak');
  assert.equal(access?.typ, 'access');
  assert.equal(refresh?.typ, 'refresh');
  assert.equal(readJwt(token + 'x'), null);
});

test('webhook signature rejects a tampered body', () => {
  const body = JSON.stringify({ paymentId: 'pay_1', status: 'SUCCESS' });
  const sig = signBody(body);
  assert.equal(verifyBody(body, sig), true);
  assert.equal(verifyBody(body + ' ', sig), false);
});

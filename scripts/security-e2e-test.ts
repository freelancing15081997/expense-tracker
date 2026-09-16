/**
 * Authorization / split / voice / lock unit checks used as production regression.
 * Run: npx tsx scripts/security-e2e-test.ts
 */
import assert from 'node:assert/strict';
import { validateSplitPayload } from '../api/_lib/split-validate.ts';
import { parseVoiceLine } from '../src/lib/voice-capture.ts';
import { userCacheKey } from '../src/lib/user-cache.ts';
import { matchDuplicateExpenses } from '../src/lib/duplicate-match.ts';
import { notificationPath } from '../src/lib/notification-path.ts';

assert.equal(userCacheKey('aaa', 'dash_stats').includes('aaa'), true);
assert.equal(userCacheKey('aaa', 'dash_stats') === userCacheKey('bbb', 'dash_stats'), false);

const members = ['a', 'b'];
assert.equal(validateSplitPayload({
  expenseAmount: 100,
  split: { method: 'equal', participants: [{ uid: 'a' }, { uid: 'b' }] },
  memberUids: members,
}), '');
assert.match(validateSplitPayload({
  expenseAmount: 100,
  split: { method: 'equal', participants: [{ uid: 'a' }, { uid: 'intruder' }] },
  memberUids: members,
}) || '', /not a member/);
assert.match(validateSplitPayload({
  expenseAmount: 100,
  split: { method: 'equal', participants: [{ uid: 'a' }, { uid: 'a' }] },
  memberUids: members,
}) || '', /Duplicate/);
assert.match(validateSplitPayload({
  expenseAmount: 100,
  split: { method: 'exact', participants: [{ uid: 'a', amountPaise: 1000 }, { uid: 'b', amountPaise: 2000 }] },
  memberUids: members,
}) || '', /equal the expense total/);
assert.match(validateSplitPayload({
  expenseAmount: 0,
  split: { method: 'equal', participants: [{ uid: 'a' }] },
  memberUids: members,
}) || '', /greater than zero/);

const voice = parseVoiceLine('Paid 850 rupees to Swiggy from personal book');
assert.equal(voice.amount, 850);
assert.equal(voice.entryType, 'out');
assert.match(voice.merchant.toLowerCase(), /swiggy/);
assert.equal(parseVoiceLine('Received 2000 rupees from client').entryType, 'in');
assert.equal(parseVoiceLine('hello there').amount, 0);

const dups = matchDuplicateExpenses(
  [{ id: '1', amount: 10, date: '2026-09-16', description: 'x', merchant: 'Cafe', receiptHash: 'h1' }],
  { receiptHash: 'h1' },
);
assert.equal(dups[0]?.reason, 'receipt_hash');

assert.equal(notificationPath({ id: '1', bookId: 'b1', settlementId: 's1' }), '/book/b1?pay=s1');
assert.equal(notificationPath({ id: '2', bookId: 'b1', link: '/book/b1?settlements=1' }), '/book/b1?settlements=1');
assert.equal(notificationPath({ id: '3' }), '/notifications');

console.log('security-e2e-test: PASS');

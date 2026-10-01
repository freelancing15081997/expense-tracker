// npm run test:saas — live HTTP checks against a deployed API.
// Env: API_URL, USER_TOKEN (normal Firebase ID token), OWNER_TOKEN (super user token, optional)
import assert from 'node:assert/strict';

const API = String(process.env.API_URL || 'http://localhost:3000').replace(/\/+$/, '');
const post = async (path: string, body: unknown, token?: string) => {
  const r = await fetch(`${API}${path}`, { method: 'POST', headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) });
  let j: any = {}; try { j = await r.json(); } catch { /* */ }
  return { status: r.status, j };
};
const USER = process.env.USER_TOKEN || ''; const OWNER = process.env.OWNER_TOKEN || '';
let n = 0; const t = async (name: string, fn: () => Promise<void>) => { await fn(); n++; console.log('✓', name); };

await t('publicConfig works without sign-in', async () => {
  const r = await post('/api/saas', { op: 'publicConfig' }); assert.equal(r.status, 200); assert.equal(typeof r.j.config?.maintenance, 'boolean');
});
await t('owner ops reject anonymous', async () => { const r = await post('/api/owner', { op: 'overview' }); assert.equal(r.status, 401); });
await t('cron rejects without CRON_SECRET', async () => {
  const r = await fetch(`${API}/api/tracker?domain=saas&op=cron`); assert.equal(r.status, 401);
});
await t('webhook rejects bad signature', async () => {
  const r = await fetch(`${API}/api/payments/cashfree/webhook`, { method: 'POST', headers: { 'x-webhook-timestamp': '1', 'x-webhook-signature': 'nope' }, body: '{}' });
  assert.equal(r.status, 401);
});
if (USER) {
  await t('non-owner gets 403 NOT_OWNER on every owner op', async () => {
    for (const op of ['overview', 'listUsers', 'getUser', 'setUserFeatures', 'setUserPlan', 'grantQuota', 'resetUsage', 'setUserStatus', 'listPlans', 'savePlan',
      'archivePlan', 'saveAddon', 'listOffers', 'saveOffer', 'usageReport', 'listPayments', 'refund', 'listAudit', 'getConfig', 'saveConfig', 'sendAnnouncement']) {
      const r = await post('/api/owner', { op, reason: 'test run' }, USER);
      assert.equal(r.status, 403, op); assert.equal(r.j.code, 'NOT_OWNER', op);
    }
  });
  await t('catalog lists seeded plans', async () => {
    const r = await post('/api/saas', { op: 'catalog' }, USER); assert.equal(r.status, 200);
    assert.ok(r.j.plans.find((p: any) => p.id === 'free')); assert.ok(r.j.plans.every((p: any) => typeof p.priceMonthlyPaise === 'number'));
  });
  await t('me returns subscription + usage meters', async () => {
    const r = await post('/api/saas', { op: 'me' }, USER); assert.equal(r.status, 200);
    assert.ok(r.j.subscription?.status); assert.ok(r.j.usage?.meters?.receipt_scans);
  });
  await t('quote has GST and total', async () => {
    const r = await post('/api/saas', { op: 'quote', kind: 'plan', planId: 'plus', cycle: 'monthly' }, USER); assert.equal(r.status, 200);
    assert.equal(r.j.quote.totalPaise, r.j.quote.subtotalPaise - r.j.quote.discountPaise + r.j.quote.taxPaise);
  });
  await t('bad coupon returns couponError', async () => {
    const r = await post('/api/saas', { op: 'quote', kind: 'plan', planId: 'plus', cycle: 'monthly', coupon: 'NOPE_NOT_REAL' }, USER);
    assert.ok(r.j.quote.couponError);
  });
  await t('bad GSTIN rejected', async () => {
    const r = await post('/api/saas', { op: 'updateBilling', billing: { gstin: '123' } }, USER); assert.equal(r.status, 400); assert.equal(r.j.code, 'BAD_GSTIN');
  });
  await t('/api/me get returns features', async () => {
    const r = await post('/api/me', { op: 'get' }, USER); assert.equal(r.status, 200); assert.equal(typeof r.j.user.features?.money_scan, 'boolean');
  });
}
if (OWNER) {
  await t('owner overview + reason required', async () => {
    const o = await post('/api/owner', { op: 'overview' }, OWNER); assert.equal(o.status, 200); assert.equal(typeof o.j.overview.mrrPaise, 'number');
    const r = await post('/api/owner', { op: 'saveConfig', config: {} }, OWNER); assert.equal(r.status, 400); assert.equal(r.j.code, 'REASON_REQUIRED');
  });
}
console.log(`\n${n} saas checks passed${USER ? '' : ' (set USER_TOKEN / OWNER_TOKEN for signed-in checks)'}`);

/** Unit checks for UPI URI + VPA validation + payment lifecycle helpers. */
import assert from 'node:assert/strict';
import {
  UPI_APP_PACKAGES,
  UPI_PAY_APPS,
  buildAppSchemeUpiUri,
  buildAppUpiUri,
  buildUpiPayUri,
  hasUpiMerchantSign,
  toAppSchemeUri,
  toNpciPayUri,
  canStartPayment,
  isValidVpa,
  normalizeVpa,
  paiseToUpiAmount,
  paymentStatusLabel,
} from '../src/lib/upi.ts';

assert.equal(isValidVpa('name@oksbi'), true);
assert.equal(isValidVpa('9876543210'), false);
assert.equal(isValidVpa('bad'), false);
assert.equal(normalizeVpa(' Name@OkSBI '), 'name@oksbi');
assert.equal(paiseToUpiAmount(85000), '850.00');

const uri = buildUpiPayUri({
  pa: 'shop@ybl',
  pn: 'Shop',
  am: '100.50',
  tn: 'Byjan split',
  tr: 'txn123',
});
assert.match(uri, /^upi:\/\/pay\?/);
assert.match(uri, /pa=shop%40ybl|pa=shop@ybl/);
assert.match(uri, /am=100\.50/);
assert.match(uri, /cu=INR/);

const gpay = buildAppUpiUri('gpay', { pa: 'aa@upi', pn: 'A', am: '10.00' });
assert.match(gpay, /^upi:\/\/pay\?/);
assert.match(buildAppUpiUri('phonepe', { pa: 'aa@upi', pn: 'A', am: '10.00' }), /^upi:\/\/pay\?/);
assert.match(buildAppSchemeUpiUri('phonepe', { pa: 'aa@upi', pn: 'A', am: '10.00' }), /^phonepe:\/\/pay\?/);
assert.match(buildAppSchemeUpiUri('gpay', { pa: 'aa@upi', pn: 'A', am: '10.00' }), /^tez:\/\/upi\/pay\?/);
assert.match(buildAppUpiUri('paytm', { pa: 'aa@upi', pn: 'A', am: '10.00' }), /^upi:\/\/pay\?/);
const signedRaw = 'upi://pay?pa=shop@ybl&pn=Cafe&mc=5411&mode=04&sign=abc&am=1.00';
assert.equal(hasUpiMerchantSign(signedRaw), true);
const signedPass = toNpciPayUri(signedRaw, { pa: 'shop@ybl', pn: 'Cafe', am: '1.00' });
assert.equal(signedPass, signedRaw);
assert.match(toAppSchemeUri(signedPass || '', 'phonepe'), /^phonepe:\/\/pay\?pa=shop@ybl&pn=Cafe&mc=5411&mode=04&sign=abc&am=1\.00$/);
const signedMutate = toNpciPayUri(signedRaw, { am: '50.00', tn: 'chai' });
assert.match(String(signedMutate), /^upi:\/\/pay\?/);
assert.doesNotMatch(String(signedMutate), /sign=/);
assert.doesNotMatch(String(signedMutate), /mc=/);
assert.match(String(signedMutate), /am=50\.00/);
assert.match(String(signedMutate), /tn=chai/);
const staticSigned = toNpciPayUri('upi://pay?pa=shop@ybl&pn=Cafe&mc=5411&sign=abc', { am: '80.00' });
assert.equal(staticSigned, 'upi://pay?pa=shop@ybl&pn=Cafe&mc=5411&sign=abc');
assert.match(buildAppUpiUri('cred', { pa: 'aa@upi', pn: 'A', am: '10.00' }), /^upi:\/\/pay\?/);
assert.match(buildAppUpiUri('whatsapp', { pa: 'aa@upi', pn: 'A', am: '10.00' }), /^upi:\/\/pay\?/);

assert.match(buildAppUpiUri('amazonpay', { pa: 'aa@upi', pn: 'A', am: '10.00' }), /^upi:\/\/pay\?/);
assert.match(buildAppUpiUri('mobikwik', { pa: 'aa@upi', pn: 'A', am: '10.00' }), /^upi:\/\/pay\?/);
assert.equal(UPI_APP_PACKAGES.phonepe, 'com.phonepe.app');
assert.equal(UPI_APP_PACKAGES.paytm, 'net.one97.paytm');
assert.equal(UPI_APP_PACKAGES.cred, 'com.dreamplug.androidapp');
assert.equal(UPI_APP_PACKAGES.whatsapp, 'com.whatsapp');
assert.deepEqual(
  UPI_PAY_APPS.map((a) => a.id),
  ['phonepe', 'gpay', 'paytm', 'cred', 'amazonpay', 'mobikwik', 'whatsapp', 'bhim', 'generic'],
);
assert.ok(UPI_PAY_APPS.every((a) => a.label.length > 0));

assert.equal(canStartPayment('UNPAID'), true);
assert.equal(canStartPayment('PAID'), false);
assert.equal(paymentStatusLabel('AWAITING_CONFIRMATION'), 'Awaiting confirmation');
assert.equal(paymentStatusLabel('UNKNOWN'), 'Couldn’t verify yet');

console.log('upi-test: PASS');

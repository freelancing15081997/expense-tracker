import { Browser } from '@capacitor/browser';
import { App } from '@capacitor/app';
import { isNative, apiUrl } from './api';

/**
 * Cashfree Payment Gateway (JS SDK v3).
 * The server creates the order (secret keys never reach the app) and returns payment_session_id.
 * In the WebView we open Cashfree's modal checkout; UPI intent apps open via the <queries> in the manifest.
 * If the modal can't open (old WebView), we fall back to the hosted page /pay/cashfree?session=… in Custom Tabs
 * and wait for the com.byjanbooks.app://payment?order_id=… deep link.
 */
type CashfreeInstance = { checkout(o: { paymentSessionId: string; redirectTarget?: '_modal' | '_self' | '_blank' }): Promise<{ error?: { message?: string; code?: string }; redirect?: boolean; paymentDetails?: { paymentMessage?: string } }> };
declare global { interface Window { Cashfree?: (o: { mode: 'sandbox' | 'production' }) => CashfreeInstance } }

let sdk: Promise<void> | null = null;
function loadSdk() {
  if (window.Cashfree) return Promise.resolve();
  if (!sdk) {
    sdk = new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = 'https://sdk.cashfree.com/js/v3/cashfree.js';
      s.onload = () => res(); s.onerror = () => { sdk = null; rej(new Error('Could not load the payment page. Check your internet.')); };
      document.head.appendChild(s);
    });
  }
  return sdk;
}

export type PayOutcome = { result: 'completed' | 'dismissed' | 'failed'; message?: string };

export async function payWithCashfree(paymentSessionId: string, orderId: string, mode: 'sandbox' | 'production'): Promise<PayOutcome> {
  try {
    await loadSdk();
    const cf = window.Cashfree!({ mode });
    const r = await cf.checkout({ paymentSessionId, redirectTarget: '_modal' });
    if (r.error) {
      const dismissed = /closed|dropped|cancel/i.test(`${r.error.code} ${r.error.message}`);
      return { result: dismissed ? 'dismissed' : 'failed', message: r.error.message };
    }
    return { result: 'completed', message: r.paymentDetails?.paymentMessage };
  } catch (e) {
    if (!isNative()) return { result: 'failed', message: (e as Error).message };
    return hostedFallback(paymentSessionId, orderId, mode);
  }
}

function hostedFallback(session: string, orderId: string, mode: string): Promise<PayOutcome> {
  return new Promise((resolve) => {
    let done = false;
    const finish = (o: PayOutcome) => { if (done) return; done = true; void sub.then((h) => h.remove()); void fin.then((h) => h.remove()); void Browser.close().catch(() => undefined); resolve(o); };
    const sub = App.addListener('appUrlOpen', (ev) => { if (ev.url.includes('payment') && ev.url.includes(orderId)) finish({ result: 'completed' }); });
    const fin = Browser.addListener('browserFinished', () => finish({ result: 'completed' })); // verifyOrder decides the truth
    void Browser.open({ url: apiUrl(`/pay/cashfree?session=${encodeURIComponent(session)}&order=${encodeURIComponent(orderId)}&mode=${mode}`), presentationStyle: 'popover' });
  });
}

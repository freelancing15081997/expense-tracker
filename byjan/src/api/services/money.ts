// Settle-up, UPI payments, requests, accounts, transfers and bills.
import { api, ApiError } from '../client';
import * as M from '../mocks';
import type { Account, AccountTxn, Due, PaymentResult, RecentPayee, SettleSummary, UpiPayee } from '../types';

const now = () => new Date().toTimeString().slice(0, 8);

export const settleApi = {
  /** PLACEHOLDER: GET /v1/settle — net position + simplified debts across all books. */
  summary: () => api<SettleSummary>('GET', '/v1/settle', { mock: M.settle }),

  /** PLACEHOLDER: POST /v1/settle/remind — WhatsApp/SMS nudge. */
  remind: (initials: string[]) => api<{ sent: number }>('POST', '/v1/settle/remind', { body: { people: initials }, mock: { sent: initials.length } }),

  /** PLACEHOLDER: POST /v1/nudges/:id/dismiss — hide a "X owes you" nudge on Home. */
  dismissNudge: (who: string) => api<void>('POST', `/v1/nudges/${who}/dismiss`, { mock: undefined as void }),

  /** PLACEHOLDER: POST /v1/settle/mark — record a cash/off-app settlement. */
  markSettled: (from: string, amount: number, method: 'cash' | 'upi' | 'bank') =>
    api<void>('POST', '/v1/settle/mark', { body: { from, amount, method }, mock: undefined as void }),
};

export const paymentsApi = {
  /**
   * PLACEHOLDER: POST /v1/payments/upi/intent — create a UPI intent (deep link) for GPay/PhonePe/Paytm.
   * The native app opens `intentUrl`; the backend confirms status via PSP webhook.
   */
  createIntent: (p: { toVpa: string; amount: number; note: string; app: string; bookId?: string; fromAccountId?: string }) =>
    api<{ paymentId: string; intentUrl: string }>('POST', '/v1/payments/upi/intent', {
      body: p, mock: { paymentId: 'pay_1', intentUrl: `upi://pay?pa=${p.toVpa}&am=${p.amount}&cu=INR` },
    }),

  /** PLACEHOLDER: GET /v1/payments/:id — poll for status after returning from the UPI app. */
  status: (paymentId: string, ctx: { amount: number; app: string; to: string }) =>
    api<PaymentResult>('GET', `/v1/payments/${paymentId}`, {
      delay: 1400,
      mock: { status: 'SUCCESS', utr: '4266 1033 8104', amount: ctx.amount, app: ctx.app, to: ctx.to, from: 'HDFC ••4821 · ' + ctx.app, time: now() },
      mockError: new ApiError(402, 'U30', 'Declined by your bank'),
    }),

  /** PLACEHOLDER: GET /v1/payments/:id/receipt — shareable receipt image for a completed payment. */
  receipt: (paymentId: string) => api<{ url: string; text: string }>('GET', `/v1/payments/${paymentId}/receipt`, { mock: { url: 'https://byjan.app/r/pay_1.png', text: 'Paid ₹800 to Meera Iyer on UPI · ref 4266 1033 8104' } }),

  /** PLACEHOLDER: GET /v1/payments/recent-payees — quick picks on Scan & pay. */
  recentPayees: () => api<RecentPayee[]>('GET', '/v1/payments/recent-payees', { mock: M.recentPayees }),

  /** PLACEHOLDER: POST /v1/upi/resolve — look up a typed UPI ID (name + verified merchant flag) before paying. */
  resolveVpa: (vpa: string) => api<UpiPayee>('POST', '/v1/upi/resolve', {
    body: { vpa },
    mock: () => {
      if (!/^[\w.-]{2,}@[a-z]{2,}$/i.test(vpa)) throw new ApiError(422, 'BAD_VPA', 'UPI IDs look like name@bank');
      return { name: vpa.split('@')[0].replace(/[._-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase()), vpa, verified: false, initials: vpa[0].toUpperCase() };
    },
  }),

  /** PLACEHOLDER: POST /v1/upi/qr/parse — decode a scanned UPI QR payload into a payee. */
  parseQr: (payload: string) =>
    api<UpiPayee>('POST', '/v1/upi/qr/parse', {
      body: { payload }, delay: 900,
      mock: { name: 'Chai Point', vpa: 'chaipoint.blr@icici', verified: true, initials: 'C' },
      mockError: new ApiError(422, 'BAD_QR', "That's not a UPI QR"),
    }),

  /** PLACEHOLDER: POST /v1/requests — request money via WhatsApp link or UPI collect. */
  request: (p: { people: string[]; amount: number; note: string; via: 'wa' | 'upi' }) =>
    api<{ requestIds: string[] }>('POST', '/v1/requests', { body: p, mock: { requestIds: p.people.map((_, i) => 'rq' + i) } }),

  /** PLACEHOLDER: POST /v1/requests/:id/decline */
  declineRequest: (id: string) => api<void>('POST', `/v1/requests/${id}/decline`, { mock: undefined as void }),
};

export const accountsApi = {
  /** PLACEHOLDER: GET /v1/accounts — balances from SMS parsing / manual cash. */
  list: () => api<Account[]>('GET', '/v1/accounts', { mock: M.accounts }),

  /** PLACEHOLDER: GET /v1/accounts/:id/transactions — statement for one account. */
  statement: (id: string) => api<AccountTxn[]>('GET', `/v1/accounts/${id}/transactions`, { mock: M.accountTxns[id] ?? [] }),

  /** PLACEHOLDER: POST /v1/accounts/transfer */
  transfer: (from: string, to: string, amount: number) =>
    api<void>('POST', '/v1/accounts/transfer', { body: { from, to, amount }, mock: undefined as void }),

  /** PLACEHOLDER: POST /v1/accounts/cash — adjust cash in hand. */
  addCash: (amount: number) => api<void>('POST', '/v1/accounts/cash', { body: { amount }, mock: undefined as void }),
};

export const billsApi = {
  /** PLACEHOLDER: GET /v1/bills?month= */
  list: () => api<Due[]>('GET', '/v1/bills', { mock: M.dues }),

  /** PLACEHOLDER: POST /v1/bills — add a bill or due (name, amount, due day of month). */
  create: (b: { title: string; amount: number; dueDay: number }) =>
    api<Due>('POST', '/v1/bills', { body: b, mock: { id: 'b_' + Date.now(), title: b.title, amount: b.amount, when: `Due on the ${b.dueDay}${['th', 'st', 'nd', 'rd'][b.dueDay % 10 > 3 || Math.floor(b.dueDay / 10) === 1 ? 0 : b.dueDay % 10]}`, icon: 'receipt', dueDay: b.dueDay } }),

  /**
   * PLACEHOLDER: POST /v1/bills/:id/pay — pay a biller (BBPS / UPI biller). Returns a UPI intent the app opens,
   * then poll paymentsApi.status like any other payment.
   */
  pay: (id: string, amount: number) =>
    api<{ paymentId: string; intentUrl: string }>('POST', `/v1/bills/${id}/pay`, { body: { amount }, mock: { paymentId: 'pay_bill_' + id, intentUrl: `upi://pay?pa=biller@bbps&am=${amount}` }, mockError: new ApiError(402, 'U30', 'Declined by your bank') }),

  /** PLACEHOLDER: POST /v1/bills/:id/paid */
  markPaid: (id: string) => api<void>('POST', `/v1/bills/${id}/paid`, { mock: undefined as void }),

  /** PLACEHOLDER: DELETE /v1/bills/:id/paid — undo. */
  unmarkPaid: (id: string) => api<void>('DELETE', `/v1/bills/${id}/paid`, { mock: undefined as void }),

  /** PLACEHOLDER: POST /v1/bills/:id/snooze */
  snooze: (id: string) => api<void>('POST', `/v1/bills/${id}/snooze`, { mock: undefined as void }),
};

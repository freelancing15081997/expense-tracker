// Plans & billing (Cashfree), business admin, data import, support.
import { api, ApiError, upload } from '../client';
import * as M from '../mocks';
import type { AdminOverview, Approval, ImportPreview, Plan, PlanId, Subscription, Ticket, Usage } from '../types';

export const billingApi = {
  /** PLACEHOLDER: GET /v1/plans */
  plans: () => api<Plan[]>('GET', '/v1/plans', { mock: M.plans }),
  /** PLACEHOLDER: GET /v1/billing/usage */
  usage: () => api<Usage[]>('GET', '/v1/billing/usage', { mock: M.usage }),
  /** PLACEHOLDER: GET /v1/billing/subscription — current plan and renewal date. */
  subscription: () => api<Subscription>('GET', '/v1/billing/subscription', { mock: M.subscription }),

  /** PLACEHOLDER: POST /v1/billing/orders/:id/verify — confirm a Cashfree order server-side after the SDK returns. */
  verifyOrder: (orderId: string) => api<{ status: 'PAID' | 'FAILED'; plan: PlanId; invoiceUrl: string }>('POST', `/v1/billing/orders/${orderId}/verify`, { mock: { status: 'PAID', plan: 'plus', invoiceUrl: 'https://byjan.app/inv/order_1.pdf' } }),

  /** PLACEHOLDER: POST /v1/billing/coupons/validate */
  validateCoupon: (code: string) =>
    api<{ pctOff: number }>('POST', '/v1/billing/coupons/validate', {
      body: { code },
      mock: () => {
        if (code === 'BYJAN20') return { pctOff: 20 };
        if (code === 'DIWALI10') throw new ApiError(410, 'EXPIRED', 'This code expired on 5 Nov');
        throw new ApiError(404, 'NOT_FOUND', "That code doesn't exist");
      },
    }),
  /** PLACEHOLDER: POST /v1/billing/checkout — creates a Cashfree order; open `paymentSessionId` with the Cashfree SDK. */
  checkout: (p: { plan: PlanId; cycle: 'monthly' | 'annual'; seats: number; coupon?: string; gstin?: string }) =>
    api<{ orderId: string; paymentSessionId: string; amount: number }>('POST', '/v1/billing/checkout', {
      body: p, delay: 1500, mock: { orderId: 'order_1', paymentSessionId: 'session_mock', amount: 117 },
      mockError: new ApiError(402, 'PAYMENT_FAILED', "Payment failed at your bank. You weren't charged"),
    }),
  /** PLACEHOLDER: POST /v1/billing/trial */
  startTrial: (plan: PlanId) => api<void>('POST', '/v1/billing/trial', { body: { plan }, mock: undefined as void }),
  /** PLACEHOLDER: POST /v1/billing/restore — restore store purchases. */
  restore: () => api<{ plan: PlanId }>('POST', '/v1/billing/restore', { mock: { plan: 'pro' } }),
};

export const adminApi = {
  /** PLACEHOLDER: GET /v1/books/:id/admin/overview */
  overview: (bookId: string) => api<AdminOverview>('GET', `/v1/books/${bookId}/admin/overview`, { mock: M.adminOverview }),
  /** PLACEHOLDER: GET /v1/books/:id/approvals */
  approvals: (bookId: string) => api<Approval[]>('GET', `/v1/books/${bookId}/approvals`, { mock: M.approvals }),
  /** PLACEHOLDER: POST /v1/approvals/:id — approve | reject (reason required) */
  decide: (id: string, decision: 'approve' | 'reject', reason?: string) =>
    api<void>('POST', `/v1/approvals/${id}`, { body: { decision, reason }, mock: undefined as void }),
  /** PLACEHOLDER: PUT /v1/books/:id/policies */
  setPolicies: (bookId: string, policies: Record<string, boolean>) =>
    api<void>('PUT', `/v1/books/${bookId}/policies`, { body: policies, mock: undefined as void }),
};

export const importApi = {
  /** PLACEHOLDER: POST /v1/import/upload (multipart) — Tally XML/Excel, CSV or another app's export. */
  upload: (file: { uri: string; name: string; type: string }, source: 'tally' | 'excel' | 'app') =>
    upload<ImportPreview>('/v1/import/upload', file, { source }, M.importPreview),
  /** PLACEHOLDER: POST /v1/import/:id/commit — column mapping + fixes. */
  commit: (id: string, mapping: Record<string, string>, fixes: Record<string, string>, skip: string[]) =>
    api<{ imported: number; bookId: string }>('POST', `/v1/import/${id}/commit`, { body: { mapping, fixes, skip }, delay: 1200, mock: { imported: 212, bookId: 'studio' } }),
};

export const supportApi = {
  /** PLACEHOLDER: GET /v1/support/faq?q= */
  faq: () => api<{ q: string; a: string }[]>('GET', '/v1/support/faq', {
    mock: [
      { q: 'How do I split a bill unevenly?', a: 'Open the entry, tap Split, then choose Exact or Shares. Byjan checks the parts add up before saving.' },
      { q: 'Someone paid me in cash. How do I record it?', a: 'Go to Settle up, tap the person, then Mark settled and choose Cash. Both balances update.' },
      { q: 'Is my bank data safe?', a: 'Byjan reads bank SMS on your phone only. We never ask for netbanking passwords and never see your UPI PIN.' },
      { q: 'A UPI payment failed but money left my account', a: 'Your bank refunds failed UPI payments within 48 hours. Byjan shows the status on the entry.' },
    ],
  }),
  /** PLACEHOLDER: GET /v1/support/tickets */
  tickets: () => api<Ticket[]>('GET', '/v1/support/tickets', { mock: M.tickets }),
  /** PLACEHOLDER: POST /v1/support/tickets */
  create: (message: string) => api<Ticket>('POST', '/v1/support/tickets', { body: { message }, mock: { id: 'BJ-2841', title: 'New request', when: 'Just now', status: 'Open' } }),
};

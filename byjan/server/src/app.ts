import Fastify, { type FastifyReply, type FastifyRequest } from 'fastify';
import multipart from '@fastify/multipart';
import * as M from '../../src/api/mocks.ts';
import { applyRoleUpdate } from './access.ts';
import { issueSession, readJwt, verifyBody } from './crypto.ts';
import { smartSettle, splitPaise } from './money.ts';
import { reset, state, type DB } from './store.ts';
import { entryCreate, otpSend, otpVerify, readBody, upiIntent } from './validate.ts';

type DBBook = DB['books'][number];

const sandbox = () => process.env.PAYMENT_SANDBOX !== '0';
const id = (p: string) => p + Math.random().toString(16).slice(2, 8);

function fail(reply: FastifyReply, status: number, code: string, message: string) {
  return reply.code(status).send({ code, message });
}

function userId(req: FastifyRequest, reply: FastifyReply) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  const payload = token ? readJwt(token) : null;
  if (!payload || payload.typ !== 'access') {
    fail(reply, 401, 'UNAUTHENTICATED', 'Sign in required');
    return null;
  }
  return String(payload.sub);
}

export function buildApp() {
  const app = Fastify({ logger: false });
  app.register(multipart);
  const db = () => state();

  app.get('/v1/health', async () => ({ ok: true }));

  app.post('/v1/auth/otp/send', async (req, reply) => {
    const body = readBody(otpSend, req.body, reply);
    if (!body) return reply;
    const phone = body.phone;
    const requestId = id('otp_');
    const code = '246810';
    db().otps[requestId] = { phone, code };
    console.log(`[byjan otp] ${phone || 'unknown'} code ${code}`);
    return { requestId, resendInSec: 24 };
  });

  app.post('/v1/auth/otp/verify', async (req, reply) => {
    const body = readBody(otpVerify, req.body, reply);
    if (!body) return reply;
    const row = db().otps[body.requestId || ''];
    if (!row || body.code !== row.code) return fail(reply, 400, 'OTP_MISMATCH', "That code didn't match");
    const session = issueSession(db().user.id);
    db().refresh.add(session.refreshToken);
    return { ...session, user: db().user, isNew: false };
  });

  app.post('/v1/auth/oauth/google', async (req, reply) => {
    const idToken = String((req.body as { idToken?: string })?.idToken || '');
    if (!idToken) return fail(reply, 400, 'BAD_TOKEN', 'Google did not finish sign-in');
    const session = issueSession(db().user.id);
    db().refresh.add(session.refreshToken);
    return { ...session, user: db().user };
  });

  app.post('/v1/auth/refresh', async (req, reply) => {
    const refreshToken = String((req.body as { refreshToken?: string })?.refreshToken || '');
    const payload = readJwt(refreshToken);
    if (!payload || payload.typ !== 'refresh' || !db().refresh.has(refreshToken)) return fail(reply, 401, 'UNAUTHENTICATED', 'Sign in required');
    db().refresh.delete(refreshToken);
    const session = issueSession(String(payload.sub));
    db().refresh.add(session.refreshToken);
    return session;
  });

  app.post('/v1/auth/password/forgot', async (req, reply) => {
    const email = String((req.body as { email?: string })?.email || '');
    if (email.toLowerCase().startsWith('unknown')) return fail(reply, 404, 'NO_ACCOUNT', 'No Byjan account uses this email. Try your phone number instead.');
    console.log(`[byjan mail] password reset for ${email}`);
    return { sent: true };
  });

  app.post('/v1/auth/pin/verify', async (req) => {
    const pin = String((req.body as { pin?: string })?.pin || '');
    return { ok: pin === (process.env.DEMO_PIN || '2580'), triesLeft: 4 };
  });

  app.post('/v1/auth/logout', async (req, reply) => { if (!userId(req, reply)) return; return null; });

  app.post('/v1/auth/session/unlock', async (req, reply) => {
    const sig = String((req.body as { deviceSignature?: string })?.deviceSignature || '');
    if (!sig) return fail(reply, 401, 'UNAUTHENTICATED', 'Fingerprint was not confirmed');
    const session = issueSession(db().user.id);
    db().refresh.add(session.refreshToken);
    return { token: session.token, refreshToken: session.refreshToken };
  });

  app.post('/v1/auth/sessions/revoke-others', async (req, reply) => {
    if (!userId(req, reply)) return;
    const n = db().refresh.size;
    db().refresh.clear();
    return { revoked: n };
  });

  app.get('/v1/me', async (req, reply) => { if (!userId(req, reply)) return; return db().user; });
  app.patch('/v1/me', async (req, reply) => {
    if (!userId(req, reply)) return;
    Object.assign(db().user, req.body as object);
    return db().user;
  });
  app.put('/v1/me/preferences', async (req, reply) => {
    if (!userId(req, reply)) return;
    db().prefs = { ...db().prefs, ...(req.body as object) };
    return db().prefs;
  });
  app.post('/v1/upi/validate', async (req) => {
    const vpa = String((req.body as { vpa?: string })?.vpa || '');
    return { valid: /^[\w.-]{2,}@[a-z]{2,}$/i.test(vpa), name: db().user.name };
  });

  app.get('/v1/books', async (req, reply) => { if (!userId(req, reply)) return; return db().books; });
  app.post('/v1/books', async (req, reply) => {
    if (!userId(req, reply)) return;
    const body = req.body as { name?: string; kind?: string };
    const book = { ...db().books[0], id: id('bk_'), name: body.name || 'Book', kind: body.kind || 'Personal', people: 1, members: ['AK'] };
    db().books.unshift(book as DBBook);
    return book;
  });
  app.get('/v1/books/:id', async (req) => M.bookDetailFor((req.params as { id: string }).id));
  app.get('/v1/books/:id/entries', async (req) => {
    const { id } = req.params as { id: string };
    const q = String((req.query as { q?: string }).q || '').toLowerCase();
    return db().entries.filter(e => e.bookId === id && (!q || e.title.toLowerCase().includes(q)));
  });
  app.get('/v1/books/:id/balances', async (req) => {
    const { id } = req.params as { id: string };
    const detail = M.bookDetailFor(id);
    const rows = detail.members.map(m => ({ initials: m.initials, name: m.name, paid: 0, share: 0, net: 0 }));
    for (const e of db().entries.filter(x => x.bookId === id)) {
      const payer = rows.find(r => r.initials === e.paidBy);
      if (payer) payer.paid += e.amount;
      const weights = e.splitWith.map(() => 1);
      const parts = splitPaise(Math.round(e.amount * 100), weights).map(p => p / 100);
      e.splitWith.forEach((ini, i) => {
        const row = rows.find(r => r.initials === ini);
        if (row) row.share += parts[i] || 0;
      });
    }
    return rows.map(r => ({ ...r, net: Math.round((r.paid - r.share) * 100) / 100 }));
  });
  app.post('/v1/books/:id/invites', async (req) => {
    const body = (req.body ?? {}) as { contacts?: unknown[]; people?: unknown[] };
    const list = Array.isArray(body.contacts) ? body.contacts : Array.isArray(body.people) ? body.people : [];
    return { sent: list.length };
  });
  app.get('/v1/books/:id/invite-link', async (req) => ({ url: `https://byjan.app/j/${(req.params as { id: string }).id}` }));
  app.get('/v1/books/:id/roles', async () => db().roles);
  app.put('/v1/books/:id/roles/:role', async (req) => {
    const { role } = req.params as { role: string };
    const row = db().roles.find(r => r.role === role);
    if (!row) return row;
    const body = (req.body ?? {}) as { perms?: Record<string, boolean>; approvalLimit?: number | null };
    const next = applyRoleUpdate(role, body.perms, body.approvalLimit, row.approvalLimit);
    row.perms = next.perms;
    row.approvalLimit = next.approvalLimit;
    return row;
  });

  app.get('/v1/entries/suggest', async () => ({ title: 'Swiggy', category: 'Food' }));
  app.post('/v1/entries', async (req, reply) => {
    if (!userId(req, reply)) return;
    const body = readBody(entryCreate, req.body, reply);
    if (!body) return reply;
    const entry = {
      id: id('e_'), bookId: body.bookId || 'goa', title: body.title || body.category || 'Entry', category: body.category || 'Other', icon: 'utensils',
      paidBy: body.paidBy || 'AK', amount: body.amount || 0, splitWith: body.split?.members || ['AK'], time: 'now', dayLabel: 'Today', yourNet: 0,
    };
    db().entries.unshift(entry as DB['entries'][number]);
    return entry;
  });
  app.get('/v1/entries/:id', async (req, reply) => {
    const entry = db().entries.find(e => e.id === (req.params as { id: string }).id);
    if (!entry) return fail(reply, 404, 'NOT_FOUND', 'Entry not found');
    return entry;
  });
  app.patch('/v1/entries/:id', async (req, reply) => {
    const entry = db().entries.find(e => e.id === (req.params as { id: string }).id);
    if (!entry) return fail(reply, 404, 'NOT_FOUND', 'Entry not found');
    Object.assign(entry, req.body as object);
    return entry;
  });
  app.delete('/v1/entries/:id', async (req, reply) => {
    const i = db().entries.findIndex(e => e.id === (req.params as { id: string }).id);
    if (i < 0) return fail(reply, 404, 'NOT_FOUND', 'Entry not found');
    db().deleted.push(db().entries.splice(i, 1)[0]);
    return null;
  });
  app.post('/v1/entries/:id/restore', async (req, reply) => {
    const i = db().deleted.findIndex(e => e.id === (req.params as { id: string }).id);
    if (i < 0) return fail(reply, 404, 'NOT_FOUND', 'Entry not found');
    db().entries.unshift(db().deleted.splice(i, 1)[0]);
    return null;
  });
  app.post('/v1/entries/:id/notes', async () => ({ id: id('n_') }));
  app.get('/v1/entries/:id/share-card', async () => ({ url: 'https://byjan.app/s/entry.png', text: 'Shared from Byjan' }));
  app.post('/v1/entries/:id/receipt', async () => ({ receiptId: id('r_') }));
  app.post('/v1/receipts', async () => ({ receiptId: id('rcpt_') }));

  app.get('/v1/invites/:code/summary', async () => ({ bookName: M.invite.bookName, invitedBy: M.invite.invitedBy, expired: '2 days ago' }));
  app.get('/v1/invites/:code', async (req, reply) => {
    if ((req.params as { code: string }).code === 'EXPIRED') return fail(reply, 410, 'INVITE_EXPIRED', 'This invite link has expired');
    return M.invite;
  });
  app.post('/v1/invites/:code/accept', async () => ({ bookId: M.invite.bookId }));
  app.post('/v1/invites/:code/request-new', async () => null);
  app.get('/v1/contacts', async () => db().contacts);

  app.get('/v1/plans', async () => db().plans);
  app.get('/v1/billing/usage', async () => db().usage);
  app.get('/v1/billing/subscription', async () => db().subscription);
  app.post('/v1/billing/coupons/validate', async (req, reply) => {
    const code = String((req.body as { code?: string })?.code || '');
    if (code === 'BYJAN20') return { pctOff: 20 };
    if (code === 'DIWALI10') return fail(reply, 410, 'COUPON_EXPIRED', 'That coupon has expired');
    return fail(reply, 404, 'NO_COUPON', 'No coupon with that code');
  });
  app.post('/v1/billing/checkout', async (req, reply) => {
    if (!userId(req, reply)) return;
    const orderId = id('ord_');
    db().orders[orderId] = { status: 'PENDING', plan: String((req.body as { plan?: string })?.plan || 'plus') };
    return { orderId, paymentSessionId: 'sandbox_' + orderId };
  });
  app.post('/v1/billing/orders/:id/verify', async (req) => {
    const order = db().orders[(req.params as { id: string }).id];
    if (order && sandbox() && order.status !== 'PAID') order.status = 'PAID';
    return { status: order?.status || 'PENDING' };
  });
  app.post('/v1/billing/webhook', async (req, reply) => {
    const raw = JSON.stringify(req.body ?? {});
    const sig = String(req.headers['x-byjan-signature'] || '');
    if (!verifyBody(raw, sig)) return fail(reply, 401, 'BAD_SIGNATURE', 'Webhook signature did not match');
    const orderId = String((req.body as { orderId?: string })?.orderId || '');
    if (db().orders[orderId]) db().orders[orderId].status = 'PAID';
    return { ok: true };
  });
  app.post('/v1/billing/trial', async () => { db().subscription = { ...db().subscription, status: 'trial' }; return db().subscription; });
  app.post('/v1/billing/restore', async () => db().subscription);

  app.get('/v1/books/:id/admin/overview', async () => db().admin);
  app.get('/v1/books/:id/approvals', async () => db().approvals);
  app.post('/v1/approvals/:id', async (req, reply) => {
    const body = req.body as { decision?: string; reason?: string };
    if (body.decision === 'reject' && !body.reason) return fail(reply, 422, 'REASON_REQUIRED', 'A reason is required to reject');
    db().approvals = db().approvals.filter(a => a.id !== (req.params as { id: string }).id);
    return { ok: true };
  });
  app.put('/v1/books/:id/policies', async (req) => { db().policies = req.body as Record<string, boolean>; return db().policies; });
  app.post('/v1/import/upload', async () => M.importPreview);
  app.post('/v1/import/:id/commit', async () => ({ imported: M.importPreview.rows }));
  app.get('/v1/support/faq', async (req) => {
    const q = String((req.query as { q?: string }).q || '').toLowerCase();
    const items = [{ q: 'How do splits work?', a: 'Byjan splits the bill in paise so the parts always add up.' }, { q: 'Does Byjan see my UPI PIN?', a: 'No. The UPI app asks for the PIN. Byjan never sees it.' }];
    return items.filter(i => !q || (i.q + i.a).toLowerCase().includes(q));
  });
  app.get('/v1/support/tickets', async () => db().tickets);
  app.post('/v1/support/tickets', async (req) => {
    const ticket = { id: id('BJ-'), title: String((req.body as { title?: string })?.title || 'Help'), when: 'now', status: 'Open' as const };
    db().tickets.unshift(ticket);
    return ticket;
  });

  app.get('/v1/home', async () => db().home);
  app.post('/v1/sync', async () => ({ books: db().books.length }));
  app.get('/v1/insights', async (req) => db().insights[String((req.query as { month?: string }).month || 'Sep')] ?? db().insights.Sep);
  app.get('/v1/activity', async () => db().activity);
  app.get('/v1/search/recent', async () => db().recentSearches);
  app.get('/v1/search', async (req) => {
    const q = String((req.query as { q?: string }).q || '').toLowerCase().replace(/[₹,]/g, '');
    const type = String((req.query as { type?: string }).type || 'All');
    if (!q) return [];
    if (!db().recentSearches.includes(q)) db().recentSearches.unshift(q);
    return M.searchIndex.filter(d => (type === 'All' || d.kind === type) && `${d.title} ${d.sub} ${d.amount ?? ''}`.toLowerCase().replace(/[₹,]/g, '').includes(q));
  });
  app.post('/v1/ask', async (req) => ({ answer: `You asked “${String((req.body as { question?: string })?.question || '')}”. Food is the largest category in the sample books.` }));

  app.get('/v1/notifications', async () => db().inbox);
  app.post('/v1/notifications/read-all', async () => ({ ok: true }));
  app.post('/v1/notifications/:id/dismiss', async (req) => { db().inbox = db().inbox.filter(i => i.id !== (req.params as { id: string }).id); return null; });
  app.post('/v1/push/devices', async (req, reply) => {
    if (!userId(req, reply)) return;
    const body = req.body as { token?: string; platform?: string };
    db().devices.push({ token: String(body.token || ''), platform: String(body.platform || '') });
    return { ok: true };
  });
  app.get('/v1/push/preferences', async () => db().notifPrefs);
  app.put('/v1/push/preferences', async (req) => { db().notifPrefs = req.body as DB['notifPrefs']; return db().notifPrefs; });
  app.post('/v1/push/test', async () => { console.log('[byjan push] test notification'); return { sent: true }; });

  app.get('/v1/review', async () => ({ duplicate: { text: 'Two Swiggy entries for ₹1,240' }, highAmount: { text: 'BESCOM ₹4,860 is higher than usual' }, category: { text: 'Amazon needs a category', options: ['Shopping', 'Bills', 'Other'] } }));
  app.post('/v1/review/:kind/resolve', async () => ({ ok: true }));

  app.post('/v1/scan/receipt', async () => ({ merchant: 'Toit', amount: 1240, date: '3 Oct', items: [{ name: 'Dinner', amount: 1240 }], confidence: 0.92 }));
  app.post('/v1/voice/parse', async () => ({ transcript: '450 auto to the airport, Goa trip, split with everyone', amount: 450, title: 'Auto to the airport', book: 'Goa Trip', splitWays: 5 }));
  app.get('/v1/sms/queue', async () => db().sms);
  app.post('/v1/sms/queue/add-all', async (req) => {
    const ids = ((req.body as { ids?: string[] })?.ids) || db().sms.map(s => s.id);
    db().sms = db().sms.filter(s => !ids.includes(s.id));
    return { added: ids.length };
  });
  app.post('/v1/sms/queue/:id', async (req) => { db().sms = db().sms.filter(s => s.id !== (req.params as { id: string }).id); return { ok: true }; });
  app.post('/v1/share/parse', async () => ({ amount: 250, payee: 'Swiggy', ref: '426610338104' }));

  app.get('/v1/documents', async (req) => {
    const folder = String((req.query as { folder?: string }).folder || '');
    const q = String((req.query as { q?: string }).q || '').toLowerCase();
    return db().vault.filter(d => (!folder || folder === 'All' || d.folder === folder) && (!q || (d.name + d.sub).toLowerCase().includes(q)));
  });
  app.post('/v1/documents', async () => {
    const doc = { id: id('doc_'), name: 'Uploaded file', folder: 'Receipts' as const, sub: 'Just now', icon: 'file', ext: 'PDF' as const };
    db().vault.unshift(doc);
    return doc;
  });
  app.get('/v1/documents/:id/url', async (req) => ({ url: `https://byjan.app/d/${(req.params as { id: string }).id}` }));

  app.get('/v1/templates', async () => db().templates);
  app.post('/v1/templates', async (req) => {
    const body = req.body as { name?: string; amount?: number; meta?: string; icon?: string };
    const row = { id: id('t_'), name: body.name || 'Usual', amount: body.amount || 0, meta: body.meta || '', icon: body.icon || 'lightning' };
    db().templates.unshift(row);
    return row;
  });
  app.delete('/v1/templates/:id', async (req) => { db().templates = db().templates.filter(t => t.id !== (req.params as { id: string }).id); return null; });
  app.post('/v1/templates/:id/use', async (req, reply) => {
    const template = db().templates.find(t => t.id === (req.params as { id: string }).id);
    if (!template) return fail(reply, 404, 'NOT_FOUND', 'Template not found');
    return { bookId: 'studio', amount: template.amount, title: template.name };
  });

  app.get('/v1/recurring', async () => db().recurring);
  app.patch('/v1/recurring/:id', async (req) => {
    const row = db().recurring.find(r => r.id === (req.params as { id: string }).id);
    if (row) row.paused = Boolean((req.body as { paused?: boolean }).paused);
    return row;
  });
  app.post('/v1/recurring/suggestions/:name', async () => ({ ok: true }));

  app.get('/v1/settle', async () => {
    const nets = [
      { id: 'PS', netPaise: 285000 },
      { id: 'MI', netPaise: -80000 },
      { id: 'AK', netPaise: -205000 },
    ];
    const transfers = smartSettle(nets);
    return { ...db().settle, smartNote: `${transfers.length} payments settle everyone` };
  });
  app.post('/v1/settle/remind', async (req) => ({ sent: ((req.body as { people?: string[] })?.people || []).length }));
  app.post('/v1/nudges/:id/dismiss', async () => { db().home = { ...db().home, nudge: null }; return null; });
  app.post('/v1/settle/mark', async () => null);

  app.get('/v1/payments/recent-payees', async () => db().recentPayees);
  app.post('/v1/payments/upi/intent', async (req, reply) => {
    if (!userId(req, reply)) return;
    const body = readBody(upiIntent, req.body, reply);
    if (!body) return reply;
    const paymentId = id('pay_');
    db().payments[paymentId] = { status: 'PENDING', amount: body.amount, to: body.toVpa, app: body.app || 'UPI' };
    const amount = body.amount;
    return { paymentId, intentUrl: `upi://pay?pa=${encodeURIComponent(body.toVpa)}&am=${amount}&cu=INR` };
  });
  app.post('/v1/payments/webhook', async (req, reply) => {
    const raw = JSON.stringify(req.body ?? {});
    if (!verifyBody(raw, String(req.headers['x-byjan-signature'] || ''))) return fail(reply, 401, 'BAD_SIGNATURE', 'Webhook signature did not match');
    const body = req.body as { paymentId?: string; status?: 'SUCCESS' | 'FAILED'; utr?: string };
    const row = db().payments[body.paymentId || ''];
    if (row && (body.status === 'SUCCESS' || body.status === 'FAILED')) { row.status = body.status; row.utr = body.utr; }
    return { ok: true };
  });
  app.get('/v1/payments/:id', async (req) => {
    const row = db().payments[(req.params as { id: string }).id];
    if (!row) return { status: 'FAILED', amount: 0, app: 'UPI', to: '', from: '', time: '', failReason: 'Unknown payment' };
    if (row.status === 'PENDING' && sandbox()) { row.status = 'SUCCESS'; row.utr = '426610338104'; }
    return { status: row.status, utr: row.utr, amount: row.amount, app: row.app, to: row.to, from: 'HDFC ••4821 · ' + row.app, time: new Date().toTimeString().slice(0, 8) };
  });
  app.get('/v1/payments/:id/receipt', async (req) => ({ url: `https://byjan.app/r/${(req.params as { id: string }).id}.png`, text: 'Paid on UPI via Byjan' }));

  app.post('/v1/upi/resolve', async (req, reply) => {
    const vpa = String((req.body as { vpa?: string })?.vpa || '');
    if (!/^[\w.-]{2,}@[a-z]{2,}$/i.test(vpa)) return fail(reply, 422, 'BAD_VPA', 'UPI IDs look like name@bank');
    return { name: vpa.split('@')[0], vpa, verified: false, initials: vpa[0].toUpperCase() };
  });
  app.post('/v1/upi/qr/parse', async (req, reply) => {
    const payload = String((req.body as { payload?: string })?.payload || '');
    if (!payload.startsWith('upi://')) return fail(reply, 422, 'BAD_QR', "That's not a UPI QR");
    const q = new URL(payload).searchParams;
    const vpa = q.get('pa') || '';
    const name = decodeURIComponent(q.get('pn') || vpa.split('@')[0] || 'Payee');
    return { name, vpa, verified: true, initials: name[0]?.toUpperCase() || 'U' };
  });
  app.post('/v1/requests', async (req) => ({ requestIds: ((req.body as { people?: string[] })?.people || []).map(() => id('rq_')) }));
  app.post('/v1/requests/:id/decline', async () => null);

  app.get('/v1/accounts', async () => db().accounts);
  app.get('/v1/accounts/:id/transactions', async (req) => db().accountTxns[(req.params as { id: string }).id] ?? []);
  app.post('/v1/accounts/transfer', async (req, reply) => {
    const body = req.body as { from?: string; to?: string; amount?: number };
    const from = db().accounts.find(a => a.id === body.from);
    const to = db().accounts.find(a => a.id === body.to);
    if (!from || !to) return fail(reply, 404, 'NOT_FOUND', 'Account not found');
    from.balance -= body.amount || 0;
    to.balance += body.amount || 0;
    return { ok: true };
  });
  app.post('/v1/accounts/cash', async (req) => {
    const cash = db().accounts.find(a => a.icon === 'cash') || db().accounts[0];
    cash.balance += Number((req.body as { amount?: number })?.amount || 0);
    return cash;
  });

  app.get('/v1/bills', async () => db().dues);
  app.post('/v1/bills', async (req) => {
    const body = req.body as { title?: string; amount?: number; dueDay?: number };
    const due = { id: id('bill_'), title: body.title || 'Bill', when: `Due on ${body.dueDay}`, amount: body.amount || 0, icon: 'receipt', dueDay: body.dueDay };
    db().dues.push(due);
    return due;
  });
  app.post('/v1/bills/:id/pay', async (req) => {
    const paymentId = id('pay_');
    const amount = Number((req.body as { amount?: number })?.amount || 0);
    db().payments[paymentId] = { status: 'PENDING', amount, to: 'biller@bbps', app: 'UPI' };
    return { paymentId, intentUrl: `upi://pay?pa=biller@bbps&am=${amount}&cu=INR` };
  });
  app.post('/v1/bills/:id/paid', async (req) => { const row = db().dues.find(d => d.id === (req.params as { id: string }).id); if (row) row.paid = true; return { ok: true }; });
  app.delete('/v1/bills/:id/paid', async (req) => { const row = db().dues.find(d => d.id === (req.params as { id: string }).id); if (row) row.paid = false; return { ok: true }; });
  app.post('/v1/bills/:id/snooze', async () => ({ ok: true }));

  app.addHook('onRequest', async (req, reply) => {
    const open = req.url.startsWith('/v1/auth/') || req.url.startsWith('/v1/health') || req.url.startsWith('/v1/invites/') || req.url.startsWith('/v1/payments/webhook') || req.url.startsWith('/v1/billing/webhook');
    if (open || req.method === 'OPTIONS') return;
    if (req.url.startsWith('/v1/books') && req.method === 'GET' && !req.headers.authorization) return;
  });

  app.setErrorHandler((err, _req, reply) => {
    app.log.error(err);
    reply.code(500).send({ code: 'SERVER', message: 'Server didn\'t respond' });
  });

  return app;
}

export async function listen(port = Number(process.env.PORT || 4000)) {
  const app = buildApp();
  await app.listen({ port, host: '0.0.0.0' });
  console.log(`Byjan API on :${port}`);
}

if (process.argv[1] && process.argv[1].endsWith('app.ts')) listen();
void reset;

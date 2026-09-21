import {
  ApiError,
  getLedgerSql,
  ledgerGetUser,
  ledgerSoftDeleteBook,
  ledgerUpsertUser,
  newLedgerId,
} from '../_pg-tables.js';

export const SUPPORT_INBOX = 'byjanbooks@gmail.com';

export const SUPPORT_TOPICS = [
  { id: 'signin', title: 'Sign-in or Google login' },
  { id: 'lock', title: 'App lock, PIN, or fingerprint' },
  { id: 'display', title: 'Text size, icons, or corners' },
  { id: 'account', title: 'Deactivate or delete account' },
  { id: 'books', title: 'Money books or ledgers' },
  { id: 'receipts', title: 'Receipt scan or camera' },
  { id: 'recurring', title: 'Regular or repeating payments' },
  { id: 'export', title: 'Export PDF or CSV' },
  { id: 'reports', title: 'Reports and totals' },
  { id: 'splitpay', title: 'Split a bill' },
  { id: 'upi', title: 'UPI or Pay' },
  { id: 'sharing', title: 'Invites, members, or access' },
  { id: 'notifications', title: 'Notifications not arriving' },
  { id: 'offline', title: 'Offline or slow sync' },
  { id: 'play', title: 'Install, update, or Play Store' },
  { id: 'other', title: 'Other' },
] as const;

export type SupportTopicId = (typeof SUPPORT_TOPICS)[number]['id'];

function asRows<T extends Record<string, unknown> = Record<string, unknown>>(result: unknown): T[] {
  return Array.isArray(result) ? (result as T[]) : [];
}

function text(value: unknown) {
  return String(value || '').trim();
}

function topicTitle(id: string) {
  return SUPPORT_TOPICS.find((row) => row.id === id)?.title || 'Other';
}

function packTicket(row: {
  id: string;
  user_id?: string;
  category?: string;
  status?: string;
  subject?: string;
  data?: unknown;
  created_at?: unknown;
  updated_at?: unknown;
}) {
  const data = row.data && typeof row.data === 'object' && !Array.isArray(row.data)
    ? row.data as Record<string, unknown>
    : {};
  return {
    id: String(row.id),
    userId: String(row.user_id || data.userId || ''),
    category: String(row.category || data.category || 'other'),
    categoryLabel: topicTitle(String(row.category || data.category || 'other')),
    status: String(row.status || data.status || 'open'),
    subject: String(row.subject || data.subject || 'Help request'),
    message: String(data.message || ''),
    email: String(data.email || ''),
    displayName: String(data.displayName || ''),
    createdAt: String(data.createdAt || row.created_at || ''),
    updatedAt: String(data.updatedAt || row.updated_at || ''),
  };
}

export async function supportCreateTicket(input: {
  uid: string;
  email: string;
  displayName?: string;
  category?: unknown;
  subject?: unknown;
  message?: unknown;
}) {
  const category = text(input.category).toLowerCase() as SupportTopicId;
  if (!SUPPORT_TOPICS.some((row) => row.id === category)) {
    throw new ApiError(400, 'Pick a help topic, or choose Other.');
  }
  const message = text(input.message);
  if (category === 'other' && message.length < 8) {
    throw new ApiError(400, 'Write what happened so we can help. A few sentences is enough.');
  }
  if (message.length > 4000) throw new ApiError(400, 'Keep the message under 4000 characters.');
  const subject = text(input.subject).slice(0, 120) || topicTitle(category);
  const id = `tck_${newLedgerId()}`;
  const now = new Date().toISOString();
  const data = {
    userId: input.uid,
    email: input.email,
    displayName: text(input.displayName),
    category,
    subject,
    message,
    createdAt: now,
    updatedAt: now,
    status: 'open',
  };
  const sql = await getLedgerSql();
  await sql`
    INSERT INTO support_tickets (id, user_id, category, status, subject, data, created_at, updated_at)
    VALUES (${id}, ${input.uid}, ${category}, ${'open'}, ${subject}, ${JSON.stringify(data)}::jsonb, NOW(), NOW())
  `;
  const mailed = await mailSupportTicket({
    id,
    email: input.email,
    displayName: text(input.displayName),
    category,
    subject,
    message,
  }).catch((err) => {
    console.error('support mail failed', err);
    return { ok: false as const };
  });
  return { ticket: packTicket({ id, user_id: input.uid, category, status: 'open', subject, data, created_at: now, updated_at: now }), mailed: mailed.ok };
}

export async function supportListTickets(uid: string, all = false) {
  const sql = await getLedgerSql();
  const rows = all
    ? asRows<{ id: string; user_id: string; category: string; status: string; subject: string; data: unknown; created_at: unknown; updated_at: unknown }>(
      await sql`SELECT id, user_id, category, status, subject, data, created_at, updated_at FROM support_tickets ORDER BY created_at DESC LIMIT 200`,
    )
    : asRows<{ id: string; user_id: string; category: string; status: string; subject: string; data: unknown; created_at: unknown; updated_at: unknown }>(
      await sql`SELECT id, user_id, category, status, subject, data, created_at, updated_at FROM support_tickets WHERE user_id = ${uid} ORDER BY created_at DESC LIMIT 100`,
    );
  return rows.map(packTicket);
}

export async function deactivateUserAccount(uid: string) {
  const current = await ledgerGetUser(uid);
  if (String(current?.status || '') === 'deleted') {
    throw new ApiError(400, 'This account was already deleted.');
  }
  const saved = await ledgerUpsertUser(uid, {
    status: 'deactivated',
    deactivatedAt: new Date().toISOString(),
    pushToken: '',
    updatedAt: new Date().toISOString(),
  }, true);
  return { user: { uid, status: 'deactivated', deactivatedAt: saved.deactivatedAt } };
}

export async function deleteUserAccount(uid: string) {
  const sql = await getLedgerSql();
  const memberships = asRows<{ book_id: string; role: string }>(
    await sql`SELECT book_id, role FROM book_members WHERE uid = ${uid}`,
  );
  for (const row of memberships) {
    const bookId = text(row.book_id);
    if (!bookId) continue;
    if (String(row.role || '') === 'owner') {
      try {
        await ledgerSoftDeleteBook(bookId, uid);
      } catch (err) {
        console.error('soft-delete owned book failed', bookId, err);
      }
    }
    await sql`DELETE FROM book_members WHERE book_id = ${bookId} AND uid = ${uid}`;
  }
  await sql`DELETE FROM notifications WHERE user_id = ${uid}`;
  await sql`
    UPDATE support_tickets
    SET status = 'closed',
        data = COALESCE(data, '{}'::jsonb) || ${JSON.stringify({ accountDeleted: true, updatedAt: new Date().toISOString() })}::jsonb,
        updated_at = NOW()
    WHERE user_id = ${uid}
  `;
  await ledgerUpsertUser(uid, {
    status: 'deleted',
    deletedAt: new Date().toISOString(),
    displayName: 'Deleted account',
    email: '',
    photoURL: '',
    pushToken: '',
    upiId: '',
    upiDisplayName: '',
    customCategories: [],
    updatedAt: new Date().toISOString(),
  }, true);

  let authDeleted = false;
  try {
    const { deleteFirebaseAuthUser } = await import('./fcm.js');
    const result = await deleteFirebaseAuthUser(uid);
    authDeleted = Boolean(result.ok);
    if (!result.ok) console.error('Firebase auth delete failed', result.error);
  } catch (err) {
    console.error('Firebase auth delete threw', err);
  }
  return { ok: true, authDeleted };
}

async function mailSupportTicket(input: {
  id: string;
  email: string;
  displayName: string;
  category: string;
  subject: string;
  message: string;
}) {
  const { sendTracedMail } = await import('./smtp-mail.js');
  const topic = topicTitle(input.category);
  const body = [
    `Ticket ${input.id}`,
    `From: ${input.displayName || 'Byjan user'} <${input.email}>`,
    `Topic: ${topic}`,
    '',
    input.message || '(No extra details. User picked a common question.)',
    '',
    'Open Help in Byjan to reply in the product, or email the user directly.',
  ].join('\n');
  await sendTracedMail({
    to: SUPPORT_INBOX,
    replyTo: input.email || SUPPORT_INBOX,
    subject: `[Byjan ticket ${input.id}] ${input.subject}`,
    text: body,
    fromName: 'Byjan Help',
    kind: 'email.support_ticket',
  });
  if (input.email) {
    const { supportAckEmail } = await import('./email-templates.js');
    const ack = supportAckEmail({ ticketId: input.id, topic });
    await sendTracedMail({
      to: input.email,
      subject: ack.subject,
      text: ack.text,
      html: ack.html,
      fromName: 'Byjan Help',
      kind: 'email.support_ack',
    }).catch((err: unknown) => {
      console.error('support user copy failed', err);
    });
  }
  return { ok: true as const };
}

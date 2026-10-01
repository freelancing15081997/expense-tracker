// Link/code invites (7 days, single use) + members_per_book quota. Called from api/invites.ts.
import { randomBytes } from 'node:crypto';
import { ledgerGet, ledgerSet, ledgerAudit, ledgerAddNotification } from '../_pg-tables.js';
import { checkCount, countBookMembers } from './entitlements.js';

type Json = (status: number, payload: unknown) => void;
type User = { uid: string; email: string };
const ROLES = new Set(['admin', 'contributor', 'viewer', 'auditor']);
const appUrl = () => String(process.env.PUBLIC_APP_URL || 'https://www.easypado.com').replace(/\/+$/, '');

/** Throws ApiError 402 QUOTA_EXCEEDED when the book owner's plan has no room for one more. */
export async function assertMemberRoom(bookId: string) {
  const { count, ownerUid } = await countBookMembers(bookId);
  if (ownerUid) await checkCount(ownerUid, 'members_per_book', count, 1);
}

/** Returns true when it handled the request. */
export async function handleLinkInvite(op: string, body: Record<string, any>, user: User, json: Json): Promise<boolean> {
  if (op === 'create' && !String(body.email || '').trim()) {
    const bookId = String(body.bookId || '').trim();
    const role = ROLES.has(String(body.role || '')) ? String(body.role) : 'contributor';
    const book = await ledgerGet(`books/${bookId}`) as any;
    if (!book) { json(404, { error: 'Book not found', code: 'NOT_FOUND' }); return true; }
    const myRole = String(book.roles?.[user.uid]?.role || (book.ownerId === user.uid ? 'owner' : ''));
    if (myRole !== 'owner' && myRole !== 'admin') { json(403, { error: 'Only owners and admins can invite people.', code: 'FORBIDDEN' }); return true; }
    try { await assertMemberRoom(bookId); } catch (e: any) { json(e.status || 402, { error: e.message, ...(e.extra || {}) }); return true; }
    const code = randomBytes(5).toString('hex').toUpperCase();
    const expiresAt = new Date(Date.now() + 7 * 86400000).toISOString();
    await ledgerSet(`invite_codes/${code}`, { code, bookId, bookName: String(book.name || 'Book'), role, invitedBy: user.uid, invitedByEmail: user.email, status: 'pending', expiresAt, createdAt: new Date().toISOString() });
    await ledgerAudit({ bookId, actorUid: user.uid, actorEmail: user.email, action: 'invite_link_created', entityType: 'invite', entityId: code, detail: { role } }).catch(() => undefined);
    json(200, { code, link: `${appUrl()}/join/${code}`, expiresAt });
    return true;
  }

  if (op === 'accept' && body.code) {
    const code = String(body.code).trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    const inv = await ledgerGet(`invite_codes/${code}`) as any;
    if (!inv) { json(404, { error: 'That invite link isn’t valid.', code: 'INVITE_NOT_FOUND' }); return true; }
    if (inv.status !== 'pending' || Date.parse(inv.expiresAt) < Date.now()) { json(410, { error: 'This invite has expired. Ask for a new link.', code: 'INVITE_EXPIRED' }); return true; }
    const book = await ledgerGet(`books/${inv.bookId}`) as any;
    if (!book || book.deleted) { json(404, { error: 'That book no longer exists.', code: 'NOT_FOUND' }); return true; }
    if (book.roles?.[user.uid] || book.ownerId === user.uid) { json(409, { error: 'You’re already in this book.', code: 'ALREADY_MEMBER', bookId: inv.bookId }); return true; }
    try { await assertMemberRoom(inv.bookId); } catch (e: any) { json(e.status || 402, { error: 'This book is full on its current plan. Ask the owner to upgrade.', ...(e.extra || {}) }); return true; }
    await ledgerSet(`books/${inv.bookId}`, { ...book, roles: { ...(book.roles || {}), [user.uid]: { role: inv.role, email: user.email } } });
    await ledgerSet(`invite_codes/${code}`, { ...inv, status: 'accepted', acceptedBy: user.uid, acceptedAt: new Date().toISOString() });
    await ledgerAddNotification({ userId: inv.invitedBy, bookId: inv.bookId, bookName: inv.bookName, kind: 'invite_accepted', action: 'Invitation accepted', detail: `${user.email} joined ${inv.bookName}`, link: `/book/${inv.bookId}` }).catch(() => undefined);
    await ledgerAudit({ bookId: inv.bookId, actorUid: user.uid, actorEmail: user.email, action: 'invite_accepted', entityType: 'invite', entityId: code, detail: { role: inv.role } }).catch(() => undefined);
    json(200, { ok: true, bookId: inv.bookId, bookName: inv.bookName });
    return true;
  }
  return false;
}

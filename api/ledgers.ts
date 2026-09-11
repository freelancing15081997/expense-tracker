import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  ApiError,
  apiJson,
  ledgerAddEmailEvent,
  ledgerAudit,
  ledgerCreateBook,
  ledgerEnsureMailbox,
  ledgerGetBookForUser,
  ledgerListBooksForUser,
  ledgerListMailEvents,
  ledgerRemoveMember,
  ledgerRequireManager,
  ledgerRequireMember,
  ledgerSoftDeleteBook,
  ledgerUpdateBook,
  withDomainApi,
} from './_pg-tables.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  await withDomainApi(req, res, async (user, body) => {
    const op = String(body.op || '');

    if (op === 'list') {
      apiJson(res, 200, { books: await ledgerListBooksForUser(user.uid) });
      return;
    }

    if (op === 'get') {
      const bookId = String(body.bookId || '').trim();
      if (!bookId) throw new ApiError(400, 'Missing ledger');
      const book = await ledgerGetBookForUser(bookId, user.uid);
      apiJson(res, 200, { book });
      return;
    }

    if (op === 'create') {
      const book = await ledgerCreateBook({
        uid: user.uid,
        email: user.email,
        name: String(body.name || ''),
        currency: String(body.currency || 'INR'),
      });
      apiJson(res, 200, { book });
      return;
    }

    if (op === 'update') {
      const bookId = String(body.bookId || '').trim();
      if (!bookId) throw new ApiError(400, 'Missing ledger');
      const patch = body.patch && typeof body.patch === 'object' && !Array.isArray(body.patch)
        ? body.patch as Record<string, unknown>
        : {};
      if (patch.roles) await ledgerRequireManager(bookId, user.uid);
      else await ledgerRequireMember(bookId, user.uid);
      const book = await ledgerUpdateBook(bookId, user.uid, patch);
      apiJson(res, 200, { book });
      return;
    }

    if (op === 'removeMember') {
      const bookId = String(body.bookId || '').trim();
      const uidToRemove = String(body.uidToRemove || '').trim();
      if (!bookId || !uidToRemove) throw new ApiError(400, 'Missing member');
      const book = await ledgerRemoveMember(bookId, user.uid, uidToRemove);
      apiJson(res, 200, { book });
      return;
    }

    if (op === 'softDelete') {
      const bookId = String(body.bookId || '').trim();
      if (!bookId) throw new ApiError(400, 'Missing ledger');
      await ledgerSoftDeleteBook(bookId, user.uid);
      apiJson(res, 200, { ok: true });
      return;
    }

    if (op === 'ensureMailbox') {
      const bookId = String(body.bookId || '').trim();
      if (!bookId) throw new ApiError(400, 'Missing ledger');
      const book = await ledgerGetBookForUser(bookId, user.uid);
      const mailbox = await ledgerEnsureMailbox(bookId, book);
      await ledgerAudit({
        bookId,
        actorUid: user.uid,
        actorEmail: user.email,
        action: 'ledger.ensure_mailbox',
        entityType: 'book',
        entityId: bookId,
      });
      apiJson(res, 200, { mailbox, book: await ledgerGetBookForUser(bookId, user.uid) });
      return;
    }

    if (op === 'mailList') {
      const bookId = String(body.bookId || '').trim();
      if (!bookId) throw new ApiError(400, 'Missing ledger');
      await ledgerRequireMember(bookId, user.uid);
      apiJson(res, 200, await ledgerListMailEvents(bookId));
      return;
    }

    if (op === 'mailAdd') {
      const bookId = String(body.bookId || '').trim();
      if (!bookId) throw new ApiError(400, 'Missing ledger');
      await ledgerRequireMember(bookId, user.uid);
      const event = body.event && typeof body.event === 'object' && !Array.isArray(body.event)
        ? body.event as Record<string, unknown>
        : {};
      const saved = await ledgerAddEmailEvent(bookId, event);
      apiJson(res, 200, { event: saved });
      return;
    }

    throw new ApiError(400, 'Unknown ledger operation');
  });
}

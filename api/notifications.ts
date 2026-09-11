import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  ApiError,
  apiJson,
  ledgerAddNotification,
  ledgerListNotifications,
  ledgerMarkNotificationRead,
  ledgerMember,
  withDomainApi,
} from './_pg-tables.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  await withDomainApi(req, res, async (user, body) => {
    const op = String(body.op || '');

    if (op === 'list') {
      apiJson(res, 200, { notifications: await ledgerListNotifications(user.uid) });
      return;
    }

    if (op === 'markRead') {
      const id = String(body.id || '').trim();
      if (!id) throw new ApiError(400, 'Missing notification');
      const notification = await ledgerMarkNotificationRead(id, user.uid);
      apiJson(res, 200, { notification });
      return;
    }

    if (op === 'create') {
      const targetUid = String(body.userId || '').trim();
      const bookId = String(body.bookId || '').trim();
      if (!targetUid || !bookId) throw new ApiError(400, 'Missing notification target');
      const member = await ledgerMember(bookId, user.uid);
      const target = await ledgerMember(bookId, targetUid);
      if (!member || !target) throw new ApiError(403, 'Not allowed to notify this user');
      const notification = await ledgerAddNotification({
        userId: targetUid,
        bookId,
        bookName: String(body.bookName || ''),
        kind: String(body.kind || 'entry'),
        action: String(body.action || ''),
        detail: String(body.detail || ''),
        senderName: String(body.senderName || user.email),
        ledgerMail: String(body.ledgerMail || ''),
        link: String(body.link || ''),
        createdAt: new Date().toISOString(),
        read: false,
      });
      apiJson(res, 200, { notification });
      return;
    }

    throw new ApiError(400, 'Unknown notification operation');
  });
}

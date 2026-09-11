import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ApiError, apiJson, ledgerAudit, ledgerGetUser, ledgerUpsertUser, withDomainApi } from './_pg-tables.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  await withDomainApi(req, res, async (user, body) => {
    const op = String(body.op || 'get');

    if (op === 'get') {
      const profile = await ledgerGetUser(user.uid);
      apiJson(res, 200, { user: profile || { uid: user.uid, email: user.email } });
      return;
    }

    if (op === 'upsert') {
      const patch = body.patch && typeof body.patch === 'object' && !Array.isArray(body.patch)
        ? body.patch as Record<string, unknown>
        : {};
      const saved = await ledgerUpsertUser(user.uid, {
        ...patch,
        uid: user.uid,
        email: String(patch.email || user.email),
        updatedAt: new Date().toISOString(),
      }, true);
      await ledgerAudit({
        actorUid: user.uid,
        actorEmail: user.email,
        action: 'user.upsert',
        entityType: 'user',
        entityId: user.uid,
      });
      apiJson(res, 200, { user: saved });
      return;
    }

    throw new ApiError(400, 'Unknown profile operation');
  });
}

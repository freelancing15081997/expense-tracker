/** Shared record helpers. Financial rows are never hard-deleted. */

export function isSoftDeleted(data: object | null | undefined): boolean {
  if (!data) return false;
  const rec = data as Record<string, unknown>;
  if (rec.deleted === true) return true;
  if (rec.deletedAt) return true;
  return rec.status === 'deleted';
}

export function softDeletePatch(uid: string) {
  return {
    deleted: true,
    deletedAt: new Date().toISOString(),
    deletedBy: uid,
    status: 'deleted',
  };
}

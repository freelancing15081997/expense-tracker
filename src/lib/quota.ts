export function isFirestoreQuota(err: unknown) {
  const code = (err as { code?: string })?.code || '';
  const message = String((err as { message?: string })?.message || err || '');
  return code === 'resource-exhausted' || message.includes('resource-exhausted') || message.includes('429');
}

export const FIRESTORE_QUOTA_MESSAGE =
  'The old Firebase database is out of free writes. This app now saves to Neon Postgres. Sign in again if your books have not copied yet.';

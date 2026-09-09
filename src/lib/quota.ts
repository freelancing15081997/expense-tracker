export function isFirestoreQuota(err: unknown) {
  const code = (err as { code?: string })?.code || '';
  const message = String((err as { message?: string })?.message || err || '');
  return code === 'resource-exhausted' || message.includes('resource-exhausted') || message.includes('429');
}

export const FIRESTORE_QUOTA_MESSAGE =
  'Storage or database rate limit. Wait a minute and try again. Records are on Postgres and files on Vercel Blob — not Firebase.';

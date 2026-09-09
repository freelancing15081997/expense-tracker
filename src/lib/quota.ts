export function isFirestoreQuota(err: unknown) {
  const code = (err as { code?: string })?.code || '';
  const message = String((err as { message?: string })?.message || err || '');
  return code === 'resource-exhausted' || message.includes('resource-exhausted') || message.includes('429');
}

export const FIRESTORE_QUOTA_MESSAGE =
  'Firebase Firestore is rate-limited (not Vercel Blob). The file, if any, is already on Vercel Blob. Wait for the daily Spark quota reset or enable billing, then save the record again.';

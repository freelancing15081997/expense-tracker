export function isFirestoreQuota(err: unknown) {
  const code = (err as { code?: string })?.code || '';
  const message = String((err as { message?: string })?.message || err || '');
  return code === 'resource-exhausted' || message.includes('resource-exhausted') || message.includes('429');
}

export const FIRESTORE_QUOTA_MESSAGE =
  'Saving is temporarily limited. Please try again in a little while.';

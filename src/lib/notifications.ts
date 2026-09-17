import { apiPost } from './api';

export type AppNotification = {
  id: string;
  userId?: string;
  bookId?: string;
  bookName?: string;
  action?: string;
  detail?: string;
  read?: boolean;
  createdAt?: string;
  [key: string]: unknown;
};

export { notificationPath } from './notification-path';

export async function listNotifications() {
  const payload = await apiPost<{ notifications?: AppNotification[] }>('/api/notifications', { op: 'list' });
  return Array.isArray(payload.notifications) ? payload.notifications : [];
}

export async function markNotificationRead(id: string) {
  await apiPost('/api/notifications', { op: 'markRead', id });
}

export async function markAllNotificationsRead() {
  await apiPost('/api/notifications', { op: 'markAllRead' });
}

export async function pingSelfNotification() {
  return apiPost<{ ok?: boolean; sent?: boolean }>('/api/notifications', { op: 'pingSelf' });
}

export function notifyTimeAgo(iso?: string) {
  if (!iso) return '';
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return '';
  const sec = Math.max(0, Math.round((Date.now() - t) / 1000));
  if (sec < 45) return 'Just now';
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  if (sec < 604800) return `${Math.floor(sec / 86400)}d ago`;
  return new Date(t).toLocaleDateString();
}

export async function createNotification(input: {
  userId: string;
  bookId: string;
  bookName?: string;
  kind?: string;
  action?: string;
  detail?: string;
  senderName?: string;
  ledgerMail?: string;
  link?: string;
  skipPush?: boolean;
}) {
  await apiPost('/api/notifications', { op: 'create', ...input });
}

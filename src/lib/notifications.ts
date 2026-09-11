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

export async function listNotifications() {
  const payload = await apiPost<{ notifications?: AppNotification[] }>('/api/notifications', { op: 'list' });
  return Array.isArray(payload.notifications) ? payload.notifications : [];
}

export async function markNotificationRead(id: string) {
  await apiPost('/api/notifications', { op: 'markRead', id });
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
}) {
  await apiPost('/api/notifications', { op: 'create', ...input });
}

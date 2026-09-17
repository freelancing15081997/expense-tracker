import { apiPost } from './api';

export const HELP_TOPICS = [
  {
    id: 'signin',
    title: 'Sign-in or Google login',
    answer: 'Use the same Google account or email you registered with. On Android, Google sign-in needs this app’s SHA-1 in Firebase. If a screen says developer error, email us from Help → Other with the exact message.',
  },
  {
    id: 'receipts',
    title: 'Receipt scan or camera',
    answer: 'Allow camera and photos when Android asks. Use Add → Scan on a clear photo of the bill. If the amount looks wrong, edit it before saving. The photo permission is only for that one pick, not a gallery browser.',
  },
  {
    id: 'splitpay',
    title: 'Split, UPI, or pay',
    answer: 'Open the book, add people, then Split or Pay. UPI opens your payment app with the amount filled. If Pay is empty, the book needs members and a balance. Save your UPI id under Settings first.',
  },
  {
    id: 'notifications',
    title: 'Notifications not arriving',
    answer: 'Keep notifications on for Byjan in Android settings. Open the app once after install so the device token can register. Settings → Device alerts can send a real test push to this phone.',
  },
  {
    id: 'sharing',
    title: 'Invites, members, or access',
    answer: 'Owners invite from the book’s People button. The other person must open the invite while signed in. Access & roles is only for Byjan super users.',
  },
  {
    id: 'export',
    title: 'Export PDF or CSV',
    answer: 'Open a money book and use Export. PDF and CSV both download from that menu. If a file is missing, check Downloads or the share sheet Android shows.',
  },
  {
    id: 'books',
    title: 'Money books or ledgers',
    answer: 'Home lists books you belong to. Create one from Home or the + button. Purpose fields (trip, rent, and so on) sit on the book after you pick a type.',
  },
  {
    id: 'other',
    title: 'Other',
    answer: 'If none of the topics fit, write what you expected and what happened. Include the screen name if you can. We read every ticket at byjanbooks@gmail.com.',
  },
] as const;

export type HelpTopicId = (typeof HELP_TOPICS)[number]['id'];

export type SupportTicket = {
  id: string;
  userId?: string;
  category: string;
  categoryLabel?: string;
  status: string;
  subject: string;
  message?: string;
  email?: string;
  displayName?: string;
  createdAt?: string;
  updatedAt?: string;
};

export function helpTopic(id?: string) {
  return HELP_TOPICS.find((row) => row.id === id) || HELP_TOPICS[HELP_TOPICS.length - 1];
}

export async function listSupportTickets(all = false) {
  const payload = await apiPost<{ tickets?: SupportTicket[] }>('/api/support', { op: 'list', all });
  return Array.isArray(payload.tickets) ? payload.tickets : [];
}

export async function createSupportTicket(input: { category: string; subject?: string; message?: string }) {
  const payload = await apiPost<{ ticket: SupportTicket; mailed?: boolean }>('/api/support', {
    op: 'create',
    category: input.category,
    subject: input.subject,
    message: input.message,
  });
  return payload;
}

export async function deactivateAccount() {
  return apiPost<{ user?: { status?: string } }>('/api/me', { op: 'deactivate' });
}

export async function deleteAccount() {
  return apiPost<{ ok?: boolean; authDeleted?: boolean }>('/api/me', { op: 'deleteAccount' });
}

export function setAuthNotice(message: string) {
  try {
    sessionStorage.setItem('byjan.authNotice', message);
  } catch {
    /* private mode */
  }
}

export function consumeAuthNotice() {
  try {
    const value = sessionStorage.getItem('byjan.authNotice') || '';
    if (value) sessionStorage.removeItem('byjan.authNotice');
    return value;
  } catch {
    return '';
  }
}

import { apiPost } from './api';

export const HELP_TOPICS = [
  {
    id: 'signin',
    group: 'Account',
    title: 'Sign-in or Google login',
    subs: ['Google keeps looping', 'Forgot password', 'Wrong account on this phone'],
    answer: 'Use the same Google account or email you registered with. On Android, Google sign-in needs this app’s SHA-1 in Firebase. If a screen says developer error, send Help → Other with the exact message.',
  },
  {
    id: 'lock',
    group: 'Account',
    title: 'App lock, PIN, or fingerprint',
    subs: ['PIN not accepted', 'Fingerprint not offered', 'Turn lock off'],
    answer: 'Settings → App lock. Set a 4+ digit PIN, then turn on fingerprint if this phone supports it. Forgot PIN: uninstalling does not reset it if the same account restores prefs — email byjanbooks@gmail.com from this login.',
  },
  {
    id: 'display',
    group: 'Account',
    title: 'Text size, icons, or corners',
    subs: ['Text too small', 'Icons not changing', 'Round vs sharp corners'],
    answer: 'Settings → Display. Text size, icon size, and corner shape apply to the whole app as soon as you pick them. Force-close Byjan once if an old screen is still open.',
  },
  {
    id: 'account',
    group: 'Account',
    title: 'Deactivate or delete account',
    subs: ['Pause the account', 'Delete my data', 'Play Store deletion'],
    answer: 'Settings → Deactivate or delete. Type DEACTIVATE to pause sign-in, or DELETE to wipe this login and books you own. Shared books you do not own stay with their owners. Play listing: easypado.com/delete-account.html.',
  },
  {
    id: 'books',
    group: 'Money',
    title: 'Money books or ledgers',
    subs: ['Create a book', 'Trip / rent purpose', 'Cannot see a shared book'],
    answer: 'Home lists books you belong to. Create one from Home or +. Purpose fields (trip, rent, and so on) sit on the book after you pick a type. Pull to refresh if a new invite does not show yet.',
  },
  {
    id: 'receipts',
    group: 'Money',
    title: 'Receipt scan or camera',
    subs: ['Camera permission', 'Wrong amount', 'PDF bills'],
    answer: 'Allow camera and photos when Android asks. Use Add → Scan on a clear photo of the bill. Edit the amount before saving if the scan is off. You can also share a PDF into Byjan.',
  },
  {
    id: 'recurring',
    group: 'Money',
    title: 'Regular or repeating payments',
    subs: ['Rent every month', 'Stop a repeat', 'Missed a cycle'],
    answer: 'Open Regular payments from Activity or the book. Set the amount, cycle, and next date. Pause or delete the rule there — past entries already saved in the book stay.',
  },
  {
    id: 'export',
    group: 'Money',
    title: 'Export PDF or CSV',
    subs: ['PDF missing', 'CSV in Excel', 'Share to WhatsApp'],
    answer: 'Open a money book and use Export. PDF and CSV both come from that menu. Check Downloads or the Android share sheet. CSV opens in Excel or Google Sheets.',
  },
  {
    id: 'reports',
    group: 'Money',
    title: 'Reports and totals',
    subs: ['This month vs all time', 'By category', 'Email a report'],
    answer: 'Reports sits in the Activity tab. Filter by book and dates. Category totals follow the labels on each entry. You can email a report if that action is on for your role.',
  },
  {
    id: 'splitpay',
    group: 'Pay & people',
    title: 'Split a bill',
    subs: ['Unequal shares', 'Someone missing', 'Settle later'],
    answer: 'Open the book, add people, then Split on the entry. You can type unequal amounts. Everyone in the split must already be a member of that book.',
  },
  {
    id: 'upi',
    group: 'Pay & people',
    title: 'UPI or Pay',
    subs: ['Pay button empty', 'Wrong UPI id', 'Payment app did not open'],
    answer: 'Save your UPI id under Settings first. Pay needs members and a balance in the book. Byjan opens GPay, PhonePe, Paytm, or another UPI app with the amount filled — the bank confirms the payment, not Byjan.',
  },
  {
    id: 'sharing',
    group: 'Pay & people',
    title: 'Invites, members, or access',
    subs: ['Invite not received', 'Remove a member', 'Access & roles'],
    answer: 'Owners invite from the book’s People button. The other person must open the invite while signed in. Access & roles is only for Byjan super users.',
  },
  {
    id: 'notifications',
    group: 'Pay & people',
    title: 'Notifications not arriving',
    subs: ['No tray alert', 'Test push', 'Sound off'],
    answer: 'Keep notifications on for Byjan in Android settings. Open the app once after install so the device token can register. Settings → Device alerts sends a real test push to this phone.',
  },
  {
    id: 'offline',
    group: 'App',
    title: 'Offline or slow sync',
    subs: ['Entry not on another phone', 'Spinner forever', 'No internet'],
    answer: 'Byjan queues some money entries when the network drops, then sends them when you are back online. Pull down on Home to refresh. If two phones disagree, wait a few seconds and refresh both.',
  },
  {
    id: 'play',
    group: 'App',
    title: 'Install, update, or Play Store',
    subs: ['Update not offered', 'Wrong package', 'Reinstall'],
    answer: 'Package is com.byjanbooks.app. Internal testing builds are signed AABs. After an update, force-close once so the new web assets load. Login uses the same Google/email as before.',
  },
  {
    id: 'other',
    group: 'App',
    title: 'Other',
    subs: ['Something else', 'Feature request', 'Bug with a screenshot note'],
    answer: 'If none of the topics fit, write what you expected and what happened. Name the screen if you can. We read every ticket at byjanbooks@gmail.com.',
  },
] as const;

export type HelpTopicId = (typeof HELP_TOPICS)[number]['id'];

export function helpGroups() {
  const groups: { title: string; topics: typeof HELP_TOPICS[number][] }[] = [];
  const index = new Map<string, number>();
  for (const topic of HELP_TOPICS) {
    const existing = index.get(topic.group);
    if (existing == null) {
      index.set(topic.group, groups.length);
      groups.push({ title: topic.group, topics: [topic] });
    } else {
      groups[existing].topics.push(topic);
    }
  }
  return groups;
}

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

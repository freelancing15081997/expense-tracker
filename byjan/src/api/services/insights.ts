// Home, insights, activity, inbox, search, review queue, smart capture (scan / voice / SMS / share), vault, templates, recurring.
import { api, upload } from '../client';
import * as M from '../mocks';
import type {
  ActivityItem, AttentionItems, HomeSummary, InboxItem, InsightsData, NotifPrefs, Recurring, ScanResult, SearchResult,
  SmsTxn, Template, VaultDoc, VoiceParse,
} from '../types';

export const dashboardApi = {
  /** PLACEHOLDER: GET /v1/home — spend this month, trend, attention count, today's feed. */
  home: () => api<HomeSummary>('GET', '/v1/home', { mock: M.home }),

  /** PLACEHOLDER: POST /v1/sync — pull-to-refresh (re-reads bank SMS, books). */
  sync: () => api<{ books: number }>('POST', '/v1/sync', { delay: 900, mock: { books: 4 } }),

  /** PLACEHOLDER: GET /v1/insights?month=Sep */
  insights: (month: string) => api<InsightsData>('GET', '/v1/insights', { query: { month }, mock: M.insights[month] ?? M.insights.Sep }),

  /** PLACEHOLDER: GET /v1/activity?mine= */
  activity: () => api<ActivityItem[]>('GET', '/v1/activity', { mock: M.activity }),

  /** PLACEHOLDER: GET /v1/search?q=&type= */
  search: (q: string, type: string) =>
    api<SearchResult[]>('GET', '/v1/search', {
      query: { q, type }, delay: 150,
      mock: () => {
        const ql = q.trim().toLowerCase().replace(/[₹,]/g, '');
        if (!ql) return [];
        return M.searchIndex.filter(d => (type === 'All' || d.kind === type) && `${d.title} ${d.sub} ${d.amount ?? ''}`.toLowerCase().replace(/[₹,]/g, '').includes(ql));
      },
    }),

  /** PLACEHOLDER: GET /v1/search/recent */
  recentSearches: () => api<string[]>('GET', '/v1/search/recent', { mock: M.recentSearches }),

  /** PLACEHOLDER: GET /v1/health — server reachability for the offline screen (pair with @react-native-community/netinfo for device Wi-Fi/data state). */
  health: () => api<{ ok: boolean }>('GET', '/v1/health', { delay: 200, mock: { ok: true } }),

  /** PLACEHOLDER: POST /v1/ask — natural-language question ("what did I spend on food?"). */
  ask: (question: string) => api<{ answer: string }>('POST', '/v1/ask', { body: { question }, mock: { answer: 'You spent ₹18,320 on food in September, mostly Swiggy.' } }),
};

export const notificationsApi = {
  /** PLACEHOLDER: GET /v1/notifications */
  list: () => api<InboxItem[]>('GET', '/v1/notifications', { mock: M.inbox }),
  /** PLACEHOLDER: POST /v1/notifications/read-all */
  markAllRead: () => api<void>('POST', '/v1/notifications/read-all', { mock: undefined as void }),
  /** PLACEHOLDER: POST /v1/notifications/:id/dismiss */
  dismiss: (id: string) => api<void>('POST', `/v1/notifications/${id}/dismiss`, { mock: undefined as void }),
  /** PLACEHOLDER: POST /v1/push/devices — register Expo/FCM/APNs push token. */
  registerDevice: (token: string, platform: string) => api<void>('POST', '/v1/push/devices', { body: { token, platform }, mock: undefined as void }),
  /** PLACEHOLDER: GET /v1/push/preferences */
  prefs: () => api<NotifPrefs>('GET', '/v1/push/preferences', { mock: M.notifPrefs }),
  /** PLACEHOLDER: PUT /v1/push/preferences */
  savePrefs: (p: NotifPrefs) => api<NotifPrefs>('PUT', '/v1/push/preferences', { body: p, mock: p }),
  /** PLACEHOLDER: POST /v1/push/test */
  sendTest: () => api<void>('POST', '/v1/push/test', { mock: undefined as void }),
};

export const reviewApi = {
  /** PLACEHOLDER: GET /v1/review — duplicates, unusual amounts, uncategorised. */
  attention: () => api<AttentionItems>('GET', '/v1/review', {
    mock: {
      duplicate: { text: 'Swiggy ₹1,240 was added twice, once from SMS and once by you, 2 minutes apart.' },
      highAmount: { text: 'BESCOM ₹4,860 is 2.6× your usual ₹1,860. Typo, or a real spike?' },
      category: { text: 'Amazon ₹2,399 · Home & Family. Pick one and we’ll remember next time.', options: ['Shopping', 'Home', 'Gifts', 'Other'] },
    },
  }),
  /** PLACEHOLDER: POST /v1/review/:kind/resolve — keep | merge | confirm | category */
  resolve: (kind: 'duplicate' | 'highAmount' | 'category', action: string) =>
    api<void>('POST', `/v1/review/${kind}/resolve`, { body: { action }, mock: undefined as void }),
};

export const captureApi = {
  /** PLACEHOLDER: POST /v1/scan/receipt (multipart) — OCR a bill/receipt/invoice. */
  scanReceipt: (file: { uri: string; name: string; type: string }, kind: 'Receipt' | 'Bill' | 'Invoice') =>
    upload<ScanResult>('/v1/scan/receipt', file, { kind }, {
      merchant: 'Toit Brewpub', amount: 4800, date: 'Today, 9:40 PM', confidence: 0.96,
      items: [{ name: 'Food', amount: 3260 }, { name: 'Drinks', amount: 1100 }, { name: 'Service + GST', amount: 440 }],
    }),

  /** PLACEHOLDER: POST /v1/voice/parse (multipart audio) — speech → structured entry. */
  parseVoice: (file: { uri: string; name: string; type: string }, lang: 'en-IN' | 'hi-IN') =>
    upload<VoiceParse>('/v1/voice/parse', file, { lang }, { transcript: '₹450 auto to the airport, Goa trip, split with everyone', amount: 450, title: 'Auto to airport', book: 'Goa Trip', splitWays: 5 }),

  /** PLACEHOLDER: GET /v1/sms/queue — transactions parsed on-device from bank SMS, pending review. */
  smsQueue: () => api<SmsTxn[]>('GET', '/v1/sms/queue', { mock: M.sms }),
  /** PLACEHOLDER: POST /v1/sms/queue/:id — add | ignore */
  smsAction: (id: string, action: 'add' | 'ignore') => api<void>('POST', `/v1/sms/queue/${id}`, { body: { action }, mock: undefined as void }),
  /** PLACEHOLDER: POST /v1/sms/queue/add-all */
  smsAddAll: (ids: string[]) => api<{ added: number }>('POST', '/v1/sms/queue/add-all', { body: { ids }, mock: { added: ids.length } }),

  /** PLACEHOLDER: POST /v1/share/parse — parse a screenshot shared from GPay/PhonePe into the app. */
  parseShared: (file: { uri: string; name: string; type: string }) =>
    upload<{ payee: string; amount: number; ref: string }>('/v1/share/parse', file, {}, { payee: 'Chai Point', amount: 640, ref: '426610' }),
};

export const vaultApi = {
  /** PLACEHOLDER: GET /v1/documents?folder=&q= */
  list: () => api<VaultDoc[]>('GET', '/v1/documents', { mock: M.vault }),
  /** PLACEHOLDER: POST /v1/documents (multipart) */
  upload: (file: { uri: string; name: string; type: string }) => upload<VaultDoc>('/v1/documents', file, {}, M.vault[1]),
  /** PLACEHOLDER: GET /v1/documents/:id/url — signed download URL. */
  url: (id: string) => api<{ url: string }>('GET', `/v1/documents/${id}/url`, { mock: { url: 'https://example.com/doc.pdf' } }),
};

export const templatesApi = {
  /** PLACEHOLDER: GET /v1/templates */
  list: () => api<Template[]>('GET', '/v1/templates', { mock: M.templates }),
  /** PLACEHOLDER: POST /v1/templates */
  create: (t: Omit<Template, 'id'>) => api<Template>('POST', '/v1/templates', { body: t, mock: { ...t, id: 'tnew' } }),
  /** PLACEHOLDER: DELETE /v1/templates/:id */
  remove: (id: string) => api<void>('DELETE', `/v1/templates/${id}`, { mock: undefined as void }),
  /** PLACEHOLDER: POST /v1/templates/:id/use — creates an entry from the template. */
  use: (id: string) => api<{ entryId: string }>('POST', `/v1/templates/${id}/use`, { mock: { entryId: 'e_new' } }),
};

export const recurringApi = {
  /** PLACEHOLDER: GET /v1/recurring */
  list: () => api<{ items: Recurring[]; suggestion: { name: string; text: string } | null }>('GET', '/v1/recurring', {
    mock: { items: M.recurring, suggestion: { name: 'Swiggy', text: 'About ₹1,200 every Friday for 6 weeks. Track it so it’s in your budget?' } },
  }),
  /** PLACEHOLDER: PATCH /v1/recurring/:id — pause/resume */
  setPaused: (id: string, paused: boolean) => api<void>('PATCH', `/v1/recurring/${id}`, { body: { paused }, mock: undefined as void }),
  /** PLACEHOLDER: POST /v1/recurring/suggestions/:name — track | ignore */
  suggestion: (name: string, action: 'track' | 'ignore') => api<void>('POST', `/v1/recurring/suggestions/${name}`, { body: { action }, mock: undefined as void }),
};

type PushMessage = {
  title: string;
  body: string;
  data?: Record<string, string | number | boolean | null | undefined>;
};

let cachedToken: { value: string; exp: number } | null = null;

function serviceAccount() {
  const raw = String(process.env.FIREBASE_SERVICE_ACCOUNT_JSON || '').trim();
  if (!raw) return null;
  try {
    return JSON.parse(raw) as { client_email?: string; private_key?: string; project_id?: string };
  } catch {
    return null;
  }
}

function stringifyData(data?: PushMessage['data']): Record<string, string> {
  const out: Record<string, string> = {};
  if (!data) return out;
  for (const [key, value] of Object.entries(data)) {
    if (value == null) continue;
    const text = String(value);
    if (!text) continue;
    out[key] = text;
  }
  return out;
}

async function googleAccessToken() {
  if (cachedToken && cachedToken.exp > Date.now() + 30_000) return cachedToken.value;
  const sa = serviceAccount();
  const email = sa?.client_email || process.env.FIREBASE_CLIENT_EMAIL || '';
  const key = String(sa?.private_key || process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
  if (!email || !key) return '';
  const { SignJWT, importPKCS8 } = await import('jose');
  const pk = await importPKCS8(key, 'RS256');
  const now = Math.floor(Date.now() / 1000);
  const jwt = await new SignJWT({ scope: 'https://www.googleapis.com/auth/firebase.messaging' })
    .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
    .setIssuer(email)
    .setAudience('https://oauth2.googleapis.com/token')
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(pk);
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${encodeURIComponent(jwt)}`,
  });
  const json = await res.json() as { access_token?: string; expires_in?: number };
  const token = String(json.access_token || '');
  if (token) cachedToken = { value: token, exp: Date.now() + Number(json.expires_in || 3500) * 1000 };
  return token;
}

export async function sendFcm(token: string, message: PushMessage) {
  const dest = String(token || '').trim();
  if (!dest) return { ok: false, error: 'missing-token' as const };
  const project = String(serviceAccount()?.project_id || process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID || 'gen-lang-client-0616065043');
  const access = await googleAccessToken();
  if (!access) {
    console.error('FCM skipped: missing Google access token');
    return { ok: false, error: 'missing-access' as const };
  }
  const data = stringifyData({
    title: message.title,
    body: message.body,
    ...(message.data || {}),
  });
  const res = await fetch(`https://fcm.googleapis.com/v1/projects/${project}/messages:send`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${access}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      message: {
        token: dest,
        notification: { title: message.title, body: message.body },
        data,
        android: {
          priority: 'HIGH',
          ttl: '86400s',
          collapse_key: String(message.data?.bookId || 'byjan'),
          notification: {
            title: message.title,
            body: message.body,
            channelId: 'byjan_alerts',
            icon: 'ic_stat_byjan',
            color: '#0B1F3A',
            sound: 'default',
            defaultSound: true,
            defaultVibrateTimings: true,
            notificationCount: 1,
            visibility: 'PUBLIC',
            notificationPriority: 'PRIORITY_MAX',
          },
        },
        apns: {
          payload: { aps: { sound: 'default', badge: 1, 'content-available': 1 } },
        },
      },
    }),
  }).catch((err) => {
    console.error('FCM network error', err);
    return null;
  });
  if (!res) return { ok: false, error: 'network' as const };
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    console.error('FCM send failed', res.status, detail.slice(0, 500));
    return { ok: false, error: `http-${res.status}` as const };
  }
  return { ok: true as const };
}

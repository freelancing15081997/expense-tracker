/**
 * Send one FCM tray alert using the local service-account JSON.
 * Usage: npx tsx scripts/fcm-send.ts <deviceToken> [title] [body]
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const SA_PATH = resolve(
  process.cwd(),
  'gen-lang-client-0616065043-firebase-adminsdk-fbsvc-d64f6a946e.json',
);

process.env.FIREBASE_SERVICE_ACCOUNT_JSON = readFileSync(SA_PATH, 'utf8');

const token = String(process.argv[2] || '').trim();
if (!token) {
  console.log(JSON.stringify({ ok: false, error: 'missing-device-token' }));
  process.exit(1);
}

const { sendFcm } = await import('../api/_lib/fcm.ts');
const result = await sendFcm(token, {
  title: String(process.argv[3] || 'Byjan'),
  body: String(process.argv[4] || 'New entry in a money book'),
  data: { url: '/#/', kind: 'entry' },
});
console.log(JSON.stringify(result));
if (!result?.ok) process.exit(1);

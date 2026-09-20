/**
 * Upload a signed AAB to Google Play via Android Publisher API.
 *
 * Requires one of:
 *   - android/play-service-account.json  (Play Console API service account)
 *   - env PLAY_SERVICE_ACCOUNT_JSON      (raw JSON string)
 *   - env PLAY_SERVICE_ACCOUNT_FILE      (path to JSON)
 *
 * Usage:
 *   node scripts/play-upload.mjs [path-to.aab] [--track=production|beta|alpha|internal] [--draft]
 */
import fs from 'fs';
import path from 'path';
import { google } from 'googleapis';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const PKG = 'com.byjanbooks.app';

function loadServiceAccount() {
  if (process.env.PLAY_SERVICE_ACCOUNT_JSON) {
    return JSON.parse(process.env.PLAY_SERVICE_ACCOUNT_JSON);
  }
  const file =
    process.env.PLAY_SERVICE_ACCOUNT_FILE ||
    path.join(root, 'android', 'play-service-account.json');
  if (!fs.existsSync(file)) {
    throw new Error(
      `Missing Play API credentials. Place the service account JSON at:\n  ${path.join(root, 'android', 'play-service-account.json')}\n` +
        'Create it in Google Cloud → enable "Google Play Android Developer API" →\n' +
        'Play Console → Users and permissions → invite that client_email with Release permissions.'
    );
  }
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function parseArgs(argv) {
  let aab = path.join(root, 'android', 'app', 'build', 'outputs', 'bundle', 'release', 'app-release.aab');
  let track = 'production';
  let draft = false;
  for (const a of argv) {
    if (a.startsWith('--track=')) track = a.slice('--track='.length);
    else if (a === '--draft') draft = true;
    else if (!a.startsWith('-')) aab = path.resolve(a);
  }
  return { aab, track, draft };
}

async function main() {
  const { aab, track, draft } = parseArgs(process.argv.slice(2));
  if (!fs.existsSync(aab)) throw new Error(`AAB not found: ${aab}`);

  const creds = loadServiceAccount();
  const auth = new google.auth.GoogleAuth({
    credentials: creds,
    scopes: ['https://www.googleapis.com/auth/androidpublisher'],
  });
  const play = google.androidpublisher({ version: 'v3', auth });

  console.log('package', PKG);
  console.log('aab', aab, `(${Math.round(fs.statSync(aab).size / 1024 / 1024)} MB)`);
  console.log('track', track, draft ? '(draft)' : '(completed)');

  const edit = await play.edits.insert({ packageName: PKG });
  const editId = edit.data.id;
  console.log('edit', editId);

  const upload = await play.edits.bundles.upload({
    packageName: PKG,
    editId,
    media: { mimeType: 'application/octet-stream', body: fs.createReadStream(aab) },
  });
  console.log('uploaded versionCode', upload.data.versionCode);

  await play.edits.tracks.update({
    packageName: PKG,
    editId,
    track,
    requestBody: {
      track,
      releases: [
        {
          name: `1.0.${upload.data.versionCode}`,
          versionCodes: [String(upload.data.versionCode)],
          status: draft ? 'draft' : 'completed',
        },
      ],
    },
  });

  const commit = await play.edits.commit({
    packageName: PKG,
    editId,
    changesNotSentForReview: true,
  });
  console.log('PLAY_UPLOAD_OK', JSON.stringify(commit.data));
}

main().catch((e) => {
  console.error('PLAY_UPLOAD_FAIL', e.code || '', e.errors?.[0]?.message || e.message);
  process.exit(1);
});

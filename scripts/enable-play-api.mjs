import fs from 'fs';
import { google } from 'googleapis';

const creds = JSON.parse(fs.readFileSync('android/play-service-account.json', 'utf8'));
const project = creds.project_id;
const auth = new google.auth.GoogleAuth({
  credentials: creds,
  scopes: [
    'https://www.googleapis.com/auth/cloud-platform',
    'https://www.googleapis.com/auth/service.management',
  ],
});
const serviceusage = google.serviceusage({ version: 'v1', auth });
const name = `projects/${project}/services/androidpublisher.googleapis.com`;

try {
  const get = await serviceusage.services.get({ name });
  console.log('STATE', get.data.state);
  if (get.data.state !== 'ENABLED') {
    const op = await serviceusage.services.enable({ name });
    console.log('ENABLE_STARTED', op.data?.name || JSON.stringify(op.data));
    // poll briefly
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 3000));
      const again = await serviceusage.services.get({ name });
      console.log('POLL', again.data.state);
      if (again.data.state === 'ENABLED') break;
    }
  } else {
    console.log('ALREADY_ENABLED');
  }
} catch (e) {
  console.log('ENABLE_FAIL', e.code || '', e.errors?.[0]?.message || e.message);
  process.exit(1);
}

/**
 * Keeps Capacitor Firebase Google sign-in usable when GoogleAuthUtil.getToken
 * fails after a successful account pick (Account reauth / BAD_AUTHENTICATION).
 * Firebase only needs the idToken with skipNativeAuth.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = path.join(root, 'scripts', 'patches', 'GoogleAuthProviderHandler.java');
const dest = path.join(
  root,
  'node_modules',
  '@capacitor-firebase',
  'authentication',
  'android',
  'src',
  'main',
  'java',
  'io',
  'capawesome',
  'capacitorjs',
  'plugins',
  'firebase',
  'authentication',
  'handlers',
  'GoogleAuthProviderHandler.java',
);

if (!fs.existsSync(src)) {
  console.warn('[apply-google-auth-patch] missing patch source, skip');
  process.exit(0);
}
if (!fs.existsSync(path.dirname(dest))) {
  console.warn('[apply-google-auth-patch] plugin not installed, skip');
  process.exit(0);
}
fs.copyFileSync(src, dest);
console.log('[apply-google-auth-patch] applied GoogleAuthProviderHandler.java');

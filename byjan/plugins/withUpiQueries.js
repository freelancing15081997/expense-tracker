const { withAndroidManifest } = require('expo/config-plugins');

/** Android 11+ hides other apps unless we declare the upi scheme. */
module.exports = function withUpiQueries(config) {
  return withAndroidManifest(config, config => {
    const manifest = config.modResults.manifest;
    manifest.queries = manifest.queries || [];
    const has = manifest.queries.some(q => JSON.stringify(q).includes('upi'));
    if (!has) {
      manifest.queries.push({
        intent: [{ action: [{ $: { 'android:name': 'android.intent.action.VIEW' } }], data: [{ $: { 'android:scheme': 'upi' } }] }],
      });
    }
    if (process.env.EXPO_PUBLIC_SMS === '1') {
      const perms = manifest['uses-permission'] || [];
      if (!perms.some(p => p.$['android:name'] === 'android.permission.READ_SMS')) {
        perms.push({ $: { 'android:name': 'android.permission.READ_SMS' } });
        manifest['uses-permission'] = perms;
      }
    }
    return config;
  });
};

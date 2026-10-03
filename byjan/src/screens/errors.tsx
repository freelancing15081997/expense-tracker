import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useApp, useColors } from '../state/AppContext';
import { billingApi, dashboardApi, flushOfflineQueue, invitesApi } from '../api';
import { inr } from '../theme/tokens';
import { Card, Icon, KV, Progress, Row, StatePage, T } from '../components/ui';
import { UpiBadge } from '../components/brand';
import type { ScreenProps } from '../navigation/types';
import { useQuery } from '../hooks/useApi';
import { readNetwork } from '../native/device';

/* E1 No internet */
export function OfflineScreen({ navigation }: ScreenProps) {
  const p = useColors(); const { showToast } = useApp(); const [busy, setBusy] = useState(false);
  const [net, setNet] = useState({ wifi: 'Not connected', data: 'No signal', online: false });
  React.useEffect(() => {
    const tick = () => readNetwork().then(n => {
      setNet(n);
      if (n.online) flushOfflineQueue().then(() => dashboardApi.health()).then(() => dashboardApi.sync()).catch(() => {});
    }).catch(() => {});
    tick();
    const t = setInterval(tick, 10000);
    return () => clearInterval(t);
  }, []);
  return (
    <StatePage icon="wifiOff" ring={p.wa} title="You're offline" body="No worries, keep adding entries. They're saved on this phone and sync as soon as you're back online."
      primary={{ label: busy ? 'Checking connection…' : 'Try again', busy, onPress: async () => { setBusy(true); try { await dashboardApi.health(); await dashboardApi.sync(); navigation.navigate('Spaces', { space: 'Home', at: Date.now() }); showToast('Back online. All good'); } catch { showToast("Still offline. We'll keep trying in the background"); } finally { setBusy(false); } } }}
      secondary={{ label: 'Keep working offline', onPress: () => navigation.navigate('Spaces', { space: 'Home', at: Date.now() }) }}>
      <Card style={{ paddingVertical: 4 }}>
        {([['wifi', 'Wi-Fi', net.wifi, net.wifi === 'Connected' ? p.po : p.ne], ['signal', 'Mobile data', net.data, net.data === 'Connected' ? p.po : p.ne], ['server', 'Byjan servers', 'Online', p.po]] as const).map(([i, n, s, c], k) => (
          <Row key={n} between style={{ paddingVertical: 10, borderTopWidth: k ? 1 : 0, borderColor: p.sep }}><Row><Icon name={i} size={16} color={p.mu} /><T v="small" c="tx">{n}</T></Row><T v="tiny" c={c}>● {s}</T></Row>
        ))}
        <View style={{ marginVertical: 8 }}><Progress pct={60} color={p.wa} /></View><T v="tiny" style={{ textAlign: 'right', marginBottom: 6 }}>Auto-retry every 10s</T>
      </Card>
      <Card style={{ marginTop: 10, paddingVertical: 8 }}>
        <Row between><T v="smallB">Waiting to sync</T><T v="tiny">3</T></Row>
        {[['Chai Point', 80], ['Auto to airport', 450], ['Water bottles', 60]].map(([n, a]) => <Row key={n} between style={{ marginTop: 6 }}><T v="small" c="tx">{n}</T><T v="mono" c="mu">{inr(a as number)}</T></Row>)}
      </Card>
    </StatePage>
  );
}

/* E2 Payment failed */
export function PayFailScreen({ navigation, route }: ScreenProps<'PayFail'>) {
  const p = useColors(); const amt = route.params?.amount ?? 800;
  return (
    <StatePage icon="x" ring={p.ne} title="Payment didn't go through" body={`${inr(amt)} to Meera wasn't debited. If money did leave your account, UPI refunds it automatically within 48 hours.`}
      primary={{ label: 'Try again', onPress: () => navigation.replace('Pay', { to: 'MI', amount: amt }) }} secondary={{ label: 'Pay with another app', onPress: () => navigation.replace('Pay', { to: 'MI', amount: amt }) }}>
      <Card style={{ paddingVertical: 4 }}>
        <KV border={false} k="Reason" v={route.params?.reason ?? 'Declined by your bank'} vc="ne" /><KV k="Code" v={(route.params?.code ?? 'U30') + ' · insufficient balance'} mono />
        <KV k="Tried with" v="GPay · HDFC ••4821" /><KV k="Ref" v="426618338104" mono />
      </Card>
      <T v="smallB" c="mu" style={{ marginTop: 16, marginBottom: 8 }}>Or try another app</T>
      <Row>{['PhonePe', 'Paytm', 'Other UPI'].map(a => (
        <Pressable key={a} onPress={() => navigation.replace('Pay', { to: 'MI', amount: amt })} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: p.s1, borderRadius: 14, padding: 10 }}><UpiBadge app={a} size={24} /><T v="tiny" c="tx">{a}</T></Pressable>
      ))}</Row>
    </StatePage>
  );
}

/* E3 Server error */
export function ServerErrorScreen({ navigation }: ScreenProps) {
  const p = useColors();
  return (
    <StatePage icon="cloudWarning" ring={p.a2} title="Something broke on our side" body="It's not you, it's us. Your money and entries are safe; nothing was lost or changed."
      primary={{ label: 'Try again', onPress: () => navigation.goBack() }} secondary={{ label: 'Go to Home', onPress: () => navigation.navigate('Spaces', { space: 'Home', at: Date.now() }) }}>
      <Card style={{ paddingVertical: 4 }}><KV border={false} k="What happened" v="Server didn't respond" /><KV k="Error ID" v="BJ-503-7Q4K" mono /><KV k="Status" v="● Being fixed now" vc="wa" /></Card>
    </StatePage>
  );
}

/* E4 Scan failed */
export function ScanFailScreen({ navigation }: ScreenProps) {
  const p = useColors();
  return (
    <StatePage icon="scan" ring={p.wa} title="Couldn't read that receipt" body="The photo was a bit blurry. Try once more; these three things fix it almost every time."
      primary={{ label: 'Retake photo', onPress: () => navigation.replace('Scan') }} secondary={{ label: 'Enter it manually', onPress: () => navigation.replace('AddEntry') }}>
      {[['sun', 'Good light, no shadow over the text'], ['frame', 'All four corners inside the frame'], ['hand', 'Hold still for a second after tapping']].map(([i, t]) => (
        <Card key={t} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8, paddingVertical: 12 }}><Icon name={i as any} size={18} color={p.ac} /><T v="small" c="tx">{t}</T></Card>
      ))}
    </StatePage>
  );
}

/* E5 Invite expired */
export function ExpiredScreen({ navigation, route }: ScreenProps<'Expired'>) {
  const p = useColors(); const { showToast } = useApp();
  const code = route.params?.code ?? 'GT-7Q4K';
  const inv = useQuery(() => invitesApi.summary(code), [code], 'invite:' + code);
  const who = inv.data?.invitedBy.split(' ')[0] ?? 'them';
  return (
    <StatePage icon="linkBreak" ring={p.mu} title="This invite link has expired" body={`Links stop working after 7 days to keep your books private. Ask ${who} for a fresh one; it takes two taps.`}
      primary={{ label: `Ask ${who} for a new link`, onPress: async () => { await invitesApi.requestNew(code); navigation.navigate('Spaces', { space: 'Home', at: Date.now() }); showToast(`Asked ${who} for a new invite link`); } }} secondary={{ label: 'Go to Home', onPress: () => navigation.navigate('Spaces', { space: 'Home', at: Date.now() }) }}>
      <Card style={{ paddingVertical: 4 }}><KV border={false} k="Book" v={inv.data?.bookName ?? '…'} /><KV k="Invited by" v={inv.data?.invitedBy ?? '…'} /><KV k="Expired" v={inv.data?.expired ?? '…'} /></Card>
    </StatePage>
  );
}

/* E6 Plan limit */
export function LimitScreen({ navigation }: ScreenProps) {
  const p = useColors(); const { showToast } = useApp();
  return (
    <StatePage icon="sparkle" ring={p.ac} title="You've used all 30 free scans" body="Scans reset on 1 October. Or go Plus for 300 a month, plus voice entry and unlimited books."
      primary={{ label: 'Start free trial', onPress: async () => { await billingApi.startTrial('plus'); navigation.navigate('Spaces', { space: 'Home', at: Date.now() }); showToast('Plus trial started. 300 scans unlocked'); } }} secondary={{ label: 'Type it in instead', onPress: () => navigation.replace('AddEntry') }}>
      <Card><Row between><T v="small">Scans this month</T><T v="mono" c="tx">30 / 30</T></Row><View style={{ marginVertical: 10 }}><Progress pct={100} color={p.a2} /></View><Row gap={6}><T v="h2">₹99</T><T v="tiny">/month · 14-day free trial</T></Row></Card>
    </StatePage>
  );
}

import React, { useEffect, useState } from 'react';
import { Linking, Platform, Pressable, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useApp, useColors } from '../state/AppContext';
import { authApi, booksApi, invitesApi, notificationsApi, profileApi, ApiError, BookKind, Invite } from '../api';
import { useMutation, useQuery } from '../hooks/useApi';
import { fonts } from '../theme/tokens';
import { AvatarStack, Avatar, Button, Card, Chip, Gap, Header, Icon, Input, Keypad, KV, Label, LinkText, Loading, Progress, Row, Screen, T, tap } from '../components/ui';
import { Logo, UpiBadge } from '../components/brand';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import { EASE, haptic, Loop, markDrag, Press, Replay, Rise } from '../components/motion';
import type { ScreenProps } from '../navigation/types';
import { biometricUnlock, registerPush, saveSession } from '../native/device';

/* 01 Splash */
export function SplashScreen({ navigation }: ScreenProps) {
  const p = useColors();
  useEffect(() => { const t = setTimeout(() => navigation.replace('Onboarding'), 2000); return () => clearTimeout(t); }, [navigation]);
  return (
    <Pressable onPress={() => navigation.replace('Onboarding')} style={{ flex: 1 }}>
      <LinearGradient colors={['#0F2A22', p.bg, p.bg]} start={{ x: 0.5, y: 0.25 }} end={{ x: 0.5, y: 1 }} style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ width: 200, height: 200, alignItems: 'center', justifyContent: 'center' }}>
          <Loop name="ringOut" duration={2400} easing={EASE.out} pointerEvents="none" style={{ position: 'absolute', width: 200, height: 200, borderRadius: 100, borderWidth: 1.5, borderColor: '#5EE6B5' }} />
          <Loop name="ringOut" duration={2400} delay={1200} easing={EASE.out} pointerEvents="none" style={{ position: 'absolute', width: 200, height: 200, borderRadius: 100, borderWidth: 1.5, borderColor: '#5EE6B5' }} />
          <Rise kind="pop" duration={800}><Loop name="float" duration={3000}><View style={{ shadowColor: '#5EE6B5', shadowOpacity: 0.55, shadowRadius: 40 }}><Logo size={96} /></View></Loop></Rise>
        </View>
        <Rise delay={300}><T style={{ fontFamily: fonts.bold, fontSize: 36, marginTop: 6, letterSpacing: -1.2 }} c="#F2F5F7">byjan</T></Rise>
        <Rise delay={450}><T v="small" c="#8C95A1">Shared money, settled.</T></Rise>
        <Rise delay={700} style={{ position: 'absolute', bottom: 60 }}><Row gap={6}><Icon name="shield" size={13} color="#8C95A1" /><T v="tiny" c="#8C95A1">Bank-grade encryption · UPI secured</T></Row></Rise>
      </LinearGradient>
    </Pressable>
  );
}

/* 01b Onboarding slides */
const SLIDES = [
  ['Every shared rupee, in one place', 'Trips, flatmates, family, site work. One book each, everyone sees the same numbers.'],
  ['Split fairly. Settle in one tap', 'Equal, exact or by shares. Byjan works out the fewest payments.'],
  ['Pay back on any UPI app', 'GPay, PhonePe, Paytm. Byjan never sees your UPI PIN.'],
];
export function OnboardingScreen({ navigation }: ScreenProps) {
  const p = useColors(); const [i, setI] = useState(0);
  const next = () => (i < 2 ? setI(i + 1) : navigation.replace('SignIn'));
  const swipe = Gesture.Pan().activeOffsetX([-12, 12]).onStart(() => runOnJS(markDrag)()).onEnd(e => {
    if (e.translationX < -36 || e.velocityX < -300) runOnJS(setI)(Math.min(2, i + 1));
    else if (e.translationX > 36 || e.velocityX > 300) runOnJS(setI)(Math.max(0, i - 1));
  });
  useEffect(() => { haptic('tick'); }, [i]);
  return (
    <GestureDetector gesture={swipe}>
    <View style={{ flex: 1 }}>
    <Screen scroll={false}>
      <Row between><Row gap={8}><Logo size={26} /><T v="title">byjan</T></Row><LinkText c="mu" label="Skip" onPress={() => navigation.replace('SignIn')} /></Row>
      <View key={i} style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        {i === 0 && (
          <Loop name="float" duration={4000} style={{ width: 270, height: 210 }}>
            <Rise kind="riseBig" duration={600} style={{ position: 'absolute', top: 0, left: 24 }}><LinearGradient colors={p.c2 as [string, string]} style={{ width: 220, height: 132, borderRadius: 22, transform: [{ rotate: '-9deg' }], borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)' }} /></Rise>
            <Rise kind="riseBig" duration={650} delay={90} style={{ position: 'absolute', top: 22, left: 8 }}>
              <LinearGradient colors={p.c1 as [string, string]} style={{ width: 236, height: 144, borderRadius: 22, padding: 16, transform: [{ rotate: '-5deg' }], borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', borderTopColor: 'rgba(255,255,255,0.32)' }}>
                <T v="kicker" c={p.cm}>TRIP · 5 PEOPLE</T><T v="h3" c={p.ct}>Goa Trip</T><Gap h={14} /><T v="tiny" c={p.cm}>You'll get back</T><T c={p.ct} style={{ fontFamily: fonts.bold, fontSize: 28, letterSpacing: -1 }}>₹2,850</T>
              </LinearGradient>
            </Rise>
            <Rise kind="pop" delay={500} style={{ position: 'absolute', right: 0, bottom: 4 }}><Row gap={6} style={{ backgroundColor: p.s1, borderWidth: 1, borderColor: p.ci2, borderRadius: 14, paddingHorizontal: 10, height: 30 }}><Avatar ini="KS" size={20} /><T v="tiny" c="tx" style={{ fontFamily: fonts.bold }}>Kabir paid ₹1,250</T></Row></Rise>
          </Loop>
        )}
        {i === 1 && (
          <Rise kind="riseBig"><Card style={{ width: 270, gap: 12 }}>
            <Row between><T v="kicker">SPLIT EQUALLY</T><T v="mono" c="tx">₹1,240</T></Row>
            {['AK', 'PS', 'RV', 'KS'].map((a, k) => <Rise key={a} delay={150 + k * 90} kind="slideL"><Row between><Row><Avatar ini={a} size={30} /><T v="smallB">{({ AK: 'You', PS: 'Priya', RV: 'Rahul', KS: 'Kabir' } as Record<string, string>)[a]}</T></Row><Row gap={8}><T v="mono" c="tx">₹310</T><Rise kind="pop" delay={300 + k * 90}><View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: p.ac, alignItems: 'center', justifyContent: 'center' }}><Icon name="check" size={11} color={p.ai} weight="bold" /></View></Rise></Row></Row></Rise>)}
          </Card></Rise>
        )}
        {i === 2 && (
          <View style={{ alignItems: 'center', gap: 18 }}>
            <Row gap={12}>{['GPay', 'PhonePe', 'Paytm'].map((a, k) => <Rise key={a} kind="tileIn" delay={k * 90}><Loop name="float" duration={2800} delay={k * 300}><Card style={{ alignItems: 'center', width: 84, gap: 8 }}><UpiBadge app={a} size={40} /><T v="tiny" c="tx" style={{ fontFamily: fonts.bold }}>{a}</T></Card></Loop></Rise>)}</Row>
            <Rise delay={400}><Row gap={6} style={{ backgroundColor: p.pot, borderRadius: 14, paddingHorizontal: 12, height: 30 }}><Icon name="lock" size={13} color={p.po} /><T v="tiny" c="po" style={{ fontFamily: fonts.bold }}>Your UPI PIN never leaves your bank app</T></Row></Rise>
          </View>
        )}
      </View>
      <Rise key={'t' + i}><T v="h1" style={{ fontSize: 28, lineHeight: 33 }}>{SLIDES[i][0]}</T></Rise>
      <Rise key={'b' + i} delay={80}><T v="body" c="mu" style={{ marginTop: 8 }}>{SLIDES[i][1]}</T></Rise>
      <Row between style={{ marginTop: 36, marginBottom: 24 }}>
        <Row gap={5}>{[0, 1, 2].map(k => <Press key={k} onPress={() => setI(k)} hitSlop={8}><View style={[{ width: k === i ? 26 : 7, height: 7, borderRadius: 4, backgroundColor: k === i ? p.ac : p.s2 }, { transitionProperty: ['width', 'backgroundColor'], transitionDuration: 300, transitionTimingFunction: EASE.out } as any]} /></Press>)}</Row>
        <Button label={i === 2 ? 'Get started' : 'Next'} icon={i === 2 ? undefined : 'arrowRight'} onPress={next} style={{ width: 150 }} />
      </Row>
    </Screen>
    </View>
    </GestureDetector>
  );
}

/* 02 Sign in */
export function SignInScreen({ navigation }: ScreenProps) {
  const p = useColors(); const { showToast } = useApp();
  const [phone, setPhone] = useState('98450 12345');
  const [send, busy] = useMutation(authApi.sendOtp);
  const [google, gBusy] = useMutation(authApi.signInWithGoogle);
  const { signIn } = useApp();
  const ok = phone.replace(/\D/g, '').length === 10;
  const go = async () => {
    if (!ok) return showToast('Enter a 10-digit mobile number');
    try { const r = await send('+91' + phone.replace(/\D/g, '')); navigation.navigate('Otp', { requestId: r.requestId, phone }); }
    catch (e) { showToast((e as ApiError).message); }
  };
  return (
    <Screen>
      <Row gap={8} style={{ marginTop: 8 }}><Logo size={30} /><T v="h3">byjan</T></Row>
      <Rise delay={60}><T v="h1" style={{ marginTop: 40, fontSize: 36, lineHeight: 40, letterSpacing: -1.4 }}>Shared money,{'\n'}<T c="ac" style={{ fontFamily: fonts.bold, fontSize: 36, lineHeight: 40, letterSpacing: -1.4 }}>finally sorted.</T></T></Rise>
      <T v="small" style={{ marginTop: 10 }}>Trips, homes and projects. Track who paid, split fairly and settle on UPI.</T>
      <Label>Mobile number</Label>
      <Input value={phone} onChangeText={t => setPhone(t.replace(/[^\d ]/g, '').slice(0, 11))} keyboardType="phone-pad" style={{ borderColor: ok ? p.ac : 'transparent' }}
        left={<T v="bodyB" c="mu">+91</T>} hint="We'll text a 6-digit code. No spam, ever." />
      <Gap h={110} />
      <Button label="Continue" busy={busy} onPress={go} />
      <T v="tiny" center style={{ marginVertical: 12 }}>or</T>
      <Row>
        <Button kind="secondary" label="Google" style={{ flex: 1 }} busy={gBusy} onPress={async () => { const r = await google('google-id-token'); signIn(r.user, r.token); navigation.reset({ index: 0, routes: [{ name: 'Spaces', params: { space: 'Home' } }] }); }} />
        <Button kind="secondary" label="Email" style={{ flex: 1 }} onPress={() => navigation.navigate('Forgot')} />
      </Row>
      <View style={{ alignItems: 'center', marginTop: 14 }}><LinkText label="Use email and password instead" onPress={() => navigation.navigate('Forgot')} /></View>
      <T v="tiny" center style={{ marginTop: 14 }}>By continuing you agree to the Terms and Privacy Policy.</T>
    </Screen>
  );
}

/* 03 OTP */
export function OtpScreen({ navigation, route }: ScreenProps<'Otp'>) {
  const p = useColors(); const { signIn, showToast } = useApp();
  const [otp, setOtp] = useState(route.params?.preset ?? '');
  const [err, setErr] = useState(!!route.params?.preset);
  const [verify, busy] = useMutation(authApi.verifyOtp);
  const [left, setLeft] = useState(24);
  useEffect(() => { const t = setInterval(() => setLeft(l => Math.max(0, l - 1)), 1000); return () => clearInterval(t); }, []);
  const press = async (k: string) => {
    if (k === 'del') { setOtp(o => o.slice(0, -1)); setErr(false); return; }
    const v = err ? k : (otp + k).slice(0, 6); setErr(false); setOtp(v);
    if (v.length === 6) {
      try {
        const r = await verify(route.params?.requestId ?? 'otp', v);
        signIn(r.user, r.token); showToast('Welcome back, ' + r.user.name.split(' ')[0]);
        navigation.reset({ index: 0, routes: [{ name: r.isNew ? 'Setup' : 'Spaces' }] });
      } catch { tap('error'); setErr(true); }
    }
  };
  return (
    <Screen scroll={false}>
      <Header />
      <T v="h1">Enter the code</T>
      <Row gap={4} style={{ marginTop: 6 }}><T v="small">Sent to</T><T v="smallB">+91 {route.params?.phone ?? '98450 12345'}</T><LinkText label="· Edit" onPress={() => navigation.goBack()} /></Row>
      <Replay trigger={err ? 'e' + otp : ''} name="shake" duration={450}>
      <Row gap={8} style={{ marginTop: 26 }}>
        {[0, 1, 2, 3, 4, 5].map(i => (
          <Rise key={i} kind="tileIn" delay={i * 40} style={{ flex: 1 }}>
          <View style={[{ height: 58, borderRadius: 16, backgroundColor: err ? p.net : otp[i] ? p.s2 : p.s1, borderWidth: 1.5, borderColor: err ? p.ne : i === otp.length ? p.ac : otp[i] ? p.a2t : p.sep, alignItems: 'center', justifyContent: 'center' }, { transitionProperty: ['borderColor', 'backgroundColor'], transitionDuration: 160 } as any]}>
            {otp[i] ? <Rise key={i + otp[i]} kind="bump" duration={220}><T c={err ? 'ne' : 'tx'} style={{ fontFamily: fonts.bold, fontSize: 24, lineHeight: 28 }}>{otp[i]}</T></Rise>
              : i === otp.length && !err ? <Loop name="caret" duration={1000} easing="steps(1)"><View style={{ width: 2, height: 22, borderRadius: 1, backgroundColor: p.ac }} /></Loop> : null}
          </View>
          </Rise>
        ))}
      </Row>
      </Replay>
      <T v="small" center c={err ? 'ne' : otp.length === 6 || busy ? 'ac' : 'mu'} style={{ marginTop: 14 }}>
        {err ? "That code didn't match. Check the SMS and try again." : busy ? 'Verifying…' : left ? `Resend code in 0:${String(left).padStart(2, '0')} · demo code 246810` : ''}
      </T>
      {!left && !err ? <View style={{ alignItems: 'center' }}><LinkText label="Resend code" onPress={async () => { await authApi.sendOtp(route.params?.phone ?? ''); setLeft(24); showToast('New code sent'); }} /></View> : null}
      <View style={{ flex: 1 }} />
      <Keypad onKey={press} style={{ marginBottom: 30 }} />
    </Screen>
  );
}

/* 02b Forgot password */
export function ForgotScreen() {
  const p = useColors(); const { showToast } = useApp();
  const [email, setEmail] = useState(''); const [err, setErr] = useState(''); const [sent, setSent] = useState(false); const [resent, setResent] = useState(false);
  const [send, busy] = useMutation(authApi.forgotPassword);
  const valid = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(email);
  const go = async () => {
    if (!email) return setErr('Enter the email you signed up with');
    if (!valid) return setErr("That email doesn't look right");
    try { await send(email); setSent(true); } catch (e) { setErr((e as ApiError).message); }
  };
  if (sent) return (
    <Screen footer={<View style={{ gap: 10 }}><Button label="Open email app" onPress={() => { Linking.openURL(Platform.OS === 'ios' ? 'message://' : 'mailto:').catch(() => showToast('Open your email app to find the link')); }} /><Button kind="secondary" label={resent ? 'Sent again · wait 60s' : 'Resend link'} disabled={resent} onPress={async () => { await authApi.forgotPassword(email); setResent(true); showToast('Reset link sent again'); }} /></View>}>
      <Header />
      <View style={{ alignItems: 'center', marginTop: 40 }}><Icon name="mail" size={56} color={p.ac} /></View>
      <T v="h1" center style={{ marginTop: 20 }}>Check your inbox</T>
      <T v="small" center style={{ marginTop: 8 }}>We sent a reset link to {email}. It works for 30 minutes.</T>
    </Screen>
  );
  return (
    <Screen footer={<Button label="Send reset link" busy={busy} onPress={go} />}>
      <Header />
      <T v="h1">Sign in with email</T>
      <T v="small" style={{ marginTop: 6 }}>Forgot your password? Enter your email and we'll send a reset link.</T>
      <Label>Email</Label>
      <Input value={email} onChangeText={t => { setEmail(t.trim()); setErr(''); }} placeholder="you@example.com" autoCapitalize="none" keyboardType="email-address" error={err} style={{ borderColor: err ? p.ne : valid ? p.ac : 'transparent' }} />
    </Screen>
  );
}

/* M1 Profile setup */
export function SetupScreen({ navigation }: ScreenProps) {
  const { showToast } = useApp();
  const [step, setStep] = useState(0); const [name, setName] = useState(''); const [upi, setUpi] = useState(''); const [book, setBook] = useState('');
  const [purpose, setPurpose] = useState('Trip'); const [err, setErr] = useState('');
  const [save, busy] = useMutation(async () => {
    await profileApi.update({ name, upiId: upi || undefined });
    await booksApi.create({ name: book.trim(), purpose: purpose as BookKind });
  });
  const upiOk = /^[\w.-]{2,}@[a-z]{2,}$/i.test(upi);
  const next = async () => {
    if (step === 0) { if (name.trim().length < 2) return setErr(name.trim() ? 'Use at least 2 letters' : 'Enter your name'); setErr(''); return setStep(1); }
    if (step === 1) { if (!upi) return setErr('Enter a UPI ID, or skip for now'); if (!upiOk) return setErr('UPI IDs look like name@bank'); setErr(''); return setStep(2); }
    if (book.trim().length < 2) return setErr('Name your book');
    try { await save(); } catch (e) { return setErr((e as ApiError).message); }
    showToast(`All set, ${name.trim().split(' ')[0]}. ${book.trim()} is ready`);
    navigation.reset({ index: 0, routes: [{ name: 'Spaces', params: { space: 'Home' } }] });
  };
  return (
    <Screen footer={<Button label={step === 2 ? 'Finish' : 'Continue'} busy={busy} onPress={next} />}>
      <Header onBack={() => (step ? setStep(step - 1) : navigation.goBack())} right={<T v="small">{step + 1}/3</T>} />
      <Row gap={6} style={{ marginBottom: 24 }}>{[0, 1, 2].map(i => <View key={i} style={{ flex: 1 }}><Progress pct={i < step ? 100 : i === step ? 50 : 0} /></View>)}</Row>
      {step === 0 && <>
        <T v="h1">What should friends call you?</T><T v="small" style={{ marginTop: 6, marginBottom: 20 }}>Shown on splits and reminders.</T>
        <Input value={name} onChangeText={t => { setName(t.slice(0, 30)); setErr(''); }} placeholder="Your name" error={err} />
      </>}
      {step === 1 && <>
        <T v="h1">Your UPI ID</T><T v="small" style={{ marginTop: 6, marginBottom: 20 }}>So friends can pay you back in one tap.</T>
        <Input value={upi} onChangeText={t => { setUpi(t.replace(/\s/g, '')); setErr(''); }} placeholder="name@okhdfc" autoCapitalize="none" error={err} hint={upiOk ? 'Looks good' : undefined} hintColor="#5EE6B5" />
        <View style={{ marginTop: 14 }}><LinkText c="mu" label="Skip for now" onPress={() => { setUpi(''); setStep(2); }} /></View>
      </>}
      {step === 2 && <>
        <T v="h1">Start your first book</T><T v="small" style={{ marginTop: 6, marginBottom: 20 }}>A book keeps one part of your money together.</T>
        <Input value={book} onChangeText={t => { setBook(t.slice(0, 40)); setErr(''); }} placeholder="e.g. Goa Trip" error={err} />
        <Label>What's it for?</Label>
        <Row style={{ flexWrap: 'wrap' }} gap={8}>{['Trip', 'Household', 'Business', 'Event', 'Personal'].map(n => <Chip key={n} label={n} on={purpose === n} onPress={() => setPurpose(n)} />)}</Row>
      </>}
    </Screen>
  );
}

/* F1 PIN lock */
export function LockScreen({ navigation }: ScreenProps) {
  const p = useColors(); const { showToast, signIn, user: me } = useApp();
  const [pin, setPin] = useState(''); const [bad, setBad] = useState(false); const [tries, setTries] = useState(0);
  const locked = tries >= 5;
  const unlock = () => { navigation.reset({ index: 0, routes: [{ name: 'Spaces', params: { space: 'Home' } }] }); };
  const press = async (k: string) => {
    if (locked) return;
    if (k === 'bio') {
      try {
        const sig = await biometricUnlock();
        if (!sig) { tap('error'); showToast("Couldn't verify. Use your PIN"); return; }
        const r = await authApi.unlockWithBiometrics(sig); signIn(me ?? { id: 'me', name: 'Arjun Kumar', initials: 'AK', phone: '', plan: 'pro' }, r.token); await saveSession(r.token); unlock(); showToast('Fingerprint recognised. Welcome back');
      }
      catch { tap('error'); showToast("Couldn't verify. Use your PIN"); }
      return;
    }
    if (k === 'del') { setPin(x => x.slice(0, -1)); setBad(false); return; }
    const v = (pin + k).slice(0, 4); setPin(v); setBad(false);
    if (v.length === 4) {
      const r = await authApi.verifyPin(v).catch(() => ({ ok: false, triesLeft: 0 }));
      if (r.ok) { unlock(); showToast('Unlocked'); } else { tap('error'); setPin(''); setBad(true); setTries(t => t + 1); }
    }
  };
  return (
    <LinearGradient colors={['#0F2A22', p.bg, p.bg]} style={{ flex: 1 }}>
      <Screen scroll={false} bg="transparent">
        <View style={{ alignItems: 'center', marginTop: 30 }}>
          <Avatar ini="AK" size={64} bg={p.s1} fg={p.tx} ring={p.ac} />
          <T v="h2" style={{ marginTop: 16 }}>Welcome back, Arjun</T>
          <T v="small" c={bad || locked ? 'ne' : 'mu'} style={{ marginTop: 6 }}>{locked ? 'Too many tries. Use fingerprint or sign in with OTP.' : bad ? `Wrong PIN · ${5 - tries} ${5 - tries === 1 ? 'try' : 'tries'} left` : 'Enter your 4-digit PIN · demo 2580'}</T>
          <Replay trigger={bad ? 'b' + tries : ''} name="shake" duration={450}><Row gap={18} style={{ marginTop: 22 }}>{[0, 1, 2, 3].map(i => <View key={i} style={[{ width: 14, height: 14, borderRadius: 7, borderWidth: 1.5, borderColor: bad ? p.ne : i < pin.length ? p.ac : p.mu, backgroundColor: bad ? p.ne : i < pin.length ? p.ac : 'transparent', transform: [{ scale: i < pin.length ? 1.2 : 1 }] }, { transitionProperty: ['transform', 'backgroundColor', 'borderColor'], transitionDuration: 180, transitionTimingFunction: EASE.pop } as any]} />)}</Row></Replay>
        </View>
        <View style={{ flex: 1 }} />
        <View style={{ opacity: locked ? 0.35 : 1 }}><Keypad round keys={['1', '2', '3', '4', '5', '6', '7', '8', '9', 'bio', '0', 'del']} onKey={press} /></View>
        <View style={{ alignItems: 'center', marginVertical: 24 }}><LinkText label="Forgot PIN? Sign in with OTP" onPress={() => navigation.reset({ index: 0, routes: [{ name: 'SignIn' }] })} /></View>
      </Screen>
    </LinearGradient>
  );
}

/* M2/M3 Join invite (E5 handled by Expired screen) */
export function JoinScreen({ navigation, route }: ScreenProps<'Join'>) {
  const p = useColors(); const { showToast } = useApp();
  const code = route.params?.code ?? 'GT-7Q4K';
  const { data, error, loading } = useQuery(() => invitesApi.get(code), [code]);
  const [accept, busy] = useMutation(invitesApi.accept);
  useEffect(() => { if (error?.code === 'INVITE_EXPIRED') navigation.replace('Expired', { code }); }, [error, navigation, code]);
  const inv: Invite | undefined = data ? { ...data, status: route.params?.member ? 'member' : data.status } : undefined;
  if (loading || !inv) return <Screen><Header title="Invitation" /><Loading /></Screen>;
  const member = inv.status === 'member';
  return (
    <Screen footer={<View style={{ gap: 10 }}>
      <Button label={member ? 'Open ' + inv.bookName : 'Join ' + inv.bookName} busy={busy} onPress={async () => {
        if (!member) { await accept(code); showToast(`You're in. Say hi to the ${inv.bookName} crew`); }
        navigation.replace('Book', { id: inv.bookId });
      }} />
      <Button kind="secondary" label="Not now" onPress={() => navigation.navigate('Spaces', { space: 'Home', at: Date.now() })} />
    </View>}>
      <Header title="Invitation" />
      <LinearGradient colors={p.c1 as [string, string]} style={{ borderRadius: 22, padding: 18, minHeight: 150 }}>
        <T v="tiny" c={p.cm}>{inv.invitedBy} invited you to</T>
        <T v="h1" c={p.ct}>{inv.bookName}</T>
        <Row style={{ marginTop: 14 }}><AvatarStack list={inv.members} ring="rgba(255,255,255,.6)" /><T v="small" c={p.cm}>{inv.members.length} people · ₹{inv.spent.toLocaleString('en-IN')} so far</T></Row>
        <T v="tiny" c={p.cm} style={{ marginTop: 10 }}>{inv.dates}</T>
      </LinearGradient>
      {member ? <Card style={{ marginTop: 14 }}><T v="bodyB">You're already in this book</T><T v="small">Open it to see the latest entries.</T></Card> : (
        <Card style={{ marginTop: 14, paddingVertical: 4 }}>
          <KV border={false} k="You join as" v={inv.role} /><KV k="You can" v="Add entries and split bills" /><KV k="They'll see" v="Your name and UPI ID" />
        </Card>
      )}
    </Screen>
  );
}

/* N1 Push permission ask */
export function PushPermissionScreen({ navigation }: ScreenProps) {
  const p = useColors(); const { showToast } = useApp();
  const demo = [['Rahul paid you ₹1,200', 'Goa Trip · via UPI · settled', 'now'], ['Approve ₹2,500?', 'Kabir added Scooter rental', '2m'], ['Reminder: ₹800 to Meera', 'Home & Family · tap to pay', '1h']];
  const allow = async () => {
    const device = await registerPush();
    await notificationsApi.registerDevice(device?.token || 'ExponentPushToken[mock]', device?.platform || 'ios');
    showToast("You're all set. We'll ping you when money moves");
    navigation.replace('NotifPrefs');
  };
  return (
    <Screen footer={<View style={{ gap: 8 }}><Button label="Turn on notifications" onPress={allow} /><T v="tiny" center>You choose what you get. Change it anytime in You → Notifications.</T></View>}>
      <Row between><View /><LinkText c="mu" label="Not now" onPress={() => navigation.navigate('Spaces', { space: 'Home', at: Date.now() })} /></Row>
      <View style={{ marginTop: 20, gap: 8 }}>
        {demo.map(([t, b, w], k) => (
          <Card key={t} style={{ marginLeft: [10, 22, 0][k], marginRight: [30, 12, 0][k], padding: 12, opacity: [0.55, 0.8, 1][k] }}>
            <Row center={false}><Logo size={30} /><View style={{ flex: 1 }}><Row between><T v="kicker">BYJAN</T><T v="tiny">{w}</T></Row><T v="smallB">{t}</T><T v="tiny">{b}</T></View></Row>
          </Card>
        ))}
      </View>
      <T v="h1" style={{ marginTop: 30 }}>Know the moment money moves</T>
      {[['Payments the second they land', 'Received, failed or refunded'], ["Approvals that can't wait", 'Approve from the notification itself'], ['Security alerts, always', 'New sign-ins and PIN changes']].map(([t, s], i) => (
        <Row key={t} gap={12} style={{ marginTop: 16 }}><Icon name={['money', 'checkCircle', 'shield'][i] as any} color={p.ac} /><View><T v="bodyB">{t}</T><T v="small">{s}</T></View></Row>
      ))}
    </Screen>
  );
}

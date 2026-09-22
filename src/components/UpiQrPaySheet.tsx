import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle, BookOpen, Camera, CheckCircle2, ChevronDown, ClipboardPaste, HelpCircle, ImagePlus, Loader2, QrCode, RefreshCw, ShieldCheck, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { CapacitorService, isWeb } from '../lib/capacitor';
import { createExpense } from '../lib/expenses';
import { listLedgers } from '../lib/ledgers';
import { cacheMoneyBooks, lastMoneyBookId, readCachedMoneyBooks, rememberMoneyBook } from './ShareIntentListener';
import { getCurrencySymbol } from '../lib/currency';
import { newMoneyId, toPaise } from '../lib/money-core';
import {
  UPI_APP_PACKAGES,
  UPI_PAY_APPS,
  buildAppUpiUri,
  buildUpiPayUri,
  describeUpiHandle,
  launchUpiPayNative,
  launchUpiUri,
  parseUpiQr,
  type UpiAppId,
  type UpiQrPayload,
} from '../lib/upi';
import { toUserMessage } from '../lib/user-message';
import { UpiBrandMark } from './UpiBrandMark';
import './split-premium.css';

type Book = { id: string; name: string; currency?: string; categories?: string[] };
type Phase = 'scan' | 'details' | 'waiting' | 'unclear' | 'failed' | 'recorded';

type Props = {
  open: boolean;
  /** Preselect a book (e.g. opened from inside a book). */
  bookId?: string;
  /** Skip the scanner and start from a decoded/pasted UPI string (tests, share intents). */
  initialQr?: string;
  onClose: () => void;
  onRecorded?: (entry: { bookId: string; id: string }) => void;
  onToast: (msg: string, kind?: 'success' | 'error' | 'info') => void;
};

const CATEGORY_FALLBACK = ['Food', 'Groceries', 'Transport', 'Shopping', 'Bills', 'Health', 'Entertainment', 'Other'];

async function decodeQrFromImage(dataUrl: string): Promise<string | null> {
  const img = new Image();
  await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = () => rej(new Error('Could not read image')); img.src = dataUrl; });
  const Detector = (window as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => { detect: (s: ImageBitmapSource) => Promise<Array<{ rawValue: string }>> } }).BarcodeDetector;
  if (Detector) {
    try {
      const det = new Detector({ formats: ['qr_code'] });
      const hits = await det.detect(img);
      if (hits[0]?.rawValue) return hits[0].rawValue;
    } catch { /* fall through to jsQR */ }
  }
  const { default: jsQR } = await import('jsqr');
  const scale = Math.min(1, 1200 / Math.max(img.naturalWidth, img.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const hit = jsQR(data.data, data.width, data.height, { inversionAttempts: 'attemptBoth' });
  return hit?.data || null;
}

export default function UpiQrPaySheet({ open, bookId: preferredBookId, initialQr, onClose, onRecorded, onToast }: Props) {
  const { currentUser, userProfile } = useAuth();
  const [phase, setPhase] = useState<Phase>('scan');
  const [qr, setQr] = useState<UpiQrPayload | null>(null);
  const [books, setBooks] = useState<Book[]>(() => readCachedMoneyBooks() as Book[]);
  const [bookId, setBookId] = useState(preferredBookId || lastMoneyBookId() || '');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [category, setCategory] = useState('');
  const [busy, setBusy] = useState(false);
  const [scanError, setScanError] = useState('');
  const [paste, setPaste] = useState('');
  const [showPaste, setShowPaste] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [lastApp, setLastApp] = useState<UpiAppId>('generic');
  const [nativeRef, setNativeRef] = useState('');
  const [recorded, setRecorded] = useState<{ id: string; bookId: string } | null>(null);
  const [cameraLive, setCameraLive] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [zoomMax, setZoomMax] = useState(1);
  const [hardwareZoom, setHardwareZoom] = useState(false);
  const [morePay, setMorePay] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);
  const attemptRef = useRef('');
  const recordedOnce = useRef(false);
  const zoomTrack = useRef<MediaStreamTrack | null>(null);
  const cameraKick = useRef(0);
  const zoomMaxRef = useRef(3);
  const zoomValue = useRef(1);
  const pinchRef = useRef<{ dist: number; zoom: number } | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);

  const book = useMemo(() => books.find((b) => b.id === bookId) || books[0], [books, bookId]);
  const symbol = getCurrencySymbol(String(book?.currency || 'INR'));
  const categories = useMemo(() => {
    const own = Array.isArray(book?.categories) ? book!.categories!.map(String).filter(Boolean) : [];
    return own.length ? own.slice(0, 12) : CATEGORY_FALLBACK;
  }, [book]);

  const stopCamera = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = 0;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    zoomTrack.current = null;
    setCameraLive(false);
    setHardwareZoom(false);
  };

  // Reset when (re)opened
  useEffect(() => {
    if (!open) { stopCamera(); return; }
    recordedOnce.current = false;
    attemptRef.current = '';
    setPhase('scan');
    setQr(null);
    setAmount('');
    setNote('');
    setCategory('');
    setScanError('');
    setPaste('');
    setShowPaste(false);
    setStatusMsg('');
    setNativeRef('');
    setRecorded(null);
    setZoom(1);
    setZoomMax(1);
    setMorePay(false);
    cameraKick.current += 1;
    setBookId(preferredBookId || lastMoneyBookId() || '');
    void listLedgers().then((rows) => {
      const next = rows.filter((b: any) => !b.deleted && !b.archived).map((b: any) => ({ id: String(b.id), name: String(b.name || 'Book'), currency: String(b.currency || 'INR'), categories: Array.isArray(b.categories) ? b.categories.map(String) : [] }));
      if (next.length) { setBooks(next); cacheMoneyBooks(next); }
    }).catch(() => { /* cached list is fine */ });
    if (initialQr) applyDecoded(initialQr);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => () => stopCamera(), []);

  const applyDecoded = (text: string) => {
    const parsed = parseUpiQr(text);
    if (!parsed) {
      setScanError('That code is not a UPI payment QR. Try again or paste the UPI ID.');
      return false;
    }
    stopCamera();
    setQr(parsed);
    setAmount(parsed.am || '');
    setNote(parsed.tn || '');
    setScanError('');
    setPhase('details');
    void CapacitorService.hapticTick();
    return true;
  };

  const startLiveScan = async () => {
    setScanError('');
    if (!navigator.mediaDevices?.getUserMedia) {
      setScanError('Live camera is not available here. Take a photo of the QR instead.');
      return;
    }
    try {
      if (!streamRef.current) {
        if (!isWeb) await CapacitorService.requestCameraPermission();
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
        streamRef.current = stream;
        setCameraLive(true);
        const track = stream.getVideoTracks()[0];
        zoomTrack.current = track || null;
        const caps = track?.getCapabilities?.() as { zoom?: { min?: number; max?: number } } | undefined;
        const maxZoom = Number(caps?.zoom?.max || 1);
        const nextMax = maxZoom > 1 ? Math.min(maxZoom, 6) : 3;
        const start = Number(caps?.zoom?.min || 1);
        zoomMaxRef.current = nextMax;
        zoomValue.current = start;
        setHardwareZoom(Boolean(caps?.zoom && maxZoom > 1));
        setZoom(start);
        setZoomMax(nextMax);
      }
      let video = videoRef.current;
      for (let i = 0; i < 12 && !video; i += 1) {
        await new Promise((resolve) => { requestAnimationFrame(() => resolve(undefined)); });
        video = videoRef.current;
      }
      const stream = streamRef.current;
      if (!video || !stream) {
        setScanError('The camera is ready, but the preview did not appear. Tap try again.');
        return;
      }
      if (video.srcObject !== stream) {
        video.srcObject = stream;
        await video.play();
      }
      if (rafRef.current) return;
      await video.play();
      const { default: jsQR } = await import('jsqr');
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      const Detector = (window as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => { detect: (s: ImageBitmapSource) => Promise<Array<{ rawValue: string }>> } }).BarcodeDetector;
      const det = Detector ? new Detector({ formats: ['qr_code'] }) : null;
      let lastTick = 0;
      let detBusy = false;
      const tick = async (now: number) => {
        if (!streamRef.current) return;
        if (now - lastTick > 140 && video.readyState >= 2 && ctx) {
          lastTick = now;
          const w = video.videoWidth; const h = video.videoHeight;
          if (w && h) {
            if (det && !detBusy) {
              detBusy = true;
              det.detect(video).then((hits) => { if (hits[0]?.rawValue) applyDecoded(hits[0].rawValue); }).catch(() => { /* ignore */ }).finally(() => { detBusy = false; });
            } else if (!det) {
              const scale = Math.min(1, 640 / Math.max(w, h));
              canvas.width = Math.round(w * scale); canvas.height = Math.round(h * scale);
              ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
              const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
              const hit = jsQR(data.data, data.width, data.height, { inversionAttempts: 'dontInvert' });
              if (hit?.data && applyDecoded(hit.data)) return;
            }
          }
        }
        rafRef.current = requestAnimationFrame((t) => { void tick(t); });
      };
      rafRef.current = requestAnimationFrame((t) => { void tick(t); });
      requestAnimationFrame(() => document.querySelector('.uq-root .sp-body')?.scrollTo(0, 0));
    } catch (err) {
      stopCamera();
      const msg = err instanceof Error ? err.message : '';
      setScanError(/denied|permission|NotAllowed/i.test(msg) ? 'Camera permission was not granted. Use gallery or paste the UPI ID.' : 'Could not start the camera. Use gallery or paste the UPI ID.');
    }
  };

  // Camera opens with the scanner. Gallery and paste stay as backups.
  useEffect(() => {
    if (!open || phase !== 'scan' || initialQr) return;
    const id = window.setTimeout(() => { void startLiveScan(); }, 40);
    return () => window.clearTimeout(id);
    // startLiveScan is stable enough for open/phase; cameraKick retries after rescan.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, phase, initialQr]);

  const setCameraZoom = (value: number) => {
    const next = Math.min(zoomMaxRef.current || zoomMax, Math.max(1, value));
    zoomValue.current = next;
    setZoom(next);
    const track = zoomTrack.current;
    const caps = track?.getCapabilities?.() as { zoom?: { max?: number } } | undefined;
    if (track && caps?.zoom && typeof track.applyConstraints === 'function') {
      void track.applyConstraints({ advanced: [{ zoom: next } as MediaTrackConstraintSet] }).catch(() => { /* visual zoom still applies */ });
    }
  };

  useEffect(() => {
    const el = viewportRef.current;
    if (!el || !cameraLive) return;
    const distance = (touches: TouchList) => Math.hypot(touches[0].clientX - touches[1].clientX, touches[0].clientY - touches[1].clientY);
    const onStart = (event: TouchEvent) => {
      if (event.touches.length === 2) pinchRef.current = { dist: distance(event.touches), zoom: zoomValue.current };
    };
    const onMove = (event: TouchEvent) => {
      const pinch = pinchRef.current;
      if (event.touches.length !== 2 || !pinch?.dist) return;
      event.preventDefault();
      setCameraZoom(pinch.zoom * (distance(event.touches) / pinch.dist));
    };
    const onEnd = (event: TouchEvent) => {
      if (event.touches.length < 2) pinchRef.current = null;
    };
    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchmove', onMove, { passive: false });
    el.addEventListener('touchend', onEnd);
    el.addEventListener('touchcancel', onEnd);
    return () => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchmove', onMove);
      el.removeEventListener('touchend', onEnd);
      el.removeEventListener('touchcancel', onEnd);
    };
  }, [cameraLive]);

  const scanFromPhoto = async () => {
    setScanError('');
    setBusy(true);
    try {
      if (!isWeb) await CapacitorService.requestCameraPermission();
      const shots = await CapacitorService.captureScanReceipts({ limit: 2, quality: 90 });
      const shot = shots[0];
      if (!shot?.imageDataUrl) return;
      const text = await decodeQrFromImage(shot.imageDataUrl);
      if (!text) { setScanError('No QR code found in that photo. Hold steady and fill the frame with the QR.'); return; }
      applyDecoded(text);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (!/cancel/i.test(msg)) setScanError(toUserMessage(err, 'Could not read the photo.'));
    } finally {
      setBusy(false);
    }
  };

  const pickFromGallery = async (file: File | null) => {
    if (!file) return;
    setBusy(true);
    setScanError('');
    try {
      const dataUrl = await new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = () => rej(new Error('read failed')); r.readAsDataURL(file); });
      const text = await decodeQrFromImage(dataUrl);
      if (!text) { setScanError('No QR code found in that image.'); return; }
      applyDecoded(text);
    } catch (err) {
      setScanError(toUserMessage(err, 'Could not read the image.'));
    } finally {
      setBusy(false);
    }
  };

  /** Creates exactly one entry per payment attempt (idempotency key = attempt id). */
  const recordEntry = async (outcome: 'success' | 'unverified', ref?: string) => {
    if (recordedOnce.current || !qr || !book || !currentUser) return;
    recordedOnce.current = true;
    setBusy(true);
    try {
      const amt = Number(amount || 0);
      const payee = qr.pn || qr.pa;
      const finalCategory = category || 'Other';
      const description = note.trim() || `Paid ${payee}`;
      const today = new Date();
      const day = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      const key = `upiqr:${attemptRef.current || newMoneyId('upiqr')}`;
      const payload = {
        amount: amt,
        amountPaise: toPaise(amt),
        description,
        category: finalCategory,
        entryType: 'out',
        txType: 'EXPENSE',
        date: day,
        paidAt: day,
        merchant: payee,
        paymentMethod: 'upi',
        accountId: 'upi',
        notes: [ref ? `UPI ref ${ref}` : '', `Paid to ${qr.pa}`, outcome === 'unverified' ? 'Payment result not read automatically — confirmed by you' : ''].filter(Boolean).join(' · '),
        tags: 'upi-qr',
        evidenceReasons: ['Source: UPI QR scan', `Payee ${qr.pa}`, outcome === 'success' ? 'UPI app returned SUCCESS' : 'Marked paid by you'],
        captureSource: 'upi_qr',
        upiPayee: qr.pa,
        upiReference: ref || undefined,
        financialStatus: outcome === 'success' ? 'CONFIRMED' : 'DRAFT',
        processingStatus: 'COMPLETED',
        status: outcome === 'success' ? 'recorded' : 'draft',
        paidByName: userProfile?.displayName || currentUser.email,
        enteredBy: userProfile?.displayName || currentUser.email,
        enteredByUid: currentUser.uid,
        enteredByEmail: currentUser.email || '',
        idempotencyKey: key,
      };
      const created = await createExpense(book.id, payload, { idempotencyKey: key });
      rememberMoneyBook(book.id);
      setRecorded({ id: String(created?.id || ''), bookId: book.id });
      setPhase('recorded');
      onRecorded?.({ bookId: book.id, id: String(created?.id || '') });
      onToast(outcome === 'success' ? 'Paid and recorded' : 'Recorded — marked for review', outcome === 'success' ? 'success' : 'info');
    } catch (err) {
      recordedOnce.current = false;
      onToast(toUserMessage(err, 'Paid, but could not save the entry. Add it manually.'), 'error');
      setPhase('unclear');
      setStatusMsg('Payment may have gone through, but saving the entry failed. Try "Record it" again.');
    } finally {
      setBusy(false);
    }
  };

  const pay = async (app: UpiAppId) => {
    if (!qr || !book) return;
    const amt = Number(amount || 0);
    if (!(amt > 0)) { onToast('Enter the amount to pay', 'error'); return; }
    if (qr.am && Number(qr.am) !== amt) { onToast('This QR has a fixed amount', 'error'); setAmount(qr.am); return; }
    setBusy(true);
    setLastApp(app);
    setStatusMsg('');
    attemptRef.current = newMoneyId('upiqr');
    const params = { pa: qr.pa, pn: qr.pn || 'Merchant', am: amt.toFixed(2), cu: qr.cu || 'INR', tn: (note || qr.tn || 'Byjan payment').slice(0, 80), tr: qr.tr || attemptRef.current.slice(0, 35) };
    let uri = '';
    try { uri = app === 'generic' ? buildUpiPayUri(params) : buildAppUpiUri(app, params); } catch (err) { setBusy(false); onToast(toUserMessage(err, 'Invalid UPI details'), 'error'); return; }
    setPhase('waiting');
    try {
      const pkg = UPI_APP_PACKAGES[app];
      let native = await launchUpiPayNative(uri, pkg);
      if (native?.status === 'NO_UPI_APP' && app !== 'generic') native = await launchUpiPayNative(buildUpiPayUri(params), pkg);
      if (native?.status === 'NO_UPI_APP') native = await launchUpiPayNative(buildUpiPayUri(params));
      if (native && native.status !== 'NO_UPI_APP') {
        const ref = native.approvalRefNo || native.txnId || native.txnRef || '';
        setNativeRef(ref);
        if (native.outcome === 'success') { await recordEntry('success', ref); return; }
        if (native.outcome === 'failed' || native.outcome === 'cancelled') {
          setPhase('failed');
          setStatusMsg(native.outcome === 'cancelled' ? 'You cancelled in the UPI app. Nothing was recorded.' : (native.message || 'The UPI app reported a failure. Nothing was recorded.'));
          return;
        }
        setPhase('unclear');
        setStatusMsg(native.outcome === 'submitted' ? 'The UPI app says the payment was submitted but not yet confirmed.' : 'The UPI app did not return a clear result.');
        return;
      }
      if (native?.status === 'NO_UPI_APP') {
        setPhase('failed');
        setStatusMsg('No UPI app found on this phone. Install PhonePe, Google Pay, Paytm or BHIM and try again.');
        return;
      }
      // Web / no native bridge: open the link, result cannot be read back.
      const launched = await launchUpiUri(uri);
      if (!launched.opened) { setPhase('failed'); setStatusMsg(launched.error || 'Could not open a UPI app.'); return; }
      setPhase('unclear');
      setStatusMsg('Finish the payment in your UPI app, then tell us what happened.');
    } catch (err) {
      setPhase('failed');
      setStatusMsg(toUserMessage(err, 'Could not start the payment.'));
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;
  const handleLabel = qr ? describeUpiHandle(qr.pa) : null;
  const amountLocked = Boolean(qr?.am);

  return createPortal(
    <div className="sp-root uq-root" role="dialog" aria-modal="true" aria-label="Scan and pay" data-testid="upi-qr-sheet" data-phase={phase}>
      <button type="button" className="sp-dim" aria-label="Close" onClick={() => { stopCamera(); onClose(); }} />
      <div className="sp-sheet">
        <div className="sp-handle" aria-hidden />
        <header className="sp-head">
          <div>
            <p className="sp-kicker">{phase === 'scan' ? 'Pay someone' : phase === 'recorded' ? 'Done' : 'Pay by UPI'}</p>
            <h2 className="sp-title">
              {phase === 'scan' ? 'Pay a UPI QR' : phase === 'recorded' ? 'Paid & recorded' : phase === 'failed' ? 'Payment did not go through' : phase === 'unclear' ? 'Did the payment go through?' : phase === 'waiting' ? 'Waiting for your UPI app…' : `Pay ${qr?.pn || qr?.pa || ''}`}
            </h2>
            {phase === 'scan' ? <p className="uq-lead">Scan the code, upload a photo, or paste a UPI ID. You pay in your own UPI app.</p> : null}
          </div>
          <button type="button" className="sp-close" onClick={() => { stopCamera(); onClose(); }} aria-label="Close"><X className="w-4 h-4" /></button>
        </header>

        <div className="sp-body">
          {phase === 'scan' ? (
            <>
              <div ref={viewportRef} className={`uq-viewport${cameraLive ? ' is-live' : ''}`} data-testid="upi-qr-viewport">
                <video ref={videoRef} className="uq-video" playsInline muted autoPlay style={!hardwareZoom && zoom > 1 ? { transform: `scale(${zoom})` } : undefined} />
                {!cameraLive ? (
                  <div className="uq-viewport-idle">
                    <QrCode className="w-10 h-10" />
                    <p>{scanError || 'Opening the camera… point it at the UPI QR.'}</p>
                    <button type="button" className="sp-cta" data-testid="upi-qr-start" onClick={() => { cameraKick.current += 1; void startLiveScan(); }}><Camera className="w-4 h-4" /> Try camera again</button>
                  </div>
                ) : (
                  <>
                    <div className="uq-frame" aria-hidden><i /><i /><i /><i /><span className="uq-laser" /></div>
                    <div className="uq-zoom" data-testid="upi-qr-zoom">
                      <p className="uq-pinch">Pinch with two fingers</p>
                      <div className="uq-zoom-row">
                        <button type="button" aria-label="Zoom out" onClick={() => setCameraZoom(zoom - 0.25)}>−</button>
                        <input type="range" min={1} max={zoomMax} step={0.05} value={zoom} aria-label="Camera zoom" onChange={(e) => setCameraZoom(Number(e.target.value))} />
                        <button type="button" aria-label="Zoom in" onClick={() => setCameraZoom(zoom + 0.25)}>+</button>
                        <span className="uq-zoom-read">{zoom.toFixed(1)}×</span>
                      </div>
                    </div>
                  </>
                )}
              </div>
              {scanError && cameraLive ? <p className="sp-error" role="alert">{scanError}</p> : null}
              <div className="uq-dock">
                <div className="uq-alt">
                  <label className="uq-dock-btn uq-file">
                    <ImagePlus className="w-4 h-4" />
                    <span>Upload photo</span>
                    <input type="file" accept="image/*" hidden onChange={(e) => { void pickFromGallery(e.target.files?.[0] || null); e.currentTarget.value = ''; }} />
                  </label>
                  <button type="button" className="uq-dock-btn" data-testid="upi-qr-paste-toggle" onClick={() => setShowPaste((v) => !v)}>
                    <ClipboardPaste className="w-4 h-4" />
                    <span>Paste UPI ID</span>
                  </button>
                </div>
                {showPaste ? (
                  <form className="uq-paste" onSubmit={(e) => { e.preventDefault(); applyDecoded(paste); }}>
                    <input value={paste} onChange={(e) => setPaste(e.target.value)} placeholder="name@okbank or upi://pay?pa=…" autoCapitalize="none" autoCorrect="off" data-testid="upi-qr-paste" />
                    <button type="submit" className="sp-cta" data-testid="upi-qr-paste-go">Continue</button>
                  </form>
                ) : null}
                <p className="uq-safe"><ShieldCheck className="w-3.5 h-3.5" /> Byjan never sees your UPI PIN.</p>
              </div>
            </>
          ) : null}

          {phase === 'details' && qr ? (
            <>
              <div className="uq-payee" data-testid="upi-qr-payee">
                <span className="uq-payee-avatar">{(qr.pn || qr.pa).slice(0, 1).toUpperCase()}</span>
                <div className="min-w-0">
                  <p className="uq-payee-name">{qr.pn || 'UPI merchant'}</p>
                  <p className="uq-payee-vpa">{qr.pa}{handleLabel ? ` · ${handleLabel}` : ''}</p>
                </div>
                <button type="button" className="uq-rescan" onClick={() => { cameraKick.current += 1; setQr(null); setMorePay(false); setPhase('scan'); }} aria-label="Scan a different code"><RefreshCw className="w-3.5 h-3.5" /></button>
              </div>
              <label className={`uq-amount${amountLocked ? ' is-locked' : ''}`}>
                <span className="uq-amount-ccy">{symbol}</span>
                <input type="number" inputMode="decimal" step="0.01" min="1" value={amount} readOnly={amountLocked} onChange={(e) => setAmount(e.target.value)} placeholder="0" autoFocus={!amountLocked} aria-label="Amount" data-testid="upi-qr-amount" />
                <span className="uq-amount-hint">{amountLocked ? 'Amount is on the QR' : 'Amount'}</span>
              </label>
              <label className="uq-field uq-note">
                <input value={note} onChange={(e) => setNote(e.target.value)} placeholder={qr.tn || 'Note (optional) — chai, auto, rent'} maxLength={80} data-testid="upi-qr-note" aria-label="Note" />
              </label>
              <button type="button" className="uq-more" aria-expanded={morePay} onClick={() => setMorePay((v) => !v)}>
                {morePay ? 'Hide book' : `Saving in ${book?.name || 'your book'}`}
              </button>
              {morePay ? (
                <div className="uq-row">
                  <label className="uq-field">
                    <span><BookOpen className="w-3 h-3" /> Book</span>
                    <div className="uq-select">
                      <select value={book?.id || ''} onChange={(e) => setBookId(e.target.value)} data-testid="upi-qr-book">
                        {books.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                      </select>
                      <ChevronDown className="w-4 h-4" />
                    </div>
                  </label>
                  <label className="uq-field">
                    <span>Category</span>
                    <div className="uq-select">
                      <select value={category} onChange={(e) => setCategory(e.target.value)} data-testid="upi-qr-category">
                        <option value="">Other</option>
                        {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                      <ChevronDown className="w-4 h-4" />
                    </div>
                  </label>
                </div>
              ) : null}
              {!books.length ? <p className="sp-error">Create a money book first so the payment can be recorded.</p> : null}
              <p className="sp-kicker" style={{ margin: '8px 0 6px' }}>Pay with</p>
              <div className="sp-partners" data-testid="upi-qr-apps">
                {UPI_PAY_APPS.map((app) => (
                  <button key={app.id} type="button" className="sp-partner" disabled={busy || !books.length} aria-label={`Pay with ${app.label}`} data-app={app.id} onClick={() => void pay(app.id)}>
                    <span className="sp-partner-mark"><UpiBrandMark app={app.id} size={40} /></span>
                    {app.label}
                  </button>
                ))}
              </div>
              <p className="uq-safe"><ShieldCheck className="w-3.5 h-3.5" /> The entry is saved only after your UPI app confirms success.</p>
            </>
          ) : null}

          {phase === 'waiting' ? (
            <div className="uq-state">
              <Loader2 className="w-8 h-8 animate-spin" />
              <p className="uq-state-title">Complete the payment in your UPI app</p>
              <p className="uq-state-sub">Byjan reads success or failure when you come back. Nothing is recorded yet.</p>
            </div>
          ) : null}

          {phase === 'unclear' ? (
            <div className="uq-state is-unclear" role="status">
              <HelpCircle className="w-8 h-8" />
              <p className="uq-state-title">{statusMsg || 'No clear result from the UPI app'}</p>
              <p className="uq-state-sub">Check your UPI app. If the money left your account, record it now; otherwise retry or close.</p>
              <div className="sp-footer">
                <button type="button" className="sp-cta" disabled={busy} data-testid="upi-qr-record" onClick={() => void recordEntry('unverified', nativeRef)}>
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} I paid — record it
                </button>
                <button type="button" className="sp-select-all" disabled={busy} onClick={() => void pay(lastApp)}><RefreshCw className="w-3.5 h-3.5" /> Retry payment</button>
                <button type="button" className="sp-select-all" disabled={busy} onClick={() => { setPhase('failed'); setStatusMsg('Marked as not paid. Nothing was recorded.'); }}>It didn't go through</button>
              </div>
            </div>
          ) : null}

          {phase === 'failed' ? (
            <div className="sp-fail-card" role="alert">
              <div className="sp-fail-icon"><AlertCircle className="w-6 h-6" /></div>
              <p className="sp-fail-title">Nothing was recorded</p>
              <p className="sp-fail-detail">{statusMsg || 'The UPI app reported a failure or cancel.'}</p>
              <div className="sp-footer" style={{ marginTop: 14 }}>
                <button type="button" className="sp-cta" disabled={busy} onClick={() => void pay(lastApp)}><RefreshCw className="w-4 h-4" /> Retry</button>
                <button type="button" className="sp-select-all" disabled={busy} onClick={() => setPhase('details')}>Choose another app</button>
                <button type="button" className="sp-select-all" onClick={() => { stopCamera(); onClose(); }}>Close</button>
              </div>
            </div>
          ) : null}

          {phase === 'recorded' && qr ? (
            <div className="sp-done" data-testid="upi-qr-done">
              <CheckCircle2 className="w-10 h-10" />
              <p className="sp-done-title">{symbol}{Number(amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })} to {qr.pn || qr.pa}</p>
              <p className="sp-done-sub">Saved in {book?.name || 'your book'}{nativeRef ? ` · ref ${nativeRef}` : ''}{recorded && !nativeRef ? ' · marked for review' : ''}</p>
              <button type="button" className="sp-cta" onClick={() => { stopCamera(); onClose(); }}>Done</button>
            </div>
          ) : null}
        </div>
      </div>
    </div>,
    document.body,
  );
}

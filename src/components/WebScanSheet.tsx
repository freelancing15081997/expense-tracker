import React, { useEffect, useRef, useState } from 'react';
import { Camera, ImagePlus, X } from 'lucide-react';

export type WebScanFile = {
  imageDataUrl: string;
  fileName: string;
  mimeType: string;
};

function readFile(file: File): Promise<WebScanFile> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({
      imageDataUrl: String(reader.result || ''),
      fileName: file.name || `receipt-${Date.now()}`,
      mimeType: file.type || 'application/octet-stream',
    });
    reader.onerror = () => reject(new Error('Could not read that file'));
    reader.readAsDataURL(file);
  });
}

export default function WebScanSheet({
  open,
  onClose,
  onCaptured,
}: {
  open: boolean;
  onClose: () => void;
  onCaptured: (files: WebScanFile[]) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [camError, setCamError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    setCamError('');
    setBusy(false);
    const start = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCamError('This browser cannot open the camera. Upload a photo instead.');
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1600 }, height: { ideal: 1600 } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          await video.play().catch(() => undefined);
        }
      } catch {
        if (!cancelled) setCamError('Camera permission was denied. Upload a receipt photo or PDF instead.');
      }
    };
    void start();
    const fallback = window.setTimeout(() => {
      const video = videoRef.current;
      if (video && video.readyState < 2) {
        setCamError((prev) => prev || 'Camera is not available here. Upload a receipt photo or PDF instead.');
      }
    }, 2800);
    return () => {
      cancelled = true;
      window.clearTimeout(fallback);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      const video = videoRef.current;
      if (video) video.srcObject = null;
    };
  }, [open]);

  if (!open) return null;

  const snap = () => {
    const video = videoRef.current;
    if (!video || video.readyState < 2) {
      setCamError('Camera is still starting. Try again in a moment, or upload a file.');
      return;
    }
    const w = video.videoWidth || 1280;
    const h = video.videoHeight || 720;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, w, h);
    const imageDataUrl = canvas.toDataURL('image/jpeg', 0.88);
    onCaptured([{ imageDataUrl, fileName: `receipt-${Date.now()}.jpg`, mimeType: 'image/jpeg' }]);
  };

  const onFiles = async (list: FileList | null) => {
    const files = Array.from(list || []).slice(0, 24);
    if (!files.length) return;
    setBusy(true);
    try {
      const rows = await Promise.all(files.map(readFile));
      onCaptured(rows.filter((r) => r.imageDataUrl));
    } catch (err) {
      setCamError(err instanceof Error ? err.message : 'Could not read those files');
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[140] flex items-end sm:items-center justify-center">
      <button type="button" className="absolute inset-0 bg-[#07152a]/55" aria-label="Close" onClick={onClose} />
      <div className="relative w-full sm:max-w-lg max-h-[92dvh] overflow-hidden rounded-t-[28px] sm:rounded-[28px] bg-white shadow-[0_-24px_80px_-20px_rgba(11,31,58,0.45)]">
        <div className="flex items-start justify-between gap-3 px-5 pt-4 pb-3 border-b border-slate-100">
          <div>
            <h2 className="font-display text-[20px] font-semibold tracking-[-0.03em] text-[#0B1F3A]">Scan a receipt</h2>
            <p className="text-[13px] text-slate-500 mt-0.5">Snap a photo or upload an image / PDF. Byjan will read the amount.</p>
          </div>
          <button type="button" onClick={onClose} className="w-9 h-9 rounded-xl border border-slate-200 text-slate-400 inline-flex items-center justify-center" aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-5 py-4 space-y-3">
          <div className="relative overflow-hidden rounded-2xl bg-[#0B1F3A] aspect-[4/3]">
            <video ref={videoRef} className="absolute inset-0 h-full w-full object-cover" playsInline muted autoPlay />
            {camError ? (
              <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-[13px] text-white/90 bg-[#0B1F3A]">
                {camError}
              </div>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="byjan-btn flex-1 !h-11" onClick={snap} disabled={Boolean(camError) || busy}>
              <Camera className="w-4 h-4" /> Snap
            </button>
            <button type="button" className="byjan-btn-ghost flex-1 !h-11" onClick={() => fileRef.current?.click()} disabled={busy}>
              <ImagePlus className="w-4 h-4" /> Upload
            </button>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*,application/pdf,.pdf,.csv,.xlsx,.xls"
            multiple
            className="absolute w-px h-px opacity-0 overflow-hidden"
            tabIndex={-1}
            onChange={(e) => { void onFiles(e.target.files); e.target.value = ''; }}
          />
        </div>
      </div>
    </div>
  );
}

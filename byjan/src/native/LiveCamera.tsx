import React, { useEffect, useImperativeHandle, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

/** Live preview behind the existing scan frame. Renders nothing when the camera module is unavailable (web). */
export const LiveCamera = React.forwardRef(function LiveCamera({ torch, onBarCode, style }: { torch?: boolean; onBarCode?: (data: string) => void; style?: object }, ref: React.Ref<{ takePictureAsync: () => Promise<{ uri?: string } | undefined> }>) {
  const [Cam, setCam] = useState<any>(null);
  const inner = useRef<any>(null);
  useImperativeHandle(ref, () => ({ takePictureAsync: () => inner.current?.takePictureAsync?.({ quality: 0.7 }) }));
  useEffect(() => {
    let stop = false;
    import('expo-camera').then((mod: { CameraView: unknown }) => { if (!stop) setCam(() => mod.CameraView); }).catch(() => {});
    return () => { stop = true; };
  }, []);
  if (!Cam) return <View style={style} />;
  return (
    <Cam
      ref={inner}
      style={[StyleSheet.absoluteFill, style]}
      facing="back"
      enableTorch={!!torch}
      barcodeScannerSettings={onBarCode ? { barcodeTypes: ['qr'] } : undefined}
      onBarcodeScanned={onBarCode ? ({ data }: { data: string }) => onBarCode(data) : undefined}
    />
  );
});

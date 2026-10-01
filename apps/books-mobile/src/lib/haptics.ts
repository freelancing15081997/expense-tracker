import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { isNative } from './api';

export const tap = () => { if (isNative()) void Haptics.impact({ style: ImpactStyle.Light }).catch(() => undefined); };
export const thud = () => { if (isNative()) void Haptics.impact({ style: ImpactStyle.Medium }).catch(() => undefined); };
export const success = () => { if (isNative()) void Haptics.notification({ type: NotificationType.Success }).catch(() => undefined); };
export const warn = () => { if (isNative()) void Haptics.notification({ type: NotificationType.Warning }).catch(() => undefined); };
export const fail = () => { if (isNative()) void Haptics.notification({ type: NotificationType.Error }).catch(() => undefined); };
export const tick = () => { if (isNative()) void Haptics.selectionChanged().catch(() => undefined); };

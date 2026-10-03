import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { palettes, Palette, ThemeName } from '../theme/tokens';
import { setAuthToken, setSimulateFailure } from '../api/client';
import type { User } from '../api/types';

type Toast = { msg: string; undo?: () => void; key: number } | null;

type AppState = {
  theme: ThemeName;
  c: Palette;
  setTheme: (t: ThemeName) => void;
  toast: Toast;
  showToast: (msg: string, undo?: () => void) => void;
  hideToast: () => void;
  user: User | null;
  signIn: (user: User, token: string) => void;
  signOut: () => void;
  /** Dev switch: make every API call fail so error states can be previewed. */
  failMode: boolean;
  setFailMode: (v: boolean) => void;
  masked: boolean;
  setMasked: (v: boolean) => void;
};

const Ctx = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<ThemeName>('dark');
  const [toast, setToast] = useState<Toast>(null);
  const [user, setUser] = useState<User | null>(null);
  const [failMode, setFail] = useState(false);
  const [masked, setMasked] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const showToast = useCallback((msg: string, undo?: () => void) => {
    clearTimeout(timer.current);
    setToast({ msg, undo, key: Date.now() });
    timer.current = setTimeout(() => setToast(null), 2800);
  }, []);
  const hideToast = useCallback(() => setToast(null), []);

  const value = useMemo<AppState>(() => ({
    theme, c: palettes[theme], setTheme, toast, showToast, hideToast,
    user,
    signIn: (u, token) => { setAuthToken(token); setUser(u); },
    signOut: () => { setAuthToken(null); setUser(null); },
    failMode, setFailMode: v => { setSimulateFailure(v); setFail(v); },
    masked, setMasked,
  }), [theme, toast, user, failMode, masked, showToast, hideToast]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useApp outside AppProvider');
  return v;
}
export const useColors = () => useApp().c;

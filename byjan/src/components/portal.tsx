/** Tiny portal so sheets/overlays render above the navigator but inside the app frame (Modal escapes it on web). */
import React, { useEffect, useId, useSyncExternalStore } from 'react';
import { View } from 'react-native';

type Node = { key: string; el: React.ReactNode };
let nodes: Node[] = [];
const subs = new Set<() => void>();
const emit = () => subs.forEach(f => f());
const store = {
  subscribe: (f: () => void) => { subs.add(f); return () => { subs.delete(f); }; },
  get: () => nodes,
  set: (key: string, el: React.ReactNode | null) => {
    const i = nodes.findIndex(n => n.key === key);
    if (el === null) { if (i >= 0) { nodes = nodes.filter(n => n.key !== key); emit(); } return; }
    nodes = i >= 0 ? nodes.map(n => (n.key === key ? { key, el } : n)) : [...nodes, { key, el }];
    emit();
  },
};

export function PortalHost() {
  const list = useSyncExternalStore(store.subscribe, store.get, store.get);
  return <View pointerEvents="box-none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>{list.map(n => <React.Fragment key={n.key}>{n.el}</React.Fragment>)}</View>;
}

/** Renders `children` into the PortalHost while mounted. */
export function Portal({ children }: { children: React.ReactNode }) {
  const key = useId();
  useEffect(() => { store.set(key, children); });
  useEffect(() => () => store.set(key, null), [key]);
  return null;
}

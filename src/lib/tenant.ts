import { useEffect, useState } from 'react';
import { doc, getDoc } from './store';
import { db } from './firebase';
import { useAuth } from '../context/AuthContext';
import { BOOKS_WORKSPACE_EVENT, ownsWorkspace, readActiveWorkspace } from '../books/core/hierarchy';

export type BooksTenantMeta = {
  id: string;
  name: string;
  ownerId: string;
  memberCount: number;
};

/** Books root tenant is the signed-in user. Nested companies stay under that account. */
export function useBooksTenantMeta() {
  const { currentUser } = useAuth();
  const [tenant, setTenant] = useState<BooksTenantMeta | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const onSwitch = () => setTick((value) => value + 1);
    window.addEventListener(BOOKS_WORKSPACE_EVENT, onSwitch);
    return () => window.removeEventListener(BOOKS_WORKSPACE_EVENT, onSwitch);
  }, []);

  useEffect(() => {
    if (!currentUser) {
      setTenant(null);
      return;
    }
    const uid = currentUser.uid;
    const workspaceId = readActiveWorkspace(uid);
    const id = ownsWorkspace(uid, workspaceId) ? workspaceId : uid;
    getDoc(doc(db, 'erp_workspaces', id, 'meta', 'tenant'))
      .then((snap) => {
        if (!snap.exists()) {
          setTenant({ id, name: 'Books workspace', ownerId: uid, memberCount: 1 });
          return;
        }
        const data = snap.data();
        const memberIds = Array.isArray(data.memberIds) ? data.memberIds : [uid];
        setTenant({
          id,
          name: String(data.name || 'Books workspace'),
          ownerId: String(data.ownerId || uid),
          memberCount: memberIds.length,
        });
      })
      .catch(() => {
        setTenant({ id, name: 'Books workspace', ownerId: uid, memberCount: 1 });
      });
  }, [currentUser?.uid, tick]);

  return tenant;
}

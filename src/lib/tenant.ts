import { useEffect, useState } from 'react';
import { doc, getDoc } from './store';
import { db } from './firebase';
import { useAuth } from '../context/AuthContext';

export type BooksTenantMeta = {
  id: string;
  name: string;
  ownerId: string;
  memberCount: number;
};

/** Books tenant id is the signed-in user id (SET model — not a second tenancy system). */
export function useBooksTenantMeta() {
  const { currentUser } = useAuth();
  const [tenant, setTenant] = useState<BooksTenantMeta | null>(null);

  useEffect(() => {
    if (!currentUser) {
      setTenant(null);
      return;
    }
    const uid = currentUser.uid;
    getDoc(doc(db, 'erp_workspaces', uid, 'meta', 'tenant'))
      .then((snap) => {
        if (!snap.exists()) {
          setTenant({ id: uid, name: 'Books workspace', ownerId: uid, memberCount: 1 });
          return;
        }
        const data = snap.data();
        const memberIds = Array.isArray(data.memberIds) ? data.memberIds : [uid];
        setTenant({
          id: uid,
          name: String(data.name || 'Books workspace'),
          ownerId: String(data.ownerId || uid),
          memberCount: memberIds.length,
        });
      })
      .catch(() => {
        setTenant({ id: uid, name: 'Books workspace', ownerId: uid, memberCount: 1 });
      });
  }, [currentUser?.uid]);

  return tenant;
}

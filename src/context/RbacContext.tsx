import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from './AuthContext';
import {
  fetchRbacSession,
  hasAnyPermission,
  hasPermission,
  type RbacSession,
} from '../lib/rbac';
import { requiredPermissionForPath } from '../lib/rbac-catalog';

type RbacContextValue = {
  session: RbacSession | null;
  loading: boolean;
  error: string;
  refresh: () => Promise<void>;
  can: (permissionId: string) => boolean;
  canAny: (permissionIds: string[]) => boolean;
  canAccessPath: (pathname: string) => boolean;
};

const RbacContext = createContext<RbacContextValue>({
  session: null,
  loading: true,
  error: '',
  refresh: async () => undefined,
  can: () => false,
  canAny: () => false,
  canAccessPath: () => true,
});

export function useRbac() {
  return useContext(RbacContext);
}

export function RbacProvider({ children }: { children: React.ReactNode }) {
  const { currentUser, userProfile } = useAuth();
  const [session, setSession] = useState<RbacSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    if (!currentUser) {
      setSession(null);
      setError('');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const next = await fetchRbacSession(userProfile?.displayName || currentUser.displayName || '');
      setSession(next);
    } catch (err: any) {
      setSession(null);
      setError(err?.message || 'Could not load access permissions');
    } finally {
      setLoading(false);
    }
  }, [currentUser, userProfile?.displayName]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo<RbacContextValue>(() => {
    const permissions = session?.permissions || [];
    return {
      session,
      loading,
      error,
      refresh,
      can: (permissionId) => hasPermission(permissions, permissionId),
      canAny: (permissionIds) => hasAnyPermission(permissions, permissionIds),
      canAccessPath: (pathname) => {
        if (!session) return false;
        const needed = requiredPermissionForPath(pathname);
        if (!needed?.length) return true;
        return hasAnyPermission(permissions, needed);
      },
    };
  }, [session, loading, error, refresh]);

  return <RbacContext.Provider value={value}>{children}</RbacContext.Provider>;
}

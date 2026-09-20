import React from 'react';
import { Navigate } from 'react-router-dom';
import { type FeatureKey } from '../lib/features';
import { useFeatures } from '../lib/use-features';
import { useAuth } from '../context/AuthContext';
import { emailIsSuperUser } from '../lib/super-users';

export default function FeatureGate({ feature, children }: { feature: FeatureKey; children: React.ReactNode }) {
  const { map, on } = useFeatures();
  // Wait for /api/me effective features — do not bounce to home before profile loads.
  if (!map) return null;
  if (!on(feature)) return <Navigate to="/" replace />;
  return <>{children}</>;
}

export function SuperUserGate({ children }: { children: React.ReactNode }) {
  const { currentUser, userProfile, isSuperUser } = useAuth();
  if (!isSuperUser || !emailIsSuperUser(currentUser?.email || userProfile?.email)) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}

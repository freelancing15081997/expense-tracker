import React from 'react';
import { Navigate } from 'react-router-dom';
import { type FeatureKey } from '../lib/features';
import { useFeatures } from '../lib/use-features';
import { useAuth } from '../context/AuthContext';
import { emailIsSuperUser } from '../lib/super-users';
import { MoneyBookScreenSkeleton } from './money/MoneySkeletons';

export default function FeatureGate({ feature, children }: { feature: FeatureKey; children: React.ReactNode }) {
  const { map, on } = useFeatures();
  if (!map) return <MoneyBookScreenSkeleton />;
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

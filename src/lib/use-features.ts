import { useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { allowsHref, anyFeatureOn, featureOn, filterBooksTree, type FeatureKey } from './features';

export function useFeatures() {
  const { userProfile } = useAuth();
  const map = userProfile?.features;
  return useMemo(() => ({
    map,
    on: (key: FeatureKey) => featureOn(map, key),
    anyOn: anyFeatureOn(map),
    canSeeMoney: featureOn(map, 'money'),
    allowsHref: (href: string) => allowsHref(map, href),
    tree: filterBooksTree(map),
  }), [map]);
}

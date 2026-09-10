import React from 'react';
import AppLoader from '../../components/AppLoader';
import { moduleByPath } from '../catalog/modules';

export function BooksLoader(props?: { feature?: string; href?: string; compact?: boolean }) {
  const module = props?.href ? moduleByPath(props.href) : null;
  const feature = props?.feature || module?.name || 'Books';
  const meaning = module?.blurb || `Loading ${feature.toLowerCase()}.`;
  return <AppLoader title={feature} message={meaning} />;
}

'use client';

import dynamic from 'next/dynamic';
import type { MapViewProps } from './MapView';

const MapViewDynamic = dynamic(() => import('./MapView'), {
  ssr: false,
  loading: () => <div className="h-full w-full min-h-[300px] animate-pulse bg-gray-200" />,
});

export default function MapViewLazy(props: MapViewProps) {
  return <MapViewDynamic {...props} />;
}

export { MapViewLazy };
export type { MapViewProps };

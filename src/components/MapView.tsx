'use client';

import type { ReactNode } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import type { HouseholdView } from '@/lib/types';
import { STATUS_COLORS } from '@/lib/statusColors';

export interface MapViewProps {
  households: HouseholdView[];
  renderPopupExtra?: (h: HouseholdView) => ReactNode;
  /** CSS height of the map. Defaults to 100% of the parent. */
  height?: string | number;
  className?: string;
}

const CENTER: [number, number] = [5.528, 102.198];
const ZOOM = 14;

export default function MapView({
  households,
  renderPopupExtra,
  height = '100%',
  className,
}: MapViewProps) {
  return (
    <MapContainer
      center={CENTER}
      zoom={ZOOM}
      scrollWheelZoom
      className={className}
      style={{ height, width: '100%' }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {households.map((h) => {
        const silent = h.displayStatus === 'silent';
        const color = STATUS_COLORS[h.displayStatus];
        return (
          <CircleMarker
            key={h.id}
            center={[h.lat, h.lng]}
            radius={silent ? 14 : 9}
            pathOptions={{
              color: '#FFFFFF',
              weight: silent ? 4 : 2,
              fillColor: color,
              fillOpacity: 0.95,
            }}
          >
            <Popup>
              <div className="space-y-1 text-sm">
                <div className="font-semibold">{h.label}</div>
                <div>{h.head_name}</div>
                <div>Members: {h.members}</div>
                {h.tags.length > 0 && <div>Tags: {h.tags.join(', ')}</div>}
                <div>Risk zone: {h.risk_zone}</div>
                <div>
                  Status:{' '}
                  <span style={{ color, fontWeight: 600 }}>{h.displayStatus}</span>
                </div>
                <div>Score: {h.score}</div>
                {h.message && <div>Message: {h.message}</div>}
                {h.triage?.summary_en && <div>Triage: {h.triage.summary_en}</div>}
                {renderPopupExtra?.(h)}
              </div>
            </Popup>
          </CircleMarker>
        );
      })}
    </MapContainer>
  );
}

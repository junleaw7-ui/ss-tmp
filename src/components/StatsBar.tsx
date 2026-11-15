'use client';

import type { Stats } from '@/lib/types';

const CARDS: { key: keyof Stats; label: string; color: string }[] = [
  { key: 'safe', label: 'Safe', color: '#16A34A' },
  { key: 'help', label: 'Need help', color: '#DC2626' },
  { key: 'silent', label: 'Silent', color: '#111827' },
  { key: 'pending', label: 'Pending', color: '#9CA3AF' },
  { key: 'rescued', label: 'Rescued', color: '#0D9488' },
  { key: 'dispatched', label: 'Dispatched', color: '#2563EB' },
];

export default function StatsBar({ stats }: { stats: Stats }) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
      {CARDS.map((c) => (
        <div
          key={c.key}
          className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm"
          style={{ borderTop: `4px solid ${c.color}` }}
        >
          <div className="text-4xl font-bold leading-none" style={{ color: c.color }}>
            {stats[c.key]}
          </div>
          <div className="mt-1 text-sm text-gray-600">{c.label}</div>
        </div>
      ))}
    </div>
  );
}

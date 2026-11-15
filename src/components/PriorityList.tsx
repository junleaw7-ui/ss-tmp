'use client';

import { useState, type ReactNode } from 'react';
import type { DisplayStatus, HouseholdView } from '@/lib/types';
import { STATUS_COLORS } from '@/lib/statusColors';
import { reasonLabel } from '@/lib/reasonLabels';
import { getBaseUrl } from '@/lib/baseUrl';

interface Props {
  households: HouseholdView[];
  onChanged: () => void;
  renderRowExtra?: (h: HouseholdView) => ReactNode;
}

const SHOWN: DisplayStatus[] = ['help', 'silent', 'dispatched'];

export default function PriorityList({ households, onChanged, renderRowExtra }: Props) {
  const [busyId, setBusyId] = useState<string | null>(null);

  const rows = households
    .filter((h) => SHOWN.includes(h.displayStatus))
    .sort((a, b) => b.score - a.score);

  async function act(id: string, action: 'dispatched' | 'rescued') {
    setBusyId(id);
    try {
      const res = await fetch('/api/household', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action }),
      });
      if (res.ok) onChanged();
    } catch {
      // Network error: leave the list unchanged so the user can retry.
    } finally {
      setBusyId(null);
    }
  }

  function share(code: string) {
    const msg = `SilentSignal: Sila sahkan keselamatan isi rumah anda. Tekan pautan ini: ${getBaseUrl()}/c/${code}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank', 'noopener,noreferrer');
  }

  if (rows.length === 0) {
    return <p className="p-4 text-sm text-gray-500">No households need attention right now.</p>;
  }

  return (
    <ul className="flex flex-col gap-3">
      {rows.map((h) => {
        const hasMin = h.reasons.some((r) => r.startsWith('reason.silentMin'));
        const chips = h.reasons.filter((r) => !(hasMin && r === 'reason.silent'));
        const busy = busyId === h.id;
        return (
          <li key={h.id} className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="font-semibold">{h.label}</div>
                <div className="text-sm text-gray-600">
                  {h.head_name} · {h.members} {h.members === 1 ? 'person' : 'people'}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className="rounded-full px-2 py-0.5 text-xs font-medium text-white"
                  style={{ backgroundColor: STATUS_COLORS[h.displayStatus] }}
                >
                  {h.displayStatus}
                </span>
                <span className="text-sm font-bold tabular-nums">{h.score}</span>
              </div>
            </div>

            {chips.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {chips.map((r) => (
                  <span key={r} className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-700">
                    {reasonLabel(r)}
                  </span>
                ))}
              </div>
            )}

            {h.triage && (
              <div className="mt-2 text-sm">
                <span className="rounded bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-800">
                  {h.triage.source === 'ai' ? 'AI suggestion' : 'Rule-based'}: {h.triage.need} /{' '}
                  {h.triage.urgency}
                </span>
                <span className="ml-2 text-gray-700">{h.triage.summary_en}</span>
              </div>
            )}

            {h.message && <p className="mt-2 text-sm italic text-gray-700">&ldquo;{h.message}&rdquo;</p>}

            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => share(h.code)}
                className="rounded border border-gray-300 px-3 py-1 text-sm disabled:opacity-50"
              >
                Share link
              </button>
              {h.displayStatus !== 'dispatched' && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => act(h.id, 'dispatched')}
                  className="rounded bg-blue-600 px-3 py-1 text-sm text-white disabled:opacity-50"
                >
                  Dispatch team
                </button>
              )}
              <button
                type="button"
                disabled={busy}
                onClick={() => act(h.id, 'rescued')}
                className="rounded bg-teal-600 px-3 py-1 text-sm text-white disabled:opacity-50"
              >
                Mark rescued
              </button>
              {renderRowExtra?.(h)}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

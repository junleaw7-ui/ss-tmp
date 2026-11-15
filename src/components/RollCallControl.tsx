'use client';

import { useEffect, useState } from 'react';
import type { RollCall } from '@/lib/types';

interface Props {
  rollCall: RollCall | null;
  serverNow: string;
  onChanged: () => void;
}

const OPTIONS = [
  { value: 1, label: '1 min (demo)' },
  { value: 2, label: '2 min' },
  { value: 15, label: '15 min' },
  { value: 30, label: '30 min' },
];

function fmt(ms: number) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function RollCallControl({ rollCall, serverNow, onChanged }: Props) {
  const [deadline, setDeadline] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Offset between server and client clocks, captured when serverNow changes.
  const [offset, setOffset] = useState(0);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = Date.parse(serverNow);
    if (!Number.isNaN(t)) setOffset(t - Date.now());
  }, [serverNow]);

  const active = !!rollCall && !rollCall.ended_at;

  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [active]);

  async function post(body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/rollcall', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      onChanged();
    } catch {
      setError('Request failed. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  const btn =
    'rounded-md bg-[#0F766E] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0d6560] disabled:opacity-50 disabled:cursor-not-allowed';

  if (active && rollCall) {
    const end = Date.parse(rollCall.started_at) + rollCall.deadline_minutes * 60_000;
    const remaining = end - (now + offset);
    return (
      <div className="flex flex-wrap items-center gap-3">
        {remaining > 0 ? (
          <span className="font-mono text-2xl font-bold tabular-nums text-gray-900">
            {fmt(remaining)}
          </span>
        ) : (
          <span className="text-sm font-semibold text-red-700">
            Deadline passed · silent households are now priority
          </span>
        )}
        <button className={btn} disabled={busy} onClick={() => post({ action: 'end' })}>
          End roll call
        </button>
        {error && <span className="text-xs text-red-600">{error}</span>}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <select
        value={deadline}
        onChange={(e) => setDeadline(Number(e.target.value))}
        disabled={busy}
        className="rounded-md border border-gray-300 bg-white px-2 py-2 text-sm"
        aria-label="Deadline"
      >
        {OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <button
        className={btn}
        disabled={busy}
        onClick={() => post({ action: 'start', deadlineMinutes: deadline })}
      >
        Start roll call
      </button>
      {rollCall?.ended_at && (
        <a href="/summary" className="text-sm font-medium text-[#0F766E] underline">
          View summary →
        </a>
      )}
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}

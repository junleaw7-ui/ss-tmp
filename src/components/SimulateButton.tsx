'use client';

import { useState } from 'react';
import { Radio } from 'lucide-react';

export default function SimulateButton({
  disabled,
  onChanged,
}: {
  disabled?: boolean;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch('/api/simulate', { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg(
          data?.error === 'no_active_rollcall'
            ? 'Start a roll call first'
            : 'Could not simulate replies',
        );
      } else {
        setMsg(`Scheduled ${data.scheduled} replies over ~20 s`);
        onChanged();
      }
    } catch {
      setMsg('Could not simulate replies');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={run}
        disabled={busy || disabled}
        className="inline-flex items-center gap-2 rounded border px-3 py-1.5 text-sm disabled:opacity-50"
      >
        <Radio size={16} aria-hidden="true" />
        Simulate replies
      </button>
      {msg && (
        <p className="text-xs" role="status">
          {msg}
        </p>
      )}
    </div>
  );
}

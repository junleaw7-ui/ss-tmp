'use client';

import { useState } from 'react';
import { RotateCcw } from 'lucide-react';

export default function ResetButton({ onChanged }: { onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    if (!window.confirm('Reset all demo data?')) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/reset', { method: 'POST' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      onChanged();
    } catch {
      setError('Could not reset demo data');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={run}
        disabled={busy}
        className="inline-flex items-center gap-2 rounded border px-3 py-1.5 text-sm disabled:opacity-50"
      >
        <RotateCcw size={16} aria-hidden="true" />
        {busy ? 'Resetting…' : 'Reset demo'}
      </button>
      {error && (
        <p className="text-xs text-red-700" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

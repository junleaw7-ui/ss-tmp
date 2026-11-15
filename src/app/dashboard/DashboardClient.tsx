'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { StateResponse } from '@/lib/types';
import RollCallControl from '@/components/RollCallControl';
import StatsBar from '@/components/StatsBar';
import MapViewLazy from '@/components/MapViewLazy';
import PriorityList from '@/components/PriorityList';
import { DemoTools } from '@/components/DemoTools';

const POLL_MS = 3000;

export default function DashboardClient() {
  const [state, setState] = useState<StateResponse | null>(null);
  const [reconnecting, setReconnecting] = useState(false);
  const mounted = useRef(true);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/state', { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as StateResponse;
      if (!mounted.current) return;
      setState(data);
      setReconnecting(false);
    } catch {
      if (mounted.current) setReconnecting(true);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    void refresh();
    const id = setInterval(() => void refresh(), POLL_MS);
    return () => {
      mounted.current = false;
      clearInterval(id);
    };
  }, [refresh]);

  const onChanged = useCallback(() => {
    void refresh();
  }, [refresh]);

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <header className="flex items-center justify-between gap-3 border-b border-gray-200 bg-white px-4 py-3">
        <div className="flex items-baseline gap-3">
          <span className="text-xl font-bold" style={{ color: '#0F766E' }}>
            SilentSignal
          </span>
          <span className="text-sm text-gray-600">Kuala Krai, Kelantan</span>
        </div>
        <div className="flex items-center gap-2">
          {reconnecting && (
            <span
              role="status"
              className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800"
            >
              Reconnecting…
            </span>
          )}
          <div id="lang-toggle-slot" />
        </div>
      </header>

      {!state ? (
        <div className="space-y-4 p-4" aria-busy="true">
          <div className="h-16 animate-pulse rounded bg-gray-200" />
          <div className="h-16 animate-pulse rounded bg-gray-200" />
          <div className="grid gap-4 lg:grid-cols-5">
            <div className="h-80 animate-pulse rounded bg-gray-200 lg:col-span-3 lg:h-[560px]" />
            <div className="h-80 animate-pulse rounded bg-gray-200 lg:col-span-2 lg:h-[560px]" />
          </div>
        </div>
      ) : (
        <main className="space-y-4 p-4">
          <RollCallControl rollCall={state.rollCall} serverNow={state.now} onChanged={onChanged} />
          <StatsBar stats={state.stats} />
          <div className="grid gap-4 lg:grid-cols-5">
            <div className="h-80 overflow-hidden rounded border border-gray-200 bg-white lg:col-span-3 lg:h-[560px]">
              <MapViewLazy households={state.households} height="100%" />
            </div>
            <div className="max-h-[480px] overflow-y-auto rounded border border-gray-200 bg-white lg:col-span-2 lg:max-h-[560px]">
              <PriorityList households={state.households} onChanged={onChanged} />
            </div>
          </div>
          <section className="rounded border border-gray-200 bg-white p-4 lg:ml-auto lg:w-2/5">
            <DemoTools onChanged={onChanged} rollCallActive={!!state.rollCall && !state.rollCall.ended_at} />
          </section>
        </main>
      )}
    </div>
  );
}

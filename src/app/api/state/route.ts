import { NextResponse, connection } from 'next/server';
import { getSupabase } from '@/lib/supabase';
import { computeStatus, scoreHousehold } from '@/lib/scoring';
import { triage } from '@/lib/triage';
import type { Household, HouseholdView, RollCall, StateResponse, Stats } from '@/lib/types';

export async function GET() {
  // Always run at request time (Cache Components would otherwise try to prerender).
  await connection();
  try {
    const supabase = getSupabase();

    // 1. Apply due simulated replies atomically (idempotent across overlapping polls).
    const applied = await supabase.rpc('apply_due_replies');
    if (applied.error) throw applied.error;

    // 2. Rules-only triage for applied help replies (fast, no network call).
    const rows = (applied.data ?? []) as { id: string; status: string; message: string | null }[];
    await Promise.all(
      rows
        .filter((r) => r.status === 'help' && r.message)
        .map(async (r) => {
          const t = await triage(r.message as string, { rulesOnly: true });
          const res = await supabase.from('households').update({ triage: t }).eq('id', r.id);
          if (res.error) console.error('triage write failed', res.error);
        }),
    );

    // 3. Read state.
    const [rcRes, hhRes] = await Promise.all([
      supabase.from('roll_calls').select('*').order('started_at', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('households').select('*').order('label'),
    ]);
    if (rcRes.error) throw rcRes.error;
    if (hhRes.error) throw hhRes.error;

    const rollCall = (rcRes.data as RollCall | null) ?? null;
    const now = new Date();
    const stats: Stats = { safe: 0, help: 0, silent: 0, pending: 0, rescued: 0, dispatched: 0 };

    const households: HouseholdView[] = ((hhRes.data ?? []) as Household[]).map((h) => {
      const displayStatus = computeStatus(h, rollCall, now);
      stats[displayStatus] += 1;
      const { score, reasons } = scoreHousehold(h, rollCall, now);
      return { ...h, displayStatus, score, reasons };
    });

    const body: StateResponse = { rollCall, now: now.toISOString(), households, stats };
    return NextResponse.json(body, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    console.error('GET /api/state failed', err);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}

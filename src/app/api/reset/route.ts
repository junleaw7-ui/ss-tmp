import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';
import { SEED_HOUSEHOLDS } from '@/lib/seedData';

export async function POST() {
  try {
    const supabase = getSupabase();
    const nowIso = new Date().toISOString();

    const ended = await supabase
      .from('roll_calls')
      .update({ ended_at: nowIso })
      .is('ended_at', null);
    if (ended.error) throw ended.error;

    const removed = await supabase.from('households').delete().eq('is_demo', true);
    if (removed.error) throw removed.error;

    const rows = SEED_HOUSEHOLDS.map((h) => ({
      code: h.code,
      label: h.label,
      kampung: h.kampung,
      head_name: h.head_name,
      members: h.members,
      tags: h.tags,
      risk_zone: h.risk_zone,
      phone_masked: h.phone_masked,
      lat: h.lat,
      lng: h.lng,
      status: 'pending',
      message: null,
      triage: null,
      replied_at: null,
      source: 'self',
      buddy_note: null,
      scheduled_reply_at: null,
      scheduled_status: null,
      scheduled_message: null,
      is_demo: false,
      updated_at: nowIso,
    }));
    const upserted = await supabase.from('households').upsert(rows, { onConflict: 'code' });
    if (upserted.error) throw upserted.error;

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('POST /api/reset failed', err);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}

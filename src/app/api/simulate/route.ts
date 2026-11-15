import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';
import { MAK_SOM_LABEL } from '@/lib/seedData';

const HELP_MESSAGES = [
  'Air dah naik paras pinggang, mak tak boleh jalan',
  'Bumbung bocor, budak kecik demam',
  'Ubat darah tinggi atuk dah habis',
  'Water entering house fast, need boat pls',
];

export async function POST() {
  try {
    const supabase = getSupabase();

    const active = await supabase.from('roll_calls').select('id').is('ended_at', null).maybeSingle();
    if (active.error) throw active.error;
    if (!active.data) return NextResponse.json({ error: 'no_active_rollcall' }, { status: 400 });

    const rows = await supabase
      .from('households')
      .select('id')
      .eq('is_demo', false)
      .eq('status', 'pending')
      .is('scheduled_reply_at', null)
      .neq('label', MAK_SOM_LABEL);
    if (rows.error) throw rows.error;

    let safe = 0;
    let help = 0;
    let none = 0;
    const now = Date.now();
    const updates = (rows.data ?? []).flatMap((row) => {
      const r = Math.random();
      let scheduled_status: 'safe' | 'help';
      let scheduled_message: string | null = null;
      if (r < 0.6) {
        scheduled_status = 'safe';
        safe++;
      } else if (r < 0.7) {
        scheduled_status = 'help';
        scheduled_message = HELP_MESSAGES[Math.floor(Math.random() * HELP_MESSAGES.length)];
        help++;
      } else {
        // ~30%: nothing scheduled. Writing scheduled_reply_at without a status would make
        // apply_due_replies() set status = NULL and break GET /api/state.
        none++;
        return [];
      }
      const delay = 2000 + Math.floor(Math.random() * 18001);
      const query = supabase
        .from('households')
        .update({
          scheduled_reply_at: new Date(now + delay).toISOString(),
          scheduled_status,
          scheduled_message,
        })
        .eq('id', row.id);
      return [query];
    });

    const results = await Promise.all(updates);
    for (const res of results) if (res.error) throw res.error;

    return NextResponse.json({ scheduled: updates.length, safe, help, none });
  } catch (err) {
    console.error('POST /api/simulate failed', err);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}

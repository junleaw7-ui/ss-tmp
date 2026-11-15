import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';

const ALLOWED_DEADLINES = [1, 2, 15, 30];

function bad(error: string) {
  return NextResponse.json({ error }, { status: 400 });
}

export async function POST(request: Request) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return bad('invalid_json');
    }
    if (typeof body !== 'object' || body === null) return bad('invalid_body');
    const { action, deadlineMinutes } = body as Record<string, unknown>;
    const supabase = getSupabase();

    if (action === 'start') {
      if (typeof deadlineMinutes !== 'number' || !ALLOWED_DEADLINES.includes(deadlineMinutes)) {
        return bad('invalid_deadline');
      }
      const nowIso = new Date().toISOString();

      // End any active roll call first (unique index allows only one active).
      const ended = await supabase
        .from('roll_calls')
        .update({ ended_at: nowIso })
        .is('ended_at', null);
      if (ended.error) throw ended.error;

      const inserted = await supabase
        .from('roll_calls')
        .insert({ deadline_minutes: deadlineMinutes })
        .select()
        .single();
      if (inserted.error) throw inserted.error;

      // Reset ALL households (seeded and demo).
      const reset = await supabase
        .from('households')
        .update({
          status: 'pending',
          message: null,
          triage: null,
          replied_at: null,
          source: 'self',
          buddy_note: null,
          scheduled_reply_at: null,
          scheduled_status: null,
          scheduled_message: null,
          updated_at: nowIso,
        })
        .not('id', 'is', null);
      if (reset.error) throw reset.error;

      return NextResponse.json({ rollCall: inserted.data });
    }

    if (action === 'end') {
      const res = await supabase
        .from('roll_calls')
        .update({ ended_at: new Date().toISOString() })
        .is('ended_at', null)
        .select();
      if (res.error) throw res.error;
      return NextResponse.json({ ok: true });
    }

    return bad('invalid_action');
  } catch (err) {
    console.error('POST /api/rollcall failed', err);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';
import { triage } from '@/lib/triage';

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
    const { code, status, message } = body as Record<string, unknown>;

    if (typeof code !== 'string' || code.trim() === '' || code.length > 20) return bad('invalid_code');
    if (status !== 'safe' && status !== 'help') return bad('invalid_status');
    if (message !== undefined && message !== null && typeof message !== 'string') {
      return bad('invalid_message');
    }
    const cleanMessage =
      typeof message === 'string' && message.trim() !== '' ? message.slice(0, 500) : null;

    const supabase = getSupabase();
    const nowIso = new Date().toISOString();
    const updated = await supabase
      .from('households')
      .update({
        status,
        message: cleanMessage,
        source: 'self',
        replied_at: nowIso,
        buddy_note: null,
        scheduled_reply_at: null,
        scheduled_status: null,
        scheduled_message: null,
        triage: null,
        updated_at: nowIso,
      })
      .eq('code', code.trim().toUpperCase())
      .select('id')
      .maybeSingle();
    if (updated.error) throw updated.error;
    if (!updated.data) return NextResponse.json({ error: 'not_found' }, { status: 404 });

    if (status === 'help' && cleanMessage) {
      const t = await triage(cleanMessage); // Gemini with rules fallback; never throws
      const res = await supabase.from('households').update({ triage: t }).eq('id', updated.data.id);
      if (res.error) console.error('triage write failed', res.error);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('POST /api/checkin failed', err);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}

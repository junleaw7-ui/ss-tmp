import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';
import type { Tag } from '@/lib/types';

const DEMO_LIMIT = 40;
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0, O, 1, I
const ALL_TAGS: Tag[] = ['elderly', 'oku', 'baby', 'pregnant', 'chronic'];

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomCode() {
  let s = '';
  for (let i = 0; i < 6; i++) s += CODE_CHARS[randomInt(0, CODE_CHARS.length - 1)];
  return s;
}

function randomTags(): Tag[] {
  return ALL_TAGS.filter(() => Math.random() < 0.25);
}

export async function GET(request: Request) {
  try {
    const code = new URL(request.url).searchParams.get('code')?.trim().toUpperCase();
    if (!code) return NextResponse.json({ error: 'not_found' }, { status: 404 });
    const { data, error } = await getSupabase()
      .from('households')
      .select('label, head_name, kampung, status')
      .eq('code', code)
      .maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: 'not_found' }, { status: 404 });
    return NextResponse.json(data);
  } catch (err) {
    console.error('GET /api/household failed', err);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
    }
    if (typeof body !== 'object' || body === null) {
      return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
    }
    const { id, action } = body as Record<string, unknown>;
    if (typeof id !== 'string' || id.trim() === '') {
      return NextResponse.json({ error: 'invalid_id' }, { status: 400 });
    }

    let update: Record<string, unknown>;
    switch (action) {
      case 'dispatched':
        update = { status: 'dispatched' };
        break;
      case 'rescued':
        update = { status: 'rescued' };
        break;
      case 'buddy_safe':
        update = {
          status: 'safe',
          source: 'buddy',
          replied_at: new Date().toISOString(),
          buddy_note: null,
          scheduled_reply_at: null,
          scheduled_status: null,
          scheduled_message: null,
        };
        break;
      case 'buddy_unreachable': {
        const rawNote = (body as Record<string, unknown>).note;
        if (rawNote !== undefined && typeof rawNote !== 'string') {
          return NextResponse.json({ error: 'invalid_note' }, { status: 400 });
        }
        const note = typeof rawNote === 'string' ? rawNote.trim().slice(0, 200) : '';
        update = { buddy_note: note || 'Cannot reach' };
        break;
      }
      default:
        return NextResponse.json({ error: 'invalid_action' }, { status: 400 });
    }

    const { data, error } = await getSupabase()
      .from('households')
      .update({ ...update, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('id');
    if (error) {
      // Postgres invalid_text_representation: id is not a valid uuid, so no such row.
      if (error.code === '22P02') return NextResponse.json({ error: 'not_found' }, { status: 404 });
      throw error;
    }
    if (!data || data.length === 0) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('PATCH /api/household failed', err);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    let body: unknown = {};
    try {
      const text = await request.text();
      if (text.trim() !== '') body = JSON.parse(text);
    } catch {
      return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
    }
    if (typeof body !== 'object' || body === null) {
      return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
    }
    const rawName = (body as Record<string, unknown>).name;
    if (rawName !== undefined && rawName !== null && typeof rawName !== 'string') {
      return NextResponse.json({ error: 'invalid_name' }, { status: 400 });
    }
    const name = (typeof rawName === 'string' ? rawName.trim().slice(0, 40) : '') || 'Hakim 1';

    const supabase = getSupabase();
    const count = await supabase
      .from('households')
      .select('id', { count: 'exact', head: true })
      .eq('is_demo', true);
    if (count.error) throw count.error;
    if ((count.count ?? 0) >= DEMO_LIMIT) {
      return NextResponse.json({ error: 'demo_limit' }, { status: 409 });
    }

    for (let attempt = 0; attempt < 5; attempt++) {
      const code = randomCode();
      const { error } = await supabase.from('households').insert({
        code,
        label: `No. ${randomInt(1, 99)}, Kg Manjor`,
        kampung: 'Kg Manjor',
        head_name: name,
        members: randomInt(1, 6),
        tags: randomTags(),
        risk_zone: 'high',
        phone_masked: `01X-XXX ${String(randomInt(0, 9999)).padStart(4, '0')}`,
        lat: 5.528 + (Math.random() * 2 - 1) * 0.004,
        lng: 102.205 + (Math.random() * 2 - 1) * 0.004,
        is_demo: true,
      });
      if (!error) return NextResponse.json({ code });
      if (error.code !== '23505') throw error; // retry only on unique violation
    }
    throw new Error('Could not generate unique code');
  } catch (err) {
    console.error('POST /api/household failed', err);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}

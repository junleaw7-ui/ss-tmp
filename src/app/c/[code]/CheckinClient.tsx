'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

// Local strings (BM first) so task 4.2 i18n can replace them later.
const STRINGS = {
  loading: 'Memuatkan...',
  invalidTitle: 'Pautan tidak sah',
  invalidBody: 'Kod ini tidak dijumpai. Sila semak pautan yang anda terima.',
  error: 'Sesuatu tidak kena. Sila cuba lagi.',
  greeting: 'Salam',
  question: 'Adakah anda selamat?',
  safe: 'Saya selamat / I\'m safe',
  help: 'Perlu bantuan / I need help',
  whatHappened: 'Apa yang berlaku? / What happened?',
  send: 'Hantar / Send',
  sending: 'Menghantar...',
  back: 'Kembali / Back',
  thanks: 'Terima kasih, maklumat diterima',
  change: 'Ubah jawapan / Change answer',
};

type Household = { label: string; head_name: string; kampung?: string; status?: string };
type View = 'loading' | 'invalid' | 'error' | 'choose' | 'help' | 'sending' | 'done';

export default function CheckinClient() {
  const params = useParams<{ code: string }>();
  const code = String(params?.code ?? '');
  const [view, setView] = useState<View>('loading');
  const [house, setHouse] = useState<Household | null>(null);
  const [message, setMessage] = useState('');
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/household?code=${encodeURIComponent(code)}`);
        if (cancelled) return;
        if (res.status === 404) return setView('invalid');
        if (!res.ok) return setView('error');
        setHouse(await res.json());
        setView('choose');
      } catch {
        if (!cancelled) setView('error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [code]);

  async function submit(status: 'safe' | 'help', msg?: string) {
    setView('sending');
    setFailed(false);
    try {
      const res = await fetch('/api/checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, status, ...(msg?.trim() ? { message: msg.trim() } : {}) }),
      });
      if (res.status === 404) return setView('invalid');
      if (!res.ok) throw new Error('fail');
      setView('done');
    } catch {
      setFailed(true);
      setView(status === 'help' ? 'help' : 'choose');
    }
  }

  const headFirst = house?.head_name?.trim().split(/\s+/)[0] ?? '';

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center gap-5 p-5">
      {view === 'loading' && <p className="text-center text-slate-600">{STRINGS.loading}</p>}

      {view === 'invalid' && (
        <div className="text-center">
          <h1 className="mb-2 text-2xl font-bold">{STRINGS.invalidTitle}</h1>
          <p className="text-slate-600">{STRINGS.invalidBody}</p>
        </div>
      )}

      {view === 'error' && <p className="text-center text-red-700">{STRINGS.error}</p>}

      {house && (view === 'choose' || view === 'help' || view === 'sending') && (
        <header className="text-center">
          <p className="text-lg text-slate-600">
            {STRINGS.greeting}, {headFirst}
          </p>
          <h1 className="text-2xl font-bold">{house.label}</h1>
        </header>
      )}

      {view === 'choose' && (
        <>
          <p className="text-center text-xl font-semibold">{STRINGS.question}</p>
          <button
            type="button"
            onClick={() => submit('safe')}
            className="min-h-[72px] w-full rounded-2xl bg-[#16A34A] px-4 text-xl font-bold text-white active:opacity-80"
          >
            {STRINGS.safe}
          </button>
          <button
            type="button"
            onClick={() => {
              setFailed(false);
              setView('help');
            }}
            className="min-h-[72px] w-full rounded-2xl bg-[#DC2626] px-4 text-xl font-bold text-white active:opacity-80"
          >
            {STRINGS.help}
          </button>
        </>
      )}

      {view === 'help' && (
        <>
          <label htmlFor="msg" className="text-lg font-semibold">
            {STRINGS.whatHappened}
          </label>
          <textarea
            id="msg"
            value={message}
            maxLength={500}
            rows={4}
            onChange={(e) => setMessage(e.target.value)}
            className="w-full rounded-xl border border-slate-400 p-3 text-lg"
          />
          <button
            type="button"
            onClick={() => submit('help', message)}
            className="min-h-[72px] w-full rounded-2xl bg-[#DC2626] px-4 text-xl font-bold text-white active:opacity-80"
          >
            {STRINGS.send}
          </button>
          <button type="button" onClick={() => setView('choose')} className="py-2 text-slate-600 underline">
            {STRINGS.back}
          </button>
        </>
      )}

      {view === 'sending' && <p className="text-center text-lg text-slate-600">{STRINGS.sending}</p>}

      {failed && (view === 'choose' || view === 'help') && (
        <p role="alert" className="text-center text-red-700">
          {STRINGS.error}
        </p>
      )}

      {view === 'done' && (
        <div className="text-center">
          <p className="mb-4 text-2xl font-bold text-[#16A34A]">{STRINGS.thanks}</p>
          <button type="button" onClick={() => setView('choose')} className="py-2 text-slate-600 underline">
            {STRINGS.change}
          </button>
        </div>
      )}
    </main>
  );
}

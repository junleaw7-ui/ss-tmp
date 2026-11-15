'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

type Status = 'loading' | 'full' | 'error';

export default function JoinPage() {
  const router = useRouter();
  const started = useRef(false);
  const [status, setStatus] = useState<Status>('loading');

  const create = useCallback(async () => {
    setStatus('loading');
    try {
      const res = await fetch('/api/household', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && typeof data.code === 'string') {
        router.replace('/c/' + data.code);
      } else if (res.status === 409 && data.error === 'demo_limit') {
        setStatus('full');
      } else {
        setStatus('error');
      }
    } catch {
      setStatus('error');
    }
  }, [router]);

  useEffect(() => {
    if (started.current) return; // StrictMode double-run guard
    started.current = true;
    void create();
  }, [create]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      {status === 'loading' && <p role="status">Creating your demo household…</p>}
      {status === 'full' && (
        <>
          <p>Demo is full, thanks for trying SilentSignal</p>
          <Link href="/dashboard" className="underline">
            View the dashboard
          </Link>
        </>
      )}
      {status === 'error' && (
        <>
          <p>Something went wrong while setting up your demo household. Please try again.</p>
          <button
            type="button"
            onClick={() => void create()}
            className="rounded bg-black px-4 py-2 text-white"
          >
            Try again
          </button>
        </>
      )}
    </main>
  );
}

import { Suspense } from 'react';
import CheckinClient from './CheckinClient';

export default function CheckinPage() {
  return (
    <Suspense fallback={<main className="min-h-screen p-6 text-center text-slate-600">Memuatkan...</main>}>
      <CheckinClient />
    </Suspense>
  );
}

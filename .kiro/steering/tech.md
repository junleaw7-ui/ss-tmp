---
inclusion: always
---

# Tech

## Stack
- **Next.js (App Router) + TypeScript + Tailwind CSS**, created with `npx create-next-app@latest silentsignal --ts --tailwind --app --eslint --src-dir --import-alias "@/*"`
- **Supabase (Postgres)** for shared data across devices (judges' phones + dashboard)
- **Leaflet + react-leaflet** with OpenStreetMap tiles (no API key). Always load the map with `dynamic(() => import(...), { ssr: false })`.
- **qrcode.react** for the "Try it as a household" QR code
- **lucide-react** icons
- Optional: **Gemini API** (`@google/genai`) to triage "Perlu bantuan" text
- Deploy: **Vercel**, public URL

## Architecture rules
- All database access goes through **Next.js route handlers** (`src/app/api/**/route.ts`) using the Supabase **service role key on the server only**. The browser never talks to Supabase directly, so no RLS/auth work is needed today.
- Live updates = **client polling every 3 seconds** (`/api/state`). No websockets or Supabase Realtime (less risk).
- No login anywhere. Every page is public.
- The app must still work with **no `GEMINI_API_KEY`**: fall back to a simple keyword rule and never crash.
- Keep every component small. Prefer working and simple over clever.
- Run `npm run build` after each task group. A failing build blocks deploy.

## Env vars (`.env.local` and Vercel)
```
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
GEMINI_API_KEY=            # optional
NEXT_PUBLIC_BASE_URL=      # e.g. https://silentsignal.vercel.app (used in share links and QR)
```

## Commands
- `npm run dev` → http://localhost:3000
- `npm run build`
- Seed: run `supabase/schema.sql` then `supabase/seed.sql` in the Supabase SQL editor, or call `POST /api/reset`.

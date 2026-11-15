# Design: SilentSignal roll call MVP

## Overview
SilentSignal is a Next.js (App Router) app. Browsers call Next.js route handlers, and only the handlers talk to Supabase (service role key, server only). The dashboard polls `GET /api/state` every 3 seconds. There is no login. Everything must run on Vercel serverless, so there are no timers, background jobs or websockets. Anything that must happen "later" is stored as a timestamp and applied the next time someone reads state.

## Architecture
```mermaid
flowchart LR
  D[Dashboard /dashboard] -- poll 3s --> S[GET /api/state]
  H[Household /c/code] --> C[POST /api/checkin]
  J[/join] --> HH[POST /api/household]
  D --> R[/api/rollcall, /api/simulate, /api/reset, PATCH /api/household/]
  S & C & HH & R --> DB[(Supabase Postgres)]
  C & S --> T[triage.ts: Gemini or rules]
```

## Data Models

`supabase/schema.sql` (full file content):
```sql
create extension if not exists pgcrypto;

drop table if exists households;
drop table if exists roll_calls;

create table households (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,              -- 6 chars, e.g. 'K7Q2MX' (no 0/O/1/I)
  label text not null,                    -- 'No. 12, Kg Manjor'
  kampung text not null,
  head_name text not null,                -- first name only
  members int not null default 1,
  tags text[] not null default '{}',      -- elderly | oku | baby | pregnant | chronic
  risk_zone text not null default 'medium', -- high | medium | low
  phone_masked text,
  lat double precision not null,
  lng double precision not null,
  status text not null default 'pending', -- pending | safe | help | dispatched | rescued
  message text,
  triage jsonb,                           -- { urgency, need, people, summary_en, source: 'ai'|'rules' }
  replied_at timestamptz,
  source text not null default 'self',    -- self | buddy
  buddy_note text,                        -- set by "Buddy: cannot reach"
  scheduled_reply_at timestamptz,         -- set by /api/simulate
  scheduled_status text,                  -- safe | help
  scheduled_message text,
  is_demo boolean not null default false,
  updated_at timestamptz not null default now()
);

create table roll_calls (
  id uuid primary key default gen_random_uuid(),
  area text not null default 'Kuala Krai',
  started_at timestamptz not null default now(),
  deadline_minutes int not null default 2,   -- 1 | 2 | 15 | 30
  ended_at timestamptz
);

create index on households (is_demo);
create index on households (scheduled_reply_at) where scheduled_reply_at is not null;
create unique index only_one_active_rollcall on roll_calls ((true)) where ended_at is null;

-- Applies simulated replies whose time has come. One atomic UPDATE, so overlapping polls cannot apply a reply twice.
-- Needed because the Supabase JS client cannot copy one column into another in an update.
create or replace function apply_due_replies()
returns table (id uuid, status text, message text)
language sql
as $$
  update households h
  set status = h.scheduled_status,
      message = h.scheduled_message,
      replied_at = h.scheduled_reply_at,
      source = 'self',
      scheduled_reply_at = null,
      scheduled_status = null,
      scheduled_message = null,
      updated_at = now()
  where h.scheduled_reply_at is not null and h.scheduled_reply_at <= now()
  returning h.id, h.status, h.message;
$$;
```
Active roll call = the single row with `ended_at is null` (enforced by the partial unique index). `seed.sql` follows `schema.sql` and inserts the 25 seeded rows with `source='self'` and all reply, buddy and scheduled fields null.

## Status logic (`src/lib/scoring.ts`, pure functions)
```
computeStatus(h, rollCall, now):
  if h.status in (safe, help, dispatched, rescued) → h.status
  if no active roll call → 'pending'
  if now > started_at + deadline → 'silent'
  else → 'pending'
```
Semantics are unchanged. A household that has a scheduled reply but is not yet due is still `pending`/`silent` by this function.

### Apply-due step (start of `GET /api/state`)
Simulated replies are stored in `scheduled_*` and applied when state is read, so they appear gradually without timers.

1. Call `supabase.rpc('apply_due_replies')`. The Postgres function in `schema.sql` runs one atomic `UPDATE ... WHERE scheduled_reply_at is not null AND scheduled_reply_at <= now() RETURNING id, status, message`, so overlapping polls cannot apply a reply twice. (An RPC is used because the Supabase JS client cannot copy one column into another in an update.)
   Only the poll whose UPDATE matches a row receives it in `returning`; a second poll finds nothing, so the step is idempotent.
2. For each returned row with `status='help'` and a message, call `triage()` and write the `triage` column. Simulated messages come from a fixed list, so use **rules only** here (`triage(message, { rulesOnly: true })`). This keeps the poll fast and has no network call.
3. Then read all households and compute `displayStatus`, `score`, `reasons`.

A row can briefly show `help` without `triage` until step 2 finishes in the same request. The response is built after step 2, so clients never see that state.

## Priority score (transparent, shown as chips)
The list contains only households whose display status is `help`, `silent` or `dispatched`. `pending` households are counted in the stats and never listed. `safe` and `rescued` are not listed.

| Factor | Points |
|---|---|
| status `help` | +50 |
| status `silent` | +40 |
| `dispatched` | +5 (stays on list, ranked lower) |
| tag elderly / oku | +15 each |
| tag baby / pregnant / chronic | +10 each |
| vulnerability total capped at | 30 |
| risk zone high / medium / low | +20 / +10 / 0 |
| minutes silent (after deadline, `silent` only) | +1 per minute, cap 20 |
| triage urgency critical / high | +15 / +8 |
| members ≥ 5 | +5 |
| buddy note present ("cannot reach") | +10 |

The old "+10 pending" row is dropped. `scoreHousehold(h, rollCall, now)` returns `{ score, reasons: string[] }`, where reasons are i18n keys, for example `reason.silentMin` with minutes, `reason.elderly`, `reason.riskHigh`, `reason.buddyUnreachable`.
`source === 'buddy'` adds a `reason.buddyReport` chip for display only (no points). It is shown on any household whose status came from a buddy report.

## Components and Interfaces

Route handlers, pages and components are listed below. Folder layout is in `.kiro/steering/structure.md`.

### API (route handlers, server-only Supabase client)
All inputs get simple validation. Bad input returns 400, never 500.

- `GET /api/state` → runs the apply-due step, then returns `{ rollCall, now, households: [{...h, displayStatus, score, reasons}], stats }`. `stats` = `{ safe, help, silent, pending, rescued, dispatched }`.
- `POST /api/rollcall`
  - `{ action: 'start', deadlineMinutes }` where `deadlineMinutes ∈ {1, 2, 15, 30}` (else 400). Ends any active roll call, inserts a new one, then resets **all** households (seeded and demo) to `status='pending'` and clears `message`, `triage`, `replied_at`, `source` (back to `'self'`), `buddy_note`, `scheduled_reply_at`, `scheduled_status`, `scheduled_message`.
  - `{ action: 'end' }` sets `ended_at = now()`. The UI then links to `/summary`.
- `GET /api/household?code=` → public view for the check-in page (label, head_name, kampung, status). Unknown code returns 404 `{ error: 'not_found' }`; the page shows a friendly message.
- `POST /api/checkin` `{ code, status: 'safe'|'help', message? }` → validate code and status, truncate message to 500 chars. Sets `source='self'`, `replied_at=now()`, clears `buddy_note` and scheduled fields. If help and message, call `triage()` (Gemini with 6 s timeout, rules fallback). Allowed while no roll call is active too.
- `POST /api/household` `{ name? }` → count `is_demo` rows; if 40 or more, return **409 `{ error: 'demo_limit' }`**. Otherwise create a demo household (`is_demo=true`, default name "Hakim 1", random tags, position = Kg Manjor ± 0.004, `risk_zone='high'`) and return `{ code }`.
- `PATCH /api/household` `{ id, action, note? }`:
  - `dispatched` → `status='dispatched'`
  - `rescued` → `status='rescued'`
  - `buddy_safe` → `status='safe'`, `source='buddy'`, `replied_at=now()`, clears `buddy_note`
  - `buddy_unreachable` → sets `buddy_note = note || 'Cannot reach'`; status is unchanged, so the household stays on the list and gets +10
- `POST /api/simulate` → requires an active roll call (else 400). For each **pending seeded** household (`is_demo=false`, `status='pending'`, no `scheduled_reply_at`), **always excluding the household labelled `No. 3, Kg Manjor` (Mak Som)**, which is never given a scheduled reply so it always becomes `silent` after the deadline. For every other eligible household, draw one random number:
  - ~60%: `scheduled_status='safe'`
  - ~10%: `scheduled_status='help'`, `scheduled_message` picked from the message list below
  - ~30%: nothing scheduled (they become `silent` after the deadline)

  Each scheduled household gets `scheduled_reply_at = now() + random(2..20 s)`. The replies are applied by the apply-due step on later `GET /api/state` polls, so they show up gradually.
- `POST /api/reset` → delete `is_demo` rows, restore the 25 seed rows to their original values (the seed data lives in `src/lib/seedData.ts` so the route can re-upsert it, same content as `seed.sql`), clear reply, buddy and scheduled fields, and end active roll calls. The dashboard shows a confirm dialog before calling it.

## Seed data (`supabase/seed.sql`)
25 households across:
- **Kg Manjor** (riverside, mostly `high` risk): around 5.528, 102.205
- **Kg Guchil** (`medium`): around 5.536, 102.190
- **Kg Tualang** (`low`/`medium`, hill side): around 5.520, 102.185

Include: 6 elderly-only households, 3 OKU, 4 with babies, 2 pregnant, 3 chronic illness, and the rest none. Mix Malay, Chinese and Indian first names; phones are masked fictional (`01X-XXX 4521`). Example rows:
- No. 3, Kg Manjor · Mak Som · 1 member · elderly · high
- No. 7, Kg Manjor · Ah Kow · 2 · elderly, chronic · high
- No. 15, Kg Guchil · Kavitha · 5 · baby · medium
- No. 2, Kg Tualang · Hafiz · 4 · none · low
- No. 21, Kg Manjor · Pak Mat · 3 · oku · high

Simulated help messages (for `/api/simulate`):
- "Air dah naik paras pinggang, mak tak boleh jalan"
- "Bumbung bocor, budak kecik demam"
- "Ubat darah tinggi atuk dah habis"
- "Water entering house fast, need boat pls"

Demo guarantee: `/api/simulate` always skips Mak Som (No. 3, Kg Manjor), so at least one elderly, high-risk household stays silent and tops the list after the deadline. The video relies on that. Mak Som can still reply through her check-in link or a buddy report.

## Pages
### `/` Landing
Hero with the one-liner, then the differentiator line: "Safety check apps wait for people to report. SilentSignal ranks the people who didn't." Three step cards (Amaran banjir → Roll call → Senyap = keutamaan), buttons "Open dashboard" and "Try it as a household". Footer: "Built with Kiro for STC Mini Hackathon 2026. Demo data is fictional."

### `/dashboard`
Layout (desktop): top bar (logo, area name, LangToggle) → RollCallControl + countdown → StatsBar → two columns: **MapView (left, 60%)** and **PriorityList (right, 40%)**. Bottom-right: JoinQR card ("Judges: scan to try"; the QR encodes `${base}/join`) + Simulate replies + Reset demo buttons.
Mobile: stack everything; map height 320px.
Colours: safe `#16A34A`, help `#DC2626`, pending `#9CA3AF`, silent `#111827` with pulse ring, dispatched `#2563EB`, rescued `#0D9488`. Primary brand teal `#0F766E`.

- **RollCallControl**: deadline `<select>` with 1 min (demo), 2 min, 15 min, 30 min; Start / End buttons; countdown. After End, show a link to `/summary`.
- **PriorityList row**: label, head name, score, reason chips, plus the "AI suggestion" or "Rule-based" chip when triage exists, and a "Buddy report" chip when `source === 'buddy'`. Buttons: Share link (WhatsApp `wa.me` with the check-in URL `${base}/c/{code}` and a BM message), Dispatch team, Mark rescued, **Buddy: seen safe**, **Buddy: cannot reach** (optional note via `prompt()` or a small input).
- **Map popup**: same details plus the two buddy buttons.
- **Reset demo**: `window.confirm("Reset all demo data?")` first; call `/api/reset` only on OK.

**Base URL for QR and share links** (JoinQR, PriorityList, map popup): a small helper `getBaseUrl()` returns `window.location.origin` in the browser and falls back to `process.env.NEXT_PUBLIC_BASE_URL` on server render or when `window` is unavailable. All QR codes and WhatsApp links use it, so they work on any deployed domain or preview URL.

### `/c/[code]` Check-in
Mobile-first, very large buttons (min height 72px), high contrast, BM first with EN toggle. States: loading → choose → (help: optional text) → sending → thank you ("Terima kasih, maklumat diterima", with "Ubah jawapan / Change answer" link). Invalid code shows a friendly error. If no active roll call, still allow check-in.

### `/join`
On load: POST `/api/household`. On success redirect to `/c/[code]`. While waiting show "Creating your demo household…". On 409 `demo_limit` show a friendly message ("Demo is full, thanks for trying SilentSignal") with a link to `/dashboard`.

### `/summary` (P0, required)
This page is required for the MVP, not optional. The demo script ends on it and the End roll call flow links to it.
Cards and one bar row for the last roll call: total households, % replied, safe, needed help, silent → found, rescued, average reply time (average of `replied_at - started_at` over replied households). Link back to dashboard.

## Triage (`src/lib/triage.ts`)
`triage(message, opts?: { rulesOnly?: boolean })`
- Dependency: `@google/genai` (Google Gen AI SDK for JavaScript).
- If `GEMINI_API_KEY` is set and not `rulesOnly`: call model `gemini-2.5-flash` with a JSON response schema; system prompt: "You classify Malaysian flood help messages written in Bahasa Malaysia, English or Manglish…". Timeout 6 s. Result `source: 'ai'`.
- On error, timeout, no key, or `rulesOnly`: keyword rules, `source: 'rules'`. "air naik", "lemas", "bumbung", "roof" → rescue/critical; "ubat", "sakit", "medicine" → medical/high; "air bersih", "makanan" → water/food/medium; anything else → other/medium.
- Never throws. Shape: `{ urgency, need, people, summary_en, source }`.

## Demo script (3-min video, 1-minute deadline)
Timing target: 2:40 total, leaving a margin under 3:00. Record in one take with the roll call deadline at 1 minute, and talk over the waiting parts.

| Time | Step |
|---|---|
| 0:00–0:15 | Landing page: one-liner and differentiator line. Click "Open dashboard". |
| 0:15–0:30 | Dashboard: 25 households in Kuala Krai, all grey. Choose **1 min**, press **Start roll call**. |
| 0:30–0:55 | Press **Simulate replies**. Markers turn green and a few red gradually over about 20 s. |
| 0:55–1:25 | Show the phone: scan the QR, tap "Perlu bantuan", type "air naik", send. The household turns red and gets an AI chip (or "Rule-based" chip if no key). |
| 1:25–1:55 | Deadline passes (about 1 min after start). Silent households turn black and jump to the top: "Mak Som, 1 member, warga emas, zon risiko tinggi, no reply 1 min". Explain the reason chips. |
| 1:55–2:10 | Press **Buddy: seen safe** on one silent household. It turns green and shows a "Buddy report" chip. |
| 2:10–2:25 | **Dispatch team** on the top household (blue), then **Mark rescued** (teal). |
| 2:25–2:40 | **End roll call** → Summary page: % replied, silent → found, rescued. |

Fillers if the deadline is slow: while waiting, explain the scoring chips and open a map popup. Pre-record the phone part if the venue Wi-Fi is weak. Do a full dry run first and trim to under 3:00.

## Submission assets
- **README.md outline**: what SilentSignal is (one paragraph), live link placeholder, tech stack, how to run (`npm install` including `@google/genai`, `.env.local`, run `schema.sql` then `seed.sql`, `npm run dev`), env vars (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY` optional, `NEXT_PUBLIC_BASE_URL` used only as a fallback for QR and share links when `window.location.origin` is unavailable), demo steps (same as the demo script), note that data is fictional, credits (built with Kiro).
- **Pitch deck (PDF, max 8 slides)**:
  1. Hook: "No reply is a reply"
  2. Problem, with real sourced flood data
  3. Who is affected (elderly, OKU, babies, people without signal)
  4. Solution and the 3-step flow (warning → roll call → silence = priority)
  5. Product screenshots (dashboard, check-in page, priority list)
  6. Why different vs Facebook Safety Check, Google Person Finder and SOS apps (they wait for people to report; we rank those who didn't)
  7. Theme fit and how Kiro was used (spec, steering files)
  8. Impact, next steps, public link and QR
- **Statistics rule**: every number on slide 2 and 3 must be looked up from an official or reputable source (for example the national disaster agency, the Department of Statistics Malaysia, or news reports) and cited on the slide. Do not invent figures. If no source is found, leave the claim qualitative.
- **Video**: YouTube unlisted or public, under 3:00. **Submission**: link, video and PDF via the WhatsApp-group form before 3:00 PM, aiming for 2:30 PM.

## Error handling
- Invalid input → 400 with `{ error }`; unknown code → 404; demo cap → 409 `{ error: 'demo_limit' }`.
- Gemini failure or timeout → rules fallback, never an error to the user.
- Overlapping polls → safe because the apply-due step is a single conditional UPDATE.
- Client fetch failure on the dashboard → keep last data and retry on the next poll.

## Testing Strategy

Property-based testing is not used. The logic is a small set of pure functions and thin route handlers over a database, and the hackathon timebox favors a few example tests plus a manual checklist.

### Unit checks for `scoring.ts` (Vitest or plain `node:test`)
Use `now` = deadline + the stated minutes, a 2-minute roll call.

| Case | Expected score |
|---|---|
| A: silent, elderly, risk high, 3 min silent, 1 member | 40 + 15 + 20 + 3 = **78** |
| B: help, no tags, risk low, no triage | 50 + 0 + 0 = **50** |
| C: help, elderly, risk high, triage critical | 50 + 15 + 20 + 15 = **100** |
| D: silent, OKU, risk medium, 20+ min silent | 40 + 15 + 10 + 20 = **85** |
| E: dispatched, elderly, risk high | 5 + 15 + 20 = **40** |
| F: silent, no tags, risk low, 1 min, buddy_note set | 40 + 0 + 0 + 1 + 10 = **51** |

Expected orderings:
- C > D > A > F > B > E. In particular, silent elderly in a high-risk zone (A) ranks above help in a low-risk zone with no vulnerability (B).
- `pending`, `safe` and `rescued` households are never in the listed output.
- A vulnerability total over 30 is capped at 30 (for example elderly + OKU + baby = 30, not 40).
- `computeStatus` returns `pending` before the deadline, `silent` after it, and passes through `safe`, `help`, `dispatched`, `rescued`.
- `triage('air naik', { rulesOnly: true })` returns `rescue/critical` with `source: 'rules'`.

### Manual checklist (run on the public Vercel URL before recording)
- [ ] Every page opens without login.
- [ ] Reset demo asks for confirmation; Cancel changes nothing.
- [ ] Start roll call with 1 min: all households, including demo ones, go to pending; countdown runs.
- [ ] Simulate replies: replies appear over about 20 s; roughly 60% green, a few red; some stay grey.
- [ ] Phone: QR opens `/join`, redirects to `/c/[code]`; "Perlu bantuan" + "air naik" turns the house red with a triage chip within 3 s.
- [ ] After 1 min, grey becomes black/pulsing and silent households top the list with reason chips.
- [ ] Buddy: seen safe → green with "Buddy report" chip. Buddy: cannot reach → stays listed, score +10.
- [ ] Dispatch → blue; Mark rescued → teal and removed from the list.
- [ ] End roll call links to Summary with sensible numbers.
- [ ] 41st `/join` shows the friendly message and dashboard link.
- [ ] Works with `GEMINI_API_KEY` unset (Rule-based chip).
- [ ] `npm run build` passes and the deployed commit is the latest.


# Implementation Plan: SilentSignal roll call MVP

## Overview

One developer, one day. Build order follows the design: setup and first deploy, data and pure logic, check-in flow, dashboard, P1 extras, then submission assets. Times are targets (Asia/Kuala_Lumpur). **Build stops about 13:45. Code freeze 15:00 (3:00 PM). Form submission target 14:30-14:40, hard limit 15:00.**

After each group: run `npm run build`, fix errors, commit, push (Vercel auto-deploys).

## Tasks

- [x] 0. Group 0: Setup (10:15-10:35)
  - [x] 0.1 Create the Next.js app (TypeScript, Tailwind, App Router, `src` dir) and install `@supabase/supabase-js leaflet react-leaflet qrcode.react lucide-react @google/genai` and `@types/leaflet`.
    - _Requirements: R1.1_
  - [x] 0.2 **Manual (user)**: the agent must skip this task and wait for the user's confirmation. Do not attempt account logins. The user creates the Supabase project, runs the SQL, and adds the keys. The agent may only write `supabase/schema.sql` exactly as in the design: `households` with `source`, `buddy_note`, `scheduled_reply_at`, `scheduled_status`, `scheduled_message`, `is_demo`; `roll_calls`; the `is_demo` index, the partial `scheduled_reply_at` index, the partial unique index `only_one_active_rollcall` (one active roll call), and the `apply_due_replies()` Postgres function (atomic UPDATE ... RETURNING id, status, message, see design.md). The user runs `schema.sql` in Supabase and adds `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_BASE_URL` (and optional `GEMINI_API_KEY`) to `.env.local`.
    - _Requirements: R2.2, R3.4, R7.4, R12.4_
  - [x] 0.3 **Manual (user)**: the agent must skip this task and wait for the user's confirmation. Do not attempt account logins. The user pushes to GitHub, imports into Vercel, adds the env vars, and confirms the default page deploys to a public URL (first deploy right after setup).
    - _Requirements: R1.1, R1.2_

- [x] 1. Group 1: Data and logic (10:35-11:25)
  - [x] 1.1 Create `src/lib/seedData.ts` with the 25 fictional households (3 kampung near lat 5.53, lng 102.20, mixed Malay/Chinese/Indian first names, tags, risk zones, masked phones, random 6-char codes without 0/O/1/I, `source='self'`, all reply, buddy and scheduled fields null). Include the design's example rows and keep Mak Som (No. 3) elderly and high risk. Write `supabase/seed.sql` with the same content and run it.
    - _Requirements: R2.1, R2.2, R2.3_
  - [x] 1.2 Create `src/lib/supabase.ts` (server-only client using the service role key) and `src/lib/types.ts` (Household, RollCall, DisplayStatus, Triage, state response).
    - _Requirements: R1.1, R5.1_
  - [x] 1.3 Create `src/lib/scoring.ts` with `computeStatus(h, rollCall, now)` and `scoreHousehold(h, rollCall, now)` returning `{ score, reasons }` per the design table: status points, vulnerability cap 30, risk zone, minutes silent (cap 20), triage urgency, members >= 5, buddy note +10, and a display-only `reason.buddyReport` when `source === 'buddy'`. Only `help`, `silent` and `dispatched` households are listed.
    - _Requirements: R5.1, R5.2, R5.3, R8.4, R12.3, R12.4_
  - [x] 1.4 Add unit checks for `scoring.ts` (Vitest or `node:test`) for the six worked examples (2-minute roll call): A=78, B=50, C=100, D=85, E=40, F=51. Also check ordering C > D > A > F > B > E, that `pending`, `safe` and `rescued` are never listed, the vulnerability cap (elderly + OKU + baby = 30), `computeStatus` pass-through and silent/pending cases, and that `triage('air naik', { rulesOnly: true })` gives rescue/critical with source `rules` once triage exists.
    - _Requirements: R5.1, R5.2, R5.3, R12.3_
  - [x] 1.5 Implement `GET /api/state`: apply due simulated replies by calling `supabase.rpc('apply_due_replies')` (the atomic Postgres function from `schema.sql`, idempotent across overlapping polls; no raw UPDATE), triage returned `help` rows with a message using rules only, then read all households and return `{ rollCall, now, households with displayStatus/score/reasons, stats }` where stats has safe, help, silent, pending, rescued, dispatched.
    - _Requirements: R5.1, R6.2, R6.3, R7.4_
  - [x] 1.6 Implement `POST /api/rollcall`: `start` with `deadlineMinutes` in {1, 2, 15, 30} (else 400) ends any active roll call, inserts a new one, and resets ALL households (seeded and demo) to `pending`, clearing message, triage, replied_at, source (back to `self`), buddy_note and the three scheduled fields; `end` sets `ended_at`.
    - _Requirements: R3.1, R3.3, R3.4_

- [x] 2. Group 2: Check-in flow (11:25-12:00)
  - [x] 2.1 Implement `GET /api/household?code=` (public view, 404 `not_found` for unknown code) and `POST /api/checkin` (validate code and status, truncate message to 500 chars, set `source='self'`, `replied_at`, clear buddy and scheduled fields, allowed with no active roll call). Triage hook is added in 4.1.
    - _Requirements: R4.3, R4.4, R4.5_
  - [x] 2.2 Build the `/c/[code]` page: mobile-first, two large buttons (min 72px) "Saya selamat / I'm safe" and "Perlu bantuan / I need help", optional help text box (sending without text works), thank-you screen "Terima kasih, maklumat diterima" with change-answer link, friendly invalid-code message, BM default.
    - _Requirements: R4.1, R4.2, R4.3, R4.4, R4.5, R4.6_
  - [x] 2.3 Implement `POST /api/household` (optional name, default "Hakim 1", random tags, near Kg Manjor +/- 0.004, `risk_zone='high'`, `is_demo=true`, returns `{ code }`; returns 409 `{ error: 'demo_limit' }` when 40 demo households exist) and the `/join` page that redirects to `/c/[code]`, showing "Creating your demo household..." while waiting and a friendly full message with a link to `/dashboard` on 409.
    - _Requirements: R7.2, R7.3_

- [ ] 3. Group 3: Dashboard (12:00-13:00)
  - [x] 3.1 Build `MapView` (client-only Leaflet, one coloured circle marker per household by display status, popups with details).
    - _Requirements: R6.1_
  - [x] 3.2 Build `StatsBar` (Safe, Need help, Silent, Pending, Rescued) and `RollCallControl` (deadline select 1/2/15/30 min, Start/End, countdown while active, summary link after End).
    - _Requirements: R3.1, R3.2, R3.3, R6.2_
  - [x] 3.3 Build `PriorityList` listing only `help`, `silent` and `dispatched` households sorted by score, with reason chips and buttons Share link (`https://wa.me/?text=` with check-in URL and BM message; build the URL from `window.location.origin` in the browser, falling back to `NEXT_PUBLIC_BASE_URL`, via a shared `getBaseUrl()` helper), Dispatch team, Mark rescued. Implement `PATCH /api/household` actions `dispatched` and `rescued`.
    - _Requirements: R5.2, R5.3, R6.4_
  - [x] 3.4 Add the dashboard page with 3-second polling of `/api/state` (keep last data on fetch failure) wiring the components together, status colours and the silent pulse class.
    - _Requirements: R6.1, R6.2, R6.3_
  - [x] 3.5 Implement `POST /api/simulate` (requires active roll call, else 400): for each pending seeded household with no scheduled reply, always excluding household No. 3 (Mak Som) so she never gets a simulated reply, ~60% schedule `safe`, ~10% schedule `help` with a message from the design list, ~30% nothing; each scheduled reply gets `scheduled_reply_at = now() + random 2..20 s`. Add the Simulate replies button.
    - _Requirements: R7.4_
  - [x] 3.6 Implement `POST /api/reset` (delete demo rows, re-upsert the 25 rows from `src/lib/seedData.ts`, clear reply, buddy and scheduled fields, end active roll calls) and the Reset demo button behind `window.confirm("Reset all demo data?")`. Add the `JoinQR` card pointing to `/join`, built with `getBaseUrl()` (`window.location.origin` in the browser, falling back to `NEXT_PUBLIC_BASE_URL`).
    - _Requirements: R7.1, R7.5_
  - [-] 3.7 Deploy checkpoint (by 13:00): run `npm run build`, push, and confirm the full demo script works on the public URL, including the QR join from a phone.
    - _Requirements: R1.2, R7.1, R7.2_
  - [x] 3.8 Buddy actions (droppable): extend `PATCH /api/household` with `buddy_safe` (status `safe`, source `buddy`, replied_at now, clear buddy_note) and `buddy_unreachable` (set `buddy_note`, default "Cannot reach", status unchanged).
    - _Requirements: R12.2, R12.3, R12.4_
  - [ ] 3.9 Buddy UI (droppable): add "Buddy: seen safe" and "Buddy: cannot reach" buttons (optional note) to each PriorityList row and map popup, and show the "Buddy report" chip when `source === 'buddy'`.
    - _Requirements: R12.1, R12.2, R12.3, R12.4_

- [ ] 4. Group 4: P1 extras (13:00-13:30)
  - [ ] 4.1 Create `src/lib/triage.ts` (the `@google/genai` package is already installed in task 0.1; Gemini `gemini-2.5-flash` with JSON schema and 6 s timeout, keyword rules fallback, `rulesOnly` option, never throws). Call it from `/api/checkin` for help messages. Show the "AI suggestion" or "Rule-based" chip on the dashboard; critical adds the score points.
    - _Requirements: R8.1, R8.2, R8.3, R8.4_
  - [ ] 4.2 Create `src/lib/i18n.ts` and `LangToggle` (BM | EN, stored in localStorage, default BM on check-in and EN on dashboard) and add it to all pages.
    - _Requirements: R9.1, R4.6_
  - [ ] 4.3 Build the landing page `/`: one-liner, 3-step "How it works" (Warning, Roll call, Silence = priority), the differentiator line "Safety check apps wait for people to report. SilentSignal ranks the people who didn't.", buttons "Open dashboard" and "Try it as a household", and the footer "Built with Kiro for STC Mini Hackathon 2026. Demo data is fictional."
    - _Requirements: R11.1, R11.2, R11.3_
  - [ ] 4.4 Write `README.md`: what SilentSignal is, tech stack, how to run (`npm install`, `.env.local`, run `schema.sql` then `seed.sql`, `npm run dev`), env vars, demo steps, a public link placeholder, fictional-data note and Kiro credit.
    - _Requirements: R13.1_
  - [ ] 4.5 Build the `/summary` page for the last roll call: total households, % replied, safe, needed help, silent found, rescued, average reply time, link back to the dashboard.
    - _Requirements: R10.1_

- [ ] 5. Group 5: P2 and polish (13:30-13:45, only if ahead; otherwise skip)
  - [ ] 5.1 Visual polish: silent marker pulse ring, empty and loading states, mobile layout at 390px.
    - _Requirements: R6.1_

- [ ] 6. Group 6: Submission assets, P0 (13:45-14:40)
  - [ ] 6.1 Capture screenshots (13:45-13:55): dashboard with priority list, check-in page on a phone, landing page, summary page.
    - _Requirements: R13.2_
  - [ ] 6.2 Build the deck in Canva or Google Slides (13:55-14:15), max 8 slides following the design outline (hook, problem, who is affected, solution and flow, screenshots, differentiation, theme fit and Kiro use, impact and link/QR). Look up and cite real Kuala Krai/Kelantan flood figures on the slide; do not invent numbers, and keep claims qualitative if no source is found. Export to PDF and check the page count.
    - _Requirements: R13.2_
  - [ ] 6.3 Record the demo video (14:15-14:30), at most 3:00, following the design demo script with the 1-minute deadline. Do a quick dry run first and trim if over time.
    - _Requirements: R13.3_
  - [ ] 6.4 Upload to YouTube as unlisted or public and open the link while logged out to confirm it plays (14:30-14:35).
    - _Requirements: R13.3_
  - [ ] 6.5 Final reset and deploy check (14:35-14:38): confirm the latest commit is deployed, press Reset demo, fill the public link into the README placeholder if time allows.
    - _Requirements: R1.2, R7.5, R13.1_
  - [ ] 6.6 Submit the public link, YouTube link and deck PDF through the WhatsApp-group form (target 14:40, hard limit 15:00).
    - _Requirements: R13.4_

## Notes

- Drop order if behind: Group 5 first, then the buddy tasks (3.8, 3.9), then 4.2 (i18n). Never drop Groups 0-3 or Group 6. Keep 4.1 (triage) and 4.5 (summary page).
- Group 6 must start by 13:45. Do not add features after that.
- All tasks are required; the design has no Correctness Properties, so there are no property tests. Unit checks in 1.4 cover scoring.
- Run the design's manual checklist on the public URL before recording the video.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["0.1"] },
    { "id": 1, "tasks": ["0.2"] },
    { "id": 2, "tasks": ["0.3", "1.1", "1.2"] },
    { "id": 3, "tasks": ["1.3"] },
    { "id": 4, "tasks": ["1.4", "1.5"] },
    { "id": 5, "tasks": ["1.6", "2.1"] },
    { "id": 6, "tasks": ["2.2", "2.3"] },
    { "id": 7, "tasks": ["3.1", "3.2"] },
    { "id": 8, "tasks": ["3.3"] },
    { "id": 9, "tasks": ["3.4", "3.5"] },
    { "id": 10, "tasks": ["3.6"] },
    { "id": 11, "tasks": ["3.7", "3.8"] },
    { "id": 12, "tasks": ["3.9", "4.1"] },
    { "id": 13, "tasks": ["4.2", "4.3"] },
    { "id": 14, "tasks": ["4.4"] },
    { "id": 15, "tasks": ["4.5", "5.1", "6.1"] },
    { "id": 16, "tasks": ["6.2"] },
    { "id": 17, "tasks": ["6.3"] },
    { "id": 18, "tasks": ["6.4"] },
    { "id": 19, "tasks": ["6.5"] },
    { "id": 20, "tasks": ["6.6"] }
  ]
}
```

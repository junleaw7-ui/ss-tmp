# Requirements Document

## Introduction

SilentSignal roll call MVP: a flood roll-call web app for Malaysian communities that asks registered vulnerable households to check in and ranks households that do not reply. Built by one person for a hackathon with a 3:00 PM code freeze.

**P0** = must ship (submission rules + core demo). **P1** = strong extra. **P2** = only if time allows.

## Glossary

- **SYSTEM**: The SilentSignal web app (pages, API routes and database).
- **Coordinator**: A person running the roll call from the dashboard.
- **Household**: A registered home with a check-in code, seeded or demo.
- **Demo household**: A household created via `/join` (`is_demo = true`).
- **Roll call**: A timed request for all households to check in.
- **Display status**: `safe`, `help`, `pending`, `silent`, `dispatched` or `rescued`.
- **Buddy**: A coordinator or neighbour reporting on a household in person.
- **TEAM**: The single developer submitting the project.
- **REPOSITORY**: The project's Git repository.

## Requirements

## R1. Public app, no login (P0)
1. THE SYSTEM SHALL let anyone open every page without logging in.
2. THE SYSTEM SHALL be deployed to a public Vercel URL right after setup (default page), redeployed after each task group, with the full demo script working on the public URL by **1:00 PM**.

## R2. Seeded households (P0)
1. THE SYSTEM SHALL seed **25 fictional households** in Kuala Krai, Kelantan (around lat 5.53, lng 102.20), spread across 3 kampung (e.g. Kg Manjor, Kg Guchil, Kg Tualang) with realistic small offsets in coordinates.
2. Each household SHALL have: house label (e.g. "No. 12, Kg Manjor"), head first name, member count, vulnerability tags (`elderly`, `oku`, `baby`, `pregnant`, `chronic`, none), risk zone (`high` near river, `medium`, `low`), masked phone (`01X-XXX 4521`), and a random 6-character check-in code.
3. Names SHALL mix Malay, Chinese and Indian first names. No real people or real phone numbers.

## R3. Start / end a roll call (P0)
1. WHEN the coordinator presses **Start roll call** THE SYSTEM SHALL create an active roll call with a deadline (options: 1 min for demo/video, 2 min, 15 min, 30 min) and reset ALL households, including demo households created via `/join`, to `pending`, clearing message, triage, reply time, reply source, buddy note and scheduled reply fields.
2. WHILE a roll call is active THE SYSTEM SHALL show a countdown to the deadline.
3. WHEN the coordinator presses **End roll call** THE SYSTEM SHALL close it and link to the summary page.
4. Only one roll call SHALL be active at a time.

## R4. Household check-in (P0)
1. WHEN a household opens `/c/[code]` THE SYSTEM SHALL show their house label, first name, and two large buttons: **"Saya selamat / I'm safe"** (green) and **"Perlu bantuan / I need help"** (red).
2. WHEN "Perlu bantuan" is tapped THE SYSTEM SHALL show an optional text box ("Apa yang berlaku? / What happened?") and a Send button; sending without text SHALL still work.
3. WHEN a check-in is sent THE SYSTEM SHALL save status, message and time with source `self`, and show a confirmation screen ("Terima kasih, maklumat diterima").
4. A household SHALL be able to change its answer (e.g. safe → help) while the roll call is active.
5. IF the code is invalid THEN THE SYSTEM SHALL show a friendly error, not a crash.
6. The page SHALL be mobile-first, load fast, and default to BM with an EN toggle.

## R5. Status and priority (P0)
1. THE SYSTEM SHALL compute each household's display status:
   - `safe` (green), `help` (red), `pending` (grey, before the deadline), `silent` (black/pulsing, deadline passed with no reply), plus coordinator overrides `dispatched` (blue) and `rescued` (teal).
2. THE SYSTEM SHALL compute a priority score (see design) and list in the Priority list, highest score first, only households whose display status is `help`, `silent` or `dispatched`. Households that are `pending` SHALL appear only in the Pending stat count. Households that are `safe` or `rescued` SHALL NOT be listed.
3. Each list row SHALL show the reasons for its score as small chips (e.g. "No reply 4 min", "Warga emas", "Zon risiko tinggi").

## R6. Coordinator dashboard (P0)
1. THE SYSTEM SHALL show a map with one coloured marker per household (colour = status) and a popup with details.
2. THE SYSTEM SHALL show stat cards: Safe, Need help, Silent, Pending, Rescued.
3. THE SYSTEM SHALL refresh data every 3 seconds without a page reload.
4. Each Priority list row SHALL have buttons: **Share link** (WhatsApp `wa.me` share with the check-in URL and a BM message), **Dispatch team**, **Mark rescued**.

## R7. Judge demo tools (P0)
1. THE SYSTEM SHALL show a QR code on the dashboard pointing to `/join`.
2. WHEN `/join` is opened and fewer than 40 demo households exist THE SYSTEM SHALL create a demo household (name optional, default "Hakim 1", random tags, placed near Kg Manjor) and redirect to its `/c/[code]` page; it SHALL appear on the dashboard within 3 seconds.
3. IF 40 demo households already exist WHEN `/join` is opened, THEN THE SYSTEM SHALL refuse to create another and show a friendly message with a link to the dashboard.
4. WHEN **Simulate replies** is pressed THE SYSTEM SHALL schedule a reply for each pending seeded household: about 60% as `safe` and about 10% as `help` with a BM/Manglish message, each at a random time between 2 and 20 seconds after the press, leaving the remaining ~30% without a reply (they become `silent` after the deadline). Each scheduled reply SHALL be stored on the household (`scheduled_reply_at`, `scheduled_status`, optional message). WHEN the state endpoint is read, THE SYSTEM SHALL apply every scheduled reply whose time has passed as a normal `self` check-in (including triage for help messages), so replies appear gradually on the dashboard. THE SYSTEM SHALL always leave the seeded household "No. 3, Kg Manjor" (Mak Som, elderly, high risk) without a scheduled reply, so she becomes `silent` after the deadline.
5. WHEN **Reset demo** is pressed THE SYSTEM SHALL first show a confirm dialog, and only after confirmation restore the seed state, delete demo households and end any active roll call.

## R8. AI triage of help messages (P1)
1. WHEN a household sends "Perlu bantuan" with text THE SYSTEM SHALL classify it with Gemini into `{ urgency: "critical|high|medium", need: "rescue|medical|water|food|shelter|other", people: number|null, summary_en: string }`.
2. THE SYSTEM SHALL show the result on the dashboard with a **"AI suggestion"** label.
3. IF Gemini is not configured or fails THEN THE SYSTEM SHALL use a keyword fallback (e.g. "air naik", "lemas", "bumbung", "roof" → rescue/critical; "ubat", "sakit", "medicine" → medical/high; "air bersih", "makanan" → water/food/medium) and label it "Rule-based".
4. A `critical` AI result SHALL add points to the priority score.

## R9. Bilingual UI (P1)
1. THE SYSTEM SHALL offer a BM | EN toggle on all pages (default BM on check-in page, EN on dashboard), stored in localStorage.

## R10. Recovery summary (P0)
1. THE SYSTEM SHALL show for the last roll call: total households, % replied, safe, needed help, silent → found, rescued, and average reply time.

## R11. Landing page (P1)
1. THE SYSTEM SHALL show the one-liner, a 3-step "How it works" (Warning → Roll call → Silence = priority), and buttons "Open dashboard" and "Try it as a household".
2. THE SYSTEM SHALL show one small differentiator line: "Safety check apps wait for people to report. SilentSignal ranks the people who didn't."
3. Footer: "Built with Kiro for STC Mini Hackathon 2026. Demo data is fictional."

## R12. Buddy check (P1)
Covers households with no phone or signal.
1. THE SYSTEM SHALL show two buttons, **"Buddy: seen safe"** and **"Buddy: cannot reach"**, on each Priority list row and in each map popup.
2. WHEN "Buddy: seen safe" is pressed THE SYSTEM SHALL mark the household `safe` with source `buddy`.
3. WHEN "Buddy: cannot reach" is pressed THE SYSTEM SHALL save a buddy note, add a small score bonus to that household, and keep the household on the Priority list.
4. THE SYSTEM SHALL store the report source (`self` or `buddy`) per household and show a small **"Buddy report"** chip on any household whose status came from a buddy report.

## R13. Submission assets (P0 for 2–4, P1 for 1)
1. (P1) THE REPOSITORY SHALL contain a `README.md` with: what SilentSignal is, how to run it, required environment variables, the demo steps, and a placeholder for the public link.
2. (P0) THE TEAM SHALL produce a pitch deck PDF of at most 8 slides.
3. (P0) THE TEAM SHALL produce a demo video of at most 3 minutes and upload it to YouTube as unlisted or public.
4. (P0) THE TEAM SHALL submit the public link, video link and deck PDF through the WhatsApp-group form before **3:00 PM**, targeting **2:30 PM**.

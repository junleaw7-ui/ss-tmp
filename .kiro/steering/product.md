---
inclusion: always
---

# Product: SilentSignal

## One-liner
**"No reply is a reply. We find the people who can't call for help."**
SilentSignal is a flood roll-call system for Malaysian communities. When a flood warning is issued, every registered vulnerable household gets a one-tap check-in link. Households that **do not reply** rise to the top of the rescue list, ranked by risk.

## Why it is new
Existing flood apps (and SOS platforms) react to people who ask for help. The most vulnerable (elderly, OKU, families with babies, kampung with weak signal) often can't ask. SilentSignal actively asks everyone and treats **silence as a signal**.

## Hackathon context
- Event: STC Mini Hackathon 2026, theme **Disaster Recovery** (preparedness, response, recovery, continuity, data protection, community support).
- **Code freeze 3:00 PM today** (Asia/Kuala_Lumpur).
- Submissions: (1) working prototype, **public link, no login**; (2) demo video ≤ 3 min; (3) pitch deck PDF ≤ 8 slides.
- Judging: Originality 35%, Build quality 30%, Impact 20%, Pitch 15%.
- Built from scratch with Kiro. Do not copy code from other projects.

## Users
- **Coordinator** (ketua kampung, JKKK, APM/NADMA operations room): starts a roll call, watches replies, dispatches rescue.
- **Household** (warga emas, OKU, families with babies/pregnant women, chronic illness): receives a link, taps "Saya selamat" or "Perlu bantuan".

## Core flow
1. Coordinator presses **Start roll call** for an area (e.g. Kuala Krai) with a reply deadline (demo: 2 minutes; real: 30 minutes).
2. Each household's check-in link is shared (WhatsApp share button using a `wa.me` link; SMS is out of scope).
3. Household opens link → taps **Saya selamat / I'm safe** or **Perlu bantuan / Need help** (optional short text).
4. Dashboard updates every few seconds: green = safe, red = needs help, grey = no reply yet, **dark/pulsing = deadline passed with no reply**.
5. The **Priority list** ranks households by score (status + vulnerability + flood-risk zone + minutes of silence). Coordinator marks "Team dispatched" → "Rescued".

## Judge experience (critical for Build Quality score)
- Open the link → see the landing page and the dashboard with seeded data immediately. No login.
- A **"Try it as a household"** button and a QR code on the dashboard let a judge create a demo household and check in on their own phone, then watch it appear live on the dashboard.
- A **"Simulate replies"** button makes the demo lively (random seeded households reply over ~20 seconds, a few stay silent).

## Theme fit
- Preparedness: register vulnerable households before floods.
- Response: roll call + priority list.
- Recovery: after the event, a summary (safe / helped / rescued counts, average reply time).
- Data protection: links use random codes, not names; phone numbers are masked on screen; only first name + house label are shown.
- Continuity: check-in page is tiny and works on slow 2G/3G connections.

## Out of scope today
Real SMS/telco sending, real user accounts, real government data integration, native mobile app.

---
inclusion: always
---

# Structure

```
README.md                    # what it is, how to run, env vars, demo steps
supabase/
  schema.sql                 # tables
  seed.sql                   # demo households (Kuala Krai, Kelantan)
src/
  app/
    page.tsx                 # Landing: one-liner, 3-step how it works, buttons
    dashboard/page.tsx       # Coordinator dashboard (map, stats, roll call control, priority list, QR)
    c/[code]/page.tsx        # Household check-in page (mobile-first, BM/EN)
    join/page.tsx            # Judge demo: create a demo household → redirect to /c/[code]
    summary/page.tsx         # Recovery summary after roll call
    api/
      state/route.ts         # GET: active roll call + households with computed status & score
      rollcall/route.ts      # POST start / POST end
      checkin/route.ts       # POST { code, status, message }
      household/route.ts     # POST create demo household; PATCH action (dispatched/rescued/buddy_safe/buddy_unreachable)
      simulate/route.ts      # POST: schedules gradual random replies for demo
      reset/route.ts         # POST: reset demo data to seed
  components/
    MapView.tsx              # Leaflet map, coloured markers (client only)
    StatsBar.tsx             # counts: safe / help / silent / pending
    PriorityList.tsx         # ranked households + action buttons
    RollCallControl.tsx      # start/end, deadline selector, countdown
    JoinQR.tsx               # QR to /join
    LangToggle.tsx           # BM | EN
  lib/
    supabase.ts              # server-side client (service role)
    scoring.ts               # computeStatus() + priorityScore() (pure functions)
    i18n.ts                  # { en, ms } dictionary + t()
    triage.ts                # Gemini call + keyword fallback
    seedData.ts              # 25 seed households (used by /api/reset)
    types.ts
```

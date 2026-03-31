# BodyLens — Project Brief for Claude

> Paste this URL into any new Claude chat: https://raw.githubusercontent.com/Schnufdi/Soma/main/README.md
> Then say: "Read this file and use it as full context for continuing work on BodyLens."

---

## What BodyLens Is

AI-native personalised health intelligence platform. NOT a fitness app. The product is the WHY behind health science, personalised by AI to each user. Closest reference: Huberman/Attia depth at consumer price point with full AI personalisation.

**The flow:** Onboarding form (13 questions) → AI follow-up chat (3-6 exchanges) → Full programme generation (macros, 7-day training split, supplements, injury modifications, coach summary) → Daily plan + floating coach + science library.

**Owner:** Sven Konigsmann. 44yo. Senior finance background (TP ICAP VP, Barclays, HSBC, Lloyds, ANZ). Self-funded sabbatical.
**Co-founder:** Seamus (17+ years senior marketing).
**Budget:** £5-10k. **Target:** £500k ARR = financial independence.

**Demo user (Sven):** Male, 44, 181cm, 87kg, ~18% BF, body recomposition, 4 days/week, full commercial gym, morning sessions, Mediterranean+Asian diet, moderate stress, 7-8h sleep. Training split: Mon Push / Wed Pull / Fri Posterior Chain / Sat Upper. Macros (updated): **2400kcal training / 2200kcal rest** (reduced from 2769/2492 per goal analysis), 174g protein.

---

## Live URLs

- **Site:** https://soma-two-chi.vercel.app
- **Repo:** https://github.com/Schnufdi/Soma (public, flat root)
- **Daily plan:** https://soma-two-chi.vercel.app/bodylens-dailyplan.html
- **Decisions log:** https://soma-two-chi.vercel.app/bodylens-decisions.html
- **Week view:** https://soma-two-chi.vercel.app/bodylens-week.html
- **Goals engine:** https://soma-two-chi.vercel.app/bodylens-goals.html
- **Data sync:** https://soma-two-chi.vercel.app/bodylens-sync.html
- **Onboarding:** https://soma-two-chi.vercel.app/bodylens-onboard.html

---

## Stack

| Layer | Detail |
|-------|--------|
| Frontend | Pure HTML/CSS/JS. No framework. Single-file pages. |
| Styling | style.css — global design system. Jade + amber themes. CSS variables. |
| Navigation | nav.js — IIFE injected into every page. Includes: Today · Programme · Week · Food · Meals · Stack · Goals · **Decisions** |
| AI | Claude Sonnet via /api/chat (Vercel serverless proxy). Model: claude-sonnet-4-20250514 |
| Auth | Supabase Google OAuth — live and integrated. |
| Storage | localStorage-first + Supabase sync via setItem intercept |
| Deployment | Vercel auto-deploys on GitHub main push (~30 seconds) |
| Supabase URL | https://ubbqyhkjijpjpqdhhhvp.supabase.co |
| Supabase anon key | eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InViYnF5aGtqaWpwanBxZGhoaHZwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQyOTkxODEsImV4cCI6MjA4OTg3NTE4MX0.VK-AvEFr_cmXT7k44mvR9UxVlGRXL8Cu6mgXBQbQov8 |
| Sven's user ID | e65eb373-0d2b-4aa0-bff8-6bf714eef16b |

---

## Decision Architecture — CRITICAL

BodyLens has a proposal bus that every programme change flows through. **Nothing should write directly to the profile without going through this system.**

### The flow

```
Any surface (Goals, Coach, Body Scan, Reconciliation)
  → blPropose(source, title, changes, context)         [bl-proposals.js]
  → Staged in localStorage['bl_proposals']
  → Visible on /bodylens-decisions.html and /bodylens-week.html
  → User reviews before/after table
  → blCommitProposal(id)  →  applies to profile + writes to bl_proposal_log
  → blDismissProposal(id) →  logs dismissal, nothing applied
  → blRevertProposal(id)  →  creates a new reverse proposal for review
```

### Sources

| Source key | Who calls it |
|------------|-------------|
| `'goals'` | bodylens-goals.html — goal gap analysis |
| `'coach'` | coach.js — confirmed coach conversations |
| `'body-scan'` | bodylens-bodyscan.html — measurement updates |
| `'reconciliation'` | dp-reconcile.js — weekly adaptation pass (not yet built) |
| `'manual'` | Direct edits / reverts |

### blApplyChanges field types

| Field pattern | What it does |
|---------------|-------------|
| `'protein'`, `'trainingKcal'`, `'restKcal'`, `'trainingDays'`, `'calories'`, `'goal'` | Direct scalar write to profile |
| `'coachNotes.append'` | Appends `'\n• ' + val` to `p.coachNotes` — does NOT overwrite |
| `'injuries.push'` | Appends to `p.injuries` array |
| `'overlays.push'` | Appends to `p.overlays` array |
| `'weekPlan[N].type'` | Updates that day's type and priority |
| `'weekPlan[N].keyExercises'` | Updates that day's exercise list |
| `'gapBridge.X'` | Writes to `p.gapBridge.X` sub-field |

**Critical:** `coachNotes` is NOT in the scalars list. Always use `coachNotes.append`.

### How decisions flow downstream

After `blCommitProposal()`:
1. **Profile** — numeric fields written immediately
2. **coachNotes** — appended; coach reads this in every conversation
3. **Day plan cache cleared** — `dayplan_v6r3_YYYY-MM-DD` removed; next load regenerates
4. **"Plan updated" banner** — appears on Today for 48h showing what changed
5. **Coach narrative** — `generateCoachNarrative()` reads `coachNotes`, `gapBridge.weeklyFocus`, `gapBridge.training`, `gapBridge.primaryGaps`
6. **Week page** — reads profile on every load; no cache; updates immediately

### Decision log localStorage keys

| Key | Contents |
|-----|----------|
| `bl_proposals` | Pending proposals — awaiting review |
| `bl_proposal_log` | Committed + dismissed history — permanent record |

---

## Data Storage

### localStorage → Supabase

| localStorage key | Supabase destination |
|-----------------|---------------------|
| `bl_profile` | `profiles.profile` (jsonb) — includes weekPlan, gapBridge, coachNotes, behaviourMemory |
| `bl_proposals` | via bl_profile sync |
| `bl_proposal_log` | via bl_profile sync |
| `bl_daylog_YYYY-MM-DD` | `day_logs` table |
| `bl_macros_YYYY-MM-DD` | `macros` table |
| `bl_weekly_meals_YYYY-MM-DD` | `meal_plans` table |
| `bl_activities_YYYY-MM-DD` | `activities` table |
| `bl_weekledger_YYYY-MM-DD` | `week_ledger` table |
| `bl_scan_history` | `profiles.scan_data` |

### LOCAL ONLY (not synced)

| Key | Reason |
|-----|--------|
| `dayplan_v6r3_YYYY-MM-DD` | AI-generated cache. Regeneratable. Cleared on any programme change. |
| `bl_week_override_YYYY-MM-DD` | Recovery reschedule overrides. |
| `bl_pin_store` | Security. |
| `bl_theme` | UI preference. |

---

## Profile Schema

```json
{
  "name": "Sven", "age": 44, "weight": 87, "height": 181, "sex": "Male",
  "goal": "Body recomposition",
  "trainingKcal": 2400, "restKcal": 2200, "calories": 2400,
  "protein": 174, "carbs": 280, "fat": 80,
  "trainingDays": 4, "wakeTime": "07:00",
  "weekPlan": [
    { "day": "Monday", "type": "Push", "focus": "Chest, shoulders, triceps",
      "priority": "training", "kcal": 2400,
      "keyExercises": ["Bench Press 4x6-8 (RPE 8)", "Overhead Press 3x8-10"],
      "coachNote": "Heaviest pressing session." }
  ],
  "supplements": [{ "name": "Creatine monohydrate", "dose": "5g", "timing": "Morning" }],
  "injuries": [],
  "coachNotes": "• Training emphasis: posterior chain\n• Primary gaps: 3-5% BF reduction",
  "behaviourMemory": { "complianceScore": null, "currentFlags": [], "patterns": [], "weekSummaries": [] },
  "gapBridge": {
    "generatedAt": "YYYY-MM-DD",
    "weeklyFocus": "Add 2x weekly dedicated back width sessions",
    "training": [{ "change": "Posterior chain — lats, rhomboids, rear delts", "action": "note" }],
    "primaryGaps": ["Body fat reduction of 6-8 percentage points"],
    "applied": true
  },
  "overlays": [{ "id": "coach-xxx", "name": "...", "trigger": "pre-training", "active": true }]
}
```

---

## All Pages (49 total)

### Primary App Pages

| File | Purpose |
|------|---------|
| bodylens-dailyplan.html | **Core page (474kb).** Week strip with missed session "Move → today" chip, training blocks, meal plan, supplements, macros bar, coach narrative (reads coachNotes + gapBridge), "Plan updated" banner after decisions. Cache mismatch check on load. |
| bodylens-week.html | Training ledger. Day cards show session type + focus + keyExercises. Pending changes panel + decision log. |
| bodylens-decisions.html | **Decision audit trail.** Every proposal pending or committed. Filter tabs, before/after tables, Revert. |
| bodylens-goals.html | Goal gap analysis. Photo comparison → 6-stage structured output → blPropose('goals') staged for review. |
| bodylens-bodyscan.html | Body scan. Calls blPropose('body-scan') on save — logs changes to audit trail. |
| bodylens-supplements.html | Supplement stack — active stack + full catalogue with CSS cards, filter tabs, evidence badges. |
| bodylens-fridge.html | Fridge analysis. iPhone fix: canvas-resize to 1024px max before base64 (Vercel 4.5MB limit). |
| bodylens-onboard.html | Onboarding + programme generation |
| bodylens-instructions.html | Coaching report: 4 tabs |
| bodylens-programme.html | 12-week training programme |
| bodylens-meals.html | Meal planning and food log |
| bodylens-food.html | Food tracking, recipes, shopping |
| bodylens-checkin.html | Daily check-in |
| bodylens-bodymapper.html | Body mapper visual |
| bodylens-podcast.html | AI podcast |
| bodylens-sync.html | Supabase sync dashboard |
| bodylens-ideas.html | Product roadmap — 25 ideas ranked by priority |

### Science Library

bodylens-science.html (index), bodylens-alcohol.html, bodylens-hunger.html, bodylens-weightloss.html, bodylens-mentalhealth.html, bodylens-attia.html, bodylens-longevity.html, bodylens-body.html, bodylens-fuel.html, bodylens-insulin.html, bodylens-strength.html, bodylens-training.html, bodylens-optimal.html, bodylens-synthesis.html, bodylens-accelerators.html, bodylens-viability.html

---

## JS Infrastructure Files (18 total)

| File | Purpose | Size |
|------|---------|------|
| supabase-auth.js | Auth + localStorage intercept + Supabase sync + BL.* API | 21kb |
| nav.js | Nav injection. Includes Decisions link. | 34kb |
| **bl-proposals.js** | **Proposal bus.** blPropose, blCommitProposal, blDismissProposal, blRevertProposal, blApplyChanges, blGetPending, blGetProposalLog, render functions. Loaded by: dailyplan, week, goals, bodyscan. | 17kb |
| bl-changelog.js | Legacy changelog utility (kept; superseded by bl-proposals for new work) | 12kb |
| coach.js | Floating coach. Reads coachNotes + gapBridge in system prompt. saveNewInfo() → blPropose('coach') + immediate commit. | 87kb |
| dp-plan.js | buildPlan() — pure data, no DOM. Reads profile fields for day plan. | 51kb |
| dp-memory.js | Behaviour memory engine | 10kb |
| dp-debrief.js | Debrief conversation + notification engine | 19kb |
| dp-reconcile.js | Weekly reconciliation (structure only — logic not built) | 14kb |
| activitylog.js | Activity log overlay | 21kb |
| risk-classifier.js | Health risk pre-pass before coaching advice | 18kb |
| page-generator.js | Page generation utilities | 67kb |
| profile-inject.js / profile-manager.js | Profile utilities | 15kb / 24kb |
| pwa.js | PWA install prompt | 12kb |
| api/chat.js | Vercel serverless Claude proxy | 4kb |
| api/tts.js | TTS proxy | 4kb |
| sw.js | Service worker | 6kb |

---

## Daily Plan — Technical Detail

On load:
1. `_blInit()` runs immediately from localStorage
2. `TODAY = getTodayCtx(P)` — reads weekPlan + week override
3. **Cache mismatch check** — if cached plan training status ≠ TODAY.isTraining, bust cache
4. If valid cache: `renderPlan(cached)` → `renderRecentChangeBanner(P)`
5. If no cache: "Build today's plan →" → `buildDay()` → `buildPlan()` → `renderPlan()` → `renderRecentChangeBanner(P)`
6. `generateCoachNarrative()` prompt: protein, macros, week context, injuries, lifts, multiweek signal, **coachNotes**, **gapBridge.weeklyFocus/training/primaryGaps**

### Missed session recovery
- `getMissedSessions(P)` flags past training days with no `trainStatus: 'done'`
- Amber "Move → today" chip on week strip missed day
- `quickRecoverToToday()` → `applyRecovery()` → bust cache → reload

---

## Coach — How It Reads Decisions

`buildSystemPrompt()` injects into every conversation:
- `behaviourMemory` — compliance score, flags, patterns, recent weeks
- `profile.overlays` — as "ACTIVE DAILY OVERLAYS"
- `profile.coachNotes` — as "PROGRAMME NOTES" (key field — every committed decision lands here)
- `profile.gapBridge` — weeklyFocus, currentPhase, primaryGaps, coachContext

---

## Deployment — CRITICAL

**Before every session:** fetch key deployed files and compare sizes to local. If different, identify which is correct before building anything.

**Never** ship a file that depends on another file that isn't confirmed deployed.

**After every upload:** browser-test the critical path. Don't declare done until it works live.

---

## Known Issues

| # | Issue | Status |
|---|-------|--------|
| 1 | `activities` + `week_ledger` Supabase tables missing | Run supabase-schema-missing-tables.sql |
| 2 | Weekly reconciliation pass not built | dp-reconcile.js exists; cron + day_log read + blPropose needed |
| 3 | trainingEmphasis not read by coach or daily plan | profile.trainingEmphasis exists but unused |
| 4 | Decisions page not independently synced to Supabase | Travels via bl_profile — not independently queryable |
| 5 | Auth gate / paywall not live | Built but not deployed |

---

## What's Live

- Full onboarding → programme generation
- Daily plan with missed session recovery, coach narrative reads decisions, plan updated banner
- Proposal bus (goals, coach, body scan wired)
- Decisions page — full audit trail with revert
- Week page with session detail, pending proposals panel, decision log
- Goal gap analysis → staged proposals
- Science library (15+ pages)
- Fridge (iPhone photo fix), supplements (full catalogue CSS), body scan (logs to audit trail)
- Google OAuth + Supabase sync live
- PWA installable

## What's Not Built

- Weekly reconciliation (Monday cron → adapt from logs → blPropose)
- Auth gate / trial / Stripe
- Progress photo comparison
- Streak counter
- Push notifications
- Weekly coaching email
- Wearable integration (Oura, Apple Health)

---

## Starting a New Session

> I'm continuing work on BodyLens — my AI health platform. Read the full project brief at: https://raw.githubusercontent.com/Schnufdi/Soma/main/README.md
>
> After reading it, confirm you understand the project and tell me the current known issues in priority order. Then we'll continue from there.

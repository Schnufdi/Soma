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

**Demo user (Sven):** Male, 44, 181cm, 87kg, 18-22% BF, body recomposition, 4 days/week, full commercial gym, morning sessions, Mediterranean+Asian diet, moderate stress, 7-8h sleep. Training split: Mon Push / Wed Pull / Fri Posterior Chain / Sat Upper. Macros: 2769kcal training / 2492kcal rest, 174g protein, 323g carbs, 87g fat.

---

## Live URLs

- **Site:** https://soma-two-chi.vercel.app
- **Repo:** https://github.com/Schnufdi/Soma (public, flat root)
- **Daily plan:** https://soma-two-chi.vercel.app/bodylens-dailyplan.html
- **Data sync:** https://soma-two-chi.vercel.app/bodylens-sync.html
- **Onboarding:** https://soma-two-chi.vercel.app/bodylens-onboard.html
- **Report:** https://soma-two-chi.vercel.app/bodylens-instructions.html

---

## Stack

| Layer | Detail |
|-------|--------|
| Frontend | Pure HTML/CSS/JS. No framework. Single-file pages. |
| Styling | style.css — global design system (2409 lines, 78kb). Jade + rose themes. CSS variables. |
| Navigation | nav.js — IIFE injected into every page. Single source of truth for all nav. |
| AI | Claude Sonnet via /api/chat (Vercel serverless proxy). Model: claude-sonnet-4-20250514 |
| Auth | Supabase Google OAuth — **live and integrated**. Session stored as `sb-[projectref]-auth-token` |
| Storage | localStorage-first + Supabase sync via setItem intercept (see Data Storage below) |
| Deployment | Vercel auto-deploys on GitHub main push |
| Supabase URL | https://ubbqyhkjijpjpqdhhhvp.supabase.co |
| Supabase anon key | eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InViYnF5aGtqaWpwanBxZGhoaHZwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQyOTkxODEsImV4cCI6MjA4OTg3NTE4MX0.VK-AvEFr_cmXT7k44mvR9UxVlGRXL8Cu6mgXBQbQov8 |
| Sven's user ID | e65eb373-0d2b-4aa0-bff8-6bf714eef16b |

---

## Data Storage — Complete Picture

### Architecture: localStorage-first + Supabase sync

`supabase-auth.js` overrides `localStorage.setItem` globally. Every write to localStorage is intercepted and, if the user is signed in (`window._blUser` + `window._sb` exist), mirrored to Supabase immediately in the background. Local state is always the source of truth; Supabase is the persistence layer.

On sign-in, `BL.restoreHistory()` pulls the last 30 days of data from Supabase back into localStorage.

### localStorage Keys → Supabase Mapping

| localStorage key | Supabase destination | Notes |
|-----------------|---------------------|-------|
| `bl_profile` | `profiles.profile` (jsonb) | Full profile, programme, weekPlan, supplements, macros targets, behaviourMemory |
| `bl_daylog_YYYY-MM-DD` | `day_logs` table | Training status, meals logged, supplement ticks, energy, notes, debrief |
| `bl_macros_YYYY-MM-DD` | `macros` table | Daily protein/kcal eaten vs target |
| `bl_weekly_meals_YYYY-MM-DD` | `meal_plans` table | Generated weekly meal plan |
| `bl_activities_YYYY-MM-DD` | `activities` table | Activity log entries |
| `bl_weekledger_YYYY-MM-DD` | `week_ledger` table | Training week view data |
| `bl_strength_baseline` | `profiles.strength_baseline` | 1RM benchmarks and performance baselines |
| `bl_scan_history` | `profiles.scan_data` | Body scan history |
| `bl_scan_raw_text` | `profiles.scan_data` | Raw body scan text |
| `bl_podcast_history` | `profiles.podcast_history` | Episode listening history |
| `bl_report_*` | `profiles.latest_report` | Latest generated coaching report |
| `bl_fridge_restock` | `profiles.fridge_data` | Fridge/pantry state |
| `bl_shop_checks` | `profiles.shop_data` | Shopping checklist state |

### LOCAL ONLY (intentionally not synced)

| localStorage key | Reason |
|-----------------|--------|
| `dayplan_v6r3_YYYY-MM-DD` | AI-generated cache. Regeneratable from profile via API. |
| `bl_recipe_{slot}_YYYY-MM-DD` | Same — regeneratable cache. |
| `bl_pin_store` | Security. PIN→profile vault must stay local. |
| `bl_formdata_backup` | Raw onboarding form answers. Recovery fallback only. |
| `bl_theme` | UI preference only. |
| `bl_current_pin` | UI state only. |
| `bl_disclaimer_dismissed` | UI state only. |

### Supabase Tables

| Table | Key columns | Purpose |
|-------|-------------|---------|
| `profiles` | `id`, `email`, `name`, `profile` (jsonb), `strength_baseline`, `scan_data`, `podcast_history`, `latest_report`, `fridge_data`, `shop_data` | User profile and all personal data blobs |
| `day_logs` | `user_id`, `date`, `data` (jsonb) | One row per user per day |
| `macros` | `user_id`, `date`, `data` (jsonb) | Daily macro tracking |
| `meal_plans` | `user_id`, `week_start`, `data` (jsonb) | Weekly meal plans |
| `activities` | `user_id`, `date`, `data` (jsonb) | Activity logs |
| `week_ledger` | `user_id`, `week_start`, `data` (jsonb) | Weekly training ledger |
| `profile_history` | `user_id`, `change_type`, `payload` | Append-only changelog of weight/profile changes |

All tables have RLS enabled. Policy: `auth.uid() = user_id`.

### Data Sync Page

`/bodylens-sync.html` — real-time reconciliation view showing localStorage vs Supabase side by side.
Auth banner, summary strip (4 cards), field-by-field profile diff, day log table, macro table, meal plan table. Push/pull per row and bulk push-all/pull-all.

---

## All Pages

### Primary App Pages

| File | Purpose |
|------|---------|
| bodylens-dailyplan.html | **Core page.** Daily plan: week strip, training blocks, meal plan, supplements, macros bar, coach narrative, SOS panel. **429kb** (reduced from 512kb — plan builder, memory engine, and debrief extracted to separate files). |
| bodylens-onboard.html | Onboarding form + AI follow-up chat + programme generation |
| bodylens-instructions.html | Coaching report: 4 tabs (Coach Report, Programme Data, Full Brief, Logic & Calibration) |
| bodylens-programme.html | 12-week training programme view |
| bodylens-week.html | Training ledger — week view with per-session logs |
| bodylens-meals.html | Meal planning and food log |
| bodylens-food.html | Food tracking, recipe generation, macro tracker, shopping list |
| bodylens-supplements.html | Supplement stack with goal-matching and timing guide |
| bodylens-goals.html | Goal setting and progress tracking |
| bodylens-checkin.html | Daily check-in (energy, sleep, mood, notes) |
| bodylens-bodyscan.html | Body scan / measurements + coach analysis |
| bodylens-bodymapper.html | Body mapper visual tool |
| bodylens-podcast.html | AI podcast / audio content |
| bodylens-sync.html | Data sync / reconciliation dashboard |
| bodylens-login.html | Google OAuth login page |
| bodylens-profile.html | Profile view and edit |
| bodylens-export.html | Data export |
| bodylens-reset.html | Profile reset / onboarding restart |
| bodylens-fridge.html | Fridge and pantry management |

### Science Library

| File | Score | Notes |
|------|-------|-------|
| bodylens-alcohol.html | 9/10 | Strongest page |
| bodylens-hunger.html | 9/10 | |
| bodylens-weightloss.html | 8/10 | |
| bodylens-mentalhealth.html | 8/10 | Soften SSRIs claim |
| bodylens-attia.html | 8/10 | Fix ApoB target |
| bodylens-longevity.html | 7/10 | |
| bodylens-body.html, bodylens-fuel.html, bodylens-insulin.html, bodylens-strength.html, bodylens-training.html, bodylens-optimal.html, bodylens-synthesis.html | — | |
| bodylens-science.html | — | Index page |
| bodylens-accelerators.html | — | Supplements science |

### Infrastructure Files

| File | Purpose | Size |
|------|---------|------|
| supabase-auth.js | Auth + localStorage intercept + Supabase sync + BL.* API | 20kb |
| nav.js | Nav injection IIFE. Injects full nav into every page. Auth gate included. | 31kb |
| style.css | Global design system. CSS variables, jade/rose themes. | 78kb |
| api/chat.js | Vercel serverless. Proxies all Claude API calls. Uses ANTHROPIC_API_KEY env var. | 4kb |
| sw.js | Service worker — PWA offline support | — |
| dp-plan.js | **Extracted from dailyplan.** buildPlan() + applyOptimisations() + getOptIds(). Pure data, no DOM. | 43kb |
| dp-memory.js | **Extracted from dailyplan.** Behaviour memory engine: compressAndSaveMemory, openDebrief, checkDebriefNeeded. | 10kb |
| dp-debrief.js | **Extracted from dailyplan.** Debrief conversation engine: DB object, DB_STEPS, dbRender, dbNext, dbWriteToLog. Notification engine. | 18kb |
| activitylog.js | Activity log overlay UI and logic. | 21kb |

---

## supabase-auth.js — BL API

All public methods on `window.BL`:

| Method | Purpose |
|--------|---------|
| `BL.signInWithGoogle()` | Initiates Google OAuth flow |
| `BL.signOut()` | Signs out, clears session |
| `BL.saveProfile(profile)` | Upserts to `profiles` table |
| `BL.loadProfile(cb)` | Fetches from Supabase, writes localStorage, calls cb(profile) |
| `BL.restoreHistory()` | Pulls 30 days of day_logs, macros, meal_plans, activities, week_ledger into localStorage |
| `BL.logProfileChange(newProfile)` | Diffs vs last state, appends weight/supplement changes to profile_history |
| `BL.showUserMenu()` | Renders user account dropdown |

### Auth Race Condition — Daily Plan

`bodylens-dailyplan.html` exposes `window._blInit`. On page load: `_blInit()` runs immediately from localStorage. If profile is incomplete it shows an error screen. ~500ms later Supabase auth resolves, `BL.loadProfile()` fetches the full profile, then checks if the error screen is showing and calls `window._blInit()` again to re-render correctly.

---

## Programme Generation — JSON Schema

```json
{
  "name": "Sven", "age": 44, "weight": 87, "height": 181, "sex": "Male",
  "goal": "Body recomposition",
  "trainingKcal": 2769, "restKcal": 2492, "calories": 2769,
  "protein": 174, "carbs": 323, "fat": 87, "tdee": 2769,
  "trainingDays": 4, "wakeTime": "07:00", "programmeWeeks": 12,
  "generatedAt": "ISO string",
  "weekPlan": [
    { "day": "Monday", "type": "Push", "focus": "Chest, shoulders, triceps", "priority": "training" },
    { "day": "Tuesday", "type": "Rest", "focus": "Recovery", "priority": "rest" }
  ],
  "supplements": [
    { "name": "Creatine monohydrate", "dose": "5g", "timing": "Daily, any time" }
  ],
  "injuries": [],
  "coachSummary": "string",
  "behaviourMemory": "rolling AI coach narrative — updated on every debrief",
  "weeklyProgression": { "week1": "", "week2": "", "week3": "", "week4": "" }
}
```

---

## Onboarding — formData Fields

**Numeric:** f-age, f-height, f-weight
**Text:** f-target, f-injury-detail, f-eatwin, f-healthconds
**Single-select:** sex, bf, exp, days, wake, gym, fwcomfort, traintime, energy, firstmeal, cooking, complexity, diet, sleep, bedtime, sleepquality, alcohol, stress, caffeine, diethistory, activity
**Goal card:** goal
**Multi-select:** fat, equipment, recovery, cuisines, triggers, nonneg
**Injury toggle:** injuries array

---

## Deployment Method — CRITICAL

Vercel auto-deploys on every GitHub main push (~30 seconds). To edit files, use GitHub's web editor with CodeMirror 6 via browser console:

```javascript
// 1. Navigate to: github.com/Schnufdi/Soma/edit/main/[filename]
// 2. Open browser console:
var view = document.querySelector('.cm-content').cmView.rootView.view;
var doc = view.state.doc.toString();

// 3. Find + replace:
var start = doc.indexOf('UNIQUE_STRING_TO_FIND');
var end = doc.indexOf('\n}\n', start) + 3;
view.dispatch(view.state.update({changes: {from: start, to: end, insert: newCode}}));

// 4. Click "Commit changes"
```

---

## Known Issues (Priority Order)

| # | Issue | Fix status |
|---|-------|-----------|
| 1 | `activities` + `week_ledger` tables don't exist in Supabase yet | Run supabase-schema-missing-tables.sql in Supabase SQL editor |
| 2 | `profiles` table missing columns: strength_baseline, scan_data, podcast_history, latest_report, fridge_data, shop_data | Same SQL file |
| 3 | dp-plan.js, dp-memory.js, dp-debrief.js need uploading to GitHub root | New files — must be in repo or dailyplan will break |
| 4 | Daily plan macro table renders twice (visual bug) | Fixed in bodylens-dailyplan.html — needs upload |
| 5 | Auth gate redirect (`?next=`) not yet tested end-to-end | Built — needs deploy + test |

---

## What's Live and Working

- Full onboarding → programme generation pipeline
- Coaching report with 4 tabs
- Daily plan: week strip, training blocks, meal slots, supplements, macros bar, coach narrative, debrief, SOS, guided voice
- Science library (15+ pages)
- Food, fridge, supplement, goals, body scan, body mapper, podcast pages
- Theme toggle jade/rose
- Profile: PIN vault + JSON export/import
- Google OAuth — live and integrated, session persists
- Supabase sync — profile + day_logs + macros + meal_plans live
- Data sync page at /bodylens-sync
- PWA installable

## What's Not Built Yet

- Auth gate
- Weekly review / progress visualisation
- Apple Health / Garmin integration
- Training weight log + PR detection
- Push notifications

---

## Business Context

- **Not a fitness app** — health intelligence. The empty category.
- **Tiers:** Free (science only) / Personal £14.99/mo / Performance £39.99/mo
- **Target:** £500k ARR = 2,800 subscribers = financial independence
- **Path to £2M ARR:** 9,000 Personal + 500 Performance. 40-45% probability. 24 months.
- **Retention is everything.** 85%+ at 90 days.

---

## Starting a New Claude Session

Paste this at the start:

> I'm continuing work on BodyLens — my AI health platform. Read the full project brief at: https://raw.githubusercontent.com/Schnufdi/Soma/main/README.md
>
> After reading it, confirm you understand the project and tell me the current known issues in priority order. Then we'll continue from there.

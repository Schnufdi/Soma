# BodyLens — Project Brief for Claude

> Paste this URL into any new Claude chat: https://raw.githubusercontent.com/Schnufdi/Soma/main/README.md
> Then say: "Read this file and use it as full context for continuing work on BodyLens."

---

## What BodyLens Is

AI-native personalised health intelligence platform. NOT a fitness app. The product is the WHY behind health science, personalised by AI to each user. Closest reference: Huberman/Attia depth at consumer price point with full AI personalisation.

**The flow:** Onboarding form (13 questions) → AI follow-up chat (3-6 exchanges) → Full programme generation (macros, 7-day training split, supplements, injury modifications, coach summary) → Daily plan + floating coach + science library.

**Owner:** Sven Konigsmann. 44yo. Senior finance background (TP ICAP VP, Barclays, HSBC, Lloyds, ANZ). Self-funded sabbatical. Co-founder: Seamus (17+ years senior marketing). Budget: £5-10k. Target: £500k ARR = financial independence.

---

## Live URLs

- **Site:** https://soma-two-chi.vercel.app
- **Repo:** https://github.com/Schnufdi/Soma (public, flat root)
- **Onboarding:** https://soma-two-chi.vercel.app/bodylens-onboard.html
- **Daily plan:** https://soma-two-chi.vercel.app/bodylens-dailyplan.html
- **Report:** https://soma-two-chi.vercel.app/bodylens-instructions.html

---

## Stack

| Layer | Detail |
|-------|--------|
| Frontend | Pure HTML/CSS/JS. No framework. Single-file pages. |
| Styling | style.css — global design system, jade + rose themes |
| Navigation | nav.js — IIFE injected into every page |
| AI | Claude Sonnet 4 (claude-sonnet-4-20250514) via /api/chat |
| Auth | Supabase Google OAuth (configured, not yet integrated into app) |
| Storage | localStorage only — no backend yet |
| Deployment | Vercel auto-deploys from GitHub main pushes |
| Supabase URL | https://ubbqyhkjijnjpqdhhvp.supabase.co |

---

## All Files

### Core App
- bodylens-onboard.html — Onboarding + AI follow-up + programme generation (1835 lines)
- bodylens-instructions.html — Coaching report (4 tabs: Coach Report, Programme Data, Full Brief, Logic & Calibration)
- bodylens-dailyplan.html — Daily plan: split two-column timeline + always-visible coach prose (114kb LIVE — local copy corrupt, always edit from GitHub)
- bodylens-day.html — Alternative today view with SOS panel, quiz, body scan widget
- bodylens-food.html — Food tracking, recipe generation, macro tracker
- bodylens-programme.html — 4-week programme view
- bodylens-bodyscan.html — Body scan / measurements
- bodylens-checkin.html — Daily check-in
- bodylens-guide.html — User guide
- bodylens-howitworks.html — How it works explainer
- bodylens-science.html — Science library index
- bodylens-login.html — Google OAuth login (LOCAL ONLY — not in repo yet)
- bodylens-accelerators.html — Supplements science

### Science Pages (audited 8.2/10 overall)
- bodylens-alcohol.html (9/10 — strongest page)
- bodylens-hunger.html (9/10)
- bodylens-weightloss.html (8/10)
- bodylens-mentalhealth.html (8/10 — soften SSRIs claim)
- bodylens-attia.html (8/10 — fix ApoB target)
- bodylens-longevity.html (7/10)
- bodylens-body.html, bodylens-fuel.html

### Infrastructure
- nav.js — Nav injection. LOCAL (21kb) newer than live (19kb). Safari timing fix not deployed.
- profile-manager.js — Profile persistence: PIN, JSON export/import, theme toggle. LOCAL (24kb) newer than live (22kb).
- style.css — Global styles + jade + rose theme blocks
- api/chat.js — Vercel serverless. Proxies all AI calls. Uses ANTHROPIC_API_KEY env var.
- sw.js — Service worker PWA
- coach.js — Coach chat logic
- page-generator.js — Dynamic page generation

---

## localStorage Keys

| Key | Contents |
|-----|----------|
| bl_profile | Full generated profile JSON |
| bl_theme | 'jade' or 'rose' |
| bl_pin_store | PIN → profile map |
| dayplan_v5_YYYY-MM-DD | Cached daily plan |
| bl_recipe_{slot}_{date} | Cached recipes |
| bl_macros_YYYY-MM-DD | Daily macro tracking |
| bl_coach_history | Coach conversation history |
| bl_scan_history | Body scan history (up to 5) |
| bl_formdata_backup | Raw form answers (recovery fallback) |

---

## Onboarding — formData Fields

**Numeric inputs:** f-age, f-height, f-weight
**Text inputs:** f-target (physique goal), f-injury-detail, f-eatwin, f-healthconds
**Single-select (selectSingle):** sex, bf, exp, days, wake, gym, fwcomfort, traintime, energy, firstmeal, cooking, complexity, diet, sleep, bedtime, sleepquality, alcohol, stress, caffeine, diethistory, activity
**Goal card (selectGoal):** goal — uses .ob2-goal-card elements
**Multi-select (selectMulti):** fat, equipment, recovery, cuisines, triggers, nonneg
**Injury (toggleInjury):** injuries array — .ob2-injury-area elements

**Demo profile (Sven):** Male, 44, 181cm, 87kg, 18-22% BF, Body recomposition, 5+ years, 4 days/week, Full commercial gym, Barbells+Dumbbells+Machines, Morning sessions, Home cooking, Mediterranean+Asian, No restrictions, Social weekends alcohol, Moderate stress, 7-8h sleep, 10-11pm bedtime, Sauna, Morning coffee.

---

## Programme Generation — JSON Schema

```
{
  profile: { goal, calories, protein, carbs, fat, tdee, calorieReasoning, proteinReasoning, fastingWindow, mealCount, keyFoodPrinciples[], triggerStrategy },
  weekPlan: [{ day, type, focus, kcal, priority, keyExercises[], modifications[], coachNote }],  // 7 entries Mon-Sun
  injuries: [{ location, assessment, avoidMovements[], safeAlternatives[], rehabilitationNotes }],
  supplements: [{ name, dose, timing, reason }],
  coachSummary: "3-4 sentences",
  weeklyProgression: { week1, week2, week3, week4 },
  programmeGoal: string,
  reassessmentTriggers: []
}
```

Calorie calc: Mifflin-St Jeor BMR × activity multiplier. -350 deficit for fat loss, +200 surplus for muscle.

---

## Deployment Method — CRITICAL

GitHub's web editor uses CodeMirror 6. Access the editor programmatically:

```javascript
// 1. Go to: github.com/Schnufdi/Soma/edit/main/[filename]
// 2. In browser console:
var view = document.querySelector('.cm-content').cmTile.view;
var doc = view.state.doc.toString();

// 3. Find what to replace:
var start = doc.indexOf('function fillDemo()');
var end = doc.indexOf('\n}\n', start) + 3;

// 4. Replace it:
view.dispatch(view.state.update({changes: {from: start, to: end, insert: newCode}}));

// 5. Click "Commit changes" button that appears
```

This is the ONLY reliable way to edit files. File uploads are blocked by browser security. GitHub API is blocked by container network policy.

---

## Known Bugs (Priority Order)

1. **bodylens-login.html not in repo** — exists locally, needs creating in GitHub
2. **nav.js local (21kb) newer than live (19kb)** — Safari profile/theme buttons don't appear on fresh load
3. **profile-manager.js local (24kb) newer than live (22kb)** — same Safari issue
4. **No auth gate** — all pages accessible without login
5. **bodylens-dailyplan.html LOCAL IS CORRUPT** — always edit from GitHub, never from local
6. **ABORT in chat** — uncertain if live in current deployed version

---

## What's Live and Working

- Full onboarding → programme generation pipeline
- Coaching report with 4 tabs including Logic & Calibration
- Daily plan with split timeline + always-visible coach prose
- Science library (6 pages)
- Food page with recipe generation + macro tracking
- Body scan with coach analysis
- Floating coach chat on all pages
- Theme toggle jade/rose
- Profile persistence: PIN + JSON export/import
- Google OAuth (auth works, not integrated into app flow)
- fillDemo button — FIXED commit a56a560 (fills all fields)
- PWA installable

## What's Not Built Yet

- Supabase backend (auth gate + profile persistence across devices)
- Weekly review feature
- Progress visualisation page
- Evidence tier badges on science pages
- Voice input for coach
- Apple Health / Garmin integration
- Training weight log + PR detection
- Female hormonal cycle science page

---

## Business Context

- **Not a fitness app** — health intelligence. The empty category.
- **Science audit:** 8.2/10 overall. Three fixes needed: hedge alcohol dose-response %, soften SSRIs claim, fix ApoB target <60 vs <80.
- **Revenue:** Free (science only) / Personal £14.99/mo / Performance £39.99/mo
- **Target:** £500k ARR = 2,800 subscribers = financial independence (don't go back to work)
- **Path to £2M ARR:** 9,000 Personal + 500 Performance subscribers. 40-45% probability. 24 months.
- **Retention is everything.** 85%+ at 90 days. Nothing else matters if this fails.

---

## Prompt for New Claude Session

Paste this at the start of a new chat:

> I'm continuing work on BodyLens — my AI health platform. Read the full project brief at: https://raw.githubusercontent.com/Schnufdi/Soma/main/README.md
>
> After reading it, confirm you understand the project and tell me the current known bugs in priority order. Then we'll continue from there.

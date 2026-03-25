# BodyLens — Product Roadmap & Ideas Log

> Living document. Updated as we build. Ideas captured here before they're lost.

---

## Current Status — Web App (soma-two-chi.vercel.app)

### ✅ Shipped
- Full onboarding with AI programme generation
- Daily plan page — timeline, meals, macros, coach narrative
- Training session panel with exercise cards
- Live gym coach — full session experience (warmup, cues, rest timer ring, RPE logging, AI post-session summary)
- Week review — per-day stats, exercise breakdown, AI narrative
- End-of-day debrief system
- Notification engine (local, opt-in)
- Weekly meal planner — 7-day generation, B/L/D/S slots, repeat pattern for prep
- Custom meal builder
- Accelerators — 22 optimisations injected into daily plan
- Deep Stack supplements page — 13 compounds with goal-specific benefit text
- Body type selector in onboarding
- Progress banner — Day N of 28, streaks, sessions
- Quick log strip — sleep/energy/training from bottom of today
- Jump to Now / Jump to Session shortcuts
- Mobile nav — hamburger overlay + bottom tab bar
- Coach chat with voice input (mic)

### 🔄 In Progress / Known Issues
- Meal planner output not yet feeding back into Today page meal slots (schema mismatch — daily plan reads `midday/evening`, new planner uses `breakfast/lunch/dinner/snack`)
- Weekly meal plan needs 4-slot schema sync with daily plan

---

## Near-Term Priorities

### P1 — Critical Fixes
- [ ] Sync meal planner slots (breakfast/lunch/dinner/snack) with daily plan block types
- [ ] Body scan page — build the actual scan functionality
- [ ] Report page — build the 4-week progress report
- [ ] Vault — profile management page

### P2 — Gym Coach Enhancements
- [ ] Audio cues — browser TTS for set counts, rest timer end, transitions
- [ ] Vibration feedback — haptic on set done, timer end (navigator.vibrate)
- [ ] Previous session comparison — "Last week you did 4×6 at 20kg"
- [ ] Progressive overload suggestions — based on logged RPE, suggest +2.5kg
- [ ] Superset support — link two exercises, no rest between
- [ ] Custom rest period per exercise (compound = 120s, isolation = 60s)

### P3 — Meal System
- [ ] Shopping list generation from weekly meal plan
- [ ] Prep guide — which meals to batch cook on Sunday
- [ ] Macro-accurate ingredient substitutions
- [ ] "I don't have X" swap — regenerate single ingredient
- [ ] Calorie cycling visualiser across the week

### P4 — Tracking & History
- [ ] Strength progression charts — per exercise, per muscle group
- [ ] Body composition trend — weight + waist over 4-week block
- [ ] Weekly comparison — this week vs last week
- [ ] 4-week block review — AI narrative on the full block
- [ ] Export data — CSV or PDF of training log

---

## iPhone Extension (Future)

> The web app is the development environment. The iPhone app is the end product. Build web-first, then port.

### Session Experience (Phase 1 — iOS)
- Native full-screen gym coach with proper haptics
- Apple Watch integration — rest timer on wrist, heart rate overlay
- Background audio — coach voice cues even with screen off
- Siri integration — "Hey Siri, start my Pull session"
- Offline mode — session runs without internet (data syncs after)

### Notifications (Phase 1 — iOS)
- True push notifications (not browser-based)
- Post-meal walk reminder (20 min after meal logged)
- Training day morning nudge (8am)
- Evening debrief prompt (8pm if unlogged)
- Weekly review reminder (Sunday evening)
- Smart quiet hours (learns your sleep schedule)

### Social / Accountability (Phase 2)
- Share session summary (e.g. "Completed Pull — 12 sets, 45 min")
- Training partner pairing — see each other's sessions
- Coach-client mode — coach sees client's full log in real time

### Advanced Personalisation (Phase 2)
- Wearable integration — Garmin/Whoop/Oura for recovery data
- Auto-adjusting programme — RPE data feeds back into next week's loads
- Menstrual cycle integration — adjust training intensity per phase
- Travel mode — hotel gym / minimal equipment variants
- Injury mode — auto-substitutes contraindicated movements

### Monetisation (Phase 3)
- Free tier: 1 programme, limited history
- Pro tier: unlimited programmes, full history, advanced analytics
- Coach tier: multi-client management, session programming
- Marketplace: sell programmes to other users

---

## Feature Ideas (Unsorted)

- **Meal scan** — photo a meal, estimate macros via AI vision
- **Supplement timing reminders** — "Take creatine now" notification
- **Fasting timer** — track eating window, countdown to next window
- **Hydration tracking** — log glasses, running total vs target
- **Posture / form check** — camera-based form analysis (long term)
- **Gym partner mode** — shared session, alternating sets
- **Warm-up generator** — standalone warmup based on muscle group
- **Deload week auto-detect** — after 3 hard weeks, suggest deload
- **Rest day protocol** — structured rest day activities (NSDR, walk, stretch)
- **Personal records** — track lifetime PRs per exercise
- **Muscle group heatmap** — visual body showing what was trained
- **Voice journaling** — speak notes into session log
- **AI coaching dialogue** — ongoing conversation between sessions ("how did you sleep?")
- **Supplement cycling reminders** — "Rhodiola cycle ends in 3 days"
- **Event prep mode** — count down to holiday, event, photoshoot

---

## Technical Debt

- [ ] Recipe slot schema mismatch (meal planner vs daily plan)
- [ ] Profile manager page needs building (Vault)
- [ ] Service worker / offline caching for gym use
- [ ] PWA install prompt — add to home screen nudge
- [ ] localStorage size limits — need cleanup strategy for old daylogs
- [ ] API error handling — more graceful fallbacks throughout
- [ ] nav.js BOTTOM_TAB_HTML — BOTTOM_TAB_HTML variable defined but not yet referenced in older doInject path

---

## Design Principles

1. **Text only until audio is right** — no browser TTS, wait for native iOS voices
2. **Never interrupt a set** — all prompts wait for natural breakpoints
3. **Minimal invasion** — the coach observes and nudges, never demands
4. **Progressive disclosure** — basic first, depth on tap
5. **iOS-first patterns** — build mobile-native from day one even on web
6. **Data owns the experience** — everything gets smarter as you log more

---

*Last updated: March 2026*

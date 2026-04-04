// ── NAV INJECTION — single source of truth ───────────────
// This runs immediately and replaces ANY nav on the page.
// No page can have a different menu — it all comes from here.
(function injectNav() {
  const NAV_HTML = `<nav class="site-nav">
  <div class="nav-left">
    <a class="nav-brand" href="/bodylens-dailyplan.html">Soma<span class="sync-dot" id="sync-dot" title="Sync status"></span></a>
  </div>
  <div class="nav-core">
    <a class="nav-link" href="/bodylens-dailyplan.html">Today</a>
    <a class="nav-link" href="/bodylens-week.html">Week</a>
    <span class="nav-core-sep"></span>
    <a class="nav-link" href="/bodylens-meals.html">Meals</a>
    <span class="nav-core-sep"></span>
    <a class="nav-link" href="/bodylens-goals.html">Goals</a>
    <a class="nav-link" href="/bodylens-supplements.html">Stack</a>
    <div class="nav-more-wrap">
      <button class="nav-more-btn" id="nav-more-btn" onclick="toggleNavMore(event)" aria-label="More pages">More</button>
      <div class="nav-more-panel" id="nav-more-panel">
        <div class="nmp-grid">
          <div class="nmp-col">
            <div class="nmp-label">Train</div>
            <a class="nmp-link" href="/bodylens-programme.html">Programme</a>
            <a class="nmp-link" href="/bodylens-history.html">Performance log</a>
            <a class="nmp-link" href="/bodylens-checkin.html">Week review</a>
            <a class="nmp-link" href="/bodylens-bodyscan.html">Body scan</a>
          </div>
          <div class="nmp-col">
            <div class="nmp-label">Nutrition</div>
            <a class="nmp-link" href="/bodylens-food.html">Food hub</a>
            <a class="nmp-link" href="/bodylens-fridge.html">Fridge</a>
            <a class="nmp-link" href="/bodylens-mealbuilder.html">Meal builder</a>
            <a class="nmp-link" href="/bodylens-decisions.html">Decisions</a>
          </div>
          <div class="nmp-col">
            <div class="nmp-label">Learn</div>
            <a class="nmp-link" href="/bodylens-science.html">Science</a>
            <a class="nmp-link" href="/bodylens-accelerators.html">Accelerators</a>
            <a class="nmp-link" href="/bodylens-podcast.html">Podcast</a>
            <a class="nmp-link" href="/bodylens-bodymapper.html">Body Mapper</a>
          </div>
          <div class="nmp-col">
            <div class="nmp-label">Admin</div>
            <a class="nmp-link" href="/bodylens-sync.html" style="color:var(--amber)">Data sync</a>
            <a class="nmp-link" href="/bodylens-guide.html">Guide</a>
            <a class="nmp-link" href="/bodylens-howitworks.html">How it works</a>
            <a class="nmp-link" href="/bodylens-ideas.html" style="color:var(--jade)">Ideas</a>
          </div>
        </div>
      </div>
    </div>
  </div>
  <div class="nav-end">
    <div class="nav-meta" id="nav-meta"></div>
    <div class="vault-wrap" id="vault-wrap">
      <button class="vault-trigger" id="vault-trigger" onclick="toggleVaultDropdown(event)" title="Vault">&#x2B21; Vault</button>
      <div class="vault-drop" id="vault-drop">
        <div class="vd-section">Strategy</div>
        <a class="vd-link" href="/bodylens-strategy.html">The Business Case</a>
        <a class="vd-link" href="/bodylens-story.html">The Story</a>
        <a class="vd-link" href="/bodylens-nonneg.html">Non-Negotiables</a>
        <div class="vd-section">Viability</div>
        <a class="vd-link" href="/bodylens-viability3.html">Viability Analysis <span class="vd-badge">Rev 4</span></a>
        <a class="vd-link" href="/bodylens-viability2.html" style="opacity:.6">Rev 2</a>
        <a class="vd-link" href="/bodylens-viability.html" style="opacity:.6">Rev 1</a>
        <div class="vd-section">Intelligence</div>
        <a class="vd-link" href="/bodylens-intelligence-full.html">Full Intelligence Doc</a>
        <a class="vd-link" href="/bodylens-instructions.html">Instructions</a>
        <div class="vd-divider"></div>
        <div class="vd-section">App</div>
        <a class="vd-link" href="/bodylens-profiles.html">&#x2B21; Profile Vault</a>
        <a class="vd-link" href="/bodylens-coachplan.html">Coaching Plan</a>
        <a class="vd-link" href="/bodylens-strength.html">Strength Baseline</a>
        <a class="vd-link" href="/bodylens-mealbuilder.html">Meal Builder</a>
        <a class="vd-link" href="/bodylens-export.html">Export Data</a>
        <a class="vd-link" href="/bodylens-reset.html" style="color:rgba(220,80,60,.75)">Reset</a>
      </div>
    </div>
    <button class="nav-hamburger" onclick="toggleMobileMenu()" aria-label="Menu">&#9776;</button>
  </div>
</nav>

<!-- Beta / security disclaimer -->
<div class="site-disclaimer" id="site-disclaimer">
  <span class="sd-icon">🔬</span>
  <span class="sd-text">Beta &mdash; data stored locally in this browser. Not a medical service.</span>
  <button class="sd-close" onclick="dismissDisclaimer()" aria-label="Dismiss">&#10005;</button>
</div>

<!-- MOBILE MENU OVERLAY -->
<div class="mobile-menu-overlay" id="mobile-menu-overlay" onclick="closeMobileMenu()"></div>
<div class="mobile-menu" id="mobile-menu">
  <div class="mm-header">
    <div class="mm-brand">Soma</div>
    <button class="mm-close" onclick="closeMobileMenu()">&#10005;</button>
  </div>
  <div class="mm-section-label">Execution</div>
  <a class="mm-link" href="/bodylens-dailyplan.html">Today</a>
  <a class="mm-link" href="/bodylens-programme.html">My programme</a>
  <a class="mm-link" href="/bodylens-week.html">This week</a>
  <a class="mm-link" href="/bodylens-history.html">Performance log</a>
  <a class="mm-link" href="/bodylens-checkin.html">Week review</a>
  <div class="mm-section-label">Food</div>
  <a class="mm-link" href="/bodylens-food.html">Food hub</a>
  <a class="mm-link" href="/bodylens-meals.html">Meal planner</a>
  <a class="mm-link" href="/bodylens-fridge.html">Fridge</a>
  <div class="mm-section-label">Stack &amp; Goals</div>
  <a class="mm-link" href="/bodylens-supplements.html">Stack</a>
  <a class="mm-link" href="/bodylens-goals.html">Goals</a>
  <a class="mm-link" href="/bodylens-bodymapper.html">Body Mapper</a>
  <div class="mm-section-label mm-inform-label">Inform &amp; Optimise</div>
  <a class="mm-link mm-inform" href="/bodylens-science.html">Science</a>
  <a class="mm-link mm-inform" href="/bodylens-accelerators.html">Accelerators</a>
  <a class="mm-link mm-inform" href="/bodylens-podcast.html">Podcast</a>
  <div class="mm-section-label">More</div>
  <a class="mm-link" href="/bodylens-sync.html" style="color:var(--amber)">Data sync</a>
  <a class="mm-link" href="/bodylens-guide.html">Guide</a>
  <a class="mm-link" href="/bodylens-howitworks.html">How it works</a>
  <a class="mm-link" href="/bodylens-bodyscan.html">Body scan</a>
  <div class="mm-section-label mm-vault-label">&#x2B21; Vault</div>
  <a class="mm-link mm-vault" href="/bodylens-strategy.html">The Business Case</a>
  <a class="mm-link mm-vault" href="/bodylens-story.html">The Story</a>
  <a class="mm-link mm-vault" href="/bodylens-nonneg.html">Non-Negotiables</a>
  <a class="mm-link mm-vault" href="/bodylens-viability3.html">Viability Analysis <span class="mm-badge">Rev 4</span></a>
  <a class="mm-link mm-vault" href="/bodylens-intelligence-full.html">Full Intelligence Doc</a>
  <a class="mm-link mm-vault" href="/bodylens-instructions.html">Instructions</a>
  <a class="mm-link mm-vault" href="/bodylens-profiles.html">Profile Vault</a>
  <a class="mm-link mm-vault" href="/bodylens-coachplan.html">Coaching Plan</a>
  <a class="mm-link mm-vault" href="/bodylens-strength.html">Strength Baseline</a>
  <a class="mm-link mm-vault" href="/bodylens-mealbuilder.html">Meal Builder</a>
  <a class="mm-link mm-vault" href="/bodylens-export.html">Export Data</a>
  <div class="mm-section-label mm-pro-section">Upgrade</div>
  <a class="mm-link mm-pro-link" href="/bodylens-pro.html">
    <span class="mm-pro-badge">PRO</span>
    Unlock the full engine
  </a>
</div>`;

  const BOTTOM_TAB_HTML = `<div class="mobile-tab-bar" id="mobile-tab-bar">
  <a class="mtb-tab" href="/bodylens-dailyplan.html">
    <div class="mtb-icon">&#128197;</div>
    <div class="mtb-label">Today</div>
  </a>
  <a class="mtb-tab" href="/bodylens-meals.html">
    <div class="mtb-icon">&#127860;</div>
    <div class="mtb-label">Meals</div>
  </a>
  <a class="mtb-tab" href="/bodylens-goals.html">
    <div class="mtb-icon">&#9678;</div>
    <div class="mtb-label">Goals</div>
  </a>
  <a class="mtb-tab" href="/bodylens-supplements.html">
    <div class="mtb-icon">&#128138;</div>
    <div class="mtb-label">Stack</div>
  </a>
  <button class="mtb-tab mtb-more" onclick="toggleMobileMenu()">
    <div class="mtb-icon">&#8801;</div>
    <div class="mtb-label">Menu</div>
  </button>
</div>`;

  function doInject() {
    // Replace existing nav if present
    const existing = document.querySelector('nav');
    if (existing) {
      existing.outerHTML = NAV_HTML;
    } else {
      // Insert at top of body
      document.body.insertAdjacentHTML('afterbegin', NAV_HTML);
    }

    // Inject bottom tab bar (mobile only — hidden on desktop via CSS)
    if (!document.getElementById('mobile-tab-bar')) {
      document.body.insertAdjacentHTML('beforeend', BOTTOM_TAB_HTML);
    }

    // Mark current page active in both nav and bottom tab bar
    const path = window.location.pathname.split('/').pop() || 'index.html';
    document.querySelectorAll('.nav-link, .mm-link, .mtb-tab, .nmp-link').forEach(a => {
      const href = (a.getAttribute('href')||'').split('/').pop();
      if (href === path) a.classList.add('active');
    });

    // Mark active tab in mobile menu
    document.querySelectorAll('.mm-link').forEach(a => {
      const href = (a.getAttribute('href')||'').split('/').pop();
      if (href === path) a.classList.add('active');
    });

    // Show profile name
    try {
      const p = JSON.parse(localStorage.getItem('bl_profile') || 'null');
      if (p && p.name) {
        const meta = document.getElementById('nav-meta');
        if (meta) meta.innerHTML = '<a href="/bodylens-coachplan.html" class="nav-user-pill" title="Your coaching plan">' + p.name + '</a>';
      }
    } catch(e) {}

    // Inject journey progress strip
    renderJourneyStrip();
  }

  if (document.body) {
    doInject();
  } else {
    document.addEventListener('DOMContentLoaded', doInject);
  }

  // Re-inject after page scripts run (some pages render their own nav on DOMContentLoaded)
  document.addEventListener('DOMContentLoaded', function() {
    setTimeout(doInject, 50);
    setTimeout(doInject, 300);
    // Show disclaimer unless dismissed
    setTimeout(function() {
      var el = document.getElementById('site-disclaimer');
      if (!el) return;
      var dismissed = localStorage.getItem('bl_disclaimer_dismissed');
      if (dismissed) {
        el.style.display = 'none';
      } else {
        el.classList.add('visible');
      }
    }, 400);
  });
})();

// ── JOURNEY PROGRESS STRIP ───────────────────────────────
// Shows Setup → Strategy → Programme → Today → Log steps
// with tick state driven by localStorage.
var _blJourneyStylesInjected = false;

function renderJourneyStrip() {
  var p = null;
  try { p = JSON.parse(localStorage.getItem('bl_profile') || 'null'); } catch(e) {}
  if (!p) return; // No profile — don't render the strip

  if (!_blJourneyStylesInjected) {
    _blJourneyStylesInjected = true;
    var css = '<style id="bl-journey-styles">'
      + '.bl-journey{display:flex;align-items:center;gap:0;padding:0 20px;background:var(--ink-1,#111917);border-bottom:1px solid rgba(255,255,255,.05);font-family:var(--sans,"Space Grotesk",sans-serif);overflow-x:auto;scrollbar-width:none;white-space:nowrap;}'
      + '.bl-journey::-webkit-scrollbar{display:none;}'
      + '.blj-step{display:inline-flex;align-items:center;gap:5px;padding:9px 10px;font-size:11px;font-weight:500;color:var(--dk-3,#3e504a);cursor:default;transition:color .15s;flex-shrink:0;}'
      + '.blj-step.done{color:var(--jade,#00c8a0);}'
      + '.blj-step.active{color:var(--dk-1,#e8e3da);font-weight:600;}'
      + '.blj-step a{color:inherit;text-decoration:none;}'
      + '.blj-step a:hover{text-decoration:underline;}'
      + '.blj-tick{font-size:9px;width:14px;height:14px;border-radius:50%;background:rgba(0,200,160,.15);display:inline-flex;align-items:center;justify-content:center;color:var(--jade,#00c8a0);flex-shrink:0;}'
      + '.blj-num{font-size:9px;width:14px;height:14px;border-radius:50%;background:rgba(255,255,255,.06);display:inline-flex;align-items:center;justify-content:center;color:var(--dk-3,#3e504a);flex-shrink:0;}'
      + '.blj-step.active .blj-num{background:rgba(255,255,255,.12);color:var(--dk-1,#e8e3da);}'
      + '.blj-sep{font-size:10px;color:rgba(255,255,255,.12);padding:0 2px;flex-shrink:0;}'
      + '@media(max-width:480px){.blj-step{padding:8px 7px;font-size:10px;}}'
      + '</style>';
    document.head.insertAdjacentHTML('beforeend', css);
  }

  // Step definitions with link destinations for active step
  var today = new Date().toISOString().slice(0, 10);
  var hasTodayPlan = false;
  var hasDaylog = false;
  try {
    for (var k in localStorage) {
      if (k.indexOf('bl_daylog_') === 0) { hasDaylog = true; break; }
    }
    // Check for any plan cached for today (key contains today's date)
    for (var k2 in localStorage) {
      if (k2.indexOf(today) >= 0 && (k2.indexOf('bl_plan') === 0 || k2.indexOf('bl_dp_') === 0)) { hasTodayPlan = true; break; }
    }
  } catch(e) {}

  var steps = [
    { label: 'Setup',      done: !!(p && p.name && p.goal),                                href: '/bodylens-onboard.html' },
    { label: 'Strategy',   done: !!(p && p.weekPlan && p.weekPlan.length >= 5),            href: '/bodylens-onboard.html' },
    { label: 'Programme',  done: !!(p && p.generatedAt),                                   href: '/bodylens-programme.html' },
    { label: 'Today',      done: hasTodayPlan,                                              href: '/bodylens-dailyplan.html' },
    { label: 'Log',        done: hasDaylog,                                                 href: '/bodylens-history.html' },
  ];

  // First incomplete step is "active"
  var activeIdx = -1;
  for (var i = 0; i < steps.length; i++) {
    if (!steps[i].done) { activeIdx = i; break; }
  }
  if (activeIdx === -1) activeIdx = steps.length - 1; // all done — last step active

  var html = '<div class="bl-journey" id="bl-journey">';
  steps.forEach(function(step, i) {
    var cls = step.done ? 'done' : (i === activeIdx ? 'active' : '');
    var inner = (step.done ? '<span class="blj-tick">&#10003;</span>' : '<span class="blj-num">' + (i + 1) + '</span>')
      + (i === activeIdx ? '<a href="' + step.href + '">' + step.label + '</a>' : '<span>' + step.label + '</span>');
    html += (i > 0 ? '<div class="blj-sep">&rsaquo;</div>' : '');
    html += '<div class="blj-step ' + cls + '">' + inner + '</div>';
  });
  html += '</div>';

  var existing = document.getElementById('bl-journey');
  if (existing) {
    existing.outerHTML = html;
  } else {
    var nav = document.querySelector('nav.site-nav');
    if (nav) nav.insertAdjacentHTML('afterend', html);
  }
}

function dismissDisclaimer() {
  var el = document.getElementById('site-disclaimer');
  if (el) { el.classList.remove('visible'); el.classList.add('hiding'); setTimeout(function(){ el.style.display='none'; }, 300); }
  try { localStorage.setItem('bl_disclaimer_dismissed', '1'); } catch(e) {}
}

function updateSyncDot(status) {
  var dot = document.getElementById('sync-dot');
  if (!dot) return;
  dot.setAttribute('data-status', status);
  var labels = { idle: 'Synced', syncing: 'Syncing...', offline: 'Offline', error: 'Sync error' };
  dot.title = labels[status] || 'Sync status';
}

// ════════════════════════════════════════════════════════
//  Soma — nav.js  v2.0
//  Shared across all pages.
//  Handles: navigation, dynamic AI coach (profile-aware),
//  localStorage, tooltips, day-date mapping.
// ════════════════════════════════════════════════════════

// ── PROFILE STORE ────────────────────────────────────────
// Single source of truth. All pages read from here.
const BL_STORE = {
  get(key)     { try { return JSON.parse(localStorage.getItem('bl_' + key)); } catch(e) { return null; } },
  set(key, val){ try { localStorage.setItem('bl_' + key, JSON.stringify(val)); return true; } catch(e) { return false; } },
  del(key)     { try { localStorage.removeItem('bl_' + key); } catch(e) {} },
  has(key)     { return localStorage.getItem('bl_' + key) !== null; },
  clear()      { try { Object.keys(localStorage).filter(k => k.startsWith('bl_')).forEach(k => localStorage.removeItem(k)); } catch(e) {} },
};

// ── PROFILE HELPERS ──────────────────────────────────────
function getProfile() {
  return BL_STORE.get('profile') || null;
}

function hasProfile() {
  const p = getProfile();
  return p && p.name && p.goal;
}

function buildSystemPrompt(profile) {
  if (!profile) {
    // Fallback — no profile yet
    return `You are Soma Coach — a precise, evidence-based personal performance advisor.
The user has not yet completed their profile.
Encourage them to complete onboarding at bodylens-onboard.html so you can give personalised advice.
TONE: Warm, direct, expert. Never generic. 3-5 sentences maximum.`;
  }

  const p = profile;
  const injuries = p.injuries && p.injuries.length
    ? p.injuries.map(i => `${i.location}: ${i.detail}`).join('. ')
    : 'None reported.';

  const nonneg = p.nonNegotiables && p.nonNegotiables.length
    ? p.nonNegotiables.join(', ')
    : 'Not specified.';

  return `You are Soma Coach — a precise, evidence-based personal performance advisor acting as a 24/7 personal trainer, nutritionist, and sports physio for this specific person. You know everything about them. Answer every question in the context of their specific programme, goals, and constraints. Never give generic advice. Never say "consult a doctor" unless genuinely warranted.

═══ PERSON PROFILE ═══
Name: ${p.name || 'User'}
Age: ${p.age || 'not given'}
Sex: ${p.sex || 'not given'}
Height: ${p.height || 'not given'}
Weight: ${p.weight || 'not given'}
Body fat: ${p.bodyFat ? p.bodyFat + '%' : 'not given'}
Fat storage: ${p.fatStorage || 'not given'}
Training experience: ${p.experience || 'not given'}

═══ GOALS ═══
Primary: ${p.goal || 'not given'}
Target: ${p.target || 'not given'}
Timeline: ${p.timeline || 'not given'}
Secondary: ${p.secondaryGoals ? p.secondaryGoals.join(', ') : 'none'}

═══ TRAINING ═══
Days/week: ${p.trainingDays || 'not given'}
Schedule: ${p.trainingSchedule || 'not given'}
Wake time: ${p.wakeTime || '06:00'}
Gym access: ${p.gymAccess || 'full commercial gym'}
Equipment exclusions: ${p.equipmentExclusions || 'none'}
Recovery tools: ${p.recoveryTools ? p.recoveryTools.join(', ') : 'not given'}

═══ NUTRITION ═══
Approach: ${p.dietType || 'not given'}
Calories: ${p.calories || 'not given'} kcal/day
Protein: ${p.protein || 'not given'}g
Carbs: ${p.carbs || 'not given'}g
Fat: ${p.fat || 'not given'}g
Exclusions: ${p.foodExclusions ? p.foodExclusions.join(', ') : 'none'}
Trigger foods: ${p.triggerFoods || 'none'}
Eating window: ${p.eatingWindow || 'not given'}

═══ INJURIES & CONSTRAINTS ═══
${injuries}

═══ NON-NEGOTIABLES ═══
${nonneg}

═══ SUPPLEMENTS ═══
${p.supplements ? p.supplements.join(', ') : 'not given'}

═══ TODAY'S CONTEXT ═══
Day: ${getTodayName()}
Plan type: ${getTodayPlanType(p)}
${p.foodLog ? 'Food logged today: ' + p.foodLog : 'No food logged yet today.'}

═══ SCIENCE KNOWLEDGE BASE ═══
Apply this mechanistic knowledge when relevant:
- mTOR activation requires both mechanical tension (training) AND leucine (~2.5g per meal). Both keys needed.
- Alcohol directly blocks mTOR phosphorylation — a training session followed by alcohol = stimulus without adaptation.
- GH pulses in first slow-wave sleep cycle. Alcohol within 4h, poor sleep hygiene, sub-6h sleep all suppress it.
- Cortisol and testosterone are inversely related. Chronic cortisol elevation suppresses HPT axis regardless of training.
- Collagen + Vitamin C 45-60 min pre-training = 5.5x connective tissue synthesis during loading window (Shaw 2017).
- Omega-3 amplifies MPS response to the same protein dose by 20-35% in adults over 40.
- Zone 2 cardio activates PGC-1α → mitochondrial biogenesis. The primary longevity intervention.
- VO2max is the strongest predictor of all-cause mortality — more predictive than smoking, BP, or metabolic syndrome.
- Visceral fat secretes TNF-α and IL-6 directly into portal circulation. Reducing it IS inflammation management.
- 95% of serotonin produced in the gut. Gut dysbiosis mechanistically causes anxiety — not as a side effect, as a direct output.
- Insulin sensitivity determines whether surplus calories go to muscle or fat. Training, sleep, omega-3, and protein all improve it.
- Leucine threshold for mTOR activation: ~2.5g per meal. Below this = no MPS signal regardless of total daily protein.
- Cold exposure: noradrenaline +200-300%, dopamine elevated 2-4h, HPA recalibration over weeks of consistency.
- Magnesium glycinate: GABA receptor cofactor. Low magnesium = inadequate GABAergic inhibition = brain won't switch off.
- Ashwagandha KSM-66: modulates HPA axis, reduces cortisol ~25-30% in RCTs. Testosterone support via HPT axis.
- Sauna post-training: second GH pulse (up to 16x baseline), HSP70/HSP90 heat shock protein activation.
- Hydro pool: 70% bodyweight reduction. Only way to deliver nutrients to avascular cartilage without loading a meniscal tear.
- Degenerative meniscal tears: appropriate progressive loading does NOT worsen them. Posterior chain training = structural joint therapy.

═══ TONE ═══
Senior, dry, precise. Mechanistic not motivational. 3-5 sentences maximum. Answer the actual question. Never waffle. Never generic.`;
}

// ── DAY HELPERS ──────────────────────────────────────────
const DAY_MAP = { 0:6, 1:0, 2:1, 3:2, 4:3, 5:4, 6:5 }; // JS Sun=0 → programme Sun=6
const DAY_NAMES = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];

function getTodayIndex() {
  return DAY_MAP[new Date().getDay()];
}

function getTodayName() {
  return DAY_NAMES[getTodayIndex()];
}

function getTodayPlanType(profile) {
  if (!profile || !profile.weekPlan) return 'Not yet generated';
  const plan = profile.weekPlan[getTodayIndex()];
  return plan ? plan.type : 'Rest';
}

// ── ACTIVE NAV LINK ──────────────────────────────────────
(function() {
  const page = location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-link').forEach(a => {
    const href = (a.getAttribute('href') || '').replace('.html','');
    if (href && page.includes(href.replace('bodylens-',''))) {
      a.classList.add('active');
    }
  });
})();

// ── AI COACH ─────────────────────────────────────────────
// The coach is context-aware: it builds its system prompt
// from the current stored profile every time it's called.

async function sendCoach(inputId, respId, btnId, extraCtx) {
  const inp  = document.getElementById(inputId);
  const resp = document.getElementById(respId);
  const btn  = document.getElementById(btnId);
  const q    = inp ? inp.value.trim() : '';
  if (!q) return;
  if (btn) btn.disabled = true;
  resp.className = 'ai-resp loading';
  resp.textContent = 'Thinking…';
  if (inp) inp.value = '';

  const profile = getProfile();
  const systemPrompt = buildSystemPrompt(profile);

  // Build context from extra info passed by page
  const messages = [];
  if (extraCtx) {
    messages.push({ role: 'user', content: extraCtx });
    messages.push({ role: 'assistant', content: 'Understood. What would you like to know?' });
  }
  messages.push({ role: 'user', content: q });

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 600,
        system: systemPrompt,
        messages,
      }),
    });
    const data = await res.json();
    resp.className = 'ai-resp';
    resp.textContent = data.content?.map(b => b.text || '').join('') || 'No response.';
  } catch(e) {
    resp.className = 'ai-resp';
    resp.textContent = 'Connection error — check network and try again.';
  }
  if (btn) btn.disabled = false;
}

function askCoach(btn, inputId, respId, btnId, ctx) {
  const inp = document.getElementById(inputId);
  if (inp) inp.value = btn.textContent.trim();
  sendCoach(inputId, respId, btnId, ctx || '');
}

// Quick coach — takes a question string, returns a promise with the answer
// Used for page-level AI generation (daily plan, meal suggestions etc)
async function quickCoach(question, extraContext, maxTokens) {
  const profile = getProfile();
  const systemPrompt = buildSystemPrompt(profile);
  const messages = [{ role: 'user', content: question }];

  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: maxTokens || 1200,
      system: (extraContext ? extraContext + '\n\n' : '') + systemPrompt,
      messages,
    }),
  });
  const data = await res.json();
  return data.content?.map(b => b.text || '').join('') || '';
}

// ── FOOD LOG ─────────────────────────────────────────────
// Simple daily food log — resets at midnight
function getTodayKey() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

function getFoodLog() {
  const log = BL_STORE.get('foodlog_' + getTodayKey());
  return log || [];
}

function addFoodEntry(entry) {
  const log = getFoodLog();
  log.push({ ...entry, time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) });
  BL_STORE.set('foodlog_' + getTodayKey(), log);
  // Also update profile food log summary for coach context
  const profile = getProfile();
  if (profile) {
    profile.foodLog = log.map(e => `${e.time} ${e.name} (~${e.calories || '?'}kcal)`).join(', ');
    BL_STORE.set('profile', profile);
  }
  return log;
}

function getTodayMacros() {
  const log = getFoodLog();
  return log.reduce((acc, e) => ({
    calories: acc.calories + (e.calories || 0),
    protein:  acc.protein  + (e.protein  || 0),
    carbs:    acc.carbs    + (e.carbs    || 0),
    fat:      acc.fat      + (e.fat      || 0),
  }), { calories: 0, protein: 0, carbs: 0, fat: 0 });
}

// ── UI UTILITIES ─────────────────────────────────────────
function toggleProto(card) { card.classList.toggle('expanded'); }
function toggleScenario(el) { el.classList.toggle('open'); }

function selectOpt(btn, group, warn) {
  btn.closest('.ci-options').querySelectorAll('.ci-opt').forEach(b => b.classList.remove('sel','sel-warn'));
  btn.classList.add(warn ? 'sel-warn' : 'sel');
}

function switchTab(paneId, btn) {
  const scope = btn ? (btn.closest('.tab-scope') || document) : document;
  scope.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  scope.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
  if (btn) btn.classList.add('active');
  const p = document.getElementById(paneId);
  if (p) p.classList.add('active');
}

// ── WAKE TIME ────────────────────────────────────────────
function restorePreferences() {
  const wakeEl = document.getElementById('wake-select');
  if (wakeEl) {
    const saved = BL_STORE.get('wake_time');
    if (saved) wakeEl.value = saved;
    wakeEl.addEventListener('change', () => BL_STORE.set('wake_time', wakeEl.value));
  }
}

// ── PROFILE REDIRECT GUARD ───────────────────────────────
// Pages that require a profile to function can call this.
// If no profile, redirects to onboarding.
function requireProfile() {
  if (!hasProfile()) {
    const current = location.pathname.split('/').pop();
    if (current !== 'bodylens-onboard.html' && current !== 'index.html') {
      location.href = 'bodylens-onboard.html';
    }
  }
}

// ── GLOSSARY / TOOLTIPS ──────────────────────────────────
const GLOSSARY = {
  'RPE':    'Rate of Perceived Exertion — 1–10 scale. RPE 8 = 2 reps left in the tank.',
  'MPS':    'Muscle Protein Synthesis — building new muscle tissue. Triggered by training + leucine.',
  'mTOR':   'Mechanistic Target of Rapamycin — the molecular switch for muscle building. Needs leucine + mechanical tension.',
  'GH':     'Growth Hormone — released during deep sleep. Drives muscle repair and connective tissue remodelling.',
  'VO₂max': 'Maximum oxygen uptake — strongest predictor of longevity. More predictive than smoking, blood pressure, or metabolic syndrome.',
  'DOMS':   'Delayed Onset Muscle Soreness — the ache 24–48h after training. Normal. Not an injury.',
  'ROM':    'Range of Motion — the full movement range a joint can safely perform.',
  'MCL':    'Medial Collateral Ligament — inner knee ligament.',
  'ACL':    'Anterior Cruciate Ligament — main knee stabiliser.',
  'ATP':    'Adenosine Triphosphate — the energy molecule cells run on. Creatine speeds regeneration.',
  'CNS':    'Central Nervous System — needs to be fresh for heavy compound lifts.',
  'RDL':    'Romanian Deadlift — hip hinge with minimal knee flexion. Loads hamstrings and glutes.',
  'EPA':    'Eicosapentaenoic acid — omega-3 fatty acid. Reduces joint inflammation.',
  'DHA':    'Docosahexaenoic acid — omega-3 fatty acid. Structural brain tissue.',
  'COX':    'Cyclo-oxygenase — enzyme that produces inflammation. Omega-3 competes here.',
  'IGF-1':  'Insulin-like Growth Factor 1 — produced in response to GH. Drives muscle synthesis.',
  'KSM-66': 'The specific standardised ashwagandha extract used in clinical trials. Generic ashwagandha is inconsistent.',
  'HPA':    'Hypothalamic-Pituitary-Adrenal axis — the stress response system. Ashwagandha, Zone 2, and cold exposure all recalibrate it.',
  'BDNF':   'Brain-Derived Neurotrophic Factor — produced during exercise. Opens a neuroplasticity window for 2–4 hours post-session.',
};

function applyTooltips(root) {
  root = root || document.body;
  const terms = Object.keys(GLOSSARY).sort((a, b) => b.length - a.length);
  const skip  = new Set(['SCRIPT','STYLE','INPUT','TEXTAREA','SELECT','BUTTON','A','SPAN']);

  function esc(s) {
    return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function walk(node) {
    if (skip.has(node.nodeName)) return;
    if (node.nodeType === 3) {
      const text = node.textContent;
      for (const term of terms) {
        const idx = text.indexOf(term);
        if (idx >= 0 && node.parentElement && !node.parentElement.classList.contains('tip')) {
          const span = document.createElement('span');
          span.innerHTML =
            esc(text.slice(0, idx)) +
            `<span class="tip" data-tip="${esc(GLOSSARY[term])}">${esc(term)}</span>` +
            esc(text.slice(idx + term.length));
          node.parentNode.replaceChild(span, node);
          break;
        }
      }
    } else {
      Array.from(node.childNodes).forEach(walk);
    }
  }

  const content = root.querySelector('.page,.main-inner,.tab-content,.day-plan');
  if (content) walk(content);
}

// ── INIT ─────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  restorePreferences();
  setTimeout(() => applyTooltips(document.body), 400);

  // Show profile name in nav if available
  const profile = getProfile();
  if (profile && profile.name) {
    const brand = document.querySelector('.nav-brand');
    if (brand) {
      brand.setAttribute('title', `Logged in as ${profile.name}`);
    }
  }

  // Inject nav icon button styles
  if (!document.getElementById('nav-icon-styles')) {
    const s = document.createElement('style');
    s.id = 'nav-icon-styles';
    s.textContent = `
      .nav-icon-btn {
        background: rgba(255,255,255,0.04);
        border: 1px solid var(--bd, rgba(255,255,255,0.08));
        border-radius: 7px;
        width: 32px; height: 32px;
        display: inline-flex; align-items: center; justify-content: center;
        font-size: 14px; cursor: pointer;
        transition: background 0.15s, border-color 0.15s;
        padding: 0; margin-left: 4px;
      }
      .nav-icon-btn:hover {
        background: rgba(255,255,255,0.09);
        border-color: var(--jade-br, rgba(0,196,160,0.2));
      }
    `;
    document.head.appendChild(s);
  }

  // Load profile manager
  if (!window._pmLoaded) {
    window._pmLoaded = true;
    const pm = document.createElement('script');
    pm.src = '/profile-manager.js';
    document.head.appendChild(pm);
  }
  // Load sync layer then Supabase auth (bl-sync.js must load first)
  if (!window._sbLoaded) {
    window._sbLoaded = true;
    const sync = document.createElement('script');
    sync.src = '/bl-sync.js';
    sync.onload = function() {
      const sb = document.createElement('script');
      sb.src = '/supabase-auth.js';
      document.head.appendChild(sb);
      // Subscribe to sync status changes
      if (window.BLSync) {
        window.BLSync.onStatusChange(updateSyncDot);
      }
    };
    document.head.appendChild(sync);
  }

  // Inject sync-dot pulse animation (styles live in style.css)
  if (!document.getElementById('sync-dot-styles')) {
    const sd = document.createElement('style');
    sd.id = 'sync-dot-styles';
    sd.textContent = `
      @keyframes sync-pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.4; }
      }
      .sync-dot[data-status="syncing"] { animation: sync-pulse 1s infinite; }
    `;
    document.head.appendChild(sd);
  }

});

// ── GLOBAL CALORIE HELPERS ────────────────────────
// Single source of truth for daily calorie targets.
// Any page that needs training/rest kcal calls these.

window.getDayKcal = function(p, isTraining) {
  // Use explicit stored values if present (set at programme generation)
  if (isTraining && p.trainingKcal) return p.trainingKcal;
  if (!isTraining && p.restKcal) return p.restKcal;

  // Fallback: derive from p.calories and goal
  // p.calories = the target (not TDEE — TDEE is p.tdee)
  var base = p.calories || 2000;
  var goal = (p.goal || '').toLowerCase();

  if (isTraining) {
    // Training days: at target or slight surplus on muscle gain
    if (goal.includes('muscle') || goal.includes('build') || goal.includes('bulk')) {
      return Math.round(base * 1.05); // +5% on training days for muscle
    }
    return base; // recomp / fat loss: target calories on training days
  } else {
    // Rest days: deficit below target
    if (goal.includes('muscle') || goal.includes('build') || goal.includes('bulk')) {
      return Math.round(base * 0.95); // small cut on rest days even for muscle gain
    }
    return Math.round(base * 0.90); // 10% below target on rest days
  }
};

// Ensure profile has trainingKcal/restKcal — call after any profile save
window.ensureKcalFields = function() {
  try {
    var p = JSON.parse(localStorage.getItem('bl_profile') || 'null');
    if (!p || !p.calories) return;
    var changed = false;
    if (!p.trainingKcal) { p.trainingKcal = window.getDayKcal(p, true);  changed = true; }
    if (!p.restKcal)     { p.restKcal     = window.getDayKcal(p, false); changed = true; }
    if (changed) localStorage.setItem('bl_profile', JSON.stringify(p));
  } catch(e) {}
};

// Run on every page load to backfill existing profiles
window.addEventListener('load', function() {
  setTimeout(window.ensureKcalFields, 500);
});
// Called from any page — Accelerators, Science, Food
// saveOpt(id, name, icon) — adds to p.optimisations and shows feedback
window.saveOpt = function(id, name, icon, btn) {
  try {
    const raw = localStorage.getItem('bl_profile');
    if (!raw) { alert('No profile found. Complete onboarding first.'); return; }
    const p = JSON.parse(raw);
    // Migrate legacy accelerators
    if (!p.optimisations) p.optimisations = (p.accelerators || []).map(function(a){ return a; });
    // Also keep accelerators in sync
    if (!p.accelerators) p.accelerators = [];
    const existing = p.optimisations.map(function(o){ return typeof o === 'string' ? o : o.id; });
    const isNew = !existing.includes(id);
    if (isNew) {
      p.optimisations.push(id);
      if (!p.accelerators.includes(id)) p.accelerators.push(id);
      localStorage.setItem('bl_profile', JSON.stringify(p));
      // Bust the daily plan cache so new optimisation fires on next load
      var _today = new Date().toISOString().slice(0,10);
      try { localStorage.removeItem('dayplan_v6r2_' + _today); } catch(e2) {}
      // ── Log to decision log (if blPropose available and not already handled by page) ──
      // Only log from food accelerator cards (saveAcc on accelerators page logs itself)
      // Use a flag to prevent double-logging
      if (typeof blPropose === 'function' && !window._saveOptCalledFromAcc) {
        blPropose(
          'accelerator',
          'Add to programme: ' + (name || id),
          [{ field: 'accelerators.push', label: 'Accelerator added', before: null, after: name || id }],
          'Added from ' + (document.title || 'Soma') + ' on ' + new Date().toLocaleDateString('en-GB', { day:'numeric', month:'long' })
        );
      }
    }
    if (btn) {
      btn.textContent = '✓ In your programme';
      btn.style.background = 'var(--jade)';
      btn.style.color = 'var(--ink)';
      btn.style.borderColor = 'var(--jade)';
      btn.disabled = true;
    }
  } catch(e) {
    console.error('saveOpt error', e);
  }
};

window.removeOpt = function(id) {
  try {
    const p = JSON.parse(localStorage.getItem('bl_profile') || 'null');
    if (!p) return;
    p.accelerators = (p.accelerators || []).filter(function(a){ return a !== id; });
    p.optimisations = (p.optimisations || []).filter(function(o){ return (typeof o === 'string' ? o : o.id) !== id; });
    localStorage.setItem('bl_profile', JSON.stringify(p));
  } catch(e) {}
};

// ── MOBILE MENU ─────────────────────────────────────────
window.toggleMobileMenu = function() {
  var menu = document.getElementById('mobile-menu');
  var overlay = document.getElementById('mobile-menu-overlay');
  if (!menu) return;
  var isOpen = menu.classList.toggle('open');
  if (overlay) overlay.classList.toggle('open', isOpen);
  document.body.style.overflow = isOpen ? 'hidden' : '';
};

window.closeMobileMenu = function() {
  var menu = document.getElementById('mobile-menu');
  var overlay = document.getElementById('mobile-menu-overlay');
  if (menu) menu.classList.remove('open');
  if (overlay) overlay.classList.remove('open');
  document.body.style.overflow = '';
};

// ── VAULT DROPDOWN ──────────────────────────────────────
window.toggleVaultDropdown = function(e) {
  e.preventDefault();
  e.stopPropagation();
  var drop = document.getElementById('vault-drop');
  if (!drop) return false;
  // Close More panel if open
  var morePanel = document.getElementById('nav-more-panel');
  var moreBtn   = document.getElementById('nav-more-btn');
  if (morePanel) morePanel.classList.remove('open');
  if (moreBtn)   moreBtn.classList.remove('open');
  var isOpen = drop.classList.toggle('open');
  if (isOpen) {
    // Close on next outside click
    setTimeout(function() {
      document.addEventListener('click', function closeVault(ev) {
        var wrap = document.getElementById('vault-wrap');
        if (!wrap || !wrap.contains(ev.target)) {
          drop.classList.remove('open');
          document.removeEventListener('click', closeVault);
        }
      });
    }, 0);
  }
  return false;
};

// ── MORE DROPDOWN ───────────────────────────────────────
window.toggleNavMore = function(e) {
  e.preventDefault();
  e.stopPropagation();
  var panel = document.getElementById('nav-more-panel');
  var btn   = document.getElementById('nav-more-btn');
  if (!panel) return false;
  // Close Vault if open
  var vaultDrop = document.getElementById('vault-drop');
  if (vaultDrop) vaultDrop.classList.remove('open');
  var isOpen = panel.classList.toggle('open');
  if (btn) btn.classList.toggle('open', isOpen);
  if (isOpen) {
    // Close on next outside click
    setTimeout(function() {
      document.addEventListener('click', function closeMore(ev) {
        var wrap = document.querySelector('.nav-more-wrap');
        if (!wrap || !wrap.contains(ev.target)) {
          panel.classList.remove('open');
          if (btn) btn.classList.remove('open');
          document.removeEventListener('click', closeMore);
        }
      });
    }, 0);
    // Clicking any nmp-link closes the panel
    panel.querySelectorAll('.nmp-link').forEach(function(link) {
      link.addEventListener('click', function() {
        panel.classList.remove('open');
        if (btn) btn.classList.remove('open');
      }, { once: true });
    });
  }
  return false;
};

// Swipe down on the bottom sheet to dismiss it
(function() {
  var touchStartY = 0;
  var touchStartScrollTop = 0;
  document.addEventListener('touchstart', function(e) {
    var menu = document.getElementById('mobile-menu');
    if (menu && menu.classList.contains('open')) {
      touchStartY = e.touches[0].clientY;
      touchStartScrollTop = menu.scrollTop;
    }
  }, { passive: true });
  document.addEventListener('touchend', function(e) {
    var menu = document.getElementById('mobile-menu');
    if (!menu || !menu.classList.contains('open')) return;
    var dy = e.changedTouches[0].clientY - touchStartY;
    // Only dismiss if swiped down ≥80px AND sheet is scrolled to the top
    if (dy > 80 && touchStartScrollTop <= 4) {
      window.closeMobileMenu();
    }
  }, { passive: true });
})();


// ── AUTH GATE ────────────────────────────────────────────────────────────────
// Protects all app pages. Fires after Supabase auth resolves (~600ms after load).
// Public pages are whitelisted and never gated.
(function() {
  var WHITELISTED = [
    // Auth pages — must always be public
    'bodylens-login.html',
    'bodylens-onboard.html',
    // Marketing / public info
    'bodylens-guide.html',
    'bodylens-howitworks.html',
    'bodylens-story.html',
    'bodylens-viability.html',
    'bodylens-viability2.html',
    'bodylens-viability3.html',
    // Science library — read-only, no user data, good for SEO/sharing
    'bodylens-science.html',
    'bodylens-alcohol.html',
    'bodylens-hunger.html',
    'bodylens-weightloss.html',
    'bodylens-mentalhealth.html',
    'bodylens-attia.html',
    'bodylens-longevity.html',
    'bodylens-body.html',
    'bodylens-insulin.html',
    'bodylens-training.html',
    'bodylens-optimal.html',
    'bodylens-synthesis.html',
    // Note: fuel, strength, accelerators, supplements, ideas, sync are NOW PROTECTED
    // They use profile data and require login
  ];

  var path = window.location.pathname;
  var page = path.split('/').pop() || '';

  // Never gate whitelisted pages
  if (!page || WHITELISTED.indexOf(page) >= 0) return;

  // Inject a cover overlay immediately — prevents flash of protected content
  var cover = document.createElement('div');
  cover.id = 'bl-auth-cover';
  cover.style.cssText = [
    'position:fixed', 'inset:0', 'z-index:99999',
    'background:var(--ink,#0c1010)',
    'display:flex', 'align-items:center', 'justify-content:center',
    'flex-direction:column', 'gap:12px',
    'transition:opacity .3s ease',
  ].join(';');
  cover.innerHTML = '<div style="width:22px;height:22px;border-radius:50%;border:2px solid rgba(255,255,255,.1);border-top-color:#00c8a0;animation:bl-spin .7s linear infinite"></div>'
    + '<div style="font-size:11px;font-weight:300;color:rgba(255,255,255,.25);letter-spacing:.08em">Loading…</div>';

  // Inject keyframe if not already present
  if (!document.getElementById('bl-auth-cover-style')) {
    var style = document.createElement('style');
    style.id = 'bl-auth-cover-style';
    style.textContent = '@keyframes bl-spin{to{transform:rotate(360deg)}}';
    document.head.appendChild(style);
  }

  document.body ? document.body.appendChild(cover) : document.addEventListener('DOMContentLoaded', function() { document.body.appendChild(cover); });

  function liftCover() {
    if (cover.parentNode) {
      cover.style.opacity = '0';
      setTimeout(function() { cover.parentNode && cover.parentNode.removeChild(cover); }, 320);
    }
  }

  function redirectToLogin() {
    var dest = encodeURIComponent(window.location.href);
    window.location.replace('/bodylens-login.html?next=' + dest);
  }

  // Poll for auth resolution — _blUser is set by supabase-auth.js onAuthStateChange
  var elapsed = 0;
  var TIMEOUT = 2500;   // max wait before treating as signed-out
  var POLL_MS  = 80;

  var timer = setInterval(function() {
    elapsed += POLL_MS;

    if (window._blUser) {
      // Authenticated — lift cover and let page render
      clearInterval(timer);
      liftCover();
      return;
    }

    // supabase-auth.js sets _blAuthResolved = true after onAuthStateChange fires
    // even if the user is signed out
    if (window._blAuthResolved) {
      clearInterval(timer);
      if (window._blUser) {
        liftCover();
      } else {
        redirectToLogin();
      }
      return;
    }

    if (elapsed >= TIMEOUT) {
      clearInterval(timer);
      // Timed out — if still no user, treat as logged out
      if (window._blUser) {
        liftCover();
      } else {
        redirectToLogin();
      }
    }
  }, POLL_MS);

})();

// ── GLOSSARY ─────────────────────────────────────────────
// Load bl-glossary.js on every page that uses nav.js
(function() {
  var s = document.createElement('script');
  s.src = '/bl-glossary.js';
  s.defer = true;
  document.head.appendChild(s);
})();

// ════════════════════════════════════════════════════════
//  coach.js — BodyLens floating AI coach  v3
//  Fixes: async bug on chips, prose format, follow-up
//  probing, new info detection + profile update
// ════════════════════════════════════════════════════════

(function () {

  const API   = '/api/chat';
  const MODEL       = 'claude-sonnet-4-20250514';  // Reasoning tasks
  const MODEL_FAST  = 'claude-haiku-4-5-20251001'; // Simple tasks: follow-up chips, summaries
  const HISTORY_KEY = 'bl_coach_history';
  const MAX_HISTORY = 16;

  // ── PAGE CONTEXTS ─────────────────────────────────────
  const PAGE_CONTEXTS = {
    'day':          'The user is looking at their daily plan — schedule, training session, meals, supplement timing.',
    'food':         'The user is on the food hub — meals, week plan, recipes, pyramids, shopping, food intelligence.',
    'fuel':         'The user is on the food system — meal timing, synergies, shopping, what to eat and when.',
    'training':     'The user is reading training science — frequency, volume, splits, periodisation, proximity to failure.',
    'alcohol':      'The user is reading about alcohol\'s effects on muscle building, sleep, hormones, and recovery.',
    'weightloss':   'The user is reading fat loss science — CICO, TDEE, hormones, why diets fail.',
    'hunger':       'The user is reading hunger management science — ghrelin, leptin, food noise, emotional eating.',
    'optimal':      'The user is reading about whole-body systems — gut health, energy, brain, anxiety, mood, hormones.',
    'synthesis':    'The user is reading the systems synthesis — how every body system connects.',
    'story':        'The user is reading a narrative of how their programme works across a full training day.',
    'mentalhealth': 'The user is reading about mental health — cortisol, gut-brain axis, sleep-mood, training as medicine.',
    'longevity':    'The user is reading longevity science — decade-by-decade shifts, biomarkers, what to prioritise.',
    'attia':        'The user is reading Attia and Huberman protocols — Zone 2, VO₂max, biomarkers, NSDR, cold, heat.',
    'programme':    'The user is viewing their programme — week plan, macros, supplements, injuries.',
    'instructions': 'The user is reading their coaching report — personalised assessment of their programme.',
    'science':      'The user is on the Science hub browsing topics.',
    'body':         'The user is exploring the muscle guide — anatomy, how muscles work, how to train them.',
    'howitworks':   'The user is reading how BodyLens built their programme — the logic behind it.',
    'default':      'The user is using BodyLens. They may ask about any aspect of their programme, nutrition, training, or health.',
  };

  // ── SYSTEM PROMPT ─────────────────────────────────────
  // ── SYSTEM PROMPT ─────────────────────────────────────
  // Structured for Anthropic prompt caching:
  //   Block 1 (cache_control: ephemeral) — static coaching instructions
  //   Block 2 — dynamic: client profile + page context (changes per user/page)
  //
  // The static block (~1,400 tokens) is identical across all users and all calls.
  // Anthropic caches it after the first call and charges 10% on subsequent hits.
  // The dynamic block is small (~400 tokens) and billed at normal input rates.
  // Net result: ~75% reduction in input token cost for the coach on repeat calls.

  const STATIC_COACHING_INSTRUCTIONS = `You are the BodyLens coach — a senior performance coach and applied sport scientist.

YOUR VOICE:
You speak like a senior coach with a science background having a real consultation — not a chatbot, not a generic fitness app. You are warm, direct, and specific. You reference the client's actual numbers, their actual training days, their injuries, their food preferences. You don't hedge unless there is genuine scientific uncertainty, and when you do hedge you say why.

RESPONSE FORMAT — this is critical:
Write in flowing prose, the way a coach actually talks. No bullet points. No bold text. No headers. No markdown formatting of any kind. Just clear, well-constructed sentences in paragraphs. A short answer is one or two sentences. A longer answer is two or three paragraphs. Never more than that unless they explicitly ask for a comprehensive explanation.

The science lives in the explanation — you weave it into the answer naturally, not as bullet points. If the answer has a mechanism behind it, explain the mechanism in plain language as part of the flow.

Always make the answer personal. Reference their specific situation — their training days, their protein target, their injuries if relevant. Generic advice is not coaching.

CONTRADICTION DETECTION — critical:
Before answering any question about training load, nutrition, or recovery, check the client profile for conflicts between variables. If you detect a tension, name it directly as part of your answer rather than ignoring it and giving generic advice.

The key conflicts to watch for:
- High training volume + significant caloric deficit + poor sleep: this triad suppresses recovery and testosterone, risks muscle loss. Do not recommend adding more training. Flag it.
- Heavy strength training + very low carbs (under 100g): glycogen depletion impairs performance at RPE 7+. Flag it if they ask about energy or performance.
- Injury history + exercises that directly load that joint: always acknowledge the conflict before prescribing.
- Age 40+ + high frequency + insufficient rest days: CNS recovery extends beyond 48h. Flag if they ask about adding sessions.
- High protein target + low calorie total: if protein x 4 kcal represents more than 40% of total calories, something does not add up. Flag it.
- Multiple accelerators stacked: if they are already doing fasting, zone 2, and cold therapy, adding more is diminishing returns. Say so.

When you detect a conflict, say something like: "Before I answer that, there is a tension worth addressing..." Then resolve the conflict with specific advice before answering the question.

EVIDENCE TIERING — be honest about confidence:
When making a claim, know which tier it sits in:
- Established: multiple RCTs, meta-analyses, strong consensus (creatine for strength, protein timing, sleep for GH). State these confidently.
- Emerging: early RCTs, mechanistic studies, promising but not conclusive (cold therapy for inflammation, HRV-guided training). Say "the evidence is building on this" or "early research suggests."
- Anecdotal / community practice: widespread use but limited peer review (many supplement stacks, some timing protocols). Say "this is widely used but the evidence is limited" rather than presenting it as established.

Never overstate certainty. Never understate it either — do not caveat established science with unnecessary hedging.

MEDICAL BOUNDARY AWARENESS:
If a question involves symptoms that could indicate a medical condition, cardiovascular concerns, disordered eating risk, or clinical injury, do not attempt diagnosis or treatment. Say clearly that this falls outside coaching scope and recommend seeing a relevant clinician. Examples: chest pain during training, significant unexplained weight changes, obsessive food restriction patterns, joint pain with neurological symptoms.

PERFORMANCE ACCELERATORS — know these and use them proactively:
You have access to a library of 24 evidence-backed performance accelerators. When the conversation naturally leads there — or when someone asks how to speed up results, what else they can do, or expresses high motivation — suggest a specific accelerator with its mechanism explained in your voice. Never list multiple at once. Pick the single most relevant one and explain it properly.

Nutrition: Extended overnight fast (16:8), Protein-sparing modified fast (one day 600 kcal protein-only per week), Carb back-loading (hold carbs until post-training), Diet break week (one week maintenance every 6-8 weeks), Fasted morning training, Monthly 36-hour fast.

Training: Zone 2 cardio blocks (60-70% max HR, 3-4 hrs/week), Weekly VO2max intervals (4x4 min at 90-95%), Post-meal walks (10 min after each meal, lowers glucose 20-30%), NEAT maximisation (+2-3k steps daily), Loaded stretching (2 min under load, post-set), Blood flow restriction (20-30% 1RM with cuff).

Recovery: Sauna protocol (80-100 degrees C, 20 min, 4x/week), Cold-hot contrast cycling (sauna 15 min then cold 3 min x 3 cycles), NSDR/Yoga Nidra (20 min, dopamine rises 65%), Sleep extension block (30-60 min extra for 2 weeks), Creatine loading phase (20g/day x 5 days then 5g maintenance), Morning light + cold shower finish.

Psychology: Implementation intentions (When X I will Y), Dopamine scheduling (no low-effort dopamine before training), Two-minute rule (commit only to starting), Training log practice (write every set), Weekly body composition check (tape + scale Monday AM), Deliberate discomfort practice.

When suggesting an accelerator: name it, explain the mechanism in 2-3 sentences in your coaching voice, give the specific protocol in brief, and say why it fits this person's specific situation right now. Always end with "You can read the full breakdown on the Accelerators page." Never suggest anything medically inappropriate given their profile.

Safety: Never suggest extended fasting to someone with disordered eating history, very low current calories, or health conditions that contraindicate it. Never suggest BFR to someone with cardiovascular issues. Use the injuries and health conditions in the profile to filter.

NEW INFORMATION DETECTION — important:
If the user mentions something that would update their profile — a new injury, a change in sleep, a new supplement they have started, a goal shift, or a change to their training — acknowledge it and end your response with: [NEW_INFO: brief description]

CRITICALLY: If the user says anything like "add this to my training plan", "can you add this", "include this in my programme", "I want to add X to my sessions" — treat it as a training modification. Add [NEW_INFO: training modification: X] and explain it will be saved as an ongoing modification at the bottom of their coaching report, separate from the core programme structure.

Examples:
- "I have started taking ashwagandha" then add [NEW_INFO: started taking ashwagandha]
- "My knee has been hurting again" then add [NEW_INFO: knee pain recurring]
- "I am now sleeping 6 hours instead of 8" then add [NEW_INFO: sleep reduced to 6 hours]
- "I am thinking of changing my goal to fat loss" then add [NEW_INFO: considering goal change to fat loss]

Only add this tag if there is genuinely new information that would change the profile. Do not add it for questions or general discussion.
You have access to a library of 24 evidence-backed performance accelerators. When the conversation naturally leads there — or when someone asks how to speed up results, what else they can do, or expresses high motivation — suggest a specific accelerator with its mechanism explained in your voice. Never list multiple at once. Pick the single most relevant one and explain it properly.

Nutrition: Extended overnight fast (16:8), Protein-sparing modified fast (one day 600 kcal protein-only per week), Carb back-loading (hold carbs until post-training), Diet break week (one week maintenance every 6-8 weeks), Fasted morning training, Monthly 36-hour fast.

Training: Zone 2 cardio blocks (60-70% max HR, 3-4 hrs/week), Weekly VO₂max intervals (4×4 min at 90-95%), Post-meal walks (10 min after each meal, lowers glucose 20-30%), NEAT maximisation (+2-3k steps daily), Loaded stretching (2 min under load, post-set), Blood flow restriction (20-30% 1RM with cuff).

Recovery: Sauna protocol (80-100°C, 20 min, 4×/week — Laukkanen data), Cold-hot contrast cycling (sauna 15 min → cold 3 min × 3 cycles), NSDR/Yoga Nidra (20 min, dopamine rises 65%), Sleep extension block (30-60 min extra for 2 weeks), Creatine loading phase (20g/day × 5 days then 5g maintenance), Morning light + cold shower finish.

Psychology: Implementation intentions ("When X, I will Y"), Dopamine scheduling (no low-effort dopamine before training), Two-minute rule (commit only to starting), Training log practice (write every set), Weekly body composition check (tape + scale Monday AM), Deliberate discomfort practice.

When suggesting an accelerator: name it, explain the mechanism in 2-3 sentences in your coaching voice, give the specific protocol in brief, and say why it fits this person's specific situation right now. Always end with "You can read the full breakdown on the Accelerators page." Never suggest anything medically inappropriate given their profile.

Safety: Never suggest extended fasting to someone with disordered eating history, very low current calories, or health conditions that contraindicate it. Never suggest BFR to someone with cardiovascular issues. Use the injuries and health conditions in the profile to filter.

NEW INFORMATION DETECTION — important:
If the user mentions something that would update their profile — a new injury, a change in sleep, a new supplement they have started, a goal shift, or a change to their training — acknowledge it and end your response with: [NEW_INFO: brief description]

CRITICALLY: If the user says anything like "add this to my training plan", "can you add this", "include this in my programme", "I want to add X to my sessions" — treat it as a training modification. Add [NEW_INFO: training modification: X] and explain it will be saved as an ongoing modification at the bottom of their coaching report, separate from the core programme structure.

Examples:
- "I've started taking ashwagandha" → [NEW_INFO: started taking ashwagandha]
- "My knee has been hurting again" → [NEW_INFO: knee pain recurring]
- "I'm now sleeping 6 hours instead of 8" → [NEW_INFO: sleep reduced to 6 hours]
- "I'm thinking of changing my goal to fat loss" → [NEW_INFO: considering goal change to fat loss]

Only add this tag if there is genuinely new information that would change the profile. Do not add it for questions or general discussion.`;

  function buildSystemPrompt(profile, pageContext) {
    const isFemale = (profile.sex || '').toLowerCase() === 'female';
    const injuries = profile.injuryAssessments || profile.injuries || [];
    const supps    = profile.supplements || [];
    const weekPlan = profile.weekPlan || [];
    const trainDays = weekPlan.filter(d => d.priority === 'training').map(d => d.day).join(', ');

    // Detect if message context is food/recipe related — only inject those fields when relevant
    const isFoodContext = ['food','fuel'].includes(getPageType());

    const dynamicBlock = `You are speaking directly with ${profile.name}.

${(function() {
  try {
    var mem = profile.behaviourMemory;
    if (!mem) return '';
    var lines = ['BEHAVIOUR MEMORY (AI-compressed history):'];
    if (mem.complianceScore !== null && mem.complianceScore !== undefined) {
      lines.push('Rolling compliance score: ' + mem.complianceScore + '/100');
    }
    if (mem.currentFlags && mem.currentFlags.length) {
      lines.push('Current flags: ' + mem.currentFlags.join('; '));
    }
    if (mem.patterns && mem.patterns.length) {
      lines.push('Known patterns: ' + mem.patterns.join('; '));
    }
    if (mem.weekSummaries && mem.weekSummaries.length) {
      lines.push('Recent weeks:');
      mem.weekSummaries.slice(0,2).forEach(function(w) {
        if (w.summary) lines.push('  ' + w.week + ': ' + w.summary);
      });
    }
    return lines.join('\n') + '\n\n';
  } catch(e) { return ''; }
})()}CLIENT PROFILE:
Name: ${profile.name} | Age: ${profile.age} | Sex: ${profile.sex}
Weight: ${profile.weight}kg | Height: ${profile.height}cm${profile.bodyFat ? ' | Body fat: ' + profile.bodyFat + '%' : ''}
Goal: ${profile.goal}${profile.target ? ' — ' + profile.target : ''}
Experience: ${profile.experience || '—'} | Training: ${profile.trainingDays} days/week (${trainDays})
Wake: ${profile.wakeTime || '07:00'} | Sleep: ${profile.sleep || '—'} | Bedtime: ${profile.bedtime || '—'}
Calories: ${profile.calories} kcal | Protein: ${profile.protein}g | Carbs: ${profile.carbs}g | Fat: ${profile.fat}g
Eating window: ${profile.actualEatingWindow || profile.fastingWindow || profile.eatingWindow || 'flexible'}
Stress: ${profile.stressLevel || '—'} | Alcohol: ${profile.alcoholHabit || '—'}
Diet: ${profile.dietType || 'no restrictions'}${profile.triggerFoods && !profile.triggerFoods.toLowerCase().includes('none') ? ' | Trigger foods: ' + profile.triggerFoods : ''}
Supplements: ${supps.map(s => s.name + ' ' + s.dose + ' (' + (s.timing || '') + ')').join(', ') || 'none'}
${injuries.length ? 'INJURIES: ' + injuries.map(i => (i.location || i) + ': ' + (i.assessment || i.detail || '')).join('; ') : 'No injuries'}
${profile.healthConditions && profile.healthConditions !== 'none' ? 'Health conditions: ' + profile.healthConditions : ''}
${isFoodContext && profile.cookingApproach ? 'Food approach: ' + profile.cookingApproach + (profile.cuisinePrefs && profile.cuisinePrefs.length ? ' | ' + profile.cuisinePrefs.join(', ') : '') : ''}
${isFemale && profile.menstrualCycle ? 'Cycle: ' + profile.menstrualCycle : ''}
${isFemale ? 'Frame advice through female physiology — hormonal cycle, oestrogen effects, female-specific training and nutrition.' : 'Frame advice through male physiology — testosterone, GH, male-specific recovery and nutrition.'}
${profile.bodyScan ? `BODY SCAN (${profile.bodyScan.scanDate || 'recent'}) — USE THESE OVER FORMULA ESTIMATES:
${profile.bodyScan.weight ? 'Weight: ' + profile.bodyScan.weight + 'kg' : ''}${profile.bodyScan.bodyFatPct ? ' | Body fat: ' + profile.bodyScan.bodyFatPct + '%' : ''}${profile.bodyScan.leanMass ? ' | Lean mass: ' + profile.bodyScan.leanMass + 'kg' : ''}${profile.bodyScan.bmr ? ' | BMR: ' + profile.bodyScan.bmr + ' kcal' : ''}${profile.bodyScan.metabolicAge ? ' | Metabolic age: ' + profile.bodyScan.metabolicAge : ''}${profile.bodyScan.visceralFatIndex ? ' | Visceral fat: ' + profile.bodyScan.visceralFatIndex + (profile.bodyScan.visceralFatIndex >= 13 ? ' (elevated)' : '') : ''}` : ''}

CURRENT PAGE: ${pageContext}

${(function() {
  try {
    var ledger = typeof loadWeekLedger === 'function' ? loadWeekLedger() : null;
    if (!ledger) return '';
    return typeof buildWeekContext === 'function' ? buildWeekContext(ledger) : '';
  } catch(e) { return ''; }
})()}

${(function() {
  try {
    // Multi-week trend: scan last 4 weeks of daylogs
    var lines = [];
    var now = new Date();
    var found = 0;
    for (var w = 0; w < 4; w++) {
      var weekStart = new Date(now);
      weekStart.setDate(now.getDate() - now.getDay() - (w * 7) + 1);
      var weekKey = weekStart.toISOString().slice(0, 10);
      var wdata = localStorage.getItem('bl_weekledger_' + weekKey);
      if (!wdata) continue;
      var wl = JSON.parse(wdata);
      if (!wl || !wl.summary) continue;
      found++;
      var s = wl.summary;
      var label = w === 0 ? 'This week' : w === 1 ? 'Last week' : w + ' weeks ago';
      lines.push(label + ': ' + s.sessionsDone + '/' + s.sessionsPlanned + ' sessions | fatigue: ' + s.fatigueLevel + ' | status: ' + s.weeksGoalStatus + (s.strengthMissing && s.strengthMissing.length ? ' | missed: ' + s.strengthMissing.join(', ') : ''));
    }
    if (found < 2) return '';
    return 'MULTI-WEEK TREND (use to spot patterns):\n' + lines.join('\n');
  } catch(e) { return ''; }
})()}
${(function() {
  try {
    var _ov = (profile.overlays || []).filter(function(o){ return o.active !== false; });
    var _cn = profile.coachNotes || '';
    if (!_ov.length && !_cn) return '';
    var _out = [];
    if (_ov.length) {
      _out.push('ACTIVE DAILY OVERLAYS & MICRO-PROTOCOLS:');
      _ov.forEach(function(o) {
        var when = o.trigger==='rest-days'?'rest days':o.trigger==='pre-training'?'before sessions':o.trigger==='morning'?'every morning':'daily';
        _out.push('\u2022 '+o.name+' — '+when+(o.duration?', '+o.duration:'')+(o.date?' [added '+o.date+']':''));
        if (o.detail && o.detail!==o.name) _out.push('  Details: '+o.detail);
      });
    }
    if (_cn) { _out.push('COACH NOTES:'); _out.push(_cn); }
    return _out.join('\n')+'\n';
  } catch(e){ return ''; }
})()}${(function() {
  try {
    var gb = profile.gapBridge;
    if (!gb) return '';
    var lines = ['GAP BRIDGE (body scan to programme translation):'];
    lines.push('Current phase: ' + (gb.currentPhase||'unknown'));
    lines.push('Phase rationale: ' + (gb.phaseRationale||''));
    if (gb.primaryGaps && gb.primaryGaps.length) lines.push('Primary gaps: ' + gb.primaryGaps.join(', '));
    if (gb.weeklyFocus) lines.push('This week: ' + gb.weeklyFocus);
    if (gb.coachContext) lines.push('Coach framing: ' + gb.coachContext);
    if (gb.successMetrics) lines.push('Success metrics: ' + gb.successMetrics.join(' | '));
    return lines.join('\n') + '\n';
  } catch(e) { return ''; }
})()}
${(function() {
  try {
    var wa = profile.weeklyAdaptation;
    if (!wa || !wa.headline) return '';
    var wLines = ['WEEKLY RECONCILIATION — LAST 7 DAYS:'];
    wLines.push('Week: ' + wa.weekStart + ' | Days logged: ' + (wa.logsAnalysed||'?') + ' | Rating: ' + wa.weekRating + '/5');
    wLines.push('Read: ' + wa.headline);
    if (wa.coachNote) wLines.push('Analysis: ' + wa.coachNote);
    if (wa.patterns && wa.patterns.length) wLines.push('Patterns: ' + wa.patterns.join('; '));
    if (wa.adaptations && wa.adaptations.length) {
      wLines.push('Active programme adaptations this week:');
      wa.adaptations.forEach(function(a) {
        wLines.push('  [' + a.type.toUpperCase() + '] ' + a.change + ' — ' + a.rationale);
      });
    }
    if (wa.nextWeekFocus) wLines.push('Current coaching focus: ' + wa.nextWeekFocus);
    wLines.push('Use this when answering questions about the week, progress, training load, or plan adjustments. Do not volunteer it unprompted.');
    return '\n' + wLines.join('\n') + '\n';
  } catch(e) { return ''; }
})()}

${(function() {
  try {
    // Read strength baseline: profile takes priority over raw key
    var _sb = profile.strengthBaseline;
    if (!_sb) {
      var _raw = localStorage.getItem('bl_strength_baseline');
      _sb = _raw ? JSON.parse(_raw) : null;
    }
    if (!_sb) return '';
    var _liftNames = {
      'back-squat':'Back squat','deadlift':'Deadlift','bench-press':'Bench press',
      'ohp':'Overhead press','bent-over-row':'Bent-over row','pull-up':'Pull-up',
      'rdl':'Romanian deadlift','hip-thrust':'Hip thrust'
    };
    var _lifts = [];
    Object.keys(_sb).forEach(function(id) {
      var lift = _sb[id];
      if (!lift || !lift.entries || !lift.entries.length) return;
      var e = lift.entries[0];
      _lifts.push((_liftNames[id]||id) + ': ' + e.weight + 'kg \xd7 ' + e.reps + 'reps (e1RM ~' + Math.round(e.e1rm||0) + 'kg)');
    });
    if (!_lifts.length) return '';
    return '\nSTRENGTH BASELINE (use for load prescriptions — these are their actual working weights):\n' + _lifts.join('\n') + '\n';
  } catch(e) { return ''; }
})()}
`;

    // ── Risk-aware instruction injection ──────────────────────────────────
    var riskBlock = (typeof BL_RISK !== 'undefined')
      ? BL_RISK.buildRiskBlock(profile)
      : '';
    var staticWithRisk = riskBlock
      ? riskBlock + STATIC_COACHING_INSTRUCTIONS
      : STATIC_COACHING_INSTRUCTIONS;

    return { static: staticWithRisk, dynamic: dynamicBlock };
  }

  // ── FOLLOW-UP PROMPT ──────────────────────────────────
  function buildFollowUpPrompt(lastUserMsg, lastCoachReply, profile, history) {
    // Include recent conversation context (last 4 exchanges)
    const recentHistory = (history || []).slice(-8).map(m =>
      (m.role === 'user' ? profile.name : 'Coach') + ': ' + m.content.slice(0, 120)
    ).join('\n');

    return `You are generating follow-up question chips for a fitness coaching chat.

RECENT CONVERSATION:
${recentHistory}

LAST EXCHANGE:
${profile.name}: "${lastUserMsg}"
Coach: "${lastCoachReply.slice(0, 400)}"

PROFILE CONTEXT:
${profile.name}, ${profile.age}yo, goal: ${profile.goal}, training: ${profile.trainingDays} days/week, today: ${profile.todayContext || 'training day'}

Generate 3 follow-up questions that ${profile.name} would genuinely want to ask next based on the specific concern just raised. Questions should:
- Directly follow from what was just discussed (not generic)
- Probe the practical implication, timing, or adjustment needed
- Be phrased as the user would actually say them (casual, first person)
- Be 5-12 words — specific enough to be useful

Return ONLY a JSON array of 3 strings. No explanation.
Example for "gym later than expected": ["Does this change when I should eat?", "Will a shorter warm-up be enough?", "Should I adjust my sets if I'm rushed?"]`;
  }

  // ── PAGE DETECTION ────────────────────────────────────
  function getPageType() {
    const meta = document.querySelector('meta[name="bl-page"]');
    return meta ? meta.getAttribute('content') : 'default';
  }

  function getPageLabel() {
    const labels = { 'day':'Today','food':'Food','fuel':'Food','training':'Training','alcohol':'Alcohol','weightloss':'Weight Loss','hunger':'Hunger','optimal':'The Machine','synthesis':'How It Runs','story':'The Story','mentalhealth':'Mental Health','longevity':'Longevity','attia':'Protocols','programme':'Programme','instructions':'Coaching Report','science':'Science','body':'Muscle Guide','howitworks':'How It Works' };
    return labels[getPageType()] || 'BodyLens';
  }

  // ── HISTORY ───────────────────────────────────────────
  function loadHistory() {
    try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); }
    catch(e) { return []; }
  }
  function saveHistory(h) {
    try { localStorage.setItem(HISTORY_KEY, JSON.stringify(h.slice(-MAX_HISTORY))); }
    catch(e) {}
  }
  function clearHistory() { localStorage.removeItem(HISTORY_KEY); }

  // ── PROFILE UPDATE ────────────────────────────────────
  function extractNewInfo(text) {
    const match = text.match(/\[NEW_INFO:\s*([^\]]+)\]/);
    return match ? match[1].trim() : null;
  }

  function promptProfileUpdate(newInfo, profile) {
    const container = document.getElementById('bl-coach-messages');
    if (!container) return;

    const updateEl = document.createElement('div');
    updateEl.className = 'coach-update-prompt';
    updateEl.innerHTML = `
      <div class="cup-icon">📋</div>
      <div class="cup-text">Add "<em>${newInfo}</em>" to your profile?</div>
      <div class="cup-actions">
        <button class="cup-yes" onclick="window._blCoach.saveInfo(${JSON.stringify(newInfo)}, this.closest('.coach-update-prompt'))">Yes, save it</button>
        <button class="cup-no" onclick="this.closest('.coach-update-prompt').remove()">No thanks</button>
      </div>`;
    container.appendChild(updateEl);
    container.scrollTop = container.scrollHeight;
  }

  function saveNewInfo(newInfo, profile) {
    try {
      const raw = localStorage.getItem('bl_profile');
      if (!raw) return false;
      const p = JSON.parse(raw);

      // Snapshot before state for logging
      const beforeSnap = {
        coachNotes: p.coachNotes || '',
        overlays: (p.overlays || []).slice(),
        injuries: (p.injuries || []).slice(),
      };

      // Classify what kind of update this is
      const lower = newInfo.toLowerCase();
      if (lower.includes('sleep') || lower.includes('hours')) {
        p.coachNotes = (p.coachNotes || '') + '\n• Sleep update: ' + newInfo;
      } else if (lower.includes('injury') || lower.includes('pain') || lower.includes('knee') || lower.includes('back') || lower.includes('shoulder')) {
        if (!p.injuries) p.injuries = [];
        p.injuries.push({ location: newInfo, addedByCoach: true, date: new Date().toISOString().slice(0,10) });
      } else if (lower.includes('supplement') || lower.includes('taking') || lower.includes('started')) {
        p.coachNotes = (p.coachNotes || '') + '\n• Supplement update: ' + newInfo;
      } else if (lower.includes('goal') || lower.includes('fat loss') || lower.includes('muscle')) {
        p.coachNotes = (p.coachNotes || '') + '\n• Goal note: ' + newInfo;
      } else if (lower.includes('training') || lower.includes('exercise') || 
                 lower.includes('add this') || lower.includes('add to') ||
                 lower.includes('include') || lower.includes('programme') ||
                 lower.includes('workout') || lower.includes('session') ||
                 lower.includes('activation') || lower.includes('mobility') ||
                 lower.includes('stretch') || lower.includes('glute') ||
                 lower.includes('daily') || lower.includes('every day')) {
        // Training/overlay modification — saved to p.overlays so it surfaces in the daily plan
        if (!p.overlays) p.overlays = [];
        const overlayId = 'coach-' + Date.now();
        p.overlays.push({
          id: overlayId,
          name: newInfo.length > 40 ? newInfo.slice(0,40) + '…' : newInfo,
          detail: newInfo,
          trigger: lower.includes('rest') ? 'rest-days' : 
                   lower.includes('morning') ? 'morning' :
                   lower.includes('pre') || lower.includes('before') ? 'pre-training' : 'daily',
          addedBy: 'coach',
          date: new Date().toISOString().slice(0,10),
          active: true
        });
        // Also keep in coachNotes as a log
        p.coachNotes = (p.coachNotes || '') + '\n• Overlay added: ' + newInfo;
      } else {
        p.coachNotes = (p.coachNotes || '') + '\n• ' + newInfo;
      }

      p.lastUpdated = new Date().toISOString();

      // Capture after-state for logging
      const afterSnap = {
        coachNotes: p.coachNotes || '',
        overlays: p.overlays || [],
        injuries: p.injuries || [],
      };

      localStorage.setItem('bl_profile', JSON.stringify(p));

      // Log to proposal bus so it appears in the decision log
      if (typeof blPropose === 'function') {
        const changes = [];
        if (afterSnap.coachNotes !== beforeSnap.coachNotes) {
          changes.push({ field: 'coachNotes.append', label: 'Coach note', before: '—', after: newInfo });
        }
        if (afterSnap.overlays.length !== beforeSnap.overlays.length) {
          changes.push({ field: 'overlays.push', label: 'Training overlay', before: 'Not set', after: newInfo });
        }
        if (afterSnap.injuries.length !== beforeSnap.injuries.length) {
          changes.push({ field: 'injuries.push', label: 'Injury note', before: 'Not recorded', after: newInfo });
        }
        if (changes.length) {
          // Commit directly (coach updates are already confirmed via Yes/No prompt)
          const propId = blPropose('coach', 'Coach update: ' + newInfo.slice(0,60), changes, 'Confirmed in coach conversation');
          if (propId) blCommitProposal(propId);
        }
      }

      return true;
    } catch(e) {
      console.error('Profile save error:', e);
      return false;
    }
  }

  // ── MODEL SELECTOR ────────────────────────────────────
  // Routes to Haiku for simple conversational messages (~5× faster, ~20× cheaper)
  // Falls back to Sonnet only when genuine reasoning depth is needed.
  function selectModel(msg) {
    const t = msg.toLowerCase().trim();
    const words = t.split(/\s+/).length;

    // Always Sonnet for deep-reasoning topics
    const needsSonnet = [
      /programme|periodis|mesocycle|macrocycle|phase\s+(1|2|3|one|two|three)/,
      /injury|pain|hurts?|inflammation|rehab|physiother/,
      /hormon|testoster|cortisol|insulin|leptin|ghrelin|oestrogen|estrogen/,
      /explain\s+(why|how|the|this)|science\s+behind|mechanism|research|study|evidence/,
      /compare|versus|\bvs\.?\b|difference\s+between|better.{0,10}(for|than)/,
      /protocol|intervention|periodis|optimis|strateg/,
      /progressive\s+overload|volume\s+landmark|intensity|proximity.to.failure/,
      /gut|microbiome|autoimmun|chronic\s+inflam/,
      /zone\s*2|vo.?2\s*max|lactate|aerobic\s+base|anaerobic\s+threshold/,
      /should\s+i\s+.{25,}/,   // long "should I" questions
      /what.s\s+the\s+best\s+.{20,}/,
    ];

    if (words > 30) return MODEL;  // Long questions → Sonnet
    if (needsSonnet.some(p => p.test(t))) return MODEL;
    return MODEL_FAST;  // Haiku for conversational / simple questions
  }

  // ── API CALL ──────────────────────────────────────────
  async function askCoach(userMessage, profile) {
    const history = loadHistory();
    const prompt = buildSystemPrompt(profile, PAGE_CONTEXTS[getPageType()] || PAGE_CONTEXTS.default);
    history.push({ role: 'user', content: userMessage });

    const chosenModel = selectModel(userMessage);

    // System prompt sent as two blocks:
    //   Block 1 — static coaching instructions, marked for caching (saves ~75% on input cost after first call)
    //   Block 2 — dynamic client profile + page context (small, billed normally)
    // Note: prompt caching only activates when using Sonnet (Haiku doesn't support cache_control)
    const systemPayload = chosenModel === MODEL
      ? [
          { type: 'text', text: prompt.static, cache_control: { type: 'ephemeral' } },
          { type: 'text', text: prompt.dynamic },
        ]
      : prompt.static + '\n\n' + prompt.dynamic;  // Haiku: plain string system prompt

    const res = await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: chosenModel,
        max_tokens: 650,
        system: systemPayload,
        messages: history.slice(-MAX_HISTORY),
      }),
    });
    if (!res.ok) throw new Error('API ' + res.status);
    const data = await res.json();
    if (data.error) throw new Error(data.error.message || 'API error');
    const text = (data.content || []).map(b => b.text || '').join('').trim();
    if (!text) throw new Error('Empty response');
    history.push({ role: 'assistant', content: text });
    saveHistory(history);
    return text;
  }

  // Generate follow-up chips deterministically — no API call.
  // Pattern-matches keywords in the last coach reply and selects
  // contextually relevant chips from a curated library.
  // Saves ~$0.004 per coach message (~24% of per-message cost).
  function generateFollowUps(lastUser, lastCoach, profile) {
    const reply = (lastCoach || '').toLowerCase();
    const isFemale = (profile.sex || '').toLowerCase() === 'female';
    const injuries = profile.injuryAssessments || profile.injuries || [];
    const trigger = (profile.triggerFoods || '').split(/[,/]/)[0].trim();
    const hasTrigger = trigger && !trigger.toLowerCase().includes('none');
    const name = profile.name || '';

    // Topic detection — order matters, more specific first
    if (/protein|leucine|mps|amino|whey/.test(reply)) return [
      `How do I spread protein through the day?`,
      `Does timing matter or just the total?`,
      `Best high-protein foods that aren't chicken?`,
    ];
    if (/sleep|recovery|rest|circadian|melatonin|cortisol/.test(reply)) return [
      `What's the fastest way to improve sleep quality?`,
      `How much does one bad night actually set me back?`,
      `Should I train if I slept badly?`,
    ];
    if (/creatine|supplement|magnesium|omega|vitamin/.test(reply)) return [
      `When's the best time to take it?`,
      `Can I stack this with what I already take?`,
      `How long before I notice a difference?`,
    ];
    if (/calorie|deficit|tdee|maintenance|surplus/.test(reply)) return [
      `How do I know if my deficit is too aggressive?`,
      `Should I eat more on training days?`,
      `What happens if I go over my target?`,
    ];
    if (/cardio|zone 2|vo2|hiit|steps|walk/.test(reply)) return [
      `How do I fit cardio without killing my lifts?`,
      `Zone 2 vs HIIT — which is better for my goal?`,
      `How much cardio is too much?`,
    ];
    if (/alcohol|drink|wine|beer/.test(reply)) return [
      `What's the least bad drink to choose?`,
      `How long does it take to fully recover?`,
      `Should I train the morning after?`,
    ];
    if (/fast|window|intermittent|16.8|eating window/.test(reply)) return [
      `What can I have without breaking the fast?`,
      `Does coffee break it?`,
      `Should I train fasted?`,
    ];
    if (/injury|pain|knee|back|shoulder|hip|modify/.test(reply)) return [
      injuries.length ? `Can I still train around my ${injuries[0].location || 'injury'}?` : `How do I know when it's safe to push again?`,
      `What movements are safe right now?`,
      `How long does this typically take to heal?`,
    ];
    if (/stress|cortisol|anxiet|mental|mood/.test(reply)) return [
      `Does high stress actually affect fat loss?`,
      `Should I train less when I'm stressed?`,
      `What's the fastest way to lower cortisol?`,
    ];
    if (/plateau|stall|stopped|progress|slow/.test(reply)) return [
      `How long should I wait before changing something?`,
      `Is it a diet problem or a training problem?`,
      `Should I take a diet break?`,
    ];
    if (/sauna|cold|plunge|contrast|nsdr|yoga nidra/.test(reply)) return [
      `How often do I need to do this to see results?`,
      `Best time of day — before or after training?`,
      `Can I combine this with my current routine?`,
    ];
    if (/fat loss|lean|cut|shred|body fat/.test(reply)) return [
      `How do I know I'm losing fat not muscle?`,
      `Should I do more cardio or keep cutting calories?`,
      hasTrigger ? `I keep craving ${trigger} — what do I do?` : `How do I manage hunger on a deficit?`,
    ];
    if (/muscle|hypertrophy|strength|build|mass/.test(reply)) return [
      `Am I eating enough to actually build?`,
      `How close to failure should I train?`,
      `How long until I see real changes?`,
    ];
    if (/hormone|testoster|oestrogen|perimenopause|cycle/.test(reply)) return isFemale ? [
      `How should I adjust training around my cycle?`,
      `Does this affect my nutrition too?`,
      `What should I actually track?`,
    ] : [
      `What's the biggest natural lever for testosterone at ${profile.age || 40}?`,
      `How much does sleep actually affect it?`,
      `Does training volume affect hormones?`,
    ];

    // Generic fallback — personalised to goal
    const goal = (profile.goal || '').toLowerCase();
    if (goal.includes('fat') || goal.includes('los')) return [
      `What's my highest-leverage habit right now?`,
      `Am I doing enough, or should I push harder?`,
      `What would move the needle fastest this week?`,
    ];
    return [
      `What should I focus on most this week?`,
      `Am I leaving anything on the table?`,
      isFemale ? `How does my cycle affect this?` : `What's my single best next move?`,
    ];
  }

  // ── INITIAL CHIPS — clever, motivational ──────────────
  function getInitialChips(profile, pageType) {
    const isFemale = (profile.sex || '').toLowerCase() === 'female';
    const age = profile.age || 35;
    const DAY_MAP = {0:6,1:0,2:1,3:2,4:3,5:4,6:5};
    const todayPlan = (profile.weekPlan || [])[DAY_MAP[new Date().getDay()]] || {};
    const isTraining = todayPlan.priority === 'training';
    const injuries = profile.injuryAssessments || profile.injuries || [];
    const trigger = (profile.triggerFoods || '').split(/[,/]/)[0].trim();
    const hasTrigger = trigger && !trigger.toLowerCase().includes('none');

    const sets = {
      'day': isTraining ? [
        `What's the most important thing to nail today?`,
        `How hard should I push on ${todayPlan.type || 'today'}?`,
        injuries.length ? `My ${injuries[0].location || 'injury'} is niggly today` : `Am I recovered enough to go hard?`,
        `What should I eat before training?`,
      ] : [
        `Rest day — should I do anything or literally nothing?`,
        `How do I make the most of a rest day?`,
        `Can I train if I feel fine?`,
        `Same calories on rest days?`,
      ],
      'food': [
        `What should I eat today to hit my targets?`,
        `Give me a quick high-protein dinner`,
        `Am I eating at the right times?`,
        hasTrigger ? `I'm craving ${trigger} — help` : `How do I cut food noise?`,
      ],
      'fuel': [
        `What's the best thing to eat before my session?`,
        `Post-training — how fast does the window really close?`,
        `I'm always under on protein by dinner`,
        `Training vs rest day — what actually changes?`,
      ],
      'alcohol': [
        `Be honest — how much does the weekend actually cost me?`,
        `What's the least bad drink if I have to?`,
        isTraining ? `I trained today and want a glass of wine tonight` : `Best day of the week to drink?`,
        `How long until I'm fully recovered from a big night?`,
      ],
      'weightloss': [
        `Why do I always stall after 2-3 weeks?`,
        `How do I know I'm losing fat not muscle?`,
        `Should I do more cardio or cut more calories?`,
        `Is ${profile.calories} the right target for me?`,
      ],
      'hunger': [
        hasTrigger ? `I'm craving ${trigger} — what do I do?` : `I'm always hungry at 4pm`,
        `Why am I hungrier on rest days?`,
        `What kills cravings fastest?`,
        isFemale ? `My hunger went mad this week — hormones?` : `I ate my target and still feel empty`,
      ],
      'optimal': [
        `My energy crashes at 3pm every day`,
        `How do I get sharper focus in the mornings?`,
        `I've been anxious lately — what can actually help?`,
        isFemale ? `My mood is all over the place this week` : `How do I boost testosterone naturally at ${age}?`,
      ],
      'training': [
        `Am I leaving gains on the table with my split?`,
        `How close to failure should I actually train?`,
        injuries.length ? `Can I still build muscle around my ${injuries[0].location || 'injury'}?` : `Is my volume right?`,
        `When should I deload?`,
      ],
      'mentalhealth': [
        `I've been stressed lately — is it affecting my progress?`,
        `How do I stay motivated when results are slow?`,
        isFemale ? `My relationship with food isn't great right now` : `I keep skipping sessions`,
        `Does training actually help with anxiety?`,
      ],
      'longevity': [
        `What's the single most important thing I can do at ${age}?`,
        `Should I get any bloodwork done?`,
        `How much Zone 2 do I actually need?`,
        isFemale && age >= 38 ? `What should I know about perimenopause and training?` : `What changes most after ${age + 5}?`,
      ],
      'attia': [
        `Should I actually do cold plunges?`,
        `How do I know what my VO₂max is?`,
        `What bloodwork should I ask my GP for?`,
        `Is NSDR actually worth doing?`,
      ],
    };

    return sets[pageType] || [
      `What's the one thing I should focus on right now?`,
      `Am I doing enough, or should I push harder?`,
      isFemale ? `How does my cycle affect this week?` : `What's my highest-leverage habit to add?`,
      `Coach me on where I'm leaving the most on the table`,
    ];
  }

  // ── FORMAT RESPONSE — prose only, no markdown ─────────
  function formatResponse(text) {
    // Strip any [NEW_INFO:...] tags from the displayed text
    const clean = text.replace(/\[NEW_INFO:[^\]]*\]/g, '').trim();

    // Split into paragraphs, wrap each in <p>
    return clean
      .split(/\n\n+/)
      .map(para => {
        const t = para.trim();
        if (!t) return '';
        // Strip any stray markdown bold/italic that slipped through
        const stripped = t
          .replace(/\*\*([^*]+)\*\*/g, '$1')
          .replace(/\*([^*]+)\*/g, '$1')
          .replace(/^[•\-] /gm, '');
        return `<p>${stripped}</p>`;
      })
      .filter(Boolean)
      .join('');
  }

  // ── UI RENDER ─────────────────────────────────────────
  function buildUI() {
    const css = `
    #bl-coach-btn {
      position: fixed; bottom: 28px; right: 28px;
      width: 52px; height: 52px; border-radius: 50%;
      background: var(--jade, #00c8a0); border: none; cursor: pointer;
      z-index: 9999; display: flex; align-items: center; justify-content: center;
      box-shadow: 0 4px 20px rgba(0,200,160,0.4);
      transition: transform 0.18s, box-shadow 0.18s, background 0.18s;
      font-size: 20px;
    }
    #bl-coach-btn:hover { transform: scale(1.08); box-shadow: 0 6px 28px rgba(0,200,160,0.55); }
    #bl-coach-btn.open { background: #2a3830; box-shadow: 0 4px 14px rgba(0,0,0,0.35); }

    #bl-coach-panel {
      position: fixed; bottom: 92px; right: 28px;
      width: 420px; max-width: calc(100vw - 40px);
      height: 640px; max-height: calc(100vh - 110px);
      background: #111917; border: 1px solid #1e2e28; border-radius: 14px;
      display: flex; flex-direction: column; z-index: 9998;
      box-shadow: 0 20px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(0,200,160,0.06);
      transform: translateY(16px) scale(0.96); opacity: 0; pointer-events: none;
      transition: transform 0.22s cubic-bezier(0.34,1.56,0.64,1), opacity 0.18s ease;
      overflow: hidden;
    }
    #bl-coach-panel.open { transform: translateY(0) scale(1); opacity: 1; pointer-events: all; }

    #bl-coach-header {
      padding: 14px 16px 12px; border-bottom: 1px solid #1a2820;
      display: flex; align-items: center; justify-content: space-between;
      flex-shrink: 0; background: #0d1512;
    }
    .ch-left { display: flex; align-items: center; gap: 10px; }
    .ch-avatar { width: 30px; height: 30px; border-radius: 50%; background: rgba(0,200,160,0.12); border: 1px solid rgba(0,200,160,0.25); display: flex; align-items: center; justify-content: center; font-size: 13px; flex-shrink: 0; }
    .ch-name { font-size: 12px; font-weight: 700; color: #e8e3da; letter-spacing: 0.02em; }
    .ch-ask { font-size: 10px; font-weight: 400; color: #00c8a0; margin-top: 1px; letter-spacing: 0.03em; }
    .coach-status { font-size: 9px; color: #3e504a; }
    .coach-status.thinking { color: #00c8a0; animation: blink 1s infinite; }
    @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.3} }
    .ch-right { display: flex; gap: 4px; align-items: center; }
    .ch-btn { background:none; border:none; color:#3e504a; cursor:pointer; font-size:13px; padding:4px 7px; border-radius:5px; transition:color 0.1s; font-family:inherit; }
    .ch-btn:hover { color:#8a9490; }

    #bl-coach-page { padding: 5px 16px; font-size: 9px; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; color: #2a4038; background: #0d1512; border-bottom: 1px solid #1a2820; flex-shrink: 0; }
    #bl-coach-page span { color: #3e6050; }

    #bl-coach-messages {
      flex: 1; overflow-y: auto; padding: 14px 16px;
      display: flex; flex-direction: column; gap: 14px; scroll-behavior: smooth;
    }
    #bl-coach-messages::-webkit-scrollbar { width: 3px; }
    #bl-coach-messages::-webkit-scrollbar-thumb { background: #1e2e28; border-radius: 2px; }

    .coach-empty { display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; text-align:center; padding:20px; gap:8px; }
    .coach-empty-icon { font-size:28px; opacity:0.3; }
    .coach-empty-title { font-size:16px; font-weight:300; color:#8a9490; font-family:'Cormorant Garamond',Georgia,serif; }
    .coach-empty-sub { font-size:11px; color:#2a4038; line-height:1.6; max-width:220px; }

    .coach-msg { display:flex; flex-direction:column; animation: msgIn 0.16s ease; }
    @keyframes msgIn { from{opacity:0;transform:translateY(5px)} to{opacity:1;transform:translateY(0)} }

    .coach-msg-bubble { font-size: 13px; font-weight: 300; line-height: 1.7; max-width: 92%; }
    .coach-msg-bubble p { margin: 0 0 10px; }
    .coach-msg-bubble p:last-child { margin-bottom: 0; }

    .coach-msg.user .coach-msg-bubble {
      background: #1a2820; color: #e8e3da;
      padding: 9px 13px; border-radius: 10px 10px 2px 10px; align-self: flex-end;
    }
    .coach-msg.coach .coach-msg-bubble {
      color: #c0b8b0; align-self: flex-start;
      border-left: 2px solid rgba(0,200,160,0.22); padding-left: 11px;
    }

    .coach-typing { display:flex; gap:5px; align-items:center; padding:8px 0 0 13px; border-left:2px solid rgba(0,200,160,0.18); }
    .coach-typing span { width:5px; height:5px; background:#3e504a; border-radius:50%; animation:td 1.2s infinite; }
    .coach-typing span:nth-child(2){animation-delay:0.2s;}
    .coach-typing span:nth-child(3){animation-delay:0.4s;}
    @keyframes td{0%,60%,100%{transform:translateY(0);opacity:0.3}30%{transform:translateY(-4px);opacity:1}}

    /* Chips — initial and follow-up */
    #bl-coach-chips {
      padding: 8px 16px 4px; display: flex; flex-wrap: wrap; gap: 6px; flex-shrink: 0;
    }
    .coach-chip {
      background: #141f1a; border: 1px solid #1e2e28; border-radius: 20px;
      padding: 5px 13px; font-size: 11px; font-weight: 400; color: #5a7060;
      cursor: pointer; transition: all 0.12s; white-space: nowrap;
      font-family: inherit;
    }
    .coach-chip:hover { border-color:rgba(0,200,160,0.35); color:#00c8a0; background:rgba(0,200,160,0.05); }
    .coach-chip.followup { border-color: rgba(0,200,160,0.15); color: #4a6858; }
    .coach-chip.followup:hover { border-color: rgba(0,200,160,0.4); color: #00c8a0; }

    /* Profile update prompt */
    .coach-update-prompt {
      background: rgba(0,200,160,0.06); border: 1px solid rgba(0,200,160,0.2);
      border-radius: 8px; padding: 12px 14px;
      display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
      animation: msgIn 0.2s ease;
    }
    .cup-icon { font-size: 14px; flex-shrink: 0; }
    .cup-text { font-size: 12px; font-weight: 300; color: #8a9490; flex: 1; min-width: 120px; line-height: 1.4; }
    .cup-text em { color: #00c8a0; font-style: normal; }
    .cup-actions { display: flex; gap: 6px; }
    .cup-yes { background: rgba(0,200,160,0.12); border: 1px solid rgba(0,200,160,0.3); color: #00c8a0; padding: 4px 12px; border-radius: 12px; font-size: 11px; font-weight: 600; cursor: pointer; font-family: inherit; transition: all 0.12s; }
    .cup-yes:hover { background: rgba(0,200,160,0.2); }
    .cup-no { background: transparent; border: 1px solid #1e2e28; color: #3e504a; padding: 4px 10px; border-radius: 12px; font-size: 11px; cursor: pointer; font-family: inherit; }
    .cup-saved { font-size: 11px; color: #00c8a0; padding: 4px 0; }

    /* Input */
    #bl-coach-input-wrap {
      padding: 10px 14px 14px; border-top: 1px solid #1a2820;
      display: flex; gap: 8px; flex-shrink: 0; background: #0d1512;
    }
    #bl-coach-input {
      flex: 1; background: #1a2820; border: 1px solid #1e2e28; border-radius: 10px;
      padding: 9px 13px; font-size: 13px; font-family: 'Space Grotesk', sans-serif;
      color: #e8e3da; outline: none; resize: none; line-height: 1.4; max-height: 90px;
      transition: border-color 0.12s;
    }
    #bl-coach-input:focus { border-color: rgba(0,200,160,0.35); }
    #bl-coach-input.recording { border-color: rgba(220,50,50,0.45) !important; background: rgba(220,50,50,0.04); }
    #bl-coach-input::placeholder { color: #2a4038; }
    #bl-coach-send {
      width: 34px; height: 34px; border-radius: 8px; background: #00c8a0;
      border: none; cursor: pointer; display: flex; align-items: center; justify-content: center;
      flex-shrink: 0; align-self: flex-end; transition: opacity 0.12s;
      color: #0c1010; font-size: 16px; font-weight: 700;
    }
    #bl-coach-send:hover { opacity: 0.85; }
    #bl-coach-send:disabled { opacity: 0.25; cursor: not-allowed; }
    #bl-coach-mic {
      width: 34px; height: 34px; border-radius: 8px;
      background: transparent; border: 1px solid #1e2e28;
      cursor: pointer; display: flex; align-items: center; justify-content: center;
      flex-shrink: 0; align-self: flex-end; transition: all 0.15s;
      color: #3e6058; font-size: 15px; user-select: none;
    }
    #bl-coach-mic:hover { border-color: rgba(0,200,160,0.35); color: #00c8a0; background: rgba(0,200,160,0.06); }
    #bl-coach-mic.listening {
      background: rgba(220,50,50,0.15);
      border-color: rgba(220,50,50,0.6);
      color: #fff;
      font-size: 13px;
      box-shadow: 0 0 0 3px rgba(220,50,50,0.15), 0 0 12px rgba(220,50,50,0.2);
      animation: micRing 1.2s ease infinite;
    }
    @keyframes micRing {
      0%   { box-shadow: 0 0 0 0px rgba(220,50,50,0.4); }
      70%  { box-shadow: 0 0 0 6px rgba(220,50,50,0); }
      100% { box-shadow: 0 0 0 0px rgba(220,50,50,0); }
    }

    @media(max-width:480px) {
      #bl-coach-panel { right:10px; bottom:82px; width:calc(100vw - 20px); }
      #bl-coach-btn { right:14px; bottom:18px; }
    }

    /* ── FULL SCREEN OVERLAY ── */
    #bl-coach-overlay {
      display:none; position:fixed; inset:0;
      background:rgba(8,14,13,0.97); backdrop-filter:blur(20px);
      z-index:10000; flex-direction:column;
      animation:overlayIn 0.2s ease;
    }
    #bl-coach-overlay.open { display:flex; }
    @keyframes overlayIn { from{opacity:0;transform:scale(0.98)} to{opacity:1;transform:scale(1)} }

    /* Header */
    #blo-header {
      padding:14px 24px 12px; border-bottom:1px solid #1a2820;
      display:flex; align-items:center; justify-content:space-between;
      background:#0d1512; flex-shrink:0;
    }
    .blo-brand { font-size:13px; font-weight:300; color:#e8e3da; }
    .blo-brand em { font-style:italic; color:#3e6050; }
    .blo-title { font-size:11px; font-weight:600; letter-spacing:0.08em; text-transform:uppercase; color:#00c8a0; }
    .blo-close { background:none; border:1px solid #1e2e28; color:#8a9490; width:30px; height:30px; border-radius:6px; cursor:pointer; font-size:15px; font-family:inherit; }
    .blo-close:hover { border-color:#3e6050; color:#e8e3da; }

    /* Main area: conversation takes 80% height */
    #blo-main { flex:1; display:flex; flex-direction:column; overflow:hidden; }

    /* Chat messages — the primary real estate */
    #blo-messages {
      flex:1; overflow-y:auto; padding:20px 24px;
      display:flex; flex-direction:column; gap:14px;
    }
    #blo-messages::-webkit-scrollbar { width:3px; }
    #blo-messages::-webkit-scrollbar-thumb { background:#1e2e28; }

    .blo-msg { display:flex; flex-direction:column; animation:msgIn 0.16s ease; }
    @keyframes msgIn { from{opacity:0;transform:translateY(4px)} to{opacity:1;transform:translateY(0)} }
    .blo-msg-bubble { font-size:14px; font-weight:300; line-height:1.75; max-width:85%; }
    .blo-msg-bubble p { margin:0 0 10px; }
    .blo-msg-bubble p:last-child { margin:0; }
    .blo-msg.user .blo-msg-bubble {
      background:#1a2820; color:#e8e3da; padding:10px 14px;
      border-radius:12px 12px 2px 12px; align-self:flex-end;
    }
    .blo-msg.coach .blo-msg-bubble {
      color:#c0b8b0; align-self:flex-start;
      border-left:2px solid rgba(0,200,160,0.25); padding-left:13px;
    }
    .blo-typing { display:flex; gap:5px; align-items:center; padding:8px 0 0 13px; border-left:2px solid rgba(0,200,160,0.18); }
    .blo-typing span { width:5px; height:5px; background:#3e504a; border-radius:50%; animation:td 1.2s infinite; }
    .blo-typing span:nth-child(2){animation-delay:0.2s;}
    .blo-typing span:nth-child(3){animation-delay:0.4s;}

    /* Input row */
    #blo-input-wrap {
      padding:12px 20px; border-top:1px solid #1a2820;
      display:flex; gap:8px; background:#0d1512; flex-shrink:0;
    }
    #blo-input {
      flex:1; background:#1a2820; border:1px solid #1e2e28; border-radius:10px;
      padding:11px 15px; font-size:14px; font-family:'Space Grotesk',sans-serif;
      color:#e8e3da; outline:none; resize:none; line-height:1.4; max-height:120px;
    }
    #blo-input:focus { border-color:rgba(0,200,160,0.35); }
    #blo-input::placeholder { color:#2a4038; }
    #blo-input.recording { border-color:rgba(220,50,50,0.45) !important; background:rgba(220,50,50,0.04); }
    #blo-mic {
      width:40px; height:40px; border-radius:10px;
      background:transparent; border:1px solid #1e2e28;
      cursor:pointer; flex-shrink:0; align-self:flex-end;
      transition:all .15s; color:#3e6058; font-size:16px;
      display:flex; align-items:center; justify-content:center;
    }
    #blo-mic:hover { border-color:rgba(0,200,160,.35); color:#00c8a0; background:rgba(0,200,160,.06); }
    #blo-mic.listening {
      background:rgba(220,50,50,.15); border-color:rgba(220,50,50,.6);
      color:#fff; font-size:14px;
      animation:micRing 1.2s ease infinite;
    }
    #blo-send {
      width:40px; height:40px; border-radius:10px; background:#00c8a0;
      border:none; cursor:pointer; color:#0c1010; font-size:18px;
      font-weight:700; align-self:flex-end; flex-shrink:0;
    }

    /* Category tab strip — compact, at the bottom */
    #blo-cats {
      border-top:1px solid #1a2820; background:#0a1210;
      display:flex; overflow-x:auto; flex-shrink:0;
      padding:0; gap:0;
    }
    #blo-cats::-webkit-scrollbar { display:none; }
    .blo-cat-btn {
      display:flex; flex-direction:column; align-items:center; gap:2px;
      padding:10px 16px 8px; border:none; background:transparent;
      cursor:pointer; font-family:inherit; white-space:nowrap;
      border-top:2px solid transparent; transition:all 0.1s; flex-shrink:0;
    }
    .blo-cat-btn:hover { background:rgba(255,255,255,0.02); }
    .blo-cat-btn.active { border-top-color:#00c8a0; background:rgba(0,200,160,0.04); }
    .blo-cat-icon { font-size:16px; line-height:1; }
    .blo-cat-label { font-size:9px; font-weight:600; letter-spacing:0.06em; text-transform:uppercase; color:#3e504a; }
    .blo-cat-btn.active .blo-cat-label { color:#00c8a0; }

    /* Question pills — slide up above input when category tapped */
    #blo-q-panel {
      background:#0d1512; border-top:1px solid #1a2820;
      padding:12px 20px; display:none; flex-shrink:0;
      max-height:200px; overflow-y:auto;
    }
    #blo-q-panel.open { display:block; }
    .blo-q-label { font-size:8px; font-weight:700; letter-spacing:0.12em; text-transform:uppercase; color:#3e504a; margin-bottom:8px; }
    .blo-q-grid { display:flex; flex-direction:column; gap:6px; }
    .blo-q-pill {
      background:#111917; border:1px solid #1e2e28; border-radius:6px;
      padding:9px 14px; font-size:13px; font-weight:300; color:#8a9490;
      cursor:pointer; text-align:left; font-family:inherit;
      transition:all 0.1s; line-height:1.4;
    }
    .blo-q-pill:hover { border-color:rgba(0,200,160,0.3); color:#e8e3da; background:#141f1a; }

    /* Profile update prompt in overlay */
    .blo-update-prompt {
      background:rgba(0,200,160,0.05); border:1px solid rgba(0,200,160,0.18);
      border-radius:8px; padding:12px 14px; margin:4px 0;
      display:flex; align-items:center; gap:10px; flex-wrap:wrap;
    }
    .bup-text { font-size:12px; font-weight:300; color:#8a9490; flex:1; line-height:1.4; }
    .bup-text em { color:#00c8a0; font-style:normal; }
    .bup-yes { background:rgba(0,200,160,0.1); border:1px solid rgba(0,200,160,0.28); color:#00c8a0; padding:4px 12px; border-radius:10px; font-size:11px; font-weight:600; cursor:pointer; font-family:inherit; }
    .bup-no  { background:transparent; border:1px solid #1e2e28; color:#3e504a; padding:4px 10px; border-radius:10px; font-size:11px; cursor:pointer; font-family:inherit; }
    .bup-saved { font-size:11px; color:#00c8a0; }


    /* Expand button on main panel */
    #bl-coach-expand {
      background:none; border:1px solid #1e2e28; color:#3e504a;
      padding:3px 8px; border-radius:4px; font-size:10px; cursor:pointer;
      font-family:inherit; transition:all 0.1s; margin-right:4px;
    }
    #bl-coach-expand:hover { border-color:#3e6050; color:#8a9490; }

    @media(max-width:700px) {
      #blo-body { grid-template-columns:1fr; }
      #blo-cats { display:flex; overflow-x:auto; border-right:none; border-bottom:1px solid #1a2820; padding:8px 0; max-height:56px; }
      .blo-cat-btn { padding:8px 14px; white-space:nowrap; border-bottom:2px solid transparent; }
      .blo-cat-btn.active { border-right:none; border-bottom-color:#00c8a0; background:transparent; }
      #blo-chat { border-left:none; }
    }
    `;

    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);

    const wrap = document.createElement('div');
    wrap.innerHTML = `
      <button id="bl-coach-btn" aria-label="Ask your coach">💬</button>
      <div id="bl-coach-panel" role="dialog">
        <div id="bl-coach-header">
          <div class="ch-left">
            <div class="ch-avatar">⚡</div>
            <div>
              <div class="ch-name">Your Coach</div>
              <div class="ch-ask">Ask me anything</div>
            </div>
          </div>
          <div class="ch-right">
            <span class="coach-status" id="coach-status">Ready</span>
            <button id="bl-coach-expand" onclick="window._blCoach.expand()" title="Expand">⤢</button>
            <button class="ch-btn" onclick="window._blCoach.clear()" title="Clear">↺</button>
            <button class="ch-btn" onclick="window._blCoach.close()" title="Close">✕</button>
          </div>
        </div>
        <div id="bl-coach-page">Reading: <span id="bl-coach-page-label">${getPageLabel()}</span></div>
        <div id="bl-coach-messages">
          <div class="coach-empty">
            <div class="coach-empty-icon">⚡</div>
            <div class="coach-empty-title">Ask me anything</div>
            <div class="coach-empty-sub">I know your programme, your goals, and what you're reading right now.</div>
          </div>
        </div>
        <div id="bl-coach-chips"></div>
        <div id="bl-coach-input-wrap">
          <textarea id="bl-coach-input" placeholder="Ask your coach…" rows="1"></textarea>
          <button id="bl-coach-mic" title="Tap to speak">🎤</button>
          <button id="bl-coach-send">↑</button>
        </div>
      </div>

      <div id="bl-coach-overlay">
        <div id="blo-header">
          <div class="blo-brand">Body<em>Lens</em></div>
          <div class="blo-title" id="blo-title">Your coach</div>
          <button class="blo-close" onclick="window._blCoach.collapse()">&#10005;</button>
        </div>
        <div id="blo-main">
          <div id="blo-messages">
            <div class="blo-msg coach">
              <div class="blo-msg-bubble"><p>Ask me anything. I know your programme, your goals, and what you&#8217;re working on right now.</p></div>
            </div>
          </div>
          <div id="blo-q-panel">
            <div class="blo-q-label" id="blo-q-label">Questions</div>
            <div class="blo-q-grid" id="blo-q-grid"></div>
          </div>
          <div id="blo-input-wrap">
            <textarea id="blo-input" placeholder="Ask anything&#8230;" rows="1"></textarea>
            <button id="blo-mic" title="Tap to speak">🎤</button>
            <button id="blo-send">&#8593;</button>
          </div>
          <div id="blo-cats"></div>
        </div>
      </div>`;
    document.body.appendChild(wrap);
  }

  // ── HELPERS ───────────────────────────────────────────
  function addMessage(role, text) {
    const container = document.getElementById('bl-coach-messages');
    if (!container) return;
    const empty = container.querySelector('.coach-empty');
    if (empty) empty.remove();
    const msg = document.createElement('div');
    msg.className = `coach-msg ${role}`;
    const bubble = document.createElement('div');
    bubble.className = 'coach-msg-bubble';
    bubble.innerHTML = role === 'coach' ? formatResponse(text) : `<p>${text}</p>`;
    msg.appendChild(bubble);
    container.appendChild(msg);
    container.scrollTop = container.scrollHeight;
  }

  function showTyping() {
    const c = document.getElementById('bl-coach-messages');
    if (!c) return;
    const t = document.createElement('div');
    t.id = 'coach-typing'; t.className = 'coach-typing';
    t.innerHTML = '<span></span><span></span><span></span>';
    c.appendChild(t); c.scrollTop = c.scrollHeight;
  }
  function hideTyping() { const el = document.getElementById('coach-typing'); if (el) el.remove(); }

  function setStatus(text, thinking) {
    const el = document.getElementById('coach-status');
    if (el) { el.textContent = text; el.className = 'coach-status' + (thinking ? ' thinking' : ''); }
  }

  function showFollowUpChips(chips) {
    const container = document.getElementById('bl-coach-chips');
    if (!container || !chips || !chips.length) return;
    // Animate out old chips, then replace
    container.style.opacity = '0';
    container.style.transition = 'opacity 0.15s ease';
    setTimeout(() => {
      container.innerHTML = chips.map(c =>
        `<div class="coach-chip followup" data-msg="${c.replace(/"/g,'&quot;').replace(/'/g,'&#39;')}">${c}</div>`
      ).join('');
      container.querySelectorAll('.coach-chip').forEach(chip => {
        chip.addEventListener('click', () => window._blCoach.send(chip.dataset.msg));
      });
      container.style.display = 'flex';
      container.style.opacity = '1';
    }, 150);
  }

  // ── INIT ──────────────────────────────────────────────
  function init() {
    let profile;
    try { profile = JSON.parse(localStorage.getItem('bl_profile') || 'null'); }
    catch(e) { profile = null; }

    buildUI();

    const btn   = document.getElementById('bl-coach-btn');
    const panel = document.getElementById('bl-coach-panel');
    const input = document.getElementById('bl-coach-input');
    const send  = document.getElementById('bl-coach-send');

    if (!profile) {
      if (send) send.disabled = true;
      if (input) { input.placeholder = 'Complete onboarding to chat with your coach'; input.disabled = true; }
    } else {
      renderInitialChips(profile);
      loadHistory().forEach(m => addMessage(m.role === 'user' ? 'user' : 'coach', m.content));
    }

    // Toggle panel open/close
    // Restore open state from localStorage
    const wasOpen = localStorage.getItem('bl_coach_open') === '1';
    if (wasOpen) {
      panel.classList.add('open');
      btn.classList.add('open');
      btn.innerHTML = '✕';
    }

    btn.addEventListener('click', () => {
      const isOpen = panel.classList.toggle('open');
      btn.classList.toggle('open', isOpen);
      btn.innerHTML = isOpen ? '✕' : '💬';
      localStorage.setItem('bl_coach_open', isOpen ? '1' : '0');
      if (isOpen && input && !input.disabled) setTimeout(() => input.focus(), 250);
    });

    // The send function — MUST be async
    const send_msg = async (text) => {
      if (!profile) return;
      const msg = text || input?.value?.trim();
      if (!msg) return;
      if (input && !text) input.value = '';
      if (send) send.disabled = true;
      setStatus('Thinking…', true);
      addMessage('user', msg);
      showTyping();

      // Hide initial chips on first message
      const chipsEl = document.getElementById('bl-coach-chips');
      if (chipsEl) chipsEl.style.display = 'none';

      try {
        const reply = await askCoach(msg, profile);
        hideTyping();
        addMessage('coach', reply);
        setStatus('Ready');

        // Check for new info tag
        const newInfo = extractNewInfo(reply);
        if (newInfo) {
          promptProfileUpdate(newInfo, profile);
        }

        // Generate follow-up chips synchronously
        const followUps = generateFollowUps(msg, reply, profile);
        if (followUps && followUps.length) showFollowUpChips(followUps);

      } catch(e) {
        hideTyping();
        addMessage('coach', 'Something went wrong — try again.');
        setStatus('Error');
        console.error('Coach error:', e);
      }

      if (send) send.disabled = false;
      if (input && !text) input.focus();
    };

    if (send) send.addEventListener('click', () => send_msg());
    if (input) {
      input.addEventListener('keydown', e => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send_msg(); }
      });
      input.addEventListener('input', () => {
        input.style.height = 'auto';
        input.style.height = Math.min(input.scrollHeight, 90) + 'px';
      });
    }

    // ── VOICE INPUT (Web Speech API — free, no key) ───────
    let _recognition = null;
    let _micListening = false;
    let _micTargetInput = input; // which textarea receives the transcript — small panel by default

    const mic = document.getElementById('bl-coach-mic');
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SR || !mic) {
      // Browser doesn't support it — hide the button silently
      if (mic) mic.style.display = 'none';
    } else {
      // Build recogniser once, reuse it
      _recognition = new SR();
      _recognition.continuous = true;
      _recognition.interimResults = true;
      _recognition.lang = 'en-GB';
      _recognition.maxAlternatives = 1;

      function syncMicButtons(listening) {
        // Update both mic buttons to reflect current state
        [document.getElementById('bl-coach-mic'), document.getElementById('blo-mic')].forEach(function(btn) {
          if (!btn) return;
          btn.classList.toggle('listening', listening);
          btn.textContent = listening ? '⏹' : '🎤';
          btn.title = listening ? 'Tap to stop' : 'Tap to speak';
        });
      }

      _recognition.onstart = () => {
        _micListening = true;
        syncMicButtons(true);
        if (_micTargetInput) {
          _micTargetInput.value = '';
          _micTargetInput.placeholder = '🎤 Listening…';
          _micTargetInput.classList.add('recording');
        }
      };

      _recognition.onresult = (e) => {
        let interim = '', final = '';
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const t = e.results[i][0].transcript;
          if (e.results[i].isFinal) final += t;
          else interim += t;
        }
        if (_micTargetInput) {
          _micTargetInput.value = final || interim;
          _micTargetInput.style.height = 'auto';
          _micTargetInput.style.height = Math.min(_micTargetInput.scrollHeight, 90) + 'px';
        }
        // Auto-send on final result
        if (final.trim()) {
          setTimeout(() => {
            const txt = final.trim();
            stopMic();
            // Send to the correct panel
            const isBlo = _micTargetInput && _micTargetInput.id === 'blo-input';
            if (isBlo) bloSend(txt);
            else send_msg(txt);
          }, 300);
        }
      };

      _recognition.onerror = (e) => {
        if (e.error === 'no-speech') {
          stopMic();
          if (_micTargetInput) {
            _micTargetInput.placeholder = 'No speech detected — try again';
            setTimeout(() => {
              if (_micTargetInput) _micTargetInput.placeholder = _micTargetInput.id === 'blo-input' ? 'Ask anything…' : 'Ask your coach…';
            }, 2500);
          }
        } else if (e.error === 'not-allowed' || e.error === 'permission-denied') {
          stopMic();
          if (_micTargetInput) {
            _micTargetInput.placeholder = 'Mic blocked — check browser permissions';
            setTimeout(() => {
              if (_micTargetInput) _micTargetInput.placeholder = _micTargetInput.id === 'blo-input' ? 'Ask anything…' : 'Ask your coach…';
            }, 3500);
          }
        } else if (e.error !== 'aborted') {
          stopMic();
        }
      };

      _recognition.onend = () => {
        if (_micListening) {
          try { _recognition.start(); }
          catch(err) { stopMic(); }
        }
      };

      function stopMic() {
        if (!_micListening) return;
        _micListening = false;
        syncMicButtons(false);
        if (_micTargetInput) {
          _micTargetInput.placeholder = _micTargetInput.id === 'blo-input' ? 'Ask anything…' : 'Ask your coach…';
          _micTargetInput.classList.remove('recording');
        }
        try { _recognition.stop(); } catch(e) {}
      }

      function startMic(targetInput) {
        if (targetInput) _micTargetInput = targetInput;
        if (_micListening) return;
        try {
          _recognition.start();
        } catch(e) {
          try { _recognition.abort(); } catch(e2) {}
          setTimeout(() => {
            try { _recognition.start(); } catch(e3) {}
          }, 100);
        }
      }

      // Small panel mic click — targets small panel input
      mic.addEventListener('click', () => {
        if (_micListening) stopMic();
        else startMic(input);
      });
    }

    function toggleMic() {
      if (_micListening) stopMic();
      else if (mic) startMic(input);
    }
    const QUESTION_CATS = [
      {
        id:'today', icon:'📅', label:"Today's plan",
        questions: (p, today) => {
          const isT = today && today.isTraining;
          const plan = today && today.plan;
          return isT ? [
            `Should I push hard today or hold something back?`,
            `What's the ideal pre-training meal for ${(plan&&plan.type)||"this session"}?`,
            `Is my warm-up long enough for ${plan&&plan.focus||'this session'}?`,
            `How do I know if I'm recovered enough to train heavy?`,
            `What happens if I skip today's session?`,
          ] : [
            `Rest day — active recovery or completely off?`,
            `Do I need the same calories today?`,
            `Should I do any stretching or mobility work?`,
            `How do I make today count for tomorrow's session?`,
            `I feel fine — can I train anyway?`,
          ];
        }
      },
      {
        id:'nutrition', icon:'🍽', label:'Nutrition',
        questions: (p) => [
          `I'm ${Math.round(p.protein/4)}g short on protein — how do I close the gap at dinner?`,
          `What happens if I skip the pre-training meal?`,
          `Best high-protein snack for late evenings?`,
          `Training-day vs rest-day carbs — what actually changes?`,
          `I ate off-plan at lunch — should I adjust dinner?`,
        ]
      },
      {
        id:'training', icon:'🏋', label:'Training',
        questions: (p) => {
          const injuries = p.injuryAssessments||p.injuries||[];
          return [
            `How close to failure should my working sets be?`,
            injuries.length ? `Can I still build muscle around my ${injuries[0].location||'injury'}?` : `Am I doing enough volume to build muscle?`,
            `When should I add weight vs add reps?`,
            `Progressive overload — am I doing this right?`,
            `How do I know when it's time to deload?`,
          ];
        }
      },
      {
        id:'recovery', icon:'😴', label:'Recovery',
        questions: (p) => [
          `How long before I'm fully recovered from yesterday?`,
          `My ${p.sleep||'7-8'} hours — is that enough for my training load?`,
          `I slept badly last night — train or rest?`,
          `Soreness: when is it good and when is it a problem?`,
          `What's the single best thing I can do to recover faster?`,
        ]
      },
      {
        id:'mindset', icon:'🧠', label:'Mindset',
        questions: (p) => [
          `I don't feel like training today — what should I do?`,
          `Progress feels slow — am I doing something wrong?`,
          `How do I stay consistent when life gets busy?`,
          `I had a bad week — how do I get back on track?`,
          `What's the biggest mistake people make at my stage?`,
        ]
      },
      {
        id:'numbers', icon:'📊', label:'My numbers',
        questions: (p) => [
          `Why ${p.calories} calories specifically — walk me through the logic?`,
          `Is ${p.protein}g protein actually achievable every day?`,
          `What would happen if I ate 200 kcal less than my target?`,
          `My weight hasn't moved — is that a problem?`,
          `How do I know if my TDEE estimate is right for me?`,
        ]
      },
      {
        id:'accelerators', icon:'🚀', label:'Go further',
        questions: (p, today) => {
          const isT = today && today.isTraining;
          const age = p.age||35;
          return [
            isT ? `What's the one thing that would most accelerate today's session?` : `What should I do on rest days to accelerate fat loss?`,
            `Have you considered fasting — what would it do for me specifically?`,
            `What's Zone 2 cardio and should I be doing it?`,
            `What supplements am I missing that would make a real difference?`,
            `What would a 36-hour fast do for me at ${age}?`,
          ];
        }
      },
    ];

    let _overlayInFlight = false;

    function buildOverlayCats(profile, todayCtx) {
      const catsEl = document.getElementById('blo-cats');
      if (!catsEl) return;
      // Bottom strip — icon + short label only
      catsEl.innerHTML = QUESTION_CATS.map((cat, i) =>
        `<button class="blo-cat-btn" data-cat="${cat.id}"
          data-msg-container="${cat.id}">
          <span class="blo-cat-icon">${cat.icon}</span>
          <span class="blo-cat-label">${cat.label}</span>
        </button>`
      ).join('');
      // Wire up clicks
      catsEl.querySelectorAll('.blo-cat-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const catId = btn.dataset.cat;
          const isActive = btn.classList.contains('active');
          // Toggle — click active category to close panel
          document.querySelectorAll('.blo-cat-btn').forEach(b => b.classList.remove('active'));
          const qPanel = document.getElementById('blo-q-panel');
          if (isActive) { if (qPanel) qPanel.classList.remove('open'); return; }
          btn.classList.add('active');
          selectOverlayCat(catId, profile, todayCtx);
        });
      });
    }

    window.selectOverlayCat = function(catId, p, todayCtx) {
      const cat = QUESTION_CATS.find(c => c.id === catId);
      if (!cat) return;
      const profileToUse = p || profile;
      const todayToUse   = todayCtx || window._todayCtx || null;
      const questions    = cat.questions(profileToUse, todayToUse);
      const qPanel  = document.getElementById('blo-q-panel');
      const qLabel  = document.getElementById('blo-q-label');
      const qGrid   = document.getElementById('blo-q-grid');
      if (!qPanel) return;
      if (qLabel) qLabel.textContent = cat.label;
      if (qGrid) {
        qGrid.innerHTML = questions.map(q =>
          `<button class="blo-q-pill" data-msg="${q.replace(/"/g,'&quot;').replace(/'/g,'&#39;')}">${q}</button>`
        ).join('');
        qGrid.querySelectorAll('.blo-q-pill').forEach(pill => {
          pill.addEventListener('click', () => {
            qPanel.classList.remove('open');
            document.querySelectorAll('.blo-cat-btn').forEach(b => b.classList.remove('active'));
            bloSend(pill.dataset.msg);
          });
        });
      }
      qPanel.classList.add('open');
      // Scroll messages to bottom
      const msgs = document.getElementById('blo-messages');
      if (msgs) msgs.scrollTop = msgs.scrollHeight;
    };

    window._blCoach = {
      send: (t) => send_msg(t),
      toggleMic: () => toggleMic(),
      open: () => { panel.classList.add('open'); btn.classList.add('open'); btn.innerHTML = '✕'; },
      close: () => { panel.classList.remove('open'); btn.classList.remove('open'); btn.innerHTML = '💬'; localStorage.setItem('bl_coach_open','0'); },
      expand: () => {
        const overlay = document.getElementById('bl-coach-overlay');
        if (!overlay) return;
        overlay.classList.add('open');
        buildOverlayCats(profile, window._todayCtx || null);
        const titleEl = document.getElementById('blo-title');
        if (titleEl) titleEl.textContent = 'Coach · ' + getPageLabel();
        // Wire up overlay input
        const bloInput = document.getElementById('blo-input');
        const bloSendBtn = document.getElementById('blo-send');
        if (bloSendBtn && !bloSendBtn._wired) {
          bloSendBtn._wired = true;
          bloSendBtn.addEventListener('click', () => bloSend());
        }
        if (bloInput && !bloInput._wired) {
          bloInput._wired = true;
          bloInput.addEventListener('keydown', e => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); bloSend(); }
          });
          bloInput.addEventListener('input', () => {
            bloInput.style.height = 'auto';
            bloInput.style.height = Math.min(bloInput.scrollHeight, 120) + 'px';
          });
        }
        // Wire overlay mic — reuses same speech recognition engine, targets blo-input
        const bloMicBtn = document.getElementById('blo-mic');
        if (bloMicBtn && !bloMicBtn._wired && _recognition) {
          bloMicBtn._wired = true;
          bloMicBtn.addEventListener('click', () => {
            if (_micListening) {
              stopMic();
            } else {
              startMic(bloInput);
            }
          });
        }
        // Sync existing conversation from panel history
        const msgs = document.getElementById('blo-messages');
        if (msgs && msgs.children.length <= 1) {
          // Load history into overlay messages
          const hist = loadHistory();
          hist.slice(-10).forEach(m => {
            bloAddMessage(m.role === 'user' ? 'user' : 'coach', m.content);
          });
        }
        if (msgs) msgs.scrollTop = msgs.scrollHeight;
      },
      collapse: () => {
        const overlay = document.getElementById('bl-coach-overlay');
        if (overlay) overlay.classList.remove('open');
      },
      clear: () => {
        clearHistory();
        const c = document.getElementById('bl-coach-messages');
        if (c) c.innerHTML = `<div class="coach-empty"><div class="coach-empty-icon">⚡</div><div class="coach-empty-title">Ask me anything</div><div class="coach-empty-sub">I know your programme, your goals, and what you're reading right now.</div></div>`;
        if (profile) renderInitialChips(profile);
        setStatus('Ready');
      },
      saveInfo: (newInfo, el) => {
        const ok = saveNewInfo(newInfo, profile);
        if (el) el.innerHTML = `<div class="cup-saved">✓ Saved to your profile</div>`;
        setTimeout(() => { if (el) el.remove(); }, 2000);
      },
    };

    // ── Overlay send + messages ──────────────────────────
    async function bloSend(textArg) {
      if (!profile) return;
      const bloInput = document.getElementById('blo-input');
      const msg = textArg || (bloInput ? bloInput.value.trim() : '');
      if (!msg || _overlayInFlight) return;
      if (bloInput && !textArg) { bloInput.value = ''; bloInput.style.height = 'auto'; }
      _overlayInFlight = true;
      bloAddMessage('user', msg);
      // Typing indicator
      const msgs = document.getElementById('blo-messages');
      const typing = document.createElement('div');
      typing.id = 'blo-typing'; typing.className = 'blo-typing';
      typing.innerHTML = '<span></span><span></span><span></span>';
      if (msgs) { msgs.appendChild(typing); msgs.scrollTop = msgs.scrollHeight; }
      try {
        const reply = await askCoach(msg, profile);
        if (typing.parentNode) typing.remove();
        bloAddMessage('coach', reply);
        // Also add to floating panel history
        addMessage('coach', reply);
        // Check for new info
        const newInfo = extractNewInfo(reply);
        if (newInfo) bloPromptUpdate(newInfo);
        // Generate follow-up questions (synchronous)
        const fups = generateFollowUps(msg, reply, profile);
        if (fups && fups.length) {
          // Show as follow-up pills above the input
          const qPanel = document.getElementById('blo-q-panel');
          const qLabel = document.getElementById('blo-q-label');
          const qGrid  = document.getElementById('blo-q-grid');
          if (qLabel) qLabel.textContent = 'Follow-up';
          if (qGrid) {
            qGrid.innerHTML = fups.map(q =>
              `<button class="blo-q-pill" data-msg="${q.replace(/"/g,'&quot;').replace(/'/g,'&#39;')}">${q}</button>`
            ).join('');
            qGrid.querySelectorAll('.blo-q-pill').forEach(pill => {
              pill.addEventListener('click', () => {
                if (qPanel) qPanel.classList.remove('open');
                bloSend(pill.dataset.msg);
              });
            });
            if (qPanel) qPanel.classList.add('open');
          }
        }
      } catch(e) {
        if (typing.parentNode) typing.remove();
        bloAddMessage('coach', 'Something went wrong — try again.');
      }
      _overlayInFlight = false;
    }

    function bloAddMessage(role, text) {
      const msgs = document.getElementById('blo-messages');
      if (!msgs) return;
      const msg = document.createElement('div');
      msg.className = 'blo-msg ' + role;
      const bubble = document.createElement('div');
      bubble.className = 'blo-msg-bubble';
      bubble.innerHTML = role === 'coach' ? formatResponse(text) : `<p>${text}</p>`;
      msg.appendChild(bubble);
      msgs.appendChild(msg);
      msgs.scrollTop = msgs.scrollHeight;
    }

    function bloPromptUpdate(newInfo) {
      const msgs = document.getElementById('blo-messages');
      if (!msgs) return;
      const el = document.createElement('div');
      el.className = 'blo-update-prompt';
      el.innerHTML = `<div class="bup-text">Add <em>${newInfo}</em> to your profile?</div>
        <div style="display:flex;gap:6px;">
          <button class="bup-yes" onclick="window._blCoach.saveInfo(${JSON.stringify(newInfo)}, this.closest('.blo-update-prompt'))">Save it</button>
          <button class="bup-no" onclick="this.closest('.blo-update-prompt').remove()">Skip</button>
        </div>`;
      msgs.appendChild(el);
      msgs.scrollTop = msgs.scrollHeight;
    }


  }

  function renderInitialChips(profile) {
    const chips = getInitialChips(profile, getPageType());
    const el = document.getElementById('bl-coach-chips');
    if (!el) return;
    el.style.display = 'flex';
    el.innerHTML = chips.map(c =>
      `<div class="coach-chip" data-msg="${c.replace(/"/g,'&quot;').replace(/'/g,'&#39;')}">${c}</div>`
    ).join('');
    el.querySelectorAll('.coach-chip').forEach(chip => {
      chip.addEventListener('click', () => window._blCoach.send(chip.dataset.msg));
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

})();

// ════════════════════════════════════════════════════════
//  coach.js — BodyLens floating AI coach  v3
//  Fixes: async bug on chips, prose format, follow-up
//  probing, new info detection + profile update
// ════════════════════════════════════════════════════════

(function () {

  const API   = '/api/chat';
  const MODEL = 'claude-sonnet-4-20250514';
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
  function buildSystemPrompt(profile, pageContext) {
    const isFemale = (profile.sex || '').toLowerCase() === 'female';
    const injuries = profile.injuryAssessments || profile.injuries || [];
    const supps    = profile.supplements || [];
    const weekPlan = profile.weekPlan || [];
    const trainDays = weekPlan.filter(d => d.priority === 'training').map(d => d.day).join(', ');

    return `You are the BodyLens coach — a senior performance coach and applied sport scientist. You are speaking directly with ${profile.name}.

CLIENT PROFILE:
Name: ${profile.name} | Age: ${profile.age} | Sex: ${profile.sex}
Weight: ${profile.weight}kg | Height: ${profile.height}cm${profile.bodyFat ? ' | Body fat: ' + profile.bodyFat + '%' : ''}
Goal: ${profile.goal}${profile.target ? ' — ' + profile.target : ''}
Experience: ${profile.experience || '—'} | Training: ${profile.trainingDays} days/week (${trainDays})
Wake: ${profile.wakeTime || '07:00'} | Bedtime: ${profile.bedtime || '—'} | Sleep: ${profile.sleep || '—'} | Quality: ${profile.sleepQuality || '—'}
Training time: ${profile.trainingTime || '—'}
Calories: ${profile.calories} kcal | Protein: ${profile.protein}g | Carbs: ${profile.carbs}g | Fat: ${profile.fat}g
Eating window: ${profile.actualEatingWindow || profile.fastingWindow || profile.eatingWindow || 'flexible'}
Stress: ${profile.stressLevel || '—'} | Caffeine: ${profile.caffeineHabits || '—'} | Diet history: ${profile.dietHistory || '—'}
Diet: ${profile.dietType || 'no restrictions'} | Exclude: ${(profile.foodExclusions || []).join(', ') || 'none'}
Trigger foods: ${profile.triggerFoods || 'none'}
Alcohol: ${profile.alcoholHabit || '—'}
Recovery tools: ${(profile.recoveryTools || []).join(', ') || 'none'}
Supplements: ${supps.map(s => s.name + ' ' + s.dose + ' (' + (s.timing || '') + ')').join(', ') || 'none'}
Health conditions: ${profile.healthConditions || 'none'}
${injuries.length ? 'INJURIES: ' + injuries.map(i => (i.location || i) + ': ' + (i.assessment || i.detail || '')).join('; ') : 'No injuries'}
${profile.activityLevel ? 'Activity outside training: ' + profile.activityLevel : ''}
${profile.cookingApproach ? 'Food approach: ' + profile.cookingApproach + (profile.cuisinePrefs && profile.cuisinePrefs.length ? ' | ' + profile.cuisinePrefs.join(', ') : '') : ''}
${isFemale && profile.menstrualCycle ? 'Cycle: ' + profile.menstrualCycle : ''}

CURRENT PAGE: ${pageContext}

YOUR VOICE:
You speak like a senior coach with a science background having a real consultation — not a chatbot, not a generic fitness app. You are warm, direct, and specific. You reference ${profile.name}'s actual numbers, their actual training days, their injuries, their food preferences. You don't hedge unless there is genuine scientific uncertainty, and when you do hedge you say why.

RESPONSE FORMAT — this is critical:
Write in flowing prose, the way a coach actually talks. No bullet points. No bold text. No headers. No markdown formatting of any kind. Just clear, well-constructed sentences in paragraphs. A short answer is one or two sentences. A longer answer is two or three paragraphs. Never more than that unless they explicitly ask for a comprehensive explanation.

The science lives in the explanation — you weave it into the answer naturally, not as bullet points. If the answer has a mechanism behind it, explain the mechanism in plain language as part of the flow.

Always make the answer personal. Reference their specific situation — their ${profile.trainingDays} training days, their ${profile.protein}g protein target, their injuries if relevant. Generic advice is not coaching.

${isFemale ? 'Frame all advice through female physiology where relevant — hormonal cycle, oestrogen effects, female-specific training and nutrition.' : 'Frame advice through male physiology where relevant — testosterone, GH, male-specific recovery and nutrition.'}

PERFORMANCE ACCELERATORS — know these and use them proactively:
You have access to a library of 24 evidence-backed performance accelerators. When the conversation naturally leads there — or when someone asks how to speed up results, what else they can do, or expresses high motivation — suggest a specific accelerator with its mechanism explained in your voice. Never list multiple at once. Pick the single most relevant one and explain it properly.

Nutrition: Extended overnight fast (16:8), Protein-sparing modified fast (one day 600 kcal protein-only per week), Carb back-loading (hold carbs until post-training), Diet break week (one week maintenance every 6-8 weeks), Fasted morning training, Monthly 36-hour fast.

Training: Zone 2 cardio blocks (60-70% max HR, 3-4 hrs/week), Weekly VO₂max intervals (4×4 min at 90-95%), Post-meal walks (10 min after each meal, lowers glucose 20-30%), NEAT maximisation (+2-3k steps daily), Loaded stretching (2 min under load, post-set), Blood flow restriction (20-30% 1RM with cuff).

Recovery: Sauna protocol (80-100°C, 20 min, 4×/week — Laukkanen data), Cold-hot contrast cycling (sauna 15 min → cold 3 min × 3 cycles), NSDR/Yoga Nidra (20 min, dopamine rises 65%), Sleep extension block (30-60 min extra for 2 weeks), Creatine loading phase (20g/day × 5 days then 5g maintenance), Morning light + cold shower finish.

Psychology: Implementation intentions ("When X, I will Y"), Dopamine scheduling (no low-effort dopamine before training), Two-minute rule (commit only to starting), Training log practice (write every set), Weekly body composition check (tape + scale Monday AM), Deliberate discomfort practice.

When suggesting an accelerator: name it, explain the mechanism in 2-3 sentences in your coaching voice, give the specific protocol in brief, and say why it fits this person's specific situation right now. Always end with "You can read the full breakdown on the Accelerators page." Never suggest anything medically inappropriate given their profile.

Safety: Never suggest extended fasting to someone with disordered eating history, very low current calories, or health conditions that contraindicate it. Never suggest BFR to someone with cardiovascular issues. Use the injuries and health conditions in the profile to filter.

NEW INFORMATION DETECTION — important:
If the user mentions something that would update their profile — a new injury, a change in sleep, a new supplement they have started, a goal shift, a change in training schedule — acknowledge it specifically and end your response with exactly this on its own line: [NEW_INFO: brief description of the update]

Examples:
- "I've started taking ashwagandha" → [NEW_INFO: started taking ashwagandha]
- "My knee has been hurting again" → [NEW_INFO: knee pain recurring]
- "I'm now sleeping 6 hours instead of 8" → [NEW_INFO: sleep reduced to 6 hours]
- "I'm thinking of changing my goal to fat loss" → [NEW_INFO: considering goal change to fat loss]

Only add this tag if there is genuinely new information that would change the profile. Do not add it for questions or general discussion.`;
  }

  // ── FOLLOW-UP PROMPT ──────────────────────────────────
  function buildFollowUpPrompt(lastUserMsg, lastCoachReply, profile) {
    return `Based on this exchange, generate 2-3 short follow-up questions that ${profile.name} might naturally want to ask next. Make them specific to what was just discussed and to their profile.

Their question: "${lastUserMsg}"
Your answer: "${lastCoachReply.slice(0, 300)}..."

Return ONLY a JSON array of 2-3 short strings. Each under 8 words. No punctuation at end. No explanation.
Example: ["How long until I see results", "Does timing matter for this", "What if I miss a session"]`;
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
      } else {
        p.coachNotes = (p.coachNotes || '') + '\n• ' + newInfo;
      }

      p.lastUpdated = new Date().toISOString();
      localStorage.setItem('bl_profile', JSON.stringify(p));
      return true;
    } catch(e) {
      console.error('Profile save error:', e);
      return false;
    }
  }

  // ── API CALL ──────────────────────────────────────────
  async function askCoach(userMessage, profile) {
    const history = loadHistory();
    const systemPrompt = buildSystemPrompt(profile, PAGE_CONTEXTS[getPageType()] || PAGE_CONTEXTS.default);
    history.push({ role: 'user', content: userMessage });

    const res = await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 450,
        system: systemPrompt,
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

  // Generate follow-up chips after a reply
  async function generateFollowUps(lastUser, lastCoach, profile) {
    try {
      const res = await fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: 120,
          system: 'You generate follow-up questions. Return only a JSON array. No explanation.',
          messages: [{ role: 'user', content: buildFollowUpPrompt(lastUser, lastCoach, profile) }],
        }),
      });
      if (!res.ok) return null;
      const data = await res.json();
      const text = (data.content || []).map(b => b.text || '').join('').trim();
      const match = text.match(/\[[\s\S]*\]/);
      if (!match) return null;
      return JSON.parse(match[0]).slice(0, 3);
    } catch(e) {
      return null;
    }
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
    #bl-coach-input::placeholder { color: #2a4038; }
    #bl-coach-send {
      width: 34px; height: 34px; border-radius: 8px; background: #00c8a0;
      border: none; cursor: pointer; display: flex; align-items: center; justify-content: center;
      flex-shrink: 0; align-self: flex-end; transition: opacity 0.12s;
      color: #0c1010; font-size: 16px; font-weight: 700;
    }
    #bl-coach-send:hover { opacity: 0.85; }
    #bl-coach-send:disabled { opacity: 0.25; cursor: not-allowed; }

    @media(max-width:480px) {
      #bl-coach-panel { right:10px; bottom:82px; width:calc(100vw - 20px); }
      #bl-coach-btn { right:14px; bottom:18px; }
    }

    /* ── FULL SCREEN OVERLAY ── */
    #bl-coach-overlay {
      display:none; position:fixed; inset:0; background:rgba(8,13,13,0.96);
      backdrop-filter:blur(16px); z-index:10000;
      flex-direction:column; animation:overlayIn 0.22s ease;
    }
    #bl-coach-overlay.open { display:flex; }
    @keyframes overlayIn { from{opacity:0;transform:scale(0.97)} to{opacity:1;transform:scale(1)} }

    #blo-header {
      padding:18px 28px 14px; border-bottom:1px solid #1a2820;
      display:flex; align-items:center; justify-content:space-between;
      background:#0d1512; flex-shrink:0;
    }
    .blo-brand { font-size:13px; font-weight:300; color:#e8e3da; }
    .blo-brand em { font-style:italic; color:#3e6050; }
    .blo-title { font-size:11px; font-weight:600; letter-spacing:0.08em; text-transform:uppercase; color:#00c8a0; }
    .blo-close { background:none; border:1px solid #1e2e28; color:#8a9490; width:32px; height:32px; border-radius:6px; cursor:pointer; font-size:16px; display:flex; align-items:center; justify-content:center; transition:all 0.12s; font-family:inherit; }
    .blo-close:hover { border-color:#3e6050; color:#e8e3da; }

    #blo-body { flex:1; display:grid; grid-template-columns:280px 1fr; overflow:hidden; }

    /* Category sidebar */
    #blo-cats { border-right:1px solid #1a2820; overflow-y:auto; padding:16px 0; }
    .blo-cat-btn {
      display:flex; align-items:center; gap:10px; width:100%;
      padding:11px 20px; background:transparent; border:none;
      text-align:left; cursor:pointer; transition:background 0.1s;
      font-family:inherit;
    }
    .blo-cat-btn:hover { background:#0d1512; }
    .blo-cat-btn.active { background:rgba(0,200,160,0.06); border-right:2px solid #00c8a0; }
    .blo-cat-icon { font-size:16px; flex-shrink:0; }
    .blo-cat-label { font-size:12px; font-weight:500; color:#8a9490; }
    .blo-cat-btn.active .blo-cat-label { color:#e8e3da; }
    .blo-cat-count { margin-left:auto; font-size:9px; font-family:'Courier New',monospace; color:#3e504a; }

    /* Questions pane */
    #blo-questions { overflow-y:auto; padding:20px 24px; }
    .blo-q-header { font-size:9px; font-weight:600; letter-spacing:0.16em; text-transform:uppercase; color:#3e504a; margin-bottom:14px; }
    .blo-q-list { display:flex; flex-direction:column; gap:8px; }
    .blo-q-item {
      background:#111917; border:1px solid #1e2e28; border-radius:6px;
      padding:13px 16px; cursor:pointer; transition:all 0.12s;
      font-size:13px; font-weight:300; color:#8a9490; line-height:1.5;
      text-align:left; font-family:inherit;
    }
    .blo-q-item:hover { border-color:rgba(0,200,160,0.3); color:#e8e3da; background:#141f1a; }

    /* Chat pane */
    #blo-chat { border-left:1px solid #1a2820; display:flex; flex-direction:column; }
    #blo-messages { flex:1; overflow-y:auto; padding:16px 20px; display:flex; flex-direction:column; gap:12px; }
    #blo-input-wrap { padding:12px 16px; border-top:1px solid #1a2820; display:flex; gap:8px; background:#0d1512; flex-shrink:0; }
    #blo-input { flex:1; background:#1a2820; border:1px solid #1e2e28; border-radius:8px; padding:10px 13px; font-size:13px; font-family:'Space Grotesk',sans-serif; color:#e8e3da; outline:none; }
    #blo-input:focus { border-color:rgba(0,200,160,0.35); }
    #blo-input::placeholder { color:#2a4038; }
    #blo-send { width:34px; height:34px; border-radius:8px; background:#00c8a0; border:none; cursor:pointer; color:#0c1010; font-size:16px; font-weight:700; flex-shrink:0; }

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
          <button id="bl-coach-send">↑</button>
        </div>
      </div>

      <div id="bl-coach-overlay">
        <div id="blo-header">
          <div class="blo-brand">Body<em>Lens</em></div>
          <div class="blo-title" id="blo-title">Ask your coach</div>
          <button class="blo-close" onclick="window._blCoach.collapse()">✕</button>
        </div>
        <div id="blo-body">
          <div id="blo-cats"></div>
          <div id="blo-questions">
            <div class="blo-q-header" id="blo-q-header">Select a category</div>
            <div class="blo-q-list" id="blo-q-list"></div>
          </div>
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
    container.style.display = 'flex';
    container.innerHTML = chips.map(c =>
      `<div class="coach-chip followup" data-msg="${c.replace(/"/g,'&quot;').replace(/'/g,'&#39;')}">${c}</div>`
    ).join('');
    container.querySelectorAll('.coach-chip').forEach(chip => {
      chip.addEventListener('click', () => window._blCoach.send(chip.dataset.msg));
    });
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

        // Generate follow-up chips asynchronously
        generateFollowUps(msg, reply, profile).then(followUps => {
          if (followUps && followUps.length) showFollowUpChips(followUps);
        });

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

    // ── CATEGORISED QUESTIONS ─────────────────────────
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

    function buildOverlayCats(profile, todayCtx) {
      const catsEl = document.getElementById('blo-cats');
      if (!catsEl) return;
      catsEl.innerHTML = QUESTION_CATS.map((cat, i) =>
        `<button class="blo-cat-btn ${i===0?'active':''}" data-cat="${cat.id}" onclick="selectOverlayCat('${cat.id}', this, ${JSON.stringify(cat.label)})">
          <span class="blo-cat-icon">${cat.icon}</span>
          <span class="blo-cat-label">${cat.label}</span>
          <span class="blo-cat-count">5</span>
        </button>`
      ).join('');
      // Show first category by default
      selectOverlayCat(QUESTION_CATS[0].id, catsEl.querySelector('.blo-cat-btn'), QUESTION_CATS[0].label, profile, todayCtx);
    }

    window.selectOverlayCat = function(catId, btn, label, p, todayCtx) {
      document.querySelectorAll('.blo-cat-btn').forEach(b => b.classList.remove('active'));
      if (btn) btn.classList.add('active');

      const cat = QUESTION_CATS.find(c => c.id === catId);
      if (!cat) return;

      const profileToUse = p || profile;
      const todayToUse   = todayCtx || window._todayCtx || null;
      const questions    = cat.questions(profileToUse, todayToUse);

      document.getElementById('blo-q-header').textContent = cat.label + ' — tap to ask';
      document.getElementById('blo-q-list').innerHTML = questions.map(q =>
        `<button class="blo-q-item" data-msg="${q.replace(/"/g,'&quot;').replace(/'/g,'&#39;')}">${q}</button>`
      ).join('');
      document.querySelectorAll('.blo-q-item').forEach(item => {
        item.addEventListener('click', () => {
          window._blCoach.collapse();
          window._blCoach.send(item.dataset.msg);
        });
      });
    };

    window._blCoach = {
      send: (t) => send_msg(t),
      open: () => { panel.classList.add('open'); btn.classList.add('open'); btn.innerHTML = '✕'; },
      close: () => { panel.classList.remove('open'); btn.classList.remove('open'); btn.innerHTML = '💬'; localStorage.setItem('bl_coach_open','0'); },
      expand: () => {
        const overlay = document.getElementById('bl-coach-overlay');
        if (!overlay) return;
        overlay.classList.add('open');
        buildOverlayCats(profile, window._todayCtx || null);
        const pageType = getPageType();
        const pageLabel = getPageLabel();
        const titleEl = document.getElementById('blo-title');
        if (titleEl) titleEl.textContent = 'Coach · ' + pageLabel;
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

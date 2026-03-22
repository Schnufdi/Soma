// ════════════════════════════════════════════════════════
//  coach.js — BodyLens floating AI coach
//  Persistent across all pages. Context-aware per page.
// ════════════════════════════════════════════════════════

(function() {

  const API   = '/api/chat';
  const MODEL = 'claude-sonnet-4-20250514';
  const HISTORY_KEY = 'bl_coach_history';
  const MAX_HISTORY = 14;

  // ── PAGE CONTEXT MAP ──────────────────────────────────
  const PAGE_CONTEXTS = {
    'day':          'The user is looking at their daily plan — today\'s schedule, training session, meals, supplement timing, and recovery blocks. They may ask about adjusting today, what to prioritise, or how to handle curveballs.',
    'food':         'The user is on the Food hub — meal ideas, shopping list, weekly plan, macro targets. They may ask about specific foods, swaps, hitting protein, or what to eat around training.',
    'fuel':         'The user is on the Food hub — meal timing, synergies, shopping, what to eat and when. They may ask about pre/post-training meals, nutrient timing, or specific foods.',
    'training':     'The user is reading training science — frequency, volume, splits, periodisation, proximity to failure. They may ask how the research applies to their programme specifically.',
    'alcohol':      'The user is reading about alcohol\'s effects on muscle building, sleep, hormones, and recovery. They may ask about their specific habits — which nights are safest, whether a specific occasion will cost them, or damage mitigation.',
    'weightloss':   'The user is reading fat loss science — CICO, TDEE, hormones, why diets fail. They may ask about their numbers, why progress has stalled, or what to do differently.',
    'hunger':       'The user is reading hunger management science — ghrelin, leptin, food noise, emotional eating. They may ask about specific cravings, hunger between meals, or why they overeat in the evening.',
    'optimal':      'The user is reading about whole-body systems — gut health, energy, brain function, anxiety, mood, hormones. They may ask about symptoms, optimisation, or specific supplements.',
    'synthesis':    'The user is reading the systems synthesis — how every body system connects. They may ask how their specific biology fits the framework.',
    'story':        'The user is reading a narrative of how their programme works across a full training day. They may ask about timing decisions or the reasoning behind the structure.',
    'mentalhealth': 'The user is reading about mental health — cortisol, gut-brain axis, sleep-mood connection, training as medicine, and goal psychology. They may ask about stress, motivation, or the psychological dimension of their goal.',
    'longevity':    'The user is reading longevity science — decade-by-decade biological shifts, biomarkers, what to prioritise. They may ask about their specific decade or which interventions matter most now.',
    'attia':        'The user is reading about Attia and Huberman protocols — Zone 2, VO₂max, biomarkers, NSDR, cold and heat. They may ask about implementing specific protocols or how they apply to them.',
    'programme':    'The user is viewing their programme — week plan, macros, supplements, injuries. They may ask about any element or how it was built.',
    'instructions': 'The user is reading their coaching report — their full personalised assessment. They may want to discuss or challenge specific recommendations.',
    'science':      'The user is on the Science hub browsing topics. They may ask about any area of health, training, or nutrition.',
    'body':         'The user is exploring the muscle guide. They may ask about specific muscles, exercises, or how to train around weaknesses.',
    'howitworks':   'The user is reading about how BodyLens built their programme — the calculations and logic behind it. They may ask about specific numbers or methodology.',
    'default':      'The user is using BodyLens. They may ask about any aspect of their programme, nutrition, training, or health.',
  };

  // ── SYSTEM PROMPT ─────────────────────────────────────
  function buildSystemPrompt(profile, pageContext) {
    const isFemale = (profile.sex || '').toLowerCase() === 'female';
    const injuries = profile.injuryAssessments || profile.injuries || [];
    const supps    = profile.supplements || [];
    const weekPlan = profile.weekPlan || [];
    const trainDays = weekPlan.filter(d => d.priority === 'training').map(d => d.day).join(', ');

    return `You are the BodyLens coach — a senior performance coach embedded in a personalised fitness and nutrition platform. You are speaking directly with ${profile.name}.

CLIENT PROFILE:
Name: ${profile.name} | Age: ${profile.age} | Sex: ${profile.sex}
Weight: ${profile.weight}kg | Height: ${profile.height}cm${profile.bodyFat ? ' | Body fat: ' + profile.bodyFat + '%' : ''}
Goal: ${profile.goal}${profile.target ? ' — ' + profile.target : ''}
Experience: ${profile.experience || '—'} | Training: ${profile.trainingDays} days/week (${trainDays})
Wake: ${profile.wakeTime || '07:00'} | Bedtime: ${profile.bedtime || 'not set'} | Sleep: ${profile.sleep || '—'} | Quality: ${profile.sleepQuality || '—'}
Training time: ${profile.trainingTime || '—'}
Calories: ${profile.calories} kcal | Protein: ${profile.protein}g | Carbs: ${profile.carbs}g | Fat: ${profile.fat}g
Eating window: ${profile.actualEatingWindow || profile.fastingWindow || profile.eatingWindow || 'flexible'}
Stress: ${profile.stressLevel || '—'} | Caffeine: ${profile.caffeineHabits || '—'}
Diet: ${profile.dietType || 'no restrictions'} | Exclude: ${(profile.foodExclusions || []).join(', ') || 'none'}
Trigger foods: ${profile.triggerFoods || 'none'}
Alcohol: ${profile.alcoholHabit || '—'}
Recovery tools: ${(profile.recoveryTools || []).join(', ') || 'none'}
Supplements: ${supps.map(s => s.name + ' ' + s.dose + ' (' + s.timing + ')').join(', ') || 'none'}
Diet history: ${profile.dietHistory || '—'}
Health conditions: ${profile.healthConditions || 'none reported'}
${injuries.length ? 'INJURIES: ' + injuries.map(i => (i.location || i) + ': ' + (i.assessment || i.detail || '')).join('; ') : 'No current injuries'}
${profile.activityLevel ? 'Activity outside training: ' + profile.activityLevel : ''}
${profile.cookingApproach ? 'Food: ' + profile.cookingApproach + (profile.cuisinePrefs && profile.cuisinePrefs.length ? ' | ' + profile.cuisinePrefs.join(', ') : '') + (profile.recipeComplexity ? ' | ' + profile.recipeComplexity : '') : ''}
${isFemale && profile.menstrualCycle ? 'Cycle: ' + profile.menstrualCycle : ''}

CURRENT PAGE: ${pageContext}

YOUR COACHING VOICE AND FORMAT RULES:
- Direct, warm, senior coach in a real consultation — not a chatbot, not a wellness app.
- Use ${profile.name}'s name occasionally. Reference their actual numbers, training days, injuries.
- Never start with "Great question!" or hollow affirmations.

RESPONSE FORMAT — ALWAYS follow this:
- For short factual answers (e.g. "how much protein after training?"): 2-3 sentences, no bullets needed.
- For explanations or multi-part answers: use this structure:
  • Lead with the direct answer in **bold** on the first line.
  • Then bullet points for supporting detail — each bullet substantive, not padding.
  • End with a bold **Bottom line:** sentence if the point needs driving home.
- For protocols or step-by-step: numbered list, each step actionable.
- Use **bold** for the single most important word or phrase per section.
- Never use more than 5 bullets. Never pad with filler sentences.
- Keep total response under 200 words unless genuinely complex.
- ${isFemale ? 'Frame all advice through female physiology where relevant — hormonal cycle, oestrogen effects, female-specific considerations.' : 'Frame advice through male physiology where relevant — testosterone, GH, male-specific recovery and nutrition.'}
- If they ask something medical, give the science clearly but flag GP consultation for clinical decisions.`;
  }

  // ── PAGE DETECTION ────────────────────────────────────
  function getPageType() {
    const meta = document.querySelector('meta[name="bl-page"]');
    return meta ? meta.getAttribute('content') : 'default';
  }

  function getPageLabel() {
    const labels = {
      'day':'Today','food':'Food','fuel':'Food','training':'Training',
      'alcohol':'Alcohol','weightloss':'Weight Loss','hunger':'Hunger & Balance',
      'optimal':'The Machine','synthesis':'How It Runs','story':'The Story',
      'mentalhealth':'Mental Health','longevity':'Longevity','attia':'Protocols',
      'programme':'Programme','instructions':'Coaching Report','science':'Science',
      'body':'Muscle Guide','howitworks':'How It Works',
    };
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

  // ── API ───────────────────────────────────────────────
  async function askCoach(userMessage, profile) {
    const history = loadHistory();
    const systemPrompt = buildSystemPrompt(profile, PAGE_CONTEXTS[getPageType()] || PAGE_CONTEXTS.default);
    history.push({ role: 'user', content: userMessage });
    const res = await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 500,
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

  // ── CHIPS — clever, motivational, context-aware ───────
  function getChips(profile, pageType) {
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
        `How hard should I push on ${todayPlan.type || 'today\'s session'}?`,
        injuries.length ? `My ${injuries[0].location || 'injury'} is niggly today` : `What should I eat before training?`,
        `Am I recovered enough to train hard?`,
      ] : [
        `Rest day — should I do anything or literally nothing?`,
        `How do I make the most of a rest day?`,
        `Is it okay to eat the same calories on rest days?`,
        `Can I train if I feel fine?`,
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
        hasTrigger ? `I'm craving ${trigger} — what do I do?` : `I'm always hungry at 4pm. Normal?`,
        `Why am I hungrier on rest days than training days?`,
        `What kills cravings fastest?`,
        isFemale ? `My hunger went crazy this week — hormones?` : `I ate my target and still feel empty`,
      ],
      'optimal': [
        `My energy crashes at 3pm every day — what's causing it?`,
        `How do I get sharper focus in the mornings?`,
        `I've been anxious lately — what can I actually do?`,
        isFemale ? `My mood is all over the place this week` : `How do I boost testosterone naturally at ${age}?`,
      ],
      'training': [
        `Am I leaving gains on the table with my current split?`,
        `How close to failure should I actually train?`,
        injuries.length ? `Can I still build muscle training around my ${injuries[0].location || 'injury'}?` : `Is my volume too high, too low, or right?`,
        `When should I deload?`,
      ],
      'mentalhealth': [
        `I've been stressed lately — is it affecting my progress?`,
        `How do I stay motivated when results are slow?`,
        isFemale ? `My relationship with food isn't great right now` : `I keep skipping sessions. What's actually going on?`,
        `Does training actually help with anxiety?`,
      ],
      'fuel': [
        `What's the best thing to eat before my session?`,
        `Post-training — how fast does the window really close?`,
        `I'm always under on protein by dinner — fix?`,
        `What should I eat on rest days vs training days?`,
      ],
      'food': [
        `What should I eat today to hit my targets?`,
        `Give me a quick high-protein dinner that's actually good`,
        `Am I eating at the right times?`,
        `Can I eat X and still hit my goals?`,
      ],
      'longevity': [
        `What's the single most important thing I can do right now at ${age}?`,
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
      isFemale ? `How does my cycle affect this week's training?` : `What's my highest-leverage habit to add?`,
      `Coach me on where I'm leaving the most on the table`,
    ];
  }

  // ── RENDER HELPERS ────────────────────────────────────
  function formatResponse(text) {
    return text
      // Bold
      .replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
      // Italic
      .replace(/\*([^*\n]+)\*/g, '<em>$1</em>')
      // Bullet lines starting with • or -
      .replace(/^[•\-] (.+)$/gm, '<li>$1</li>')
      // Wrap consecutive <li> in <ul>
      .replace(/((?:<li>.*<\/li>\n?)+)/g, '<ul>$1</ul>')
      // Numbered list lines
      .replace(/^(\d+)\. (.+)$/gm, '<li class="num"><span>$1</span>$2</li>')
      .replace(/((?:<li class="num">.*<\/li>\n?)+)/g, '<ol>$1</ol>')
      // Paragraphs
      .split(/\n\n+/)
      .map(p => p.trim())
      .filter(p => p && !p.startsWith('<ul') && !p.startsWith('<ol'))
      .reduce((acc, p) => {
        if (p.startsWith('<li') || p.startsWith('<ul') || p.startsWith('<ol')) return acc + p;
        return acc + `<p>${p}</p>`;
      }, '')
      // Clean double-wrapped tags
      .replace(/<p>(<[uo]l>)/g, '$1')
      .replace(/(<\/[uo]l>)<\/p>/g, '$1')
      || `<p>${text}</p>`;
  }

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
    t.id = 'coach-typing';
    t.className = 'coach-typing';
    t.innerHTML = '<span></span><span></span><span></span>';
    c.appendChild(t);
    c.scrollTop = c.scrollHeight;
  }
  function hideTyping() {
    const el = document.getElementById('coach-typing');
    if (el) el.remove();
  }
  function setStatus(text, thinking) {
    const el = document.getElementById('coach-status');
    if (el) { el.textContent = text; el.className = 'coach-status' + (thinking ? ' thinking' : ''); }
  }

  // ── BUILD UI ──────────────────────────────────────────
  function buildUI() {
    const css = `
    #bl-coach-btn {
      position: fixed;
      bottom: 28px;
      right: 28px;
      width: 52px;
      height: 52px;
      border-radius: 50%;
      background: var(--jade, #00c8a0);
      border: none;
      cursor: pointer;
      z-index: 9999;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 20px rgba(0,200,160,0.4);
      transition: transform 0.18s, box-shadow 0.18s, background 0.18s;
      font-size: 20px;
      flex-shrink: 0;
    }
    #bl-coach-btn:hover { transform: scale(1.08); box-shadow: 0 6px 28px rgba(0,200,160,0.55); }
    #bl-coach-btn.open { background: #2a3830; box-shadow: 0 4px 14px rgba(0,0,0,0.35); }

    #bl-coach-panel {
      position: fixed;
      bottom: 92px;
      right: 28px;
      width: 380px;
      max-width: calc(100vw - 40px);
      height: 530px;
      max-height: calc(100vh - 110px);
      background: #111917;
      border: 1px solid #1e2e28;
      border-radius: 14px;
      display: flex;
      flex-direction: column;
      z-index: 9998;
      box-shadow: 0 20px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(0,200,160,0.06);
      transform: translateY(16px) scale(0.96);
      opacity: 0;
      pointer-events: none;
      transition: transform 0.22s cubic-bezier(0.34,1.56,0.64,1), opacity 0.18s ease;
      overflow: hidden;
    }
    #bl-coach-panel.open {
      transform: translateY(0) scale(1);
      opacity: 1;
      pointer-events: all;
    }

    /* Header */
    #bl-coach-header {
      padding: 14px 16px 12px;
      border-bottom: 1px solid #1a2820;
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-shrink: 0;
      background: #0d1512;
    }
    .ch-left { display: flex; align-items: center; gap: 10px; }
    .ch-avatar {
      width: 30px; height: 30px; border-radius: 50%;
      background: rgba(0,200,160,0.12); border: 1px solid rgba(0,200,160,0.25);
      display: flex; align-items: center; justify-content: center;
      font-size: 13px; flex-shrink: 0;
    }
    .ch-title-wrap {}
    .ch-name { font-size: 12px; font-weight: 700; color: #e8e3da; letter-spacing: 0.02em; }
    .ch-ask { font-size: 10px; font-weight: 400; color: #00c8a0; margin-top: 1px; letter-spacing: 0.03em; }
    .coach-status { font-size: 9px; color: #3e504a; }
    .coach-status.thinking { color: #00c8a0; animation: blink 1s infinite; }
    @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.3} }
    .ch-right { display: flex; gap: 4px; }
    .ch-btn { background:none; border:none; color:#3e504a; cursor:pointer; font-size:13px; padding:4px 7px; border-radius:5px; transition:color 0.1s; }
    .ch-btn:hover { color:#8a9490; }

    /* Page pill */
    #bl-coach-page {
      padding: 5px 16px;
      font-size: 9px; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase;
      color: #2a4038;
      background: #0d1512;
      border-bottom: 1px solid #1a2820;
      flex-shrink: 0;
    }
    #bl-coach-page span { color: #3e6050; }

    /* Messages */
    #bl-coach-messages {
      flex: 1; overflow-y: auto; padding: 14px 16px;
      display: flex; flex-direction: column; gap: 12px;
      scroll-behavior: smooth;
    }
    #bl-coach-messages::-webkit-scrollbar { width: 3px; }
    #bl-coach-messages::-webkit-scrollbar-thumb { background: #1e2e28; border-radius: 2px; }

    .coach-empty {
      display:flex; flex-direction:column; align-items:center;
      justify-content:center; height:100%; text-align:center; padding:20px; gap:8px;
    }
    .coach-empty-icon { font-size:28px; opacity:0.3; }
    .coach-empty-title { font-size:16px; font-weight:300; color:#8a9490; font-family:'Cormorant Garamond',serif; }
    .coach-empty-sub { font-size:11px; color:#2a4038; line-height:1.6; max-width:220px; }

    .coach-msg { display:flex; flex-direction:column; animation: msgIn 0.16s ease; }
    @keyframes msgIn { from{opacity:0;transform:translateY(5px)} to{opacity:1;transform:translateY(0)} }

    .coach-msg-bubble {
      font-size: 13px; font-weight: 300; line-height: 1.65;
      max-width: 90%;
    }
    .coach-msg-bubble p { margin: 0 0 8px; }
    .coach-msg-bubble p:last-child { margin-bottom: 0; }
    .coach-msg-bubble ul, .coach-msg-bubble ol { margin: 6px 0; padding-left: 18px; }
    .coach-msg-bubble li { margin-bottom: 5px; color: #b0aa9e; }
    .coach-msg-bubble li.num { list-style: none; padding-left: 4px; }
    .coach-msg-bubble li.num span { color: #00c8a0; font-weight: 600; margin-right: 6px; }
    .coach-msg-bubble strong { color: #e8e3da; font-weight: 600; }
    .coach-msg-bubble em { color: #00c8a0; font-style: normal; font-weight: 500; }

    .coach-msg.user .coach-msg-bubble {
      background: #1a2820; color: #e8e3da;
      padding: 9px 13px; border-radius: 10px 10px 2px 10px;
      align-self: flex-end;
    }
    .coach-msg.coach .coach-msg-bubble {
      color: #b0aa9e; align-self: flex-start;
      border-left: 2px solid rgba(0,200,160,0.25); padding-left: 11px;
    }

    /* Typing */
    .coach-typing {
      display: flex; gap: 5px; align-items: center;
      padding: 8px 0 0 13px; border-left: 2px solid rgba(0,200,160,0.2);
    }
    .coach-typing span {
      width: 5px; height: 5px; background: #3e504a; border-radius: 50%;
      animation: td 1.2s infinite;
    }
    .coach-typing span:nth-child(2) { animation-delay: 0.2s; }
    .coach-typing span:nth-child(3) { animation-delay: 0.4s; }
    @keyframes td { 0%,60%,100%{transform:translateY(0);opacity:0.3} 30%{transform:translateY(-4px);opacity:1} }

    /* Chips */
    #bl-coach-chips {
      padding: 8px 16px 4px;
      display: flex; flex-wrap: wrap; gap: 6px;
      flex-shrink: 0;
    }
    .coach-chip {
      background: #141f1a; border: 1px solid #1e2e28;
      border-radius: 20px; padding: 5px 13px;
      font-size: 11px; font-weight: 400; color: #5a7060;
      cursor: pointer; transition: all 0.12s; white-space: nowrap;
    }
    .coach-chip:hover { border-color: rgba(0,200,160,0.35); color: #00c8a0; background: rgba(0,200,160,0.05); }

    /* Input */
    #bl-coach-input-wrap {
      padding: 10px 14px 14px;
      border-top: 1px solid #1a2820;
      display: flex; gap: 8px; flex-shrink: 0;
      background: #0d1512;
    }
    #bl-coach-input {
      flex: 1; background: #1a2820; border: 1px solid #1e2e28;
      border-radius: 10px; padding: 9px 13px;
      font-size: 13px; font-family: 'Space Grotesk',sans-serif;
      color: #e8e3da; outline: none; resize: none;
      line-height: 1.4; max-height: 90px; transition: border-color 0.12s;
    }
    #bl-coach-input:focus { border-color: rgba(0,200,160,0.35); }
    #bl-coach-input::placeholder { color: #2a4038; }
    #bl-coach-send {
      width: 34px; height: 34px; border-radius: 8px;
      background: #00c8a0; border: none; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0; align-self: flex-end;
      transition: opacity 0.12s; color: #0c1010; font-size: 15px; font-weight: 700;
    }
    #bl-coach-send:hover { opacity: 0.85; }
    #bl-coach-send:disabled { opacity: 0.25; cursor: not-allowed; }

    @media(max-width: 480px) {
      #bl-coach-panel { right: 10px; bottom: 82px; width: calc(100vw - 20px); }
      #bl-coach-btn { right: 14px; bottom: 18px; }
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
            <div class="ch-title-wrap">
              <div class="ch-name">Your Coach</div>
              <div class="ch-ask">Ask me anything</div>
            </div>
          </div>
          <div class="ch-right">
            <span class="coach-status" id="coach-status">Ready</span>
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
    `;
    document.body.appendChild(wrap);
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
      // Render chips
      renderChips(profile);
      // Restore history
      loadHistory().forEach(m => addMessage(m.role === 'user' ? 'user' : 'coach', m.content));
    }

    // Toggle
    btn.addEventListener('click', () => {
      const open = panel.classList.toggle('open');
      btn.classList.toggle('open', open);
      btn.innerHTML = open ? '✕' : '💬';
      if (open && input && !input.disabled) setTimeout(() => input.focus(), 250);
    });

    // Send
    async function send_msg(text) {
      if (!profile) return;
      const msg = text || input?.value?.trim();
      if (!msg) return;
      if (input && !text) input.value = '';
      if (send) send.disabled = true;
      setStatus('Thinking…', true);
      addMessage('user', msg);
      showTyping();
      // Hide chips after first message
      const chips = document.getElementById('bl-coach-chips');
      if (chips) chips.style.display = 'none';
      try {
        const reply = await askCoach(msg, profile);
        hideTyping();
        addMessage('coach', reply);
        setStatus('Ready');
      } catch(e) {
        hideTyping();
        addMessage('coach', 'Something went wrong — ' + (e.message || 'try again'));
        setStatus('Error');
      }
      if (send) send.disabled = false;
      if (input && !text) input.focus();
    }

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

    window._blCoach = {
      send: t => send_msg(t),
      open: () => { panel.classList.add('open'); btn.classList.add('open'); btn.innerHTML='✕'; },
      close: () => { panel.classList.remove('open'); btn.classList.remove('open'); btn.innerHTML='💬'; },
      clear: () => {
        clearHistory();
        const c = document.getElementById('bl-coach-messages');
        if (c) c.innerHTML = `<div class="coach-empty"><div class="coach-empty-icon">⚡</div><div class="coach-empty-title">Ask me anything</div><div class="coach-empty-sub">I know your programme, your goals, and what you're reading right now.</div></div>`;
        const chips = document.getElementById('bl-coach-chips');
        if (chips && profile) { chips.style.display = 'flex'; renderChips(profile); }
        setStatus('Ready');
      },
    };
  }

  function renderChips(profile) {
    const chips = getChips(profile, getPageType());
    const el = document.getElementById('bl-coach-chips');
    if (!el) return;
    el.innerHTML = chips.map(c =>
      `<div class="coach-chip" onclick="window._blCoach.send(${JSON.stringify(c)})">${c}</div>`
    ).join('');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

})();

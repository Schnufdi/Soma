// ════════════════════════════════════════════════════════
//  coach.js — BodyLens floating AI coach
//  Persistent across all pages. Context-aware per page.
//  No dependencies beyond nav.js (for getProfile / quickCoach)
// ════════════════════════════════════════════════════════

(function() {

  const API   = '/api/chat';
  const MODEL = 'claude-sonnet-4-20250514';
  const HISTORY_KEY = 'bl_coach_history';
  const MAX_HISTORY = 12; // messages to keep (6 exchanges)

  // ── PAGE CONTEXT MAP ──────────────────────────────────
  // Each page gets a context string that primes the coach
  const PAGE_CONTEXTS = {
    'day':          'The user is looking at their daily plan — today\'s schedule, meals, training session, supplement timing, and recovery. They may ask about today\'s specific blocks, whether to adjust something, or how to handle the day if something changes.',
    'food':         'The user is on the Food System page — meal ideas, shopping list, weekly plan, macro targets. They may ask about specific foods, swaps, whether something fits their targets, or how to hit their protein.',
    'fuel':         'The user is on the Food System page — meal ideas, shopping list, timing, synergies. They may ask about specific foods, meal swaps, nutrient timing, or how to hit their targets.',
    'training':     'The user is reading about training science — frequency, volume, splits, periodisation, proximity to failure. They may ask about their specific programme, exercise choices, or how to structure their training.',
    'alcohol':      'The user is reading about alcohol\'s effects on muscle building, sleep, hormones, and recovery. They may ask about their specific situation — how much they drink, which nights are safest, or whether a specific occasion will derail their progress.',
    'weightloss':   'The user is reading about fat loss mechanisms — CICO, TDEE, hormones, why diets fail. They may ask about their specific calorie target, expected rate of fat loss, or why their progress has stalled.',
    'hunger':       'The user is reading about hunger management — ghrelin, leptin, food noise, emotional eating. They may ask about their specific trigger foods, why they\'re hungry despite eating enough, or how to manage cravings.',
    'optimal':      'The user is reading about whole-body systems — gut health, energy, brain function, anxiety, mood, hormones. They may ask about specific symptoms, supplements, or how to optimise a particular system.',
    'synthesis':    'The user is reading about the training framework — Signal, Build, Protect, Repeat. They may ask how the framework applies to their specific programme or goal.',
    'story':        'The user is reading a narrative of how their programme works across a full day. They may ask about specific timing decisions or the reasoning behind the structure.',
    'mentalhealth': 'The user is reading about mental health — cortisol, gut-brain axis, hormonal mood patterns, psychology of their goal. They may ask about stress, motivation, or the psychological side of body recomposition.',
    'longevity':    'The user is reading about longevity science — decade-by-decade biological changes, biomarkers, leverage points. They may ask about their specific decade, which interventions matter most, or what to test.',
    'attia':        'The user is reading about Attia and Huberman protocols — Zone 2, VO₂max, biomarkers, NSDR, cold and heat. They may ask about implementing specific protocols or how they apply to their situation.',
    'programme':    'The user is viewing their programme overview — week plan, macros, supplements, injuries. They may ask about any element of their programme or how it was built.',
    'instructions': 'The user is reading their coaching report — the full personalised assessment of their programme. They may ask for clarification or want to discuss specific recommendations.',
    'howitworks':   'The user is reading about how BodyLens built their programme — the calculations, the logic, the science behind the decisions. They may ask about specific numbers or methodology.',
    'science':      'The user is on the Science hub — browsing what science pages are available. They may ask about any topic.',
    'body':         'The user is exploring the muscle guide — anatomy, how each muscle works, how to train it. They may ask about specific exercises or muscle function.',
    'default':      'The user is using BodyLens. They may ask about any aspect of their programme, nutrition, training, or health.',
  };

  // ── COACH VOICE ───────────────────────────────────────
  function buildSystemPrompt(profile, pageContext) {
    const isFemale = (profile.sex||'').toLowerCase() === 'female';
    const injuries = (profile.injuryAssessments||profile.injuries||[]);
    const supps    = profile.supplements||[];
    const weekPlan = profile.weekPlan||[];
    const trainDays = weekPlan.filter(d=>d.priority==='training').map(d=>d.day).join(', ');

    return `You are the BodyLens coach — a senior performance coach embedded in a personalised fitness and nutrition platform. You are speaking directly with ${profile.name}.

CLIENT PROFILE:
Name: ${profile.name} | Age: ${profile.age} | Sex: ${profile.sex}
Weight: ${profile.weight}kg | Height: ${profile.height}cm${profile.bodyFat ? ' | Body fat: '+profile.bodyFat+'%' : ''}
Goal: ${profile.goal}${profile.target ? ' — '+profile.target : ''}
Experience: ${profile.experience||'—'} | Training: ${profile.trainingDays} days/week (${trainDays})
Wake: ${profile.wakeTime||'07:00'} | Training time: ${profile.trainingTime||'—'}
Calories: ${profile.calories} kcal | Protein: ${profile.protein}g | Carbs: ${profile.carbs}g | Fat: ${profile.fat}g
Eating window: ${profile.fastingWindow||profile.eatingWindow||'flexible'}
Diet: ${profile.dietType||'no restrictions'} | Exclude: ${(profile.foodExclusions||[]).join(', ')||'none'}
Trigger foods: ${profile.triggerFoods||'none'}
Alcohol: ${profile.alcoholHabit||'—'} | Sleep: ${profile.sleep||'—'}
Recovery tools: ${(profile.recoveryTools||[]).join(', ')||'none'}
Supplements: ${supps.map(s=>s.name+' '+s.dose).join(', ')||'none'}
${injuries.length ? 'INJURIES: '+injuries.map(i=>(i.location||i)+': '+(i.assessment||i.detail||'')).join('; ') : 'No current injuries'}
${profile.activityLevel ? 'Activity outside training: '+profile.activityLevel : ''}
${profile.cookingApproach ? 'Food approach: '+profile.cookingApproach+(profile.cuisinePrefs&&profile.cuisinePrefs.length?' | Cuisines: '+profile.cuisinePrefs.join(', '):'')+(profile.recipeComplexity?' | Complexity: '+profile.recipeComplexity:'') : ''}
${isFemale && profile.menstrualCycle ? 'Cycle: '+profile.menstrualCycle : ''}

CURRENT PAGE CONTEXT:
${pageContext}

YOUR COACHING VOICE:
- Direct, warm, knowledgeable. Like a senior coach in a real consultation — not a chatbot.
- Use ${profile.name}'s name occasionally but not every message.
- Be specific. Reference their actual numbers, their actual training days, their actual injuries.
- Don't pad. One clear answer is better than three vague ones.
- When the science is settled, say so. When it's uncertain, say that too.
- If they ask something medical, give the science clearly but recommend they discuss with their GP for anything clinical.
- Keep responses to 3-5 sentences unless a longer explanation is genuinely needed.
- Never start a response with "Great question!" or similar hollow affirmations.
- ${isFemale ? 'Frame all advice through female physiology where relevant — hormonal cycle, oestrogen effects, female-specific training and nutrition considerations.' : 'Frame advice through male physiology where relevant — testosterone, GH, male-specific recovery and nutrition considerations.'}`;
  }

  // ── DETECT PAGE ───────────────────────────────────────
  function getPageType() {
    const meta = document.querySelector('meta[name="bl-page"]');
    return meta ? meta.getAttribute('content') : 'default';
  }

  function getPageContext() {
    const type = getPageType();
    return PAGE_CONTEXTS[type] || PAGE_CONTEXTS['default'];
  }

  // ── HISTORY ───────────────────────────────────────────
  function loadHistory() {
    try {
      const raw = localStorage.getItem(HISTORY_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch(e) { return []; }
  }

  function saveHistory(history) {
    try {
      // Keep last MAX_HISTORY messages
      const trimmed = history.slice(-MAX_HISTORY);
      localStorage.setItem(HISTORY_KEY, JSON.stringify(trimmed));
    } catch(e) {}
  }

  function clearHistory() {
    localStorage.removeItem(HISTORY_KEY);
  }

  // ── API CALL ──────────────────────────────────────────
  async function askCoach(userMessage, profile) {
    const history = loadHistory();
    const systemPrompt = buildSystemPrompt(profile, getPageContext());

    // Add user message to history
    history.push({ role: 'user', content: userMessage });

    const messages = history.slice(-MAX_HISTORY);

    const res = await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 600,
        system: systemPrompt,
        messages: messages,
      }),
    });

    if (!res.ok) throw new Error('API ' + res.status);
    const data = await res.json();
    if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));

    const text = (data.content||[]).map(b=>b.text||'').join('').trim();
    if (!text) throw new Error('Empty response');

    // Save exchange to history
    history.push({ role: 'assistant', content: text });
    saveHistory(history);

    return text;
  }

  // ── BUILD UI ──────────────────────────────────────────
  function buildCoachUI() {
    const css = `
      /* ── COACH FLOATING BUTTON ── */
      #bl-coach-btn {
        position: fixed;
        bottom: 28px;
        right: 28px;
        width: 54px;
        height: 54px;
        border-radius: 50%;
        background: var(--jade, #00c8a0);
        border: none;
        cursor: pointer;
        z-index: 1000;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 4px 20px rgba(0,200,160,0.35);
        transition: transform 0.2s, box-shadow 0.2s;
        font-size: 22px;
      }
      #bl-coach-btn:hover {
        transform: scale(1.08);
        box-shadow: 0 6px 28px rgba(0,200,160,0.5);
      }
      #bl-coach-btn.open {
        background: #3e504a;
        box-shadow: 0 4px 16px rgba(0,0,0,0.3);
      }

      /* ── COACH PANEL ── */
      #bl-coach-panel {
        position: fixed;
        bottom: 94px;
        right: 28px;
        width: 380px;
        max-width: calc(100vw - 40px);
        height: 520px;
        max-height: calc(100vh - 120px);
        background: #131918;
        border: 1px solid #2a3830;
        border-radius: 12px;
        display: flex;
        flex-direction: column;
        z-index: 999;
        box-shadow: 0 16px 48px rgba(0,0,0,0.5);
        transform: translateY(12px) scale(0.97);
        opacity: 0;
        pointer-events: none;
        transition: transform 0.2s ease, opacity 0.2s ease;
        overflow: hidden;
      }
      #bl-coach-panel.open {
        transform: translateY(0) scale(1);
        opacity: 1;
        pointer-events: all;
      }

      /* Panel header */
      #bl-coach-header {
        padding: 14px 18px;
        border-bottom: 1px solid #1e2e28;
        display: flex;
        align-items: center;
        justify-content: space-between;
        flex-shrink: 0;
        background: #0f1714;
      }
      .coach-header-left {
        display: flex;
        align-items: center;
        gap: 10px;
      }
      .coach-avatar {
        width: 32px;
        height: 32px;
        border-radius: 50%;
        background: rgba(0,200,160,0.15);
        border: 1px solid rgba(0,200,160,0.3);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 14px;
        flex-shrink: 0;
      }
      .coach-name {
        font-size: 13px;
        font-weight: 600;
        color: #e8e3da;
        letter-spacing: 0.01em;
      }
      .coach-status {
        font-size: 10px;
        font-weight: 300;
        color: #3e504a;
        margin-top: 1px;
      }
      .coach-status.thinking {
        color: #00c8a0;
        animation: pulse 1.2s infinite;
      }
      @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }

      .coach-header-actions {
        display: flex;
        gap: 8px;
        align-items: center;
      }
      .coach-action-btn {
        background: none;
        border: none;
        color: #3e504a;
        cursor: pointer;
        font-size: 14px;
        padding: 4px 6px;
        border-radius: 4px;
        transition: color 0.12s;
      }
      .coach-action-btn:hover { color: #8a9490; }

      /* Page indicator */
      #bl-coach-page-indicator {
        padding: 7px 18px;
        background: rgba(0,200,160,0.04);
        border-bottom: 1px solid #1e2e28;
        font-size: 10px;
        font-weight: 500;
        color: #3e504a;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        flex-shrink: 0;
      }
      #bl-coach-page-indicator span {
        color: #00c8a0;
      }

      /* Messages */
      #bl-coach-messages {
        flex: 1;
        overflow-y: auto;
        padding: 16px 18px;
        display: flex;
        flex-direction: column;
        gap: 14px;
        scroll-behavior: smooth;
      }
      #bl-coach-messages::-webkit-scrollbar { width: 4px; }
      #bl-coach-messages::-webkit-scrollbar-track { background: transparent; }
      #bl-coach-messages::-webkit-scrollbar-thumb { background: #2a3830; border-radius: 2px; }

      .coach-msg {
        display: flex;
        flex-direction: column;
        gap: 3px;
        animation: msgIn 0.18s ease;
      }
      @keyframes msgIn { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }

      .coach-msg-bubble {
        padding: 10px 14px;
        border-radius: 10px;
        font-size: 13px;
        font-weight: 300;
        line-height: 1.65;
        max-width: 88%;
      }
      .coach-msg.user .coach-msg-bubble {
        background: #1e2e28;
        color: #e8e3da;
        align-self: flex-end;
        border-radius: 10px 10px 2px 10px;
      }
      .coach-msg.coach .coach-msg-bubble {
        background: transparent;
        color: #c8c0b4;
        align-self: flex-start;
        border-radius: 10px 10px 10px 2px;
        border-left: 2px solid rgba(0,200,160,0.3);
        padding-left: 12px;
      }
      .coach-msg.coach .coach-msg-bubble strong {
        color: #e8e3da;
        font-weight: 500;
      }

      /* Typing indicator */
      .coach-typing {
        display: flex;
        gap: 5px;
        padding: 12px 14px;
        align-self: flex-start;
        border-left: 2px solid rgba(0,200,160,0.3);
        padding-left: 12px;
      }
      .coach-typing-dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: #3e504a;
        animation: typingDot 1.2s infinite;
      }
      .coach-typing-dot:nth-child(2) { animation-delay: 0.2s; }
      .coach-typing-dot:nth-child(3) { animation-delay: 0.4s; }
      @keyframes typingDot { 0%,60%,100%{transform:translateY(0);opacity:0.3} 30%{transform:translateY(-4px);opacity:1} }

      /* Quick chips */
      #bl-coach-chips {
        padding: 8px 18px 0;
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        flex-shrink: 0;
      }
      .coach-chip {
        background: #1a2820;
        border: 1px solid #2a3830;
        border-radius: 16px;
        padding: 5px 12px;
        font-size: 11px;
        font-weight: 400;
        color: #8a9490;
        cursor: pointer;
        transition: all 0.12s;
        white-space: nowrap;
      }
      .coach-chip:hover {
        border-color: rgba(0,200,160,0.4);
        color: #00c8a0;
        background: rgba(0,200,160,0.06);
      }

      /* Input */
      #bl-coach-input-wrap {
        padding: 12px 18px 16px;
        border-top: 1px solid #1e2e28;
        display: flex;
        gap: 8px;
        flex-shrink: 0;
        background: #0f1714;
      }
      #bl-coach-input {
        flex: 1;
        background: #192120;
        border: 1px solid #2a3830;
        border-radius: 8px;
        padding: 9px 14px;
        font-size: 13px;
        font-family: 'Space Grotesk', sans-serif;
        color: #e8e3da;
        outline: none;
        resize: none;
        line-height: 1.4;
        max-height: 100px;
        transition: border-color 0.12s;
      }
      #bl-coach-input:focus { border-color: rgba(0,200,160,0.4); }
      #bl-coach-input::placeholder { color: #3e504a; }
      #bl-coach-send {
        width: 36px;
        height: 36px;
        border-radius: 8px;
        background: #00c8a0;
        border: none;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        align-self: flex-end;
        transition: opacity 0.12s;
        font-size: 14px;
        color: #0c1010;
        font-weight: 700;
      }
      #bl-coach-send:hover { opacity: 0.85; }
      #bl-coach-send:disabled { opacity: 0.35; cursor: not-allowed; }

      /* Empty state */
      .coach-empty {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 100%;
        text-align: center;
        padding: 24px;
        gap: 10px;
      }
      .coach-empty-icon { font-size: 32px; opacity: 0.4; }
      .coach-empty-title { font-size: 15px; font-weight: 300; color: #8a9490; }
      .coach-empty-sub { font-size: 12px; font-weight: 300; color: #3e504a; line-height: 1.6; max-width: 240px; }

      @media(max-width:480px){
        #bl-coach-panel { right:12px; bottom:88px; width:calc(100vw - 24px); }
        #bl-coach-btn { right:16px; bottom:20px; }
      }
    `;

    // Inject styles
    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);

    // Determine page label
    const pageType = getPageType();
    const pageLabels = {
      'day':'Today\'s plan','food':'Food system','fuel':'Food system',
      'training':'Training','alcohol':'Alcohol','weightloss':'Weight loss',
      'hunger':'Hunger','optimal':'The Machine','synthesis':'How It Runs',
      'story':'The Story','mentalhealth':'Mental health','longevity':'Longevity',
      'attia':'Protocols','programme':'Programme','instructions':'Report',
      'howitworks':'How it works','science':'Science','body':'Muscle guide',
    };
    const pageLabel = pageLabels[pageType] || 'BodyLens';

    // Build HTML
    const wrapper = document.createElement('div');
    wrapper.id = 'bl-coach-wrapper';
    wrapper.innerHTML = `
      <button id="bl-coach-btn" aria-label="Open coach">💬</button>

      <div id="bl-coach-panel" role="dialog" aria-label="BodyLens Coach">
        <div id="bl-coach-header">
          <div class="coach-header-left">
            <div class="coach-avatar">⚡</div>
            <div>
              <div class="coach-name">BodyLens Coach</div>
              <div class="coach-status" id="coach-status">Ready</div>
            </div>
          </div>
          <div class="coach-header-actions">
            <button class="coach-action-btn" onclick="window._blCoach.clearChat()" title="Clear chat">↺</button>
            <button class="coach-action-btn" onclick="window._blCoach.close()" title="Close">✕</button>
          </div>
        </div>

        <div id="bl-coach-page-indicator">
          Context: <span>${pageLabel}</span>
        </div>

        <div id="bl-coach-messages">
          <div class="coach-empty">
            <div class="coach-empty-icon">⚡</div>
            <div class="coach-empty-title">Ask me anything</div>
            <div class="coach-empty-sub">I know your programme, your goals, and what you're reading. Ask anything.</div>
          </div>
        </div>

        <div id="bl-coach-chips"></div>

        <div id="bl-coach-input-wrap">
          <textarea id="bl-coach-input" placeholder="Ask your coach…" rows="1"></textarea>
          <button id="bl-coach-send">↑</button>
        </div>
      </div>
    `;

    document.body.appendChild(wrapper);
  }

  // ── CHIP GENERATION ───────────────────────────────────
  function getChips(profile, pageType) {
    const isFemale = (profile.sex||'').toLowerCase() === 'female';
    const isTraining = (() => {
      const DAY_MAP = {0:6,1:0,2:1,3:2,4:3,5:4,6:5};
      const idx = DAY_MAP[new Date().getDay()];
      const plan = (profile.weekPlan||[])[idx];
      return plan && plan.priority === 'training';
    })();
    const injuries = (profile.injuryAssessments||profile.injuries||[]);
    const hasTrigger = profile.triggerFoods && !profile.triggerFoods.toLowerCase().includes('none');

    const chipSets = {
      'day': [
        isTraining ? 'How heavy should I go today?' : 'What should I eat today?',
        'Can I have alcohol tonight?',
        injuries.length ? injuries[0].location + ' feels off' : 'Low energy today',
        'Am I on track with protein?',
      ],
      'alcohol': [
        'Can I drink on ' + (isTraining ? 'a training day?' : 'a rest day?'),
        'How bad is one drink post-training?',
        'Best drink if I have to?',
        'How long does it affect recovery?',
      ],
      'weightloss': [
        'Why has my progress stalled?',
        'Is my deficit right for my goal?',
        'Should I do more cardio?',
        'How do I know if I\'m losing fat not muscle?',
      ],
      'hunger': [
        hasTrigger ? 'I want ' + profile.triggerFoods.split(/[,/]/)[0].trim() : 'I\'m hungry between meals',
        'How do I reduce food noise?',
        'Why am I hungrier on rest days?',
        isFemale ? 'Cravings are worse this week' : 'Cravings after training',
      ],
      'optimal': [
        'My energy crashes at 3pm',
        'How do I improve my focus?',
        'What helps with sleep quality?',
        isFemale ? 'Mood is lower this week' : 'How do I boost testosterone naturally?',
      ],
      'training': [
        'How close to failure should I train?',
        'How many sets per muscle per week?',
        injuries.length ? 'Can I train with my ' + (injuries[0].location||'injury') + '?' : 'Is my split optimal?',
        'Should I deload?',
      ],
      'fuel': [
        'What should I eat before training?',
        'Best post-workout meal?',
        'How do I hit my protein target?',
        'Is my timing right?',
      ],
      'food': [
        'What should I eat today?',
        'Swap ideas for dinner?',
        'Am I hitting my protein?',
        'Good meal ideas for rest days?',
      ],
    };

    return chipSets[pageType] || [
      'Am I on track?',
      'What\'s most important today?',
      isFemale ? 'Female-specific advice?' : 'How\'s my programme looking?',
      'Quick win for today?',
    ];
  }

  // ── RENDER ────────────────────────────────────────────
  function renderChips(profile) {
    const pageType = getPageType();
    const chips = getChips(profile, pageType);
    const container = document.getElementById('bl-coach-chips');
    if (!container) return;
    container.innerHTML = chips.map(c =>
      `<div class="coach-chip" onclick="window._blCoach.send('${c.replace(/'/g,"\\'")}')">
        ${c}
      </div>`
    ).join('');
  }

  function addMessage(role, text) {
    const container = document.getElementById('bl-coach-messages');
    if (!container) return;

    // Remove empty state if present
    const empty = container.querySelector('.coach-empty');
    if (empty) empty.remove();

    const msg = document.createElement('div');
    msg.className = `coach-msg ${role}`;
    msg.innerHTML = `<div class="coach-msg-bubble">${formatMessage(text)}</div>`;
    container.appendChild(msg);
    container.scrollTop = container.scrollHeight;
  }

  function formatMessage(text) {
    // Convert markdown-ish formatting to HTML
    return text
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\*([^*]+)\*/g, '<em>$1</em>')
      .replace(/\n\n/g, '</p><p>')
      .replace(/\n/g, '<br>')
      .replace(/^/, '<p>').replace(/$/, '</p>')
      .replace(/<p><\/p>/g, '');
  }

  function showTyping() {
    const container = document.getElementById('bl-coach-messages');
    if (!container) return;
    const typing = document.createElement('div');
    typing.id = 'coach-typing-indicator';
    typing.className = 'coach-typing';
    typing.innerHTML = `<div class="coach-typing-dot"></div><div class="coach-typing-dot"></div><div class="coach-typing-dot"></div>`;
    container.appendChild(typing);
    container.scrollTop = container.scrollHeight;
  }

  function hideTyping() {
    const el = document.getElementById('coach-typing-indicator');
    if (el) el.remove();
  }

  function setStatus(text, thinking = false) {
    const el = document.getElementById('coach-status');
    if (el) {
      el.textContent = text;
      el.className = 'coach-status' + (thinking ? ' thinking' : '');
    }
  }

  // ── INIT ──────────────────────────────────────────────
  function init() {
    // Get profile
    let profile;
    try {
      const raw = localStorage.getItem('bl_profile');
      profile = raw ? JSON.parse(raw) : null;
    } catch(e) { profile = null; }

    // Build UI
    buildCoachUI();

    const btn   = document.getElementById('bl-coach-btn');
    const panel = document.getElementById('bl-coach-panel');
    const input = document.getElementById('bl-coach-input');
    const send  = document.getElementById('bl-coach-send');

    if (!profile) {
      // No profile — show limited UI
      send.disabled = true;
      input.placeholder = 'Complete onboarding to chat with your coach';
      input.disabled = true;
    } else {
      // Render chips based on page + profile
      renderChips(profile);

      // Restore history
      const history = loadHistory();
      if (history.length) {
        history.forEach(msg => addMessage(msg.role === 'user' ? 'user' : 'coach', msg.content));
      }
    }

    // Toggle panel
    btn.addEventListener('click', () => {
      const isOpen = panel.classList.toggle('open');
      btn.classList.toggle('open', isOpen);
      btn.textContent = isOpen ? '✕' : '💬';
      if (isOpen && input && !input.disabled) {
        setTimeout(() => input.focus(), 200);
      }
    });

    // Send message
    async function sendMessage(text) {
      if (!profile) return;
      const msg = text || (input ? input.value.trim() : '');
      if (!msg) return;

      if (input) input.value = '';
      if (send) send.disabled = true;
      setStatus('Thinking…', true);

      addMessage('user', msg);
      showTyping();

      // Hide chips after first message
      const chipsEl = document.getElementById('bl-coach-chips');
      if (chipsEl) chipsEl.style.display = 'none';

      try {
        const response = await askCoach(msg, profile);
        hideTyping();
        addMessage('coach', response);
        setStatus('Ready');
      } catch(e) {
        hideTyping();
        addMessage('coach', 'Something went wrong — ' + (e.message||'try again'));
        setStatus('Error');
        console.error('Coach error:', e);
      }

      if (send) send.disabled = false;
      if (input && !text) input.focus();
    }

    if (send) send.addEventListener('click', () => sendMessage());
    if (input) {
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          sendMessage();
        }
      });
      // Auto-resize textarea
      input.addEventListener('input', () => {
        input.style.height = 'auto';
        input.style.height = Math.min(input.scrollHeight, 100) + 'px';
      });
    }

    // Public API
    window._blCoach = {
      send: (text) => sendMessage(text),
      open: () => {
        panel.classList.add('open');
        btn.classList.add('open');
        btn.textContent = '✕';
      },
      close: () => {
        panel.classList.remove('open');
        btn.classList.remove('open');
        btn.textContent = '💬';
      },
      clearChat: () => {
        clearHistory();
        const container = document.getElementById('bl-coach-messages');
        if (container) {
          container.innerHTML = `<div class="coach-empty">
            <div class="coach-empty-icon">⚡</div>
            <div class="coach-empty-title">Ask me anything</div>
            <div class="coach-empty-sub">I know your programme, your goals, and what you're reading. Ask anything.</div>
          </div>`;
        }
        const chipsEl = document.getElementById('bl-coach-chips');
        if (chipsEl && profile) {
          chipsEl.style.display = 'flex';
          renderChips(profile);
        }
        setStatus('Ready');
      },
    };
  }

  // Wait for DOM
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();

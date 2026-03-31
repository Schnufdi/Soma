// BodyLens — Debrief v3: Voice-first guided day log
// ─────────────────────────────────────────────────────────────────────────────
// Architecture:
//   • Chips are .db-opt (matching existing CSS) — single-select auto-advance
//   • Multi-select uses .db-chip grid (exercises, supplements)
//   • TTS via /api/tts.js (ElevenLabs), falls back to browser speechSynthesis
//   • SpeechRecognition listens passively — matches voice to chips
//   • Each answer is written to localStorage immediately (→ Supabase via bl-sync)
//   • No "Continue" button on single-select steps — tap and move
// ─────────────────────────────────────────────────────────────────────────────
// Depends on globals: P, TODAY, _rDate, loadDayLog, saveDayLog, initDayLog,
//                     MACROS, saveMacros, getSuppLog, MODEL_FAST, window._blocks

// ── Inject debrief-specific styles ──────────────────────────────────────────
(function injectDebriefStyles() {
  if (document.getElementById('db-v3-styles')) return;
  var s = document.createElement('style');
  s.id = 'db-v3-styles';
  s.textContent = `
    /* Multi-select chip grid (exercises, supplements) */
    .db-chip-grid { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 20px; }
    .db-chip {
      padding: 9px 14px; border-radius: 20px;
      border: 1px solid rgba(255,255,255,.1);
      background: rgba(255,255,255,.03);
      cursor: pointer; font-size: 12px; font-weight: 500;
      color: var(--dk-2); transition: all .12s;
      user-select: none; -webkit-user-select: none;
    }
    .db-chip:hover { border-color: rgba(255,255,255,.2); color: var(--dk-1); }
    .db-chip.sel {
      border-color: rgba(0,200,160,.4);
      background: rgba(0,200,160,.1);
      color: var(--jade);
    }
    /* Single-select option (full-width, auto-advance) — uses existing .db-opt */
    .db-opt.voice-match {
      border-color: rgba(0,200,160,.5);
      background: rgba(0,200,160,.12);
      animation: db-voice-pulse 0.4s ease;
    }
    @keyframes db-voice-pulse {
      0% { transform: scale(1); }
      40% { transform: scale(1.015); }
      100% { transform: scale(1); }
    }
    /* Voice control bar */
    .db-voice-bar {
      display: flex; align-items: center; gap: 10px;
      padding: 10px 0 4px; margin-bottom: 12px;
    }
    .db-voice-btn {
      width: 36px; height: 36px; border-radius: 50%;
      border: 1px solid rgba(255,255,255,.12);
      background: rgba(255,255,255,.04);
      color: var(--dk-3); cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      font-size: 16px; transition: all .15s; flex-shrink: 0;
    }
    .db-voice-btn.listening {
      border-color: var(--jade); background: rgba(0,200,160,.12);
      color: var(--jade); animation: db-mic-pulse 1.2s infinite;
    }
    .db-voice-btn.muted { opacity: .35; }
    @keyframes db-mic-pulse {
      0%, 100% { box-shadow: 0 0 0 0 rgba(0,200,160,0); }
      50% { box-shadow: 0 0 0 6px rgba(0,200,160,.2); }
    }
    .db-voice-hint {
      font-size: 11px; color: var(--dk-3); font-weight: 300;
      line-height: 1.4; flex: 1;
    }
    .db-voice-hint.active { color: var(--jade); }
    /* Sub-question label */
    .db-sub {
      font-size: 12px; font-weight: 300; color: var(--dk-3);
      margin-bottom: 20px; line-height: 1.5;
    }
    /* Skip link */
    .db-skip-link {
      text-align: center; margin-top: 12px;
    }
    .db-skip-link button {
      background: none; border: none; color: var(--dk-3);
      font-size: 11px; cursor: pointer; text-decoration: underline;
      font-family: var(--sans); padding: 4px 8px;
    }
    /* Summary */
    .db-summary-grid {
      display: flex; flex-direction: column; gap: 2px; margin-bottom: 24px;
    }
    .db-sum-row {
      display: flex; justify-content: space-between; align-items: baseline;
      padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,.04);
    }
    .db-sum-row:last-child { border-bottom: none; }
    .db-sum-key { font-size: 11px; font-weight: 600; letter-spacing: .08em;
      text-transform: uppercase; color: var(--dk-3); }
    .db-sum-val { font-size: 14px; font-weight: 300; color: var(--dk-1);
      text-align: right; max-width: 60%; }
    .db-sum-val.good { color: var(--jade); }
    .db-sum-val.warn { color: var(--amber, #f0a500); }
    .db-sum-val.muted { color: var(--dk-3); }
    /* Protein quick-log */
    .db-prot-row { display: flex; gap: 8px; align-items: center;
      margin-bottom: 20px; }
    .db-prot-inp {
      flex: 1; background: rgba(255,255,255,.04);
      border: 1px solid rgba(255,255,255,.08); border-radius: 10px;
      padding: 12px 14px; font-size: 20px; color: var(--dk-1);
      font-family: var(--sans); outline: none; text-align: center;
      transition: border-color .12s;
    }
    .db-prot-inp:focus { border-color: rgba(0,200,160,.3); }
    .db-prot-unit { font-size: 13px; color: var(--dk-3); }
    /* Conversation bubbles (unchanged) */
    .db-conv-msgs { max-height: 200px; overflow-y: auto;
      margin-bottom: 12px; display: flex; flex-direction: column; gap: 8px; }
    .db-conv-msg { padding: 10px 13px; border-radius: 12px;
      font-size: 13px; font-weight: 300; line-height: 1.6; max-width: 88%; }
    .db-conv-msg.coach {
      background: rgba(255,255,255,.04); color: var(--dk-2);
      align-self: flex-start; border-radius: 4px 12px 12px 12px;
    }
    .db-conv-msg.user {
      background: rgba(0,200,160,.08); color: var(--dk-1);
      align-self: flex-end; border-radius: 12px 4px 12px 12px;
      border: 1px solid rgba(0,200,160,.15);
    }
    .db-conv-msg.thinking { color: var(--dk-3); font-style: italic; }
    .db-conv-input-row { display: flex; gap: 8px; }
    .db-conv-input {
      flex: 1; background: rgba(255,255,255,.04);
      border: 1px solid rgba(255,255,255,.08); border-radius: 10px;
      padding: 10px 13px; font-size: 13px; color: var(--dk-1);
      font-family: var(--sans); outline: none; resize: none;
      transition: border-color .12s; line-height: 1.5; min-height: 40px;
    }
    .db-conv-input:focus { border-color: rgba(0,200,160,.3); }
    .db-conv-send {
      padding: 10px 14px; background: rgba(0,200,160,.1);
      border: 1px solid rgba(0,200,160,.2); border-radius: 10px;
      color: var(--jade); font-size: 16px; cursor: pointer;
      transition: background .12s; align-self: flex-end;
    }
    .db-conv-send:hover { background: rgba(0,200,160,.18); }
    .db-conv-skip-link { text-align: center; margin-top: 8px; }
    .db-conv-skip-link button {
      background: none; border: none; color: var(--dk-3); font-size: 11px;
      cursor: pointer; text-decoration: underline; font-family: var(--sans);
    }
    /* Mute toggle in debrief header */
    #db-mute-btn {
      background: none; border: none; font-size: 16px; cursor: pointer;
      color: var(--dk-3); padding: 4px 8px; border-radius: 8px;
      transition: color .12s; opacity: .6;
    }
    #db-mute-btn:hover { opacity: 1; }
    #db-mute-btn.muted { opacity: .3; }
  `;
  document.head.appendChild(s);
})();

// ── Voice engine ──────────────────────────────────────────────────────────────
var DB_VOICE = {
  muted: false,
  listening: false,
  recognition: null,
  supported: !!(window.SpeechRecognition || window.webkitSpeechRecognition),
  currentAudio: null
};

async function dbSpeak(text) {
  if (DB_VOICE.muted || !text) return;
  // Stop any ongoing speech
  dbStopSpeaking();
  try {
    var res = await fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: text, voice: 'Josh' })
    });
    if (!res.ok) throw new Error('tts failed');
    var blob = await res.blob();
    var url = URL.createObjectURL(blob);
    DB_VOICE.currentAudio = new Audio(url);
    DB_VOICE.currentAudio.onended = function() {
      URL.revokeObjectURL(url);
      DB_VOICE.currentAudio = null;
      // Start listening after speaking (with brief pause)
      setTimeout(dbStartListening, 300);
    };
    await DB_VOICE.currentAudio.play();
  } catch(e) {
    // Fallback: browser speechSynthesis
    if (window.speechSynthesis) {
      var utt = new SpeechSynthesisUtterance(text);
      utt.rate = 1.05;
      utt.pitch = 1;
      utt.onend = function() { setTimeout(dbStartListening, 300); };
      window.speechSynthesis.speak(utt);
    } else {
      // No TTS available — go straight to listening
      setTimeout(dbStartListening, 200);
    }
  }
}

function dbStopSpeaking() {
  if (DB_VOICE.currentAudio) {
    try { DB_VOICE.currentAudio.pause(); } catch(e) {}
    DB_VOICE.currentAudio = null;
  }
  if (window.speechSynthesis) window.speechSynthesis.cancel();
  dbStopListening();
}

function dbStartListening() {
  if (!DB_VOICE.supported || DB_VOICE.muted || DB_VOICE.listening) return;
  var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  var rec = new SR();
  rec.continuous = false;
  rec.interimResults = false;
  rec.lang = 'en-US';
  rec.onstart = function() {
    DB_VOICE.listening = true;
    _dbUpdateVoiceUI(true);
  };
  rec.onend = function() {
    DB_VOICE.listening = false;
    _dbUpdateVoiceUI(false);
    DB_VOICE.recognition = null;
  };
  rec.onerror = function() {
    DB_VOICE.listening = false;
    _dbUpdateVoiceUI(false);
    DB_VOICE.recognition = null;
  };
  rec.onresult = function(e) {
    var transcript = e.results[0][0].transcript.toLowerCase().trim();
    dbHandleVoiceInput(transcript);
  };
  DB_VOICE.recognition = rec;
  try { rec.start(); } catch(e) { DB_VOICE.listening = false; }
}

function dbStopListening() {
  if (DB_VOICE.recognition) {
    try { DB_VOICE.recognition.stop(); } catch(e) {}
    DB_VOICE.recognition = null;
  }
  DB_VOICE.listening = false;
  _dbUpdateVoiceUI(false);
}

function _dbUpdateVoiceUI(isListening) {
  var btn = document.getElementById('db-voice-btn');
  var hint = document.getElementById('db-voice-hint');
  if (btn) btn.classList.toggle('listening', isListening);
  if (hint) {
    hint.textContent = isListening ? 'Listening…' : (DB_VOICE.muted ? 'Voice off' : 'Tap mic or choose below');
    hint.classList.toggle('active', isListening);
  }
}

function dbToggleMic() {
  if (DB_VOICE.listening) {
    dbStopListening();
  } else {
    var step = dbGetActiveSteps()[DB.step];
    if (step) dbStartListening();
  }
}

function dbToggleMute() {
  DB_VOICE.muted = !DB_VOICE.muted;
  dbStopSpeaking();
  var btn = document.getElementById('db-mute-btn');
  if (btn) {
    btn.textContent = DB_VOICE.muted ? '🔇' : '🔊';
    btn.classList.toggle('muted', DB_VOICE.muted);
    btn.title = DB_VOICE.muted ? 'Voice off' : 'Voice on';
  }
  var hint = document.getElementById('db-voice-hint');
  if (hint) hint.textContent = DB_VOICE.muted ? 'Voice off' : 'Tap mic or choose below';
}

// ── Voice → chip matching ────────────────────────────────────────────────────
var DB_VOICE_MAPS = {
  training: function(t) {
    if (/\b(done|complete|finish|nail|all|yes|yeah|great|good|killed|crush)\b/.test(t)) return 'done';
    if (/\b(modif|chang|adjust|partial|some|scale|most|adapt)\b/.test(t)) return 'modified';
    if (/\b(skip|miss|no|not|none|didn|couldn|avoid)\b/.test(t)) return 'skipped';
    if (/\b(rest|off|recover|light|easy)\b/.test(t)) return 'rest';
    return null;
  },
  sleepActual: function(t) {
    var n = _parseNumberWord(t);
    if (n >= 4 && n <= 9) return n;
    return null;
  },
  energy: function(t) {
    var n = _parseNumberWord(t);
    if (n >= 1 && n <= 5) return n;
    if (/\b(great|amazing|fire|five|high|excellent|best)\b/.test(t)) return 5;
    if (/\b(good|four)\b/.test(t)) return 4;
    if (/\b(ok|okay|three|mid|average|so.?so)\b/.test(t)) return 3;
    if (/\b(low|tired|two|poor)\b/.test(t)) return 2;
    if (/\b(wreck|exhaust|one|terrible|awful|dead)\b/.test(t)) return 1;
    return null;
  }
};

function _parseNumberWord(t) {
  var m = t.match(/\b(\d+)\b/);
  if (m) return parseInt(m[1]);
  var words = { one:1, two:2, three:3, four:4, five:5, six:6, seven:7, eight:8, nine:9, ten:10 };
  for (var w in words) { if (t.includes(w)) return words[w]; }
  return null;
}

function dbHandleVoiceInput(transcript) {
  var steps = dbGetActiveSteps();
  var step = steps[DB.step];
  if (!step) return;

  // Notes step — transcribe directly
  if (step.id === 'dayNote') {
    var inp = document.getElementById('db-note-inp');
    if (inp) {
      inp.value = (inp.value ? inp.value + ' ' : '') + transcript;
      inp.style.height = 'auto';
      inp.style.height = Math.min(inp.scrollHeight, 120) + 'px';
    }
    return;
  }

  // Protein step — parse number
  if (step.id === 'proteinActual') {
    var n = _parseNumberWord(transcript);
    if (n && n > 0) {
      var inp2 = document.getElementById('db-prot-inp');
      if (inp2) inp2.value = n;
      setTimeout(function() { dbSaveProtein(); dbNext(); }, 700);
    }
    return;
  }

  // Multi-select — match exercise or supplement names
  if (step.type === 'multi-chips') {
    var chips = document.querySelectorAll('#debrief-body .db-chip');
    chips.forEach(function(chip) {
      var name = (chip.dataset.name || '').toLowerCase();
      if (name && transcript.includes(name.split(' ')[0])) {
        chip.classList.toggle('sel');
        DB.data[step.id] = DB.data[step.id] || [];
        var realName = chip.dataset.name;
        var idx = DB.data[step.id].indexOf(realName);
        if (idx >= 0) DB.data[step.id].splice(idx, 1);
        else DB.data[step.id].push(realName);
      }
    });
    return;
  }

  // Single-select (training, sleep, energy)
  if (step.type === 'opts') {
    var mapper = DB_VOICE_MAPS[step.id];
    if (!mapper) return;
    var match = mapper(transcript);
    if (match === null) return;
    // Highlight the matching chip
    var opts = document.querySelectorAll('#debrief-body .db-opt');
    opts.forEach(function(opt) {
      if (String(opt.dataset.val) === String(match)) {
        opt.classList.add('voice-match', 'sel');
        setTimeout(function() {
          DB.data[step.id] = match;
          dbAutoAdvance();
        }, 700);
      }
    });
  }
}

// ── Core DB state ────────────────────────────────────────────────────────────
var DB = {
  step: 0,
  data: {},
  dismissed: false,
  conversation: [],
  convBusy: false
};

var DB_CONV_MAX_TURNS = 3;

// ── Step definitions ─────────────────────────────────────────────────────────
var DB_STEPS = [
  {
    id: 'training',
    q: 'How did training go?',
    type: 'opts',
    voice: 'How did training go today?',
    opts: [
      { label: '✓  Done — full session', val: 'done' },
      { label: '~  Modified — changed some things', val: 'modified' },
      { label: '✗  Skipped', val: 'skipped' },
      { label: '◌  Rest day', val: 'rest' }
    ],
    condition: function() { return TODAY && TODAY.isTraining; }
  },
  {
    id: 'exercises',
    q: 'Which exercises were affected?',
    sub: 'Select all that were modified or skipped',
    type: 'multi-chips',
    voice: 'Which exercises were affected or skipped?',
    condition: function() {
      return DB.data.training === 'modified' || DB.data.training === 'skipped';
    }
  },
  {
    id: 'suppLog',
    q: 'Supplements today?',
    sub: 'Tap everything you took',
    type: 'multi-chips',
    voice: 'Which supplements did you take today?',
    condition: function() {
      return P && P.supplements && P.supplements.length > 0;
    }
  },
  {
    id: 'proteinActual',
    q: 'Protein today?',
    sub: 'Enter your best estimate if not tracked',
    type: 'protein',
    voice: 'Roughly how many grams of protein did you eat today?',
    condition: function() {
      // Only show if MACROS doesn't already have a logged protein value
      return !(MACROS && MACROS.eaten && MACROS.eaten.prot > 0);
    }
  },
  {
    id: 'sleepActual',
    q: 'Hours of sleep last night?',
    type: 'opts',
    voice: 'How many hours did you sleep last night?',
    opts: [
      { label: '4 hours', val: 4 },
      { label: '5 hours', val: 5 },
      { label: '6 hours', val: 6 },
      { label: '7 hours', val: 7 },
      { label: '8 hours', val: 8 },
      { label: '9+ hours', val: 9 }
    ],
    condition: function() { return !DB.data.sleepActual; }
  },
  {
    id: 'energy',
    q: 'Energy today?',
    sub: '1 = wrecked · 5 = firing on all cylinders',
    type: 'opts',
    voice: 'How was your energy today — one to five?',
    opts: [
      { label: '1 — Wrecked', val: 1 },
      { label: '2 — Low', val: 2 },
      { label: '3 — OK', val: 3 },
      { label: '4 — Good', val: 4 },
      { label: '5 — Firing 🔥', val: 5 }
    ],
    condition: function() { return !DB.data.energy; }
  },
  {
    id: 'dayNote',
    q: 'Anything to note?',
    sub: 'Off-plan food, stress, injury, a win — speak or type. Optional.',
    type: 'text',
    voice: 'Anything to note about today? Speak your answer, or skip.',
    condition: function() { return true; }
  },
  {
    id: 'conversation',
    q: 'Coach check-in',
    sub: 'Talk to your coach — optional but remembered',
    type: 'conversation',
    condition: function() { return true; }
  },
  {
    id: 'summary',
    q: 'Logged.',
    type: 'summary',
    condition: function() { return true; }
  }
];

function dbGetActiveSteps() {
  return DB_STEPS.filter(function(s) { return !s.condition || s.condition(); });
}

// ── Render ───────────────────────────────────────────────────────────────────
function dbRender() {
  var steps = dbGetActiveSteps();
  var step = steps[DB.step];
  if (!step) { dbFinalise(); return; }

  var body = document.getElementById('debrief-body');
  if (!body) return;

  // Progress bar
  var progressHtml = '<div style="display:flex;gap:3px;margin-bottom:22px;">'
    + steps.map(function(_, i) {
        var bg = i < DB.step ? 'var(--jade)' : i === DB.step ? 'rgba(0,200,160,.35)' : 'rgba(255,255,255,.06)';
        return '<div style="height:2px;flex:1;border-radius:2px;background:' + bg + ';transition:background .3s;"></div>';
      }).join('')
    + '</div>';

  // Voice bar (shown on all steps except summary/conversation)
  var voiceBarHtml = '';
  if (DB_VOICE.supported && step.type !== 'summary' && step.type !== 'conversation') {
    var hintText = DB_VOICE.muted ? 'Voice off' : 'Tap mic or choose below';
    voiceBarHtml = '<div class="db-voice-bar">'
      + '<button class="db-voice-btn' + (DB_VOICE.muted ? ' muted' : '') + '" id="db-voice-btn" onclick="dbToggleMic()" title="Tap to speak">🎙</button>'
      + '<span class="db-voice-hint" id="db-voice-hint">' + hintText + '</span>'
      + '</div>';
  }

  var html = '<div class="db-step">' + progressHtml;
  html += voiceBarHtml;
  html += '<div class="db-q">' + step.q + '</div>';
  if (step.sub) html += '<div class="db-sub">' + step.sub + '</div>';

  // ── Single-select options (auto-advance on tap) ───────────────
  if (step.type === 'opts') {
    html += '<div class="db-opts">';
    step.opts.forEach(function(o) {
      var isSel = DB.data[step.id] === o.val;
      html += '<button class="db-opt' + (isSel ? ' sel' : '') + '" data-val="' + o.val + '" '
        + 'onclick="dbSelectOpt(\'' + step.id + '\',' + JSON.stringify(o.val) + ',this)">'
        + o.label + '</button>';
    });
    html += '</div>';

  // ── Multi-select chips (exercises or supplements) ─────────────
  } else if (step.type === 'multi-chips') {
    var items = [];
    if (step.id === 'exercises') {
      var trainBlock = (window._blocks || []).find(function(b) { return b.type === 'train'; });
      items = trainBlock ? (trainBlock.items || [])
        .filter(function(e) { return e.name && e.name !== 'Track loads'; })
        .map(function(e) { return e.name; }) : [];
    } else if (step.id === 'suppLog') {
      items = (P && P.supplements || []).map(function(s) { return s.name || s; });
    }
    if (!DB.data[step.id]) DB.data[step.id] = [];
    html += '<div class="db-chip-grid">';
    items.forEach(function(name) {
      var isSel = DB.data[step.id].indexOf(name) >= 0;
      html += '<button class="db-chip' + (isSel ? ' sel' : '') + '" data-name="' + name.replace(/"/g, '&quot;') + '" '
        + 'onclick="dbToggleChip(\'' + step.id + '\',this)">' + name + '</button>';
    });
    if (items.length === 0) {
      html += '<div style="color:var(--dk-3);font-size:13px;padding:8px 0;">Nothing to select — tap Continue</div>';
    }
    html += '</div>';
    if (step.id === 'exercises') {
      html += '<textarea class="db-note" id="db-ex-note" rows="2" placeholder="What happened? (optional)">'
        + (DB.data.exNote || '') + '</textarea>';
    }
    html += '<button class="db-next-btn" onclick="dbSaveMulti(\'' + step.id + '\');dbNext()">Continue →</button>';
    html += '<div class="db-skip-link"><button onclick="dbNext()">Skip</button></div>';

  // ── Protein estimate ──────────────────────────────────────────
  } else if (step.type === 'protein') {
    var target = P && P.protein ? P.protein : 174;
    html += '<div class="db-prot-row">'
      + '<input type="number" class="db-prot-inp" id="db-prot-inp" min="0" max="400" '
      + 'placeholder="' + target + '" inputmode="numeric" '
      + 'value="' + (DB.data.proteinActual || '') + '">'
      + '<span class="db-prot-unit">g</span>'
      + '</div>';
    // Quick-tap presets
    var presets = [Math.round(target * 0.7), Math.round(target * 0.85), target, Math.round(target * 1.1)];
    html += '<div class="db-chip-grid">' + presets.map(function(p) {
      return '<button class="db-chip" onclick="document.getElementById(\'db-prot-inp\').value=' + p + '">' + p + 'g</button>';
    }).join('') + '</div>';
    html += '<button class="db-next-btn" onclick="dbSaveProtein();dbNext()">Continue →</button>';
    html += '<div class="db-skip-link"><button onclick="dbNext()">Skip</button></div>';

  // ── Free text / voice note ────────────────────────────────────
  } else if (step.type === 'text') {
    html += '<textarea class="db-note" id="db-note-inp" rows="3" placeholder="Speak or type…">'
      + (DB.data[step.id] || '') + '</textarea>';
    if (DB_VOICE.supported) {
      html += '<div style="margin-bottom:12px;"><button class="db-voice-btn" onclick="dbToggleMic()" id="db-voice-btn" '
        + 'title="Tap and speak your note" style="margin:0 auto;display:block;">'
        + (DB_VOICE.listening ? '⏹' : '🎙') + '</button></div>';
    }
    html += '<button class="db-next-btn" onclick="dbSaveNote();dbNext()">Done →</button>';
    html += '<div class="db-skip-link"><button onclick="dbNext()">Skip</button></div>';

  // ── AI Coach conversation ─────────────────────────────────────
  } else if (step.type === 'conversation') {
    var msgsHtml = DB.conversation.map(function(m) {
      return '<div class="db-conv-msg ' + m.role + '">'
        + m.content.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
        + '</div>';
    }).join('');
    if (DB.conversation.length === 0) {
      msgsHtml = '<div class="db-conv-msg thinking">Reading your day…</div>';
    }
    html += '<div class="db-conv-msgs" id="db-conv-msgs">' + msgsHtml + '</div>'
      + '<div class="db-conv-input-row">'
      + '<textarea id="db-conv-inp" class="db-conv-input" placeholder="What happened? Or skip." rows="1" '
      + 'onkeydown="if(event.key===\'Enter\'&&!event.shiftKey){event.preventDefault();dbConvSend();}" '
      + 'oninput="this.style.height=\'auto\';this.style.height=Math.min(this.scrollHeight,100)+\'px\';"></textarea>'
      + '<button class="db-conv-send" id="db-conv-send" onclick="dbConvSend()">&#9654;</button>'
      + '</div>'
      + '<div class="db-conv-skip-link"><button onclick="dbConvDone()">Done — save my day &rarr;</button></div>';

  // ── Summary ───────────────────────────────────────────────────
  } else if (step.type === 'summary') {
    dbWriteToLog();
    var log = loadDayLog(_rDate) || {};
    html += _buildSummaryHtml(log);
    html += '<button class="db-next-btn" onclick="closeDebrief();if(typeof renderDayCapture===\'function\')renderDayCapture();">Done</button>';
  }

  html += '</div>';
  body.innerHTML = html;

  // Auto-speak question and start listening
  if (step.voice && step.type !== 'summary' && step.type !== 'conversation') {
    dbSpeak(step.voice);
  }

  // Auto-init conversation
  if (step.type === 'conversation' && DB.conversation.length === 0 && !DB.convBusy) {
    dbConvInit();
  }
}

function _buildSummaryHtml(log) {
  var rows = [];

  // Training
  if (log.trainStatus && log.trainStatus !== 'pending') {
    var tVal = { done: '✓ Done', modified: '~ Modified', skipped: '✗ Skipped', rest: '◌ Rest' }[log.trainStatus] || log.trainStatus;
    var tCls = log.trainStatus === 'done' ? 'good' : log.trainStatus === 'skipped' ? 'warn' : '';
    rows.push({ key: 'Training', val: tVal, cls: tCls });
  }

  // Exercises affected
  if (DB.data.exercises && DB.data.exercises.length) {
    rows.push({ key: 'Exercises affected', val: DB.data.exercises.join(', '), cls: 'warn' });
  }

  // Supplements
  if (DB.data.suppLog && DB.data.suppLog.length) {
    rows.push({ key: 'Supplements', val: DB.data.suppLog.join(', '), cls: 'good' });
  } else if (log.suppLog) {
    var taken = Object.keys(log.suppLog).filter(function(k) { return log.suppLog[k]; });
    if (taken.length) rows.push({ key: 'Supplements', val: taken.join(', '), cls: 'good' });
  }

  // Protein
  var prot = (MACROS && MACROS.eaten && MACROS.eaten.prot) || DB.data.proteinActual || log.actual && log.actual.prot;
  if (prot > 0) {
    var target = P && P.protein ? P.protein : 174;
    var protPct = Math.round(prot / target * 100);
    var protCls = protPct >= 90 ? 'good' : protPct >= 70 ? '' : 'warn';
    rows.push({ key: 'Protein', val: prot + 'g (' + protPct + '% of target)', cls: protCls });
  }

  // Sleep
  if (log.sleepActual) {
    var sleepCls = log.sleepActual >= 7.5 ? 'good' : log.sleepActual >= 6 ? '' : 'warn';
    rows.push({ key: 'Sleep', val: log.sleepActual + ' hours', cls: sleepCls });
  }

  // Energy
  if (log.energy) {
    var energyCls = log.energy >= 4 ? 'good' : log.energy >= 3 ? '' : 'warn';
    rows.push({ key: 'Energy', val: log.energy + ' / 5', cls: energyCls });
  }

  // Note
  if (log.dayNote) {
    rows.push({ key: 'Note', val: '\u201c' + log.dayNote.slice(0, 60) + (log.dayNote.length > 60 ? '\u2026' : '') + '\u201d', cls: '' });
  }

  if (rows.length === 0) {
    return '<div class="db-summary-grid"><div style="color:var(--dk-3);font-size:13px;padding:16px 0;">Nothing logged yet.</div></div>';
  }

  return '<div class="db-summary-grid">'
    + rows.map(function(r) {
        return '<div class="db-sum-row">'
          + '<span class="db-sum-key">' + r.key + '</span>'
          + '<span class="db-sum-val ' + (r.cls || 'muted') + '">' + r.val + '</span>'
          + '</div>';
      }).join('')
    + '</div>';
}

// ── Interaction handlers ─────────────────────────────────────────────────────
function dbSelectOpt(field, val, el) {
  DB.data[field] = val;
  el.closest('.db-opts').querySelectorAll('.db-opt').forEach(function(o) {
    o.classList.remove('sel', 'voice-match');
  });
  el.classList.add('sel');
  // Auto-advance after brief visual confirmation
  dbAutoAdvance();
}

function dbAutoAdvance() {
  dbStopListening();
  setTimeout(function() { dbNext(); }, 380);
}

function dbToggleChip(field, el) {
  if (!DB.data[field]) DB.data[field] = [];
  var name = el.dataset.name;
  var idx = DB.data[field].indexOf(name);
  if (idx >= 0) DB.data[field].splice(idx, 1);
  else DB.data[field].push(name);
  el.classList.toggle('sel', DB.data[field].indexOf(name) >= 0);
}

function dbSaveMulti(field) {
  if (field === 'exercises') {
    var noteInp = document.getElementById('db-ex-note');
    if (noteInp) DB.data.exNote = noteInp.value.trim();
  }
  // suppLog is just stored in DB.data.suppLog array for now; written to log in dbWriteToLog
}

function dbSaveProtein() {
  var inp = document.getElementById('db-prot-inp');
  if (inp && inp.value) {
    var n = parseInt(inp.value, 10);
    if (!isNaN(n) && n > 0) DB.data.proteinActual = n;
  }
}

function dbSaveNote() {
  var inp = document.getElementById('db-note-inp');
  if (inp) DB.data.dayNote = inp.value.trim();
}

function dbNext() {
  dbStopSpeaking();
  DB.step++;
  var steps = dbGetActiveSteps();
  if (DB.step >= steps.length) {
    dbFinalise();
    return;
  }
  dbRender();
}

// ── Write to localStorage ────────────────────────────────────────────────────
function dbWriteToLog() {
  var log = loadDayLog(_rDate) || initDayLog();

  // Core fields
  if (DB.data.training)     log.trainStatus  = DB.data.training;
  if (DB.data.sleepActual)  log.sleepActual  = DB.data.sleepActual;
  if (DB.data.energy)       log.energy       = DB.data.energy;
  if (DB.data.dayNote)      log.dayNote      = DB.data.dayNote;

  // Debrief conversation
  if (DB.data.conversation) log.conversation = DB.data.conversation;
  if (DB.conversation && DB.conversation.length) {
    log.debriefChat = DB.conversation;
  }

  // Affected exercises
  if (DB.data.exercises && DB.data.exercises.length) {
    if (!log.exercises) log.exercises = {};
    DB.data.exercises.forEach(function(name) {
      log.exercises['ex_' + name.replace(/\s+/g,'_').toLowerCase()] = {
        name: name,
        status: DB.data.training === 'skipped' ? 'skipped' : 'modified',
        note: DB.data.exNote || ''
      };
    });
  }

  // Supplement log — merge with existing
  if (DB.data.suppLog && DB.data.suppLog.length) {
    if (!log.suppLog) log.suppLog = {};
    // Mark selected supps as taken; leave unselected as-is
    DB.data.suppLog.forEach(function(name) { log.suppLog[name] = true; });
    // Mark unselected supps as not taken (only if we actually showed the step)
    var allSupps = (P && P.supplements || []).map(function(s) { return s.name || s; });
    allSupps.forEach(function(name) {
      if (DB.data.suppLog.indexOf(name) < 0 && log.suppLog[name] === undefined) {
        log.suppLog[name] = false;
      }
    });
  }

  // Protein — write to MACROS if not already tracked
  if (DB.data.proteinActual && MACROS) {
    if (!MACROS.eaten) MACROS.eaten = {};
    if (!(MACROS.eaten.prot > 0)) {
      MACROS.eaten.prot = DB.data.proteinActual;
      saveMacros();
    }
  }

  saveDayLog(log);
  if (typeof renderUnifiedHeader === 'function') renderUnifiedHeader(P, TODAY);
}

// ── Conversation step (AI coach) ─────────────────────────────────────────────
async function dbConvInit() {
  DB.conversation = [];
  DB.convBusy = true;

  var p = P;
  var log = loadDayLog(_rDate) || {};
  var snapshot = buildDaySnapshot(log, p);

  var ctx = [];
  if (DB.data.training) ctx.push('Training: ' + DB.data.training);
  if (DB.data.exercises && DB.data.exercises.length) ctx.push('Exercises affected: ' + DB.data.exercises.join(', '));
  if (DB.data.sleepActual) ctx.push('Sleep: ' + DB.data.sleepActual + 'h');
  if (DB.data.energy) ctx.push('Energy: ' + DB.data.energy + '/5');
  if (DB.data.proteinActual) ctx.push('Protein: ' + DB.data.proteinActual + 'g');
  if (DB.data.dayNote) ctx.push('Note: "' + DB.data.dayNote + '"');

  var mem = loadBehaviourMemory();
  var memCtx = mem && mem.currentFlags && mem.currentFlags.length
    ? '\nCurrent flags: ' + mem.currentFlags.join(', ') : '';

  var prompt = 'You are ' + p.name + '\'s performance coach. End-of-day check-in.\n\n'
    + 'LOGGED TODAY:\n' + ctx.join('\n') + '\n\n'
    + 'RAW DATA:\n' + snapshot
    + memCtx + '\n\n'
    + 'One short direct sentence acknowledging the most significant thing. Then ONE specific question. '
    + 'Max 40 words. Warm but direct. No cheerleading.';

  try {
    var res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: MODEL_FAST,
        max_tokens: 100,
        system: 'Direct, warm performance coach. Short responses only. No markdown.',
        messages: [{ role: 'user', content: prompt }]
      })
    });
    var data = await res.json();
    var text = (data.content || []).map(function(b) { return b.text || ''; }).join('').trim();
    DB.conversation.push({ role: 'coach', content: text });
  } catch(e) {
    DB.conversation.push({ role: 'coach', content: 'How did the day actually feel — what\'s the story?' });
  }

  DB.convBusy = false;
  dbRender();
  setTimeout(function() {
    var msgs = document.getElementById('db-conv-msgs');
    if (msgs) msgs.scrollTop = msgs.scrollHeight;
  }, 50);
}

async function dbConvSend() {
  if (DB.convBusy) return;
  var inp = document.getElementById('db-conv-inp');
  if (!inp) return;
  var text = inp.value.trim();
  if (!text) { dbConvDone(); return; }

  DB.conversation.push({ role: 'user', content: text });
  inp.value = '';
  inp.style.height = 'auto';

  var userTurns = DB.conversation.filter(function(m) { return m.role === 'user'; }).length;
  if (userTurns >= DB_CONV_MAX_TURNS) { dbConvDone(); return; }

  DB.conversation.push({ role: 'coach', content: '&#8943;' });
  dbRender();
  var msgs = document.getElementById('db-conv-msgs');
  if (msgs) msgs.scrollTop = msgs.scrollHeight;

  DB.convBusy = true;
  var send = document.getElementById('db-conv-send');
  if (send) send.disabled = true;

  var messages = DB.conversation.slice(0, -1).map(function(m) {
    return { role: m.role === 'coach' ? 'assistant' : 'user', content: m.content };
  });
  messages.push({ role: 'user', content: text });

  try {
    var res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: MODEL_FAST,
        max_tokens: 80,
        system: 'Direct warm performance coach. Under 30 words. One question or observation max.',
        messages: messages
      })
    });
    var data = await res.json();
    var reply = (data.content || []).map(function(b) { return b.text || ''; }).join('').trim();
    DB.conversation[DB.conversation.length - 1] = { role: 'coach', content: reply };
  } catch(e) {
    DB.conversation[DB.conversation.length - 1] = { role: 'coach', content: 'Got it.' };
  }

  DB.convBusy = false;
  dbRender();
  setTimeout(function() {
    var msgs2 = document.getElementById('db-conv-msgs');
    if (msgs2) msgs2.scrollTop = msgs2.scrollHeight;
    if (send) send.disabled = false;
  }, 50);
}

function dbConvDone() {
  DB.data.conversation = DB.conversation
    .filter(function(m) { return m.role === 'user'; })
    .map(function(m) { return m.content; })
    .join(' | ');
  dbNext();
}

// ── Finalise (save + compress + close) ──────────────────────────────────────
async function dbFinalise() {
  dbWriteToLog();
  closeDebrief();

  var p = P;
  var log = loadDayLog(_rDate) || {};
  if (!p || !log.date) return;

  try {
    var result = await compressAndSaveMemory(log, p);
    if (result && result.newFlags && result.newFlags.length) {
      var glanceCard = document.querySelector('.glance-card');
      if (glanceCard && typeof renderGlanceCard === 'function' && window._lastPlan) {
        glanceCard.outerHTML = renderGlanceCard(P, TODAY, window._lastPlan);
      }
    }
  } catch(e) {}
}

// ── openDebrief / closeDebrief ───────────────────────────────────────────────
function openDebrief() {
  dismissDebrief();
  DB.step = 0;
  DB.data = {};
  DB.conversation = [];
  DB.convBusy = false;

  // Pre-populate from existing log
  var log = loadDayLog(_rDate) || {};
  if (log.trainStatus && log.trainStatus !== 'pending') DB.data.training = log.trainStatus;
  if (log.sleepActual) DB.data.sleepActual = log.sleepActual;
  if (log.energy) DB.data.energy = log.energy;
  if (log.dayNote) DB.data.dayNote = log.dayNote;

  // Pre-populate suppLog from day log
  if (log.suppLog) {
    DB.data.suppLog = Object.keys(log.suppLog).filter(function(k) { return log.suppLog[k]; });
  }

  document.getElementById('debrief-overlay').classList.add('open');
  dbRender();
}

function closeDebrief() {
  dbStopSpeaking();
  document.getElementById('debrief-overlay').classList.remove('open');
}

// ═══════════════════════════════════════════════════════════════
//  NOTIFICATION ENGINE
// ═══════════════════════════════════════════════════════════════
var NT = { timers: {}, requested: false };

function ntGetPrefs() {
  try {
    var p = JSON.parse(localStorage.getItem('bl_profile') || '{}');
    return Object.assign({ enabled: false, postMealWalk: true, trainingReminder: true, debrief: true, quietStart: 22, quietEnd: 7 }, p.notifications || {});
  } catch(e) { return { enabled: false }; }
}

function ntInQuietHours() {
  var prefs = ntGetPrefs();
  if (!prefs.quietStart && !prefs.quietEnd) return false;
  var hour = new Date().getHours();
  var start = parseInt(prefs.quietStart) || 22;
  var end   = parseInt(prefs.quietEnd)   || 7;
  if (start > end) return hour >= start || hour < end;
  return hour >= start && hour < end;
}

function ntShow(title, body, actions) {
  if (!ntGetPrefs().enabled) return;
  if (ntInQuietHours()) return;
  var toast = document.getElementById('notif-toast');
  if (!toast) return;
  var id = 'nt-' + Date.now();
  var actHtml = (actions || []).map(function(a) {
    return '<button class="nt-btn' + (a.primary ? ' primary' : '') + '" onclick="ntAction(\'' + id + '\',function(){' + a.fn + '})">' + a.label + '</button>';
  }).join('');
  var el = document.createElement('div');
  el.className = 'nt-item'; el.id = id;
  el.innerHTML = '<div class="nt-title">' + title + '</div>'
    + '<div class="nt-body">' + body + '</div>'
    + '<div class="nt-actions">' + actHtml
    + '<button class="nt-btn" onclick="ntDismiss(\'' + id + '\')">Dismiss</button></div>';
  toast.appendChild(el);
  setTimeout(function() { ntDismiss(id); }, 12000);
  if (Notification && Notification.permission === 'granted') {
    try { new Notification(title, { body: body, icon: '/icons/icon-192.png' }); } catch(e) {}
  }
}

function ntDismiss(id) { var el = document.getElementById(id); if (el) el.remove(); }
function ntAction(id, fn) { ntDismiss(id); try { fn(); } catch(e) {} }

function ntRequestPermission() {
  if (NT.requested) return;
  NT.requested = true;
  if (Notification && Notification.permission === 'default') {
    Notification.requestPermission().catch(function(){});
  }
}

function ntScheduleDay() {
  var prefs = ntGetPrefs();
  if (!prefs.enabled) return;
  ntRequestPermission();
  var now = new Date(), hour = now.getHours();

  if (prefs.trainingReminder && TODAY && TODAY.isTraining && hour < 9) {
    var msTo9am = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 9, 0, 0) - now;
    if (msTo9am > 0) {
      NT.timers.training = setTimeout(function() {
        var log = loadDayLog(_rDate);
        if (!log || log.trainStatus === 'pending') {
          ntShow('Ready when you are 🏋️', (TODAY.plan && TODAY.plan.type || 'Training') + ' day. Your session is loaded.', [
            { label: 'Open today', primary: true, fn: 'window.scrollTo({top:0,behavior:"smooth"})' }
          ]);
        }
      }, msTo9am);
    }
  }

  if (prefs.debrief && hour < 20) {
    var msTo8pm = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 20, 0, 0) - now;
    if (msTo8pm > 0) {
      NT.timers.debrief = setTimeout(function() {
        var log = loadDayLog(_rDate);
        var missing = !log || !log.sleepActual || !log.energy || (TODAY && TODAY.isTraining && log.trainStatus === 'pending');
        if (missing) {
          ntShow('Quick log before you sleep?', 'A couple of taps — keeps your week review meaningful.', [
            { label: 'Log now', primary: true, fn: 'openDebrief()' }
          ]);
          checkDebriefNeeded();
        }
      }, msTo8pm);
    }
  }
}

window.ntPostMealWalk = function() {
  var prefs = ntGetPrefs();
  if (!prefs.enabled || !prefs.postMealWalk) return;
  if (ntInQuietHours()) return;
  setTimeout(function() {
    ntShow('Good time for a short walk 🚶', '10–20 minutes now drops blood glucose by up to 30%.', [
      { label: 'Done ✓', primary: true, fn: 'void(0)' },
      { label: 'Remind in 1h', fn: 'setTimeout(function(){ntShow("Walk reminder","Still time for that post-meal walk 🚶",[{label:"Done",primary:true,fn:"void(0)"}])},3600000)' }
    ]);
  }, 20 * 60 * 1000);
};

setTimeout(function() {
  checkDebriefNeeded();
  ntScheduleDay();
}, 3000);

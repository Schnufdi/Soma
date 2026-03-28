// BodyLens — Debrief + Notification Engine
// Extracted from bodylens-dailyplan.html
// Contains: DB object, DB_STEPS, dbRender, dbNext, dbWriteToLog, nt* notifications
// Depends on: P, TODAY, _rDate, loadDayLog, saveDayLog (globals)

// ── DEBRIEF CONVERSATION ENGINE ───────────────────────────────────────
// Fires on load of conversation step: AI reads the day and opens with
// a context-aware question. User can respond 1-2 times before finishing.
// All turns get passed to compressAndSaveMemory so the memory is rich.

var DB_CONV_MAX_TURNS = 3; // max user turns before auto-Done

async function dbConvInit() {
  // Called when conversation step first renders
  DB.conversation = [];
  DB.convBusy = true;

  var p = P;
  var log = loadDayLog(_rDate) || {};
  var snapshot = buildDaySnapshot(log, p);

  // Build context from DB.data (what was entered in chips/text)
  var ctx = [];
  if (DB.data.trainStatus) ctx.push('Training: ' + DB.data.trainStatus);
  if (DB.data.affectedExercises && DB.data.affectedExercises.length) {
    ctx.push('Exercises affected: ' + DB.data.affectedExercises.join(', '));
  }
  if (DB.data.sleepActual) ctx.push('Sleep: ' + DB.data.sleepActual + 'h');
  if (DB.data.energy) ctx.push('Energy: ' + DB.data.energy + '/5');
  if (DB.data.dayNote) ctx.push('Note: "' + DB.data.dayNote + '"');

  var mem = loadBehaviourMemory();
  var memCtx = mem && mem.currentFlags && mem.currentFlags.length
    ? '\nCurrent flags from history: ' + mem.currentFlags.join(', ')
    : '';

  var prompt = 'You are ' + p.name + '\'s performance coach. They just finished their end-of-day log.\n\n'
    + 'WHAT THEY LOGGED TODAY:\n' + ctx.join('\n') + '\n\n'
    + 'RAW DATA:\n' + snapshot
    + memCtx + '\n\n'
    + 'Open with ONE short, direct sentence acknowledging the most significant thing about today. '
    + 'Then ask ONE specific question to get the story behind it — especially if something was skipped or energy was low. '
    + 'Max 40 words total. Warm but direct. No fluff. No "Great job!" if they had a rough day.';

  try {
    var res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: MODEL_FAST,
        max_tokens: 100,
        system: 'You are a direct, warm performance coach. Short responses only. No markdown.',
        messages: [{ role: 'user', content: prompt }]
      })
    });
    var data = await res.json();
    var text = (data.content||[]).map(function(b){return b.text||'';}).join('').trim();
    DB.conversation.push({ role: 'coach', content: text });
  } catch(e) {
    DB.conversation.push({ role: 'coach', content: 'How did the day actually feel \u2014 what\'s the story?' });
  }

  DB.convBusy = false;
  dbRender(); // re-render with the coach message
  // Scroll messages to bottom
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

  // Count user turns
  var userTurns = DB.conversation.filter(function(m){return m.role==='user';}).length;
  if (userTurns >= DB_CONV_MAX_TURNS) {
    dbConvDone();
    return;
  }

  // Re-render with user message + thinking indicator
  DB.conversation.push({ role: 'coach', content: '&#8943;' });
  dbRender();
  var msgs = document.getElementById('db-conv-msgs');
  if (msgs) msgs.scrollTop = msgs.scrollHeight;

  // Get coach reply
  DB.convBusy = true;
  var send = document.getElementById('db-conv-send');
  if (send) send.disabled = true;

  var p = P;
  var messages = DB.conversation.slice(0,-1).map(function(m) {
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
        system: 'You are a direct, warm performance coach doing an end-of-day check-in. Keep responses under 30 words. One question or observation max. No lists. No markdown.',
        messages: messages
      })
    });
    var data = await res.json();
    var reply = (data.content||[]).map(function(b){return b.text||'';}).join('').trim();
    // Replace the thinking indicator
    DB.conversation[DB.conversation.length-1] = { role: 'coach', content: reply };
  } catch(e) {
    DB.conversation[DB.conversation.length-1] = { role: 'coach', content: 'Got it.' };
  }

  DB.convBusy = false;
  dbRender();
  setTimeout(function() {
    var msgs = document.getElementById('db-conv-msgs');
    if (msgs) msgs.scrollTop = msgs.scrollHeight;
    if (send) send.disabled = false;
  }, 50);
}

function dbConvDone() {
  // Store conversation in DB.data so compressAndSaveMemory gets it
  DB.data.conversation = DB.conversation
    .filter(function(m){ return m.role === 'user'; })
    .map(function(m){ return m.content; })
    .join(' | ');
  dbNext();
}

var DB_STEPS = [
  {
    id: 'training',
    q: 'How did training go?',
    sub: null,
    type: 'chips',
    chips: [
      { label: '✓ Done', val: 'done' },
      { label: '~ Modified', val: 'modified' },
      { label: '✗ Skipped', val: 'skipped' },
      { label: 'Rest day', val: 'rest' }
    ],
    skip: true,
    condition: function() { return TODAY.isTraining; }
  },
  {
    id: 'exercises',
    q: 'Which exercises were affected?',
    sub: 'Select all that were modified or skipped',
    type: 'ex-chips',
    skip: true,
    condition: function() { return DB.data.trainStatus === 'modified' || DB.data.trainStatus === 'skipped'; }
  },
  {
    id: 'sleepActual',
    q: 'How many hours did you sleep?',
    sub: 'Last night',
    type: 'chips',
    chips: [
      { label: '4h', val: 4 },
      { label: '5h', val: 5 },
      { label: '6h', val: 6 },
      { label: '7h', val: 7 },
      { label: '8h', val: 8 },
      { label: '9h+', val: 9 }
    ],
    skip: true,
    condition: function() { return !DB.data.sleepActual; }
  },
  {
    id: 'energy',
    q: 'Energy today?',
    sub: '1 = wrecked · 5 = firing',
    type: 'chips',
    chips: [
      { label: '1', val: 1 },
      { label: '2', val: 2 },
      { label: '3', val: 3 },
      { label: '4', val: 4 },
      { label: '5 🔥', val: 5 }
    ],
    skip: true,
    condition: function() { return !DB.data.energy; }
  },
  {
    id: 'dayNote',
    q: 'Anything to note?',
    sub: 'Off-plan food, stress, injury, a win — optional',
    type: 'text',
    skip: true,
    condition: function() { return true; }
  },
  {
    id: 'conversation',
    q: 'Anything else on your mind?',
    sub: 'Talk to your coach — optional but remembered',
    type: 'conversation',
    skip: true,
    condition: function() { return true; }
  },
  {
    id: 'summary',
    q: 'Logged.',
    sub: null,
    type: 'summary',
    condition: function() { return true; }
  }
];

function dbGetActiveSteps() {
  return DB_STEPS.filter(function(s) { return !s.condition || s.condition(); });
}

function dbRender() {
  var steps = dbGetActiveSteps();
  var step = steps[DB.step];
  if (!step) { closeDebrief(); return; }

  var body = document.getElementById('debrief-body');
  if (!body) return;

  var html = '<div class="db-step">';
  html += '<div class="gc-progress-dots" style="display:flex;gap:4px;margin-bottom:20px;">'
    + steps.map(function(_, i) {
        return '<div style="height:2px;flex:1;border-radius:2px;background:' + (i < DB.step ? 'var(--jade)' : i === DB.step ? 'rgba(0,200,160,.4)' : 'rgba(255,255,255,.06)') + ';"></div>';
      }).join('')
    + '</div>';

  html += '<div class="db-q">' + step.q + '</div>';
  if (step.sub) html += '<div class="db-sub">' + step.sub + '</div>';

  if (step.type === 'chips') {
    html += '<div class="db-chips">';
    step.chips.forEach(function(c) {
      var isSel = DB.data[step.id] === c.val;
      html += '<div class="db-chip' + (isSel ? ' sel' : '') + '" onclick="dbSelectChip(\'' + step.id + '\',' + JSON.stringify(c.val) + ',this)">' + c.label + '</div>';
    });
    html += '</div>';
    html += '<button class="db-next-btn" onclick="dbNext()">Continue →</button>';
    if (step.skip) html += '<button class="db-skip-btn" onclick="dbSkip()">Skip</button>';

  } else if (step.type === 'ex-chips') {
    var exercises = (window._blocks || []).find(function(b){ return b.type === 'train'; });
    var exList = exercises ? (exercises.items || []).filter(function(e){ return e.name !== 'Track loads'; }) : [];
    if (!DB.data.affectedExercises) DB.data.affectedExercises = [];
    html += '<div class="db-chips">';
    exList.forEach(function(ex) {
      var name = ex.name || '';
      var isSel = DB.data.affectedExercises.indexOf(name) >= 0;
      html += '<div class="db-chip' + (isSel ? ' sel' : '') + '" onclick="dbToggleEx(\'' + name.replace(/'/g, "\\'") + '\',this)">' + name + '</div>';
    });
    html += '</div>';
    html += '<div style="margin-top:8px;">'
      + '<textarea class="db-note-inp" id="db-ex-note" rows="2" placeholder="What happened? — optional">' + (DB.data.exNote||'') + '</textarea>'
      + '</div>';
    html += '<button class="db-next-btn" style="margin-top:12px;" onclick="dbSaveExNote();dbNext()">Continue →</button>';
    if (step.skip) html += '<button class="db-skip-btn" onclick="dbSkip()">Skip</button>';

  } else if (step.type === 'text') {
    html += '<textarea class="db-note-inp" id="db-note-inp" rows="3" placeholder="Optional…">' + (DB.data[step.id]||'') + '</textarea>';
    html += '<button class="db-next-btn" style="margin-top:12px;" onclick="dbSaveNote();dbNext()">Done →</button>';
    if (step.skip) html += '<button class="db-skip-btn" onclick="dbSkip()">Skip</button>';

  } else if (step.type === 'conversation') {
    var msgsHtml = DB.conversation.map(function(m) {
      return '<div class="db-conv-msg ' + m.role + '">' + m.content.replace(/</g,'&lt;').replace(/>/g,'&gt;') + '</div>';
    }).join('');
    if (DB.conversation.length === 0) {
      msgsHtml = '<div class="db-conv-msg thinking">&#8943; Coach is reading your day&#8230;</div>';
    }
    html += '<div class="db-conv-msgs" id="db-conv-msgs">' + msgsHtml + '</div>'
      + '<div class="db-conv-input-row">'
      + '<textarea id="db-conv-inp" class="db-conv-input" placeholder="What happened? Or skip." rows="1" '
      + 'onkeydown="if(event.key===\'Enter\'&&!event.shiftKey){event.preventDefault();dbConvSend();}" '
      + 'oninput="this.style.height=\'auto\';this.style.height=Math.min(this.scrollHeight,100)+\'px\';"></textarea>'
      + '<button class="db-conv-send" id="db-conv-send" onclick="dbConvSend()">&#9654;</button>'
      + '</div>'
      + '<div class="db-conv-skip-link"><button onclick="dbConvDone()">Done — log my day &rarr;</button></div>';

  } else if (step.type === 'summary') {
    // Write to daylog first
    dbWriteToLog();
    html += '<div class="db-summary">';
    var rows = [
      { key: 'Training', val: DB.data.trainStatus || '—' },
      { key: 'Sleep', val: DB.data.sleepActual ? DB.data.sleepActual + 'h' : '—' },
      { key: 'Energy', val: DB.data.energy ? DB.data.energy + '/5' : '—' },
      { key: 'Note', val: DB.data.dayNote ? '"' + DB.data.dayNote.slice(0,40) + '"' : '—' }
    ];
    rows.forEach(function(r) {
      html += '<div class="db-summary-row"><span class="db-summary-key">' + r.key + '</span><span class="db-summary-val">' + r.val + '</span></div>';
    });
    html += '</div>';
    html += '<button class="db-next-btn" onclick="closeDebrief();renderDayCapture();">Done</button>';
  }

  html += '</div>';
  body.innerHTML = html;

  // Auto-init conversation step
  if (step && step.type === 'conversation' && DB.conversation.length === 0 && !DB.convBusy) {
    dbConvInit();
  }
}

function dbSelectChip(field, val, el) {
  DB.data[field] = val;
  el.closest('.db-chips').querySelectorAll('.db-chip').forEach(function(c) { c.classList.remove('sel'); });
  el.classList.add('sel');
}

function dbToggleEx(name, el) {
  if (!DB.data.affectedExercises) DB.data.affectedExercises = [];
  var idx = DB.data.affectedExercises.indexOf(name);
  if (idx >= 0) DB.data.affectedExercises.splice(idx, 1);
  else DB.data.affectedExercises.push(name);
  el.classList.toggle('sel', DB.data.affectedExercises.indexOf(name) >= 0);
}

function dbSaveNote() {
  var inp = document.getElementById('db-note-inp');
  if (inp) DB.data.dayNote = inp.value.trim();
}

function dbSaveExNote() {
  var inp = document.getElementById('db-ex-note');
  if (inp) DB.data.exNote = inp.value.trim();
}

function dbNext() {
  DB.step++;
  var steps = dbGetActiveSteps();
  if (DB.step >= steps.length) {
    // Last step done — finalise (save + compress + close)
    dbFinalise();
    return;
  }
  dbRender();
}

function dbSkip() {
  dbNext();
}

function dbWriteToLog() {
  var log = loadDayLog(_rDate) || initDayLog();
  if (DB.data.trainStatus)  log.trainStatus  = DB.data.trainStatus;
  if (DB.data.sleepActual)  log.sleepActual  = DB.data.sleepActual;
  if (DB.data.energy)       log.energy       = DB.data.energy;
  if (DB.data.dayNote)      log.dayNote      = DB.data.dayNote;
  // Save debrief conversation so it persists and feeds future memory reads
  if (DB.data.conversation)  log.conversation  = DB.data.conversation;
  if (DB.conversation && DB.conversation.length) {
    log.debriefChat = DB.conversation; // full turns for rich future reference
  }

  // Write affected exercises
  if (DB.data.affectedExercises && DB.data.affectedExercises.length) {
    if (!log.exercises) log.exercises = {};
    DB.data.affectedExercises.forEach(function(name, i) {
      var key = 'ex_aff_' + i;
      log.exercises[key] = {
        name: name,
        status: DB.data.trainStatus === 'skipped' ? 'skipped' : 'modified',
        note: DB.data.exNote || ''
      };
    });
  }

  saveDayLog(log);
  renderUnifiedHeader(P, TODAY);
}


// ═══════════════════════════════════════════════════════════════
//  NOTIFICATION ENGINE (local, opt-in, settings-driven)
// ═══════════════════════════════════════════════════════════════
var NT = {
  timers: {},
  requested: false
};

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
  var actHtml = (actions||[]).map(function(a) {
    return '<button class="nt-btn' + (a.primary?' primary':'') + '" onclick="ntAction(\'' + id + '\',function(){' + a.fn + '})">' + a.label + '</button>';
  }).join('');

  var el = document.createElement('div');
  el.className = 'nt-item';
  el.id = id;
  el.innerHTML = '<div class="nt-title">' + title + '</div>'
    + '<div class="nt-body">' + body + '</div>'
    + '<div class="nt-actions">' + actHtml
      + '<button class="nt-btn" onclick="ntDismiss(\'' + id + '\')">Dismiss</button>'
    + '</div>';
  toast.appendChild(el);

  // Auto-dismiss after 12s
  setTimeout(function() { ntDismiss(id); }, 12000);

  // Also try native Notification if permitted
  if (Notification && Notification.permission === 'granted') {
    try { new Notification(title, { body: body, icon: '/icons/icon-192.png' }); } catch(e) {}
  }
}

function ntDismiss(id) {
  var el = document.getElementById(id);
  if (el) el.remove();
}

function ntAction(id, fn) {
  ntDismiss(id);
  try { fn(); } catch(e) {}
}

function ntRequestPermission() {
  if (NT.requested) return;
  NT.requested = true;
  if (Notification && Notification.permission === 'default') {
    Notification.requestPermission().catch(function(){});
  }
}

// Schedule notifications based on today's state
function ntScheduleDay() {
  var prefs = ntGetPrefs();
  if (!prefs.enabled) return;

  ntRequestPermission();

  var now = new Date();
  var hour = now.getHours();

  // Training reminder — 9am on training days
  if (prefs.trainingReminder && TODAY && TODAY.isTraining && hour < 9) {
    var msTo9am = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 9, 0, 0) - now;
    if (msTo9am > 0) {
      NT.timers.training = setTimeout(function() {
        var log = loadDayLog(_rDate);
        if (!log || log.trainStatus === 'pending') {
          ntShow('Ready when you are 🏋️', TODAY.plan.type + ' day. Your session is loaded.', [
            { label: 'Open today', primary: true, fn: 'window.scrollTo({top:0,behavior:"smooth"})' }
          ]);
        }
      }, msTo9am);
    }
  }

  // Debrief reminder — 8pm if not logged
  if (prefs.debrief && hour < 20) {
    var msTo8pm = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 20, 0, 0) - now;
    if (msTo8pm > 0) {
      NT.timers.debrief = setTimeout(function() {
        var log = loadDayLog(_rDate);
        var missing = !log || !log.sleepActual || !log.energy || (TODAY.isTraining && log.trainStatus === 'pending');
        if (missing) {
          ntShow('Quick log before you sleep?', 'A couple of taps — keeps your week review meaningful.', [
            { label: 'Log now', primary: true, fn: 'openDebrief()' }
          ]);
          // Also show the debrief banner
          checkDebriefNeeded();
        }
      }, msTo8pm);
    }
  }
}

// Post-meal walk notification — called when a meal is ticked
window.ntPostMealWalk = function() {
  var prefs = ntGetPrefs();
  if (!prefs.enabled || !prefs.postMealWalk) return;
  if (ntInQuietHours()) return;
  setTimeout(function() {
    ntShow('Good time for a short walk 🚶', '10–20 minutes now drops blood glucose by up to 30%.', [
      { label: 'Done ✓', primary: true, fn: 'void(0)' },
      { label: 'Remind in 1h', fn: 'setTimeout(function(){ntShow("Walk reminder","Still time for that post-meal walk 🚶",[{label:"Done",primary:true,fn:"void(0)"}])},3600000)' }
    ]);
  }, 20 * 60 * 1000); // 20 minutes after meal
};

// Check debrief needed on load (if past 7pm)
setTimeout(function() {
  checkDebriefNeeded();
  ntScheduleDay();
}, 3000);
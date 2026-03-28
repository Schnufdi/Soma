// BodyLens — Behaviour Memory Engine
// Extracted from bodylens-dailyplan.html
// Contains: loadBehaviourMemory, saveBehaviourMemory, buildDaySnapshot,
//   compressAndSaveMemory, checkDebriefNeeded, openDebrief, closeDebrief
// Depends on: P, TODAY, _rDate, loadDayLog, saveDayLog (globals)

// ── BEHAVIOUR MEMORY ENGINE ────────────────────────────────────────────
// Compresses daily debrief data into a rolling narrative on bl_profile.
// This is the AI's long-term memory. It persists to Supabase automatically
// via the localStorage.setItem intercept in supabase-auth.js.
//
// Structure of p.behaviourMemory:
// {
//   updatedAt: ISO string,
//   weekSummaries: [  // last 4 weeks, newest first
//     { week: 'YYYY-MM-DD', summary: '3-4 sentences', flags: ['missed Push x2'] }
//   ],
//   patterns: ['misses Wednesday sessions when work is busy', 'protein dips on rest days'],
//   currentFlags: ['2 sessions missed this week', 'protein below target yesterday'],
//   complianceScore: 72,  // 0-100, rolling 7-day
// }

function loadBehaviourMemory() {
  try {
    var p = JSON.parse(localStorage.getItem('bl_profile') || 'null');
    return p && p.behaviourMemory ? p.behaviourMemory : null;
  } catch(e) { return null; }
}

function saveBehaviourMemory(mem) {
  try {
    var p = JSON.parse(localStorage.getItem('bl_profile') || '{}');
    p.behaviourMemory = mem;
    p.behaviourMemory.updatedAt = new Date().toISOString();
    localStorage.setItem('bl_profile', JSON.stringify(p));
    // Note: supabase-auth.js intercepts this setItem and syncs to Supabase automatically
  } catch(e) {}
}

function buildDaySnapshot(log, p) {
  // Build a rich text snapshot of today for the AI compression call
  var lines = [];
  var date = log.date || _rDate;
  var dayType = log.dayType || (log.planType || 'Unknown');
  lines.push('Date: ' + date + ' (' + (log.weekDay || '') + ', ' + dayType + ')');

  // Training
  if (log.trainStatus && log.trainStatus !== 'rest') {
    lines.push('Training: ' + log.trainStatus);
    var exLogs = log.exercises || {};
    var exDone  = Object.values(exLogs).filter(function(e){return e.status==='done';}).length;
    var exMod   = Object.values(exLogs).filter(function(e){return e.status==='modified';}).length;
    var exSkip  = Object.values(exLogs).filter(function(e){return e.status==='skipped';}).length;
    var exNotes = Object.values(exLogs).filter(function(e){return e.note;})
      .map(function(e){return (e.name||'exercise')+': '+e.note;}).join(', ');
    if (exDone || exMod || exSkip) {
      lines.push('Exercises: ' + exDone + ' done, ' + exMod + ' modified, ' + exSkip + ' skipped');
    }
    if (exNotes) lines.push('Exercise notes: ' + exNotes);
    if (log.trainNote) lines.push('Session note: ' + log.trainNote);
  }

  // Nutrition
  var actual = log.actual || {};
  var plan = log.plan || {};
  if (actual.prot > 0) {
    var protPct = Math.round(actual.prot / (plan.prot || p.protein || 174) * 100);
    lines.push('Protein: ' + actual.prot + 'g of ' + (plan.prot || p.protein || 174) + 'g target (' + protPct + '%)');
  } else {
    lines.push('Protein: not tracked today');
  }
  if (actual.kcal > 0) lines.push('Calories: ' + actual.kcal + ' kcal');

  // Recovery
  if (log.sleepActual) lines.push('Sleep: ' + log.sleepActual + 'h');
  if (log.energy) lines.push('Energy: ' + log.energy + '/5');
  if (log.rating) lines.push('Day rating: ' + log.rating + '/5');
  if (log.dayNote) lines.push('Note: "' + log.dayNote + '"');

  // Supplements
  var suppLog = log.suppLog || {};
  var suppDone = Object.keys(suppLog).filter(function(k){return suppLog[k];});
  if (suppDone.length) lines.push('Supplements taken: ' + suppDone.join(', '));

  return lines.join('\n');
}

async function compressAndSaveMemory(log, p) {
  if (!log || !p) return;

  var snapshot = buildDaySnapshot(log, p);
  var existing = loadBehaviourMemory() || {
    weekSummaries: [], patterns: [], currentFlags: [], complianceScore: null
  };

  // Build context from existing memory
  var memCtx = existing.weekSummaries.length
    ? 'Previous week summaries:\n' + existing.weekSummaries.slice(0,2).map(function(w){
        return w.week + ': ' + w.summary;
      }).join('\n')
    : 'No previous history yet.';

  var existingPatterns = existing.patterns.length
    ? 'Known patterns: ' + existing.patterns.join('; ')
    : 'No patterns identified yet.';

  var prompt = 'You are analysing a fitness day log for ' + p.name + ' (' + p.age + 'yo, goal: ' + (p.goal||'body recomposition') + ').\n\n'
    + 'TODAY\'S DATA:\n' + snapshot + '\n\n'
    + memCtx + '\n'
    + existingPatterns + '\n\n'
    + 'Return ONLY valid JSON in this exact structure:\n'
    + '{\n'
    + '  "daySummary": "2-3 sentences. What happened today. Be specific about numbers and what they mean. Honest, not cheerleader.",\n'
    + '  "newFlags": ["short flag if something needs attention", "e.g. skipped 2 exercises", "protein 40% below target"],\n'
    + '  "patternUpdate": "null, or one sentence if you spot a pattern across multiple days",\n'
    + '  "complianceToday": 0-100\n'
    + '}\n'
    + 'Flags: only add if genuinely notable. Empty array is fine for a good day.\n'
    + 'Return ONLY the JSON. No markdown.';

  // Append conversation context if exists
  if (log.conversation || (DB && DB.data && DB.data.conversation)) {
    var convText = log.conversation || DB.data.conversation;
    if (convText) {
      prompt += '\n\nWHAT THEY SAID IN THEIR DEBRIEF CONVERSATION:\n' + convText
        + '\n\nThis is their actual words — factor it heavily into daySummary and patternUpdate.';
    }
  }

  try {
    var res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 300,
        system: 'Performance coach analyst. Return ONLY valid JSON. No markdown.',
        messages: [{ role: 'user', content: prompt }]
      })
    });
    var data = await res.json();
    var raw = (data.content || []).map(function(b){return b.text||'';}).join('').trim();
    var parsed = JSON.parse(raw.replace(/```json|```/g, '').trim());

    // Update the memory object
    var mem = existing;

    // Add today's summary to current week (find or create week entry)
    var weekStart = (function() {
      var d = new Date(), wd = d.getDay();
      var m = new Date(d); m.setDate(d.getDate() - (wd===0?6:wd-1));
      return m.toISOString().slice(0,10);
    })();

    var weekEntry = mem.weekSummaries.find(function(w){ return w.week === weekStart; });
    if (!weekEntry) {
      weekEntry = { week: weekStart, summary: '', days: [], flags: [] };
      mem.weekSummaries.unshift(weekEntry);
      if (mem.weekSummaries.length > 8) mem.weekSummaries.pop(); // keep 8 weeks
    }

    // Append to week summary
    var dayLabel = (log.weekDay||'') + ': ' + parsed.daySummary;
    weekEntry.days = weekEntry.days || [];
    weekEntry.days.push(dayLabel);
    weekEntry.summary = weekEntry.days.slice(-3).join(' ');
    if (parsed.newFlags && parsed.newFlags.length) {
      weekEntry.flags = (weekEntry.flags||[]).concat(parsed.newFlags);
    }

    // Update current flags (this week's issues)
    mem.currentFlags = weekEntry.flags || [];

    // Update patterns
    if (parsed.patternUpdate && parsed.patternUpdate !== 'null' && parsed.patternUpdate.length > 5) {
      if (!mem.patterns.includes(parsed.patternUpdate)) {
        mem.patterns.unshift(parsed.patternUpdate);
        if (mem.patterns.length > 6) mem.patterns.pop();
      }
    }

    // Rolling compliance score (simple average)
    if (parsed.complianceToday !== undefined) {
      var prev = mem.complianceScore || parsed.complianceToday;
      mem.complianceScore = Math.round(prev * 0.7 + parsed.complianceToday * 0.3);
    }

    saveBehaviourMemory(mem);
    return parsed;

  } catch(e) {
    console.warn('Memory compression failed:', e);
    return null;
  }
}

var DB = {
  step: 0,
  data: {},
  dismissed: false,
  conversation: [],      // open debrief chat turns [{role,content}]
  convBusy: false        // prevent double-sends
};

function checkDebriefNeeded() {
  if (DB.dismissed) return;
  var prefs = (P && P.notifications) || {};
  if (prefs.debrief === false) return;

  var log = loadDayLog(_rDate);
  var hour = new Date().getHours();
  if (hour < 19) return; // Only show after 7pm

  // Check what's missing
  var missing = [];
  if (TODAY.isTraining && (!log || log.trainStatus === 'pending')) missing.push('training');
  if (!log || !log.sleepActual) missing.push('sleep');
  if (!log || !log.energy) missing.push('energy');

  if (!missing.length) return;

  var banner = document.getElementById('debrief-banner');
  var text = document.getElementById('debrief-banner-text');
  if (!banner) return;

  var msgs = {
    training: 'Training not logged yet',
    sleep: 'Sleep not logged yet',
    energy: 'Energy not logged yet'
  };
  text.textContent = msgs[missing[0]] + (missing.length > 1 ? ' +' + (missing.length-1) + ' more' : '') + ' — quick update?';
  banner.classList.add('visible');
}

function dismissDebrief() {
  DB.dismissed = true;
  var banner = document.getElementById('debrief-banner');
  if (banner) banner.classList.remove('visible');
}

function openDebrief() {
  dismissDebrief(); // hide banner
  DB.step = 0;
  DB.data = {};
  var log = loadDayLog(_rDate) || {};
  DB.data.trainStatus = log.trainStatus || '';
  DB.data.sleepActual = log.sleepActual || 0;
  DB.data.energy = log.energy || 0;

  document.getElementById('debrief-overlay').classList.add('open');
  dbRender();
}

function closeDebrief() {
  document.getElementById('debrief-overlay').classList.remove('open');
}

async function dbFinalise() {
  // Save all data to day log first
  dbWriteToLog();
  closeDebrief();

  // Show memory compression indicator
  var p = P;
  var log = loadDayLog(_rDate) || {};
  if (!p || !log.date) return;

  // Fire AI compression in background — updates behaviourMemory on profile
  // which auto-syncs to Supabase via the localStorage intercept
  try {
    var result = await compressAndSaveMemory(log, p);
    if (result && result.newFlags && result.newFlags.length) {
      // Refresh glance card to show new flags
      var glanceCard = document.querySelector('.glance-card');
      if (glanceCard && typeof renderGlanceCard === 'function' && typeof P !== 'undefined' && typeof TODAY !== 'undefined' && window._lastPlan) {
        glanceCard.outerHTML = renderGlanceCard(P, TODAY, window._lastPlan);
      }
    }
  } catch(e) {}
}
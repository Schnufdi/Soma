// BodyLens — Weekly Reconciliation Pass v2
// The feedback loop. Reads accumulated data, reasons across time, applies changes.
//
// v1 gap: adaptations were advisory text only — never applied.
// v2 fix: adaptations carry structured action objects. "Apply to next week →"
//         button executes them against week overrides and profile.
//
// Data read:
//   • Last 7 day logs (training, nutrition, sleep, energy)
//   • Last 4 weeks of behaviour memory (patterns, flags, compliance)
//   • bl_ex_weights — current strength records per exercise
//   • Current programme: weekPlan, protein target, calories, week phase
//
// Applies:
//   swap_days   → writes next week's override (remaps training ↔ rest)
//   add_rest    → writes next week's override (training day → rest)
//   set_protein → updates p.protein in profile
//   set_calories → updates p.trainingKcal / p.restKcal
//   set_intensity → stores in p.programmeAdaptations.intensityScheme
//   set_volume  → stores in p.programmeAdaptations.volumeDelta (-2 to +2)
//
// Depends on globals: window.P, loadWeekOverride, saveWeekOverride

// ── Entry point — called from buildDay() ─────────────────────────────────────
function checkAndRunReconciliation() {
  if (!window.P) return;

  // Once per ISO week
  var weekKey = 'bl_recon_' + _getISOWeek();
  if (localStorage.getItem(weekKey)) return;

  var logs = _readRecentLogs(7);
  if (logs.filter(function(l){ return l !== null; }).length < 3) return;

  setTimeout(function() {
    runWeeklyReconciliation(logs).then(function() {
      try { localStorage.setItem(weekKey, new Date().toISOString()); } catch(e) {}
      _renderReconciliationCard();
    }).catch(function(err) {
      console.warn('Reconciliation failed:', err);
    });
  }, 2500);
}

// Force-run: bypasses the ISO-week gate (manual trigger / debug)
function forceRunReconciliation() {
  if (!window.P) return Promise.reject('No profile loaded');
  var logs = _readRecentLogs(7);
  var n = logs.filter(function(l){ return l !== null; }).length;
  if (n < 2) return Promise.reject('Need at least 2 day logs (' + n + ' found)');

  var existingCard = document.getElementById('recon-card');
  if (existingCard) existingCard.innerHTML = '<div style="padding:20px;text-align:center;font-size:12px;color:var(--dk-3);">Running reconciliation across ' + n + ' days of logs…</div>';

  return runWeeklyReconciliation(logs).then(function() {
    _renderReconciliationCard();
  });
}

// ── Core reconciliation — Claude call ────────────────────────────────────────
async function runWeeklyReconciliation(logs) {
  var p = window.P;
  if (!p) return;

  // ── Recent 7 days ───────────────────────────────────────────────────────
  var logLines = logs.map(function(log) {
    if (!log) return null;
    var lines = [(log.weekDay || '') + ' ' + (log.date || '') + ':'];

    if (log.trainStatus === 'done') {
      lines.push('  Training: completed');
      var exs = log.exercises || {};
      var done  = Object.values(exs).filter(function(e){ return e.status === 'done'; }).length;
      var skip  = Object.values(exs).filter(function(e){ return e.status === 'skipped'; }).length;
      var notes = Object.values(exs).filter(function(e){ return e.note; })
        .map(function(e){ return (e.name || 'ex') + ': ' + e.note; }).join(', ');
      if (done || skip) lines.push('  Exercises: ' + done + ' done, ' + skip + ' skipped');
      if (notes) lines.push('  Notes: ' + notes);
    } else if (log.trainStatus === 'skipped') {
      lines.push('  Training: SKIPPED' + (log.trainNote ? ' — ' + log.trainNote : ''));
    } else if (log.trainStatus === 'modified') {
      lines.push('  Training: modified' + (log.trainNote ? ' — ' + log.trainNote : ''));
    } else if (log.planType === 'rest' || log.dayType === 'Rest') {
      lines.push('  Rest day');
    } else {
      lines.push('  Training: not logged');
    }

    if (log.sleepActual) lines.push('  Sleep: ' + log.sleepActual + 'h');
    if (log.energy)      lines.push('  Energy: ' + log.energy + '/5');

    var actual = log.actual || {};
    if (actual.prot > 0) {
      var tgt = (log.plan || {}).prot || p.protein || 174;
      lines.push('  Protein: ' + actual.prot + 'g (' + Math.round(actual.prot / tgt * 100) + '% of ' + tgt + 'g target)');
    }
    if (actual.kcal > 0) lines.push('  Calories: ' + actual.kcal + ' kcal');
    if (log.dayNote) lines.push('  Note: "' + log.dayNote + '"');
    if (log.salvageCommitments && log.salvageCommitments.length) {
      lines.push('  Salvage commitments: ' + log.salvageCommitments.join(', '));
    }
    return lines.join('\n');
  }).filter(Boolean).join('\n\n');

  // ── Multi-week context ──────────────────────────────────────────────────
  var multiWeek = _readMultiWeekContext();

  // ── Strength progression ────────────────────────────────────────────────
  var strength = _readStrengthData();

  // ── Programme state ─────────────────────────────────────────────────────
  var DNS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
  var prog = [];
  prog.push('Goal: ' + (p.goal || 'body recomposition'));
  prog.push('Training ' + (p.trainingDays || 4) + ' days/week');
  prog.push('Protein target: ' + (p.protein || 174) + 'g/day');
  prog.push('Calories: ' + (p.trainingKcal || p.calories || 2400) + ' training / ' + (p.restKcal || Math.round((p.trainingKcal || 2400) * 0.9)) + ' rest');
  if (p.weekPlan && p.weekPlan.length) {
    var sched = p.weekPlan.map(function(d, i) {
      return DNS[i] + ': ' + (d.priority === 'training' ? (d.type || 'Training') : 'Rest');
    }).join(', ');
    prog.push('Schedule: ' + sched);
  }
  var progWeek = 1;
  if (p.generatedAt) {
    progWeek = Math.min(4, Math.max(1, Math.floor((Date.now() - new Date(p.generatedAt)) / (7 * 864e5)) + 1));
  }
  prog.push('Programme week: ' + progWeek + ' of 4');
  var mem = p.behaviourMemory || {};
  if (mem.complianceScore != null) prog.push('Rolling compliance: ' + mem.complianceScore + '/100');
  if (p.programmeAdaptations) {
    var pa = p.programmeAdaptations;
    if (pa.volumeDelta) prog.push('Active volume adjustment: ' + (pa.volumeDelta > 0 ? '+' : '') + pa.volumeDelta + ' sets delta');
    if (pa.intensityScheme) prog.push('Active intensity scheme: ' + pa.intensityScheme);
  }

  // ── Prompt ───────────────────────────────────────────────────────────────
  var prompt = 'You are the adaptive coaching engine for ' + p.name + ' ('
    + (p.age || '?') + 'yo, ' + (p.weight || '?') + 'kg, goal: ' + (p.goal || 'body recomposition') + ').\n\n'
    + 'LAST 7 DAYS:\n' + logLines + '\n\n'
    + (multiWeek ? 'MULTI-WEEK HISTORY:\n' + multiWeek + '\n\n' : '')
    + (strength ? 'CURRENT STRENGTH RECORDS (last logged weights):\n' + strength + '\n\n' : '')
    + 'PROGRAMME:\n' + prog.join('\n') + '\n\n'
    + 'Identify what is actually happening vs what the programme assumes. Generate 2–4 concrete adaptations based on this person\'s actual data — not generic advice.\n\n'
    + 'Each adaptation MUST include an "action" field with one of these machine-executable ops:\n'
    + '  "swap_days"   — { "fromDayIdx": 0-6, "toDayIdx": 0-6 }  (0=Mon, 6=Sun). Use when a training day is consistently skipped and another slot is free.\n'
    + '  "add_rest"    — { "dayIdx": 0-6 }  Convert a training day to rest for one week. Use when overtrained/fatigued signals.\n'
    + '  "set_protein" — { "grams": number }  Update target. Only if actual is consistently ≥15% off target for 3+ days.\n'
    + '  "set_calories"— { "trainingKcal": number, "restKcal": number }  Both required if changing calories.\n'
    + '  "set_intensity"— { "scheme": "beginner"|"intermediate"|"advanced" }  For this coming week.\n'
    + '  "set_volume"  — { "direction": "up"|"down" }  Adjust volume one notch.\n'
    + '  "note_only"   — Coaching observation, no code change.\n\n'
    + 'Return ONLY valid JSON — no markdown, no explanation:\n'
    + '{\n'
    + '  "weekRating": 1-5,\n'
    + '  "headline": "One specific sentence. Reference actual data. Not generic.",\n'
    + '  "patterns": ["Specific pattern with data — e.g. Protein below 80% of target on 4 of 7 days"],\n'
    + '  "adaptations": [\n'
    + '    { "type": "training|nutrition|recovery|load", "change": "What changes", "rationale": "Why — cite actual data", "priority": "high|medium", "action": { "op": "...", ...fields } }\n'
    + '  ],\n'
    + '  "nextWeekFocus": "Single most important thing — one sentence",\n'
    + '  "coachNote": "2-3 sentences. Honest read of the week. Reference actual numbers. No cheerleading."\n'
    + '}';

  var res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-5',
      max_tokens: 1200,
      system: 'Adaptive fitness coaching engine. Analyse multi-week data and generate specific, data-backed programme adaptations with structured action fields. Return ONLY valid JSON.',
      messages: [{ role: 'user', content: prompt }]
    })
  });

  var data = await res.json();
  if (data.error) throw new Error(data.error.message || data.error);

  var raw = (data.content || []).map(function(b){ return b.text || ''; }).join('').trim();
  raw = raw.replace(/^```json|^```|```$/gm, '').trim();
  var result = JSON.parse(raw);

  // Persist to profile
  try {
    var prof = JSON.parse(localStorage.getItem('bl_profile') || '{}');
    result.generatedAt  = new Date().toISOString();
    result.weekStart    = _getWeekStart();
    result.logsAnalysed = logs.filter(Boolean).length;
    prof.weeklyAdaptation = result;
    localStorage.setItem('bl_profile', JSON.stringify(prof));
    // supabase-auth.js intercepts this setItem → auto-syncs to Supabase
  } catch(e) {}

  return result;
}

// ── Apply adaptations ─────────────────────────────────────────────────────────
function applyWeeklyAdaptations(adaptations) {
  if (!adaptations || !adaptations.length) return { applied: [], skipped: [] };

  var p;
  try { p = JSON.parse(localStorage.getItem('bl_profile') || '{}'); } catch(e) { return { applied: [], skipped: [] }; }

  var nextOverride    = _loadNextWeekOverride();
  var applied         = [];
  var skipped         = [];
  var profileChanged  = false;
  var DNS             = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];

  adaptations.forEach(function(a) {
    if (!a.action || !a.action.op) { skipped.push(a); return; }
    var op = a.action.op;

    // ── Swap two days ──────────────────────────────────────────────────────
    if (op === 'swap_days') {
      var fi = parseInt(a.action.fromDayIdx), ti = parseInt(a.action.toDayIdx);
      if (isNaN(fi) || isNaN(ti) || fi < 0 || fi > 6 || ti < 0 || ti > 6) { skipped.push(a); return; }
      var fromPlan = (p.weekPlan || [])[fi] || { type: 'Rest', priority: 'rest' };
      var toPlan   = (p.weekPlan || [])[ti] || { type: 'Rest', priority: 'rest' };
      nextOverride[ti] = Object.assign({}, fromPlan, { source: 'reconciliation', reason: a.rationale });
      nextOverride[fi] = Object.assign({}, toPlan,   { source: 'reconciliation', reason: a.rationale });
      applied.push({ op: op, desc: DNS[fi] + ' ↔ ' + DNS[ti] + ' swapped next week' });
    }

    // ── Add rest day ───────────────────────────────────────────────────────
    else if (op === 'add_rest') {
      var di = parseInt(a.action.dayIdx);
      if (isNaN(di) || di < 0 || di > 6) { skipped.push(a); return; }
      nextOverride[di] = { type: 'Rest', priority: 'rest', source: 'reconciliation', reason: a.rationale };
      applied.push({ op: op, desc: DNS[di] + ' → rest day next week' });
    }

    // ── Update protein target ──────────────────────────────────────────────
    else if (op === 'set_protein') {
      var g = parseInt(a.action.grams);
      if (!g || g < 80 || g > 450) { skipped.push(a); return; }
      p.protein = g;
      profileChanged = true;
      applied.push({ op: op, desc: 'Protein: ' + g + 'g/day' });
    }

    // ── Update calorie targets ─────────────────────────────────────────────
    else if (op === 'set_calories') {
      var tkc = parseInt(a.action.trainingKcal), rkc = parseInt(a.action.restKcal);
      if (tkc > 1200 && tkc < 6000) { p.trainingKcal = tkc; if (!p.calories) p.calories = tkc; profileChanged = true; }
      if (rkc > 1000 && rkc < 5500) { p.restKcal = rkc; profileChanged = true; }
      if (profileChanged) applied.push({ op: op, desc: 'Calories: ' + (tkc || '–') + ' training / ' + (rkc || '–') + ' rest' });
      else skipped.push(a);
    }

    // ── Set intensity scheme ───────────────────────────────────────────────
    else if (op === 'set_intensity') {
      var scheme = a.action.scheme;
      if (['beginner','intermediate','advanced'].indexOf(scheme) < 0) { skipped.push(a); return; }
      if (!p.programmeAdaptations) p.programmeAdaptations = {};
      p.programmeAdaptations.intensityScheme      = scheme;
      p.programmeAdaptations.intensityUpdatedAt   = new Date().toISOString();
      profileChanged = true;
      applied.push({ op: op, desc: 'Intensity → ' + scheme + ' for next week' });
    }

    // ── Adjust volume ──────────────────────────────────────────────────────
    else if (op === 'set_volume') {
      var dir = a.action.direction;
      if (dir !== 'up' && dir !== 'down') { skipped.push(a); return; }
      if (!p.programmeAdaptations) p.programmeAdaptations = {};
      var cur = p.programmeAdaptations.volumeDelta || 0;
      p.programmeAdaptations.volumeDelta        = Math.max(-2, Math.min(2, cur + (dir === 'up' ? 1 : -1)));
      p.programmeAdaptations.volumeUpdatedAt    = new Date().toISOString();
      profileChanged = true;
      applied.push({ op: op, desc: 'Volume ' + dir + ' (delta now ' + (p.programmeAdaptations.volumeDelta > 0 ? '+' : '') + p.programmeAdaptations.volumeDelta + ')' });
    }

    // ── Coaching note — no code change ──────────────────────────────────────
    else if (op === 'note_only') {
      applied.push({ op: op, desc: '(noted) ' + a.change });
    }

    else { skipped.push(a); }
  });

  // Persist next week's override
  if (Object.keys(nextOverride).length) _saveNextWeekOverride(nextOverride);

  // Persist profile
  if (profileChanged) {
    if (!p.programmeAdaptations) p.programmeAdaptations = {};
    p.programmeAdaptations.lastApplied = new Date().toISOString();
    localStorage.setItem('bl_profile', JSON.stringify(p));
    // Update the live global
    try { window.P = JSON.parse(localStorage.getItem('bl_profile') || '{}'); } catch(e) {}
  }

  // Bust today's plan cache → next render picks up new targets
  try { localStorage.removeItem('dayplan_v6r3_' + new Date().toISOString().slice(0, 10)); } catch(e) {}

  return { applied: applied, skipped: skipped };
}

// ── Confirmation modal ────────────────────────────────────────────────────────
function confirmApplyAdaptations() {
  var existing = document.getElementById('recon-apply-overlay');
  if (existing) existing.remove();

  var p; try { p = JSON.parse(localStorage.getItem('bl_profile') || '{}'); } catch(e) { return; }
  var adapt = p.weeklyAdaptation;
  if (!adapt || !adapt.adaptations) return;

  var DNS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
  var actionable = (adapt.adaptations || []).filter(function(a){ return a.action && a.action.op && a.action.op !== 'note_only'; });
  var notes      = (adapt.adaptations || []).filter(function(a){ return !a.action || a.action.op === 'note_only'; });

  var changesHtml = actionable.map(function(a) {
    var op  = a.action.op;
    var col = 'var(--jade)';
    var desc = '';

    if (op === 'swap_days') {
      desc = '<strong>' + (DNS[a.action.fromDayIdx] || '?') + ' ↔ ' + (DNS[a.action.toDayIdx] || '?') + '</strong> swapped in next week\'s schedule';
    } else if (op === 'add_rest') {
      col  = 'var(--amber)';
      desc = '<strong>' + (DNS[a.action.dayIdx] || '?') + '</strong> → rest day next week';
    } else if (op === 'set_protein') {
      col  = 'var(--amber)';
      desc = 'Protein: <strong>' + (p.protein || '?') + 'g → ' + a.action.grams + 'g</strong>/day (applies immediately)';
    } else if (op === 'set_calories') {
      col  = 'var(--amber)';
      desc = 'Calories: <strong>' + (a.action.trainingKcal || '–') + ' training / ' + (a.action.restKcal || '–') + ' rest</strong> kcal (applies immediately)';
    } else if (op === 'set_intensity') {
      col  = 'rgba(200,130,220,.9)';
      desc = 'Intensity scheme → <strong>' + a.action.scheme + '</strong> for next week';
    } else if (op === 'set_volume') {
      col  = 'rgba(200,130,220,.9)';
      desc = 'Volume <strong>' + a.action.direction + '</strong> one notch next week';
    } else {
      desc = a.change;
    }

    return '<div style="padding:10px 14px;border-left:2px solid ' + col + ';margin-bottom:8px;background:rgba(255,255,255,.025);border-radius:0 6px 6px 0;">'
      + '<div style="font-size:13px;font-weight:400;color:var(--dk-1);line-height:1.4;">' + desc + '</div>'
      + '<div style="font-size:11px;font-weight:300;color:var(--dk-3);margin-top:3px;line-height:1.5;">' + a.rationale + '</div>'
      + '</div>';
  }).join('');

  if (!changesHtml) {
    changesHtml = '<div style="font-size:12px;color:var(--dk-3);font-weight:300;padding:10px 0;">No auto-applicable changes this week — all adaptations are coaching observations.</div>';
  }

  var notesHtml = notes.length
    ? '<div style="margin-top:14px;padding-top:14px;border-top:1px solid rgba(255,255,255,.06);">'
        + '<div style="font-size:9px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--dk-3);margin-bottom:8px;">Coaching observations (no changes)</div>'
        + notes.map(function(n){ return '<div style="font-size:11px;font-weight:300;color:var(--dk-3);padding:3px 0;line-height:1.5;">· ' + n.change + '</div>'; }).join('')
      + '</div>'
    : '';

  var hasScheduleChange = actionable.some(function(a){ return a.action.op === 'swap_days' || a.action.op === 'add_rest'; });
  var scopeNote = hasScheduleChange
    ? 'Schedule changes apply to <strong>next week</strong>. Nutrition targets apply immediately.'
    : 'All changes apply immediately to your profile and plan.';

  var overlay = document.createElement('div');
  overlay.id = 'recon-apply-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.75);z-index:9010;display:flex;align-items:flex-end;justify-content:center;padding-bottom:env(safe-area-inset-bottom,0px);';
  overlay.innerHTML =
    '<div style="background:var(--ink-1);border:1px solid rgba(255,255,255,.1);border-radius:16px 16px 0 0;width:100%;max-width:640px;padding:24px 22px calc(24px + env(safe-area-inset-bottom,0px));max-height:85vh;overflow-y:auto;">'
    + '<div style="font-size:9px;font-weight:700;letter-spacing:.15em;text-transform:uppercase;color:var(--jade);margin-bottom:8px;">Apply programme adaptations</div>'
    + '<div style="font-family:var(--serif);font-size:20px;font-weight:300;color:var(--dk-1);margin-bottom:18px;line-height:1.3;">What will change</div>'
    + changesHtml
    + notesHtml
    + '<div style="margin-top:14px;padding:10px 14px;background:rgba(255,255,255,.02);border:1px solid rgba(255,255,255,.07);border-radius:7px;font-size:11px;font-weight:300;color:var(--dk-3);line-height:1.6;">'
      + scopeNote
    + '</div>'
    + '<div style="display:flex;gap:10px;margin-top:20px;">'
      + (actionable.length
        ? '<button onclick="_doApplyAdaptations()" style="flex:1;background:var(--jade);border:none;color:var(--ink);padding:14px;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;font-family:var(--sans);">Apply ' + actionable.length + ' change' + (actionable.length > 1 ? 's' : '') + ' →</button>'
        : '')
      + '<button onclick="document.getElementById(\'recon-apply-overlay\').remove()" style="'
          + (actionable.length ? '' : 'flex:1;')
          + 'background:none;border:1px solid var(--bd);color:var(--dk-3);padding:14px 22px;border-radius:8px;font-size:13px;cursor:pointer;font-family:var(--sans);">'
          + (actionable.length ? 'Cancel' : 'Close')
        + '</button>'
    + '</div>'
    + '</div>';

  document.body.appendChild(overlay);
}

function _doApplyAdaptations() {
  var p; try { p = JSON.parse(localStorage.getItem('bl_profile') || '{}'); } catch(e) { return; }
  var adapt = p.weeklyAdaptation;
  if (!adapt) return;

  var result = applyWeeklyAdaptations(adapt.adaptations || []);

  // Remove overlay
  var ol = document.getElementById('recon-apply-overlay');
  if (ol) ol.remove();

  // Update the Apply button to confirmed state
  var btn = document.getElementById('recon-apply-btn');
  if (btn) {
    var realApplied = result.applied.filter(function(r){ return r.op !== 'note_only'; }).length;
    btn.textContent = '✓ ' + realApplied + ' change' + (realApplied !== 1 ? 's' : '') + ' queued for next week';
    btn.style.cssText = 'width:100%;background:rgba(0,200,160,.08);border:1px solid rgba(0,200,160,.2);color:var(--jade);padding:12px;border-radius:7px;font-size:12px;font-weight:600;cursor:default;font-family:var(--sans);';
    btn.onclick = null;
  }

  // Mark applied in profile
  try {
    var prof = JSON.parse(localStorage.getItem('bl_profile') || '{}');
    if (prof.weeklyAdaptation) {
      prof.weeklyAdaptation.appliedAt      = new Date().toISOString();
      prof.weeklyAdaptation.appliedChanges = result.applied;
      localStorage.setItem('bl_profile', JSON.stringify(prof));
    }
  } catch(e) {}
}

// ── Render coaching card ──────────────────────────────────────────────────────
function _renderReconciliationCard() {
  var root = document.getElementById('day-root');
  if (!root) return;

  var ex = document.getElementById('recon-card');
  if (ex) ex.remove();

  try {
    var p    = JSON.parse(localStorage.getItem('bl_profile') || '{}');
    var adapt = p.weeklyAdaptation;
    if (!adapt) return;
    if (adapt.weekStart !== _getWeekStart()) return;
    try {
      var snoozed = JSON.parse(localStorage.getItem('bl_recon_snoozed') || 'null');
      if (snoozed && snoozed.until && new Date(snoozed.until) > new Date()) return;
    } catch(e) {}

    var card = document.createElement('div');
    card.id = 'recon-card';
    card.style.cssText = 'max-width:640px;margin:0 auto 20px;padding:0 16px;';
    card.innerHTML = buildReconciliationCardHTML(adapt);
    root.insertBefore(card, root.firstChild);
  } catch(e) {}
}

function buildReconciliationCardHTML(adapt) {
  var rCol  = adapt.weekRating >= 4 ? 'var(--jade)' : adapt.weekRating >= 3 ? 'var(--amber)' : 'rgba(220,100,80,.85)';
  var stars = '';
  for (var i = 1; i <= 5; i++) {
    stars += '<span style="color:' + (i <= adapt.weekRating ? rCol : 'rgba(255,255,255,.12)') + ';font-size:12px;">&#9679;</span>';
  }

  var typeColors = { training:'var(--jade)', nutrition:'var(--amber)', recovery:'rgba(130,170,255,.8)', load:'rgba(200,130,220,.8)' };

  var adaptHTML = (adapt.adaptations || []).map(function(a) {
    var col         = typeColors[a.type] || 'var(--dk-3)';
    var hasAction   = a.action && a.action.op && a.action.op !== 'note_only';
    var priTag      = a.priority === 'high'
      ? '<span style="font-size:8px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:rgba(220,100,80,.85);margin-left:6px;">high</span>'
      : '';
    var actionTag   = hasAction
      ? '<span style="font-size:8px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:rgba(0,200,160,.6);margin-left:6px;">auto-applicable</span>'
      : '';
    return '<div style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,.05);">'
      + '<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">'
        + '<span style="font-size:9px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:' + col + ';">' + (a.type || '') + '</span>'
        + priTag + actionTag
      + '</div>'
      + '<div style="font-size:13px;font-weight:500;color:var(--dk-1);margin-bottom:3px;">' + (a.change || '') + '</div>'
      + '<div style="font-size:11px;font-weight:300;color:var(--dk-3);line-height:1.5;">' + (a.rationale || '') + '</div>'
      + '</div>';
  }).join('');

  var patternsHTML = (adapt.patterns || []).map(function(pt) {
    return '<div style="font-size:11px;font-weight:300;color:var(--dk-2);padding:3px 0;line-height:1.5;">&#8250; ' + pt + '</div>';
  }).join('');

  var actionable   = (adapt.adaptations || []).filter(function(a){ return a.action && a.action.op && a.action.op !== 'note_only'; }).length;
  var alreadyDone  = !!adapt.appliedAt;

  var applyBtn;
  if (alreadyDone) {
    applyBtn = '<button id="recon-apply-btn" style="width:100%;background:rgba(0,200,160,.06);border:1px solid rgba(0,200,160,.18);color:var(--jade);padding:12px;border-radius:7px;font-size:12px;font-weight:600;cursor:default;font-family:var(--sans);">✓ Applied — changes queued for next week</button>';
  } else if (actionable > 0) {
    applyBtn = '<button id="recon-apply-btn" onclick="confirmApplyAdaptations()" style="width:100%;background:var(--jade);border:none;color:var(--ink);padding:13px;border-radius:7px;font-size:13px;font-weight:700;cursor:pointer;font-family:var(--sans);letter-spacing:.01em;">Apply ' + actionable + ' adaptation' + (actionable > 1 ? 's' : '') + ' to next week &rarr;</button>';
  } else {
    applyBtn = '<button id="recon-apply-btn" style="width:100%;background:none;border:1px solid var(--bd);color:var(--dk-3);padding:12px;border-radius:7px;font-size:12px;cursor:default;font-family:var(--sans);">All adaptations are coaching observations</button>';
  }

  return '<div style="background:var(--ink-1);border:1px solid rgba(255,255,255,.07);border-radius:12px;padding:20px 22px;border-left:3px solid var(--jade);">'

    // Header
    + '<div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:14px;">'
      + '<div>'
        + '<div style="font-size:9px;font-weight:700;letter-spacing:.15em;text-transform:uppercase;color:var(--jade);margin-bottom:4px;">Weekly reconciliation</div>'
        + '<div style="font-size:9px;letter-spacing:.1em;text-transform:uppercase;color:var(--dk-3);">Week of ' + (adapt.weekStart || '?') + ' &nbsp;·&nbsp; ' + (adapt.logsAnalysed || 0) + ' days analysed</div>'
      + '</div>'
      + '<div style="display:flex;gap:3px;">' + stars + '</div>'
    + '</div>'

    // Headline
    + '<div style="font-family:var(--serif);font-size:18px;font-weight:300;color:var(--dk-1);line-height:1.3;margin-bottom:14px;">' + (adapt.headline || '') + '</div>'

    // Coach note
    + '<div style="font-size:12px;font-weight:300;color:var(--dk-2);line-height:1.75;margin-bottom:16px;padding-bottom:14px;border-bottom:1px solid rgba(255,255,255,.06);">' + (adapt.coachNote || '') + '</div>'

    // Adaptations
    + (adaptHTML ? '<div style="margin-bottom:16px;">' + adaptHTML + '</div>' : '')

    // Patterns
    + (patternsHTML ? '<div style="padding:10px 0 14px;border-top:1px solid rgba(255,255,255,.05);margin-bottom:14px;"><div style="font-size:9px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--dk-3);margin-bottom:6px;">Patterns detected</div>' + patternsHTML + '</div>' : '')

    // Next week focus
    + (adapt.nextWeekFocus ? '<div style="margin-bottom:16px;padding:10px 14px;background:rgba(0,200,160,.04);border-radius:7px;border:1px solid rgba(0,200,160,.1);"><div style="font-size:9px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--jade);margin-bottom:4px;">Focus next week</div><div style="font-size:12px;font-weight:300;color:var(--dk-1);line-height:1.5;">' + adapt.nextWeekFocus + '</div></div>' : '')

    // Apply button
    + applyBtn

    // Dismiss
    + '<div style="margin-top:10px;text-align:right;"><button onclick="dismissReconciliationCard()" style="background:none;border:none;font-size:10px;font-weight:500;color:var(--dk-3);cursor:pointer;font-family:var(--sans);letter-spacing:.04em;">Not now &middot; remind tomorrow</button></div>'

    + '</div>';
}

function dismissReconciliationCard() {
  var card = document.getElementById('recon-card');
  if (card) card.style.display = 'none';
  // "Not now" — snooze for 20 hours, resurfaces tomorrow
  try {
    localStorage.setItem('bl_recon_snoozed', JSON.stringify({
      until: new Date(Date.now() + 20 * 60 * 60 * 1000).toISOString()
    }));
  } catch(e) {}
  // Update the panel indicator
  var ind = document.getElementById('dp3-adapt-indicator');
  if (ind) ind.style.display = 'none';
}

function showExistingReconciliation() {
  try {
    var p     = JSON.parse(localStorage.getItem('bl_profile') || '{}');
    var adapt = p.weeklyAdaptation;
    if (!adapt) return;
    if (adapt.weekStart !== _getWeekStart()) return;
    try {
      var snoozed = JSON.parse(localStorage.getItem('bl_recon_snoozed') || 'null');
      if (snoozed && snoozed.until && new Date(snoozed.until) > new Date()) return;
    } catch(e) {}
    _renderReconciliationCard();
  } catch(e) {}
}

// ── Read last N day logs ───────────────────────────────────────────────────────
function _readRecentLogs(n) {
  var logs  = [];
  var today = new Date();
  var DNS   = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  for (var i = 0; i < n; i++) {
    var d = new Date(today);
    d.setDate(today.getDate() - i);
    var dateStr = d.toISOString().slice(0, 10);
    try {
      var raw = localStorage.getItem('bl_daylog_' + dateStr);
      if (raw) {
        var log = JSON.parse(raw);
        log.date    = log.date    || dateStr;
        log.weekDay = log.weekDay || DNS[d.getDay()];
        logs.push(log);
      } else {
        logs.push(null);
      }
    } catch(e) {
      logs.push(null);
    }
  }
  return logs;
}

// ── Read multi-week behaviour memory ──────────────────────────────────────────
function _readMultiWeekContext() {
  try {
    var p   = JSON.parse(localStorage.getItem('bl_profile') || '{}');
    var mem = p.behaviourMemory;
    if (!mem) return null;

    var lines = [];
    (mem.weekSummaries || []).slice(0, 4).forEach(function(w) {
      if (!w.summary && !(w.flags && w.flags.length)) return;
      var line = (w.week || '') + ': ' + (w.summary || '');
      if (w.flags && w.flags.length) line += ' [Flags: ' + w.flags.slice(0, 3).join(', ') + ']';
      lines.push(line);
    });
    if (mem.patterns && mem.patterns.length) {
      lines.push('Known behaviour patterns: ' + mem.patterns.join('; '));
    }
    if (mem.complianceScore != null) {
      lines.push('Rolling 7-day compliance: ' + mem.complianceScore + '/100');
    }
    return lines.length ? lines.join('\n') : null;
  } catch(e) { return null; }
}

// ── Read current strength records ─────────────────────────────────────────────
function _readStrengthData() {
  try {
    var wStore = JSON.parse(localStorage.getItem('bl_ex_weights') || '{}');
    var keys   = Object.keys(wStore);
    if (!keys.length) return null;

    var lines = keys.slice(0, 10).map(function(k) {
      var rec = wStore[k];
      // Un-squish the normalized key for readability (insert spaces before capitals via heuristic)
      var readableName = k.replace(/([a-z]{3})([a-z])/g, function(m, a, b) { return a + b; })
        .replace(/^(\w)/, function(c){ return c.toUpperCase(); });
      return readableName + ': ' + rec.w + 'kg (last logged ' + (rec.at || '?') + ')';
    });
    return lines.join('\n');
  } catch(e) { return null; }
}

// ── Next week override helpers ────────────────────────────────────────────────
function _nextWeekMonday() {
  var d   = new Date();
  var wd  = d.getDay();
  var mon = new Date(d);
  mon.setDate(d.getDate() - (wd === 0 ? 6 : wd - 1) + 7); // +7 → next week
  mon.setHours(0, 0, 0, 0);
  return mon.toISOString().slice(0, 10);
}

function _loadNextWeekOverride() {
  var key = 'bl_week_override_' + _nextWeekMonday();
  try { var r = localStorage.getItem(key); return r ? JSON.parse(r) : {}; }
  catch(e) { return {}; }
}

function _saveNextWeekOverride(data) {
  var key = 'bl_week_override_' + _nextWeekMonday();
  try { localStorage.setItem(key, JSON.stringify(data)); } catch(e) {}
}

// ── ISO week / week-start helpers ─────────────────────────────────────────────
function _getISOWeek() {
  var d      = new Date();
  var dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  var yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  var wk = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return d.getUTCFullYear() + '-W' + String(wk).padStart(2, '0');
}

function _getWeekStart() {
  var d    = new Date();
  var day  = d.getDay();
  var diff = d.getDate() - (day === 0 ? 6 : day - 1);
  return new Date(d.setDate(diff)).toISOString().slice(0, 10);
}

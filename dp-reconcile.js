// BodyLens — Weekly Reconciliation Pass
// Reads the last 7 day logs, behaviour memory, and current programme,
// then asks Claude to generate concrete programme adaptations.
//
// Runs: once per calendar week (Monday or first open after week ends)
// Output: p.weeklyAdaptation — surfaced on the daily plan as a coaching card
//
// Depends on: P, _rDate, loadDayLog, saveBehaviourMemory (globals from dailyplan)

// ── Entry point — called from buildDay() ────────────────────────────────
function checkAndRunReconciliation() {
  if (!window.P) return;

  // Run once per week — keyed to ISO week number
  var weekKey = 'bl_recon_' + _getISOWeek();
  if (localStorage.getItem(weekKey)) return;

  // Need at least 3 days of logs to be worth running
  var logs = _readRecentLogs(7);
  if (logs.filter(function(l){ return l !== null; }).length < 3) return;

  // Run async — don't block the plan render
  setTimeout(function() {
    runWeeklyReconciliation(logs).then(function() {
      // Mark as done for this week
      try { localStorage.setItem(weekKey, new Date().toISOString()); } catch(e) {}
      // Re-render the coaching card if it's in the DOM
      _renderReconciliationCard();
    }).catch(function(err) {
      console.warn('Weekly reconciliation failed:', err);
    });
  }, 2000); // 2s delay after plan renders
}

// ── Main reconciliation function ─────────────────────────────────────────
async function runWeeklyReconciliation(logs) {
  var p = window.P;
  if (!p) return;

  // Build the log summary
  var logLines = logs.map(function(log) {
    if (!log) return null;
    var lines = [log.weekDay + ' ' + log.date + ':'];

    // Training
    if (log.trainStatus === 'done') {
      lines.push('  Training: completed');
      var exDone = Object.values(log.exercises || {}).filter(function(e){ return e.status === 'done'; }).length;
      var exSkip = Object.values(log.exercises || {}).filter(function(e){ return e.status === 'skipped'; }).length;
      if (exDone || exSkip) lines.push('  Exercises: ' + exDone + ' done, ' + exSkip + ' skipped');
    } else if (log.trainStatus === 'skipped') {
      lines.push('  Training: SKIPPED' + (log.trainNote ? ' — ' + log.trainNote : ''));
    } else if (log.trainStatus === 'modified') {
      lines.push('  Training: modified' + (log.trainNote ? ' — ' + log.trainNote : ''));
    } else if (log.planType === 'rest' || log.dayType === 'Rest') {
      lines.push('  Rest day');
    } else {
      lines.push('  Training: not logged');
    }

    // Recovery
    if (log.sleepActual) lines.push('  Sleep: ' + log.sleepActual + 'h');
    if (log.energy) lines.push('  Energy: ' + log.energy + '/5');

    // Nutrition
    var actual = log.actual || {};
    if (actual.prot > 0) {
      var protTarget = (log.plan || {}).prot || p.protein || 174;
      var protPct = Math.round(actual.prot / protTarget * 100);
      lines.push('  Protein: ' + actual.prot + 'g (' + protPct + '% of target)');
    }
    if (actual.kcal > 0) lines.push('  Calories: ' + actual.kcal + ' kcal');

    if (log.dayNote) lines.push('  Note: "' + log.dayNote + '"');
    return lines.join('\n');
  }).filter(Boolean).join('\n\n');

  // Build memory context
  var mem = (p.behaviourMemory) || {};
  var memLines = [];
  if (mem.patterns && mem.patterns.length) {
    memLines.push('Known patterns: ' + mem.patterns.slice(0, 4).join('; '));
  }
  if (mem.currentFlags && mem.currentFlags.length) {
    memLines.push('Current flags: ' + mem.currentFlags.slice(0, 4).join(', '));
  }
  if (mem.complianceScore != null) {
    memLines.push('Rolling compliance score: ' + mem.complianceScore + '/100');
  }

  // Build programme context
  var progLines = [];
  progLines.push('Goal: ' + (p.goal || 'body recomposition'));
  progLines.push('Training days/week: ' + (p.trainingDays || 4));
  progLines.push('Calories: ' + (p.calories || 2769) + ' training / ' + (p.restKcal || 2492) + ' rest');
  progLines.push('Protein target: ' + (p.protein || 174) + 'g/day');
  if (p.weekPlan && p.weekPlan.length) {
    var trainDays = p.weekPlan.filter(function(d){ return d.priority === 'training'; })
      .map(function(d){ return d.name + ': ' + (d.type || ''); }).join(', ');
    if (trainDays) progLines.push('Training schedule: ' + trainDays);
  }
  if (p.gapBridge && p.gapBridge.primaryGaps) {
    progLines.push('Key gaps to close: ' + p.gapBridge.primaryGaps.slice(0,2).join('; '));
  }

  var prompt = 'You are a performance coach running a weekly reconciliation pass for ' + p.name + ' (' + p.age + 'yo, ' + p.weight + 'kg).\n\n'
    + 'LAST 7 DAYS:\n' + logLines + '\n\n'
    + (memLines.length ? 'BEHAVIOUR MEMORY:\n' + memLines.join('\n') + '\n\n' : '')
    + 'CURRENT PROGRAMME:\n' + progLines.join('\n') + '\n\n'
    + 'Analyse the week and generate concrete coaching adaptations. Be specific — reference actual numbers, actual days, actual patterns.\n\n'
    + 'Return ONLY valid JSON:\n'
    + '{\n'
    + '  "weekRating": 1-5,\n'
    + '  "headline": "One sentence honest read of the week — specific, not generic",\n'
    + '  "patterns": ["Pattern observed — specific, e.g. \'Energy drops on Thursdays regardless of sleep\'"],\n'
    + '  "adaptations": [\n'
    + '    {\n'
    + '      "type": "training|nutrition|recovery|load",\n'
    + '      "change": "Specific change to make this week",\n'
    + '      "rationale": "Why — reference actual data from the logs",\n'
    + '      "priority": "high|medium"\n'
    + '    }\n'
    + '  ],\n'
    + '  "nextWeekFocus": "The single most important thing to nail next week",\n'
    + '  "coachNote": "2-3 sentences of honest coaching. Reference what actually happened. No cheerleading."\n'
    + '}\n'
    + 'Adaptations: 2-4 maximum. Only flag what genuinely needs changing based on this week\'s data. Return ONLY JSON.';

  var res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      system: 'Performance coach running a data-driven weekly review. Return ONLY valid JSON. No markdown. Be specific — reference actual numbers from the logs.',
      messages: [{ role: 'user', content: prompt }]
    })
  });

  var data = await res.json();
  if (data.error) throw new Error(data.error.message || data.error);

  var raw = (data.content || []).map(function(b){ return b.text || ''; }).join('').trim();
  raw = raw.replace(/```json|```/g, '').trim();
  var result = JSON.parse(raw);

  // Save to profile
  try {
    var profile = JSON.parse(localStorage.getItem('bl_profile') || '{}');
    result.generatedAt = new Date().toISOString();
    result.weekStart = _getWeekStart();
    result.logsAnalysed = logs.filter(Boolean).length;
    profile.weeklyAdaptation = result;
    localStorage.setItem('bl_profile', JSON.stringify(profile));
    // Note: supabase-auth.js intercepts this and syncs to Supabase
  } catch(e) {}

  return result;
}

// ── Render the weekly coaching card on the daily plan page ───────────────
function _renderReconciliationCard() {
  var root = document.getElementById('day-root');
  if (!root) return;

  // Remove any existing card
  var existing = document.getElementById('recon-card');
  if (existing) existing.remove();

  try {
    var p = JSON.parse(localStorage.getItem('bl_profile') || '{}');
    var adapt = p.weeklyAdaptation;
    if (!adapt) return;

    // Only show if from this week
    if (adapt.weekStart !== _getWeekStart()) return;

    var card = document.createElement('div');
    card.id = 'recon-card';
    card.style.cssText = 'max-width:640px;margin:0 auto 20px;padding:0 16px;';
    card.innerHTML = buildReconciliationCardHTML(adapt);
    root.insertBefore(card, root.firstChild);
  } catch(e) {}
}

// Build the HTML for the card
function buildReconciliationCardHTML(adapt) {
  var ratingColor = adapt.weekRating >= 4 ? 'var(--jade)' : adapt.weekRating >= 3 ? 'var(--amber)' : 'rgba(220,100,80,.85)';
  var stars = '';
  for (var i = 1; i <= 5; i++) {
    stars += '<span style="color:' + (i <= adapt.weekRating ? ratingColor : 'rgba(255,255,255,.12)') + ';font-size:12px;">&#9679;</span>';
  }

  var adaptHTML = (adapt.adaptations || []).map(function(a) {
    var typeColors = {
      training: 'var(--jade)',
      nutrition: 'var(--amber)',
      recovery: 'rgba(130,170,255,.8)',
      load: 'rgba(200,130,220,.8)'
    };
    var col = typeColors[a.type] || 'var(--dk-3)';
    var priorityBadge = a.priority === 'high'
      ? '<span style="font-size:8px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:rgba(220,100,80,.85);margin-left:6px;">high priority</span>'
      : '';
    return '<div style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,.05);">'
      + '<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">'
      + '<span style="font-size:9px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:' + col + ';">' + a.type + '</span>'
      + priorityBadge
      + '</div>'
      + '<div style="font-size:13px;font-weight:500;color:var(--dk-1);margin-bottom:3px;">' + a.change + '</div>'
      + '<div style="font-size:11px;font-weight:300;color:var(--dk-3);line-height:1.5;">' + a.rationale + '</div>'
      + '</div>';
  }).join('');

  var patternsHTML = (adapt.patterns || []).map(function(p) {
    return '<div style="font-size:11px;font-weight:300;color:var(--dk-2);padding:3px 0;line-height:1.5;">&#8250; ' + p + '</div>';
  }).join('');

  return '<div style="background:var(--ink-1);border:1px solid rgba(255,255,255,.07);border-radius:12px;padding:20px 22px;border-left:3px solid var(--jade);">'

    // Header row
    + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;">'
    + '<div>'
    + '<div style="font-size:9px;font-weight:700;letter-spacing:.15em;text-transform:uppercase;color:var(--jade);margin-bottom:4px;">Weekly reconciliation</div>'
    + '<div style="font-size:9px;font-weight:700;letter-spacing:.15em;text-transform:uppercase;color:var(--dk-3);">Week of ' + adapt.weekStart + ' &nbsp;&#183;&nbsp; ' + adapt.logsAnalysed + ' days analysed</div>'
    + '</div>'
    + '<div style="display:flex;gap:3px;align-items:center;">' + stars + '</div>'
    + '</div>'

    // Headline
    + '<div style="font-family:var(--serif);font-size:18px;font-weight:300;color:var(--dk-1);line-height:1.3;margin-bottom:14px;">' + (adapt.headline || '') + '</div>'

    // Coach note
    + '<div style="font-size:12px;font-weight:300;color:var(--dk-2);line-height:1.7;margin-bottom:16px;padding-bottom:14px;border-bottom:1px solid rgba(255,255,255,.06);">' + (adapt.coachNote || '') + '</div>'

    // Adaptations
    + (adaptHTML ? '<div style="margin-bottom:14px;">' + adaptHTML + '</div>' : '')

    // Patterns detected
    + (patternsHTML ? '<div style="padding-top:10px;"><div style="font-size:9px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--dk-3);margin-bottom:6px;">Patterns detected</div>' + patternsHTML + '</div>' : '')

    // Next week focus
    + (adapt.nextWeekFocus ? '<div style="margin-top:14px;padding:10px 14px;background:rgba(0,200,160,.05);border-radius:7px;border:1px solid rgba(0,200,160,.12);">'
      + '<div style="font-size:9px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--jade);margin-bottom:4px;">Focus this week</div>'
      + '<div style="font-size:12px;font-weight:300;color:var(--dk-1);line-height:1.5;">' + adapt.nextWeekFocus + '</div>'
      + '</div>' : '')

    // Dismiss button
    + '<div style="margin-top:14px;text-align:right;">'
    + '<button onclick="dismissReconciliationCard()" style="background:none;border:none;font-size:10px;font-weight:600;color:var(--dk-3);cursor:pointer;font-family:var(--sans);letter-spacing:.06em;text-transform:uppercase;">Dismiss &#215;</button>'
    + '</div>'

    + '</div>';
}

function dismissReconciliationCard() {
  var card = document.getElementById('recon-card');
  if (card) card.style.display = 'none';
  // Mark dismissed for today
  try { localStorage.setItem('bl_recon_dismissed_' + new Date().toDateString(), '1'); } catch(e) {}
}

// ── Utility: read last N day logs from localStorage ───────────────────────
function _readRecentLogs(n) {
  var logs = [];
  var today = new Date();
  for (var i = 0; i < n; i++) {
    var d = new Date(today);
    d.setDate(today.getDate() - i);
    var dateStr = d.toISOString().slice(0, 10);
    try {
      var raw = localStorage.getItem('bl_daylog_' + dateStr);
      logs.push(raw ? JSON.parse(raw) : null);
    } catch(e) {
      logs.push(null);
    }
  }
  return logs;
}

// ── Utility: get ISO week string (YYYY-Www) ───────────────────────────────
function _getISOWeek() {
  var d = new Date();
  var dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  var yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  var weekNum = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return d.getUTCFullYear() + '-W' + String(weekNum).padStart(2, '0');
}

// ── Utility: get week start (Monday) as YYYY-MM-DD ─────────────────────────
function _getWeekStart() {
  var d = new Date();
  var day = d.getDay();
  var diff = d.getDate() - (day === 0 ? 6 : day - 1); // Monday
  var monday = new Date(d.setDate(diff));
  return monday.toISOString().slice(0, 10);
}

// ── Surface existing adaptation on page load (no re-run needed) ────────────
function showExistingReconciliation() {
  try {
    var p = JSON.parse(localStorage.getItem('bl_profile') || '{}');
    var adapt = p.weeklyAdaptation;
    if (!adapt) return;
    if (adapt.weekStart !== _getWeekStart()) return;

    // Don't show if dismissed today
    if (localStorage.getItem('bl_recon_dismissed_' + new Date().toDateString())) return;

    _renderReconciliationCard();
  } catch(e) {}
}

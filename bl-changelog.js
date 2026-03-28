// BodyLens — Decision Change Log
// Append-only audit trail. Every programme decision is recorded here.
// Syncs to Supabase automatically via the localStorage.setItem intercept.
//
// Usage:
//   blRecordChange('goals-analysis', 'Goal gap analysis applied', changes, note)
//   blGetChangeLog()
//   blRevertChange(entryId)
//
// Entry structure:
// {
//   id: 'chg_1234567890',
//   ts: ISO string,
//   date: 'YYYY-MM-DD',
//   source: 'goals-analysis' | 'weekly-reconciliation' | 'programme' | 'check-in' | 'manual',
//   trigger: 'Human-readable what caused this',
//   changes: [{ field, label, before, after }],
//   note: 'optional extra context',
//   reverted: false,
//   revertedAt: null,
//   revertedBy: null
// }

var BL_CHANGELOG_KEY = 'bl_changelog';
var BL_CHANGELOG_MAX = 200; // keep last 200 entries

// ── Read ──────────────────────────────────────────────────────────────────────
function blGetChangeLog() {
  try {
    return JSON.parse(localStorage.getItem(BL_CHANGELOG_KEY) || '[]');
  } catch(e) { return []; }
}

// ── Write ─────────────────────────────────────────────────────────────────────
function blSaveChangeLog(log) {
  try {
    // Keep only the most recent MAX entries
    if (log.length > BL_CHANGELOG_MAX) log = log.slice(-BL_CHANGELOG_MAX);
    localStorage.setItem(BL_CHANGELOG_KEY, JSON.stringify(log));
    // supabase-auth.js intercepts bl_changelog writes and syncs automatically
    return true;
  } catch(e) { return false; }
}

// ── Record a decision ─────────────────────────────────────────────────────────
// source:  string key for what system made the change
// trigger: human-readable description of what caused this
// changes: array of { field, label, before, after }
// note:    optional extra context string
function blRecordChange(source, trigger, changes, note) {
  if (!changes || !changes.length) return null;

  var now = new Date();
  var entry = {
    id: 'chg_' + now.getTime() + '_' + Math.random().toString(36).slice(2,6),
    ts: now.toISOString(),
    date: now.toISOString().slice(0, 10),
    source: source || 'manual',
    trigger: trigger || '',
    changes: changes,
    note: note || '',
    reverted: false,
    revertedAt: null,
    revertedBy: null
  };

  var log = blGetChangeLog();
  log.push(entry);
  blSaveChangeLog(log);
  return entry.id;
}

// ── Snapshot helper — capture current programme state before a change ─────────
function blSnapshotProgramme(p) {
  if (!p) return {};
  return {
    weekPlan:     JSON.parse(JSON.stringify(p.weekPlan || [])),
    trainingDays: p.trainingDays,
    trainingKcal: p.trainingKcal,
    restKcal:     p.restKcal,
    protein:      p.protein,
    calories:     p.calories,
  };
}

// ── Diff two snapshots into a changes array ───────────────────────────────────
function blDiffSnapshots(before, after) {
  var changes = [];

  var scalarFields = [
    { field: 'protein',      label: 'Protein target' },
    { field: 'trainingKcal', label: 'Training day calories' },
    { field: 'restKcal',     label: 'Rest day calories' },
    { field: 'trainingDays', label: 'Training days / week' },
  ];

  scalarFields.forEach(function(f) {
    var bval = before[f.field];
    var aval = after[f.field];
    if (bval !== aval && (bval !== undefined || aval !== undefined)) {
      changes.push({ field: f.field, label: f.label, before: bval, after: aval });
    }
  });

  // Diff weekPlan day by day
  var bPlan = before.weekPlan || [];
  var aPlan = after.weekPlan  || [];
  var days  = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
  var maxLen = Math.max(bPlan.length, aPlan.length);
  for (var i = 0; i < maxLen; i++) {
    var bd = bPlan[i] || {};
    var ad = aPlan[i] || {};
    var dayName = days[i] || ('Day ' + (i+1));
    if (bd.type !== ad.type || bd.priority !== ad.priority) {
      changes.push({
        field: 'weekPlan[' + i + ']',
        label: dayName,
        before: bd.type || 'Rest',
        after:  ad.type || 'Rest'
      });
    }
    // Detect keyExercises change
    var bEx = (bd.keyExercises || []).join('|');
    var aEx = (ad.keyExercises || []).join('|');
    if (bEx !== aEx && (bEx || aEx)) {
      changes.push({
        field: 'weekPlan[' + i + '].exercises',
        label: dayName + ' exercises',
        before: bd.keyExercises || [],
        after:  ad.keyExercises || []
      });
    }
  }

  return changes;
}

// ── Revert a change ───────────────────────────────────────────────────────────
function blRevertChange(entryId) {
  var log = blGetChangeLog();
  var entry = null;
  for (var i = 0; i < log.length; i++) {
    if (log[i].id === entryId) { entry = log[i]; break; }
  }
  if (!entry || entry.reverted) return false;

  // Apply the before values back to profile
  try {
    var p = JSON.parse(localStorage.getItem('bl_profile') || '{}');
    var snapshot = blSnapshotProgramme(p); // capture current state before revert

    entry.changes.forEach(function(c) {
      // Scalar field revert
      if (['protein','trainingKcal','restKcal','trainingDays','calories'].indexOf(c.field) >= 0) {
        if (c.before !== undefined) p[c.field] = c.before;
      }
      // WeekPlan day revert
      var dayMatch = c.field.match(/^weekPlan\[(\d+)\]$/);
      if (dayMatch && c.before !== undefined) {
        var idx = parseInt(dayMatch[1]);
        if (p.weekPlan && p.weekPlan[idx]) {
          p.weekPlan[idx].type = c.before;
          p.weekPlan[idx].priority = c.before === 'Rest' ? 'rest' : 'training';
        }
      }
    });

    localStorage.setItem('bl_profile', JSON.stringify(p));

    // Record the revert as its own log entry
    blRecordChange(
      'revert',
      'Reverted: ' + entry.trigger,
      blDiffSnapshots(snapshot, blSnapshotProgramme(p)),
      'Revert of entry ' + entryId + ' (' + entry.date + ')'
    );

    // Mark the original entry as reverted
    entry.reverted   = true;
    entry.revertedAt = new Date().toISOString();
    entry.revertedBy = 'user';
    blSaveChangeLog(log);

    return true;
  } catch(e) {
    console.error('blRevertChange failed:', e);
    return false;
  }
}

// ── Format a change value for display ────────────────────────────────────────
function blFormatChangeValue(val) {
  if (val === null || val === undefined) return '—';
  if (Array.isArray(val)) {
    if (!val.length) return '—';
    return val.slice(0, 3).join(', ') + (val.length > 3 ? ' +' + (val.length - 3) + ' more' : '');
  }
  if (typeof val === 'number') return val.toLocaleString();
  return String(val);
}

// ── Render the full changelog as HTML ────────────────────────────────────────
function blRenderChangeLog(containerId) {
  var el = document.getElementById(containerId);
  if (!el) return;

  var log = blGetChangeLog().slice().reverse(); // newest first

  if (!log.length) {
    el.innerHTML = '<div style="font-size:12px;font-weight:300;color:var(--dk-3);padding:20px 0;">No changes recorded yet. Every programme decision will appear here.</div>';
    return;
  }

  var sourceLabels = {
    'goals-analysis':       'Goal analysis',
    'weekly-reconciliation':'Weekly reconciliation',
    'programme':            'Programme page',
    'check-in':             'Check-in',
    'manual':               'Manual edit',
    'revert':               'Revert',
  };
  var sourceColors = {
    'goals-analysis':        'var(--jade)',
    'weekly-reconciliation': 'var(--amber)',
    'programme':             'var(--dk-3)',
    'check-in':              'var(--dk-3)',
    'manual':                'var(--dk-3)',
    'revert':                'rgba(220,100,60,.8)',
  };

  var html = '';
  log.forEach(function(entry) {
    var col = sourceColors[entry.source] || 'var(--dk-3)';
    var label = sourceLabels[entry.source] || entry.source;
    var isReverted = entry.reverted;

    html += '<div style="padding:14px 0;border-bottom:1px solid rgba(255,255,255,.05);' + (isReverted ? 'opacity:.5;' : '') + '">';

    // Header row
    html += '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:8px;">';
    html += '<div>';
    html += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:3px;">';
    html += '<span style="font-size:9px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:' + col + ';">' + label + '</span>';
    if (isReverted) {
      html += '<span style="font-size:9px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:rgba(220,100,60,.7);background:rgba(220,100,60,.08);padding:2px 6px;border-radius:3px;">Reverted</span>';
    }
    html += '</div>';
    html += '<div style="font-size:12px;font-weight:500;color:var(--dk-1);">' + (entry.trigger || '') + '</div>';
    html += '<div style="font-size:10px;font-weight:300;color:var(--dk-3);margin-top:2px;">' + entry.date + (entry.note ? ' · ' + entry.note : '') + '</div>';
    html += '</div>';

    // Revert button
    if (!isReverted && entry.source !== 'revert') {
      html += '<button onclick="blRevertAndRefresh(\'' + entry.id + '\')" style="background:none;border:1px solid rgba(255,255,255,.12);color:var(--dk-3);font-family:var(--sans);font-size:9px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;padding:5px 10px;border-radius:5px;cursor:pointer;flex-shrink:0;white-space:nowrap;">Revert</button>';
    }
    html += '</div>';

    // Changes table
    if (entry.changes && entry.changes.length) {
      html += '<div style="background:rgba(0,0,0,.2);border-radius:7px;overflow:hidden;">';
      // Header
      html += '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;padding:5px 10px;background:rgba(0,0,0,.2);">';
      html += '<div style="font-size:9px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--dk-3);">Field</div>';
      html += '<div style="font-size:9px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--dk-3);">Before</div>';
      html += '<div style="font-size:9px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--jade);">After</div>';
      html += '</div>';
      entry.changes.forEach(function(c, ci) {
        var isLast = ci === entry.changes.length - 1;
        html += '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;padding:6px 10px;' + (!isLast ? 'border-bottom:1px solid rgba(255,255,255,.04);' : '') + '">';
        html += '<div style="font-size:11px;font-weight:500;color:var(--dk-2);">' + (c.label || c.field) + '</div>';
        html += '<div style="font-size:11px;font-weight:300;color:var(--dk-3);">' + blFormatChangeValue(c.before) + '</div>';
        html += '<div style="font-size:11px;font-weight:600;color:var(--dk-1);">' + blFormatChangeValue(c.after) + '</div>';
        html += '</div>';
      });
      html += '</div>';
    }

    html += '</div>';
  });

  el.innerHTML = html;
}

// ── Revert + refresh page ─────────────────────────────────────────────────────
function blRevertAndRefresh(entryId) {
  var ok = blRevertChange(entryId);
  if (ok) {
    // Clear day plan cache so it regenerates
    try {
      var todayKey = 'dayplan_v6r3_' + new Date().toISOString().slice(0,10);
      localStorage.removeItem(todayKey);
    } catch(e) {}
    // Refresh the page to show new state
    window.location.reload();
  } else {
    alert('Revert failed — check console for details.');
  }
}

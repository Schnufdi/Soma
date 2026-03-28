// BodyLens — Proposal Bus
// Every programme recommendation flows through here before being applied.
// Surfaces on the Week page as a review queue. Full audit log on commit/dismiss.
//
// SOURCES: 'goals' | 'coach' | 'body-scan' | 'reconciliation' | 'accelerator' | 'programme' | 'manual'
//
// FLOW:
//   blPropose(source, title, changes, context, expires?)
//     → writes to profile.pendingProposals[]
//   blCommitProposal(id)
//     → applies changes, moves to profile.proposalLog[]
//   blDismissProposal(id)
//     → moves to profile.proposalLog[] with status 'dismissed'
//   blRevertProposal(id)
//     → creates a new proposal that undoes a committed change

var BL_PROPOSALS_KEY = 'bl_proposals';
var BL_PROPOSAL_LOG_KEY = 'bl_proposal_log';
var BL_PROPOSAL_LOG_MAX = 500;

// ── Source display config ─────────────────────────────────────────────────────
var BL_PROPOSAL_SOURCES = {
  'goals':          { label: 'Goal analysis',        color: 'var(--jade)',              icon: '◎' },
  'coach':          { label: 'Coach',                 color: 'rgba(120,180,255,.85)',    icon: '◈' },
  'body-scan':      { label: 'Body scan',             color: 'var(--amber)',             icon: '◉' },
  'reconciliation': { label: 'Weekly reconciliation', color: 'rgba(180,130,255,.85)',    icon: '◆' },
  'accelerator':    { label: 'Accelerator',           color: 'rgba(0,200,160,.7)',       icon: '◇' },
  'programme':      { label: 'Programme update',      color: 'var(--dk-3)',              icon: '○' },
  'manual':         { label: 'Manual edit',           color: 'var(--dk-3)',              icon: '○' },
};

// ── Storage helpers ───────────────────────────────────────────────────────────
function blGetPending() {
  try { return JSON.parse(localStorage.getItem(BL_PROPOSALS_KEY) || '[]'); }
  catch(e) { return []; }
}

function blSavePending(arr) {
  try { localStorage.setItem(BL_PROPOSALS_KEY, JSON.stringify(arr)); return true; }
  catch(e) { return false; }
}

function blGetProposalLog() {
  try { return JSON.parse(localStorage.getItem(BL_PROPOSAL_LOG_KEY) || '[]'); }
  catch(e) { return []; }
}

function blSaveProposalLog(arr) {
  try {
    if (arr.length > BL_PROPOSAL_LOG_MAX) arr = arr.slice(-BL_PROPOSAL_LOG_MAX);
    localStorage.setItem(BL_PROPOSAL_LOG_KEY, JSON.stringify(arr));
    return true;
  } catch(e) { return false; }
}

// ── Propose a change ──────────────────────────────────────────────────────────
// source:  string key from BL_PROPOSAL_SOURCES
// title:   short human description, e.g. "Raise protein to 185g"
// changes: [{ field, label, before, after }]
// context: why — rationale, evidence, source detail
// expires: optional ISO date string after which proposal auto-dismisses
function blPropose(source, title, changes, context, expires) {
  if (!changes || !changes.length) return null;
  var now = new Date();
  var proposal = {
    id:      'prop_' + now.getTime() + '_' + Math.random().toString(36).slice(2,5),
    ts:      now.toISOString(),
    date:    now.toISOString().slice(0,10),
    source:  source || 'manual',
    title:   title || '',
    changes: changes,
    context: context || '',
    expires: expires || null,
    status:  'pending',
  };
  var pending = blGetPending();
  // Deduplicate: remove any existing pending proposal from same source with same title
  pending = pending.filter(function(p) {
    return !(p.source === proposal.source && p.title === proposal.title && p.status === 'pending');
  });
  pending.push(proposal);
  blSavePending(pending);
  return proposal.id;
}

// ── Snapshot current programme state ─────────────────────────────────────────
function blSnapshotProgramme(p) {
  if (!p) return {};
  return {
    weekPlan:     JSON.parse(JSON.stringify(p.weekPlan || [])),
    trainingDays: p.trainingDays,
    trainingKcal: p.trainingKcal,
    restKcal:     p.restKcal,
    protein:      p.protein,
    calories:     p.calories,
    goal:         p.goal,
    coachNotes:   p.coachNotes || '',
  };
}

// ── Apply a set of field changes to the profile ───────────────────────────────
function blApplyChanges(p, changes) {
  changes.forEach(function(c) {
    var f = c.field;
    var val = c.after;
    if (val === undefined) return;
    // Scalar fields
    var scalars = ['protein','trainingKcal','restKcal','trainingDays','calories','goal','coachNotes'];
    if (scalars.indexOf(f) >= 0) {
      p[f] = val;
      return;
    }
    // WeekPlan day type
    var dayMatch = f.match(/^weekPlan\[(\d+)\]\.type$/);
    if (dayMatch) {
      var idx = parseInt(dayMatch[1]);
      if (p.weekPlan && p.weekPlan[idx]) {
        p.weekPlan[idx].type = val;
        p.weekPlan[idx].priority = (val === 'Rest') ? 'rest' : 'training';
      }
      return;
    }
    // WeekPlan day exercises
    var exMatch = f.match(/^weekPlan\[(\d+)\]\.keyExercises$/);
    if (exMatch) {
      var idx2 = parseInt(exMatch[1]);
      if (p.weekPlan && p.weekPlan[idx2]) p.weekPlan[idx2].keyExercises = val;
      return;
    }
    // Injuries append
    if (f === 'injuries.push') {
      if (!p.injuries) p.injuries = [];
      p.injuries.push(val);
      return;
    }
    // Overlays append
    if (f === 'overlays.push') {
      if (!p.overlays) p.overlays = [];
      p.overlays.push(val);
      return;
    }
    // coachNotes append
    if (f === 'coachNotes.append') {
      p.coachNotes = (p.coachNotes || '') + '\n' + val;
      return;
    }
    // Generic nested: gapBridge.applied etc — just record in coachNotes
    if (f.startsWith('gapBridge.')) {
      if (!p.gapBridge) p.gapBridge = {};
      var sub = f.replace('gapBridge.','');
      p.gapBridge[sub] = val;
    }
  });
  return p;
}

// ── Commit a proposal ─────────────────────────────────────────────────────────
function blCommitProposal(id) {
  var pending = blGetPending();
  var idx = -1;
  for (var i = 0; i < pending.length; i++) {
    if (pending[i].id === id) { idx = i; break; }
  }
  if (idx < 0) return false;

  var proposal = pending[idx];

  try {
    var p = JSON.parse(localStorage.getItem('bl_profile') || '{}');

    // Apply each change
    blApplyChanges(p, proposal.changes);

    p.lastUpdated = new Date().toISOString();
    // Clear day plan cache
    try { localStorage.removeItem('dayplan_v6r3_' + new Date().toISOString().slice(0,10)); } catch(e) {}

    localStorage.setItem('bl_profile', JSON.stringify(p));

    // Move to log
    proposal.status = 'committed';
    proposal.committedAt = new Date().toISOString();
    var log = blGetProposalLog();
    log.push(proposal);
    blSaveProposalLog(log);

    // Remove from pending
    pending.splice(idx, 1);
    blSavePending(pending);

    return true;
  } catch(e) {
    console.error('blCommitProposal failed:', e);
    return false;
  }
}

// ── Dismiss a proposal ────────────────────────────────────────────────────────
function blDismissProposal(id) {
  var pending = blGetPending();
  var idx = -1;
  for (var i = 0; i < pending.length; i++) {
    if (pending[i].id === id) { idx = i; break; }
  }
  if (idx < 0) return false;

  var proposal = pending[idx];
  proposal.status = 'dismissed';
  proposal.dismissedAt = new Date().toISOString();

  var log = blGetProposalLog();
  log.push(proposal);
  blSaveProposalLog(log);

  pending.splice(idx, 1);
  blSavePending(pending);
  return true;
}

// ── Revert a committed proposal ───────────────────────────────────────────────
// Creates a NEW proposal that reverses the committed changes — goes through review
function blRevertProposal(logId) {
  var log = blGetProposalLog();
  var entry = null;
  for (var i = 0; i < log.length; i++) {
    if (log[i].id === logId && log[i].status === 'committed') { entry = log[i]; break; }
  }
  if (!entry) return null;

  // Build reverse changes
  var reverseChanges = entry.changes.map(function(c) {
    return { field: c.field, label: c.label, before: c.after, after: c.before };
  }).filter(function(c) { return c.after !== undefined; });

  if (!reverseChanges.length) return null;

  return blPropose(
    'manual',
    'Revert: ' + entry.title,
    reverseChanges,
    'Reverting changes from ' + entry.date + ' (' + (BL_PROPOSAL_SOURCES[entry.source] || {label:entry.source}).label + ')',
    null
  );
}

// ── Format value for display ──────────────────────────────────────────────────
function blFormatVal(val) {
  if (val === null || val === undefined) return '—';
  if (Array.isArray(val)) {
    if (!val.length) return '—';
    if (typeof val[0] === 'object') return val.length + ' items';
    return val.slice(0,3).join(', ') + (val.length > 3 ? ' +' + (val.length-3) : '');
  }
  if (typeof val === 'object') return JSON.stringify(val).slice(0,60);
  if (typeof val === 'number') return val.toLocaleString();
  return String(val);
}

// ── Render the pending proposals panel ───────────────────────────────────────
function blRenderProposals(containerId, onAction) {
  var el = document.getElementById(containerId);
  if (!el) return;

  // Expire old proposals
  var now = new Date();
  var pending = blGetPending().filter(function(p) {
    if (!p.expires) return true;
    return new Date(p.expires) > now;
  });
  blSavePending(pending);

  if (!pending.length) {
    el.innerHTML = '<div style="font-size:12px;font-weight:300;color:var(--dk-3);padding:16px 0;">No pending proposals.</div>';
    return;
  }

  var html = '';
  pending.slice().reverse().forEach(function(prop) {
    var src = BL_PROPOSAL_SOURCES[prop.source] || { label: prop.source, color: 'var(--dk-3)', icon: '○' };

    html += '<div style="background:var(--ink-1);border:1px solid rgba(255,255,255,.08);border-left:3px solid ' + src.color + ';border-radius:10px;padding:16px 18px;margin-bottom:10px;">';

    // Header
    html += '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:10px;">';
    html += '<div>';
    html += '<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">';
    html += '<span style="font-size:9px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:' + src.color + ';">' + src.label + '</span>';
    html += '<span style="font-size:10px;font-weight:300;color:var(--dk-3);">' + prop.date + '</span>';
    html += '</div>';
    html += '<div style="font-family:var(--serif);font-size:16px;font-weight:300;color:var(--dk-1);line-height:1.2;">' + prop.title + '</div>';
    if (prop.context) html += '<div style="font-size:11px;font-weight:300;color:var(--dk-3);margin-top:4px;line-height:1.5;">' + prop.context + '</div>';
    html += '</div>';
    html += '</div>';

    // Before/after table
    if (prop.changes && prop.changes.length) {
      html += '<div style="background:rgba(0,0,0,.25);border-radius:7px;overflow:hidden;margin-bottom:12px;">';
      html += '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;padding:6px 12px;background:rgba(0,0,0,.2);">';
      html += '<div style="font-size:9px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--dk-3);">Field</div>';
      html += '<div style="font-size:9px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--dk-3);">Before</div>';
      html += '<div style="font-size:9px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:' + src.color + ';">After</div>';
      html += '</div>';
      prop.changes.forEach(function(c, ci) {
        var isLast = ci === prop.changes.length - 1;
        html += '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;padding:7px 12px;' + (!isLast ? 'border-bottom:1px solid rgba(255,255,255,.04);' : '') + '">';
        html += '<div style="font-size:11px;font-weight:500;color:var(--dk-2);">' + (c.label || c.field) + '</div>';
        html += '<div style="font-size:11px;font-weight:300;color:var(--dk-3);">' + blFormatVal(c.before) + '</div>';
        html += '<div style="font-size:11px;font-weight:600;color:var(--dk-1);">' + blFormatVal(c.after) + '</div>';
        html += '</div>';
      });
      html += '</div>';
    }

    // Actions
    html += '<div style="display:flex;gap:8px;align-items:center;">';
    html += '<button onclick="blHandleProposalAction(\'' + prop.id + '\',\'commit\')" style="background:var(--jade);color:#0c1010;font-family:var(--sans);font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;padding:8px 16px;border:none;border-radius:5px;cursor:pointer;">Apply &#8594;</button>';
    html += '<button onclick="blHandleProposalAction(\'' + prop.id + '\',\'dismiss\')" style="background:none;border:1px solid rgba(255,255,255,.12);color:var(--dk-3);font-family:var(--sans);font-size:10px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;padding:7px 14px;border-radius:5px;cursor:pointer;">Dismiss</button>';
    html += '</div>';

    html += '</div>';
  });

  el.innerHTML = html;
}

// ── Render the committed log ──────────────────────────────────────────────────
function blRenderProposalLog(containerId) {
  var el = document.getElementById(containerId);
  if (!el) return;

  var log = blGetProposalLog().slice().reverse();
  if (!log.length) {
    el.innerHTML = '<div style="font-size:12px;font-weight:300;color:var(--dk-3);padding:16px 0;">No decisions recorded yet.</div>';
    return;
  }

  var html = '';
  log.forEach(function(entry) {
    var src = BL_PROPOSAL_SOURCES[entry.source] || { label: entry.source, color: 'var(--dk-3)' };
    var isCommitted = entry.status === 'committed';
    var isDismissed = entry.status === 'dismissed';
    var statusColor = isCommitted ? 'var(--jade)' : 'var(--dk-3)';
    var statusLabel = isCommitted ? 'Applied' : 'Dismissed';

    html += '<div style="padding:12px 0;border-bottom:1px solid rgba(255,255,255,.05);">';
    html += '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin-bottom:6px;">';
    html += '<div>';
    html += '<div style="display:flex;align-items:center;gap:6px;margin-bottom:3px;">';
    html += '<span style="font-size:9px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:' + src.color + ';">' + src.label + '</span>';
    html += '<span style="font-size:9px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:' + statusColor + ';background:rgba(255,255,255,.04);padding:2px 6px;border-radius:3px;">' + statusLabel + '</span>';
    html += '<span style="font-size:10px;font-weight:300;color:var(--dk-3);">' + entry.date + '</span>';
    html += '</div>';
    html += '<div style="font-size:12px;font-weight:500;color:var(--dk-1);">' + entry.title + '</div>';
    html += '</div>';
    if (isCommitted) {
      html += '<button onclick="blHandleProposalAction(\'' + entry.id + '\',\'revert\')" style="background:none;border:1px solid rgba(255,255,255,.1);color:var(--dk-3);font-family:var(--sans);font-size:9px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;padding:5px 10px;border-radius:4px;cursor:pointer;flex-shrink:0;">Revert</button>';
    }
    html += '</div>';
    // Compact changes
    if (entry.changes && entry.changes.length) {
      html += '<div style="display:flex;flex-wrap:wrap;gap:4px;">';
      entry.changes.forEach(function(c) {
        html += '<span style="font-size:10px;font-weight:300;color:var(--dk-3);background:rgba(255,255,255,.04);border-radius:3px;padding:2px 7px;">';
        html += (c.label || c.field) + ': ' + blFormatVal(c.before) + ' → ' + blFormatVal(c.after);
        html += '</span>';
      });
      html += '</div>';
    }
    html += '</div>';
  });
  el.innerHTML = html;
}

// ── Central action handler (called from rendered buttons) ─────────────────────
function blHandleProposalAction(id, action) {
  if (action === 'commit') {
    var ok = blCommitProposal(id);
    if (ok && typeof blRefreshProposalUI === 'function') blRefreshProposalUI();
  } else if (action === 'dismiss') {
    blDismissProposal(id);
    if (typeof blRefreshProposalUI === 'function') blRefreshProposalUI();
  } else if (action === 'revert') {
    var newId = blRevertProposal(id);
    if (newId && typeof blRefreshProposalUI === 'function') blRefreshProposalUI();
  }
}

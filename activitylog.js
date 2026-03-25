/* ================================================================
   BodyLens Activity Log Engine  —  activitylog.js
   Shared module: loaded by dailyplan + week pages
   Pure ASCII. No emoji in code strings.
   ================================================================ */

/* ---- Activity Classification Matrix ---- */
var ACTIVITY_TYPES = {
  /* Gym / resistance */
  'gym-push':        { label:'Push session',        role:['strength-upper'],                  fatigue:4, goalPct:{hypertrophy:100,conditioning:10,mobility:0,recovery:0},  subValue:{push:100,pull:0,posterior:0,upper:80,cardio:0,rest:0} },
  'gym-pull':        { label:'Pull session',         role:['strength-upper'],                  fatigue:4, goalPct:{hypertrophy:100,conditioning:10,mobility:0,recovery:0},  subValue:{push:0,pull:100,posterior:0,upper:80,cardio:0,rest:0} },
  'gym-lower':       { label:'Lower body session',   role:['strength-lower'],                  fatigue:4, goalPct:{hypertrophy:100,conditioning:10,mobility:0,recovery:0},  subValue:{push:0,pull:0,posterior:60,upper:0,cardio:0,rest:0} },
  'gym-posterior':   { label:'Posterior chain',      role:['strength-lower'],                  fatigue:5, goalPct:{hypertrophy:100,conditioning:15,mobility:0,recovery:0},  subValue:{push:0,pull:0,posterior:100,upper:30,cardio:0,rest:0} },
  'gym-upper':       { label:'Upper body session',   role:['strength-upper'],                  fatigue:4, goalPct:{hypertrophy:100,conditioning:10,mobility:0,recovery:0},  subValue:{push:70,pull:70,posterior:0,upper:100,cardio:0,rest:0} },
  'gym-full':        { label:'Full body session',    role:['strength-upper','strength-lower'],  fatigue:5, goalPct:{hypertrophy:90,conditioning:15,mobility:0,recovery:0},   subValue:{push:60,pull:60,posterior:60,upper:60,cardio:0,rest:0} },
  /* Cardio */
  'spin':            { label:'Spin class',           role:['conditioning-high','cardio-intervals'], fatigue:3, goalPct:{hypertrophy:0,conditioning:90,mobility:0,recovery:0},   subValue:{push:0,pull:0,posterior:10,upper:0,cardio:100,rest:0} },
  'hiit':            { label:'HIIT class',           role:['conditioning-high'],               fatigue:4, goalPct:{hypertrophy:5,conditioning:85,mobility:0,recovery:0},   subValue:{push:0,pull:0,posterior:5,upper:5,cardio:80,rest:0} },
  'running':         { label:'Running',              role:['cardio-aerobic'],                  fatigue:3, goalPct:{hypertrophy:0,conditioning:80,mobility:0,recovery:0},   subValue:{push:0,pull:0,posterior:10,upper:0,cardio:90,rest:0} },
  'cycling':         { label:'Cycling',              role:['cardio-aerobic'],                  fatigue:2, goalPct:{hypertrophy:0,conditioning:75,mobility:0,recovery:0},   subValue:{push:0,pull:0,posterior:5,upper:0,cardio:85,rest:0} },
  'swimming':        { label:'Swimming',             role:['cardio-aerobic','strength-upper'],  fatigue:3, goalPct:{hypertrophy:10,conditioning:80,mobility:10,recovery:10},  subValue:{push:20,pull:30,posterior:10,upper:20,cardio:70,rest:0} },
  'rowing':          { label:'Rowing',               role:['cardio-aerobic','strength-upper'],  fatigue:3, goalPct:{hypertrophy:10,conditioning:85,mobility:0,recovery:0},   subValue:{push:10,pull:40,posterior:20,upper:15,cardio:80,rest:0} },
  'walking':         { label:'Walking',              role:['cardio-aerobic'],                  fatigue:1, goalPct:{hypertrophy:0,conditioning:20,mobility:5,recovery:15},   subValue:{push:0,pull:0,posterior:0,upper:0,cardio:20,rest:30} },
  /* Yoga / mobility */
  'vinyasa':         { label:'Vinyasa yoga',         role:['mobility','conditioning-moderate'], fatigue:2, goalPct:{hypertrophy:5,conditioning:25,mobility:70,recovery:30},  subValue:{push:10,pull:10,posterior:10,upper:10,cardio:20,rest:40} },
  'yin-yoga':        { label:'Yin yoga',             role:['mobility','recovery'],              fatigue:1, goalPct:{hypertrophy:0,conditioning:0,mobility:90,recovery:50},   subValue:{push:0,pull:0,posterior:5,upper:0,cardio:0,rest:60} },
  'hot-yoga':        { label:'Hot yoga',             role:['mobility','conditioning-moderate'], fatigue:2, goalPct:{hypertrophy:0,conditioning:30,mobility:75,recovery:25},  subValue:{push:5,pull:5,posterior:5,upper:5,cardio:25,rest:35} },
  'stretch':         { label:'Stretch / mobility',   role:['mobility','recovery'],              fatigue:1, goalPct:{hypertrophy:0,conditioning:0,mobility:80,recovery:40},   subValue:{push:0,pull:0,posterior:5,upper:0,cardio:0,rest:55} },
  'pilates':         { label:'Pilates',              role:['mobility','strength-lower'],        fatigue:2, goalPct:{hypertrophy:15,conditioning:20,mobility:65,recovery:20},  subValue:{push:5,pull:10,posterior:30,upper:10,cardio:10,rest:30} },
  /* Recovery */
  'nidra':           { label:'Yoga nidra',           role:['recovery','nervous-system'],        fatigue:-1, goalPct:{hypertrophy:0,conditioning:0,mobility:0,recovery:80},   subValue:{push:0,pull:0,posterior:0,upper:0,cardio:0,rest:80} },
  'sauna':           { label:'Sauna',                role:['recovery'],                        fatigue:1, goalPct:{hypertrophy:0,conditioning:5,mobility:0,recovery:65},    subValue:{push:0,pull:0,posterior:0,upper:0,cardio:0,rest:70} },
  'cold-water':      { label:'Cold water / ice bath', role:['recovery'],                       fatigue:1, goalPct:{hypertrophy:0,conditioning:0,mobility:0,recovery:70},    subValue:{push:0,pull:0,posterior:0,upper:0,cardio:0,rest:65} },
  /* Classes */
  'bootcamp':        { label:'Bootcamp class',       role:['conditioning-high','strength-full'], fatigue:4, goalPct:{hypertrophy:20,conditioning:80,mobility:0,recovery:0},  subValue:{push:30,pull:20,posterior:30,upper:25,cardio:70,rest:0} },
  'crossfit':        { label:'CrossFit',             role:['conditioning-high','strength-full'], fatigue:5, goalPct:{hypertrophy:30,conditioning:85,mobility:5,recovery:0},  subValue:{push:50,pull:50,posterior:40,upper:40,cardio:70,rest:0} },
  'boxing':          { label:'Boxing / martial arts', role:['conditioning-high'],               fatigue:4, goalPct:{hypertrophy:10,conditioning:90,mobility:5,recovery:0},   subValue:{push:20,pull:10,posterior:5,upper:20,cardio:90,rest:0} },
  'dance':           { label:'Dance class',          role:['conditioning-moderate','mobility'],  fatigue:2, goalPct:{hypertrophy:0,conditioning:50,mobility:40,recovery:5},   subValue:{push:0,pull:0,posterior:5,upper:0,cardio:50,rest:20} },
  'other':           { label:'Other activity',       role:['conditioning-moderate'],            fatigue:2, goalPct:{hypertrophy:10,conditioning:50,mobility:10,recovery:10},  subValue:{push:10,pull:10,posterior:10,upper:10,cardio:40,rest:10} }
};

/* ---- Storage helpers ---- */
function alKey(dateStr) { return 'bl_actlog_' + dateStr; }
function wlKey() {
  var d = new Date(), day = d.getDay();
  var mon = new Date(d);
  mon.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
  return 'bl_weekledger_' + mon.toISOString().slice(0, 10);
}

function loadActivities(dateStr) {
  try { var r = localStorage.getItem(alKey(dateStr)); return r ? JSON.parse(r) : []; }
  catch(e) { return []; }
}

function saveActivity(dateStr, activity) {
  var list = loadActivities(dateStr);
  list.push(activity);
  try { localStorage.setItem(alKey(dateStr), JSON.stringify(list)); } catch(e) {}
  rebuildWeekLedger();
}

function deleteActivity(dateStr, idx) {
  var list = loadActivities(dateStr);
  list.splice(idx, 1);
  try { localStorage.setItem(alKey(dateStr), JSON.stringify(list)); } catch(e) {}
  rebuildWeekLedger();
}

/* ---- Classify an activity ---- */
function classifyActivity(typeKey, durationMins, rpe) {
  var def = ACTIVITY_TYPES[typeKey] || ACTIVITY_TYPES['other'];
  var intensityMult = rpe ? (rpe / 7) : 1.0;
  var fatigueCost = Math.round(def.fatigue * intensityMult * (durationMins / 45));
  return {
    typeKey: typeKey,
    label: def.label,
    role: def.role,
    durationMins: durationMins,
    rpe: rpe,
    fatigueCost: Math.min(10, Math.max(0, fatigueCost)),
    goalPct: def.goalPct,
    subValue: def.subValue
  };
}

/* ---- Substitution assessment ---- */
/* plannedType: 'push' | 'pull' | 'posterior' | 'upper' | 'cardio' | 'rest' */
function assessSubstitution(classifiedActivity, plannedType) {
  if (!plannedType) return { level: 'additive', pct: 0, label: 'Additive', note: 'Not a planned session — additional value.' };
  var pct = (classifiedActivity.subValue[plannedType] || 0);
  if (pct >= 85) return { level: 'full',    pct: pct, label: 'Full substitute',    note: 'Covers the intended stimulus.' };
  if (pct >= 40) return { level: 'partial', pct: pct, label: 'Partial substitute', note: 'Some stimulus covered. Strength gap may remain.' };
  if (pct > 0)   return { level: 'minimal', pct: pct, label: 'Minimal substitute', note: 'Different stimulus. Counts as additive only.' };
  return           { level: 'none',    pct: 0,   label: 'Non-substitute',   note: 'Does not cover this session type.' };
}

/* ---- Weekly ledger rebuild ---- */
function rebuildWeekLedger() {
  var p = getProfileAL();
  if (!p) return;

  var weekPlan = p.weekPlan || [];
  var d = new Date();
  var day = d.getDay();
  var monday = new Date(d);
  monday.setDate(d.getDate() - (day === 0 ? 6 : day - 1));

  var ledger = {
    weekStart: monday.toISOString().slice(0, 10),
    days: {},
    summary: {
      fatigueTotal: 0,
      fatigueLevel: 'low',
      strengthCovered: [],
      strengthMissing: [],
      conditioningDone: false,
      mobilityMins: 0,
      recoveryDone: false,
      sessionsPlanned: 0,
      sessionsDone: 0,
      sessionsMissed: 0,
      weeksGoalStatus: 'on-track'
    }
  };

  var DAY_NAMES = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
  var today = new Date();
  today.setHours(0,0,0,0);

  DAY_NAMES.forEach(function(dayName, i) {
    var dt = new Date(monday);
    dt.setDate(monday.getDate() + i);
    var dateStr = dt.toISOString().slice(0, 10);
    var isPast = dt <= today;

    var wp = weekPlan[i] || { type: 'Rest', priority: 'rest' };
    var isTraining = wp.priority === 'training';
    var plannedType = getPlannedType(wp.type);

    var daylog = loadDayLogAL(dateStr);
    var activities = loadActivities(dateStr);

    var trainStatus = daylog ? daylog.trainStatus : 'pending';
    var exercises = daylog ? (daylog.exercises || {}) : {};
    var exerciseDone = Object.values(exercises).filter(function(e){ return e.status === 'done'; }).length;
    var exerciseTotal = Object.keys(exercises).length;

    /* Classify all logged activities for this day */
    var classified = activities.map(function(a) {
      var c = classifyActivity(a.typeKey, a.durationMins, a.rpe);
      c.sub = assessSubstitution(c, plannedType);
      c.loggedAt = a.loggedAt;
      c.note = a.note || '';
      return c;
    });

    /* Also count gym session if logged as done */
    if (isTraining && trainStatus === 'done') {
      var gymType = plannedType === 'push' ? 'gym-push'
                  : plannedType === 'pull' ? 'gym-pull'
                  : plannedType === 'posterior' ? 'gym-posterior'
                  : plannedType === 'upper' ? 'gym-upper'
                  : 'gym-full';
      var gymEntry = classifyActivity(gymType, 60, 7);
      gymEntry.sub = assessSubstitution(gymEntry, plannedType);
      gymEntry.label = wp.type + ' (gym)';
      gymEntry.isPlannedSession = true;
      classified.unshift(gymEntry);
    }

    /* Best substitution coverage for this day */
    var bestSub = null;
    classified.forEach(function(c) {
      if (!bestSub || c.sub.pct > bestSub.pct) bestSub = c.sub;
    });

    /* Determine day status */
    var dayStatus = 'pending';
    if (!isPast) {
      dayStatus = 'upcoming';
    } else if (!isTraining) {
      dayStatus = 'rest';
      /* Check if recovery or mobility was done */
      classified.forEach(function(c) {
        if (c.role.indexOf('recovery') >= 0 || c.role.indexOf('mobility') >= 0) {
          dayStatus = 'rest-active';
        }
      });
    } else if (trainStatus === 'done') {
      dayStatus = 'done';
    } else if (trainStatus === 'skipped' && classified.length === 0) {
      dayStatus = 'missed';
    } else if (classified.length > 0) {
      var topSub = bestSub ? bestSub.level : 'none';
      dayStatus = topSub === 'full' ? 'substituted' : topSub === 'partial' ? 'partial' : 'missed';
    } else if (isPast && isTraining) {
      dayStatus = 'missed';
    }

    ledger.days[dayName] = {
      date: dateStr,
      isPast: isPast,
      planned: { type: wp.type, priority: wp.priority, plannedType: plannedType, isTraining: isTraining },
      status: dayStatus,
      trainStatus: trainStatus,
      activities: classified,
      bestSub: bestSub,
      exerciseDone: exerciseDone,
      exerciseTotal: exerciseTotal,
      fatigueCost: classified.reduce(function(sum, c){ return sum + (c.fatigueCost||0); }, 0)
    };
  });

  /* ---- Build summary ---- */
  var summary = ledger.summary;
  var strengthTypes = ['push','pull','posterior','upper'];

  DAY_NAMES.forEach(function(dayName) {
    var day = ledger.days[dayName];
    if (!day.isPast) return;

    summary.fatigueTotal += day.fatigueCost;
    if (day.planned.isTraining) {
      summary.sessionsPlanned++;
      if (day.status === 'done' || day.status === 'substituted') summary.sessionsDone++;
      else if (day.status === 'missed') summary.sessionsMissed++;
    }

    /* Strength coverage */
    if (day.status === 'done' || day.status === 'substituted' || day.status === 'partial') {
      var pt = day.planned.plannedType;
      if (pt && strengthTypes.indexOf(pt) >= 0) {
        var pct = day.bestSub ? day.bestSub.pct : (day.status === 'done' ? 100 : 0);
        if (pct >= 70 && summary.strengthCovered.indexOf(pt) < 0) {
          summary.strengthCovered.push(pt);
        }
      }
    }

    /* Conditioning */
    day.activities.forEach(function(a) {
      if (a.role.indexOf('conditioning-high') >= 0 || a.role.indexOf('cardio-aerobic') >= 0) {
        summary.conditioningDone = true;
      }
      if (a.role.indexOf('mobility') >= 0) {
        summary.mobilityMins += (a.durationMins || 0);
      }
      if (a.role.indexOf('recovery') >= 0 || a.role.indexOf('nervous-system') >= 0) {
        summary.recoveryDone = true;
      }
    });
  });

  /* Missing strength sessions */
  strengthTypes.forEach(function(t) {
    var planned = DAY_NAMES.some(function(dn) {
      var d = ledger.days[dn];
      return d.planned.isTraining && d.planned.plannedType === t;
    });
    if (planned && summary.strengthCovered.indexOf(t) < 0) {
      /* Only flag past days */
      var isPastDay = DAY_NAMES.some(function(dn) {
        var d = ledger.days[dn];
        return d.planned.plannedType === t && d.isPast;
      });
      if (isPastDay) summary.strengthMissing.push(t);
    }
  });

  /* Fatigue level */
  summary.fatigueLevel = summary.fatigueTotal >= 14 ? 'peak'
    : summary.fatigueTotal >= 9  ? 'high'
    : summary.fatigueTotal >= 5  ? 'moderate'
    : 'low';

  /* Week goal status */
  var completionRate = summary.sessionsPlanned > 0
    ? summary.sessionsDone / summary.sessionsPlanned : 1;
  summary.weeksGoalStatus = completionRate >= 0.75 ? 'on-track'
    : completionRate >= 0.5 ? 'at-risk' : 'off-plan';

  /* Save */
  try { localStorage.setItem(wlKey(), JSON.stringify(ledger)); } catch(e) {}
  return ledger;
}

function loadWeekLedger() {
  try { var r = localStorage.getItem(wlKey()); return r ? JSON.parse(r) : null; }
  catch(e) { return null; }
}

/* ---- Coach recommendation engine ---- */
function getCoachRecommendation(ledger) {
  if (!ledger) return null;
  var s = ledger.summary;
  var recs = [];

  /* Fatigue-based */
  if (s.fatigueLevel === 'peak') {
    recs.push({ priority: 'high', type: 'recovery', text: 'Your accumulated fatigue this week is high. Prioritise recovery: yoga nidra, light walking, or a full rest day before your next hard session.' });
  } else if (s.fatigueLevel === 'high') {
    recs.push({ priority: 'medium', type: 'recovery', text: 'Fatigue is building. If you train today, drop intensity by 10-15% and focus on execution over load.' });
  }

  /* Missing strength */
  if (s.strengthMissing.length > 0) {
    var missed = s.strengthMissing.map(function(t) {
      return t === 'posterior' ? 'posterior chain' : t;
    }).join(' and ');
    recs.push({ priority: 'medium', type: 'training', text: 'You have not yet covered ' + missed + ' stimulus this week. If there are sessions remaining, prioritise these over additional conditioning.' });
  }

  /* Mobility gap */
  if (s.mobilityMins < 20 && s.sessionsPlanned > 1) {
    recs.push({ priority: 'low', type: 'mobility', text: 'No dedicated mobility work this week yet. Even 20 minutes of yoga or stretching would meaningfully reduce injury risk and improve recovery quality.' });
  }

  /* Conditioning done, steer to strength */
  if (s.conditioningDone && s.strengthMissing.length > 0) {
    recs.push({ priority: 'medium', type: 'training', text: 'Conditioning is covered for the week. Additional cardio has diminishing returns — redirect any remaining sessions toward the missing strength work.' });
  }

  /* On track positive */
  if (s.weeksGoalStatus === 'on-track' && s.fatigueLevel !== 'peak') {
    recs.push({ priority: 'positive', type: 'status', text: 'Week is on track. Maintain the plan and protect tonight\'s sleep — that is where this week\'s adaptations consolidate.' });
  }

  return recs.length > 0 ? recs : [{ priority: 'positive', type: 'status', text: 'Nothing urgent. Execute the plan.' }];
}

/* ---- Suggest next activity ---- */
function suggestNextActivity(ledger) {
  if (!ledger) return [];
  var s = ledger.summary;
  var suggestions = [];

  if (s.fatigueLevel === 'peak') {
    suggestions = ['nidra', 'yin-yoga', 'walking', 'sauna'];
  } else if (s.fatigueLevel === 'high') {
    suggestions = ['vinyasa', 'stretch', 'walking', 'nidra'];
  } else if (s.strengthMissing.indexOf('posterior') >= 0) {
    suggestions = ['gym-posterior', 'gym-lower', 'rowing'];
  } else if (s.strengthMissing.indexOf('pull') >= 0) {
    suggestions = ['gym-pull', 'rowing', 'swimming'];
  } else if (s.strengthMissing.indexOf('push') >= 0) {
    suggestions = ['gym-push', 'gym-upper'];
  } else if (!s.conditioningDone) {
    suggestions = ['spin', 'running', 'hiit', 'cycling'];
  } else if (s.mobilityMins < 20) {
    suggestions = ['vinyasa', 'stretch', 'yin-yoga', 'pilates'];
  } else {
    suggestions = ['gym-full', 'vinyasa', 'sauna', 'walking'];
  }

  return suggestions.slice(0, 4).map(function(key) {
    var def = ACTIVITY_TYPES[key] || ACTIVITY_TYPES['other'];
    return { key: key, label: def.label, fatigue: def.fatigue };
  });
}

/* ---- Context string for AI coach ---- */
function buildWeekContext(ledger) {
  if (!ledger) return '';
  var s = ledger.summary;
  var lines = [];
  lines.push('WEEKLY TRAINING LEDGER (this week so far):');
  lines.push('Sessions planned: ' + s.sessionsPlanned + ' | Done/substituted: ' + s.sessionsDone + ' | Missed: ' + s.sessionsMissed);
  lines.push('Fatigue level: ' + s.fatigueLevel + ' (accumulated score: ' + s.fatigueTotal + ')');
  lines.push('Strength covered: ' + (s.strengthCovered.length ? s.strengthCovered.join(', ') : 'none yet'));
  lines.push('Strength missing: ' + (s.strengthMissing.length ? s.strengthMissing.join(', ') : 'none'));
  lines.push('Conditioning done: ' + (s.conditioningDone ? 'yes' : 'no'));
  lines.push('Mobility work: ' + s.mobilityMins + ' mins');
  lines.push('Week status: ' + s.weeksGoalStatus);

  /* Day-by-day summary */
  var DAY_NAMES = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
  lines.push('');
  lines.push('Day breakdown:');
  DAY_NAMES.forEach(function(dn) {
    var d = ledger.days[dn];
    if (!d || !d.isPast) return;
    var acts = d.activities.map(function(a){ return a.label + (a.sub ? ' ('+a.sub.label+')' : ''); }).join('; ');
    lines.push(dn + ': ' + d.status + (acts ? ' | ' + acts : ''));
  });

  return lines.join('\n');
}

/* ---- Helpers ---- */
function getPlannedType(typeStr) {
  if (!typeStr) return null;
  var t = typeStr.toLowerCase();
  if (t.indexOf('push') >= 0) return 'push';
  if (t.indexOf('pull') >= 0) return 'pull';
  if (t.indexOf('posterior') >= 0 || t.indexOf('hamstring') >= 0 || t.indexOf('glute') >= 0) return 'posterior';
  if (t.indexOf('upper') >= 0) return 'upper';
  if (t.indexOf('lower') >= 0) return 'lower';
  if (t.indexOf('full') >= 0) return 'full';
  if (t.indexOf('cardio') >= 0 || t.indexOf('zone') >= 0 || t.indexOf('run') >= 0) return 'cardio';
  return 'full';
}

function getProfileAL() {
  try { return JSON.parse(localStorage.getItem('bl_profile') || 'null'); } catch(e) { return null; }
}

function loadDayLogAL(dateStr) {
  try { var r = localStorage.getItem('bl_daylog_' + dateStr); return r ? JSON.parse(r) : null; }
  catch(e) { return null; }
}

/* ---- Group labels for the log UI ---- */
var ACTIVITY_GROUPS = [
  { group: 'Gym sessions',   keys: ['gym-push','gym-pull','gym-lower','gym-posterior','gym-upper','gym-full'] },
  { group: 'Cardio classes', keys: ['spin','hiit','bootcamp','crossfit','boxing','rowing'] },
  { group: 'Cardio outdoor', keys: ['running','cycling','swimming','walking'] },
  { group: 'Yoga / classes', keys: ['vinyasa','hot-yoga','yin-yoga','stretch','pilates','dance'] },
  { group: 'Recovery',       keys: ['nidra','sauna','cold-water','other'] }
];

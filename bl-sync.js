// ── BL-SYNC — localStorage-first sync layer ─────────────────
// Writes to localStorage immediately (fast, offline-capable).
// Syncs to Supabase in the background when online.
// Reads from Supabase on first load if localStorage is empty.
// Conflict resolution: local wins if modified <24h, Supabase wins otherwise.
(function () {
'use strict';

// ── Config ──────────────────────────────────────────────────
var CONFLICT_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours
var QUEUE_KEY = 'bl_sync_queue';
var META_KEY_PREFIX = 'bl_sync_meta_'; // per-key modified timestamp
var RETRY_INTERVAL = 30000; // 30s between queue flushes
var MAX_QUEUE_SIZE = 200;

// ── State ───────────────────────────────────────────────────
var syncStatus = 'idle'; // idle | syncing | offline | error
var listeners = [];
var flushTimer = null;
var _orig = null; // original localStorage.setItem

// ── Key → Supabase table mapping ────────────────────────────
// Returns { table, columns } or null (local-only key)
function keyToTable(key) {
  if (key === 'bl_profile') return { table: 'profiles', mode: 'profile' };
  if (key === 'bl_strength_baseline') return { table: 'profiles', column: 'strength_baseline' };
  if (key === 'bl_scan_history') return { table: 'profiles', column: 'scan_history' };
  if (key === 'bl_scan_raw_text') return { table: 'profiles', mode: 'scan_raw' };
  if (key === 'bl_podcast_history') return { table: 'profiles', column: 'podcast_history' };
  if (key === 'bl_fridge_restock') return { table: 'profiles', column: 'fridge_data' };
  if (key === 'bl_shop_checks') return { table: 'profiles', column: 'shop_data' };
  if (key === 'bl_proposal_log') return { table: 'profiles', column: 'decision_log' };

  if (key.startsWith('bl_daylog_')) return { table: 'day_logs', dateKey: 'date', prefix: 'bl_daylog_' };
  if (key.startsWith('bl_macros_')) return { table: 'macros', dateKey: 'date', prefix: 'bl_macros_' };
  if (key.startsWith('bl_activities_')) return { table: 'activities', dateKey: 'date', prefix: 'bl_activities_' };
  if (key.startsWith('bl_weekledger_')) return { table: 'week_ledger', dateKey: 'week_start', prefix: 'bl_weekledger_' };
  if (key.startsWith('bl_weekly_meals_')) return { table: 'meal_plans', dateKey: 'week_start', prefix: 'bl_weekly_meals_' };

  if (key.startsWith('bl_report_')) return { table: 'profiles', column: 'latest_report' };

  return null; // local-only
}

// ── Sync metadata (timestamps) ──────────────────────────────
function setMeta(key) {
  try { localStorage.setItem(META_KEY_PREFIX + key, Date.now().toString()); } catch(e) {}
}

function getMeta(key) {
  try {
    var v = localStorage.getItem(META_KEY_PREFIX + key);
    return v ? parseInt(v, 10) : 0;
  } catch(e) { return 0; }
}

function isLocalFresh(key) {
  var t = getMeta(key);
  return t > 0 && (Date.now() - t) < CONFLICT_WINDOW_MS;
}

// ── Offline queue ───────────────────────────────────────────
function getQueue() {
  try { return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]'); } catch(e) { return []; }
}

function saveQueue(q) {
  // Trim oldest entries if over limit
  if (q.length > MAX_QUEUE_SIZE) q = q.slice(q.length - MAX_QUEUE_SIZE);
  try { localStorage.setItem(QUEUE_KEY, JSON.stringify(q)); } catch(e) {}
}

function enqueue(key, value) {
  var q = getQueue();
  // De-duplicate: remove older entries for the same key
  q = q.filter(function(item) { return item.key !== key; });
  q.push({ key: key, value: value, ts: Date.now() });
  saveQueue(q);
}

// ── Status management ───────────────────────────────────────
function setStatus(s) {
  if (syncStatus === s) return;
  syncStatus = s;
  listeners.forEach(function(fn) { try { fn(s); } catch(e) {} });
}

// ── Supabase push (single key) ──────────────────────────────
function pushToSupabase(key, value, cb) {
  if (!window._blUser || !window._sb) {
    cb && cb(new Error('not_authed'));
    return;
  }
  var mapping = keyToTable(key);
  if (!mapping) { cb && cb(null); return; } // local-only key

  var sb = window._sb;
  var userId = window._blUser.id;
  var parsed;
  try { parsed = JSON.parse(value); } catch(e) { cb && cb(null); return; }

  var now = new Date().toISOString();
  var promise;

  // Profile — full object
  if (mapping.mode === 'profile') {
    promise = sb.from('profiles').upsert({
      id: userId,
      email: window._blUser.email,
      name: parsed.name || '',
      profile: parsed,
      updated_at: now
    });
    // Also log profile changes
    if (window.BL && window.BL.logProfileChange) {
      window.BL.logProfileChange(parsed);
    }
  }
  // Scan raw text — merge into scan_history
  else if (mapping.mode === 'scan_raw') {
    var existing = {};
    try { existing = JSON.parse(localStorage.getItem('bl_scan_history') || '{}'); } catch(e2) {}
    existing.raw_text = value;
    promise = sb.from('profiles').upsert({
      id: userId,
      scan_history: existing,
      updated_at: now
    });
  }
  // Profile columns (strength, scan, podcast, fridge, shop, report)
  else if (mapping.column) {
    var payload = { id: userId, updated_at: now };
    payload[mapping.column] = parsed;
    promise = sb.from('profiles').upsert(payload);
  }
  // Date-keyed tables (day_logs, macros, activities, week_ledger, meal_plans)
  else if (mapping.dateKey) {
    var dateVal = key.replace(mapping.prefix, '');
    var row = {
      user_id: userId,
      data: parsed,
      updated_at: now
    };
    row[mapping.dateKey] = dateVal;
    promise = sb.from(mapping.table).upsert(row, {
      onConflict: 'user_id,' + mapping.dateKey
    });
  }

  if (promise) {
    promise.then(function(r) {
      if (r.error) {
        console.warn('bl-sync push error (' + key + '):', r.error.message);
        cb && cb(r.error);
      } else {
        cb && cb(null);
      }
    });
  } else {
    cb && cb(null);
  }
}

// ── Queue flush ─────────────────────────────────────────────
function flushQueue() {
  if (!navigator.onLine) { setStatus('offline'); return; }
  if (!window._blUser || !window._sb) return;

  var q = getQueue();
  if (q.length === 0) { setStatus('idle'); return; }

  setStatus('syncing');
  var remaining = [];
  var pending = q.length;
  var hadError = false;

  q.forEach(function(item) {
    pushToSupabase(item.key, item.value, function(err) {
      if (err) {
        hadError = true;
        remaining.push(item);
      }
      pending--;
      if (pending === 0) {
        saveQueue(remaining);
        setStatus(hadError ? 'error' : 'idle');
      }
    });
  });
}

// ── Read-through: fetch from Supabase if localStorage is empty ─
function readThrough(key, cb) {
  // If local data exists, return it
  var local = localStorage.getItem(key);
  if (local !== null) { cb(local); return; }

  // If not authed, return null
  if (!window._blUser || !window._sb) { cb(null); return; }

  var mapping = keyToTable(key);
  if (!mapping) { cb(null); return; }

  var sb = window._sb;
  var userId = window._blUser.id;

  // Profile columns
  if (mapping.column) {
    sb.from('profiles').select(mapping.column).eq('id', userId).single()
      .then(function(r) {
        if (r.data && r.data[mapping.column]) {
          var val = JSON.stringify(r.data[mapping.column]);
          _origSet(key, val);
          cb(val);
        } else { cb(null); }
      });
    return;
  }

  // Full profile
  if (mapping.mode === 'profile') {
    sb.from('profiles').select('profile').eq('id', userId).single()
      .then(function(r) {
        if (r.data && r.data.profile) {
          var val = JSON.stringify(r.data.profile);
          _origSet(key, val);
          cb(val);
        } else { cb(null); }
      });
    return;
  }

  // Date-keyed tables
  if (mapping.dateKey) {
    var dateVal = key.replace(mapping.prefix, '');
    var filter = {};
    sb.from(mapping.table).select('data')
      .eq('user_id', userId)
      .eq(mapping.dateKey, dateVal)
      .single()
      .then(function(r) {
        if (r.data && r.data.data) {
          var val = JSON.stringify(r.data.data);
          _origSet(key, val);
          cb(val);
        } else { cb(null); }
      });
    return;
  }

  cb(null);
}

// ── Batch read: fetch multiple date-keyed rows from Supabase ──
// Used by history page to load a date range in one query
function readRange(table, dateKey, startDate, endDate, cb) {
  if (!window._blUser || !window._sb) { cb([]); return; }
  var sb = window._sb;
  var userId = window._blUser.id;

  sb.from(table).select(dateKey + ',data')
    .eq('user_id', userId)
    .gte(dateKey, startDate)
    .lte(dateKey, endDate)
    .order(dateKey, { ascending: false })
    .then(function(r) {
      cb(r.data || []);
    });
}

// ── Conflict resolution on restore ──────────────────────────
// Called during sign-in restore. For each key:
// - If localStorage is empty → write Supabase value
// - If local is fresh (<24h modified) → keep local, re-push to Supabase
// - Otherwise → Supabase wins
function resolveConflict(key, supabaseValue) {
  var localRaw = localStorage.getItem(key);

  // No local data — Supabase wins
  if (localRaw === null) {
    _origSet(key, supabaseValue);
    return;
  }

  // Local data exists — check freshness
  if (isLocalFresh(key)) {
    // Local is fresh, keep it and re-push to Supabase
    enqueue(key, localRaw);
    return;
  }

  // Local is stale — Supabase wins
  _origSet(key, supabaseValue);
}

// ── Restore history with conflict resolution ────────────────
function restoreFromSupabase(cb) {
  if (!window._blUser || !window._sb) { cb && cb(); return; }
  var sb = window._sb;
  var userId = window._blUser.id;

  var thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  var cutoff = thirtyDaysAgo.toISOString().slice(0, 10);

  var eightWeeksAgo = new Date();
  eightWeeksAgo.setDate(eightWeeksAgo.getDate() - 56);
  var weekCutoff = eightWeeksAgo.toISOString().slice(0, 10);

  setStatus('syncing');
  var pending = 6;

  function done() {
    pending--;
    if (pending === 0) {
      // Flush any local-wins that need re-pushing
      flushQueue();
      cb && cb();
    }
  }

  // Day logs
  sb.from('day_logs').select('date,data').eq('user_id', userId)
    .gte('date', cutoff).then(function(r) {
      if (r.data) r.data.forEach(function(row) {
        resolveConflict('bl_daylog_' + row.date, JSON.stringify(row.data));
      });
      done();
    });

  // Macros
  sb.from('macros').select('date,data').eq('user_id', userId)
    .gte('date', cutoff).then(function(r) {
      if (r.data) r.data.forEach(function(row) {
        resolveConflict('bl_macros_' + row.date, JSON.stringify(row.data));
      });
      done();
    });

  // Meal plans
  sb.from('meal_plans').select('week_start,data').eq('user_id', userId)
    .gte('week_start', weekCutoff).then(function(r) {
      if (r.data) r.data.forEach(function(row) {
        resolveConflict('bl_weekly_meals_' + row.week_start, JSON.stringify(row.data));
      });
      done();
    });

  // Activities
  sb.from('activities').select('date,data').eq('user_id', userId)
    .gte('date', cutoff).then(function(r) {
      if (r.data) r.data.forEach(function(row) {
        resolveConflict('bl_activities_' + row.date, JSON.stringify(row.data));
      });
      done();
    });

  // Week ledger
  sb.from('week_ledger').select('week_start,data').eq('user_id', userId)
    .gte('week_start', weekCutoff).then(function(r) {
      if (r.data) r.data.forEach(function(row) {
        resolveConflict('bl_weekledger_' + row.week_start, JSON.stringify(row.data));
      });
      done();
    });

  // Profile columns
  sb.from('profiles')
    .select('scan_history,strength_baseline,latest_report,podcast_history,fridge_data,shop_data,decision_log')
    .eq('id', userId).single().then(function(r) {
      if (!r.data) { done(); return; }
      var d = r.data;
      if (d.scan_history) resolveConflict('bl_scan_history', JSON.stringify(d.scan_history));
      if (d.strength_baseline) {
        resolveConflict('bl_strength_baseline', JSON.stringify(d.strength_baseline));
        // Backfill profile.strengthBaseline
        try {
          var bp = JSON.parse(localStorage.getItem('bl_profile') || '{}');
          if (bp && !bp.strengthBaseline) {
            bp.strengthBaseline = d.strength_baseline;
            _origSet('bl_profile', JSON.stringify(bp));
          }
        } catch(e) {}
      }
      if (d.latest_report) resolveConflict('bl_report_restored', JSON.stringify(d.latest_report));
      if (d.podcast_history) resolveConflict('bl_podcast_history', JSON.stringify(d.podcast_history));
      if (d.fridge_data) resolveConflict('bl_fridge_restock', JSON.stringify(d.fridge_data));
      if (d.shop_data) resolveConflict('bl_shop_checks', JSON.stringify(d.shop_data));

      // Decision log — append-only so merge both arrays rather than replace.
      // All unique entries (by id) from Supabase + local are kept.
      if (d.decision_log) {
        var serverEntries = Array.isArray(d.decision_log) ? d.decision_log : [];
        var localRaw2 = localStorage.getItem('bl_proposal_log');
        var localEntries = [];
        try { if (localRaw2) localEntries = JSON.parse(localRaw2); } catch(e2) {}
        if (localEntries.length === 0) {
          // Nothing local — Supabase wins directly
          _origSet('bl_proposal_log', JSON.stringify(serverEntries));
        } else {
          // Merge: keep all unique entries by id, sort chronologically
          var byId = {};
          serverEntries.forEach(function(e) { if (e.id) byId[e.id] = e; });
          localEntries.forEach(function(e) { if (e.id && !byId[e.id]) byId[e.id] = e; });
          var merged = Object.keys(byId).map(function(k) { return byId[k]; });
          merged.sort(function(a, b) { return (a.ts || '') < (b.ts || '') ? -1 : 1; });
          _origSet('bl_proposal_log', JSON.stringify(merged));
          // If local had entries Supabase didn't, push merged version back up
          if (merged.length > serverEntries.length) {
            enqueue('bl_proposal_log', JSON.stringify(merged));
          }
        }
      }

      done();
    });
}

// ── Intercept localStorage.setItem ──────────────────────────
function _origSet(key, value) {
  if (_orig) _orig.call(localStorage, key, value);
  else localStorage.setItem(key, value);
}

function installIntercept() {
  _orig = localStorage.setItem.bind(localStorage);

  localStorage.setItem = function(key, value) {
    // Always write locally first
    _orig.call(localStorage, key, value);

    // Only sync bl_ keys that have a Supabase mapping
    var mapping = keyToTable(key);
    if (!mapping) return;

    // Record modification timestamp
    setMeta(key);

    // If online and authed, push immediately
    if (navigator.onLine && window._blUser && window._sb) {
      setStatus('syncing');
      pushToSupabase(key, value, function(err) {
        if (err) {
          enqueue(key, value);
          setStatus('error');
        } else {
          setStatus('idle');
        }
      });
    } else {
      // Offline — queue for later
      enqueue(key, value);
      setStatus('offline');
    }
  };
}

// ── Online/offline listeners ────────────────────────────────
function setupNetworkListeners() {
  window.addEventListener('online', function() {
    flushQueue();
  });
  window.addEventListener('offline', function() {
    setStatus('offline');
  });

  // Periodic flush for retries
  flushTimer = setInterval(flushQueue, RETRY_INTERVAL);
}

// ── Public API ──────────────────────────────────────────────
window.BLSync = {
  // Get current sync status
  getStatus: function() { return syncStatus; },

  // Subscribe to status changes: fn('idle'|'syncing'|'offline'|'error')
  onStatusChange: function(fn) {
    listeners.push(fn);
    return function unsubscribe() {
      listeners = listeners.filter(function(f) { return f !== fn; });
    };
  },

  // Read-through: returns localStorage value, or fetches from Supabase
  // Callback-based: readThrough('bl_daylog_2026-03-31', function(val) { ... })
  readThrough: readThrough,

  // Batch read for date ranges (used by history page)
  readRange: readRange,

  // Restore from Supabase with conflict resolution (replaces BL.restoreHistory)
  restoreFromSupabase: restoreFromSupabase,

  // Manual flush
  flush: flushQueue,

  // Queue size (for diagnostics)
  queueSize: function() { return getQueue().length; },

  // Force push a key to Supabase (bypasses queue)
  push: function(key, value, cb) { pushToSupabase(key, value, cb); },

  // Internal: original setItem (used by restore to avoid re-triggering sync)
  _origSet: _origSet
};

// ── Boot ────────────────────────────────────────────────────
installIntercept();
setupNetworkListeners();

// Flush any queued items on load (from previous offline session)
setTimeout(flushQueue, 2000);

})();

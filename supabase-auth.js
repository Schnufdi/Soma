// ── BODYLENS SUPABASE AUTH ──────────────────────────────────────────
(function() {

const SUPABASE_URL = 'https://ubbqyhkjijpjpqdhhhvp.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InViYnF5aGtqaWpwanBxZGhoaHZwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQyOTkxODEsImV4cCI6MjA4OTg3NTE4MX0.VK-AvEFr_cmXT7k44mvR9UxVlGRXL8Cu6mgXBQbQov8';

function loadSupabase(cb) {
  if (window._sb) { cb(window._sb); return; }
  var s = document.createElement('script');
  s.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js';
  s.onload = function() {
    window._sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    cb(window._sb);
  };
  document.head.appendChild(s);
}

window.BL = window.BL || {};

window.BL.signInWithGoogle = function() {
  loadSupabase(function(sb) {
    sb.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin + '/bodylens-login.html' }
    });
  });
};

window.BL.signOut = function() {
  loadSupabase(function(sb) {
    sb.auth.signOut().then(function() {
      window._blUser = null;
      // Clear ALL user data so the next user starts clean
      var keysToRemove = Object.keys(localStorage).filter(function(k) {
        return k.startsWith('bl_') || k.startsWith('dayplan_');
      });
      keysToRemove.forEach(function(k) { localStorage.removeItem(k); });
      window.location.href = '/bodylens-login.html';
    });
  });
};

window.BL.saveProfile = function(profile) {
  if (!window._blUser) return;
  loadSupabase(function(sb) {
    sb.from('profiles').upsert({
      id: window._blUser.id,
      email: window._blUser.email,
      name: profile.name || '',
      profile: profile,
      updated_at: new Date().toISOString()
    });
  });
};

window.BL.loadProfile = function(cb) {
  if (!window._blUser) { cb && cb(null); return; }
  loadSupabase(function(sb) {
    sb.from('profiles').select('profile').eq('id', window._blUser.id).single()
      .then(function(res) {
        if (res.data && res.data.profile) {
          var serverProfile = res.data.profile;
          var localRaw = localStorage.getItem('bl_profile');
          var localProfile = null;
          try { localProfile = localRaw ? JSON.parse(localRaw) : null; } catch(e) {}

          // Check if we're switching users (different name or different profile)
          var isDifferentUser = localProfile && serverProfile &&
            localProfile.name && serverProfile.name &&
            localProfile.name !== serverProfile.name;

          // Set the correct profile in localStorage
          // Ensure calories alias exists for backward compatibility
          if (serverProfile.trainingKcal && !serverProfile.calories) {
            serverProfile.calories = serverProfile.trainingKcal;
          }
          if (!serverProfile.generatedAt && serverProfile.weekPlan && serverProfile.weekPlan.length > 0) {
            serverProfile.generatedAt = new Date().toISOString();
          }
          if (!serverProfile.wakeTime) serverProfile.wakeTime = '07:00';
          localStorage.setItem('bl_profile', JSON.stringify(serverProfile));

          // If the daily plan is open and showed "Profile incomplete",
          // re-run init() now that we have the full profile from Supabase
          if (!isDifferentUser && typeof window._blInit === 'function') {
            // Only re-run if the page currently shows the incomplete screen
            var dayRoot = document.getElementById('day-root');
            if (dayRoot && dayRoot.innerHTML.includes('Profile incomplete')) {
              window._blInit();
            }
          }

          if (isDifferentUser) {
            // Wrong user was loaded — clear stale day logs and reload
            Object.keys(localStorage).forEach(function(k) {
              if (k.startsWith('dayplan_') || k.startsWith('bl_macros_') ||
                  k.startsWith('bl_recipe_') || k.startsWith('bl_weekledger_') ||
                  k.startsWith('bl_daylog_') || k.startsWith('bl_weekly_meals_')) {
                localStorage.removeItem(k);
              }
            });
            window.location.reload();
            return;
          }

          // Restore history for this user (fills localStorage from Supabase)
          setTimeout(function() { window.BL.restoreHistory && window.BL.restoreHistory(); }, 500);
          window._lastProfileState = serverProfile;
          cb && cb(serverProfile);
        } else {
          cb && cb(null);
        }
      });
  });
};

// Restore history — delegated to BLSync (bl-sync.js)
// BLSync.restoreFromSupabase handles conflict resolution:
// local wins if modified <24h, Supabase wins otherwise.
window.BL.restoreHistory = function() {
  if (window.BLSync && window.BLSync.restoreFromSupabase) {
    window.BLSync.restoreFromSupabase();
  }
};

// Init on every page
loadSupabase(function(sb) {
  sb.auth.getSession().then(function(res) {
    var session = res.data && res.data.session;
    if (session) {
      window._blUser = session.user;
      updateNavUser(session.user);
      // Always verify localStorage profile matches the logged-in user
      // This catches: stale cache, device sharing, account switching
      window.BL.loadProfile(null);
    } else {
      window._blUser = null;
      updateNavLoggedOut();
    }
  });

  sb.auth.onAuthStateChange(function(event, session) {
    // Mark auth as resolved on any event (including NO_SESSION)
    if (!window._blAuthResolved) window._blAuthResolved = !!(session) || (event === 'SIGNED_OUT') || (event === 'INITIAL_SESSION');
    if (event === 'SIGNED_IN' && session) {
      window._blUser = session.user;
      window._blAuthResolved = true;
      updateNavUser(session.user);
      // ALWAYS load from Supabase on sign-in to ensure correct user's profile
      // This handles: Shane signs in on Sven's device, or switching accounts
      window.BL.loadProfile(function(serverProfile) {
        if (!serverProfile) {
          // No server profile yet — user is new, save whatever is local
          var local = localStorage.getItem('bl_profile');
          if (local) {
            try { window.BL.saveProfile(JSON.parse(local)); } catch(e) {}
          }
        }
        // Profile loaded from server and set in localStorage — page is now correct
      });
    }
    if (event === 'SIGNED_OUT') {
      window._blUser = null;
      window._blAuthResolved = true;
      updateNavLoggedOut();
    }
  });
});

function updateNavUser(user) {
  var meta = document.getElementById('nav-meta');
  if (!meta) return;
  var name = (user.user_metadata && user.user_metadata.full_name)
    ? user.user_metadata.full_name.split(' ')[0]
    : user.email.split('@')[0];
  meta.innerHTML = '<span class="nav-user-btn" onclick="window.BL.showUserMenu()">'
    + '<span class="nav-user-avatar">' + name[0].toUpperCase() + '</span>'
    + name + '</span>';
}

function updateNavLoggedOut() {
  var meta = document.getElementById('nav-meta');
  if (!meta) return;
  meta.innerHTML = '<a href="/bodylens-login.html" class="nav-signin-btn">Sign in</a>';
}

window.BL.showUserMenu = function() {
  var existing = document.getElementById('bl-user-menu');
  if (existing) { existing.remove(); return; }
  if (!window._blUser) return;
  var user = window._blUser;
  var name = (user.user_metadata && user.user_metadata.full_name) || user.email;
  var avatar = user.user_metadata && user.user_metadata.avatar_url;
  var menu = document.createElement('div');
  menu.id = 'bl-user-menu';
  menu.innerHTML = [
    '<div class="bl-um-hd">',
    avatar ? '<img src="'+avatar+'" class="bl-um-avatar">' : '<div class="bl-um-avatar-text">'+name[0].toUpperCase()+'</div>',
    '<div><div class="bl-um-name">'+name+'</div><div class="bl-um-email">'+user.email+'</div></div>',
    '</div>',
    '<button onclick="window.BL.buildProfilePanel();document.getElementById(\'bl-user-menu\').remove()">Profile & settings</button>',
    '<button onclick="window.BL.signOut()">Sign out</button>'
  ].join('');
  document.body.appendChild(menu);
  setTimeout(function() {
    document.addEventListener('click', function close(e) {
      if (!menu.contains(e.target)) { menu.remove(); document.removeEventListener('click', close); }
    });
  }, 100);
};

// Log significant profile changes to profile_history for changelog
window.BL.logProfileChange = function(newProfile) {
  if (!window._blUser || !window._sb) return;
  var sb = window._sb;
  var userId = window._blUser.id;

  // Compare against last known state
  var lastRaw = window._lastProfileState;
  window._lastProfileState = newProfile;
  if (!lastRaw) return; // first save, no diff yet

  var changes = [];

  // Weight change
  if (lastRaw.weight !== newProfile.weight && newProfile.weight) {
    changes.push({ change_type: 'weight_update',
      payload: { from: lastRaw.weight, to: newProfile.weight, unit: 'kg' } });
  }
  // Supplement change
  var oldSupps = (lastRaw.supplements||[]).map(function(s){return s.name||s;}).sort().join(',');
  var newSupps = (newProfile.supplements||[]).map(function(s){return s.name||s;}).sort().join(',');
  if (oldSupps !== newSupps) {
    changes.push({ change_type: 'stack_change',
      payload: { before: lastRaw.supplements, after: newProfile.supplements } });
  }
  // Macro recalibration
  if (lastRaw.trainingKcal !== newProfile.trainingKcal && newProfile.trainingKcal) {
    changes.push({ change_type: 'recalibration',
      payload: { calories: newProfile.trainingKcal, protein: newProfile.protein,
        carbs: newProfile.carbs, fat: newProfile.fat, tdee: newProfile.tdee } });
  }
  // Goal update
  if (lastRaw.goal !== newProfile.goal || lastRaw.target !== newProfile.target) {
    changes.push({ change_type: 'goal_update',
      payload: { goal: newProfile.goal, target: newProfile.target } });
  }
  // Body scan
  var oldScan = JSON.stringify(lastRaw.bodyScan||{});
  var newScan = JSON.stringify(newProfile.bodyScan||{});
  if (oldScan !== newScan && newProfile.bodyScan) {
    changes.push({ change_type: 'body_scan',
      payload: newProfile.bodyScan });
  }
  // Gap bridge / goal analysis
  var oldBridge = (lastRaw.gapBridge||{}).generatedAt;
  var newBridge = (newProfile.gapBridge||{}).generatedAt;
  if (newBridge && oldBridge !== newBridge) {
    changes.push({ change_type: 'goal_update',
      payload: { gapBridge: newProfile.gapBridge, goalPlan: newProfile.goalPlan } });
  }

  changes.forEach(function(c) {
    sb.from('profile_history').insert({
      user_id: userId,
      change_type: c.change_type,
      payload: c.payload,
    }).then(function(r) {
      if (r.error) console.warn('profile_history insert error:', r.error.message);
    });
  });
};

// Sync is now handled by bl-sync.js which intercepts localStorage.setItem
// and manages the offline queue, conflict resolution, and Supabase pushes.
// bl-sync.js must be loaded before this file.

// Styles
var style = document.createElement('style');
style.textContent = [
  '.nav-user-btn{display:inline-flex;align-items:center;gap:6px;padding:4px 10px 4px 4px;',
  'border:1px solid var(--jade-br,rgba(0,196,160,0.2));border-radius:20px;',
  'background:var(--jade-dim,rgba(0,196,160,0.06));cursor:pointer;',
  'font-size:12px;font-weight:600;color:var(--jade,#00c4a0);}',
  '.nav-user-avatar{width:20px;height:20px;border-radius:50%;',
  'background:var(--jade,#00c4a0);color:#0c1010;display:flex;',
  'align-items:center;justify-content:center;font-size:10px;font-weight:700;}',
  '.nav-signin-btn{font-size:11px;font-weight:600;color:var(--jade,#00c4a0);',
  'text-decoration:none;padding:5px 12px;border:1px solid var(--jade-br,rgba(0,196,160,0.2));',
  'border-radius:5px;background:var(--jade-dim,rgba(0,196,160,0.06));}',
  '#bl-user-menu{position:fixed;top:52px;right:16px;',
  'background:var(--ink-2,#111917);border:1px solid rgba(255,255,255,0.1);',
  'border-radius:12px;padding:16px;z-index:9999;min-width:240px;',
  'box-shadow:0 8px 32px rgba(0,0,0,0.5);}',
  '.bl-um-hd{display:flex;gap:10px;align-items:center;margin-bottom:14px;',
  'padding-bottom:14px;border-bottom:1px solid rgba(255,255,255,0.06);}',
  '.bl-um-avatar{width:36px;height:36px;border-radius:50%;}',
  '.bl-um-avatar-text{width:36px;height:36px;border-radius:50%;',
  'background:var(--jade,#00c4a0);color:#0c1010;display:flex;',
  'align-items:center;justify-content:center;font-size:14px;font-weight:700;flex-shrink:0;}',
  '.bl-um-name{font-size:13px;font-weight:600;color:var(--dk-1,#e8e3da);}',
  '.bl-um-email{font-size:11px;color:var(--dk-3,#4a6058);margin-top:2px;}',
  '#bl-user-menu button{width:100%;padding:9px 12px;border-radius:7px;',
  'font-size:12px;font-weight:500;cursor:pointer;text-align:left;',
  'background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.07);',
  'color:var(--dk-1,#e8e3da);margin-bottom:6px;}',
  '#bl-user-menu button:last-child{margin-bottom:0;color:var(--dk-3,#4a6058);}'
].join('');
document.head.appendChild(style);

})();

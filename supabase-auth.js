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
          localStorage.setItem('bl_profile', JSON.stringify(serverProfile));

          if (isDifferentUser) {
            // Wrong user was loaded — clear stale day logs and reload
            // Clear only the volatile per-day data, keep the profile
            Object.keys(localStorage).forEach(function(k) {
              if (k.startsWith('dayplan_') || k.startsWith('bl_macros_') ||
                  k.startsWith('bl_recipe_') || k.startsWith('bl_weekledger_')) {
                localStorage.removeItem(k);
              }
            });
            // Reload so every page renders with the correct user's data
            window.location.reload();
            return;
          }

          cb && cb(serverProfile);
        } else {
          cb && cb(null);
        }
      });
  });
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
    if (event === 'SIGNED_IN' && session) {
      window._blUser = session.user;
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

// Auto-save to Supabase when profile is saved to localStorage
var _orig = localStorage.setItem.bind(localStorage);
localStorage.setItem = function(key, value) {
  _orig(key, value);
  if (key === 'bl_profile' && window._blUser) {
    try { window.BL.saveProfile(JSON.parse(value)); } catch(e) {}
  }
};

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

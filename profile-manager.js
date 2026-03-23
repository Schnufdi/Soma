// ── BODYLENS PROFILE MANAGER ─────────────────────────────────────────
// Profile persistence: export/import JSON, PIN system, URL sharing
// Theme toggle: jade/dark ↔ rose/copper
// Injected via nav.js on every page
// ─────────────────────────────────────────────────────────────────────

(function() {

// ── THEME SYSTEM ──────────────────────────────────────────────────────

var THEME_KEY = 'bl_theme';

var THEMES = {
  jade: {
    '--jade':       '#00c4a0',
    '--jade-dim':   'rgba(0,196,160,0.08)',
    '--jade-br':    'rgba(0,196,160,0.2)',
    '--amber':      '#c8791a',
    '--gold':       '#d4a832',
    '--ink':        '#0c1010',
    '--ink-2':      '#111917',
    '--ink-3':      '#151f1c',
    '--dk-1':       '#e8e3da',
    '--dk-2':       '#a0a898',
    '--dk-3':       '#4a6058',
    '--bd':         'rgba(255,255,255,0.07)',
    '--theme-name': 'jade'
  },
  rose: {
    '--jade':       '#c4728a',
    '--jade-dim':   'rgba(196,114,138,0.08)',
    '--jade-br':    'rgba(196,114,138,0.22)',
    '--amber':      '#b07040',
    '--gold':       '#c4924a',
    '--ink':        '#140e10',
    '--ink-2':      '#1c1418',
    '--ink-3':      '#22181c',
    '--dk-1':       '#f0e8e2',
    '--dk-2':       '#b8a8a4',
    '--dk-3':       '#7a5860',
    '--bd':         'rgba(255,255,255,0.07)',
    '--theme-name': 'rose'
  }
};

function applyTheme(name) {
  var t = THEMES[name] || THEMES.jade;
  var root = document.documentElement;
  Object.keys(t).forEach(function(k) {
    if (k !== '--theme-name') root.style.setProperty(k, t[k]);
  });
  document.documentElement.setAttribute('data-theme', name);
  localStorage.setItem(THEME_KEY, name);
  // Update toggle button if present
  var btn = document.getElementById('bl-theme-toggle');
  if (btn) {
    btn.textContent = name === 'jade' ? '🌸' : '🌿';
    btn.title = name === 'jade' ? 'Switch to Rose theme' : 'Switch to Jade theme';
  }
}

function toggleTheme() {
  var current = localStorage.getItem(THEME_KEY) || 'jade';
  applyTheme(current === 'jade' ? 'rose' : 'jade');
}

// Apply saved theme immediately on load
applyTheme(localStorage.getItem(THEME_KEY) || 'jade');

// ── PIN SYSTEM ────────────────────────────────────────────────────────

var PIN_STORE_KEY = 'bl_pin_store'; // local map of PIN → profile

function generatePIN() {
  return String(Math.floor(1000 + Math.random() * 9000));
}

function savePIN(pin, profile) {
  var store = JSON.parse(localStorage.getItem(PIN_STORE_KEY) || '{}');
  store[pin] = { profile: profile, saved: new Date().toISOString() };
  localStorage.setItem(PIN_STORE_KEY, JSON.stringify(store));
}

function loadPIN(pin) {
  var store = JSON.parse(localStorage.getItem(PIN_STORE_KEY) || '{}');
  return store[pin] ? store[pin].profile : null;
}

function getAllPINs() {
  var store = JSON.parse(localStorage.getItem(PIN_STORE_KEY) || '{}');
  return Object.keys(store).map(function(pin) {
    var entry = store[pin];
    var p = {};
    try { p = JSON.parse(entry.profile || '{}'); } catch(e) {}
    return { pin: pin, name: p.name || 'Unknown', saved: entry.saved };
  });
}

// ── EXPORT / IMPORT ───────────────────────────────────────────────────

function exportProfile() {
  var profile = localStorage.getItem('bl_profile');
  if (!profile) { showToast('No profile found — complete onboarding first.', 'warn'); return; }
  var p = {};
  try { p = JSON.parse(profile); } catch(e) {}
  var filename = 'bodylens-' + (p.name || 'profile').toLowerCase().replace(/\s+/g,'-') + '.json';
  var blob = new Blob([profile], { type: 'application/json' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
  showToast('Profile downloaded as ' + filename, 'ok');
}

function importProfile(file, callback) {
  var reader = new FileReader();
  reader.onload = function(e) {
    try {
      var data = JSON.parse(e.target.result);
      if (!data.name) { showToast('Invalid profile file.', 'warn'); return; }
      localStorage.setItem('bl_profile', JSON.stringify(data));
      // Clear cached plans so they regenerate
      Object.keys(localStorage).forEach(function(k) {
        if (k.startsWith('dayplan_') || k.startsWith('bl_report_')) localStorage.removeItem(k);
      });
      showToast('Profile loaded for ' + data.name + '!', 'ok');
      if (callback) callback(data);
    } catch(e) {
      showToast('Could not read profile file.', 'warn');
    }
  };
  reader.readAsText(file);
}

// ── PROFILE PANEL UI ─────────────────────────────────────────────────

function buildProfilePanel() {
  var existing = document.getElementById('bl-profile-panel');
  if (existing) { existing.remove(); return; }

  var profile = {};
  try { profile = JSON.parse(localStorage.getItem('bl_profile') || '{}'); } catch(e) {}
  var hasProfile = !!profile.name;
  var currentPIN = localStorage.getItem('bl_current_pin') || '';
  var allPINs = getAllPINs();
  var theme = localStorage.getItem(THEME_KEY) || 'jade';

  var panel = document.createElement('div');
  panel.id = 'bl-profile-panel';
  panel.innerHTML = [
    '<div class="bpp-backdrop" onclick="document.getElementById(\'bl-profile-panel\').remove()"></div>',
    '<div class="bpp-sheet">',

    // Header
    '<div class="bpp-hd">',
    '<div class="bpp-title">Profile & Settings</div>',
    '<button class="bpp-close" onclick="document.getElementById(\'bl-profile-panel\').remove()">✕</button>',
    '</div>',

    // Current profile
    '<div class="bpp-section">',
    '<div class="bpp-label">Current profile</div>',
    hasProfile
      ? '<div class="bpp-profile-name">' + profile.name + '</div><div class="bpp-profile-sub">' + (profile.goal || '') + ' · ' + (profile.age || '') + 'yo · ' + (profile.sex || '') + '</div>'
      : '<div class="bpp-no-profile">No profile yet — <a href="/bodylens-onboard.html">complete onboarding</a></div>',
    '</div>',

    // Theme toggle
    '<div class="bpp-section">',
    '<div class="bpp-label">Theme</div>',
    '<div class="bpp-theme-row">',
    '<button class="bpp-theme-btn' + (theme === 'jade' ? ' active' : '') + '" onclick="window.BL.setTheme(\'jade\')">',
    '<span class="bpp-theme-dot jade-dot"></span> Jade — Dark Green</button>',
    '<button class="bpp-theme-btn' + (theme === 'rose' ? ' active' : '') + '" onclick="window.BL.setTheme(\'rose\')">',
    '<span class="bpp-theme-dot rose-dot"></span> Rose — Copper</button>',
    '</div>',
    '</div>',

    // Save / PIN
    hasProfile ? [
      '<div class="bpp-section">',
      '<div class="bpp-label">Save your profile</div>',
      '<div class="bpp-btn-row">',
      '<button class="bpp-btn primary" onclick="window.BL.exportProfile()">⬇ Download JSON</button>',
      '<button class="bpp-btn" onclick="window.BL.savePINFlow()">🔑 Generate PIN</button>',
      '</div>',
      currentPIN ? '<div class="bpp-pin-display">Your PIN: <strong>' + currentPIN + '</strong><span class="bpp-pin-hint">— use this on any device</span></div>' : '',
      '</div>'
    ].join('') : '',

    // Load profile
    '<div class="bpp-section">',
    '<div class="bpp-label">Load a profile</div>',
    '<div class="bpp-btn-row">',
    '<label class="bpp-btn">⬆ Upload JSON<input type="file" accept=".json" style="display:none" onchange="window.BL.handleImport(this)"></label>',
    '<button class="bpp-btn" onclick="window.BL.loadPINFlow()">🔑 Enter PIN</button>',
    '</div>',
    '</div>',

    // Saved profiles (PINs)
    allPINs.length > 0 ? [
      '<div class="bpp-section">',
      '<div class="bpp-label">Saved profiles</div>',
      '<div class="bpp-pin-list">',
      allPINs.map(function(p) {
        return '<div class="bpp-pin-item">'
          + '<div class="bpp-pin-item-info"><strong>' + p.name + '</strong><span>PIN: ' + p.pin + '</span></div>'
          + '<button class="bpp-pin-item-load" onclick="window.BL.loadFromPIN(\'' + p.pin + '\')">Load</button>'
          + '</div>';
      }).join(''),
      '</div>',
      '</div>'
    ].join('') : '',

    '</div>' // end sheet
  ].join('');

  // Styles
  if (!document.getElementById('bpp-styles')) {
    var style = document.createElement('style');
    style.id = 'bpp-styles';
    style.textContent = [
      '#bl-profile-panel{position:fixed;inset:0;z-index:9000;display:flex;align-items:flex-end;justify-content:center;}',
      '.bpp-backdrop{position:absolute;inset:0;background:rgba(0,0,0,0.6);backdrop-filter:blur(4px);}',
      '.bpp-sheet{position:relative;z-index:1;background:var(--ink-2,#111917);border:1px solid var(--bd,rgba(255,255,255,0.08));border-radius:16px 16px 0 0;width:100%;max-width:500px;max-height:88vh;overflow-y:auto;padding:0 0 32px;animation:bpp-up 0.25s ease;}',
      '@keyframes bpp-up{from{transform:translateY(100%);opacity:0}to{transform:none;opacity:1}}',
      '.bpp-hd{display:flex;align-items:center;justify-content:space-between;padding:20px 22px 16px;border-bottom:1px solid var(--bd,rgba(255,255,255,0.08));}',
      '.bpp-title{font-family:var(--serif,serif);font-size:18px;font-weight:700;color:var(--dk-1,#e8e3da);}',
      '.bpp-close{background:none;border:none;color:var(--dk-3,#4a6058);font-size:16px;cursor:pointer;padding:4px 8px;}',
      '.bpp-section{padding:18px 22px;border-bottom:1px solid rgba(255,255,255,0.04);}',
      '.bpp-section:last-child{border-bottom:none;}',
      '.bpp-label{font-size:9px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;color:var(--dk-3,#4a6058);margin-bottom:10px;}',
      '.bpp-profile-name{font-family:var(--serif,serif);font-size:20px;font-weight:700;color:var(--dk-1,#e8e3da);margin-bottom:3px;}',
      '.bpp-profile-sub{font-size:12px;color:var(--dk-3,#4a6058);}',
      '.bpp-no-profile{font-size:13px;color:var(--dk-3,#4a6058);}',
      '.bpp-no-profile a{color:var(--jade,#00c4a0);text-decoration:none;}',
      '.bpp-theme-row{display:flex;gap:8px;}',
      '.bpp-theme-btn{flex:1;display:flex;align-items:center;gap:8px;padding:10px 14px;background:rgba(255,255,255,0.03);border:1px solid var(--bd,rgba(255,255,255,0.08));border-radius:8px;color:var(--dk-2,#a0a898);font-size:12px;font-weight:500;cursor:pointer;transition:all 0.15s;}',
      '.bpp-theme-btn.active{border-color:var(--jade,#00c4a0);color:var(--jade,#00c4a0);background:var(--jade-dim,rgba(0,196,160,0.08));}',
      '.bpp-theme-dot{width:10px;height:10px;border-radius:50%;flex-shrink:0;}',
      '.jade-dot{background:#00c4a0;}.rose-dot{background:#c4728a;}',
      '.bpp-btn-row{display:flex;gap:8px;flex-wrap:wrap;}',
      '.bpp-btn{padding:9px 16px;background:rgba(255,255,255,0.04);border:1px solid var(--bd,rgba(255,255,255,0.08));border-radius:7px;color:var(--dk-1,#e8e3da);font-size:12px;font-weight:500;cursor:pointer;transition:background 0.15s;}',
      '.bpp-btn:hover{background:rgba(255,255,255,0.08);}',
      '.bpp-btn.primary{background:var(--jade-dim,rgba(0,196,160,0.08));border-color:var(--jade-br,rgba(0,196,160,0.2));color:var(--jade,#00c4a0);}',
      '.bpp-pin-display{margin-top:10px;padding:10px 14px;background:rgba(255,255,255,0.03);border-radius:7px;font-size:13px;color:var(--dk-2,#a0a898);}',
      '.bpp-pin-display strong{font-family:var(--mono,monospace);font-size:20px;color:var(--jade,#00c4a0);letter-spacing:0.1em;}',
      '.bpp-pin-hint{font-size:11px;color:var(--dk-3,#4a6058);margin-left:8px;}',
      '.bpp-pin-list{display:flex;flex-direction:column;gap:6px;}',
      '.bpp-pin-item{display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:rgba(255,255,255,0.03);border-radius:7px;border:1px solid var(--bd,rgba(255,255,255,0.06));}',
      '.bpp-pin-item-info{display:flex;flex-direction:column;gap:2px;}',
      '.bpp-pin-item-info strong{font-size:13px;font-weight:600;color:var(--dk-1,#e8e3da);}',
      '.bpp-pin-item-info span{font-family:var(--mono,monospace);font-size:11px;color:var(--jade,#00c4a0);}',
      '.bpp-pin-item-load{padding:6px 14px;background:var(--jade-dim,rgba(0,196,160,0.08));border:1px solid var(--jade-br,rgba(0,196,160,0.2));border-radius:5px;color:var(--jade,#00c4a0);font-size:11px;font-weight:600;cursor:pointer;}',
      // PIN modal
      '.bpp-modal{position:fixed;inset:0;z-index:9100;display:flex;align-items:center;justify-content:center;}',
      '.bpp-modal-bg{position:absolute;inset:0;background:rgba(0,0,0,0.7);}',
      '.bpp-modal-box{position:relative;z-index:1;background:var(--ink-2,#111917);border:1px solid var(--bd,rgba(255,255,255,0.1));border-radius:12px;padding:28px;width:320px;text-align:center;}',
      '.bpp-modal-title{font-family:var(--serif,serif);font-size:20px;font-weight:700;color:var(--dk-1,#e8e3da);margin-bottom:8px;}',
      '.bpp-modal-sub{font-size:13px;color:var(--dk-3,#4a6058);margin-bottom:20px;line-height:1.6;}',
      '.bpp-modal-pin-display{font-family:var(--mono,monospace);font-size:48px;font-weight:700;color:var(--jade,#00c4a0);letter-spacing:0.15em;margin-bottom:20px;}',
      '.bpp-modal-input{width:100%;padding:12px;background:rgba(255,255,255,0.05);border:1px solid var(--bd,rgba(255,255,255,0.1));border-radius:7px;color:var(--dk-1,#e8e3da);font-family:var(--mono,monospace);font-size:28px;text-align:center;letter-spacing:0.2em;margin-bottom:16px;outline:none;}',
      '.bpp-modal-input:focus{border-color:var(--jade-br,rgba(0,196,160,0.3));}',
      '.bpp-modal-btns{display:flex;gap:8px;}',
      '.bpp-modal-btn{flex:1;padding:11px;border-radius:7px;font-size:13px;font-weight:600;cursor:pointer;border:none;}',
      '.bpp-modal-btn.ok{background:var(--jade,#00c4a0);color:#0c1010;}',
      '.bpp-modal-btn.cancel{background:rgba(255,255,255,0.06);color:var(--dk-2,#a0a898);}',
      // Toast
      '.bl-toast{position:fixed;bottom:88px;left:50%;transform:translateX(-50%);padding:10px 20px;border-radius:20px;font-size:13px;font-weight:600;z-index:9200;animation:toast-in 0.2s ease;white-space:nowrap;}',
      '.bl-toast.ok{background:var(--jade,#00c4a0);color:#0c1010;}',
      '.bl-toast.warn{background:#c94040;color:#fff;}',
      '@keyframes toast-in{from{opacity:0;transform:translateX(-50%) translateY(8px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}'
    ].join('');
    document.head.appendChild(style);
  }

  document.body.appendChild(panel);
}

// ── FLOWS ─────────────────────────────────────────────────────────────

function savePINFlow() {
  var profile = localStorage.getItem('bl_profile');
  if (!profile) { showToast('No profile to save.', 'warn'); return; }
  var pin = generatePIN();
  savePIN(pin, profile);
  localStorage.setItem('bl_current_pin', pin);

  // Show PIN modal
  var modal = document.createElement('div');
  modal.className = 'bpp-modal';
  modal.innerHTML = [
    '<div class="bpp-modal-bg"></div>',
    '<div class="bpp-modal-box">',
    '<div class="bpp-modal-title">Your Profile PIN</div>',
    '<div class="bpp-modal-sub">Enter this PIN on any device to restore your profile. Write it down.</div>',
    '<div class="bpp-modal-pin-display">' + pin + '</div>',
    '<div class="bpp-modal-btns">',
    '<button class="bpp-modal-btn ok" onclick="this.closest(\'.bpp-modal\').remove();document.getElementById(\'bl-profile-panel\').remove();window.BL.buildProfilePanel();">Done</button>',
    '</div>',
    '</div>'
  ].join('');
  document.body.appendChild(modal);
}

function loadPINFlow() {
  var modal = document.createElement('div');
  modal.className = 'bpp-modal';
  modal.innerHTML = [
    '<div class="bpp-modal-bg"></div>',
    '<div class="bpp-modal-box">',
    '<div class="bpp-modal-title">Enter PIN</div>',
    '<div class="bpp-modal-sub">Enter your 4-digit PIN to restore your profile on this device.</div>',
    '<input class="bpp-modal-input" id="bpp-pin-input" type="number" maxlength="4" placeholder="0000" autofocus>',
    '<div class="bpp-modal-btns">',
    '<button class="bpp-modal-btn cancel" onclick="this.closest(\'.bpp-modal\').remove()">Cancel</button>',
    '<button class="bpp-modal-btn ok" onclick="window.BL.confirmPINLoad()">Restore</button>',
    '</div>',
    '</div>'
  ].join('');
  document.body.appendChild(modal);
  setTimeout(function() {
    var inp = document.getElementById('bpp-pin-input');
    if (inp) inp.focus();
  }, 100);
}

function confirmPINLoad() {
  var inp = document.getElementById('bpp-pin-input');
  if (!inp) return;
  var pin = inp.value.trim();
  var profile = loadPIN(pin);
  if (!profile) { showToast('PIN not found — check and try again.', 'warn'); return; }
  localStorage.setItem('bl_profile', profile);
  localStorage.setItem('bl_current_pin', pin);
  // Clear old plan caches
  Object.keys(localStorage).forEach(function(k) {
    if (k.startsWith('dayplan_') || k.startsWith('bl_report_')) localStorage.removeItem(k);
  });
  var p = {}; try { p = JSON.parse(profile); } catch(e) {}
  document.querySelector('.bpp-modal') && document.querySelector('.bpp-modal').remove();
  showToast('Welcome back, ' + (p.name || 'friend') + '!', 'ok');
  setTimeout(function() {
    document.getElementById('bl-profile-panel') && document.getElementById('bl-profile-panel').remove();
    window.location.href = '/bodylens-dailyplan.html';
  }, 1200);
}

function loadFromPIN(pin) {
  var profile = loadPIN(pin);
  if (!profile) { showToast('Profile not found.', 'warn'); return; }
  localStorage.setItem('bl_profile', profile);
  localStorage.setItem('bl_current_pin', pin);
  Object.keys(localStorage).forEach(function(k) {
    if (k.startsWith('dayplan_') || k.startsWith('bl_report_')) localStorage.removeItem(k);
  });
  var p = {}; try { p = JSON.parse(profile); } catch(e) {}
  showToast('Switched to ' + (p.name || 'profile') + '!', 'ok');
  setTimeout(function() {
    document.getElementById('bl-profile-panel') && document.getElementById('bl-profile-panel').remove();
    window.location.reload();
  }, 1000);
}

function handleImport(input) {
  var file = input.files[0];
  if (!file) return;
  importProfile(file, function(data) {
    setTimeout(function() {
      document.getElementById('bl-profile-panel') && document.getElementById('bl-profile-panel').remove();
      window.location.href = '/bodylens-dailyplan.html';
    }, 1200);
  });
}

// ── TOAST ─────────────────────────────────────────────────────────────

function showToast(msg, type) {
  var existing = document.querySelector('.bl-toast');
  if (existing) existing.remove();
  var t = document.createElement('div');
  t.className = 'bl-toast ' + (type || 'ok');
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(function() { t && t.remove(); }, 3000);
}

// ── PUBLIC API ────────────────────────────────────────────────────────

window.BL = window.BL || {};
Object.assign(window.BL, {
  buildProfilePanel: buildProfilePanel,
  toggleTheme: toggleTheme,
  setTheme: function(name) {
    applyTheme(name);
    // Refresh theme buttons in open panel
    document.querySelectorAll('.bpp-theme-btn').forEach(function(btn) {
      btn.classList.toggle('active', btn.textContent.toLowerCase().indexOf(name) > -1);
    });
  },
  exportProfile: exportProfile,
  importProfile: importProfile,
  savePINFlow: savePINFlow,
  loadPINFlow: loadPINFlow,
  confirmPINLoad: confirmPINLoad,
  loadFromPIN: loadFromPIN,
  handleImport: handleImport,
  showToast: showToast
});


// ── INJECT BUTTONS INTO NAV ───────────────────────────────────────────
// Runs after nav.js has done its thing — adds buttons directly
// Works on all browsers including Safari

function injectNavButtons() {
  if (document.getElementById('bl-theme-toggle')) return; // already there

  var navGroup = document.querySelector('.nav-right-group');
  if (!navGroup) return;

  // Inject styles
  if (!document.getElementById('bl-nav-btn-styles')) {
    var s = document.createElement('style');
    s.id = 'bl-nav-btn-styles';
    s.textContent = [
      '.bl-nav-btn{background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);',
      'border-radius:7px;width:32px;height:32px;display:inline-flex;align-items:center;',
      'justify-content:center;font-size:14px;cursor:pointer;margin-left:5px;',
      'transition:background 0.15s;vertical-align:middle;}',
      '.bl-nav-btn:hover{background:rgba(255,255,255,0.09);border-color:var(--jade-br,rgba(0,196,160,0.25));}'
    ].join('');
    document.head.appendChild(s);
  }

  var meta = navGroup.querySelector('#nav-meta') || null;

  var themeBtn = document.createElement('button');
  themeBtn.id = 'bl-theme-toggle';
  themeBtn.className = 'bl-nav-btn';
  themeBtn.title = 'Switch theme';
  themeBtn.textContent = (localStorage.getItem('bl_theme') || 'jade') === 'jade' ? '🌸' : '🌿';
  themeBtn.onclick = function() { window.BL && window.BL.toggleTheme(); };

  var profileBtn = document.createElement('button');
  profileBtn.id = 'bl-profile-btn';
  profileBtn.className = 'bl-nav-btn';
  profileBtn.title = 'Profile & settings';
  profileBtn.textContent = '👤';
  profileBtn.onclick = function() { window.BL && window.BL.buildProfilePanel(); };

  if (meta) {
    navGroup.insertBefore(profileBtn, meta);
    navGroup.insertBefore(themeBtn, profileBtn);
  } else {
    navGroup.appendChild(themeBtn);
    navGroup.appendChild(profileBtn);
  }
}

// Try immediately, then retry to handle Safari's timing
injectNavButtons();
if (document.readyState !== 'complete') {
  window.addEventListener('load', injectNavButtons);
}
document.addEventListener('DOMContentLoaded', function() {
  injectNavButtons();
  setTimeout(injectNavButtons, 100);
  setTimeout(injectNavButtons, 500);
});
// Final safety net
setTimeout(injectNavButtons, 800);

// ── AUTO-SAVE PIN on profile completion ───────────────────────────────
// Hook into profile save events
var _origSetItem = localStorage.setItem.bind(localStorage);
localStorage.setItem = function(key, value) {
  _origSetItem(key, value);
  if (key === 'bl_profile') {
    // Auto-generate PIN if not already saved
    var existingPIN = localStorage.getItem('bl_current_pin');
    if (!existingPIN) {
      var pin = generatePIN();
      savePIN(pin, value);
      _origSetItem('bl_current_pin', pin);
      // Show PIN toast after a short delay
      setTimeout(function() {
        showToast('Profile saved! Your PIN is ' + pin, 'ok');
      }, 500);
    } else {
      // Update existing PIN entry with latest profile
      savePIN(existingPIN, value);
    }
  }
};

})();

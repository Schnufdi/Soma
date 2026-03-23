// ════════════════════════════════════════════════════════
//  pwa.js  —  BodyLens PWA utilities
//  - Smart install banner
//  - Push notification permission + scheduling
//  - Daily nudge logic
// ════════════════════════════════════════════════════════

(function () {

  // ── INSTALL PROMPT ──────────────────────────────────────
  let _deferredInstallPrompt = null;

  window.addEventListener('beforeinstallprompt', evt => {
    evt.preventDefault();
    _deferredInstallPrompt = evt;

    // Only show banner if not already installed and not dismissed recently
    const dismissed = localStorage.getItem('bl_install_dismissed');
    if (dismissed) {
      const daysSince = (Date.now() - parseInt(dismissed)) / (1000*60*60*24);
      if (daysSince < 7) return; // don't show for 7 days after dismiss
    }

    // Don't show if already running as standalone
    if (window.matchMedia('(display-mode: standalone)').matches) return;

    showInstallBanner();
  });

  function showInstallBanner() {
    if (document.getElementById('bl-install-banner')) return;
    const profile = (() => {
      try { return JSON.parse(localStorage.getItem('bl_profile') || 'null'); } catch(e) { return null; }
    })();
    if (!profile) return; // Don't show if no profile yet

    const banner = document.createElement('div');
    banner.id = 'bl-install-banner';
    banner.style.cssText = [
      'position:fixed', 'bottom:0', 'left:0', 'right:0', 'z-index:9000',
      'background:#111917', 'border-top:1px solid rgba(0,200,160,0.25)',
      'padding:12px 20px 20px', 'display:flex', 'align-items:center', 'gap:14px',
      'animation:slideUp 0.25s ease', 'font-family:Space Grotesk,sans-serif',
    ].join(';');

    banner.innerHTML = `
      <style>@keyframes slideUp{from{transform:translateY(100%)}to{transform:translateY(0)}}</style>
      <div style="width:40px;height:40px;background:rgba(0,200,160,0.1);border:1px solid rgba(0,200,160,0.25);border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0;">💪</div>
      <div style="flex:1;min-width:0;">
        <div style="font-size:13px;font-weight:600;color:#e8e3da;margin-bottom:2px;">Add BodyLens to your home screen</div>
        <div style="font-size:11px;font-weight:300;color:#5a7060;line-height:1.4;">One tap to your daily plan. Works offline. Feels native.</div>
      </div>
      <div style="display:flex;gap:8px;flex-shrink:0;">
        <button id="bl-install-yes" style="background:#00c8a0;border:none;color:#0c1010;border-radius:6px;padding:8px 16px;font-size:11px;font-weight:700;letter-spacing:0.04em;cursor:pointer;font-family:inherit;">Install</button>
        <button id="bl-install-no" style="background:transparent;border:1px solid #1e2e28;color:#5a7060;border-radius:6px;padding:8px 12px;font-size:11px;cursor:pointer;font-family:inherit;">✕</button>
      </div>`;

    document.body.appendChild(banner);

    document.getElementById('bl-install-yes').addEventListener('click', async () => {
      if (!_deferredInstallPrompt) return;
      _deferredInstallPrompt.prompt();
      const { outcome } = await _deferredInstallPrompt.userChoice;
      _deferredInstallPrompt = null;
      banner.remove();
      if (outcome === 'accepted') {
        // After install, offer notifications
        setTimeout(askForNotifications, 2000);
      }
    });

    document.getElementById('bl-install-no').addEventListener('click', () => {
      localStorage.setItem('bl_install_dismissed', Date.now().toString());
      banner.remove();
    });
  }

  // ── iOS MANUAL INSTALL HINT ─────────────────────────────
  // iOS doesn't fire beforeinstallprompt — show a manual guide
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches
    || (window.navigator.standalone === true);

  if (isIOS && !isStandalone) {
    const shown = localStorage.getItem('bl_ios_hint');
    if (!shown) {
      setTimeout(() => {
        const profile = (() => {
          try { return JSON.parse(localStorage.getItem('bl_profile') || 'null'); } catch(e) { return null; }
        })();
        if (!profile) return;

        const hint = document.createElement('div');
        hint.style.cssText = [
          'position:fixed', 'bottom:0', 'left:0', 'right:0', 'z-index:9000',
          'background:#111917', 'border-top:1px solid rgba(0,200,160,0.25)',
          'padding:14px 20px 28px', 'font-family:Space Grotesk,sans-serif',
          'animation:slideUp 0.25s ease',
        ].join(';');

        hint.innerHTML = `
          <style>@keyframes slideUp{from{transform:translateY(100%)}to{transform:translateY(0)}}</style>
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px;">
            <div style="font-size:13px;font-weight:600;color:#e8e3da;">Add to your iPhone home screen</div>
            <button onclick="this.closest('div[style]').remove();localStorage.setItem('bl_ios_hint','1')"
              style="background:none;border:none;color:#5a7060;font-size:18px;cursor:pointer;line-height:1;padding:0 0 0 12px;">✕</button>
          </div>
          <div style="display:flex;gap:10px;align-items:flex-start;">
            <div style="flex-shrink:0;width:28px;height:28px;background:rgba(0,200,160,0.1);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:14px;margin-top:1px;">1</div>
            <div style="font-size:12px;font-weight:300;color:#8a9490;line-height:1.6;">Tap the <strong style="color:#e8e3da;">Share</strong> button <span style="font-size:15px;">⬆</span> at the bottom of your browser</div>
          </div>
          <div style="display:flex;gap:10px;align-items:flex-start;margin-top:8px;">
            <div style="flex-shrink:0;width:28px;height:28px;background:rgba(0,200,160,0.1);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:14px;margin-top:1px;">2</div>
            <div style="font-size:12px;font-weight:300;color:#8a9490;line-height:1.6;">Scroll down and tap <strong style="color:#e8e3da;">"Add to Home Screen"</strong></div>
          </div>
          <div style="display:flex;gap:10px;align-items:flex-start;margin-top:8px;">
            <div style="flex-shrink:0;width:28px;height:28px;background:rgba(0,200,160,0.1);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:14px;margin-top:1px;">3</div>
            <div style="font-size:12px;font-weight:300;color:#8a9490;line-height:1.6;">Tap <strong style="color:#e8e3da;">"Add"</strong> — BodyLens will appear on your home screen like a native app</div>
          </div>`;

        document.body.appendChild(hint);
        localStorage.setItem('bl_ios_hint', '1');
      }, 3000);
    }
  }

  // ── PUSH NOTIFICATIONS ──────────────────────────────────
  async function askForNotifications() {
    if (!('Notification' in window) || !('serviceWorker' in navigator)) return;
    if (Notification.permission === 'granted') {
      scheduleNudges();
      return;
    }
    if (Notification.permission === 'denied') return;

    // Show a friendly prompt first
    const modal = document.createElement('div');
    modal.style.cssText = [
      'position:fixed', 'inset:0', 'z-index:9100',
      'background:rgba(0,0,0,0.7)', 'display:flex', 'align-items:center', 'justify-content:center',
      'padding:20px', 'font-family:Space Grotesk,sans-serif',
    ].join(';');

    modal.innerHTML = `
      <div style="background:#111917;border:1px solid rgba(0,200,160,0.2);border-radius:12px;padding:24px;max-width:340px;width:100%;">
        <div style="font-size:28px;margin-bottom:12px;text-align:center;">🔔</div>
        <div style="font-size:16px;font-weight:600;color:#e8e3da;text-align:center;margin-bottom:8px;">Stay on track</div>
        <div style="font-size:13px;font-weight:300;color:#8a9490;text-align:center;line-height:1.7;margin-bottom:20px;">
          Get nudges when you haven't logged meals, reminders for supplements, and a heads-up before training. Nothing spammy — just what you need to know.
        </div>
        <div style="display:flex;flex-direction:column;gap:8px;">
          <button id="notif-yes" style="background:#00c8a0;border:none;color:#0c1010;border-radius:8px;padding:12px;font-size:13px;font-weight:700;letter-spacing:0.04em;cursor:pointer;font-family:inherit;width:100%;">
            Allow notifications
          </button>
          <button id="notif-no" style="background:transparent;border:1px solid #1e2e28;color:#5a7060;border-radius:8px;padding:10px;font-size:12px;cursor:pointer;font-family:inherit;width:100%;">
            Maybe later
          </button>
        </div>
      </div>`;

    document.body.appendChild(modal);

    document.getElementById('notif-yes').addEventListener('click', async () => {
      modal.remove();
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        localStorage.setItem('bl_notif_enabled', '1');
        scheduleNudges();
        // Confirm
        new Notification('BodyLens', {
          body: "Notifications on. We'll only send what matters.",
          icon: '/icons/icon-192.png',
          tag: 'bl-welcome',
        });
      }
    });

    document.getElementById('notif-no').addEventListener('click', () => {
      modal.remove();
      localStorage.setItem('bl_notif_dismissed', Date.now().toString());
    });
  }

  // ── NUDGE SCHEDULING ────────────────────────────────────
  // Client-side nudges — fires when app is open (PWA in foreground)
  // For true background notifications you need a server push endpoint
  function scheduleNudges() {
    if (Notification.permission !== 'granted') return;
    if (localStorage.getItem('bl_nudge_scheduled')) return;

    localStorage.setItem('bl_nudge_scheduled', '1');

    // Check for morning nudge (if it's before 10am and no plan loaded today)
    const now = new Date();
    const hour = now.getHours();
    if (hour >= 8 && hour < 11) {
      const todayKey = 'dayplan_v4_' + now.toISOString().slice(0,10);
      const planViewed = localStorage.getItem(todayKey);
      if (!planViewed) {
        setTimeout(() => {
          const profile = (() => {
            try { return JSON.parse(localStorage.getItem('bl_profile')||'null'); } catch(e){return null;} })();
          if (!profile) return;
          const macros = (() => {
            try { return JSON.parse(localStorage.getItem('bl_macros_'+now.toISOString().slice(0,10))||'null'); } catch(e){return null;} })();
          const mealCount = macros ? Object.values(macros.meals||{}).filter(m=>m.logged).length : 0;
          if (mealCount === 0) {
            new Notification('BodyLens', {
              body: `Morning, ${profile.name}. Open your plan for today.`,
              icon: '/icons/icon-192.png',
              tag: 'bl-morning',
              data: { url: '/bodylens-dailyplan.html' },
            });
          }
        }, 2000);
      }
    }
  }

  // ── RUN ON LOAD ─────────────────────────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', scheduleNudges);
  } else {
    scheduleNudges();
  }

  // Expose for use from other scripts
  window._BL_PWA = { askForNotifications, scheduleNudges };

})();

// ════════════════════════════════════════════════════════
//  profile-inject.js
//  Loaded by every science/reference page.
//  Reads the stored profile and injects a personalised
//  "What this means for you" panel at the top of the page.
//  Each page declares what it wants via:
//    <meta name="bl-inject" content="alcohol">
// ════════════════════════════════════════════════════════

(function() {
  // Don't run on onboarding or reset pages
  const page = location.pathname.split('/').pop();
  if (page === 'bodylens-onboard.html' || page === 'bodylens-reset.html') return;

  // Get profile
  let profile;
  try {
    const raw = localStorage.getItem('bl_profile');
    if (!raw) return;
    profile = JSON.parse(raw);
    if (!profile || !profile.name) return;
  } catch(e) { return; }

  // Get inject type from meta tag
  const meta = document.querySelector('meta[name="bl-inject"]');
  if (!meta) return;
  const injectType = meta.getAttribute('content');

  // Build the panel
  const panel = buildPanel(injectType, profile);
  if (!panel) return;

  // Insert after the first section/hero — before main content
  document.addEventListener('DOMContentLoaded', () => {
    // Find injection point — look for first main section after nav
    const target = document.querySelector(
      '.section-dark-0, .hero, .fh, .page-hero, section, .dk, main'
    );
    if (target) {
      target.insertAdjacentHTML('afterend', panel);
    } else {
      // Fallback — insert after nav
      const nav = document.querySelector('.site-nav');
      if (nav) nav.insertAdjacentHTML('afterend', panel);
    }
  });

  function buildPanel(type, p) {
    const name = p.name || 'You';
    const rows = getPanelRows(type, p);
    if (!rows || rows.length === 0) return null;

    const rowsHTML = rows.map(r => `
      <div style="display:flex;justify-content:space-between;align-items:baseline;
        padding:8px 0;border-bottom:1px solid rgba(0,200,160,0.1);font-size:12px;gap:16px;">
        <span style="font-weight:400;color:#8a9490;flex-shrink:0;">${r.label}</span>
        <span style="font-weight:500;color:${r.color||'#e8e3da'};text-align:right;line-height:1.4;">${r.value}</span>
      </div>`).join('');

    const callout = getPanelCallout(type, p);

    return `
      <div style="background:#131918;border-top:1px solid rgba(0,200,160,0.2);
        border-bottom:1px solid rgba(255,255,255,0.05);padding:20px 0;">
        <div style="max-width:1080px;margin:0 auto;padding:0 32px;">
          <div style="display:grid;grid-template-columns:1fr auto;gap:32px;align-items:start;">
            <div>
              <div style="font-size:9px;font-weight:600;letter-spacing:0.18em;text-transform:uppercase;
                color:#00c8a0;margin-bottom:10px;display:flex;align-items:center;gap:8px;">
                <span style="width:14px;height:1px;background:#00c8a0;display:inline-block;"></span>
                What this means for ${name}
              </div>
              <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:0 32px;">
                ${rowsHTML}
              </div>
              ${callout ? `<div style="margin-top:12px;padding:10px 14px;background:rgba(0,200,160,0.06);
                border-left:2px solid rgba(0,200,160,0.3);border-radius:0 4px 4px 0;
                font-size:12px;font-weight:300;color:#8a9490;line-height:1.7;">${callout}</div>` : ''}
            </div>
            <a href="bodylens-day.html"
              style="flex-shrink:0;padding:9px 18px;background:#00c8a0;border-radius:4px;
              font-size:10px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;
              color:#0c1010;text-decoration:none;white-space:nowrap;">
              Today's plan →
            </a>
          </div>
        </div>
      </div>`;
  }

  function getPanelRows(type, p) {
    const DAY_MAP  = {0:6,1:0,2:1,3:2,4:3,5:4,6:5};
    const DAY_NAMES = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
    const todayIdx  = DAY_MAP[new Date().getDay()];
    const todayName = DAY_NAMES[todayIdx];
    const weekPlan  = p.weekPlan || [];
    const todayPlan = weekPlan[todayIdx] || {};
    const injuries  = p.injuryAssessments || p.injuries || [];
    const supps     = p.supplements || [];

    switch(type) {

      case 'alcohol':
        return [
          { label:'Your alcohol habit',   value: p.alcoholHabit || '—' },
          { label:'Today',                value: todayPlan.priority === 'training' ? 'Training day — alcohol off' : 'Rest day', color: todayPlan.priority === 'training' ? '#d94e35' : '#00c8a0' },
          { label:'Rule',                 value: 'No alcohol on training days', color:'#d94e35' },
          { label:'Rest days',            value: 'Max 2 units · Finish by 20:00' },
          { label:'mTOR impact',          value: 'Alcohol blocks adaptation directly', color:'#d94e35' },
        ];

      case 'training':
        const trainingDays = weekPlan.filter(d=>d.priority==='training').map(d=>d.day).join(', ');
        return [
          { label:'Your split',           value: `${p.trainingDays||4} days/week — ${trainingDays||'—'}` },
          { label:'Today',                value: `${todayName} — ${todayPlan.type||'Rest'}`, color: todayPlan.priority==='training'?'#00c8a0':'#8a9490' },
          { label:'Experience',           value: p.experience || '—' },
          { label:'Gym',                  value: p.gymAccess || '—' },
          { label:'Injuries',             value: injuries.length ? injuries.map(i=>i.location||i).join(', ') : 'None', color: injuries.length ? '#c8941e' : '#00c8a0' },
        ];

      case 'fuel':
        return [
          { label:'Daily calories',       value: `${p.calories||'—'} kcal`, color:'#00c8a0' },
          { label:'Protein target',       value: `${p.protein||'—'}g daily`, color:'#00c8a0' },
          { label:'Carbs / Fat',          value: `${p.carbs||'—'}g / ${p.fat||'—'}g` },
          { label:'Eating window',        value: p.fastingWindow || p.eatingWindow || 'Flexible' },
          { label:'Avoid',                value: (p.foodExclusions||[]).join(', ') || 'No restrictions', color: (p.foodExclusions||[]).length ? '#d94e35' : '#00c8a0' },
          { label:'Trigger foods',        value: p.triggerFoods || 'None identified', color: (p.triggerFoods && !p.triggerFoods.includes('None')) ? '#d94e35' : '#8a9490' },
        ];

      case 'hunger':
        return [
          { label:'Your energy pattern',  value: p.energyPattern || '—' },
          { label:'Eating window',        value: p.fastingWindow || p.eatingWindow || 'Flexible' },
          { label:'Trigger foods',        value: p.triggerFoods || 'None', color: p.triggerFoods && !p.triggerFoods.includes('None') ? '#d94e35' : '#8a9490' },
          { label:'Protein target',       value: `${p.protein||185}g — hit this and hunger largely manages itself` },
        ];

      case 'optimal':
        const tier1 = supps.slice(0,4).map(s=>s.name).join(', ');
        const recoveryStr = (p.recoveryTools||[]).join(', ') || 'None';
        return [
          { label:'Wake time',            value: p.wakeTime || '—', color:'#00c8a0' },
          { label:'Coffee timing',        value: p.wakeTime ? addMinutes(p.wakeTime, 90) + ' (post cortisol peak)' : '90min after wake' },
          { label:'Recovery tools',       value: recoveryStr },
          { label:'Sleep target',         value: p.sleep || '8 hours' },
          { label:'Key supplements',      value: tier1 || '—' },
          { label:'Non-negotiables',      value: (p.nonNegotiables||[]).slice(0,2).join(', ') || 'None set' },
        ];

      case 'longevity':
        return [
          { label:'Your age',             value: `${p.age||'—'} — ${getLongevityNote(p.age)}`, color:'#00c8a0' },
          { label:'Goal',                 value: p.goal || '—' },
          { label:'Sleep',                value: p.sleep || '—', color: (p.sleep||'').includes('8') ? '#00c8a0' : '#c47c18' },
          { label:'Recovery tools',       value: (p.recoveryTools||[]).join(', ') || 'None — worth adding' },
          { label:'VO₂max lever',         value: 'Zone 2 cardio — most powerful longevity intervention' },
        ];

      case 'weightloss':
        return [
          { label:'Current body fat',     value: p.bodyFat ? p.bodyFat + '%' : 'Not assessed' },
          { label:'Fat storage',          value: p.fatStorage || '—' },
          { label:'Calorie target',       value: `${p.calories||'—'} kcal/day` },
          { label:'Protein (non-neg)',    value: `${p.protein||185}g — prevents muscle loss during deficit`, color:'#00c8a0' },
          { label:'Goal',                 value: p.goal || '—' },
        ];

      case 'body':
        const modifiedMuscles = weekPlan.flatMap(d=>(d.modifications||[]).map(m=>m.split('→')[0]?.trim())).filter(Boolean);
        return [
          { label:'Training focus',       value: weekPlan.filter(d=>d.priority==='training').map(d=>d.type).join(', ') || '—' },
          { label:'Modified movements',   value: modifiedMuscles.length ? modifiedMuscles.slice(0,3).join(', ') : 'None', color: modifiedMuscles.length ? '#c8941e' : '#00c8a0' },
          { label:'Injury areas',         value: injuries.length ? injuries.map(i=>i.location||i).join(', ') : 'None', color: injuries.length ? '#c8941e' : '#00c8a0' },
          { label:'Priority muscles',     value: deriveGlutePriority(p) },
        ];

      case 'story':
        return [
          { label:'Reading as',           value: p.name || 'You', color:'#00c8a0' },
          { label:'Your morning starts',  value: p.wakeTime || '—' },
          { label:'Goal',                 value: p.goal || '—' },
          { label:'Injuries in story',    value: injuries.length ? 'Yes — modifications woven in' : 'None to note' },
        ];

      case 'synthesis':
        const signalCount = weekPlan.filter(d=>d.priority==='training').length;
        return [
          { label:'Signal',               value: `${signalCount} training sessions/week`, color:'#00c8a0' },
          { label:'Build',                value: `${p.sleep||'8h'} sleep · ${(p.recoveryTools||[]).join(', ')||'standard recovery'}` },
          { label:'Protect',              value: p.alcoholHabit && !p.alcoholHabit.includes('rarely') ? 'Alcohol management in place' : 'No major blockers', color: '#00c8a0' },
          { label:'Repeat lever',         value: `${p.protein||185}g protein daily · progressive overload` },
        ];

      case 'science':
        return [
          { label:'Most relevant to you', value: getScienceRelevance(p), color:'#00c8a0' },
          { label:'Age bracket',          value: `${p.age||'—'} — ${getLongevityNote(p.age)}` },
        ];

      case 'nonneg':
        return (p.nonNegotiables||[]).length
          ? (p.nonNegotiables||[]).map(n => ({ label:'Fixed point', value: n, color:'#00c8a0' }))
          : [{ label:'Non-negotiables', value: 'None set — add your fixed points below', color:'#8a9490' }];

      default:
        return [];
    }
  }

  function getPanelCallout(type, p) {
    switch(type) {
      case 'alcohol':
        if (!p.alcoholHabit || p.alcoholHabit.includes('rarely') || p.alcoholHabit.includes("don't")) return null;
        return `Your training days are ${(p.weekPlan||[]).filter(d=>d.priority==='training').map(d=>d.day).join(', ')}. These are your protected nights. Every other night: max 2 units, finished by 20:00.`;
      case 'fuel':
        return `${p.name}'s protein target is ${p.protein||185}g daily across ${p.mealCount||4} meals. Each meal needs to clear ~2.5g leucine to trigger mTOR. Total daily protein matters — but distribution matters equally.`;
      case 'optimal':
        return `Your morning window: wake at ${p.wakeTime||'07:00'}, sunlight 10 min, cold shower, coffee at ${addMinutes(p.wakeTime||'07:00',90)} with L-Theanine. This sequence sets the hormonal tone for the next 4 hours.`;
      case 'training':
        const todayPlanTrain = (p.weekPlan||[])[({0:6,1:0,2:1,3:2,4:3,5:4,6:5})[new Date().getDay()]] || {};
        if (todayPlanTrain.priority === 'training') {
          return `Today is a training day: ${todayPlanTrain.type}. Focus: ${todayPlanTrain.focus||''}. ${(todayPlanTrain.modifications||[]).length ? 'Modifications apply — see your day plan.' : 'No modifications needed.'}`;
        }
        return `Today is a rest day. MPS from your last session may still be elevated — hit protein and let the adaptation complete.`;
      default:
        return null;
    }
  }

  // Helper: add minutes to HH:MM
  function addMinutes(time, mins) {
    try {
      const [h, m] = time.split(':').map(Number);
      const total = h * 60 + m + mins;
      return `${String(Math.floor(total/60)%24).padStart(2,'0')}:${String(total%60).padStart(2,'0')}`;
    } catch(e) { return time; }
  }

  // Helper: longevity note by age
  function getLongevityNote(age) {
    if (!age) return 'Age not set';
    if (age < 30) return 'Building the foundation';
    if (age < 40) return 'Peak adaptation years';
    if (age < 50) return 'Most leveraged decade for longevity';
    if (age < 60) return 'Maintenance and optimisation';
    return 'Longevity priority phase';
  }

  // Helper: most relevant science for this person
  function getScienceRelevance(p) {
    const goal = (p.goal||'').toLowerCase();
    const hasInjuries = (p.injuryAssessments||p.injuries||[]).length > 0;
    if (hasInjuries) return 'Connective tissue, joint loading, collagen protocol';
    if (goal.includes('fat') || goal.includes('los')) return 'Fat oxidation, EPOC, insulin sensitivity';
    if (goal.includes('muscle') || goal.includes('build')) return 'mTOR, MPS, progressive overload';
    if (goal.includes('longevity')) return 'VO₂max, mitochondrial density, Zone 2';
    return 'MPS, hormonal optimisation, recovery science';
  }

  // Helper: derive glute/posterior priority
  function deriveGlutePriority(p) {
    const hasPostChain = (p.weekPlan||[]).some(d=>d.type&&d.type.toLowerCase().includes('posterior'));
    if (hasPostChain) return 'Posterior chain is primary — glutes, hamstrings';
    return 'Based on your split';
  }

})();

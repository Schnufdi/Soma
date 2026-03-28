// BodyLens — Plan Builder
// buildPlan() + applyOptimisations() + helpers
// Depends on: P, TODAY globals from bodylens-dailyplan.html
// No DOM access — pure data functions.

function buildPlan(profile, today) {
  const p = profile;
  const { name, plan, isTraining } = today;

  // Time helper
  const wake = p.wakeTime || '07:00';
  const [wHr, wMin] = wake.split(':').map(Number);
  const wMins = wHr * 60 + wMin;
  const fmt = (totalMins) => {
    const h = Math.floor(totalMins / 60) % 24;
    const m = totalMins % 60;
    return String(h).padStart(2,'0') + ':' + String(m).padStart(2,'0');
  };

  // Derived times
  const coffeeTime  = fmt(wMins + 90);
  const isFemale    = (p.sex||'').toLowerCase() === 'female';
  const injuries    = p.injuryAssessments || p.injuries || [];
  const supps       = p.supplements || [];
  const kcal        = (typeof getDayKcal==='function') ? getDayKcal(p, isTraining) : (plan.kcal || p.calories || 2000);
  const prot        = p.protein || 140;
  const carbs       = p.carbs   || 160;
  const fat         = p.fat     || 60;
  const water       = Math.round((p.weight || 75) * 35 + (isTraining ? 500 : 0));
  const window_str  = p.actualEatingWindow || p.fastingWindow || p.eatingWindow || 'flexible';
  const mealCount   = p.mealCount || 3;

  // Training time
  const trainTimeStr = (p.trainingTime || 'Morning').toLowerCase();
  const trainMins =
    trainTimeStr.includes('early')    ? wMins + 60  :
    trainTimeStr.includes('morning')  ? wMins + 120 :
    trainTimeStr.includes('lunch')    ? 12 * 60     :
    trainTimeStr.includes('afternoon')? 15 * 60     :
    trainTimeStr.includes('evening')  ? 18 * 60     : wMins + 120;

  // Supplements by timing
  const mornSupps  = supps.filter(s => /morning|wake|before train|any time|daily|with.*coffee/i.test(s.timing||'') || /creatine|theanine/i.test(s.name||''));
  const nightSupps = supps.filter(s => /night|sleep|evening|bed/i.test(s.timing||''));
  const mealSupps  = supps.filter(s => /meal|food|fat meal|largest meal/i.test(s.timing||'') && !/creatine|theanine/i.test(s.name||''));

  // Bedtime
  const bed = p.bedtime || '';
  const bedMins =
    bed.includes('Before 10') ? 21*60+30 :
    bed.includes('10–11')     ? 22*60    :
    bed.includes('11')        ? 22*60+30 :
    bed.includes('midnight')  ? 23*60+30 : 22*60;

  const blocks = [];

  // ── DURATION HELPER ──────────────────────────────
  // Each block gets durationMins — used for proportional height rendering.
  // MIN_BLOCK_HEIGHT = 60px, each minute = 1.2px above that baseline.

  // Estimate training duration: 10 warm-up + (exercises × 12 min avg) + 10 cool-down
  const exCount = (plan.keyExercises||[]).length || 4;
  const trainDuration = 10 + (exCount * 12) + 10;

  // WAKE
  blocks.push({
    time: wake, type: 'wake', tag: 'Wake', tagColor: 'jade',
    durationMins: 15,
    title: 'Morning ignition',
    subtitle: 'Cortisol peak · Circadian set',
    coachNote: 'No caffeine for 90 minutes. Your cortisol is already peaking — it\'s doing the stimulant\'s job. The water and sunlight aren\'t optional extras, they reset your clock for the whole day.',
    detail: 'No phone for 5 minutes. 500ml water immediately — you\'ve been fasting 7-8 hours.\n\nOutside for 10 minutes: morning light sets your circadian clock and determines tonight\'s melatonin timing.' + (isTraining && trainMins - wMins <= 90 ? '\n\nCollagen + Vit C at ' + fmt(trainMins - 45) + ' — 45 min before training.' : ''),
    science: 'Cortisol peaks 30-45 min post-wake. It\'s doing caffeine\'s job — don\'t double up.',
    items: [{ name:'Water', meta:'500ml immediately' }, { name:'Sunlight', meta:'10 min outside' }]
  });

  // COFFEE + MORNING SUPPS
  blocks.push({
    time: coffeeTime, type: 'supp', tag: 'Supps', tagColor: 'gold',
    durationMins: 10,
    title: 'Coffee & morning supplements',
    subtitle: '90 min post-wake — after cortisol peak',
    coachNote: 'Now the cortisol is clearing — this is when caffeine actually works. Creatine at this time is purely for habit consistency. It doesn\'t matter when you take it as long as you take it daily.',
    detail: 'Coffee now. The cortisol that was doing caffeine\'s job has peaked and is clearing.\n\n' +
      (mornSupps.length
        ? mornSupps.map(s => s.name + ' ' + s.dose + ' — ' + (s.timing||'')).join('\n')
        : 'Creatine 5g with water. Omega-3 with food if not taken.'),
    science: 'Caffeine before the cortisol peak adds nothing and enlarges the afternoon crash.',
    suppList: [{ name:'Coffee', dose:'1 cup', timing:'90 min post-wake — after cortisol peak' }]
      .concat(mornSupps.length ? mornSupps
        : [{ name:'Creatine', dose:'5g', timing:'with water' }]),
    items: mornSupps.length
      ? mornSupps.map(s => ({ name:s.name, meta:s.dose }))
      : [{ name:'Coffee', meta:'after cortisol peak' }, { name:'Creatine', meta:'5g' }]
  });

  // PRE-TRAINING (training days)
  if (isTraining) {
    const preMins = Math.max(trainMins - 105, wMins + 60);
    blocks.push({
      time: fmt(preMins), type: 'meal', tag: 'Eat', tagColor: 'amber',
      durationMins: 20,
      title: 'Pre-training meal',
      subtitle: '90-120 min before session',
      coachNote: 'This meal is timed to be digested before you train — not sitting in your stomach. High carbs because you need glycogen available, not stored. Low fat because fat slows gastric emptying and blunts the glucose delivery your muscles need.',
      mealSlot: 'pre-training',
      detail: 'High protein, moderate fast carbs, low fat.\nExclude: ' + ((p.foodExclusions||[]).join(', ')||'none') + '.\n' +
        ((p.cuisinePrefs||[]).length ? (p.cuisinePrefs[0] + ' style.') : '') + '\nKeep fat under 15g — slows gastric emptying and glucose delivery.',
      science: 'Glycogen priming + amino acid availability. Fat blunts the performance fuel supply.',
      items: [
        { name:'Protein', meta: Math.round(prot * 0.25) + 'g' },
        { name:'Fast carbs', meta:'40-60g' },
        { name:'Fat', meta:'under 15g' }
      ]
    });

    // TRAINING
    const trainCoachNote = 'Every working set should be 1-3 reps from failure — that\'s where the adaptation lives. The warm-up sets aren\'t optional, they\'re how you avoid injury and prime the pattern. Track every load. Progressive overload is the only mechanism that drives change.'
      + (injuries.length ? ' ' + injuries.map(i => i.location||i).join(', ') + ' modifications are active — don\'t ignore them, the injury is the constraint you\'re working inside.' : '');
    const injNote = injuries.length
      ? ' Modifications active: ' + injuries.map(i => i.location||i).join(', ') + '.'
      : '';
    blocks.push({
      time: fmt(trainMins), type: 'training', tag: 'Train', tagColor: 'jade',
      durationMins: trainDuration,
      gymTimeEst: trainDuration + ' min',
      title: plan.type + ': ' + (plan.focus || ''),
      subtitle: 'Main session · ~' + trainDuration + ' min',
      detail: 'Warm up 10 min. Working sets at RPE 7-9 — 1-3 reps from failure. Track every load.' + injNote + '\nCool down 5-10 min.',
      coachNote: trainCoachNote,
      science: 'The last 5 reps drive adaptation. Everything before is preparation.',
      exercises: (plan.keyExercises||[]).slice(0,8),
      items: ((plan.keyExercises||[]).slice(0,7).map(e => ({ name:e, meta:'' }))
              .concat([{ name:'Track loads', meta:'progressive overload' }])).slice(0,8),
      cardioRec: (function(sessionType) {
        var age = p.age || 35;
        var z2Lo = Math.round((220-age)*0.65);
        var z2Hi = Math.round((220-age)*0.70);
        var t = (sessionType||'').toLowerCase();
        if (t.indexOf('posterior') >= 0 || t.indexOf('glute') >= 0 || t.indexOf('leg') >= 0) {
          return {
            when: 'Post-session only · low-impact',
            why: 'Heavy posterior chain work already loads glutes and hamstrings hard. No running or rowing today — they extend the same pattern. Choose upper-body or unloaded cardio.',
            options: [
              { name: 'Swim', detail: '20–25 min easy, upper-body dominant', bpmLo: z2Lo, bpmHi: z2Hi },
              { name: 'Seated Bike', detail: '20 min Zone 2, low resistance', bpmLo: z2Lo, bpmHi: z2Hi },
              { name: 'Step Machine', detail: '15–20 min moderate pace', bpmLo: z2Lo, bpmHi: z2Hi }
            ],
            avoid: 'Running, rowing, box jumps — all extend posterior chain load'
          };
        } else if (t.indexOf('push') >= 0 || t.indexOf('chest') >= 0) {
          return {
            when: 'Pre or post-session · full freedom',
            why: 'Upper body push day — lower body cardio is completely free. Zone 2 pre-session primes the cardiovascular system without competing with upper body work.',
            options: [
              { name: 'Run', detail: '20–25 min Zone 2', bpmLo: z2Lo, bpmHi: z2Hi },
              { name: 'Bike', detail: '20 min Zone 2', bpmLo: z2Lo, bpmHi: z2Hi },
              { name: 'Row', detail: '15 min Zone 2 — legs dominant today', bpmLo: z2Lo, bpmHi: z2Hi },
              { name: 'Swim', detail: '20 min easy', bpmLo: z2Lo, bpmHi: z2Hi }
            ],
            avoid: 'Nothing — full cardio freedom today'
          };
        } else if (t.indexOf('pull') >= 0) {
          return {
            when: 'Pre or post-session · lower body free',
            why: 'Pull day taxes lats, rhomboids, and biceps. Lower body cardio is completely unaffected.',
            options: [
              { name: 'Run', detail: '20–25 min Zone 2', bpmLo: z2Lo, bpmHi: z2Hi },
              { name: 'Bike', detail: '20 min Zone 2', bpmLo: z2Lo, bpmHi: z2Hi },
              { name: 'Step Machine', detail: '15–20 min', bpmLo: z2Lo, bpmHi: z2Hi }
            ],
            avoid: 'Rowing — taxes same back muscles as the pull session'
          };
        } else if (t.indexOf('upper') >= 0) {
          return {
            when: 'Post-session · light only',
            why: 'Saturday upper session accumulates fatigue across the week. Keep cardio short and Zone 2 only — recovery is the priority.',
            options: [
              { name: 'Walk', detail: '30 min brisk', bpmLo: z2Lo, bpmHi: z2Hi },
              { name: 'Bike', detail: '15 min easy', bpmLo: z2Lo, bpmHi: z2Hi },
              { name: 'Swim', detail: '20 min easy', bpmLo: z2Lo, bpmHi: z2Hi }
            ],
            avoid: 'High-intensity cardio \u2014 accumulated training load all week'
          };
        } else {
          return {
            when: 'Post-session · Zone 2',
            why: 'Zone 2 cardio builds aerobic base and accelerates recovery via EPOC.',
            options: [
              { name: 'Bike', detail: '20 min Zone 2', bpmLo: z2Lo, bpmHi: z2Hi },
              { name: 'Swim', detail: '20 min easy', bpmLo: z2Lo, bpmHi: z2Hi },
              { name: 'Walk', detail: '30 min brisk', bpmLo: z2Lo, bpmHi: z2Hi }
            ],
            avoid: ''
          };
        }
      })(plan.type)
    });

    // POST-TRAINING
    blocks.push({
      time: fmt(trainMins + trainDuration + 5), type: 'meal', tag: 'Eat', tagColor: 'amber',
      durationMins: 15,
      title: 'Post-training nutrition',
      subtitle: 'Within 30 min of finishing',
      coachNote: 'mTOR is elevated right now — your muscles are primed to absorb protein. This window closes. Fast protein and fast carbs here, not a slow meal. The 30-minute window isn\'t a myth, it\'s the mechanism.',
      mealSlot: 'post-training',
      detail: 'Fast protein + fast carbs. mTOR is elevated — this window matters.\nTarget ' + Math.round(prot * 0.28) + 'g protein here.\n' +
        ((p.dietType||'').toLowerCase().includes('vegan')
          ? 'Plant-based: combine sources to hit leucine threshold (2.5g leucine minimum).'
          : 'Whey or egg white is fastest if convenience is a factor.'),
      science: 'mTOR peaks post-training. Leucine threshold 2.5g per meal triggers protein synthesis.',
      items: [
        { name:'Fast protein', meta: Math.round(prot * 0.28) + 'g' },
        { name:'Fast carbs', meta:'30-40g' }
      ]
    });
  }

  // MIDDAY / FIRST MEAL
  const middayMins = isTraining
    ? Math.max(trainMins + trainDuration + 90, 12*60)
    : wMins + 210;
  blocks.push({
    time: fmt(middayMins), type: 'meal', tag: 'Eat', tagColor: 'amber',
    durationMins: 25,
    title: isTraining ? 'Midday meal' : 'First meal',
    subtitle: isTraining ? 'Protein anchor' : window_str,
    coachNote: isTraining ? 'Protein every 3-4 hours keeps muscle protein synthesis running between the post-training spike and the next meal. This isn\'t just fuel — it\'s the signal that repair should continue.' : 'First meal of your eating window. Protein first, every time. It sets satiety hormones for the rest of the day and starts the MPS clock.',
    mealSlot: 'midday',
    detail: 'Build around protein. ' +
      ((p.cuisinePrefs||[]).length ? p.cuisinePrefs[0] + ' inspired. ' : '') +
      'Include vegetables. Avoid: ' + (p.triggerFoods||'none') + '.',
    science: 'Protein every 3-4 hours sustains MPS throughout the day.',
    items: [
      { name:'Protein', meta: Math.round(prot * 0.28) + 'g' },
      { name:'Vegetables', meta:'200g+' },
      { name:'Carbs', meta: isTraining ? '40-60g' : '30-50g' }
    ]
  });

  // AFTERNOON (if 4+ meals)
  if (mealCount >= 4) {
    blocks.push({
      time: fmt(Math.max(middayMins + 180, 15*60)),
      type:'meal', tag:'Eat', tagColor:'amber',
      durationMins: 20,
      title: 'Afternoon meal',
      subtitle: 'Protein maintained',
      coachNote: 'Lighter carbs here — glycogen is replenished from the morning meal and training. Protein stays consistent. This meal exists to keep MPS elevated and prevent the cortisol-driven hunger that leads to poor evening choices.',
      mealSlot: 'afternoon',
      detail: 'Lighter than midday. Protein anchor, lower carbs.\n' +
        ((p.cuisinePrefs||[]).length ? p.cuisinePrefs[0] + ' style.' : ''),
      science: 'Consistent protein timing sustains elevated MPS across the full day.',
      items: [
        { name:'Protein', meta: Math.round(prot * 0.22) + 'g' },
        { name:'Veg or fruit', meta:'200g' }
      ]
    });
  }

  // EVENING MEAL
  const eveningMins = Math.max(middayMins + 210, 18*60);
  const closeWin =
    window_str.includes('20:') ? 20*60 :
    window_str.includes('19:') ? 19*60 : 21*60;
  blocks.push({
    time: fmt(eveningMins), type: 'meal', tag: 'Eat', tagColor: 'amber',
    durationMins: 30,
    title: 'Evening meal',
    subtitle: 'Final protein hit · close the window',
    coachNote: 'Last protein hit of the day. Casein-rich foods like cottage cheese or Greek yoghurt release amino acids slowly through the overnight fast — they extend MPS while you sleep. Close the eating window after this.',
    mealSlot: 'evening',
    mealSuppList: mealSupps,
    detail: 'Lean protein priority. ' +
      (isTraining ? 'Lower carbs than midday — glycogen already replenished.' : 'Moderate carbs fine on rest day.') +
      '\nClose eating window by ' + fmt(closeWin) + '.',
    science: 'Casein-rich foods (cottage cheese, Greek yoghurt) extend overnight MPS during the fast.',
    items: [
      { name:'Lean protein', meta: Math.round(prot * 0.25) + 'g' },
      { name:'Vegetables', meta:'200g' },
      { name:'Window closes', meta: fmt(closeWin) }
    ]
  });

  // WIND-DOWN
  blocks.push({
    time: fmt(bedMins - 45), type: 'recovery', tag: 'Wind down', tagColor: 'slate',
    durationMins: 45,
    title: 'Evening wind-down',
    subtitle: 'Protect tonight\'s adaptation',
    coachNote: 'Tonight\'s sleep is where today\'s training becomes actual muscle. GH pulses in the first 90 minutes of slow-wave sleep. Screens kill melatonin onset and delay that first cycle. The magnesium isn\'t a placebo — it activates GABA and physically lowers your nervous system\'s arousal state.',
    detail: 'Screens dim or off.\n' +
      (nightSupps.length
        ? nightSupps.map(s => s.name + ' ' + s.dose).join('. ') + '.'
        : 'Magnesium glycinate 300mg.') +
      '\nRoom 17-19°C.' +
      ((p.recoveryTools||[]).length ? '\nRecovery: ' + (p.recoveryTools||[]).slice(0,2).join(', ') + ' if available.' : ''),
    science: 'Core temperature drop signals sleep onset. Magnesium activates GABA for sleep transition.',
    suppList: nightSupps.length ? nightSupps : [{ name:'Magnesium glycinate', dose:'300mg', timing:'30 min before sleep' }],
    items: [
      ...nightSupps.map(s => ({ name:s.name, meta:s.dose })),
      { name:'Screens off', meta:'45 min before sleep' },
      { name:'Room temp', meta:'17-19°C' }
    ].slice(0, 4)
  });

  // SLEEP
  const sleepHours = (p.sleep||'7-8h').replace(/[^0-9\-]/g,'').split('-')[0];
  const sleepDuration = Math.round(parseFloat(sleepHours) * 60) || 450;
  blocks.push({
    time: fmt(bedMins), type: 'sleep', tag: 'Sleep', tagColor: 'slate',
    durationMins: sleepDuration,
    title: 'Sleep',
    subtitle: p.sleep || '7-8 hours',
    coachNote: isTraining ? 'This is where the session pays off. Growth hormone peaks in the first slow-wave cycle. One week of sub-6 hour sleep reduces testosterone 10-15% and cuts the anabolic response to training in half. Nothing overrides this.' : 'Rest day recovery happens here. Satellite cells divide, myofibrils remodel, cortisol clears. The adaptation from your last session compounds overnight.',
    detail: isTraining
      ? 'Training day: sleep is where adaptation happens. GH pulses in the first slow-wave cycle — this is when today&#39;s session becomes actual muscle. Nothing else drives recovery like this.'
      : 'Rest day: sleep extends the repair from previous sessions. Satellite cells divide, myofibrils remodel, cortisol clears.',
    science: isFemale
      ? 'GH peaks in first 90 min. Progesterone is a natural GABA agonist — protect sleep to protect hormonal recovery.'
      : 'GH peaks in first 90 min. One week sub-6h sleep reduces testosterone 10-15%.',
    items: [
      { name:'Target', meta: p.sleep || '7-8h' },
      { name:'Wake', meta: wake }
    ]
  });

  // Apply any saved optimisations to the blocks
  applyOptimisations(blocks, p, today);

  // Enrich meal titles from weekly meal plan (if available)
  var wm = loadWeeklyMeals();
  if (wm && wm.days && wm.days[name]) {
    var dayMeals = wm.days[name];
    // Slot translation: meals.html uses breakfast/lunch/dinner
    // dailyplan uses midday/evening/pre-training/post-training
    // Map the meal plan slots to daily plan slots based on training context
    var slotMap = isTraining ? {
      'breakfast':    'pre-training',
      'lunch':        'post-training',
      'dinner':       'evening',
      'snack1':       'afternoon',
      'snack2':       'afternoon',
      'midday':       'post-training',
      'evening':      'evening',
    } : {
      'breakfast':    'midday',
      'lunch':        'midday',
      'dinner':       'evening',
      'snack1':       'afternoon',
      'snack2':       'afternoon',
      'midday':       'midday',
      'evening':      'evening',
    };
    // Build a reverse map: dailyPlanSlot -> mealPlanMeal
    var dpToMeal = {};
    Object.keys(dayMeals).forEach(function(mSlot) {
      var dpSlot = slotMap[mSlot] || mSlot;
      if (!dpToMeal[dpSlot]) dpToMeal[dpSlot] = dayMeals[mSlot]; // first wins
    });
    blocks.forEach(function(b) {
      var meal = dpToMeal[b.mealSlot] || dayMeals[b.mealSlot];
      if (b.mealSlot && meal && meal.name) {
        b.title = meal.name;
        b.subtitle = meal.protein + 'g P · ' + meal.calories + ' kcal' + (meal.prepTime ? ' · ' + meal.prepTime : '');
        // Pre-populate recipe cache from weekly plan so no extra API call needed
        _rSave(b.mealSlot, meal);
      }
    });
  }

  return {
    dayTitle: name + (isTraining ? ' — ' + plan.type : ' — Rest'),
    dayBrief: (function() {
      var base = isTraining
        ? plan.type + ' day. Signal, feed, recover. Hit ' + prot + 'g protein.'
        : 'Recovery day. The adaptation from your last session is happening now. Protein + sleep.';
      var gb = p.gapBridge;
      if (gb && gb.weeklyFocus) {
        base += ' • ' + gb.weeklyFocus;
      }
      return base;
    })(),
    _dayBriefLegacy: isTraining
      ? plan.type + ' day. Signal, feed, recover. Hit ' + prot + 'g protein.'
      : 'Recovery day. The adaptation from your last session is happening now. Protein + sleep.',
    priority: isTraining
      ? Math.round(prot * 0.28) + 'g protein within 30 min post-training. This window matters most.'
      : prot + 'g protein today — including rest days. MPS runs 24-48h post-session.',
    macros: { kcal, prot, carbs, fat, water: (water/1000).toFixed(1) + 'L' },
    blocks
  };
}

// ── OPTIMISATION INJECTION ENGINE ─────────────────────────────────────────────
// Reads p.optimisations (and legacy p.accelerators) and mutates blocks in-place.
// Each rule specifies: which days it fires, what it does (note/new-block/modify).

function getOptIds(p) {
  // Merge legacy p.accelerators with p.optimisations into a flat ID set
  var ids = new Set();
  (p.accelerators || []).forEach(function(id){ ids.add(id); });
  (p.optimisations || []).forEach(function(o){ ids.add(typeof o === 'string' ? o : o.id); });
  return ids;
}

function applyOptimisations(blocks, p, today) {
  var ids = getOptIds(p);
  if (!ids.size) return;

  var isTraining = today.isTraining;
  var fmt = function(totalMins) {
    var h = Math.floor(totalMins / 60) % 24;
    var m = totalMins % 60;
    return String(h).padStart(2,'0') + ':' + String(m).padStart(2,'0');
  };
  var wake = p.wakeTime || '07:00';
  var wMins = parseInt(wake) * 60 + parseInt((wake.split(':')[1]||0));
  var bedStr = p.bedtime || '22:30';
  var bedMatch = bedStr.match(/(\d+)[:\.]?(\d*)/);
  var bedH = bedMatch ? parseInt(bedMatch[1]) : 22;
  if (bedH < 12) bedH += 12;
  var bedMins = bedH * 60 + (bedMatch && bedMatch[2] ? parseInt(bedMatch[2]) : 30);

  // ── Helpers ──────────────────────────────────────
  function addNoteToType(type, note, color) {
    blocks.forEach(function(b) {
      if (b.type === type) {
        b.coachNote = (b.coachNote ? b.coachNote + ' · ' : '') + note;
      }
    });
  }

  function addNoteToMeals(note) {
    blocks.forEach(function(b) {
      if (b.mealSlot) {
        b.optNotes = b.optNotes || [];
        b.optNotes.push(note);
      }
    });
  }

  function insertBlockAfterType(type, newBlock) {
    var idx = -1;
    for (var i = blocks.length - 1; i >= 0; i--) {
      if (blocks[i].type === type) { idx = i; break; }
    }
    if (idx >= 0) blocks.splice(idx + 1, 0, newBlock);
    else blocks.push(newBlock);
  }

  function insertBlockBeforeType(type, newBlock) {
    var idx = -1;
    for (var i = 0; i < blocks.length; i++) {
      if (blocks[i].type === type) { idx = i; break; }
    }
    if (idx >= 0) blocks.splice(idx, 0, newBlock);
    else blocks.unshift(newBlock);
  }

  function hasBlock(type) {
    return blocks.some(function(b){ return b.type === type; });
  }

  var goal    = (p.goal||'').toLowerCase();
  var isRecomp = goal.includes('recomp');
  var age     = p.age || 35;
  var protein = p.protein || 140;

  // Helper: build goal-specific benefit string
  function benefit(generic, recompNote) {
    return (isRecomp && recompNote) ? recompNote : generic;
  }

  // ── NUTRITION OPTIMISATIONS ───────────────────────

  if (ids.has('post-meal-walks')) {
    addNoteToMeals(benefit(
      '🚶 10–15 min walk after this meal — reduces glucose spike 20–30%.',
      '🚶 Walk 10–15 min after eating. Glucose clears into muscle glycogen rather than fat storage — directly supports the "lean" side of recomposition. Compounding: every meal you walk after is a meal that didn\'t spike insulin unnecessarily.'
    ));
  }

  if (ids.has('food-ordering')) {
    addNoteToMeals(benefit(
      '🥗 Protein and veg first, carbs last — flattens glucose spike 30–40%.',
      '🥗 Eat protein and veg before carbs. This flattens your glucose-insulin response 30–40% — which matters for recomp because insulin suppresses fat oxidation. Same food, better partition: more goes to muscle, less to fat.'
    ));
  }

  if (ids.has('vinegar')) {
    addNoteToMeals(benefit(
      '🥤 1 tbsp ACV in water before this meal — reduces peak glucose 20–30%.',
      '🥤 Take 1 tbsp apple cider vinegar in water before this meal. Acetic acid slows gastric emptying, blunting the glucose spike by 20–30%. At ' + age + ', insulin sensitivity is one of your primary body composition levers — this stacks with food ordering and post-meal walks.'
    ));
  }

  if (ids.has('carb-backload') && isTraining) {
    blocks.forEach(function(b) {
      if (b.mealSlot === 'midday' || b.mealSlot === 'pre-training') {
        b.optNotes = b.optNotes || [];
        b.optNotes.push(benefit(
          '⚡ Carb back-loading: keep carbs low before training. Hold them for the post-session window.',
          '⚡ Carb back-loading: keep this meal protein + fat only. Holding carbs until after training maximises fat oxidation during the session, then the post-workout carbs go directly into muscle glycogen. Better fuel partition = faster recomp.'
        ));
      }
      if (b.mealSlot === 'post-training') {
        b.optNotes = b.optNotes || [];
        b.optNotes.push(benefit(
          '⚡ Carb back-loading: this is your maximum carb window. White rice, sweet potato, fruit.',
          '⚡ Carb back-loading: maximum carb opportunity. Your muscles are insulin-sensitised right now — carbs consumed here go to glycogen at 3–5× the efficiency of any other time. This is your recomp window.'
        ));
      }
    });
  }

  if (ids.has('fasted-coffee') && isTraining) {
    blocks.forEach(function(b) {
      if (b.type === 'wake') {
        b.optNotes = b.optNotes || [];
        b.optNotes.push(benefit(
          '☕ Fasted training today. Black coffee 30–45 min before session. No food until post-training.',
          '☕ Train fasted today. Fasted training elevates growth hormone 2–3× and maximises fat oxidation during the session without compromising muscle protein (protein is high enough to protect it). Black coffee 30–45 min before. No food until post-training meal.'
        ));
      }
    });
  }

  if (ids.has('fibre-30g')) {
    blocks.forEach(function(b) {
      if (b.mealSlot === 'midday' || b.mealSlot === 'evening') {
        b.optNotes = b.optNotes || [];
        b.optNotes.push(benefit(
          '🌿 Fibre target: include legumes, vegetables, or whole grains. Running total toward 30g today.',
          '🌿 30g fibre target: include legumes, veg, or whole grains here. High fibre improves gut microbiome diversity (relevant to insulin sensitivity), extends satiety, and improves SHBG binding — all directly relevant to your recomp goal. Running total across today\'s meals.'
        ));
      }
    });
  }

  // ── TRAINING OPTIMISATIONS ────────────────────────

  if (!isTraining) {
    // Zone 2 is ALWAYS prescribed on rest days — not opt-in.
    // This is a core pillar of body recomposition at 40+: active recovery,
    // mitochondrial density, fat oxidation without muscle breakdown.
    var z2Mins = wMins + 240; // ~4h after wake, mid-morning
    var z2Lo = Math.round((220 - age) * 0.65);
    var z2Hi = Math.round((220 - age) * 0.70);
    insertBlockBeforeType('recovery', {
      time: fmt(z2Mins), type: 'training', tag: 'Zone 2', tagColor: 'jade',
      durationMins: 45,
      title: 'Zone 2 — 45 min',
      subtitle: z2Lo + '–' + z2Hi + ' bpm · conversational pace',
      coachNote: 'Zone 2 on a rest day is one of the most intelligent recomp tools available. It burns fat without creating additional recovery demand on your muscles. At ' + age + ', mitochondrial density is a primary lever — this directly improves the rate at which your cells oxidise fat at rest. ' + z2Lo + '–' + z2Hi + ' bpm. You should be able to hold a full sentence throughout.',
      cardio: true,
      cardioType: 'zone2',
      cardioTargetLo: z2Lo,
      cardioTargetHi: z2Hi,
      cardioDuration: 45,
      cardioOptions: ['Bike (recommended)', 'Row', 'Brisk walk', 'Incline treadmill'],
      exercises: [],
      optNotes: ['\uD83E\uDEC0 ' + z2Lo + '\u2013' + z2Hi + ' bpm for your age. If you cannot hold a conversation, slow down.']
    });
  }

  // VO2max intervals — always on one training day per week (Wednesday = pull day)
  // This is the highest-return longevity and performance investment available.
  // 4x4 protocol: 4 sets of 4 min at 90-95% max HR, 3 min active recovery.
  if (isTraining && today.idx === 2) { // Wednesday — pull day, lowest fatigue risk
    var vo2Lo = Math.round((220 - age) * 0.90);
    var vo2Hi = Math.round((220 - age) * 0.95);
    insertBlockBeforeType('training', {
      time: fmt(trainMins - 20), type: 'training', tag: 'Cardio', tagColor: 'jade',
      durationMins: 28,
      title: 'VO₂max intervals — 4×4',
      subtitle: vo2Lo + '–' + vo2Hi + ' bpm · before weights',
      coachNote: 'VO₂max is the single strongest predictor of longevity. At ' + age + ', 4×4 intervals done once per week drive significant VO₂max gains within 6 weeks. Do these before weights — fresh legs, maximum cardiac output. Not a warm-up: this is a separate performance block.',
      cardio: true,
      cardioType: 'vo2max',
      cardioTargetLo: vo2Lo,
      cardioTargetHi: vo2Hi,
      cardioDuration: 28,
      cardioProtocol: '4 sets × 4 min at ' + vo2Lo + '–' + vo2Hi + ' bpm. Rest 3 min between sets (active: walk or easy pedal). Total: 28 min.',
      cardioOptions: ['Bike (recommended)', 'Row', 'Ski erg', 'Assault bike'],
      exercises: []
    });
  }

  if (ids.has('vo2max-intervals') && isTraining) {
    blocks.forEach(function(b) {
      if (b.type === 'training') {
        b.optNotes = b.optNotes || [];
        b.optNotes.push(benefit(
          '🔥 VO₂max add-on: 4×4 min at 90–95% max HR with 3 min rest. 16 min total. Once this week.',
          '🔥 VO₂max add-on: after your session, 4×4 min at 90–95% max HR with 3 min rest. VO₂max is the strongest predictor of all-cause mortality at ' + age + ' — and it directly improves nutrient partitioning. 16 min total. Do this once this week max.'
        ));
      }
    });
  }

  if (ids.has('loaded-stretch') && isTraining) {
    insertBlockAfterType('training', {
      time: '', type: 'recovery', tag: 'Stretch', tagColor: 'slate',
      durationMins: 20,
      title: 'Loaded stretching — 20 min',
      subtitle: 'Fascial remodelling · hypertrophy at end-range',
      coachNote: benefit(
        'Hold each stretch under load for 90–120 seconds. Creates hypertrophy stimulus at long muscle length.',
        'Loaded stretching is hypertrophy without CNS cost — it generates a growth signal in the muscles at their longest length, which standard training misses. At ' + age + ', this also maintains the connective tissue quality that determines how long you can keep training. Pick 3–4 muscles from today\'s session, 90–120 sec per position.'
      ),
      optNotes: ['🧘 Target today\'s muscles. Lat hang, RDL stretch, face-pull stretch, rear delt. 2 min per position under mild load.']
    });
  }

  if (ids.has('bfr') && isTraining) {
    blocks.forEach(function(b) {
      if (b.type === 'training') {
        b.optNotes = b.optNotes || [];
        b.optNotes.push('🩸 BFR option: finish with 2–3 BFR isolation sets at 20% 1RM. Same hypertrophy signal at a fraction of the load — zero additional CNS cost. Good for arms, calves, or anything lagging.');
      }
    });
  }

  if (ids.has('training-log') && isTraining) {
    blocks.forEach(function(b) {
      if (b.type === 'training') {
        b.optNotes = b.optNotes || [];
        b.optNotes.push('📓 Log every set before you leave the gym: exercise · weight · reps · RPE. This is the data that drives intelligent progression. Check last week\'s numbers before you start.');
      }
    });
  }

  if (ids.has('dopamine-scheduling') && isTraining) {
    blocks.forEach(function(b) {
      if (b.type === 'supp') {
        b.optNotes = b.optNotes || [];
        b.optNotes.push('🧠 No social media or passive content for 60–90 min before training. Lower dopamine baseline = bigger training reward = better motivation and session quality. Protect this window.');
      }
    });
  }

  // ── RECOVERY OPTIMISATIONS ────────────────────────

  if (ids.has('sauna') && !isTraining && !ids.has('contrast')) {
    insertBlockBeforeType('recovery', {
      time: fmt(bedMins - 120), type: 'recovery', tag: 'Sauna', tagColor: 'gold',
      durationMins: 20,
      title: 'Sauna — 20 min',
      subtitle: 'GH pulse · heat shock proteins · cardiovascular adaptation',
      coachNote: benefit(
        'GH pulses significantly during sauna exposure. Heat shock proteins accelerate muscle repair. 80–100°C for 15–20 min.',
        'Sauna triggers a GH pulse comparable to moderate-intensity exercise. Heat shock proteins activated here repair damaged muscle proteins — directly relevant after your training days. At ' + age + ', the cardiovascular adaptation from regular sauna use (3–5×/week) reduces all-cause mortality by ~40% in longitudinal data. 80–100°C, 15–20 min.'
      ),
      optNotes: ['🔥 80–100°C target. Full cool-down after — core temp must drop before sleep for quality sleep onset.']
    });
  }

  if (ids.has('contrast') && !isTraining) {
    insertBlockBeforeType('recovery', {
      time: fmt(bedMins - 150), type: 'recovery', tag: 'Contrast', tagColor: 'jade',
      durationMins: 60,
      title: 'Cold–hot contrast cycling',
      subtitle: 'Norepinephrine +300% · accelerated recovery · mental resilience',
      coachNote: benefit(
        'Cold-hot contrast cycling raises norepinephrine 300% above baseline. 3–4 cycles. End on heat for sleep.',
        'Norepinephrine surges 300% during cold immersion — this drives fat metabolism and mood regulation for hours after. The contrast cycling also dramatically accelerates clearance of inflammatory markers from yesterday\'s session. 3–4 full cycles, 20 min sauna → 2–3 min cold. End on heat tonight for sleep quality.'
      ),
      optNotes: ['🧊 Protocol: 20 min sauna → 2–3 min cold (≤15°C) → repeat 3–4 cycles. End on heat tonight for sleep quality.']
    });
  }

  if (ids.has('nsdr') && !isTraining) {
    var nsdrMins = wMins + 390;
    insertBlockAfterType('supp', {
      time: fmt(nsdrMins), type: 'recovery', tag: 'NSDR', tagColor: 'slate',
      durationMins: 20,
      title: 'NSDR / Yoga Nidra — 20 min',
      subtitle: 'Dopamine +65% · cortisol reset · equivalent recovery to 90 min sleep',
      coachNote: benefit(
        'Non-sleep deep rest restores dopamine to baseline and provides recovery equivalent to 90 min sleep.',
        'NSDR raises dopamine 65% above baseline and provides recovery equivalent to ~90 min of sleep — without actually sleeping. On rest days, your cortisol from the training week is still elevated. This directly addresses that, which matters for body recomp: lower cortisol = better fat oxidation and less cortisol-driven muscle catabolism. 20 min, eyes closed, body-scan audio.'
      ),
      optNotes: ['🌊 iRest or Yoga Nidra audio. Lie flat, eyes closed. Not sleep — maintain awareness throughout. Free on YouTube.']
    });
  }

  if (ids.has('sleep-extension')) {
    blocks.forEach(function(b) {
      if (b.type === 'sleep') {
        b.optNotes = b.optNotes || [];
        b.optNotes.push(benefit(
          '😴 Sleep extension: target +30–60 min above usual. Testosterone and MPS improve measurably within 2 weeks.',
          '😴 Sleep extension active: target +30–60 min tonight. At ' + age + ', growth hormone is released almost exclusively during sleep, and testosterone drops measurably after one week of 5–6h nights. More sleep = more GH = more muscle retention during fat loss. This is the cheapest anabolic tool available.'
        ));
      }
    });
  }

  // ── BEHAVIOUR OPTIMISATIONS ───────────────────────

  if (ids.has('morning-protocol')) {
    blocks.forEach(function(b) {
      if (b.type === 'wake') {
        b.optNotes = b.optNotes || [];
        b.optNotes.push(benefit(
          '☀️ Morning protocol: 10 min outside within 30 min of waking. Cold water finish on shower.',
          '☀️ Morning protocol: outside for 10 min within 30 min of waking (sets circadian clock and cortisol peak timing), cold water finish on your shower (norepinephrine spike that persists for 2–4 hours). At ' + age + ', circadian alignment is directly linked to testosterone rhythm — this keeps the timing sharp.'
        ));
      }
    });
  }

  if (ids.has('implementation-intent') && isTraining) {
    blocks.forEach(function(b) {
      if (b.type === 'training') {
        b.optNotes = b.optNotes || [];
        b.optNotes.push('🎯 Implementation intention: before you start, decide your if-then. "If I feel like skipping set 3, I will rest 30 extra seconds and do it anyway." Pre-committing doubles follow-through rate.');
      }
    });
  }

  if (ids.has('body-composition-check') && today.idx === 0) {
    insertBlockAfterType('wake', {
      time: fmt(wMins + 5), type: 'recovery', tag: 'Check-in', tagColor: 'jade',
      durationMins: 5,
      title: 'Weekly body composition check-in',
      subtitle: 'Post-toilet · pre-food · same conditions every Monday',
      coachNote: benefit(
        'Record weight + waist every Monday, same conditions. Trend across 4 weeks is the signal.',
        'Record weight (kg) + waist circumference (cm at navel) every Monday, same conditions. Recomposition often shows as stable scale weight with shrinking waist — one number alone misreads the story. 4-week trend is your data; any single day is noise.'
      ),
      optNotes: ['📊 Weight (kg) + waist (cm at navel). Same time, same conditions. Log in today\'s notes.']
    });
  }

  if (ids.has('neat')) {
    blocks.forEach(function(b) {
      if (b.type === 'wake') {
        b.optNotes = b.optNotes || [];
        b.optNotes.push(benefit(
          '📈 NEAT target: +2,000–3,000 steps above baseline. That\'s 100–150 kcal without touching food or training.',
          '📈 NEAT target: +2,000–3,000 steps above your baseline today. Non-exercise activity thermogenesis is the most sustainable fat loss lever because it doesn\'t trigger hunger compensation the way formal cardio does. 3,000 extra steps ≈ 150 kcal — compounded daily across a week that\'s more than a full rest-day calorie deficit.'
        ));
      }
    });
  }

  // ── ACTIVE ACCELERATORS SUMMARY BLOCK ─────────────
  // Inject a summary block at the top of the day when any accelerators are active
  var activeList = [];
  var ACC_SUMMARY = {
    'post-meal-walks':    { icon:'🚶', name:'Post-meal walks',     when: 'every meal',    benefit: 'glucose → glycogen, not fat' },
    'food-ordering':      { icon:'🥗', name:'Protein-first order', when: 'every meal',    benefit: '30–40% flatter insulin spike' },
    'vinegar':            { icon:'🥤', name:'ACV before meals',    when: 'before carbs',  benefit: 'insulin sensitivity +' },
    'carb-backload':      { icon:'⚡', name:'Carb back-loading',   when: 'training days', benefit: 'fat burn during, glycogen after' },
    'fasted-coffee':      { icon:'☕', name:'Fasted training',     when: 'today',         benefit: 'GH +2–3×, fat oxidation peak' },
    'fibre-30g':          { icon:'🌿', name:'30g fibre',           when: 'today',         benefit: 'gut health, satiety, SHBG' },
    'zone2':              { icon:'🫀', name:'Zone 2 cardio',       when: 'rest days',     benefit: 'mitochondria + active recovery' },
    'vo2max-intervals':   { icon:'🔥', name:'VO₂max intervals',   when: 'post session',  benefit: 'longevity + nutrient partition' },
    'loaded-stretch':     { icon:'🧘', name:'Loaded stretching',   when: 'post session',  benefit: 'hypertrophy at long length' },
    'bfr':                { icon:'🩸', name:'BFR training',        when: 'session end',   benefit: 'growth signal, zero CNS cost' },
    'sauna':              { icon:'🔥', name:'Sauna protocol',      when: 'evening',       benefit: 'GH pulse + cardiovascular' },
    'contrast':           { icon:'🧊', name:'Contrast cycling',    when: 'evening',       benefit: 'NE +300% + inflammation clear' },
    'nsdr':               { icon:'🌊', name:'NSDR',                when: 'afternoon',     benefit: 'dopamine +65% + cortisol reset' },
    'sleep-extension':    { icon:'😴', name:'Sleep extension',     when: 'tonight',       benefit: 'GH + testosterone preservation' },
    'morning-protocol':   { icon:'☀️', name:'Morning protocol',    when: 'on wake',       benefit: 'circadian + cortisol timing' },
    'neat':               { icon:'📈', name:'NEAT steps',          when: 'all day',       benefit: '100–150 kcal without hunger' },
    'training-log':       { icon:'📓', name:'Training log',        when: 'every set',     benefit: 'progressive overload tracking' },
    'dopamine-scheduling':{ icon:'🧠', name:'Dopamine scheduling', when: 'pre-session',   benefit: 'training quality + motivation' },
    'implementation-intent': { icon:'🎯', name:'Pre-commitment',   when: 'before session', benefit: '2× follow-through rate' },
    'body-composition-check': { icon:'📊', name:'Weekly check-in', when: 'Mondays',       benefit: 'recomp signal tracking' },
  };

  ids.forEach(function(id) {
    var meta = ACC_SUMMARY[id];
    if (meta) activeList.push(meta);
  });

  if (activeList.length >= 1) {
    // Build compounding benefit note
    var compoundNote = '';
    if (activeList.length >= 3) {
      compoundNote = 'These ' + activeList.length + ' accelerators compound each other today — each one stacks with the others to amplify the recomposition signal.';
    } else if (activeList.length === 2) {
      compoundNote = 'Both accelerators are active today and reinforce each other.';
    }

    var accBlock = {
      time: fmt(wMins + 1), type: 'accelerator', tag: 'ACTIVE', tagColor: 'jade',
      durationMins: 0,
      title: activeList.length + ' accelerator' + (activeList.length > 1 ? 's' : '') + ' running today',
      subtitle: activeList.map(function(a){ return a.icon + ' ' + a.name; }).join(' · '),
      coachNote: compoundNote,
      isAcceleratorSummary: true,
      accList: activeList
    };
    blocks.unshift(accBlock);
  }

  // Now inject optNotes into coachNote for rendering
  blocks.forEach(function(b) {
    if (b.optNotes && b.optNotes.length) {
      b.optBadge = b.optNotes; // stored separately for rendering
    }
  });

  // ── DAILY OVERLAYS (micro-protocols from p.overlays) ─────────────────
  // These are persistent protocols the coach or user has added:
  // glute activations, mobility work, desk exercises, morning habits etc.
  var activeOverlays = (p.overlays || []).filter(function(o){ return o.active !== false; });
  activeOverlays.forEach(function(overlay) {
    // Build the items list HTML
    var items = overlay.items || [];
    var itemsHtml = items.length
      ? items.map(function(it){ return it; }).join(' · ')
      : (overlay.detail || overlay.name);

    var block = {
      type: 'recovery',
      tag: 'Daily',
      tagColor: 'jade',
      durationMins: overlay.durationMins || (overlay.duration ? parseInt(overlay.duration) : 5),
      title: overlay.name,
      subtitle: (overlay.trigger === 'rest-days' ? 'Rest days' :
                 overlay.trigger === 'pre-training' ? 'Before your session' :
                 overlay.trigger === 'morning' ? 'Every morning' : 'Every day')
               + (overlay.duration ? ' · ' + overlay.duration : ''),
      detail: itemsHtml,
      coachNote: overlay.reason || ('Added ' + (overlay.addedBy === 'coach' ? 'by your coach' : 'to your programme') + (overlay.date ? ' on ' + overlay.date : '')),
      science: overlay.science || '',
      isOverlay: true,
      overlayId: overlay.id,
    };

    // Insert based on trigger type
    if (overlay.trigger === 'pre-training' && t.isTraining) {
      insertBlockBeforeType('training', block);
    } else if (overlay.trigger === 'rest-days' && !t.isTraining) {
      // On rest days, insert after the wake block
      insertBlockAfterType('wake', block);
    } else if (overlay.trigger === 'morning') {
      insertBlockAfterType('wake', block);
    } else {
      // 'daily' — insert after wake on rest days, before training on training days
      if (t.isTraining) {
        insertBlockBeforeType('training', block);
      } else {
        insertBlockAfterType('wake', block);
      }
    }
  });
}
// ── CONTRADICTION DETECTION PRE-PASS ────────────────────────────────────────
// Pure JS — no API call. Runs before generateCoachNarrative.
// Detects tensions in the profile and recent log data.
// Stores result as window._tensionFlags for the coach narrative to use.
// Cost: $0.00 — enriches the existing coaching API call only.

function detectTensions(p, today) {
  var flags = [];
  var warnings = [];

  if (!p) return { flags: flags, warnings: warnings, hasTension: false };

  try {
    // ── 1. Caloric deficit + high training volume ─────────────────────────
    var calories = p.calories || p.trainingKcal || 0;
    var tdee = p.tdee || 0;
    var deficit = tdee > 0 ? tdee - calories : 0;
    var trainingDays = p.trainingDays || 4;

    if (deficit > 400 && trainingDays >= 5) {
      flags.push('high-deficit-high-volume');
      warnings.push('Large deficit (' + deficit + ' kcal) with ' + trainingDays + ' training days/week — muscle loss risk elevated. Prioritise protein and consider rest day calorie increase.');
    }

    // ── 2. Sleep deprivation ───────────────────────────────────────────────
    var avgSleep = 0;
    var sleepCount = 0;
    try {
      for (var d = 1; d <= 7; d++) {
        var date = new Date(); date.setDate(date.getDate() - d);
        var log = JSON.parse(localStorage.getItem('bl_daylog_' + date.toISOString().slice(0,10)) || 'null');
        if (log && log.sleepActual) { avgSleep += log.sleepActual; sleepCount++; }
      }
    } catch(e) {}
    var effectiveSleep = sleepCount >= 3 ? avgSleep / sleepCount : (p.sleepHours || 7);

    if (effectiveSleep < 6.5) {
      flags.push('sleep-deprived');
      warnings.push('Average sleep ' + (sleepCount >= 3 ? Math.round(effectiveSleep * 10)/10 + 'h (7-day avg)' : effectiveSleep + 'h (reported)') + ' — below recovery threshold. GH pulse suppressed, cortisol elevated. Heavy loading not advised today.');
    } else if (effectiveSleep < 7.0 && trainingDays >= 4) {
      flags.push('sleep-borderline');
      warnings.push('Sleep averaging ' + Math.round(effectiveSleep * 10)/10 + 'h with ' + trainingDays + ' training days — borderline recovery. Watch RPE and skip optional volume if fatigue high.');
    }

    // ── 3. The full triad: deficit + high volume + poor sleep ─────────────
    if (deficit > 300 && trainingDays >= 4 && effectiveSleep < 7.0) {
      if (!flags.includes('triad')) {
        flags.push('triad');
        warnings.push('TRIAD DETECTED: Caloric deficit + ' + trainingDays + ' training days + ' + Math.round(effectiveSleep * 10)/10 + 'h sleep. This combination suppresses testosterone, elevates cortisol, and risks muscle loss. Reduce training intensity or increase calories on training days.');
      }
    }

    // ── 4. High stress signal from logs ───────────────────────────────────
    var avgEnergy = 0;
    var energyCount = 0;
    try {
      for (var d2 = 1; d2 <= 5; d2++) {
        var date2 = new Date(); date2.setDate(date2.getDate() - d2);
        var log2 = JSON.parse(localStorage.getItem('bl_daylog_' + date2.toISOString().slice(0,10)) || 'null');
        if (log2 && log2.energy) { avgEnergy += log2.energy; energyCount++; }
      }
    } catch(e) {}

    if (energyCount >= 3 && (avgEnergy / energyCount) < 2.5) {
      flags.push('low-energy-trend');
      warnings.push('5-day energy average: ' + Math.round(avgEnergy / energyCount * 10)/10 + '/5 — consistently low. Check sleep quality, caloric intake, and stress levels. Consider reducing session intensity today.');
    }

    // ── 5. Protein significantly below target ─────────────────────────────
    var protTarget = p.protein || 174;
    var protMissedDays = 0;
    try {
      for (var d3 = 1; d3 <= 5; d3++) {
        var date3 = new Date(); date3.setDate(date3.getDate() - d3);
        var log3 = JSON.parse(localStorage.getItem('bl_daylog_' + date3.toISOString().slice(0,10)) || 'null');
        if (log3 && log3.actual && log3.actual.prot > 0 && log3.actual.prot < protTarget * 0.75) protMissedDays++;
      }
    } catch(e) {}

    if (protMissedDays >= 3 && deficit > 200) {
      flags.push('protein-deficit-combined');
      warnings.push('Protein missed by >25% for ' + protMissedDays + ' of last 5 days while in caloric deficit — acute muscle loss risk. First priority today: hit ' + protTarget + 'g protein before any other nutrition goal.');
    }

    // ── 6. Overreaching signal: high volume + missed sessions pattern ──────
    var sessionsMissed = 0;
    try {
      for (var d4 = 1; d4 <= 7; d4++) {
        var date4 = new Date(); date4.setDate(date4.getDate() - d4);
        var log4 = JSON.parse(localStorage.getItem('bl_daylog_' + date4.toISOString().slice(0,10)) || 'null');
        if (log4 && log4.planType && log4.planType.toLowerCase().includes('train') && log4.trainStatus === 'skipped') sessionsMissed++;
      }
    } catch(e) {}

    if (sessionsMissed >= 2 && trainingDays >= 4) {
      flags.push('overreach-signal');
      warnings.push('Missed ' + sessionsMissed + ' of last 7 planned sessions — possible overreaching or schedule mismatch. Consider whether ' + trainingDays + ' training days/week is sustainable right now.');
    }

  } catch(e) {}

  return {
    flags: flags,
    warnings: warnings,
    hasTension: flags.length > 0,
    // Formatted string for prompt injection
    promptText: flags.length > 0
      ? 'TENSION FLAGS — address these in your response if relevant:\n' + warnings.map(function(w){ return '- ' + w; }).join('\n')
      : ''
  };
}

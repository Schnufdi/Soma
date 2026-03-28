// BodyLens — Risk Classifier
// Reads profile.healthConditions + profile.injuries, returns a riskProfile object.
// Called by coach.js before building the system prompt.
// No DOM access. No AI calls. Pure detection.

var BL_RISK = (function() {

  // ── Taxonomy ────────────────────────────────────────────────────────────────
  // Each entry: { category, severity, keywords[], what_not_to_do, language_guidance, redirect }
  var RISK_TAXONOMY = [
    {
      category:   'cardiovascular',
      label:      'Cardiovascular condition',
      severity:   'high',
      keywords:   [
        'hypertension', 'high blood pressure', 'hbp', 'heart disease', 'heart failure',
        'arrhythmia', 'atrial fibrillation', 'afib', 'angina', 'heart attack',
        'myocardial', 'cardiac', 'pacemaker', 'coronary', 'stroke', 'tia',
        'chest pain', 'palpitations', 'cardiomyopathy', 'valve',
      ],
      not_to_do: [
        'prescribe target heart rate zones without GP clearance',
        'recommend maximum intensity or 1RM testing',
        'suggest aggressive caloric deficits that stress cardiac load',
        'recommend pre-workout stimulants or high-caffeine stacks',
        'advise on Valsalva manoeuvre during heavy lifts',
      ],
      guidance: 'Recommend low-to-moderate intensity as a starting point. Explicitly defer on intensity prescription — state clearly that intensity thresholds should be set in consultation with their doctor or cardiologist. Frame training as beneficial but note GP clearance is appropriate before increasing intensity significantly.',
      redirect:  'Always include a clear recommendation to discuss exercise intensity with their GP or cardiologist.',
    },
    {
      category:   'disordered_eating',
      label:      'Disordered eating history',
      severity:   'high',
      keywords:   [
        'eating disorder', 'anorexia', 'bulimia', 'binge eating', 'binge-purge',
        'orthorexia', 'restriction', 'restrictive eating', 'purging', 'laxative',
        'disordered eating', 'ed history', 'ed recovery', 'arfid',
        'fear of food', 'food anxiety', 'body dysmorphia', 'dysmorphic',
      ],
      not_to_do: [
        'prescribe caloric deficits or cutting phases',
        'suggest intermittent fasting or extended fasting windows',
        'discuss weight loss as a metric of success',
        'comment on body composition percentages in a goal-framing way',
        'recommend calorie counting apps or daily tracking if it feels compulsive',
        'frame food as reward or punishment',
      ],
      guidance: 'Focus entirely on adequacy, nourishment, and performance — not restriction. Do not mention deficits, cutting, or weight targets. If the conversation involves calories, frame them as fuel requirements, not a ceiling to stay under. If directly asked about restriction or aggressive deficits, decline to prescribe them and explain that a registered dietitian with experience in disordered eating is the appropriate professional.',
      redirect: 'If the question involves restriction, deficits, or weight-loss framing, recommend a registered dietitian who specialises in disordered eating.',
    },
    {
      category:   'spinal',
      label:      'Spinal / disc condition',
      severity:   'high',
      keywords:   [
        'herniated disc', 'herniation', 'slipped disc', 'disc bulge', 'disc prolapse',
        'spinal stenosis', 'spondylosis', 'spondylolisthesis', 'sciatica',
        'nerve root', 'radiculopathy', 'degenerative disc', 'ddd',
        'spinal fusion', 'laminectomy', 'discectomy', 'vertebral fracture',
      ],
      not_to_do: [
        'prescribe loading progressions for spinal-loading movements (deadlifts, Romanian deadlifts, good mornings, bent-over rows)',
        'recommend heavy barbell back squats without modification',
        'suggest plyometrics or high-impact loading',
        'give specific weight or RPE targets for spinal-loading movements',
      ],
      guidance: 'Acknowledge the condition directly. For any spinal-loading movement, decline to give loading prescriptions and instead recommend they work with a physiotherapist to establish safe loading parameters. Suggest spine-sparing alternatives (trap bar deadlifts, leg press, cable rows) but note that even these should be cleared by their physio first. You can discuss form principles generally but not load prescription.',
      redirect: 'For loading questions involving the spine, recommend a physiotherapist for individualised assessment.',
    },
    {
      category:   'lower_back_pain',
      label:      'Lower back pain',
      severity:   'medium',
      keywords:   [
        'lower back pain', 'low back pain', 'lbp', 'chronic back pain', 'back injury',
        'back problems', 'bad back', 'lumbar pain', 'lumbar injury', 'sacral',
        'si joint', 'sacroiliac',
      ],
      not_to_do: [
        'prescribe specific loading percentages for deadlifts, squats, or bent rows',
        'recommend pushing through pain in these movements',
        'suggest volume increases for posterior chain work without flagging the risk',
      ],
      guidance: 'Modify rather than avoid — discuss movement pattern principles (hip hinge mechanics, bracing, neutral spine) but explicitly decline to prescribe loads. Recommend building a baseline with a physiotherapist before progressive loading. Trap bar deadlifts, hip thrusts, and cable work are lower-risk alternatives worth mentioning.',
      redirect: 'For load prescription with lower back pain, recommend physiotherapy assessment first.',
    },
    {
      category:   'joint_replacement',
      label:      'Joint replacement',
      severity:   'high',
      keywords:   [
        'hip replacement', 'knee replacement', 'joint replacement', 'arthroplasty',
        'total hip', 'total knee', 'thr', 'tkr', 'prosthetic joint',
      ],
      not_to_do: [
        'recommend deep squats, lunges past 90 degrees, or high-impact loading without clearance',
        'prescribe loading progressions without noting the prosthetic constraint',
        'suggest returning to heavy compound lifts without physiotherapy clearance',
      ],
      guidance: 'Be explicit that exercise post-replacement should follow the guidance of their orthopaedic surgeon and physiotherapist. You can discuss general principles but not load or range-of-motion targets.',
      redirect: 'Recommend orthopaedic/physiotherapy clearance for any loading prescription.',
    },
    {
      category:   'pregnancy',
      label:      'Pregnancy / postnatal',
      severity:   'critical',
      keywords:   [
        'pregnant', 'pregnancy', 'expecting', 'trimester', 'postnatal', 'postpartum',
        'post-partum', 'after birth', 'after baby', 'breastfeeding', 'nursing',
        'diastasis', 'diastasis recti',
      ],
      not_to_do: [
        'prescribe standard training programmes without perinatal modification',
        'recommend caloric deficits during pregnancy or early postpartum',
        'suggest high-intensity or supine work in later pregnancy',
        'give standard macro targets without noting increased requirements',
      ],
      guidance: 'This context requires specialist perinatal guidance. You can offer general supportive information but must defer all specific programme and nutrition prescription to a midwife, OB-GYN, or perinatal fitness specialist.',
      redirect: 'Redirect to a midwife, OB-GYN, or perinatal fitness specialist for all programme and nutrition decisions.',
    },
    {
      category:   'type1_diabetes',
      label:      'Type 1 diabetes / insulin dependence',
      severity:   'high',
      keywords:   [
        'type 1 diabetes', 'type 1', 't1d', 'insulin dependent', 'insulin pump',
        'insulin injections', 'juvenile diabetes', 'lada',
      ],
      not_to_do: [
        'recommend extended fasting windows or intermittent fasting without flagging glucose risk',
        'prescribe very low carbohydrate diets without flagging hypoglycaemia risk',
        'suggest pre-workout stimulants that affect glucose',
        'ignore the interaction between training timing and insulin dosing',
      ],
      guidance: 'Flag glucose management explicitly in any conversation about fasting, low-carb eating, or training timing. Do not prescribe fasting windows or aggressive carb restriction. Note that training timing and intensity interact with insulin requirements and this must be managed with their endocrinologist or diabetes care team.',
      redirect: 'Any fasting, carb restriction, or training-timing questions should reference their diabetes care team.',
    },
    {
      category:   'type2_diabetes',
      label:      'Type 2 diabetes',
      severity:   'medium',
      keywords:   [
        'type 2 diabetes', 'type 2', 't2d', 'type ii diabetes', 'diabetes mellitus',
        'diabetic', 'prediabetes', 'pre-diabetes', 'insulin resistance', 'metformin',
      ],
      not_to_do: [
        'prescribe aggressive caloric deficits without noting medical monitoring',
        'recommend high-sugar foods around training without context',
      ],
      guidance: 'Note that any significant dietary changes, particularly around carbohydrate intake or caloric restriction, should be discussed with their GP or diabetes nurse. Exercise is highly beneficial but intensity and nutrition changes warrant medical monitoring.',
      redirect: 'Recommend discussing significant dietary or training changes with their GP or diabetes care team.',
    },
    {
      category:   'hypertension_controlled',
      label:      'Controlled hypertension (medication)',
      severity:   'medium',
      keywords:   [
        'blood pressure medication', 'antihypertensive', 'beta blocker', 'ace inhibitor',
        'calcium channel blocker', 'amlodipine', 'lisinopril', 'ramipril',
        'controlled hypertension', 'managed blood pressure',
      ],
      not_to_do: [
        'recommend Valsalva manoeuvre for heavy lifts',
        'suggest pre-workout stimulants without noting BP interaction',
        'prescribe maximum intensity without noting beta blocker effect on heart rate',
      ],
      guidance: 'Note that beta blockers blunt heart rate response, making heart rate-based intensity zones unreliable — use RPE instead. Stimulant pre-workouts interact with blood pressure medication. Valsalva breathing during heavy lifts causes acute BP spikes; recommend controlled breathing patterns instead.',
      redirect: null,
    },
    {
      category:   'osteoporosis',
      label:      'Osteoporosis / osteopenia',
      severity:   'medium',
      keywords:   [
        'osteoporosis', 'osteopenia', 'low bone density', 'bone density', 'fracture risk',
        'stress fracture', 'dexa scan low', 't-score',
      ],
      not_to_do: [
        'recommend high-impact activities without noting fracture risk',
        'suggest very low caloric intake that compromises bone nutrition',
        'ignore the importance of resistance training for bone density',
      ],
      guidance: 'Resistance training is actively beneficial for bone density. Note the importance of calcium, vitamin D, and adequate protein. Avoid recommending very aggressive caloric deficits. For high-impact activities, note fracture risk and recommend gradual progression.',
      redirect: null,
    },
  ];

  // ── Classifier ──────────────────────────────────────────────────────────────
  function classify(profile) {
    var flags = [];
    var text = [
      (profile.healthConditions || ''),
      (profile.injuryDetail || ''),
      ((profile.injuries || []).join(' ')),
      ((profile.injuryAssessments || []).map(function(i) {
        return (i.location || i) + ' ' + (i.assessment || i.detail || '');
      }).join(' ')),
    ].join(' ').toLowerCase();

    if (!text.trim()) return { flags: [], severity: 'none', hasFlags: false };

    RISK_TAXONOMY.forEach(function(rule) {
      var matched = rule.keywords.some(function(kw) {
        return text.indexOf(kw) !== -1;
      });
      if (matched) flags.push(rule);
    });

    // Deduplicate: if 'spinal' fires, 'lower_back_pain' is redundant
    if (flags.some(function(f) { return f.category === 'spinal'; })) {
      flags = flags.filter(function(f) { return f.category !== 'lower_back_pain'; });
    }
    // If cardiovascular fires, hypertension_controlled is redundant
    if (flags.some(function(f) { return f.category === 'cardiovascular'; })) {
      flags = flags.filter(function(f) { return f.category !== 'hypertension_controlled'; });
    }

    var severityOrder = { critical: 4, high: 3, medium: 2, low: 1, none: 0 };
    var topSeverity = flags.reduce(function(max, f) {
      return severityOrder[f.severity] > severityOrder[max] ? f.severity : max;
    }, 'none');

    return {
      flags:     flags,
      severity:  topSeverity,
      hasFlags:  flags.length > 0,
      labels:    flags.map(function(f) { return f.label; }),
      categories: flags.map(function(f) { return f.category; }),
    };
  }

  // ── Prompt injection ────────────────────────────────────────────────────────
  // Call this from buildSystemPrompt — it returns a block to prepend to instructions.
  function buildRiskBlock(profile) {
    var riskProfile = classify(profile);
    if (!riskProfile.hasFlags) return '';

    var lines = [
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
      'RISK FLAGS — MANDATORY CONSTRAINTS:',
      'The following conditions have been detected in this user\'s profile.',
      'These constraints override your default coaching posture for affected topics.',
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
      '',
    ];

    riskProfile.flags.forEach(function(flag) {
      lines.push('CONDITION: ' + flag.label + ' [severity: ' + flag.severity + ']');
      lines.push('');
      lines.push('DO NOT:');
      flag.not_to_do.forEach(function(item) { lines.push('  — ' + item); });
      lines.push('');
      lines.push('REQUIRED APPROACH: ' + flag.guidance);
      if (flag.redirect) {
        lines.push('REDIRECT REQUIRED: ' + flag.redirect);
      }
      lines.push('');
    });

    lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    lines.push('When risk flags are active: be genuinely useful, not paralysed.');
    lines.push('You can discuss principles, alternatives, and context freely.');
    lines.push('What you must not do is prescribe specific loads, intensities,');
    lines.push('or protocols in areas where the flag explicitly constrains you.');
    lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    lines.push('');

    return lines.join('\n');
  }

  // ── Onboarding advisory ─────────────────────────────────────────────────────
  // Call before programme generation if flags exist. Returns HTML string or ''.
  function buildOnboardingAdvisory(profile) {
    var riskProfile = classify(profile);
    if (!riskProfile.hasFlags) return '';

    var isCritical = riskProfile.severity === 'critical';
    var isHigh     = riskProfile.severity === 'high';

    var html = '<div style="margin:20px 0;padding:16px 18px;background:rgba(196,124,24,.08);border:1px solid rgba(196,124,24,.25);border-radius:10px;">';
    html += '<div style="font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--amber,#c47c18);margin-bottom:8px;">Before we begin</div>';
    html += '<div style="font-size:13px;font-weight:300;color:var(--dk-1,#e8e3da);line-height:1.6;">';

    if (isCritical) {
      html += 'Your profile includes a condition that requires specialist guidance before starting a new programme. BodyLens will support your training and nutrition, but the specific details of your programme should be reviewed with your relevant healthcare professional before you begin.';
    } else {
      html += 'Your profile includes ' + (riskProfile.flags.length === 1 ? 'a condition' : 'conditions') + ' — ' + riskProfile.labels.join(', ') + ' — that BodyLens will factor into your coaching. The AI coach will modify its guidance in these areas and tell you when to consult a specialist rather than following a generic prescription.';
    }

    html += '</div>';

    var redirects = riskProfile.flags.filter(function(f) { return f.redirect; });
    if (redirects.length) {
      html += '<div style="margin-top:10px;font-size:12px;font-weight:300;color:var(--dk-2,#8a9490);line-height:1.55;">';
      redirects.forEach(function(f) {
        html += '<div style="margin-top:4px;">• ' + f.redirect + '</div>';
      });
      html += '</div>';
    }

    html += '<div style="margin-top:10px;font-size:11px;color:var(--dk-3,#3e504a);">BodyLens is not a medical service. This advisory is generated from your profile — not a clinical assessment.</div>';
    html += '</div>';

    return html;
  }

  return {
    classify:               classify,
    buildRiskBlock:         buildRiskBlock,
    buildOnboardingAdvisory: buildOnboardingAdvisory,
  };

})();

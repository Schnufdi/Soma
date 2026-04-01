// ════════════════════════════════════════════════════════
//  BodyLens Glossary  v1
//  Auto-detects fitness/nutrition abbreviations across all
//  pages and shows inline tooltip explanations.
//  Injected via nav.js — no per-page changes needed.
// ════════════════════════════════════════════════════════

(function() {
  'use strict';

  // ── DICTIONARY ──────────────────────────────────────────
  // Key = uppercase abbreviation as it appears in text
  // Val = concise plain-English explanation
  var GL = {
    // Training intensity & structure
    'RPE':    'Rate of Perceived Exertion — a 1–10 scale of how hard a set feels (10 = absolute max effort)',
    'RIR':    'Reps in Reserve — how many more reps you could have done; RIR 2 means you stopped 2 reps short of failure',
    'RM':     'Repetition Maximum — e.g. 1RM is the heaviest single rep you can lift; 5RM is the max for 5 reps',
    '1RM':    'One-Rep Max — the heaviest weight you can lift for exactly one full rep',
    'AMRAP':  'As Many Reps (or Rounds) As Possible — complete as many reps/rounds as you can in the given time or until failure',
    'EMOM':   'Every Minute On the Minute — perform the prescribed reps at the start of each minute, rest for what remains',
    'EMOC':   'Every Minute On the Clock — same as EMOM; a set starts at the top of each minute on the clock',
    'HIIT':   'High-Intensity Interval Training — alternating short bursts of maximum effort with brief rest periods',
    'LISS':   'Low-Intensity Steady State — sustained cardio at a steady, conversational pace (e.g. 45-min brisk walk)',
    'MRT':    'Metabolic Resistance Training — resistance exercises performed in circuits with minimal rest to elevate heart rate and calorie burn',
    'TABATA': 'Tabata — a specific HIIT protocol: 20 s work / 10 s rest × 8 rounds (4 min total) per exercise',
    'WOD':    'Workout Of the Day — the daily prescribed training session',

    // Cardio & zones
    'HR':     'Heart Rate — measured in beats per minute (bpm)',
    'MHR':    'Maximum Heart Rate — estimated peak heart rate; roughly 220 minus your age',
    'HRR':    'Heart Rate Reserve — the range between resting HR and max HR; used to set training zones',
    'HRV':    'Heart Rate Variability — the variation in time between heartbeats; higher HRV generally indicates better recovery and autonomic health',
    'VO2MAX': 'VO₂ Max — the maximum rate at which your body can consume oxygen during intense exercise; a key marker of aerobic fitness',
    'VO2':    'Oxygen Uptake — the volume of oxygen used by muscles; VO₂ max is the upper limit',
    'LT':     'Lactate Threshold — the exercise intensity at which lactic acid builds up faster than it can be cleared; training at this level improves endurance',
    'LT1':    'First Lactate Threshold — the point where blood lactate begins to rise above resting levels; corresponds to a comfortable aerobic pace',
    'LT2':    'Second Lactate Threshold (Anaerobic Threshold) — the point where lactate accumulates rapidly; roughly your 1-hour race pace',
    'AT':     'Anaerobic Threshold — exercise intensity above which lactate accumulates; essentially the same as LT2',
    'Z1':     'Zone 1 — very light intensity (50–60% MHR); active recovery and warm-up',
    'Z2':     'Zone 2 — light aerobic intensity (60–70% MHR); conversational pace; builds aerobic base and fat oxidation',
    'Z3':     'Zone 3 — moderate intensity (70–80% MHR); sustained effort; improves aerobic capacity',
    'Z4':     'Zone 4 — hard intensity (80–90% MHR); near or at lactate threshold; improves threshold power',
    'Z5':     'Zone 5 — maximum intensity (90–100% MHR); short intervals; develops peak speed and anaerobic capacity',

    // Physiology & neurology
    'CNS':    'Central Nervous System — the brain and spinal cord; heavy compound lifting causes significant CNS fatigue that needs longer recovery than muscle soreness alone',
    'PNS':    'Peripheral Nervous System — the nerves outside the brain/spinal cord that control muscles directly',
    'ATP':    'Adenosine Triphosphate — the primary energy currency of cells; muscles use ATP to contract',
    'PCr':    'Phosphocreatine — a high-energy compound stored in muscle used to rapidly regenerate ATP during short, intense efforts',
    'GH':     'Growth Hormone — a hormone that stimulates muscle repair and fat metabolism; peaks during deep sleep',
    'IGF-1':  'Insulin-like Growth Factor 1 — a hormone that mediates many effects of GH; promotes muscle protein synthesis and cell growth',
    'SHBG':   'Sex Hormone-Binding Globulin — a protein that binds testosterone in the blood, making it inactive; lower SHBG means more free testosterone available to muscles',
    'DOMS':   'Delayed-Onset Muscle Soreness — the muscle pain and stiffness that peaks 24–72 hours after novel or intense exercise',
    'SRA':    'Stimulus–Recovery–Adaptation — the training cycle: apply stress, recover, come back stronger',
    'RFD':    'Rate of Force Development — how quickly a muscle can generate force; important for explosive sports and power training',

    // Metabolism & energy
    'BMR':    'Basal Metabolic Rate — calories your body burns at complete rest just to maintain vital functions (breathing, organ function)',
    'TDEE':   'Total Daily Energy Expenditure — total calories burned in a day, including BMR plus all physical activity',
    'NEAT':   'Non-Exercise Activity Thermogenesis — calories burned through all movement that isn't formal exercise (fidgeting, walking, standing)',
    'TEF':    'Thermic Effect of Food — the calorie cost of digesting and absorbing what you eat; roughly 20–30% for protein, 5–10% for carbs, 0–3% for fat',
    'EAT':    'Exercise Activity Thermogenesis — calories burned specifically during structured workouts',
    'RMR':    'Resting Metabolic Rate — similar to BMR; calories burned at rest, measured under less strict conditions than BMR',
    'REE':    'Resting Energy Expenditure — interchangeable with RMR in most practical contexts',

    // Muscle growth & protein
    'MPS':    'Muscle Protein Synthesis — the cellular process of building new muscle protein; elevated after training and protein intake',
    'MPB':    'Muscle Protein Breakdown — the degradation of muscle protein; net muscle growth happens when MPS exceeds MPB',
    'mTOR':   'Mechanistic Target of Rapamycin — a key intracellular signalling pathway that drives muscle protein synthesis in response to resistance training and leucine',
    'MTOR':   'Mechanistic Target of Rapamycin — a key intracellular signalling pathway that drives muscle protein synthesis in response to resistance training and leucine',
    'EAA':    'Essential Amino Acids — the 9 amino acids your body cannot produce; must come from food; all 9 are needed for MPS',
    'BCAA':   'Branched-Chain Amino Acids — leucine, isoleucine, and valine; leucine is the primary trigger for MPS',
    'LEUCINE':'Leucine — the most anabolic essential amino acid; ~2–3 g per meal is the threshold to maximally stimulate MPS',
    'EBP':    'Energy Balance Point — the calorie intake at which body weight is stable (neither gaining nor losing)',

    // Nutrition
    'IF':     'Intermittent Fasting — cycling between defined eating windows and fasting periods (e.g. 16:8 = 16 h fast, 8 h eating window)',
    'TRE':    'Time-Restricted Eating — eating only within a set daily window; a form of intermittent fasting',
    'IIFYM':  'If It Fits Your Macros — a flexible diet approach where any food is acceptable as long as daily protein, carb, and fat targets are met',
    'GI':     'Glycaemic Index — a ranking (0–100) of how quickly a carbohydrate food raises blood glucose; lower GI = slower, steadier rise',
    'GL':     'Glycaemic Load — GI adjusted for portion size; a more practical measure of a food\'s impact on blood sugar',
    'IG':     'Insulin-like Growth — sometimes used loosely; see IGF-1 for the specific hormone',
    'CHO':    'Carbohydrates — standard scientific shorthand for dietary carbohydrates',
    'PRO':    'Protein — in nutrition shorthand, the macronutrient measured in grams per day',
    'SFA':    'Saturated Fatty Acids — dietary fats from animal products and tropical oils; solid at room temperature',
    'MUFA':   'Monounsaturated Fatty Acids — heart-healthy fats found in olive oil, avocados, and nuts',
    'PUFA':   'Polyunsaturated Fatty Acids — include omega-3 and omega-6 fats; found in oily fish, seeds, and vegetable oils',
    'DHA':    'Docosahexaenoic Acid — an omega-3 fatty acid critical for brain function and inflammation control; found in oily fish',
    'EPA':    'Eicosapentaenoic Acid — an omega-3 fatty acid with potent anti-inflammatory effects; found in oily fish alongside DHA',
    'ALA':    'Alpha-Linolenic Acid — a plant-based omega-3 (flaxseed, walnuts); converted to EPA/DHA at low efficiency',

    // Supplements
    'HMB':    'Beta-Hydroxy Beta-Methylbutyrate — a leucine metabolite; may reduce muscle breakdown during calorie deficits',
    'ZMA':    'Zinc, Magnesium, and Vitamin B6 — a supplement combo marketed to support testosterone and sleep quality',
    'NAC':    'N-Acetyl Cysteine — an antioxidant that supports glutathione production; sometimes used to reduce oxidative stress from heavy training',
    'NMN':    'Nicotinamide Mononucleotide — a precursor to NAD+; researched for cellular energy and longevity',
    'NR':     'Nicotinamide Riboside — another NAD+ precursor; similar to NMN in proposed benefits',
    'NAD':    'Nicotinamide Adenine Dinucleotide — a coenzyme central to cellular energy metabolism; declines with age',
    'COQ10':  'Coenzyme Q10 — an antioxidant involved in mitochondrial energy production; may support exercise performance and recovery',
    'PEA':    'Phenylethylamine — a stimulant compound; also used as shorthand for phosphatidylethanolamine in some contexts',
    'KSM':    'KSM-66 Ashwagandha — a patented, highly-concentrated root extract standardised for withanolides; studied for cortisol reduction and strength',
    'AKG':    'Alpha-Ketoglutarate — a key intermediate in the Krebs cycle; calcium AKG is researched as an anti-ageing supplement',

    // Biomechanics & exercise
    'ROM':    'Range of Motion — the full movement potential of a joint; training through full ROM maximises muscle development',
    'TUT':    'Time Under Tension — the total duration a muscle is under load during a set; longer TUT can increase hypertrophic stimulus',
    'CON':    'Concentric — the shortening phase of a muscle contraction; e.g. lifting the bar up in a curl',
    'ECC':    'Eccentric — the lengthening phase; e.g. lowering the bar in a curl; high mechanical tension here drives much of hypertrophy',
    'ISO':    'Isometric — a contraction with no joint movement; the muscle produces force while staying the same length',
    'RDL':    'Romanian Deadlift — a hip-hinge deadlift variation keeping the bar close to the body with a slight knee bend; targets hamstrings and glutes',
    'SLDL':   'Stiff-Leg Deadlift — similar to RDL but with straighter knees; greater hamstring stretch at the bottom',
    'SLD':    'Stiff-Leg Deadlift — see SLDL',
    'RFESS':  'Rear-Foot Elevated Split Squat (Bulgarian Split Squat) — single-leg squat with the rear foot elevated; high glute and quad activation',
    'BSS':    'Bulgarian Split Squat — see RFESS',
    'DB':     'Dumbbell — a free weight held in one hand',
    'BB':     'Barbell — a long bar loaded with weight plates; used for compound lifts',
    'KB':     'Kettlebell — a cast-iron weight with a handle; used for swings, carries, and ballistic movements',
    'BW':     'Bodyweight — using your own body mass as the resistance (e.g. push-ups, pull-ups)',
    'SM':     'Smith Machine — a barbell fixed to a guided vertical track; reduces stabiliser demand',
    'GHR':    'Glute-Ham Raise — an exercise targeting the hamstrings eccentrically and gluteus maximus; performed on a GHR bench',
    'GHD':    'Glute-Ham Developer — the machine/apparatus used for GHR exercises',
    'SSB':    'Safety Squat Bar — a cambered barbell with handles that sits higher on the traps, reducing shoulder stress during squats',
    'SB':     'Swiss Ball (Stability Ball) — an inflatable ball used to add instability to exercises',

    // Recovery & monitoring
    'HRR':    'Heart Rate Recovery — how quickly HR drops after stopping exercise; a good indicator of cardiovascular fitness',
    'RMSSD':  'Root Mean Square of Successive Differences — a statistical measure of HRV; higher values typically indicate better recovery',
    'SDNN':   'Standard Deviation of NN Intervals — another HRV metric; reflects overall autonomic nervous system activity',
    'SPO2':   'Blood Oxygen Saturation — the percentage of haemoglobin carrying oxygen; measured by pulse oximeter; normal is 95–100%',
    'RHR':    'Resting Heart Rate — your heart rate measured at complete rest; lower values (40–60 bpm) indicate better cardiovascular fitness',
    'SWS':    'Slow-Wave Sleep (Deep Sleep) — the most restorative sleep stage; critical for GH release and muscle repair',
    'REM':    'Rapid Eye Movement Sleep — the dream stage; important for memory consolidation and cognitive recovery',
    'TSB':    'Training Stress Balance — form minus fatigue; used in endurance sports to track readiness (positive = fresh, negative = fatigued)',
    'ATL':    'Acute Training Load — short-term fatigue from recent hard training',
    'CTL':    'Chronic Training Load — long-term fitness base built over weeks of consistent training',

    // Programme design
    'PPL':    'Push/Pull/Legs — a training split dividing sessions by movement pattern: push (chest/shoulders/triceps), pull (back/biceps), legs',
    'UL':     'Upper/Lower — a training split alternating upper-body and lower-body sessions',
    'FB':     'Full Body — a training approach where every session works the entire body',
    'DUP':    'Daily Undulating Periodisation — varying rep ranges and loads within the same week (e.g. heavy Mon, moderate Wed, high-rep Fri)',
    'LP':     'Linear Progression — adding weight to the bar every session; best for beginners',
    'UP':     'Undulating Periodisation — see DUP',
    'WUP':    'Weekly Undulating Periodisation — varying the stimulus week to week rather than daily',
    'MRV':    'Maximum Recoverable Volume — the highest training volume from which you can still recover before the next session',
    'MEV':    'Minimum Effective Volume — the least amount of training needed to maintain or make progress',
    'MAV':    'Maximum Adaptive Volume — the range between MEV and MRV where most hypertrophy gains occur',
    'MV':     'Maintenance Volume — the training volume needed to maintain current muscle mass',
    'SBD':    'Squat, Bench, Deadlift — the three powerlifting competition lifts',
    'OHP':    'Overhead Press — pressing a barbell or dumbbells from shoulder height to full arm extension overhead',
    'CGP':    'Close-Grip Press — a bench press variation with a narrow grip that shifts emphasis to triceps',
    'RG':     'Reverse Grip — using a supinated (palms-up) grip on pulling or pressing movements',
    'NG':     'Neutral Grip — palms facing each other; reduces shoulder stress in pressing movements',
    'PG':     'Pronated Grip — palms facing down or away; standard grip for rows and deadlifts',
    'SG':     'Supinated Grip — palms facing up; used in curls and underhand rows',

    // Body composition
    'BF':     'Body Fat — the percentage or total mass of fat in the body',
    'BFP':    'Body Fat Percentage — the proportion of total body weight that is fat mass',
    'FFM':    'Fat-Free Mass — everything in the body that isn\'t fat: muscle, bone, organs, water',
    'LBM':    'Lean Body Mass — essentially the same as FFM; total mass minus fat mass',
    'MM':     'Muscle Mass — the total weight of skeletal muscle in the body',
    'SMM':    'Skeletal Muscle Mass — the weight of all muscles attached to the skeleton; the type built through resistance training',
    'DEXA':   'Dual-Energy X-ray Absorptiometry — the gold-standard body composition scan measuring bone density, fat mass, and lean mass',
    'BIA':    'Bioelectrical Impedance Analysis — a method of estimating body composition by passing a small electrical current through the body',
    'ABSI':   'A Body Shape Index — a metric based on waist circumference, BMI, and height that correlates with metabolic disease risk',
    'WHR':    'Waist-to-Hip Ratio — waist circumference divided by hip circumference; a predictor of cardiovascular risk',
    'BMI':    'Body Mass Index — weight (kg) divided by height² (m²); a screening tool for weight categories, though it doesn\'t distinguish fat from muscle',

    // Misc health & science
    'IR':     'Insulin Resistance — a state where cells respond poorly to insulin; leads to elevated blood glucose and impaired nutrient partitioning',
    'IS':     'Insulin Sensitivity — the opposite of IR; how effectively cells respond to insulin; training and a calorie deficit improve IS',
    'CRP':    'C-Reactive Protein — a blood marker of systemic inflammation; elevated after intense training or poor recovery',
    'IL6':    'Interleukin-6 — a pro-inflammatory cytokine released by muscle during exercise; part of the training adaptation signal',
    'AMPK':   'AMP-Activated Protein Kinase — a cellular energy sensor activated by cardio exercise; promotes fat oxidation but can inhibit mTOR/MPS when both are stimulated simultaneously',
    'PGC1A':  'PGC-1α — a transcription factor that drives mitochondrial biogenesis; activated by endurance training',
    'FOX':    'FOXO — a family of transcription factors involved in autophagy, longevity, and cellular stress responses',
    'TRT':    'Testosterone Replacement Therapy — medically prescribed testosterone to restore levels to the normal physiological range',
    'SARMs':  'Selective Androgen Receptor Modulators — research compounds that bind to androgen receptors; unregulated and banned in sport',
    'WADA':   'World Anti-Doping Agency — the international body that maintains the prohibited substances list for sport',
    'RDA':    'Recommended Daily Allowance — the average daily intake sufficient for 97% of healthy individuals; often used for vitamins and minerals',
    'UL':     'Tolerable Upper Intake Level — the maximum daily intake of a nutrient unlikely to cause adverse effects',
    'DV':     'Daily Value — the reference amount used on nutrition labels, based on a 2,000 kcal diet',
    'IU':     'International Unit — a unit of biological activity used for vitamins A, D, and E; e.g. Vitamin D 1 IU ≈ 0.025 μg',
  };

  // ── CSS ─────────────────────────────────────────────────
  var CSS = [
    '.gl-term{',
    '  border-bottom:1px dotted rgba(0,200,160,.45);',
    '  cursor:help;',
    '  white-space:nowrap;',
    '  color:inherit;',
    '}',
    '#gl-tip{',
    '  position:fixed;',
    '  z-index:99999;',
    '  max-width:300px;',
    '  background:#192420;',
    '  border:1px solid rgba(0,200,160,.22);',
    '  border-radius:8px;',
    '  padding:9px 13px;',
    '  pointer-events:none;',
    '  box-shadow:0 8px 28px rgba(0,0,0,.55);',
    '  opacity:0;',
    '  transition:opacity .15s;',
    '  font-family:"Space Grotesk",sans-serif;',
    '  font-size:12px;',
    '  font-weight:300;',
    '  line-height:1.65;',
    '  color:rgba(232,227,218,.85);',
    '}',
    '#gl-tip.show{opacity:1;}',
    '#gl-tip strong{',
    '  display:block;',
    '  font-size:11px;',
    '  font-weight:700;',
    '  letter-spacing:.08em;',
    '  color:rgba(0,200,160,.9);',
    '  margin-bottom:4px;',
    '  text-transform:uppercase;',
    '}',
  ].join('');

  // ── INJECT STYLE + TOOLTIP ELEMENT ──────────────────────
  function _bootstrap() {
    if (document.getElementById('gl-styles')) return;
    var style = document.createElement('style');
    style.id = 'gl-styles';
    style.textContent = CSS;
    document.head.appendChild(style);

    var tip = document.createElement('div');
    tip.id = 'gl-tip';
    document.body.appendChild(tip);
  }

  // ── BUILD TERM REGEX ─────────────────────────────────────
  // Sorted longest-first so longer matches (e.g. "AMRAP") win over substrings
  var _terms = Object.keys(GL).sort(function(a, b) { return b.length - a.length; });
  // Pattern: word boundary, then the term, then word boundary
  // Use a single alternation regex for one-pass matching
  var _pattern = null;
  function _getPattern() {
    if (_pattern) return _pattern;
    var escaped = _terms.map(function(t) {
      return t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    });
    _pattern = new RegExp('\\b(' + escaped.join('|') + ')\\b', 'g');
    return _pattern;
  }

  // ── SKIP NODES ───────────────────────────────────────────
  // Tags where we must NOT inject spans
  var _skipTags = {
    SCRIPT:1, STYLE:1, TEXTAREA:1, INPUT:1, SELECT:1,
    CODE:1, PRE:1, KBD:1, SAMP:1, VAR:1, MATH:1, SVG:1,
    A:1, BUTTON:1,
  };

  function _shouldSkip(node) {
    if (!node || !node.parentNode) return true;
    var p = node.parentNode;
    // Skip if already inside a gl-term span
    if (p.classList && p.classList.contains('gl-term')) return true;
    // Skip disallowed tag types
    if (_skipTags[p.tagName]) return true;
    // Skip nav elements to avoid cluttering navigation
    if (p.closest && p.closest('.site-nav, .mobile-menu, #gl-tip')) return true;
    return false;
  }

  // ── PROCESS A ROOT ELEMENT ───────────────────────────────
  function _processNode(root) {
    if (!root) return;
    var rx = _getPattern();
    // Walk all text nodes within root
    var walker = document.createTreeWalker(
      root,
      NodeFilter.SHOW_TEXT,
      null,
      false
    );
    var nodesToProcess = [];
    var node;
    while ((node = walker.nextNode())) {
      if (!_shouldSkip(node) && rx.test(node.nodeValue)) {
        nodesToProcess.push(node);
      }
    }
    // Process collected nodes (modifying DOM during walk is unsafe)
    nodesToProcess.forEach(function(textNode) {
      rx.lastIndex = 0;
      var raw = textNode.nodeValue;
      if (!rx.test(raw)) return; // re-check (may have already been processed)
      rx.lastIndex = 0;
      var frag = document.createDocumentFragment();
      var lastIndex = 0;
      var match;
      while ((match = rx.exec(raw)) !== null) {
        var term = match[1];
        var def = GL[term];
        if (!def) continue;
        // Text before the match
        if (match.index > lastIndex) {
          frag.appendChild(document.createTextNode(raw.slice(lastIndex, match.index)));
        }
        // Span for the term
        var span = document.createElement('span');
        span.className = 'gl-term';
        span.dataset.gl = def;
        span.dataset.glTerm = term;
        span.textContent = term;
        frag.appendChild(span);
        lastIndex = match.index + term.length;
      }
      // Remaining text
      if (lastIndex < raw.length) {
        frag.appendChild(document.createTextNode(raw.slice(lastIndex)));
      }
      // Replace original text node with the fragment
      if (textNode.parentNode) {
        textNode.parentNode.replaceChild(frag, textNode);
      }
    });
  }

  // ── TOOLTIP LOGIC ────────────────────────────────────────
  var _tip = null;
  var _hideTimer = null;

  function _showTip(term, def, anchorEl) {
    if (!_tip) _tip = document.getElementById('gl-tip');
    if (!_tip) return;
    clearTimeout(_hideTimer);
    _tip.innerHTML = '<strong>' + term + '</strong>' + def;
    _tip.classList.add('show');
    _positionTip(anchorEl);
  }

  function _hideTip() {
    if (!_tip) _tip = document.getElementById('gl-tip');
    if (!_tip) return;
    _hideTimer = setTimeout(function() {
      _tip.classList.remove('show');
    }, 120);
  }

  function _positionTip(anchor) {
    if (!_tip || !anchor) return;
    var rect = anchor.getBoundingClientRect();
    var tw = _tip.offsetWidth || 280;
    var th = _tip.offsetHeight || 80;
    var vw = window.innerWidth;
    var vh = window.innerHeight;
    var PAD = 10;

    // Default: above the term
    var top = rect.top - th - 8;
    var left = rect.left + rect.width / 2 - tw / 2;

    // If too high, show below
    if (top < PAD) top = rect.bottom + 8;
    // Clamp horizontally
    if (left < PAD) left = PAD;
    if (left + tw > vw - PAD) left = vw - tw - PAD;
    // Clamp vertically (if also below viewport, just pin near top)
    if (top + th > vh - PAD) top = Math.max(PAD, vh - th - PAD);

    _tip.style.top  = Math.round(top)  + 'px';
    _tip.style.left = Math.round(left) + 'px';
  }

  // Event delegation — one listener on document for all gl-term spans
  function _attachEvents() {
    document.addEventListener('mouseover', function(e) {
      var t = e.target;
      if (t && t.classList && t.classList.contains('gl-term')) {
        _showTip(t.dataset.glTerm, t.dataset.gl, t);
      }
    });
    document.addEventListener('mouseout', function(e) {
      var t = e.target;
      if (t && t.classList && t.classList.contains('gl-term')) {
        _hideTip();
      }
    });
    // Touch: toggle on tap
    document.addEventListener('touchstart', function(e) {
      var t = e.target;
      if (t && t.classList && t.classList.contains('gl-term')) {
        e.preventDefault();
        if (!_tip) _tip = document.getElementById('gl-tip');
        if (_tip && _tip.classList.contains('show')) {
          _hideTip();
        } else {
          _showTip(t.dataset.glTerm, t.dataset.gl, t);
        }
      } else {
        // Tap elsewhere hides tip
        _hideTip();
      }
    }, { passive: false });
  }

  // ── MUTATION OBSERVER (debounced) ────────────────────────
  var _debounceTimer = null;
  var _pendingNodes = [];

  function _scheduleProcess(nodes) {
    nodes.forEach(function(n) { _pendingNodes.push(n); });
    clearTimeout(_debounceTimer);
    _debounceTimer = setTimeout(function() {
      var toProcess = _pendingNodes.slice();
      _pendingNodes = [];
      toProcess.forEach(function(n) {
        // Only process element nodes that are still in the DOM
        if (n.nodeType === 1 && document.body.contains(n)) {
          _processNode(n);
        }
      });
    }, 150);
  }

  function _startObserver() {
    if (typeof MutationObserver === 'undefined') return;
    var observer = new MutationObserver(function(mutations) {
      var added = [];
      mutations.forEach(function(m) {
        m.addedNodes.forEach(function(n) {
          if (n.nodeType === 1) added.push(n);
        });
      });
      if (added.length) _scheduleProcess(added);
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  // ── INIT ─────────────────────────────────────────────────
  function _init() {
    _bootstrap();
    _attachEvents();
    _processNode(document.body);
    _startObserver();
  }

  // Expose for explicit use by dynamic renderers
  // e.g. call window.blGlossarify(containerEl) after injecting HTML
  window.blGlossarify = _processNode;

  // Run after DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _init);
  } else {
    // Already loaded (nav.js may run after DOMContentLoaded)
    // Small defer to let the page finish rendering
    setTimeout(_init, 50);
  }

})();

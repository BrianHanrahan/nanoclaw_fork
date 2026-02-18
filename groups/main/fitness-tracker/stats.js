const API_BASE = window.location.origin;

// ── Exercise → Muscle Mapping (weighted) ─────────────────────────────────────
const EXERCISE_MUSCLE_MAP = {
  'Barbell Bench Press':    { primary: [['chest',1.0]], secondary: [['triceps',0.5],['shoulders',0.3]] },
  'DB Bench Press':         { primary: [['chest',1.0]], secondary: [['triceps',0.5],['shoulders',0.3]] },
  'Dumbbell Bench Press':   { primary: [['chest',1.0]], secondary: [['triceps',0.5],['shoulders',0.3]] },
  'Incline Bench Press':    { primary: [['chest',0.9],['shoulders',0.4]], secondary: [['triceps',0.4]] },
  'Cable Chest Flyes':      { primary: [['chest',1.0]], secondary: [] },
  'Cable Flyes':            { primary: [['chest',1.0]], secondary: [] },
  'Dips':                   { primary: [['triceps',0.7],['chest',0.7]], secondary: [['shoulders',0.3]] },
  'Push-ups':               { primary: [['chest',0.8]], secondary: [['triceps',0.4],['shoulders',0.3]] },
  'Dumbbell Rows':          { primary: [['back',1.0]], secondary: [['biceps',0.4],['rear_delts',0.2]] },
  'DB Rows':                { primary: [['back',1.0]], secondary: [['biceps',0.4],['rear_delts',0.2]] },
  'Barbell Row':            { primary: [['back',1.0]], secondary: [['biceps',0.5],['rear_delts',0.3]] },
  'Cable Face Pulls':       { primary: [['rear_delts',0.8],['back',0.5]], secondary: [['biceps',0.2]] },
  'Dumbbell Pullover':      { primary: [['back',0.7],['chest',0.5]], secondary: [['triceps',0.2]] },
  'Lat Pulldown':           { primary: [['back',1.0]], secondary: [['biceps',0.5]] },
  'Pull-ups':               { primary: [['back',1.0]], secondary: [['biceps',0.5]] },
  'Rowing':                 { primary: [['back',0.6],['cardio',1.0]], secondary: [['biceps',0.3],['core',0.4]] },
  'Overhead Dumbbell Press':{ primary: [['shoulders',1.0]], secondary: [['triceps',0.5]] },
  'OHP':                    { primary: [['shoulders',1.0]], secondary: [['triceps',0.5]] },
  'Military Press':         { primary: [['shoulders',1.0]], secondary: [['triceps',0.5],['core',0.2]] },
  'Cable Lateral Raises':   { primary: [['shoulders',1.0]], secondary: [] },
  'Lateral Raises':         { primary: [['shoulders',1.0]], secondary: [] },
  'Arnold Press':           { primary: [['shoulders',1.0]], secondary: [['triceps',0.4]] },
  'Cable Bicep Curls':      { primary: [['biceps',1.0]], secondary: [] },
  'Hammer Curls':           { primary: [['biceps',0.8],['forearms',0.5]], secondary: [] },
  'DB Curl to Shoulder Press':{ primary: [['biceps',0.7],['shoulders',0.7]], secondary: [] },
  'Dumbbell Curl to Shoulder Press':{ primary: [['biceps',0.7],['shoulders',0.7]], secondary: [] },
  'Cable Tricep Pushdowns': { primary: [['triceps',1.0]], secondary: [] },
  'Tricep Extensions':      { primary: [['triceps',1.0]], secondary: [] },
  'Back Squats':            { primary: [['quads',1.0],['glutes',0.8]], secondary: [['hamstrings',0.4],['core',0.3]] },
  'Goblet Squats':          { primary: [['quads',0.9],['glutes',0.7]], secondary: [['core',0.3]] },
  'Romanian Deadlifts':     { primary: [['hamstrings',1.0],['glutes',0.8]], secondary: [['back',0.3]] },
  'RDL':                    { primary: [['hamstrings',1.0],['glutes',0.8]], secondary: [['back',0.3]] },
  'Barbell Hip Extensions': { primary: [['glutes',1.0],['hamstrings',0.6]], secondary: [] },
  'Hip Thrusts':            { primary: [['glutes',1.0]], secondary: [['hamstrings',0.4]] },
  'Bulgarian Split Squats': { primary: [['quads',0.9],['glutes',0.7]], secondary: [['hamstrings',0.3]] },
  'Walking Lunges':         { primary: [['quads',0.8],['glutes',0.7]], secondary: [['hamstrings',0.3]] },
  'Kettlebell Swings':      { primary: [['glutes',0.9],['hamstrings',0.7]], secondary: [['core',0.5],['shoulders',0.2]] },
  'GHD Sit-ups':            { primary: [['core',1.0]], secondary: [['hip_flexors',0.4]] },
  'Hanging Knee Raises':    { primary: [['core',1.0]], secondary: [['hip_flexors',0.3]] },
  'Dead Bugs':              { primary: [['core',1.0]], secondary: [] },
  'Pallof Press':           { primary: [['core',1.0]], secondary: [['shoulders',0.2]] },
  'Plank':                  { primary: [['core',1.0]], secondary: [['shoulders',0.2]] },
  'Russian Twists':         { primary: [['core',1.0]], secondary: [] },
  'Barbell Clean & Press':  { primary: [['shoulders',0.8],['quads',0.6],['glutes',0.5]], secondary: [['back',0.4],['triceps',0.3],['core',0.4]] },
  'Turkish Get-Ups':        { primary: [['core',0.9],['shoulders',0.8]], secondary: [['glutes',0.4],['quads',0.3]] },
  'Deadlift':               { primary: [['back',0.9],['hamstrings',0.9],['glutes',0.8]], secondary: [['quads',0.4],['core',0.5]] },
  'Treadmill hike':         { primary: [['cardio',1.0]], secondary: [['quads',0.3],['glutes',0.3],['calves',0.2]] },
  'Treadmill':              { primary: [['cardio',1.0]], secondary: [['quads',0.2],['calves',0.2]] },
  'Peloton':                { primary: [['cardio',1.0],['quads',0.6]], secondary: [['glutes',0.3],['hamstrings',0.2]] },
};

const KEYWORD_FALLBACKS = {
  bench:    { primary: [['chest',1.0]], secondary: [['triceps',0.5],['shoulders',0.3]] },
  squat:    { primary: [['quads',1.0],['glutes',0.7]], secondary: [['hamstrings',0.3]] },
  curl:     { primary: [['biceps',1.0]], secondary: [] },
  press:    { primary: [['shoulders',0.8]], secondary: [['triceps',0.4]] },
  row:      { primary: [['back',1.0]], secondary: [['biceps',0.4]] },
  deadlift: { primary: [['hamstrings',1.0],['back',0.8]], secondary: [['glutes',0.6]] },
  fly:      { primary: [['chest',1.0]], secondary: [] },
  flye:     { primary: [['chest',1.0]], secondary: [] },
  lunge:    { primary: [['quads',0.8],['glutes',0.7]], secondary: [] },
  plank:    { primary: [['core',1.0]], secondary: [] },
  crunch:   { primary: [['core',1.0]], secondary: [] },
  extension:{ primary: [['triceps',0.6],['quads',0.6]], secondary: [] },
  raise:    { primary: [['shoulders',1.0]], secondary: [] },
  pulldown: { primary: [['back',1.0]], secondary: [['biceps',0.5]] },
};

const MUSCLE_RECOVERY_DAYS = {
  quads: 3, hamstrings: 3, glutes: 3, back: 3,
  chest: 2.5, shoulders: 2, core: 1.5,
  biceps: 2, triceps: 2, rear_delts: 2,
  forearms: 1.5, calves: 1.5, hip_flexors: 1.5, cardio: 1
};

const MUSCLE_CATEGORIES = {
  push: ['chest','shoulders','triceps'],
  pull: ['back','biceps','rear_delts','forearms'],
  upper: ['chest','back','shoulders','triceps','biceps','rear_delts','forearms'],
  lower: ['quads','hamstrings','glutes','calves','hip_flexors'],
  anterior: ['chest','shoulders','quads','biceps','core','hip_flexors'],
  posterior: ['back','rear_delts','hamstrings','glutes','calves','triceps'],
};

const EXPECTED_WEEKLY_FREQUENCY = {
  chest:1.5, back:1.5, shoulders:2, biceps:1.5, triceps:1.5,
  quads:1.5, hamstrings:1.5, glutes:2, core:2, cardio:2,
  rear_delts:1, forearms:0.5, calves:1
};

const GROUP_COLORS = {
  chest:'#e74c3c', back:'#3498db', shoulders:'#9b59b6',
  biceps:'#2ecc71', triceps:'#1abc9c', rear_delts:'#27ae60',
  quads:'#f39c12', glutes:'#e67e22', hamstrings:'#d35400',
  core:'#16a085', cardio:'#2980b9', forearms:'#95a5a6',
  calves:'#7f8c8d', hip_flexors:'#bdc3c7',
};

// ── Parsing ───────────────────────────────────────────────────────────────────

function findMuscleMapping(name) {
  const lower = name.toLowerCase();
  for (const [k, v] of Object.entries(EXERCISE_MUSCLE_MAP)) {
    if (lower === k.toLowerCase()) return v;
  }
  for (const [k, v] of Object.entries(EXERCISE_MUSCLE_MAP)) {
    if (lower.includes(k.toLowerCase()) || k.toLowerCase().includes(lower)) return v;
  }
  for (const [kw, v] of Object.entries(KEYWORD_FALLBACKS)) {
    if (lower.includes(kw)) return v;
  }
  return null;
}

function parseExerciseString(str) {
  const result = { exerciseName: str.trim(), sets: 3, reps: 10, weight: null, duration: null, isCardio: false };
  const colonMatch = str.match(/^([^:]+):\s*(.+)$/);
  if (!colonMatch) return result;

  result.exerciseName = colonMatch[1].trim();
  const d = colonMatch[2];

  const setsReps = d.match(/(\d+)\s*[×x]\s*(\d+)/i);
  if (setsReps) { result.sets = +setsReps[1]; result.reps = +setsReps[2]; }

  const setsOnly = d.match(/(\d+)\s*sets?/i);
  if (setsOnly) result.sets = +setsOnly[1];

  const repsRange = d.match(/(\d+)-(\d+)\s*reps?/i);
  if (repsRange) result.reps = Math.round((+repsRange[1] + +repsRange[2]) / 2);

  const weight = d.match(/(\d+(?:\.\d+)?)\s*(?:lbs?|pounds?|kg)/i);
  if (weight) result.weight = +weight[1];

  // Pyramid: "35 / 45 / 50 lbs" — use average
  const pyramid = d.match(/(\d+)\s*\/\s*(\d+)(?:\s*\/\s*(\d+))?/);
  if (pyramid) {
    const vals = [+pyramid[1], +pyramid[2], pyramid[3] ? +pyramid[3] : null].filter(Boolean);
    result.weight = vals.reduce((a, b) => a + b, 0) / vals.length;
    result.sets = result.sets || vals.length;
  }

  // "escalating to N lbs" — use top weight but factor lower sets
  const escalating = d.match(/escalating\s+to\s+(\d+)\s*lbs?/i);
  if (escalating) result.weight = +escalating[1] * 0.75; // average ~75% of top

  const duration = d.match(/(\d+)\s*min/i);
  if (duration) { result.duration = +duration[1]; result.isCardio = true; }

  const seconds = d.match(/(\d+)(?:-(\d+))?\s*sec/i);
  if (seconds) {
    result.duration = seconds[2]
      ? Math.round((+seconds[1] + +seconds[2]) / 2) / 60
      : +seconds[1] / 60;
  }

  return result;
}

function calculateREU(parsed, mapping) {
  const BASELINES = {
    'Back Squats':135,'Barbell Bench Press':95,'DB Bench Press':40,
    'Dumbbell Bench Press':40,'Dumbbell Rows':30,'Overhead Dumbbell Press':25,
    'Romanian Deadlifts':95,'Barbell Hip Extensions':80,'default':50
  };
  const CARDIO_INTENSITY = { 'Peloton':3.0,'Rowing':3.5,'Treadmill hike':2.0,'Treadmill':2.5,'default':2.0 };
  const BW_MULT = { 'Dips':1.2,'Pull-ups':1.3,'Push-ups':0.6,'Plank':0.4,'Dead Bugs':0.3,'default':0.5 };

  if (!mapping) return {};

  let base = 0;
  if (parsed.isCardio && parsed.duration) {
    base = parsed.duration * (CARDIO_INTENSITY[parsed.exerciseName] || CARDIO_INTENSITY.default);
  } else if (parsed.weight) {
    const bl = BASELINES[parsed.exerciseName] || BASELINES.default;
    base = parsed.sets * parsed.reps * (parsed.weight / bl);
  } else {
    const mult = BW_MULT[parsed.exerciseName] || BW_MULT.default;
    base = parsed.duration
      ? parsed.sets * parsed.duration * mult * 10
      : parsed.sets * parsed.reps * mult;
  }

  const out = {};
  for (const [m, w] of [...(mapping.primary||[]), ...(mapping.secondary||[])]) {
    out[m] = (out[m] || 0) + base * w;
  }
  return out;
}

// ── Core Algorithm ────────────────────────────────────────────────────────────

function applyDecay(value, daysAgo, halfLife = 7) {
  return value * Math.pow(0.5, daysAgo / halfLife);
}

function getWeekStart(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  const day = d.getDay();
  d.setDate(d.getDate() - day + (day === 0 ? -6 : 1));
  return d.toISOString().split('T')[0];
}

function calcRecovery(muscle, lastDate, lastREU) {
  const now = new Date();
  const daysSince = Math.floor((now - new Date(lastDate + 'T12:00:00')) / 86400000);
  const base = MUSCLE_RECOVERY_DAYS[muscle] || 2;
  const adj = lastREU ? base * (0.7 + 0.3 * Math.min(lastREU / 40, 2)) : base;
  const pct = Math.min(100, (daysSince / adj) * 100);
  const status = pct >= 100 ? 'fresh' : pct >= 80 ? 'ready' : pct >= 40 ? 'recovering' : 'fatigued';
  const recoverDate = new Date(now);
  recoverDate.setDate(recoverDate.getDate() + Math.max(0, Math.ceil(adj - daysSince)));
  return { status, pct: Math.round(pct), daysSince, recoverDate: recoverDate.toISOString().split('T')[0] };
}

function calcTrend(weeklyHistory) {
  if (weeklyHistory.length < 2) return { trend:'stable', pct:0 };
  const sorted = [...weeklyHistory].sort((a,b) => b.week.localeCompare(a.week));
  const recent = sorted.slice(0,2).reduce((s,w) => s + w.volume, 0) / 2;
  const prior  = sorted.slice(2,4).length ? sorted.slice(2,4).reduce((s,w) => s + w.volume, 0) / sorted.slice(2,4).length : recent;
  if (prior === 0) return { trend: recent > 0 ? 'up' : 'stable', pct:0 };
  const pct = Math.round(((recent - prior) / prior) * 100);
  return { trend: pct > 10 ? 'up' : pct < -10 ? 'down' : 'stable', pct };
}

function computeAdvancedMuscleStats(sessions, days = 30) {
  const now = new Date();
  const cutoff = new Date(now); cutoff.setDate(cutoff.getDate() - days);

  // Step 1: process each session → REU per muscle
  const processed = [];
  const lastTrained = {}; // muscle → {date, reu}
  const weeklyData  = {}; // muscle → {weekKey → {volume, count}}

  for (const [dateStr, session] of Object.entries(sessions)) {
    if (!session.completed) continue;
    const d = new Date(dateStr + 'T12:00:00');
    if (d < cutoff) continue;

    const sessionREU = {};
    for (const exStr of (session.exerciseLog || [])) {
      const parsed  = parseExerciseString(exStr);
      const mapping = findMuscleMapping(parsed.exerciseName);
      const reu     = calculateREU(parsed, mapping);
      for (const [m, v] of Object.entries(reu)) {
        sessionREU[m] = (sessionREU[m] || 0) + v;
      }
    }

    processed.push({ date: dateStr, reu: sessionREU });

    for (const [m, v] of Object.entries(sessionREU)) {
      if (!lastTrained[m] || dateStr > lastTrained[m].date) {
        lastTrained[m] = { date: dateStr, reu: v };
      }
      const wk = getWeekStart(dateStr);
      if (!weeklyData[m]) weeklyData[m] = {};
      if (!weeklyData[m][wk]) weeklyData[m][wk] = { volume:0, count:0 };
      weeklyData[m][wk].volume += v;
      weeklyData[m][wk].count  += 1;
    }
  }

  // Step 2: per-muscle stats
  const muscleGroups = {};
  const allMuscles = new Set([...Object.keys(MUSCLE_RECOVERY_DAYS), ...Object.keys(lastTrained)]);
  const weeksAnalyzed = days / 7;

  for (const muscle of allMuscles) {
    const lt = lastTrained[muscle];
    const wkData = weeklyData[muscle] || {};
    const weeklyHistory = Object.entries(wkData)
      .map(([week, d]) => ({ week, volume: Math.round(d.volume), count: d.count }))
      .sort((a,b) => a.week.localeCompare(b.week));

    // Decay-weighted volume
    const decayedVolume = processed.reduce((sum, s) => {
      const daysAgo = Math.floor((now - new Date(s.date + 'T12:00:00')) / 86400000);
      return sum + applyDecay(s.reu[muscle] || 0, daysAgo);
    }, 0);

    const rawVolume = processed.reduce((sum, s) => sum + (s.reu[muscle] || 0), 0);
    const sessionCount = processed.filter(s => s.reu[muscle] > 0).length;
    const weeklyFreq = sessionCount / weeksAnalyzed;
    const recovery = lt ? calcRecovery(muscle, lt.date, lt.reu) : { status:'fresh', pct:100, daysSince:999, recoverDate:null };
    const trendData = calcTrend(weeklyHistory);

    muscleGroups[muscle] = {
      rawVolume: Math.round(rawVolume),
      decayedVolume: Math.round(decayedVolume),
      weeklyAvgVolume: Math.round(rawVolume / weeksAnalyzed),
      sessionCount,
      weeklyFreq: Math.round(weeklyFreq * 10) / 10,
      lastDate: lt?.date || null,
      ...recovery,
      ...trendData,
      weeklyHistory,
      isNeglected: false,
      neglectReason: null,
    };
  }

  // Step 3: balance
  function catVolume(names) {
    return names.flatMap(n => MUSCLE_CATEGORIES[n] || [n])
      .reduce((sum, m) => sum + (muscleGroups[m]?.decayedVolume || 0), 0);
  }
  function balancePair(label, a, b, idealMin=0.8, idealMax=1.2) {
    const va = catVolume([a]), vb = catVolume([b]);
    const ratio = vb > 0 ? va / vb : 1;
    let status = 'balanced';
    if (ratio < idealMin) status = `${b}_dominant`;
    else if (ratio > idealMax) status = `${a}_dominant`;
    return { [`${a}Vol`]:Math.round(va), [`${b}Vol`]:Math.round(vb), ratio:Math.round(ratio*100)/100, status, label };
  }
  const balance = {
    pushPull:    balancePair('push/pull', 'push','pull', 0.8, 1.2),
    upperLower:  balancePair('upper/lower','upper','lower', 0.8, 1.5),
    antPost:     balancePair('front/back','anterior','posterior', 0.8, 1.2),
  };

  // Step 4: alerts
  const alerts = [];
  for (const [m, stats] of Object.entries(muscleGroups)) {
    if (stats.daysSince > 7 && m !== 'cardio') {
      alerts.push({ type:'neglect', muscle:m, msg:`${cap(m)} not trained in ${stats.daysSince} days`, sev:'warning' });
      muscleGroups[m].isNeglected = true;
    }
    const expected = EXPECTED_WEEKLY_FREQUENCY[m];
    if (expected && stats.weeklyFreq < expected * 0.5 && stats.sessionCount > 0) {
      alerts.push({ type:'undertrained', muscle:m, msg:`${cap(m)} avg ${stats.weeklyFreq}/wk (target ${expected}/wk)`, sev:'info' });
    }
  }
  for (const [key, b] of Object.entries(balance)) {
    if (b.status !== 'balanced') {
      alerts.push({ type:'imbalance', msg:`${b.label} ratio: ${b.ratio} (target 0.8–1.2)`, sev:'info' });
    }
  }

  // Step 5: summary
  const sorted = Object.entries(muscleGroups).filter(([m]) => m !== 'cardio')
    .sort((a,b) => b[1].decayedVolume - a[1].decayedVolume);

  return {
    muscleGroups,
    balance,
    alerts,
    summary: {
      totalSessions: processed.length,
      mostTrained: sorted[0]?.[0] || '—',
      leastTrained: sorted[sorted.length-1]?.[0] || '—',
      overallBalance: Object.values(balance).filter(b => b.status !== 'balanced').length === 0 ? 'Balanced' : 'Needs attention',
    },
    meta: { days, sessionCount: processed.length }
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1).replace('_',' '); }

function recoveryIcon(status) {
  return { fresh:'🟢', ready:'🟡', recovering:'🟠', fatigued:'🔴' }[status] || '⚪';
}

function trendArrow(trend, pct) {
  if (trend === 'up')   return `<span class="trend-up">↑${Math.abs(pct)}%</span>`;
  if (trend === 'down') return `<span class="trend-down">↓${Math.abs(pct)}%</span>`;
  return `<span class="trend-flat">→</span>`;
}

// ── Render Functions ──────────────────────────────────────────────────────────

function renderSummary(summary, meta) {
  document.getElementById('sTotalSessions').textContent = summary.totalSessions;
  document.getElementById('sMostTrained').textContent = cap(summary.mostTrained);
  document.getElementById('sLeastTrained').textContent = cap(summary.leastTrained);
  document.getElementById('sBalance').textContent = summary.overallBalance;
}

function renderVolumeChart(muscleGroups) {
  const container = document.getElementById('volumeChart');
  const sorted = Object.entries(muscleGroups)
    .filter(([m]) => muscleGroups[m].sessionCount > 0)
    .sort((a,b) => b[1].decayedVolume - a[1].decayedVolume);

  if (!sorted.length) { container.innerHTML = '<p class="empty">No session data yet.</p>'; return; }

  const max = sorted[0][1].decayedVolume || 1;

  container.innerHTML = sorted.map(([muscle, stats]) => {
    const pct = Math.round((stats.decayedVolume / max) * 100);
    const color = GROUP_COLORS[muscle] || '#667eea';
    const neglectBadge = stats.isNeglected ? ' <span class="neglect-badge">!</span>' : '';
    return `
      <div class="v-row">
        <div class="v-label">${cap(muscle)}${neglectBadge}</div>
        <div class="v-bar-wrap">
          <div class="v-bar" style="width:${pct}%;background:${color}"></div>
        </div>
        <div class="v-meta">
          <span class="v-reu">${stats.decayedVolume} REU</span>
          ${trendArrow(stats.trend, stats.pct)}
          <span>${recoveryIcon(stats.status)}</span>
        </div>
      </div>`;
  }).join('');
}

function renderBalanceGauges(balance) {
  for (const [key, b] of Object.entries(balance)) {
    const el = document.getElementById(`gauge_${key}`);
    if (!el) continue;
    const ratio = b.ratio;
    // Map ratio 0.5–1.5 → angle 0–180
    const angle = Math.max(0, Math.min(180, ((ratio - 0.5) / 1.0) * 180));
    const color = b.status === 'balanced' ? '#28a745' : ratio < 0.6 || ratio > 1.4 ? '#dc3545' : '#ffc107';
    const nx = 60 + 42 * Math.cos((Math.PI - angle * Math.PI / 180));
    const ny = 60 - 42 * Math.sin((Math.PI - angle * Math.PI / 180));

    const [aLabel, bLabel] = b.label.split('/');
    el.innerHTML = `
      <svg viewBox="0 0 120 68" class="gauge-svg">
        <path d="M10 60 A50 50 0 0 1 110 60" fill="none" stroke="#e8e8e8" stroke-width="10" stroke-linecap="round"/>
        <path d="M10 60 A50 50 0 0 1 110 60" fill="none" stroke="${color}" stroke-width="10" stroke-linecap="round"
              stroke-dasharray="${angle * 1.745} 314" stroke-dashoffset="0"/>
        <line x1="60" y1="60" x2="${nx.toFixed(1)}" y2="${ny.toFixed(1)}" stroke="#222" stroke-width="2.5" stroke-linecap="round"/>
        <circle cx="60" cy="60" r="5" fill="#222"/>
        <text x="12" y="67" font-size="9" fill="#888">${aLabel}</text>
        <text x="108" y="67" font-size="9" fill="#888" text-anchor="end">${bLabel}</text>
      </svg>
      <div class="gauge-value" style="color:${color}">${ratio.toFixed(2)}</div>
      <div class="gauge-status">${b.status === 'balanced' ? '✓ Balanced' : '⚠ ' + cap(b.status.replace('_',' '))}</div>`;
  }
}

function renderRecoveryMatrix(muscleGroups) {
  const container = document.getElementById('recoveryMatrix');
  const layout = [
    ['shoulders','chest','back'],
    ['triceps','core','biceps'],
    ['quads','glutes','hamstrings'],
    ['calves',null,'forearms'],
  ];
  const statusColors = { fresh:'#d4edda', ready:'#fff3cd', recovering:'#ffe5d0', fatigued:'#f8d7da' };
  const statusText   = { fresh:'#155724', ready:'#7a5c00', recovering:'#8a3a00', fatigued:'#721c24' };

  container.innerHTML = layout.map(row => `
    <div class="rm-row">
      ${row.map(m => {
        if (!m) return '<div class="rm-cell rm-empty"></div>';
        const stats = muscleGroups[m];
        if (!stats || !stats.lastDate) return `<div class="rm-cell rm-nodata"><div class="rm-name">${cap(m)}</div><div class="rm-pct">no data</div></div>`;
        const bg = statusColors[stats.status] || '#f0f2f5';
        const tc = statusText[stats.status] || '#333';
        return `
          <div class="rm-cell" style="background:${bg};color:${tc}">
            <div class="rm-name">${cap(m)}</div>
            <div class="rm-pct">${stats.pct}%</div>
            <div class="rm-days">${stats.daysSince}d ago</div>
          </div>`;
      }).join('')}
    </div>`).join('');
}

function renderFrequencyTable(muscleGroups) {
  const container = document.getElementById('freqTable');
  const rows = Object.entries(EXPECTED_WEEKLY_FREQUENCY)
    .map(([m, target]) => {
      const stats = muscleGroups[m];
      const actual = stats?.weeklyFreq || 0;
      const ratio = target > 0 ? actual / target : 1;
      const status = ratio >= 0.8 ? '✓' : ratio >= 0.5 ? '~' : '⚠';
      const cls = ratio >= 0.8 ? 'freq-ok' : ratio >= 0.5 ? 'freq-low' : 'freq-miss';
      return { m, target, actual, status, cls };
    })
    .sort((a,b) => (a.actual/a.target) - (b.actual/b.target));

  container.innerHTML = `
    <table class="freq-tbl">
      <thead><tr><th>Muscle</th><th>Target/wk</th><th>Actual/wk</th><th>Status</th></tr></thead>
      <tbody>
        ${rows.map(r => `
          <tr class="${r.cls}">
            <td>${cap(r.m)}</td>
            <td>${r.target}</td>
            <td>${r.actual}</td>
            <td>${r.status}</td>
          </tr>`).join('')}
      </tbody>
    </table>`;
}

function renderAlerts(alerts) {
  const container = document.getElementById('alertsContainer');
  if (!alerts.length) {
    container.innerHTML = '<div class="alert-ok">✓ All muscle groups look balanced and well-trained.</div>';
    return;
  }
  const icons = { neglect:'⚠️', undertrained:'📉', imbalance:'⚖️' };
  container.innerHTML = alerts.map(a => `
    <div class="alert alert-${a.sev}">
      ${icons[a.type] || '💡'} ${a.msg}
    </div>`).join('');
}

// ── Init ──────────────────────────────────────────────────────────────────────

let currentDays = 30;

async function loadAndRender(days) {
  currentDays = days;
  document.querySelectorAll('.range-btn').forEach(b => {
    b.classList.toggle('active', +b.dataset.days === days);
  });

  const r = await fetch(`${API_BASE}/api/all`);
  const data = await r.json();
  const stats = computeAdvancedMuscleStats(data.sessions || {}, days);

  renderSummary(stats.summary, stats.meta);
  renderBalanceGauges(stats.balance);
  renderVolumeChart(stats.muscleGroups);
  renderRecoveryMatrix(stats.muscleGroups);
  renderFrequencyTable(stats.muscleGroups);
  renderAlerts(stats.alerts);
}

document.addEventListener('DOMContentLoaded', () => loadAndRender(30));

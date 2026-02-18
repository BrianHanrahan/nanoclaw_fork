const API_BASE = window.location.origin;

let allData = { sessions: {}, plan: null };

// Muscle group mapping for effort tracking
const MUSCLE_GROUPS = {
  // Chest
  'Barbell Bench Press': ['chest', 'triceps', 'shoulders'],
  'DB Bench Press': ['chest', 'triceps', 'shoulders'],
  'Dumbbell Bench Press': ['chest', 'triceps', 'shoulders'],
  'Cable Chest Flyes': ['chest'],
  'Cable Flyes': ['chest'],
  // Back
  'Dumbbell Rows': ['back', 'biceps'],
  'DB Rows': ['back', 'biceps'],
  'Cable Face Pulls': ['back', 'shoulders'],
  'Dumbbell Pullover': ['back', 'chest'],
  'Barbell Row': ['back', 'biceps'],
  // Shoulders
  'Overhead Dumbbell Press': ['shoulders', 'triceps'],
  'OHP': ['shoulders', 'triceps'],
  'Cable Lateral Raises': ['shoulders'],
  'Lateral Raises': ['shoulders'],
  // Arms
  'Cable Bicep Curls': ['biceps'],
  'Hammer Curls': ['biceps'],
  'DB Curl to Shoulder Press': ['biceps', 'shoulders'],
  'Dumbbell Curl to Shoulder Press': ['biceps', 'shoulders'],
  'Cable Tricep Pushdowns': ['triceps'],
  'Dips': ['triceps', 'chest'],
  // Legs
  'Back Squats': ['quads', 'glutes', 'hamstrings'],
  'Goblet Squats': ['quads', 'glutes'],
  'Romanian Deadlifts': ['hamstrings', 'glutes'],
  'RDL': ['hamstrings', 'glutes'],
  'Barbell Hip Extensions': ['glutes', 'hamstrings'],
  'Bulgarian Split Squats': ['quads', 'glutes'],
  'Walking Lunges': ['quads', 'glutes'],
  'Kettlebell Swings': ['glutes', 'hamstrings', 'core'],
  // Core
  'GHD Sit-ups': ['core'],
  'Hanging Knee Raises': ['core'],
  'Dead Bugs': ['core'],
  'Pallof Press': ['core'],
  'Plank': ['core'],
  'Russian Twists': ['core'],
  // Cardio / Full body
  'Treadmill hike': ['cardio'],
  'Treadmill': ['cardio'],
  'Peloton': ['cardio', 'quads'],
  'Rowing': ['cardio', 'back', 'core'],
  'Barbell Clean & Press': ['full-body', 'shoulders'],
  'Turkish Get-Ups': ['full-body', 'core', 'shoulders'],
};

const GROUP_COLORS = {
  chest:      '#e74c3c',
  back:       '#3498db',
  shoulders:  '#9b59b6',
  biceps:     '#2ecc71',
  triceps:    '#1abc9c',
  quads:      '#f39c12',
  glutes:     '#e67e22',
  hamstrings: '#d35400',
  core:       '#27ae60',
  cardio:     '#16a085',
  'full-body':'#2980b9',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(dateStr) {
    const d = new Date(dateStr + 'T12:00:00');
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function todayKey() {
    return new Date().toISOString().split('T')[0];
}

function getMuscleGroups(exerciseStr) {
    const groups = new Set();
    const lower = exerciseStr.toLowerCase();
    for (const [exercise, muscles] of Object.entries(MUSCLE_GROUPS)) {
        if (lower.includes(exercise.toLowerCase())) {
            muscles.forEach(m => groups.add(m));
        }
    }
    return [...groups];
}

function computeMuscleStats(sessions) {
    // Count sessions per muscle group over last 30 days
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);
    const counts = {};

    for (const [date, session] of Object.entries(sessions)) {
        if (!session.completed) continue;
        if (new Date(date) < cutoff) continue;

        const exercises = session.exerciseLog || [];
        const seenGroups = new Set();
        for (const ex of exercises) {
            const groups = getMuscleGroups(ex);
            groups.forEach(g => seenGroups.add(g));
        }
        seenGroups.forEach(g => {
            counts[g] = (counts[g] || 0) + 1;
        });
    }
    return counts;
}

// ── API ───────────────────────────────────────────────────────────────────────

async function loadAll() {
    try {
        const r = await fetch(`${API_BASE}/api/all`);
        allData = await r.json();
        if (!allData.sessions) allData.sessions = {};
    } catch (e) {
        console.error('Load error:', e);
    }
}

async function saveSession(dateStr, sessionData) {
    allData.sessions[dateStr] = sessionData;
    await fetch(`${API_BASE}/api/session/${dateStr}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sessionData)
    });
    await refreshStats();
    renderStats();
}

async function refreshStats() {
    try {
        const r = await fetch(`${API_BASE}/api/stats`);
        const stats = await r.json();
        document.getElementById('totalWorkouts').textContent = stats.totalWorkouts;
        document.getElementById('streak').textContent = stats.currentStreak;
    } catch (e) {}
}

// ── Render ────────────────────────────────────────────────────────────────────

function render() {
    renderPlan();
    renderHistory();
    renderStats();
}

function renderPlan() {
    const plan = allData.plan;
    const el = document.getElementById('planCard');
    const today = todayKey();
    const session = allData.sessions[today] || { completed: false, exercises: {}, notes: '' };
    const isCompleted = session.completed;

    if (!plan || !plan.exercises || plan.exercises.length === 0) {
        el.innerHTML = `
            <div class="card plan-card empty-plan">
                <div class="card-label">Up Next</div>
                <p class="empty-msg">Frank will post your next workout here after reviewing your last session.</p>
            </div>`;
        return;
    }

    const exHTML = plan.exercises.map((ex, i) => {
        const done = session.exercises?.[`ex${i}`] || false;
        return `
            <div class="exercise-item ${done ? 'done' : ''}">
                <input type="checkbox" class="ex-check" ${done ? 'checked' : ''}
                    onchange="toggleExercise('${today}', 'ex${i}', this.checked)">
                <div class="ex-detail">
                    <div class="ex-name">${ex.name}</div>
                    <div class="ex-sets">${ex.sets}</div>
                </div>
            </div>`;
    }).join('');

    const finisherHTML = plan.finisher
        ? `<div class="finisher">🔥 <strong>Finisher:</strong> ${plan.finisher}</div>` : '';

    el.innerHTML = `
        <div class="card plan-card ${isCompleted ? 'completed-card' : ''}">
            <div class="card-label-row">
                <span class="card-label">${isCompleted ? '✓ Completed Today' : 'Up Next'}</span>
                <span class="status-badge ${isCompleted ? 'badge-done' : 'badge-pending'}">
                    ${isCompleted ? 'Done' : 'Today'}
                </span>
            </div>
            <div class="plan-title">${plan.name}</div>
            <div class="plan-subtitle">${plan.focus || ''}</div>
            ${plan.note ? `<div class="plan-note">💬 ${plan.note}</div>` : ''}
            <div class="exercise-list">${exHTML}</div>
            ${finisherHTML}
            <textarea class="notes-input" placeholder="Notes, weights, how it felt..."
                onchange="saveNotes('${today}', this.value)">${session.notes || ''}</textarea>
            <button class="complete-btn ${isCompleted ? 'btn-done' : ''}"
                onclick="toggleComplete('${today}')">
                ${isCompleted ? '✓ Marked Complete' : 'Mark Complete'}
            </button>
        </div>`;
}

function renderHistory() {
    const container = document.getElementById('historyContainer');
    const sessions = allData.sessions;
    const today = todayKey();

    // All completed sessions, sorted newest first (including today if done)
    const dates = Object.keys(sessions)
        .filter(d => sessions[d].completed)
        .sort((a, b) => b.localeCompare(a))
        .slice(0, 20);

    if (dates.length === 0) {
        container.innerHTML = `<p class="empty-msg" style="padding:16px 0">No completed sessions yet.</p>`;
        return;
    }

    container.innerHTML = dates.map(dateStr => {
        const s = sessions[dateStr];
        const exList = s.exerciseLog || [];
        const isToday = dateStr === today;

        const exHTML = exList.length > 0
            ? `<ul class="history-ex">${exList.map(e => `<li>${e}</li>`).join('')}</ul>`
            : '';
        const notesHTML = s.notes
            ? `<div class="history-notes">${s.notes}</div>` : '';

        return `
            <div class="card history-card">
                <div class="history-header">
                    <div>
                        <div class="history-date">${fmt(dateStr)}</div>
                        <div class="history-name">${s.workoutName || 'Workout'}</div>
                    </div>
                    <span class="status-badge badge-done">✓</span>
                </div>
                ${exHTML}
                ${notesHTML}
            </div>`;
    }).join('');
}

function renderStats() {
    const container = document.getElementById('muscleStats');
    const counts = computeMuscleStats(allData.sessions);

    if (Object.keys(counts).length === 0) {
        container.innerHTML = `<p class="empty-msg">No data yet — muscle tracking starts after logging sessions.</p>`;
        return;
    }

    const maxCount = Math.max(...Object.values(counts));
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);

    container.innerHTML = sorted.map(([group, count]) => {
        const pct = Math.round((count / maxCount) * 100);
        const color = GROUP_COLORS[group] || '#667eea';
        const warning = pct < 30 ? ' ⚠' : '';
        return `
            <div class="muscle-row">
                <div class="muscle-label">${group}${warning}</div>
                <div class="muscle-bar-wrap">
                    <div class="muscle-bar" style="width:${pct}%;background:${color}"></div>
                </div>
                <div class="muscle-count">${count}</div>
            </div>`;
    }).join('');
}

// ── Actions ───────────────────────────────────────────────────────────────────

async function toggleExercise(dateStr, exKey, checked) {
    const session = allData.sessions[dateStr] || { completed: false, exercises: {}, notes: '' };
    session.exercises = session.exercises || {};
    session.exercises[exKey] = checked;
    await saveSession(dateStr, session);
    render();
}

async function toggleComplete(dateStr) {
    const session = allData.sessions[dateStr] || { completed: false, exercises: {}, notes: '' };
    session.completed = !session.completed;
    if (session.completed && allData.plan) {
        session.workoutName = session.workoutName || allData.plan.name;
        // Log plan exercises if no exerciseLog yet
        if (!session.exerciseLog || session.exerciseLog.length === 0) {
            session.exerciseLog = allData.plan.exercises.map(e => `${e.name}: ${e.sets}`);
        }
    }
    await saveSession(dateStr, session);
    render();
}

async function saveNotes(dateStr, notes) {
    const session = allData.sessions[dateStr] || { completed: false, exercises: {}, notes: '' };
    session.notes = notes;
    await saveSession(dateStr, session);
}

// ── Init ──────────────────────────────────────────────────────────────────────

async function init() {
    await loadAll();
    render();
    await refreshStats();
}

init();

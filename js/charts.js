import { state, dayStart } from './state.js';

// Register datalabels plugin (loaded as global from CDN)
Chart.register(ChartDataLabels);

Chart.defaults.color = '#f1f5f9';
Chart.defaults.font.family = '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

// ── Period offsets (0 = current, -1 = previous, …) ───────────────────────

export const offsets = { day: 0, week: 0, month: 0 };

const _charts = {};

// ── Data helpers ─────────────────────────────────────────────────────────

function hourlyReps(date) {
  const start = dayStart(date);
  const end = start + 86_400_000;
  const hours = new Array(24).fill(0);
  state.sets
    .filter(s => s.timestamp >= start && s.timestamp < end)
    .forEach(s => { hours[new Date(s.timestamp).getHours()] += s.reps; });
  return hours;
}

function weeklyAgg(weekStartMs) {
  const days = Array.from({ length: 7 }, () => ({ reps: 0, sets: 0 }));
  state.sets.forEach(s => {
    const i = Math.floor((s.timestamp - weekStartMs) / 86_400_000);
    if (i >= 0 && i < 7) { days[i].reps += s.reps; days[i].sets++; }
  });
  return days;
}

function monthlyAgg(year, month) {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const days = Array.from({ length: daysInMonth }, () => ({ reps: 0, sets: 0 }));
  state.sets.forEach(s => {
    const d = new Date(s.timestamp);
    if (d.getFullYear() === year && d.getMonth() === month) {
      days[d.getDate() - 1].reps += s.reps;
      days[d.getDate() - 1].sets++;
    }
  });
  return days;
}

// Week starts on Monday. Returns midnight timestamp of that Monday.
function mondayStart(date) {
  const d = new Date(dayStart(date));
  const day = d.getDay(); // 0=Sun
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
  return d.getTime();
}

// ── Shared chart style ────────────────────────────────────────────────────

const ACCENT  = '#6366f1';
const ACCENT_DIM = 'rgba(99,102,241,0.55)';
const DIM     = '#64748b';
const GRID    = '#2a2a2a';

function baseScales(extraX = {}) {
  return {
    x: {
      grid: { display: false },
      border: { color: GRID },
      ticks: { color: DIM, font: { size: 11 }, maxRotation: 0 },
      ...extraX,
    },
    y: {
      beginAtZero: true,
      grid: { color: GRID },
      border: { display: false },
      ticks: { color: DIM, font: { size: 11 }, precision: 0 },
    },
  };
}

// ── Canvas lifecycle ──────────────────────────────────────────────────────

function getCtx(viewId) {
  const container = document.querySelector(`#${viewId} .chart-wrap`);
  let canvas = container.querySelector('canvas');
  if (!canvas) {
    canvas = document.createElement('canvas');
    container.appendChild(canvas);
  }
  return canvas.getContext('2d');
}

function destroyChart(name) {
  _charts[name]?.destroy();
  delete _charts[name];
}

// ── Day: hourly bar chart ─────────────────────────────────────────────────

export function renderDay() {
  const now = new Date();
  const target = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offsets.day);
  const data = hourlyReps(target);
  const o = offsets.day;

  document.getElementById('day-title').textContent =
    o === 0 ? 'Today' :
    o === -1 ? 'Yesterday' :
    target.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

  document.getElementById('day-next').disabled = o >= 0;

  const labels = Array.from({ length: 24 }, (_, i) => {
    if (i % 3 !== 0) return '';
    if (i === 0) return '12a';
    if (i === 12) return '12p';
    return `${i > 12 ? i - 12 : i}${i < 12 ? 'a' : 'p'}`;
  });

  destroyChart('day');
  _charts.day = new Chart(getCtx('view-day'), {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: ACCENT,
        borderRadius: 3,
        borderSkipped: false,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 180 },
      plugins: {
        legend: { display: false },
        datalabels: { display: false },
        tooltip: {
          callbacks: {
            title: ([item]) => {
              const h = item.dataIndex;
              return `${h % 12 || 12}:00 ${h < 12 ? 'AM' : 'PM'}`;
            },
            label: item => ` ${item.raw} reps`,
          },
        },
      },
      scales: baseScales(),
    },
  });
}

// ── Week: daily bar chart with reps labels + set counts ───────────────────

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function renderWeek() {
  const now = new Date();
  const wStart = mondayStart(now) + offsets.week * 7 * 86_400_000;
  const data = weeklyAgg(wStart);
  const o = offsets.week;

  // Mon=0…Sun=6 index for today, only relevant when viewing current week
  const todayIdx = o === 0 ? (now.getDay() + 6) % 7 : -1;

  const wEnd = new Date(wStart + 6 * 86_400_000);
  document.getElementById('week-title').textContent =
    o === 0 ? 'This Week' :
    o === -1 ? 'Last Week' :
    `${new Date(wStart).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${wEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;

  document.getElementById('week-next').disabled = o >= 0;

  destroyChart('week');
  _charts.week = new Chart(getCtx('view-week'), {
    type: 'bar',
    data: {
      labels: DAY_NAMES,
      datasets: [{
        data: data.map(d => d.reps),
        backgroundColor: data.map((_, i) => i === todayIdx ? ACCENT : ACCENT_DIM),
        borderRadius: 4,
        borderSkipped: false,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 180 },
      layout: { padding: { top: 22 } },
      plugins: {
        legend: { display: false },
        datalabels: {
          anchor: 'end',
          align: 'end',
          color: '#f1f5f9',
          font: { size: 11, weight: '600' },
          formatter: v => v > 0 ? v : '',
        },
        tooltip: {
          callbacks: {
            label: item => {
              const d = data[item.dataIndex];
              return [` ${d.reps} reps`, ` ${d.sets} sets`];
            },
          },
        },
      },
      scales: baseScales({
        ticks: {
          color: (ctx) => ctx.index === todayIdx ? '#818cf8' : DIM,
          font: { size: 11 },
          maxRotation: 0,
          callback: (_, i) => {
            const n = data[i]?.sets ?? 0;
            return n > 0 ? [DAY_NAMES[i], `${n}×`] : DAY_NAMES[i];
          },
        },
      }),
    },
  });
}

// ── Month: daily line chart ───────────────────────────────────────────────

export function renderMonth() {
  const now = new Date();
  const target = new Date(now.getFullYear(), now.getMonth() + offsets.month, 1);
  const year = target.getFullYear();
  const month = target.getMonth();
  const data = monthlyAgg(year, month);
  const todayDay = offsets.month === 0 ? now.getDate() : -1;
  const o = offsets.month;

  document.getElementById('month-title').textContent =
    o === 0 ? 'This Month' :
    o === -1 ? 'Last Month' :
    target.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  document.getElementById('month-next').disabled = o >= 0;

  destroyChart('month');
  _charts.month = new Chart(getCtx('view-month'), {
    type: 'line',
    data: {
      labels: data.map((_, i) => i + 1),
      datasets: [{
        data: data.map(d => d.reps),
        borderColor: ACCENT,
        backgroundColor: 'rgba(99,102,241,0.08)',
        borderWidth: 2,
        pointBackgroundColor: data.map((_, i) => i + 1 === todayDay ? '#f1f5f9' : ACCENT),
        pointRadius: data.map((d, i) => i + 1 === todayDay ? 5 : d.reps > 0 ? 3.5 : 1.5),
        pointHoverRadius: 6,
        fill: true,
        tension: 0.3,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 180 },
      plugins: {
        legend: { display: false },
        datalabels: { display: false },
        tooltip: {
          callbacks: {
            title: ([item]) =>
              new Date(year, month, item.dataIndex + 1)
                .toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            label: item => {
              const d = data[item.dataIndex];
              return [` ${d.reps} reps`, ` ${d.sets} sets`];
            },
          },
        },
      },
      scales: baseScales({
        ticks: { color: DIM, font: { size: 11 }, maxTicksLimit: 8 },
      }),
    },
  });
}

// ── Navigation ────────────────────────────────────────────────────────────

const RENDERERS = { day: renderDay, week: renderWeek, month: renderMonth };

export function navigate(view, delta) {
  const next = offsets[view] + delta;
  if (next > 0) return; // don't navigate into the future
  offsets[view] = next;
  RENDERERS[view]();
}

// ── Swipe ─────────────────────────────────────────────────────────────────

export function addSwipe(el, onLeft, onRight) {
  let sx = 0, sy = 0, active = false;
  el.addEventListener('pointerdown', e => {
    if (e.target.closest('button')) return;
    sx = e.clientX; sy = e.clientY; active = true;
  });
  el.addEventListener('pointerup', e => {
    if (!active) return;
    active = false;
    const dx = e.clientX - sx;
    const dy = e.clientY - sy;
    if (Math.abs(dx) < 50 || Math.abs(dy) > Math.abs(dx) * 0.75) return;
    if (dx < 0) onLeft(); else onRight();
  });
  el.addEventListener('pointercancel', () => { active = false; });
}

import {
  state, init, switchUser, createUser, removeUser, logSet, currentUser, todaySets, todayReps, dayStart
} from './state.js';
import { renderDay, renderWeek, renderMonth, navigate, addSwipe } from './charts.js';

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js');
}

// ── View routing ────────────────────────────────────────────────────────────

const CHART_RENDERERS = { day: renderDay, week: renderWeek, month: renderMonth };

function showView(name) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
  document.getElementById(`view-${name}`).classList.add('active');
  document.querySelector(`[data-view="${name}"]`).classList.add('active');
  CHART_RENDERERS[name]?.();
}

document.querySelectorAll('.nav-tab').forEach(btn => {
  btn.addEventListener('click', () => showView(btn.dataset.view));
});

// ── Track screen ─────────────────────────────────────────────────────────────

function renderTrack() {
  document.getElementById('today-reps').textContent = todayReps();
  document.getElementById('today-sets').textContent = todaySets().length;
  document.getElementById('cur-set').textContent = state.currentSet;
  document.getElementById('btn-log').disabled = state.currentSet === 0;
  const u = currentUser();
  document.getElementById('user-btn').textContent = u ? u.name : 'Me';
}

document.querySelectorAll('.btn-inc').forEach(btn => {
  btn.addEventListener('click', () => {
    state.currentSet += parseInt(btn.dataset.add, 10);
    const el = document.getElementById('cur-set');
    el.classList.remove('bump');
    void el.offsetWidth; // reflow to restart animation
    el.classList.add('bump');
    renderTrack();
    setTimeout(() => el.classList.remove('bump'), 120);
  });
});

document.getElementById('btn-clear').addEventListener('click', () => {
  state.currentSet = 0;
  renderTrack();
});

document.getElementById('btn-log').addEventListener('click', async () => {
  const entry = await logSet();
  if (!entry) return;

  const btn = document.getElementById('btn-log');
  btn.textContent = '✓ Logged';
  btn.classList.add('logged');
  setTimeout(() => {
    btn.textContent = 'Log Set';
    btn.classList.remove('logged');
  }, 900);

  renderTrack();
});

// ── User modal ────────────────────────────────────────────────────────────────

function openModal() {
  renderUserList();
  document.getElementById('user-modal').classList.remove('hidden');
}

function closeModal() {
  document.getElementById('user-modal').classList.add('hidden');
}

function renderUserList() {
  const list = document.getElementById('user-list');
  const canDelete = state.users.length > 1;
  list.innerHTML = state.users.map(u => `
    <li class="user-item${u.id === state.currentUserId ? ' active' : ''}" data-id="${u.id}">
      <span class="user-dot"></span>
      <span class="user-name">${escHtml(u.name)}</span>
      ${canDelete ? `<button class="btn-delete-user" data-id="${u.id}" aria-label="Delete ${escHtml(u.name)}">✕</button>` : ''}
    </li>
  `).join('');
  list.querySelectorAll('.user-item').forEach(li => {
    li.addEventListener('click', async () => {
      await switchUser(li.dataset.id);
      renderTrack();
      closeModal();
    });
  });
  list.querySelectorAll('.btn-delete-user').forEach(btn => {
    btn.addEventListener('click', async e => {
      e.stopPropagation();
      await removeUser(btn.dataset.id);
      renderTrack();
      renderUserList();
    });
  });
}

document.getElementById('user-btn').addEventListener('click', openModal);
document.getElementById('modal-close').addEventListener('click', closeModal);
document.getElementById('modal-backdrop').addEventListener('click', closeModal);

document.getElementById('btn-add-user').addEventListener('click', async () => {
  const input = document.getElementById('new-user-name');
  const name = input.value.trim();
  if (!name) return;
  await createUser(name);
  input.value = '';
  renderUserList();
});

document.getElementById('new-user-name').addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('btn-add-user').click();
});

// ── CSV export ───────────────────────────────────────────────────────────────

document.getElementById('btn-export').addEventListener('click', () => {
  const user = currentUser();
  if (!user) return;
  const rows = [['user', 'date', 'time', 'reps']];
  [...state.sets]
    .sort((a, b) => a.timestamp - b.timestamp)
    .forEach(s => {
      const d = new Date(s.timestamp);
      rows.push([
        user.name,
        d.toLocaleDateString('en-CA'),
        d.toLocaleTimeString('en-US', { hour12: false }),
        s.reps,
      ]);
    });
  const csv = rows.map(r => r.join(',')).join('\n');
  const a = Object.assign(document.createElement('a'), {
    href: URL.createObjectURL(new Blob([csv], { type: 'text/csv' })),
    download: `gtg-${user.name}-${new Date().toLocaleDateString('en-CA')}.csv`,
  });
  a.click();
  URL.revokeObjectURL(a.href);
});

// ── Chart navigation ──────────────────────────────────────────────────────────

['day', 'week', 'month'].forEach(view => {
  document.getElementById(`${view}-prev`).addEventListener('click', () => navigate(view, -1));
  document.getElementById(`${view}-next`).addEventListener('click', () => navigate(view, 1));
  addSwipe(
    document.getElementById(`view-${view}`),
    () => navigate(view, -1),  // swipe left  → older
    () => navigate(view, 1),   // swipe right → newer
  );
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function escHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ── Day rollover ──────────────────────────────────────────────────────────────
// Re-render whenever the app comes back into focus (handles midnight + iOS suspend)

document.addEventListener('visibilitychange', () => {
  if (!document.hidden) renderTrack();
});

// ── Boot ──────────────────────────────────────────────────────────────────────

init().then(renderTrack);

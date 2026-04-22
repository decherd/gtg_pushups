import {
  state, init, switchUser, createUser, logSet, currentUser, todaySets, todayReps, dayStart
} from './state.js';

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js');
}

// ── View routing ────────────────────────────────────────────────────────────

function showView(name) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
  document.getElementById(`view-${name}`).classList.add('active');
  document.querySelector(`[data-view="${name}"]`).classList.add('active');
}

document.querySelectorAll('.nav-tab').forEach(btn => {
  btn.addEventListener('click', () => showView(btn.dataset.view));
});

// ── Track screen ─────────────────────────────────────────────────────────────

function renderTrack() {
  document.getElementById('today-reps').textContent = todayReps();
  document.getElementById('today-sets').textContent = todaySets().length;
  document.getElementById('cur-set').textContent = state.currentSet;
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
  list.innerHTML = state.users.map(u => `
    <li class="user-item${u.id === state.currentUserId ? ' active' : ''}" data-id="${u.id}">
      <span class="user-dot"></span>
      <span>${escHtml(u.name)}</span>
    </li>
  `).join('');
  list.querySelectorAll('.user-item').forEach(li => {
    li.addEventListener('click', async () => {
      await switchUser(li.dataset.id);
      renderTrack();
      closeModal();
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

// ── Chart view placeholders ───────────────────────────────────────────────────
// Charts will be wired up in a future phase

['day', 'week', 'month'].forEach(view => {
  const main = document.querySelector(`#view-${view} .chart-main`);
  if (!main) return;
  const placeholder = document.createElement('div');
  placeholder.className = 'chart-placeholder';
  placeholder.textContent = 'Charts coming soon';
  main.appendChild(placeholder);
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function escHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ── Boot ──────────────────────────────────────────────────────────────────────

init().then(renderTrack);

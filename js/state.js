import { getUsers, putUser, getSetsForUser, putSet, deleteUser, deleteSetsByUser } from './db.js';

export const state = {
  users: [],
  currentUserId: null,
  sets: [],
  currentSet: 0,
};

export async function init() {
  state.users = await getUsers();

  const saved = localStorage.getItem('gtg-user');
  const match = state.users.find(u => u.id === saved);

  if (match) {
    state.currentUserId = match.id;
  } else if (state.users.length > 0) {
    state.currentUserId = state.users[0].id;
  } else {
    const user = { id: crypto.randomUUID(), name: 'Me' };
    await putUser(user);
    state.users.push(user);
    state.currentUserId = user.id;
  }

  localStorage.setItem('gtg-user', state.currentUserId);
  state.sets = await getSetsForUser(state.currentUserId);
}

export async function switchUser(userId) {
  state.currentUserId = userId;
  state.currentSet = 0;
  localStorage.setItem('gtg-user', userId);
  state.sets = await getSetsForUser(userId);
}

export async function createUser(name) {
  const user = { id: crypto.randomUUID(), name: name.trim() };
  await putUser(user);
  state.users.push(user);
  return user;
}

export async function removeUser(id) {
  if (state.users.length <= 1) return; // always keep at least one user
  await deleteSetsByUser(id);
  await deleteUser(id);
  state.users = state.users.filter(u => u.id !== id);
  if (state.currentUserId === id) {
    await switchUser(state.users[0].id);
  }
}

export async function logSet() {
  if (state.currentSet <= 0) return null;
  const entry = {
    id: crypto.randomUUID(),
    userId: state.currentUserId,
    reps: state.currentSet,
    timestamp: Date.now(),
  };
  await putSet(entry);
  state.sets.push(entry);
  state.currentSet = 0;
  return entry;
}

export async function importSets(rows) {
  // rows: [{ userName, timestamp, reps }]
  const byUser = {};
  for (const row of rows) {
    (byUser[row.userName] = byUser[row.userName] || []).push(row);
  }

  let imported = 0;
  for (const [userName, userRows] of Object.entries(byUser)) {
    let user = state.users.find(u => u.name === userName);
    if (!user) user = await createUser(userName);

    const existing = await getSetsForUser(user.id);
    const existingTs = new Set(existing.map(s => s.timestamp));

    for (const row of userRows) {
      if (!existingTs.has(row.timestamp)) {
        await putSet({ id: crypto.randomUUID(), userId: user.id, reps: row.reps, timestamp: row.timestamp });
        imported++;
      }
    }
  }

  state.sets = await getSetsForUser(state.currentUserId);
  return imported;
}

export function currentUser() {
  return state.users.find(u => u.id === state.currentUserId);
}

export function todaySets() {
  const start = dayStart(new Date());
  return state.sets.filter(s => s.timestamp >= start && s.timestamp < start + 86_400_000);
}

export function todayReps() {
  return todaySets().reduce((sum, s) => sum + s.reps, 0);
}

export function dayStart(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

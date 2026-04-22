const DB_NAME = 'gtg-pushups';
const DB_VERSION = 1;
let _db = null;

async function getDB() {
  if (_db) return _db;
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = ({ target: { result: db } }) => {
      if (!db.objectStoreNames.contains('users')) {
        db.createObjectStore('users', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('sets')) {
        const store = db.createObjectStore('sets', { keyPath: 'id' });
        store.createIndex('userId', 'userId');
      }
    };
    req.onsuccess = ({ target: { result: db } }) => { _db = db; resolve(db); };
    req.onerror = () => reject(req.error);
  });
}

function run(req) {
  return new Promise((res, rej) => {
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
}

export async function getUsers() {
  const db = await getDB();
  return run(db.transaction('users').objectStore('users').getAll());
}

export async function putUser(user) {
  const db = await getDB();
  return run(db.transaction('users', 'readwrite').objectStore('users').put(user));
}

export async function getSetsForUser(userId) {
  const db = await getDB();
  return run(
    db.transaction('sets').objectStore('sets').index('userId').getAll(userId)
  );
}

export async function putSet(set) {
  const db = await getDB();
  return run(db.transaction('sets', 'readwrite').objectStore('sets').put(set));
}

export async function deleteSet(id) {
  const db = await getDB();
  return run(db.transaction('sets', 'readwrite').objectStore('sets').delete(id));
}

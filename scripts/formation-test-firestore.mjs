// In-memory I/O boundary only; tests execute the production save transaction.
const records = new Map();
const database = {
  records,
  failWrite: false,
  writes: 0,
  reads: [],
  reset(entries = []) {
    records.clear();
    for (const [path, value] of entries) records.set(path, structuredClone(value));
    database.failWrite = false;
    database.writes = 0;
    database.reads.length = 0;
  },
};
globalThis.__formationTestDb = database;
export const collection = (_database, path) => ({ path });
export const doc = (databaseOrCollection, path, id) => {
  const resolved = typeof path === 'string'
    ? (id ? `${path}/${id}` : `${databaseOrCollection.path}/${path}`)
    : `${databaseOrCollection.path}/${crypto.randomUUID()}`;
  return { path: resolved, id: resolved.split('/').at(-1) };
};
function snapshot(ref) {
  return { id: ref.id, exists: () => records.has(ref.path), data: () => structuredClone(records.get(ref.path)) };
}
export const getDoc = async (ref) => {
  database.reads.push(ref.path);
  return snapshot(ref);
};
export const getDocs = async (ref) => {
  const docs = [...records.keys()].filter((path) => path.startsWith(`${ref.path}/`))
    .map((path) => snapshot({ path, id: path.split('/').at(-1) }));
  return { docs, forEach: (callback) => docs.forEach(callback) };
};
function merge(left, right) {
  const result = structuredClone(left ?? {});
  for (const [key, value] of Object.entries(right)) {
    result[key] = value && typeof value === 'object' && !Array.isArray(value)
      ? merge(result[key], value) : structuredClone(value);
  }
  return result;
}
export async function runTransaction(_database, callback) {
  const writes = [];
  await callback({
    get: async (ref) => snapshot(ref),
    set: (ref, value, options) => writes.push({ ref, value, merge: options?.merge }),
    update: (ref, value) => writes.push({ ref, value, merge: true }),
  });
  if (database.failWrite) throw new Error('Simulated failed write');
  for (const { ref, value, merge: shouldMerge } of writes) {
    records.set(ref.path, shouldMerge ? merge(records.get(ref.path), value) : structuredClone(value));
  }
  database.writes += writes.length;
}
export const setDoc = (ref, value) => runTransaction(null, async (transaction) => transaction.set(ref, value));
export async function updateDoc(ref, value) {
  if (!records.has(ref.path)) throw new Error(`Missing document ${ref.path}`);
  const updated = structuredClone(records.get(ref.path));
  for (const [path, entry] of Object.entries(value)) {
    const keys = path.split('.');
    let target = updated;
    for (const key of keys.slice(0, -1)) {
      if (!target[key] || typeof target[key] !== 'object') target[key] = {};
      target = target[key];
    }
    target[keys.at(-1)] = structuredClone(entry);
  }
  await setDoc(ref, updated);
}
export const deleteDoc = async (ref) => {
  if (database.failWrite) throw new Error('Simulated failed write');
  records.delete(ref.path);
};
export const deleteField = () => Symbol('deleteField');

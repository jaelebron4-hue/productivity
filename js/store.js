// Store central : état unique, sauvegarde automatique (localStorage),
// import/export et fusion pour la synchronisation entre appareils.
import { uid } from './utils.js';

const KEY = 'pt:data:v1';
const SCHEMA = 1;
const COLLS = ['categories', 'tasks', 'habits', 'goals'];
const TOMBSTONE_TTL = 120 * 864e5; // les suppressions sont mémorisées 120 jours
export const now = () => new Date().toISOString();

// Identifiants fixes : deux appareils neufs partagent les mêmes catégories.
export const DEFAULT_CATEGORIES = [
  { id: 'cat-work', name: 'Travail', color: '#5b5bd6' },
  { id: 'cat-personal', name: 'Personnel', color: '#10b981' },
  { id: 'cat-health', name: 'Santé', color: '#ef4444' },
  { id: 'cat-learning', name: 'Apprentissage', color: '#f59e0b' },
];

function fresh() {
  const t = '2000-01-01T00:00:00.000Z'; // ancien : n'écrase jamais une donnée réelle lors d'une fusion
  return {
    schema: SCHEMA,
    updatedAt: now(),
    settings: { theme: 'dark', name: '', updatedAt: t },
    categories: DEFAULT_CATEGORIES.map((c) => ({ ...c, createdAt: t, updatedAt: t })),
    tasks: [],
    habits: [],
    goals: [],
    deleted: {},
  };
}

/** Complète et nettoie des données (chargement, import, synchro). */
export function normalize(d) {
  const base = fresh();
  if (!d || typeof d !== 'object') return base;
  const t = now();
  const list = (k) => (Array.isArray(d[k]) ? d[k].filter((x) => x && typeof x === 'object' && x.id) : base[k]);
  const out = {
    schema: SCHEMA,
    updatedAt: d.updatedAt || t,
    settings: { ...base.settings, ...(d.settings || {}) },
    deleted: d.deleted && typeof d.deleted === 'object' ? { ...d.deleted } : {},
    categories: list('categories').map((c) => ({ color: '#5b5bd6', createdAt: t, updatedAt: t, ...c })),
    tasks: list('tasks').map((x) => ({
      title: '', notes: '', priority: 0, categoryId: null, due: null, done: false, completedAt: null,
      createdAt: t, updatedAt: t, ...x, priority: Number(x.priority) || 0,
    })),
    habits: list('habits').map((x) => ({
      name: '', icon: '✨', color: '#5b5bd6', days: [0, 1, 2, 3, 4, 5, 6], archived: false,
      createdAt: t, updatedAt: t, ...x, log: x.log && typeof x.log === 'object' ? x.log : {},
    })),
    goals: list('goals').map((x) => ({
      title: '', description: '', horizon: 'short', deadline: null, type: 'milestones', target: 100, current: 0,
      unit: '', step: 1, milestones: [], completedAt: null, categoryId: null, createdAt: t, updatedAt: t, ...x,
    })),
  };
  // Purge des anciennes pierres tombales
  const limit = Date.now() - TOMBSTONE_TTL;
  for (const [id, at] of Object.entries(out.deleted)) if (Date.parse(at) < limit) delete out.deleted[id];
  return out;
}

/* ---------------- Persistance & abonnement ---------------- */

const listeners = new Set();
let state = load();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    const s = normalize(raw ? JSON.parse(raw) : null);
    if (!raw) localStorage.setItem(KEY, JSON.stringify(s));
    return s;
  } catch (e) {
    console.error('Lecture des données impossible', e);
    return fresh();
  }
}

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch (e) {
    console.error('Sauvegarde impossible', e);
  }
}

export const getState = () => state;
export const subscribe = (fn) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};
const emit = (meta) => listeners.forEach((fn) => fn(state, meta));

/** Toute modification passe par ici : mutation → sauvegarde → notification. */
export function commit(mutator, meta = {}) {
  mutator(state);
  if (!meta.fromSync) state.updatedAt = now();
  persist();
  emit(meta);
}

// Plusieurs onglets ouverts : on suit les changements des autres.
window.addEventListener('storage', (e) => {
  if (e.key !== KEY || !e.newValue) return;
  try {
    state = normalize(JSON.parse(e.newValue));
    emit({ external: true });
  } catch { /* ignore */ }
});

/* ---------------- Opérations génériques ---------------- */

export const find = (coll, id) => state[coll].find((x) => x.id === id);

export function save(coll, item) {
  let saved;
  commit((s) => {
    const t = now();
    const i = s[coll].findIndex((x) => x.id === item.id);
    if (i >= 0) {
      saved = s[coll][i] = { ...s[coll][i], ...item, updatedAt: t };
    } else {
      saved = { createdAt: t, ...item, id: item.id || uid(), updatedAt: t };
      delete s.deleted[saved.id];
      s[coll].push(saved);
    }
  });
  return saved;
}

/** patch(coll, id, obj | (copie) => obj) */
export function patch(coll, id, p) {
  const cur = find(coll, id);
  if (!cur) return null;
  const changes = typeof p === 'function' ? p(structuredClone(cur)) : p;
  return save(coll, { ...changes, id });
}

export function remove(coll, id) {
  const item = find(coll, id);
  if (!item) return null;
  commit((s) => {
    s[coll] = s[coll].filter((x) => x.id !== id);
    s.deleted[id] = now();
    if (coll === 'categories') {
      for (const k of ['tasks', 'goals'])
        s[k] = s[k].map((x) => (x.categoryId === id ? { ...x, categoryId: null, updatedAt: now() } : x));
    }
  });
  return item;
}

export function restore(coll, item) {
  commit((s) => {
    delete s.deleted[item.id];
    s[coll] = s[coll].filter((x) => x.id !== item.id);
    s[coll].push({ ...item, updatedAt: now() });
  });
}

export function setSettings(p) {
  commit((s) => {
    s.settings = { ...s.settings, ...p, updatedAt: now() };
  });
}

/* ---------------- Opérations métier ---------------- */

export function toggleTask(id) {
  return patch('tasks', id, (t) => ({ done: !t.done, completedAt: t.done ? null : now() }));
}

export function toggleHabit(id, key) {
  return patch('habits', id, (h) => {
    const log = { ...h.log };
    if (log[key]) delete log[key];
    else log[key] = true;
    return { log };
  });
}

export function goalProgress(g) {
  if (g.type === 'numeric') return g.target > 0 ? Math.min(1, Math.max(0, (Number(g.current) || 0) / g.target)) : 0;
  const m = g.milestones || [];
  return m.length ? m.filter((x) => x.done).length / m.length : g.completedAt ? 1 : 0;
}

/** Sauvegarde un objectif en tenant à jour sa date d'achèvement. */
export function saveGoal(g) {
  const full = { ...(find('goals', g.id) || {}), ...g };
  const auto = full.type === 'numeric' || (full.milestones || []).length > 0;
  if (!auto) return save('goals', g); // sans étape : achèvement manuel conservé
  const done = goalProgress(full) >= 1;
  return save('goals', { ...g, completedAt: done ? full.completedAt || now() : null });
}

/* ---------------- Import / export / réinitialisation ---------------- */

function tombstoneMissing(s, next) {
  const keep = new Set(COLLS.flatMap((k) => next[k].map((x) => x.id)));
  const t = now();
  for (const k of COLLS) for (const x of s[k]) if (!keep.has(x.id)) next.deleted[x.id] = t;
}

function replaceState(next) {
  commit((s) => {
    tombstoneMissing(s, next);
    for (const k of Object.keys(s)) delete s[k];
    Object.assign(s, next);
  });
}

export function exportData() {
  return JSON.stringify({ app: 'productivity-tracker', exportedAt: now(), ...state }, null, 2);
}

export function importData(json, mode = 'replace') {
  let d;
  try {
    d = JSON.parse(json);
  } catch {
    throw new Error("Le fichier n'est pas un JSON valide.");
  }
  if (!d || typeof d !== 'object' || !['tasks', 'habits', 'goals'].some((k) => Array.isArray(d[k])))
    throw new Error("Ce fichier ne ressemble pas à une sauvegarde de l'application.");
  const incoming = normalize(d);
  if (mode === 'merge') {
    const merged = mergeStates(state, incoming);
    commit((s) => Object.assign(s, merged));
  } else {
    // Les éléments importés deviennent la version de référence pour la synchro.
    const t = now();
    for (const k of COLLS) incoming[k] = incoming[k].map((x) => ({ ...x, updatedAt: t }));
    incoming.settings.updatedAt = t;
    replaceState(incoming);
  }
}

export function resetAll() {
  replaceState(fresh());
}

export function loadSample(sample) {
  commit((s) => {
    for (const k of ['tasks', 'habits', 'goals']) s[k].push(...sample[k]);
  });
}

/* ---------------- Fusion (synchronisation) ---------------- */

const newer = (a, b) => (a?.updatedAt || '') > (b?.updatedAt || '');

/** Fusion élément par élément : la version la plus récente gagne, les suppressions sont respectées. */
export function mergeStates(a, b) {
  const deleted = { ...a.deleted };
  for (const [id, at] of Object.entries(b.deleted || {})) if (!deleted[id] || deleted[id] < at) deleted[id] = at;
  const out = { ...a, deleted, settings: newer(b.settings, a.settings) ? b.settings : a.settings };
  for (const k of COLLS) {
    const map = new Map();
    for (const x of [...a[k], ...(b[k] || [])]) {
      const cur = map.get(x.id);
      if (!cur || newer(x, cur)) map.set(x.id, x);
    }
    out[k] = [...map.values()].filter((x) => !deleted[x.id] || (x.updatedAt || '') > deleted[x.id]);
  }
  out.updatedAt = a.updatedAt > b.updatedAt ? a.updatedAt : b.updatedAt;
  return out;
}

// Empreinte indépendante de l'ordre des clés (pour détecter un vrai changement)
const sortKeys = (_, v) =>
  v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => (a < b ? -1 : 1))) : v;
const fingerprint = (s) => JSON.stringify([s.settings, s.deleted, ...COLLS.map((k) => s[k])], sortKeys);

/** Applique les données distantes ; renvoie true si quelque chose a changé localement. */
export function mergeRemote(remote) {
  const merged = mergeStates(state, normalize(remote));
  if (fingerprint(merged) === fingerprint(state)) return false;
  commit((s) => Object.assign(s, merged), { fromSync: true });
  return true;
}

export const sameAs = (remote) => fingerprint(normalize(remote)) === fingerprint(state);

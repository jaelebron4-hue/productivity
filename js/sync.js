// Synchronisation optionnelle entre appareils via un Gist GitHub secret.
// Gratuit, sans serveur : chaque appareil récupère, fusionne puis renvoie les données.
import { getState, subscribe, mergeRemote, sameAs } from './store.js';
import { debounce } from './utils.js';

const CFG_KEY = 'pt:sync'; // jamais exporté ni synchronisé
const FILE = 'productivity-tracker.json';
const API = 'https://api.github.com';

let cfg = loadCfg();
let status = { state: cfg.token ? 'idle' : 'off', message: '', at: cfg.lastSync || null };
const statusListeners = new Set();
let running = false;
let again = false;

function loadCfg() {
  try {
    return JSON.parse(localStorage.getItem(CFG_KEY)) || {};
  } catch {
    return {};
  }
}
function saveCfg(p) {
  cfg = { ...cfg, ...p };
  localStorage.setItem(CFG_KEY, JSON.stringify(cfg));
}

export const getSyncConfig = () => ({ ...cfg });
export const getSyncStatus = () => ({ ...status });
export const onSyncStatus = (fn) => {
  statusListeners.add(fn);
  return () => statusListeners.delete(fn);
};
function setStatus(state, message = '') {
  status = { state, message, at: cfg.lastSync || null };
  statusListeners.forEach((fn) => fn(status));
}

async function gh(path, opts = {}) {
  const res = await fetch(API + path, {
    ...opts,
    cache: 'no-store',
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${cfg.token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      ...(opts.body ? { 'Content-Type': 'application/json' } : {}),
    },
  });
  if (!res.ok) {
    if (res.status === 401) throw new Error('Jeton invalide ou expiré.');
    if (res.status === 403) throw new Error('Accès refusé : le jeton doit avoir la permission « gist ».');
    if (res.status === 404) throw new Error('Gist introuvable.');
    throw new Error(`Erreur GitHub (${res.status}).`);
  }
  return res.status === 204 ? null : res.json();
}

async function readRemote() {
  if (!cfg.gistId) {
    // Un autre appareil a peut-être déjà créé le Gist : on le retrouve.
    const list = await gh('/gists?per_page=100');
    const found = list.find((g) => g.files && g.files[FILE]);
    if (found) saveCfg({ gistId: found.id });
  }
  if (!cfg.gistId) return null;
  const g = await gh(`/gists/${cfg.gistId}`);
  const f = g.files?.[FILE];
  if (!f) return null;
  const content = f.truncated ? await (await fetch(f.raw_url, { cache: 'no-store' })).text() : f.content;
  return JSON.parse(content);
}

async function writeRemote() {
  const files = { [FILE]: { content: JSON.stringify(getState()) } };
  const description = 'Productivity Tracker — données synchronisées';
  if (cfg.gistId) await gh(`/gists/${cfg.gistId}`, { method: 'PATCH', body: JSON.stringify({ files, description }) });
  else {
    const g = await gh('/gists', { method: 'POST', body: JSON.stringify({ files, description, public: false }) });
    saveCfg({ gistId: g.id });
  }
}

/** Récupère → fusionne → renvoie si nécessaire. */
export async function syncNow() {
  if (!cfg.token) return;
  if (!navigator.onLine) return setStatus('offline', 'Hors ligne');
  if (running) {
    again = true;
    return;
  }
  running = true;
  setStatus('syncing');
  try {
    let remote = null;
    try {
      remote = await readRemote();
    } catch (e) {
      if (e.message !== 'Gist introuvable.') throw e;
      saveCfg({ gistId: '' });
    }
    if (remote) mergeRemote(remote);
    if (!remote || !sameAs(remote)) await writeRemote();
    saveCfg({ lastSync: new Date().toISOString() });
    setStatus('ok');
  } catch (e) {
    console.warn('Synchronisation :', e);
    setStatus('error', e.message || 'Échec de la synchronisation');
  } finally {
    running = false;
    if (again) {
      again = false;
      syncNow();
    }
  }
}

export async function connect(token, gistId = '') {
  saveCfg({ token: token.trim(), gistId: gistId.trim(), lastSync: null });
  await syncNow();
  if (status.state === 'error') throw new Error(status.message);
}

export function disconnect() {
  localStorage.removeItem(CFG_KEY);
  cfg = {};
  setStatus('off');
}

const schedule = debounce(syncNow, 3000);

export function initSync() {
  subscribe((_, meta) => {
    if (cfg.token && !meta.fromSync && !meta.external) schedule();
  });
  syncNow();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && Date.now() - Date.parse(cfg.lastSync || 0) > 20000) syncNow();
  });
  window.addEventListener('online', syncNow);
}

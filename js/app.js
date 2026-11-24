// Point d'entrée : coquille de l'application, routage, thème, raccourcis, PWA.
import { getState, subscribe, setSettings } from './store.js';
import { icon } from './icons.js';
import { bus } from './bus.js';
import { initTooltip, hasModal } from './ui.js';
import { resetCharts, hydrateCharts } from './charts.js';
import { initSync, onSyncStatus, getSyncStatus } from './sync.js';
import { dateKey } from './utils.js';
import dashboard from './views/dashboard.js';
import tasks from './views/tasks.js';
import habits from './views/habits.js';
import goals from './views/goals.js';
import stats from './views/stats.js';
import settings from './views/settings.js';

const ROUTES = { dashboard, tasks, habits, goals, stats, settings };
const NAV = [
  ['dashboard', 'Dashboard', 'home'],
  ['tasks', 'Tâches', 'tasks'],
  ['habits', 'Habitudes', 'flame'],
  ['goals', 'Objectifs', 'target'],
  ['stats', 'Statistiques', 'chart'],
];

const route = () => {
  const r = location.hash.replace(/^#\/?/, '').split('?')[0];
  return ROUTES[r] ? r : 'dashboard';
};

/* ---------------- Coquille ---------------- */
function shell() {
  const nav = (cls) => NAV.map(([id, label, ic], i) => `
    <a href="#/${id}" class="${cls}" data-route="${id}">${icon(ic, cls === 'tab' ? 22 : 18)}<span>${label}</span>${cls === 'nav-item' ? `<kbd>${i + 1}</kbd>` : ''}</a>`).join('');
  document.getElementById('app').innerHTML = `
    <aside class="sidebar">
      <div class="brand"><span class="logo">${icon('check', 16)}</span><span>Productivity</span></div>
      <nav class="nav">${nav('nav-item')}</nav>
      <div class="sidebar-foot">
        <a href="#/settings" class="nav-item" data-route="settings">${icon('settings', 18)}<span>Réglages</span></a>
        <div class="sidebar-row">
          <span class="sync-pill" id="sync-pill" hidden></span>
          <button class="icon-btn" id="theme-toggle" aria-label="Changer de thème"></button>
        </div>
      </div>
    </aside>
    <div class="main-wrap">
      <header class="topbar">
        <div class="brand"><span class="logo">${icon('check', 14)}</span><span id="topbar-title">Productivity</span></div>
        <div class="topbar-actions">
          <span class="sync-pill" id="sync-pill-m" hidden></span>
          <button class="icon-btn" id="theme-toggle-m" aria-label="Changer de thème"></button>
          <a href="#/settings" class="icon-btn" data-route="settings" aria-label="Réglages">${icon('settings', 20)}</a>
        </div>
      </header>
      <main id="view" class="main" tabindex="-1"></main>
    </div>
    <nav class="tabbar">${nav('tab')}</nav>`;
}

/* ---------------- Rendu ---------------- */
let currentRoute = null;
let pending = false;

function render() {
  pending = false;
  const r = route();
  const mod = ROUTES[r];
  const main = document.getElementById('view');
  const changed = r !== currentRoute;

  // Conserve le focus (ex. champ de recherche) entre deux rendus
  const active = document.activeElement;
  const focusId = !changed && active && main.contains(active) && active.id ? active.id : null;
  const sel = focusId && 'selectionStart' in active ? [active.selectionStart, active.selectionEnd] : null;

  resetCharts();
  const el = document.createElement('div');
  el.className = `view view-${r}`;
  mod.render(el);
  main.replaceChildren(el);
  hydrateCharts(el);

  if (focusId) {
    const n = document.getElementById(focusId);
    if (n) {
      if ('value' in n && n.tagName !== 'SELECT' && n.value !== active.value) n.value = active.value;
      n.focus({ preventScroll: true });
      try { if (sel) n.setSelectionRange(...sel); } catch { /* type sans sélection */ }
    }
  }
  if (changed) {
    currentRoute = r;
    window.scrollTo(0, 0);
    document.querySelectorAll('[data-route]').forEach((a) => a.classList.toggle('active', a.dataset.route === r));
    document.title = `${mod.title} · Productivity`;
    document.getElementById('topbar-title').textContent = mod.title;
  }
}

function requestRender() {
  if (pending) return;
  pending = true;
  requestAnimationFrame(render);
}
bus.render = requestRender;

/* ---------------- Thème ---------------- */
const mq = matchMedia('(prefers-color-scheme: dark)');
function applyTheme() {
  const pref = getState().settings.theme || 'dark';
  const theme = pref === 'system' ? (mq.matches ? 'dark' : 'light') : pref;
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]').setAttribute('content', theme === 'dark' ? '#000000' : '#fafafa');
  const next = { system: 'light', light: 'dark', dark: 'system' }[pref];
  const ic = icon(pref === 'system' ? 'monitor' : pref === 'dark' ? 'moon' : 'sun', 18);
  for (const id of ['theme-toggle', 'theme-toggle-m']) {
    const b = document.getElementById(id);
    b.innerHTML = ic;
    b.dataset.tip = `Thème : ${{ system: 'automatique', light: 'clair', dark: 'sombre' }[pref]}`;
    b.onclick = () => setSettings({ theme: next });
  }
}
mq.addEventListener('change', applyTheme);

/* ---------------- Statut de synchro ---------------- */
function paintSync(st = getSyncStatus()) {
  const labels = { syncing: 'Synchro…', ok: 'Synchronisé', error: 'Erreur synchro', offline: 'Hors ligne', idle: 'Synchro' };
  for (const id of ['sync-pill', 'sync-pill-m']) {
    const p = document.getElementById(id);
    p.hidden = st.state === 'off';
    p.className = `sync-pill ${st.state}`;
    p.innerHTML = `<span class="sync-dot"></span><span class="sync-text">${labels[st.state] || ''}</span>`;
    p.dataset.tip = st.message || labels[st.state] || '';
  }
  // Rafraîchit la carte de synchro des réglages (sans perturber une saisie de jeton)
  const body = document.getElementById('sync-body');
  if (body && !body.querySelector('#sync-form')) requestRender();
}

/* ---------------- Raccourcis clavier ---------------- */
function shortcuts(e) {
  if (e.metaKey || e.ctrlKey || e.altKey || hasModal()) return;
  const tag = e.target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || e.target.isContentEditable) {
    if (e.key === 'Escape') e.target.blur();
    return;
  }
  if (/^[1-5]$/.test(e.key)) location.hash = `#/${NAV[Number(e.key) - 1][0]}`;
  else if (e.key === 'n' || e.key === 'N') {
    e.preventDefault();
    ROUTES[route()].onNew?.();
  } else if (e.key === '/') {
    const s = document.querySelector('#task-search');
    if (s) {
      e.preventDefault();
      s.focus();
    } else if (route() !== 'tasks') {
      e.preventDefault();
      location.hash = '#/tasks';
      setTimeout(() => document.querySelector('#task-search')?.focus(), 50);
    }
  }
}

/* ---------------- Démarrage ---------------- */
shell();
applyTheme();
initTooltip();
render();

window.addEventListener('hashchange', render);
document.addEventListener('keydown', shortcuts);
subscribe((_, meta) => {
  applyTheme();
  requestRender();
  if (!meta.fromSync) flashSaved();
});
onSyncStatus(paintSync);
paintSync();
initSync();

// Changement de jour pendant que l'app est ouverte
let lastDay = dateKey();
setInterval(() => {
  if (dateKey() !== lastDay) {
    lastDay = dateKey();
    requestRender();
  }
}, 60000);
document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && requestRender());

// Indicateur discret de sauvegarde automatique
let savedTimer;
function flashSaved() {
  let el = document.getElementById('saved-flag');
  if (!el) {
    el = document.createElement('div');
    el.id = 'saved-flag';
    el.className = 'saved-flag';
    el.innerHTML = `${icon('check', 12)} Enregistré`;
    document.body.append(el);
  }
  el.classList.add('show');
  clearTimeout(savedTimer);
  savedTimer = setTimeout(() => el.classList.remove('show'), 1200);
}

// Demande un stockage persistant (limite l'effacement automatique par le navigateur)
navigator.storage?.persist?.().catch(() => {});

// PWA : service worker (hors développement local pour éviter le cache pendant le dev)
if ('serviceWorker' in navigator && !['localhost', '127.0.0.1'].includes(location.hostname)) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch((e) => console.warn('SW', e)));
}

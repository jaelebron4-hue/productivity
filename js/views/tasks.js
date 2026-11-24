import { getState, save } from '../store.js';
import { esc, dateKey, addDays, norm, plural, safeColor, keyOfIso } from '../utils.js';
import { icon } from '../icons.js';
import { isOverdue, today } from '../domain.js';
import { taskRow, emptyState, handleCommon } from '../components.js';
import { openTaskEditor } from '../editors.js';
import { bus } from '../bus.js';
import { toast } from '../ui.js';

const view = { filter: 'all', q: '', cat: '', sort: 'smart' };

const FILTERS = [
  ['all', 'À faire'],
  ['today', "Aujourd'hui"],
  ['upcoming', 'À venir'],
  ['overdue', 'En retard'],
  ['done', 'Terminées'],
];
const SORTS = [
  ['smart', 'Échéance'],
  ['priority', 'Priorité'],
  ['created', 'Récentes'],
  ['title', 'Alphabétique'],
];

const WEEKDAY_WORDS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];

/** Saisie rapide : "Appeler Paul demain #perso !!!" */
export function parseQuick(text, categories) {
  let title = ` ${text} `;
  let priority = 0;
  let due = null;
  let categoryId = null;
  title = title.replace(/\s(!{1,3})(?=\s)/, (_, b) => {
    priority = b.length;
    return ' ';
  });
  title = title.replace(/\s#([\p{L}\p{N}_-]+)(?=\s)/u, (m, name) => {
    const c = categories.find((x) => norm(x.name).startsWith(norm(name)));
    if (!c) return m;
    categoryId = c.id;
    return ' ';
  });
  title = title.replace(/\s(aujourd'hui|aujourd’hui|auj|demain|après-demain|apres-demain|lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)(?=\s)/i, (_, w) => {
    const word = norm(w);
    const nowD = new Date();
    if (word.startsWith('auj')) due = dateKey(nowD);
    else if (word === 'demain') due = dateKey(addDays(nowD, 1));
    else if (word.includes('demain')) due = dateKey(addDays(nowD, 2));
    else {
      const target = WEEKDAY_WORDS.indexOf(word);
      due = dateKey(addDays(nowD, ((target - nowD.getDay() + 7) % 7) || 7));
    }
    return ' ';
  });
  return { title: title.replace(/\s+/g, ' ').trim(), priority, due, categoryId };
}

function counts(tasks) {
  const k = today();
  return {
    all: tasks.filter((t) => !t.done).length,
    today: tasks.filter((t) => !t.done && t.due && t.due <= k).length,
    upcoming: tasks.filter((t) => !t.done && t.due && t.due > k).length,
    overdue: tasks.filter(isOverdue).length,
    done: tasks.filter((t) => t.done).length,
  };
}

const cmpDue = (a, b) => (a.due ? 0 : 1) - (b.due ? 0 : 1) || (a.due || '').localeCompare(b.due || '');
const SORTERS = {
  smart: (a, b) => a.done - b.done || cmpDue(a, b) || b.priority - a.priority || a.createdAt.localeCompare(b.createdAt),
  priority: (a, b) => a.done - b.done || b.priority - a.priority || cmpDue(a, b),
  created: (a, b) => b.createdAt.localeCompare(a.createdAt),
  title: (a, b) => a.title.localeCompare(b.title, 'fr'),
};

function filtered(tasks) {
  const k = today();
  const F = {
    all: (t) => !t.done,
    today: (t) => (!t.done && t.due && t.due <= k) || (t.done && keyOfIso(t.completedAt) === k),
    upcoming: (t) => !t.done && t.due && t.due > k,
    overdue: isOverdue,
    done: (t) => t.done,
  };
  let list = tasks.filter(F[view.filter]);
  if (view.cat) list = list.filter((t) => t.categoryId === view.cat);
  if (view.q) {
    const q = norm(view.q);
    list = list.filter((t) => norm(`${t.title} ${t.notes}`).includes(q));
  }
  list.sort(SORTERS[view.sort]);
  if (view.filter === 'done' && view.sort === 'smart') list.sort((a, b) => (b.completedAt || '').localeCompare(a.completedAt || ''));
  return list;
}

function groups(list) {
  const k = today();
  const k1 = dateKey(addDays(new Date(), 1));
  const k7 = dateKey(addDays(new Date(), 7));
  return [
    ['En retard', (t) => t.due && t.due < k, 'danger'],
    ["Aujourd'hui", (t) => t.due === k, 'accent'],
    ['Demain', (t) => t.due === k1],
    ['7 prochains jours', (t) => t.due > k1 && t.due <= k7],
    ['Plus tard', (t) => t.due > k7],
    ['Sans échéance', (t) => !t.due],
  ]
    .map(([label, fn, tone]) => ({ label, tone, items: list.filter(fn) }))
    .filter((g) => g.items.length);
}

export default {
  title: 'Tâches',
  onNew: () => openTaskEditor(null, view.filter === 'today' ? { due: today() } : view.cat ? { categoryId: view.cat } : {}),
  render(el) {
    const s = getState();
    const c = counts(s.tasks);
    const list = filtered(s.tasks);
    const grouped = view.filter === 'all' && view.sort === 'smart';
    const row = (t) => taskRow(t, s.categories);

    let body;
    if (!list.length) {
      body = view.q || view.cat
        ? emptyState('search', 'Aucun résultat', 'Essayez un autre filtre ou une autre recherche.')
        : view.filter === 'done' ? emptyState('check', 'Aucune tâche terminée', 'Vos tâches accomplies apparaîtront ici.')
        : emptyState('check', 'Tout est sous contrôle', 'Aucune tâche dans cette vue.', `<button class="btn btn-sm" data-action="new-task">${icon('plus', 16)}<span>Nouvelle tâche</span></button>`);
    } else if (grouped) {
      body = groups(list).map((g) => `<div class="group">
        <div class="group-head ${g.tone || ''}">${g.label}<span>${g.items.length}</span></div>${g.items.map(row).join('')}</div>`).join('');
    } else body = `<div class="group">${list.map(row).join('')}</div>`;

    el.innerHTML = `
    <header class="page-head">
      <div><h1>Tâches</h1>
        <p class="sub">${plural(c.all, 'tâche à faire', 'tâches à faire')}${c.overdue ? ` · <span class="danger">${c.overdue} en retard</span>` : ''}</p></div>
      <button class="btn btn-primary" data-action="new-task-ctx">${icon('plus')}<span>Nouvelle tâche</span></button>
    </header>

    <form class="quick-add" id="quick-add">
      ${icon('plus', 18)}
      <input id="quick-input" class="quick-input" placeholder="Ajouter une tâche…  (demain, #catégorie, !!! pour la priorité)" autocomplete="off" enterkeyhint="done" aria-label="Ajout rapide">
      <kbd class="hide-mobile">Entrée</kbd>
    </form>

    <div class="toolbar">
      <div class="seg seg-scroll" role="tablist">
        ${FILTERS.map(([id, l]) => `<button class="seg-btn ${view.filter === id ? 'active' : ''}" data-filter="${id}" role="tab" aria-selected="${view.filter === id}">${l}<span class="count">${c[id]}</span></button>`).join('')}
      </div>
      <div class="toolbar-right">
        <label class="search">${icon('search', 16)}<input id="task-search" type="search" placeholder="Rechercher" value="${esc(view.q)}" aria-label="Rechercher"></label>
        <select id="task-sort" class="input input-sm" aria-label="Trier">${SORTS.map(([v, l]) => `<option value="${v}" ${view.sort === v ? 'selected' : ''}>${l}</option>`).join('')}</select>
      </div>
    </div>

    <div class="chips chips-scroll">
      <button class="chip ${!view.cat ? 'active' : ''}" data-cat="">Toutes</button>
      ${s.categories.map((ct) => `<button class="chip ${view.cat === ct.id ? 'active' : ''}" data-cat="${ct.id}"><i class="dot" style="background:${safeColor(ct.color)}"></i>${esc(ct.name)}</button>`).join('')}
    </div>

    <section class="card list-card">${body}</section>`;

    el.addEventListener('click', (e) => {
      if (e.target.closest('[data-action="new-task-ctx"]')) return this.onNew();
      if (handleCommon(e)) return;
      const f = e.target.closest('[data-filter]');
      if (f) {
        view.filter = f.dataset.filter;
        return bus.render();
      }
      const ch = e.target.closest('[data-cat]');
      if (ch) {
        view.cat = ch.dataset.cat;
        bus.render();
      }
    });
    el.querySelector('#task-search').addEventListener('input', (e) => {
      view.q = e.target.value;
      bus.render();
    });
    el.querySelector('#task-sort').addEventListener('change', (e) => {
      view.sort = e.target.value;
      bus.render();
    });
    el.querySelector('#quick-add').addEventListener('submit', (e) => {
      e.preventDefault();
      const input = el.querySelector('#quick-input');
      const p = parseQuick(input.value, s.categories);
      if (!p.title) return;
      if (!p.due && view.filter === 'today') p.due = today();
      if (!p.categoryId && view.cat) p.categoryId = view.cat;
      input.value = '';
      save('tasks', { ...p, notes: '', done: false, completedAt: null });
      if (view.filter === 'overdue' || view.filter === 'done' || (view.filter === 'upcoming' && !(p.due > today())))
        toast('Tâche ajoutée (hors de ce filtre)');
    });
  },
};

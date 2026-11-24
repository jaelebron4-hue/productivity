import { getState, find, save, saveGoal, goalProgress } from '../store.js';
import { esc, fmt, relDeadline, pct, safeColor, parseKey, plural } from '../utils.js';
import { icon } from '../icons.js';
import { today } from '../domain.js';
import { progressBar, emptyState, handleCommon } from '../components.js';
import { ring } from '../charts.js';
import { openGoalEditor } from '../editors.js';
import { bus } from '../bus.js';
import { toast } from '../ui.js';

const view = { tab: 'active' };
const TABS = [
  ['active', 'En cours'],
  ['short', 'Court terme'],
  ['long', 'Long terme'],
  ['done', 'Atteints'],
];

const num = (v) => (Number.isInteger(v) ? v : Math.round(v * 100) / 100).toLocaleString('fr-FR');

function goalCard(g, categories) {
  const p = goalProgress(g);
  const cat = categories.find((c) => c.id === g.categoryId);
  const color = cat ? safeColor(cat.color) : 'var(--neutral)';
  const late = g.deadline && !g.completedAt && g.deadline < today();
  const shown = g.milestones.slice(0, 6);
  return `<article class="card goal ${g.completedAt ? 'is-done' : ''}" style="--c:${color}">
    <div class="goal-top">
      <span class="badge">${g.horizon === 'long' ? 'Long terme' : 'Court terme'}</span>
      ${cat ? `<span class="meta"><i class="dot" style="background:${color}"></i>${esc(cat.name)}</span>` : ''}
      <span class="spacer"></span>
      <button class="icon-btn" data-edit="${g.id}" aria-label="Modifier">${icon('edit', 16)}</button>
    </div>
    <div class="goal-main">
      ${ring(p, 64, 7, `<b class="small">${pct(p)}</b>`, color)}
      <div class="goal-text"><h3>${esc(g.title)}</h3>${g.description ? `<p class="muted">${esc(g.description)}</p>` : ''}</div>
    </div>
    ${g.type === 'numeric' ? `
      <div class="goal-num">
        <button class="icon-btn bordered" data-dec="${g.id}" aria-label="Diminuer">${icon('minus', 16)}</button>
        <div class="goal-num-val"><b>${num(g.current)}</b> / ${num(g.target)} ${esc(g.unit)}</div>
        <button class="icon-btn bordered" data-inc="${g.id}" aria-label="Augmenter">${icon('plus', 16)}</button>
      </div>
      ${progressBar(p, color)}`
    : g.milestones.length ? `<ul class="milestones">${shown.map((m) => `<li>
        <button class="mini-check ${m.done ? 'on' : ''}" data-ms="${m.id}" data-goal="${g.id}" aria-pressed="${m.done}" aria-label="${esc(m.title)}">${icon('check', 12)}</button>
        <span class="${m.done ? 'struck' : ''}">${esc(m.title)}</span></li>`).join('')}
        ${g.milestones.length > shown.length ? `<li class="muted small">+ ${g.milestones.length - shown.length} autres étapes</li>` : ''}</ul>`
    : `<p class="muted small">Aucune étape. <button class="link" data-edit="${g.id}">Ajouter des étapes</button> ou
        ${g.completedAt ? `<button class="link" data-reopen="${g.id}">rouvrir</button>` : `<button class="link" data-complete="${g.id}">marquer comme atteint</button>`}</p>`}
    <div class="goal-foot">
      ${g.completedAt ? `<span class="meta success">${icon('check', 13)}Atteint le ${fmt(new Date(g.completedAt), { day: 'numeric', month: 'short', year: 'numeric' })}</span>`
      : g.deadline ? `<span class="meta ${late ? 'danger' : ''}">${icon('clock', 13)}${relDeadline(g.deadline)} · ${fmt(parseKey(g.deadline), { day: 'numeric', month: 'short', year: 'numeric' })}</span>`
      : '<span class="meta">Sans date cible</span>'}
      ${g.type === 'milestones' && g.milestones.length ? `<span class="meta">${g.milestones.filter((m) => m.done).length}/${g.milestones.length} étapes</span>` : ''}
    </div>
  </article>`;
}

export default {
  title: 'Objectifs',
  onNew: () => openGoalEditor(),
  render(el) {
    const s = getState();
    const F = {
      active: (g) => !g.completedAt,
      short: (g) => !g.completedAt && g.horizon === 'short',
      long: (g) => !g.completedAt && g.horizon === 'long',
      done: (g) => !!g.completedAt,
    };
    const counts = Object.fromEntries(TABS.map(([id]) => [id, s.goals.filter(F[id]).length]));
    const list = s.goals
      .filter(F[view.tab])
      .sort((a, b) => (view.tab === 'done'
        ? (b.completedAt || '').localeCompare(a.completedAt || '')
        : (a.deadline || '9999').localeCompare(b.deadline || '9999')));
    const active = s.goals.filter(F.active);
    const avg = active.length ? active.reduce((a, g) => a + goalProgress(g), 0) / active.length : 0;

    el.innerHTML = `
    <header class="page-head">
      <div><h1>Objectifs</h1><p class="sub">${plural(active.length, 'objectif en cours', 'objectifs en cours')} · progression moyenne ${pct(avg)}</p></div>
      <button class="btn btn-primary" data-action="new-goal">${icon('plus')}<span>Nouvel objectif</span></button>
    </header>
    <div class="toolbar"><div class="seg seg-scroll">${TABS.map(([id, l]) => `<button class="seg-btn ${view.tab === id ? 'active' : ''}" data-tab="${id}">${l}<span class="count">${counts[id]}</span></button>`).join('')}</div></div>
    ${list.length ? `<div class="goal-grid">${list.map((g) => goalCard(g, s.categories)).join('')}</div>`
      : `<section class="card">${emptyState('target', view.tab === 'done' ? 'Aucun objectif atteint pour l’instant' : 'Aucun objectif ici',
        view.tab === 'done' ? 'Ils apparaîtront ici une fois terminés.' : 'Fixez un cap : un objectif clair, une date, des étapes.',
        view.tab === 'done' ? '' : `<button class="btn btn-primary btn-sm" data-action="new-goal">${icon('plus', 16)}<span>Nouvel objectif</span></button>`)}</section>`}`;

    el.addEventListener('click', (e) => {
      const t = e.target;
      const tab = t.closest('[data-tab]');
      if (tab) {
        view.tab = tab.dataset.tab;
        return bus.render();
      }
      const ed = t.closest('[data-edit]');
      if (ed) return openGoalEditor(find('goals', ed.dataset.edit));
      const step = t.closest('[data-inc],[data-dec]');
      if (step) {
        const g = find('goals', step.dataset.inc || step.dataset.dec);
        const delta = (g.step || 1) * (step.dataset.inc ? 1 : -1);
        const wasDone = !!g.completedAt;
        const current = Math.max(0, Math.round((Number(g.current) + delta) * 1000) / 1000);
        const saved = saveGoal({ id: g.id, current });
        if (!wasDone && saved.completedAt) toast('Objectif atteint ! 🎉');
        return;
      }
      const ms = t.closest('[data-ms]');
      if (ms) {
        const g = find('goals', ms.dataset.goal);
        const wasDone = !!g.completedAt;
        const saved = saveGoal({ id: g.id, milestones: g.milestones.map((m) => (m.id === ms.dataset.ms ? { ...m, done: !m.done } : m)) });
        if (!wasDone && saved.completedAt) toast('Objectif atteint ! 🎉');
        return;
      }
      // Objectif sans étape : achèvement / réouverture manuels
      const cp = t.closest('[data-complete]');
      if (cp) {
        save('goals', { id: cp.dataset.complete, completedAt: new Date().toISOString() });
        return toast('Objectif atteint ! 🎉');
      }
      const ro = t.closest('[data-reopen]');
      if (ro) return save('goals', { id: ro.dataset.reopen, completedAt: null });
      handleCommon(e);
    });
  },
};

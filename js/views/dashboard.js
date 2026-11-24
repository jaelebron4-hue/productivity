import { getState, save, goalProgress, loadSample } from '../store.js';
import { esc, fmt, cap, dateKey, addDays, startOfWeek, pct, relDeadline, safeColor, plural } from '../utils.js';
import { icon } from '../icons.js';
import { today, todayTasks, isOverdue, activeHabits, isDue, currentStreak, tasksDoneOn, habitsOn } from '../domain.js';
import { taskRow, progressBar, emptyState, handleCommon } from '../components.js';
import { chart, ring } from '../charts.js';
import { openTaskEditor } from '../editors.js';
import { buildSample } from '../seed.js';
import { toast } from '../ui.js';

function greeting(name) {
  const h = new Date().getHours();
  const g = h < 5 ? 'Bonne nuit' : h < 12 ? 'Bonjour' : h < 18 ? 'Bon après-midi' : 'Bonsoir';
  return name ? `${g}, ${esc(name)}` : g;
}

export default {
  title: 'Dashboard',
  onNew: () => openTaskEditor(null, { due: today() }),
  render(el) {
    const s = getState();
    const k = today();
    const now = new Date();
    const habits = activeHabits(s);
    const todaysHabits = habits.filter((h) => isDue(h, now));
    const habitsDone = todaysHabits.filter((h) => h.log[k]).length;
    const { open, doneToday } = todayTasks(s.tasks);
    const overdue = open.filter(isOverdue);
    const total = open.length + doneToday.length + todaysHabits.length;
    const done = doneToday.length + habitsDone;
    const progress = total ? done / total : 0;
    const activeGoals = s.goals.filter((g) => !g.completedAt);
    const avgGoal = activeGoals.length ? activeGoals.reduce((a, g) => a + goalProgress(g), 0) / activeGoals.length : 0;
    const bestActive = habits.reduce((m, h) => Math.max(m, currentStreak(h)), 0);
    const isEmpty = !s.tasks.length && !s.habits.length && !s.goals.length;

    const upcoming = s.tasks
      .filter((t) => !t.done && t.due && t.due > k)
      .sort((a, b) => a.due.localeCompare(b.due) || b.priority - a.priority)
      .slice(0, 3);
    const todayList = [...open].sort((a, b) => a.due.localeCompare(b.due) || b.priority - a.priority);

    // Semaine en cours
    const ws = startOfWeek(now);
    const week = Array.from({ length: 7 }, (_, i) => addDays(ws, i));
    const weekVals = week.map((d) => tasksDoneOn(s.tasks, dateKey(d)));
    const weekHabit = week.map((d) => habitsOn(habits, d));

    const message =
      total === 0 ? 'Rien de prévu aujourd’hui. Profitez-en pour planifier.'
      : progress >= 1 ? 'Tout est fait. Superbe journée ! 🎉'
      : progress >= 0.5 ? 'Plus de la moitié est faite, continuez.'
      : 'Une chose à la fois. Vous allez y arriver.';

    el.innerHTML = `
    <header class="page-head">
      <div>
        <p class="eyebrow">${cap(fmt(now, { weekday: 'long', day: 'numeric', month: 'long' }))}</p>
        <h1>${greeting(s.settings.name)}</h1>
      </div>
      <button class="btn btn-primary" data-action="new-task" data-due="${k}">${icon('plus')}<span>Tâche</span></button>
    </header>

    ${isEmpty ? `<section class="card welcome">
        <div class="welcome-icon">${icon('sparkles', 22)}</div>
        <div><h2>Bienvenue 👋</h2>
        <p class="muted">Commencez par créer une tâche, une habitude ou un objectif. Vous pouvez aussi charger des données d’exemple pour explorer l’application.</p></div>
        <div class="welcome-actions">
          <button class="btn btn-primary" data-action="new-task" data-due="${k}">${icon('plus')}<span>Première tâche</span></button>
          <button class="btn" data-sample>${icon('sparkles')}<span>Données d’exemple</span></button>
        </div></section>` : ''}

    <div class="grid">
      <section class="card hero span-12">
        ${ring(progress, 132, 12, `<b>${pct(progress)}</b><span>du jour</span>`)}
        <div class="hero-body">
          <h2>Progression du jour</h2>
          <p class="muted">${message}</p>
          <div class="hero-pills">
            <span class="pill">${icon('tasks', 14)} ${doneToday.length}/${doneToday.length + open.length} tâches</span>
            <span class="pill">${icon('flame', 14)} ${habitsDone}/${todaysHabits.length} habitudes</span>
          </div>
        </div>
        <div class="kpis">
          <button class="kpi" data-action="go" data-to="tasks"><span class="kpi-label">Restantes</span><b>${open.length}</b><span class="kpi-sub ${overdue.length ? 'danger' : ''}">${overdue.length ? `${overdue.length} en retard` : 'à faire aujourd’hui'}</span></button>
          <button class="kpi" data-action="go" data-to="habits"><span class="kpi-label">Meilleure série</span><b>${bestActive}<small> j</small></b><span class="kpi-sub">en cours</span></button>
          <button class="kpi" data-action="go" data-to="goals"><span class="kpi-label">Objectifs</span><b>${pct(avgGoal)}</b><span class="kpi-sub">${plural(activeGoals.length, 'actif', 'actifs')}</span></button>
          <button class="kpi" data-action="go" data-to="stats"><span class="kpi-label">Cette semaine</span><b>${weekVals.reduce((a, b) => a + b, 0)}</b><span class="kpi-sub">tâches terminées</span></button>
        </div>
      </section>

      <section class="card span-7">
        <div class="card-head"><h3>Aujourd’hui</h3><button class="link" data-action="go" data-to="tasks">Tout voir ${icon('right', 14)}</button></div>
        <form class="quick-add quick-add-sm" id="dash-quick">${icon('plus', 16)}<input id="dash-quick-input" class="quick-input" placeholder="Ajouter une tâche pour aujourd’hui…" autocomplete="off" enterkeyhint="done"></form>
        <div class="task-list">
          ${todayList.length || doneToday.length
            ? todayList.map((t) => taskRow(t, s.categories, { compact: true })).join('') + doneToday.map((t) => taskRow(t, s.categories, { compact: true })).join('')
            : emptyState('check', 'Aucune tâche pour aujourd’hui', 'Ajoutez-en une ci-dessus.')}
        </div>
        ${upcoming.length ? `<div class="subhead">À venir</div><div class="task-list">${upcoming.map((t) => taskRow(t, s.categories, { compact: true })).join('')}</div>` : ''}
      </section>

      <section class="card span-5">
        <div class="card-head"><h3>Habitudes du jour</h3><button class="link" data-action="go" data-to="habits">Gérer ${icon('right', 14)}</button></div>
        ${todaysHabits.length ? `<div class="habit-today">${todaysHabits.map((h) => {
          const on = !!h.log[k];
          return `<button class="habit-chip ${on ? 'on' : ''}" style="--c:${safeColor(h.color)}" data-action="toggle-habit" data-id="${h.id}" aria-pressed="${on}">
            <span class="habit-icon">${esc(h.icon)}</span>
            <span class="habit-chip-body"><span class="habit-name">${esc(h.name)}</span><span class="habit-sub">${icon('flame', 12)} ${currentStreak(h)} j</span></span>
            <span class="habit-check">${icon('check', 14)}</span></button>`;
        }).join('')}</div>`
        : emptyState('flame', 'Aucune habitude aujourd’hui', '', `<button class="btn btn-sm" data-action="new-habit">${icon('plus', 16)}<span>Créer une habitude</span></button>`)}
      </section>

      <section class="card span-7">
        <div class="card-head"><h3>Cette semaine</h3><span class="muted small">Tâches terminées</span></div>
        ${chart({
          type: 'bar', height: 190,
          labels: week.map((d) => cap(fmt(d, { weekday: 'short' }).replace('.', ''))),
          values: weekVals,
          highlight: week.findIndex((d) => dateKey(d) === k),
          tips: week.map((d, i) => `${cap(fmt(d, { weekday: 'long', day: 'numeric' }))} : ${weekVals[i]} tâche(s), ${weekHabit[i].done}/${weekHabit[i].due} habitude(s)`),
        })}
      </section>

      <section class="card span-5">
        <div class="card-head"><h3>Objectifs en cours</h3><button class="link" data-action="go" data-to="goals">Tous ${icon('right', 14)}</button></div>
        ${activeGoals.length ? `<div class="goal-mini-list">${[...activeGoals]
          .sort((a, b) => (a.deadline || '9999').localeCompare(b.deadline || '9999'))
          .slice(0, 4)
          .map((g) => `<button class="goal-mini" data-action="go" data-to="goals">
            <span class="goal-mini-top"><span class="goal-mini-title">${esc(g.title)}</span><b>${pct(goalProgress(g))}</b></span>
            ${progressBar(goalProgress(g))}
            ${g.deadline ? `<span class="muted small">${relDeadline(g.deadline)}</span>` : ''}
          </button>`).join('')}</div>`
        : emptyState('target', 'Aucun objectif actif', '', `<button class="btn btn-sm" data-action="new-goal">${icon('plus', 16)}<span>Définir un objectif</span></button>`)}
      </section>
    </div>`;

    el.addEventListener('click', (e) => {
      if (handleCommon(e)) return;
      if (e.target.closest('[data-sample]')) {
        loadSample(buildSample());
        toast('Données d’exemple chargées');
      }
    });
    el.querySelector('#dash-quick').addEventListener('submit', (e) => {
      e.preventDefault();
      const input = e.target.querySelector('input');
      const title = input.value.trim();
      if (!title) return;
      input.value = '';
      save('tasks', { title, notes: '', priority: 0, categoryId: null, due: k, done: false, completedAt: null });
    });
  },
};

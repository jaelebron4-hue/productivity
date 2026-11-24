import { getState, goalProgress } from '../store.js';
import { esc, fmt, cap, dateKey, addDays, startOfDay, startOfWeek, startOfMonth, endOfMonth, eachDay, keyOfIso, pct, safeColor } from '../utils.js';
import { icon } from '../icons.js';
import { PRIORITIES, activeHabits, habitsOn, habitRate, currentStreak, bestStreak } from '../domain.js';
import { chart } from '../charts.js';
import { progressBar, emptyState } from '../components.js';
import { bus } from '../bus.js';

const view = { period: 'week', offset: 0 };

function range(period, offset) {
  const t = new Date();
  if (period === 'week') {
    const from = addDays(startOfWeek(t), offset * 7);
    return { from, to: addDays(from, 6) };
  }
  const from = new Date(t.getFullYear(), t.getMonth() + offset, 1);
  return { from, to: endOfMonth(from) };
}

function label(period, { from, to }) {
  if (period === 'month') return cap(fmt(from, { month: 'long', year: 'numeric' }));
  const sameMonth = from.getMonth() === to.getMonth();
  return `${fmt(from, sameMonth ? { day: 'numeric' } : { day: 'numeric', month: 'short' })} – ${fmt(to, { day: 'numeric', month: 'short', year: 'numeric' })}`;
}

function delta(cur, prev) {
  if (!prev) return cur ? '<span class="delta up">nouveau</span>' : '';
  const d = (cur - prev) / prev;
  if (Math.abs(d) < 0.005) return '<span class="delta">=</span>';
  return `<span class="delta ${d > 0 ? 'up' : 'down'}">${d > 0 ? '↑' : '↓'} ${Math.abs(Math.round(d * 100))}%</span>`;
}

export default {
  title: 'Statistiques',
  render(el) {
    const s = getState();
    const habits = activeHabits(s);
    const t0 = startOfDay(new Date());
    const r = range(view.period, view.offset);
    const days = eachDay(r.from, r.to);
    const elapsed = days.filter((d) => d <= t0).length || 1;
    // Période précédente, ramenée à la même durée écoulée pour une comparaison équitable
    const prevFull = range(view.period, view.offset - 1);
    const prev = view.offset === 0 ? { from: prevFull.from, to: addDays(prevFull.from, elapsed - 1) } : prevFull;
    const inRange = (iso, rr) => {
      const k = keyOfIso(iso);
      return k && k >= dateKey(rr.from) && k <= dateKey(rr.to);
    };

    const doneTasks = s.tasks.filter((t) => t.done && inRange(t.completedAt, r));
    const prevDone = s.tasks.filter((t) => t.done && inRange(t.completedAt, prev)).length;
    const created = s.tasks.filter((t) => inRange(t.createdAt, r)).length;
    const withDue = doneTasks.filter((t) => t.due);
    const onTime = withDue.filter((t) => keyOfIso(t.completedAt) <= t.due).length;

    const perDay = days.map((d) => doneTasks.filter((t) => keyOfIso(t.completedAt) === dateKey(d)).length);
    const habitDay = days.map((d) => (d > t0 ? null : habitsOn(habits, d)));
    const habitPct = habitDay.map((x) => (x && x.due ? (x.done / x.due) * 100 : null));
    const hDue = habitDay.reduce((a, x) => a + (x ? x.due : 0), 0);
    const hDone = habitDay.reduce((a, x) => a + (x ? x.done : 0), 0);
    const prevH = eachDay(prev.from, prev.to).reduce((a, d) => {
      const x = habitsOn(habits, d);
      return { due: a.due + x.due, done: a.done + x.done };
    }, { due: 0, done: 0 });
    const goalsDone = s.goals.filter((g) => g.completedAt && inRange(g.completedAt, r)).length;

    const labels = days.map((d) => (view.period === 'week' ? cap(fmt(d, { weekday: 'short' }).replace('.', '')) : String(d.getDate())));
    const tipDay = (d) => cap(fmt(d, { weekday: 'long', day: 'numeric', month: 'long' }));
    const todayIdx = days.findIndex((d) => dateKey(d) === dateKey(t0));

    // Répartition par catégorie
    const byCat = s.categories.map((c) => ({ label: c.name, color: safeColor(c.color), value: doneTasks.filter((t) => t.categoryId === c.id).length }));
    const noCat = doneTasks.filter((t) => !s.categories.some((c) => c.id === t.categoryId)).length;
    if (noCat) byCat.push({ label: 'Sans catégorie', color: 'var(--text-3)', value: noCat });
    const byPrio = [3, 2, 1, 0].map((p) => ({ p, n: doneTasks.filter((t) => (t.priority || 0) === p).length }));
    const maxPrio = Math.max(1, ...byPrio.map((x) => x.n));

    const habitRanks = habits
      .map((h) => ({ h, ...habitRate(h, r.from, r.to) }))
      .filter((x) => x.due)
      .sort((a, b) => b.rate - a.rate);

    const activity = (k) =>
      s.tasks.filter((t) => t.done && keyOfIso(t.completedAt) === k).length + s.habits.filter((h) => h.log[k]).length;

    const bestNow = habits.reduce((a, h) => Math.max(a, currentStreak(h)), 0);
    const bestEver = habits.reduce((a, h) => Math.max(a, bestStreak(h)), 0);
    const goalsActive = s.goals.filter((g) => !g.completedAt);

    el.innerHTML = `
    <header class="page-head">
      <div><h1>Statistiques</h1><p class="sub">Votre productivité en un coup d’œil</p></div>
    </header>
    <div class="toolbar">
      <div class="seg">${[['week', 'Semaine'], ['month', 'Mois']].map(([id, l]) => `<button class="seg-btn ${view.period === id ? 'active' : ''}" data-period="${id}">${l}</button>`).join('')}</div>
      <div class="period-nav">
        <button class="icon-btn" data-shift="-1" aria-label="Période précédente">${icon('left')}</button>
        <span class="period-label">${label(view.period, r)}</span>
        <button class="icon-btn" data-shift="1" aria-label="Période suivante" ${view.offset >= 0 ? 'disabled' : ''}>${icon('right')}</button>
        ${view.offset < 0 ? `<button class="btn btn-sm" data-shift="0">Aujourd’hui</button>` : ''}
      </div>
    </div>

    <div class="kpi-grid">
      <div class="card kpi-card"><span class="kpi-label">${icon('check', 14)} Tâches terminées</span><b>${doneTasks.length}</b>${delta(doneTasks.length, prevDone)}<span class="kpi-sub">${(doneTasks.length / elapsed).toFixed(1).replace('.', ',')} / jour en moyenne</span></div>
      <div class="card kpi-card"><span class="kpi-label">${icon('clock', 14)} Dans les temps</span><b>${withDue.length ? pct(onTime / withDue.length) : '—'}</b><span class="kpi-sub">${onTime}/${withDue.length} avant échéance · ${created} créées</span></div>
      <div class="card kpi-card"><span class="kpi-label">${icon('flame', 14)} Régularité habitudes</span><b>${hDue ? pct(hDone / hDue) : '—'}</b>${hDue && prevH.due ? delta(hDone / hDue, prevH.done / prevH.due) : ''}<span class="kpi-sub">${hDone}/${hDue} réalisées · record ${bestEver} j</span></div>
      <div class="card kpi-card"><span class="kpi-label">${icon('target', 14)} Objectifs</span><b>${goalsDone}</b><span class="kpi-sub">atteint(s) sur la période · ${goalsActive.length} en cours</span></div>
    </div>

    <div class="grid">
      <section class="card span-7">
        <div class="card-head"><h3>Tâches terminées</h3><span class="muted small">par jour</span></div>
        ${chart({ type: 'bar', height: 220, labels, values: perDay, highlight: todayIdx, tips: days.map((d, i) => `${tipDay(d)} : ${perDay[i]} tâche(s)`) })}
      </section>
      <section class="card span-5">
        <div class="card-head"><h3>Régularité des habitudes</h3><span class="muted small">% réalisé</span></div>
        ${habits.length ? chart({ type: 'line', height: 220, labels, values: habitPct, color: 'var(--accent)',
          tips: days.map((d, i) => (habitDay[i] ? `${tipDay(d)} : ${habitDay[i].done}/${habitDay[i].due}` : '')) })
        : emptyState('flame', 'Aucune habitude', 'Créez des habitudes pour suivre votre régularité.')}
      </section>

      <section class="card span-6">
        <div class="card-head"><h3>Par catégorie</h3></div>
        ${chart({ type: 'donut', height: 168, items: byCat, center: String(doneTasks.length), sub: 'tâches' })}
      </section>
      <section class="card span-6">
        <div class="card-head"><h3>Par priorité</h3></div>
        <div class="hbars">${byPrio.map(({ p, n }) => `<div class="hbar">
          <span class="hbar-label"><i class="dot prio-dot p${p}"></i>${PRIORITIES[p].label}</span>
          <div class="hbar-track"><i class="prio-fill p${p}" style="width:${(n / maxPrio) * 100}%"></i></div><b>${n}</b></div>`).join('')}</div>
      </section>

      <section class="card span-6">
        <div class="card-head"><h3>Classement des habitudes</h3><span class="muted small">sur la période</span></div>
        ${habitRanks.length ? `<div class="hbars">${habitRanks.map((x) => `<div class="hbar">
          <span class="hbar-label">${esc(x.h.icon)} ${esc(x.h.name)}</span>
          <div class="hbar-track"><i style="width:${pct(x.rate)};background:${safeColor(x.h.color)}"></i></div><b>${pct(x.rate)}</b></div>`).join('')}</div>`
        : emptyState('flame', 'Pas encore de données', '')}
      </section>
      <section class="card span-6">
        <div class="card-head"><h3>Objectifs en cours</h3><span class="muted small">série active max : ${bestNow} j</span></div>
        ${goalsActive.length ? `<div class="goal-mini-list">${goalsActive.slice(0, 6).map((g) => `<div class="goal-mini">
          <span class="goal-mini-top"><span class="goal-mini-title">${esc(g.title)}</span><b>${pct(goalProgress(g))}</b></span>${progressBar(goalProgress(g))}</div>`).join('')}</div>`
        : emptyState('target', 'Aucun objectif en cours', '')}
      </section>

      <section class="card span-12">
        <div class="card-head"><h3>Activité</h3><span class="muted small">tâches terminées + habitudes cochées</span></div>
        ${chart({ type: 'heatmap', height: 130, value: activity, label: (n) => (n ? `${n} action${n > 1 ? 's' : ''}` : 'aucune activité') })}
        <div class="hm-legend"><span>Moins</span>${[0, 1, 2, 3, 4].map((l) => `<i class="hm-key hm-${l}"></i>`).join('')}<span>Plus</span></div>
      </section>
    </div>`;

    el.addEventListener('click', (e) => {
      const p = e.target.closest('[data-period]');
      if (p) {
        view.period = p.dataset.period;
        view.offset = 0;
        return bus.render();
      }
      const sh = e.target.closest('[data-shift]');
      if (sh && !sh.disabled) {
        const v = Number(sh.dataset.shift);
        view.offset = v === 0 ? 0 : Math.min(0, view.offset + v);
        bus.render();
      }
    });
  },
};

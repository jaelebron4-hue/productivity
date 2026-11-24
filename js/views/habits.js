import { getState, find, patch, toggleHabit } from '../store.js';
import { esc, fmt, cap, dateKey, addDays, startOfDay, startOfMonth, endOfMonth, pct, safeColor, plural } from '../utils.js';
import { icon } from '../icons.js';
import { today, activeHabits, isScheduled, isDue, currentStreak, bestStreak, habitRate, freqLabel, totalChecks, habitsOn } from '../domain.js';
import { emptyState, handleCommon } from '../components.js';
import { ring } from '../charts.js';
import { openHabitEditor } from '../editors.js';
import { openModal, toast } from '../ui.js';

const dayLabel = (d) => cap(fmt(d, { weekday: 'long', day: 'numeric', month: 'long' }));

function habitRow(h, days) {
  const color = safeColor(h.color);
  const streak = currentStreak(h);
  return `<div class="habit-row ${h.archived ? 'archived' : ''}" style="--c:${color}">
    <button class="habit-info" data-detail="${h.id}">
      <span class="habit-icon">${esc(h.icon)}</span>
      <span class="habit-text"><span class="habit-name">${esc(h.name)}</span>
      <span class="habit-sub">${freqLabel(h)}${streak ? ` · <span class="streak">${icon('flame', 12)} ${streak} j</span>` : ''}</span></span>
    </button>
    <div class="habit-days">${days.map((d) => {
      const k = dateKey(d);
      const on = !!h.log[k];
      const sched = isScheduled(h, d);
      return `<button class="hcell ${on ? 'on' : ''} ${sched ? '' : 'rest'} ${k === today() ? 'is-today' : ''}"
        data-action="toggle-habit" data-id="${h.id}" data-day="${k}" aria-pressed="${on}"
        data-tip="${esc(`${dayLabel(d)}${sched ? '' : ' (repos)'}`)}" aria-label="${esc(`${h.name}, ${dayLabel(d)}`)}">${on ? icon('check', 14) : ''}</button>`;
    }).join('')}</div>
  </div>`;
}

/* ---------- Détail : calendrier mensuel + statistiques ---------- */
function openDetail(id) {
  let month = startOfMonth(new Date());
  const m = openModal({
    title: 'Habitude',
    className: 'modal-wide',
    body: '<div class="habit-detail"></div>',
    footer: `<button class="btn btn-ghost" data-archive></button><span class="spacer"></span>
      <button class="btn btn-primary" data-edit>${icon('edit', 16)}<span>Modifier</span></button>`,
    onMount(api) {
      api.el.addEventListener('click', (e) => {
        const h = find('habits', id);
        if (!h) return api.close();
        if (e.target.closest('[data-prev]')) month = new Date(month.getFullYear(), month.getMonth() - 1, 1);
        else if (e.target.closest('[data-next]')) month = new Date(month.getFullYear(), month.getMonth() + 1, 1);
        else if (e.target.closest('[data-day]')) toggleHabit(id, e.target.closest('[data-day]').dataset.day);
        else if (e.target.closest('[data-edit]')) {
          api.close();
          return openHabitEditor(h);
        } else if (e.target.closest('[data-archive]')) {
          patch('habits', id, { archived: !h.archived });
          toast(h.archived ? 'Habitude réactivée' : 'Habitude archivée');
          return api.close();
        } else return;
        paint();
      });
    },
  });
  function paint() {
    const h = find('habits', id);
    if (!h) return;
    const color = safeColor(h.color);
    const t0 = startOfDay(new Date());
    const last30 = habitRate(h, addDays(t0, -29), t0);
    const first = startOfMonth(month);
    const last = endOfMonth(month);
    const offset = (first.getDay() + 6) % 7;
    const cells = [];
    for (let i = 0; i < offset; i++) cells.push('<span class="cal-cell empty"></span>');
    for (let d = first; d <= last; d = addDays(d, 1)) {
      const k = dateKey(d);
      const future = d > t0;
      const on = !!h.log[k];
      cells.push(`<button class="cal-cell ${on ? 'on' : ''} ${isScheduled(h, d) ? '' : 'rest'} ${k === today() ? 'is-today' : ''}"
        ${future ? 'disabled' : `data-day="${k}"`} aria-pressed="${on}" aria-label="${esc(dayLabel(d))}">${d.getDate()}</button>`);
    }
    const monthRate = habitRate(h, first, last);
    m.el.querySelector('.modal-head h2').textContent = `${h.icon} ${h.name}`;
    m.el.querySelector('[data-archive]').innerHTML = `${icon('archive', 16)}<span>${h.archived ? 'Réactiver' : 'Archiver'}</span>`;
    m.el.querySelector('.habit-detail').innerHTML = `
      <div class="detail-stats" style="--c:${color}">
        <div><span>Série actuelle</span><b>${currentStreak(h)} j</b></div>
        <div><span>Record</span><b>${bestStreak(h)} j</b></div>
        <div><span>30 derniers jours</span><b>${last30.rate == null ? '—' : pct(last30.rate)}</b></div>
        <div><span>Total</span><b>${totalChecks(h)}</b></div>
      </div>
      <div class="cal" style="--c:${color}">
        <div class="cal-head">
          <button class="icon-btn" data-prev aria-label="Mois précédent">${icon('left')}</button>
          <div class="cal-title"><b>${cap(fmt(month, { month: 'long', year: 'numeric' }))}</b>
            <span class="muted small">${monthRate.due ? `${monthRate.done}/${monthRate.due} jours · ${pct(monthRate.rate)}` : 'Aucun jour prévu'}</span></div>
          <button class="icon-btn" data-next aria-label="Mois suivant" ${startOfMonth(new Date()) <= month ? 'disabled' : ''}>${icon('right')}</button>
        </div>
        <div class="cal-grid">${['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((x) => `<span class="cal-dow">${x}</span>`).join('')}${cells.join('')}</div>
        <p class="muted small cal-hint">Touchez un jour pour le cocher ou le décocher. ${freqLabel(h)}.</p>
      </div>`;
  }
  paint();
}

export default {
  title: 'Habitudes',
  onNew: () => openHabitEditor(),
  render(el) {
    const s = getState();
    const habits = activeHabits(s);
    const archived = s.habits.filter((h) => h.archived);
    const t0 = startOfDay(new Date());
    const days = Array.from({ length: 7 }, (_, i) => addDays(t0, i - 6));
    const todayStat = habitsOn(habits, t0);
    let due30 = 0;
    let done30 = 0;
    for (const h of habits) {
      const r = habitRate(h, addDays(t0, -29), t0);
      due30 += r.due;
      done30 += r.done;
    }
    const best = habits.reduce((a, h) => Math.max(a, bestStreak(h)), 0);
    const active = habits.reduce((a, h) => Math.max(a, currentStreak(h)), 0);
    const daysHead = `<div class="habit-row head"><div class="habit-info-head">7 derniers jours</div><div class="habit-days">${days
      .map((d) => `<span class="dcol ${dateKey(d) === today() ? 'is-today' : ''}"><span>${fmt(d, { weekday: 'narrow' })}</span><b>${d.getDate()}</b></span>`)
      .join('')}</div></div>`;

    el.innerHTML = `
    <header class="page-head">
      <div><h1>Habitudes</h1><p class="sub">${plural(habits.length, 'habitude active', 'habitudes actives')}</p></div>
      <button class="btn btn-primary" data-action="new-habit">${icon('plus')}<span>Nouvelle habitude</span></button>
    </header>

    ${habits.length ? `
    <div class="stat-row">
      <div class="card stat-card">${ring(todayStat.due ? todayStat.done / todayStat.due : 0, 56, 6, `<b class="small">${todayStat.done}/${todayStat.due}</b>`)}<div><span class="kpi-label">Aujourd’hui</span><b>${todayStat.due ? pct(todayStat.done / todayStat.due) : '—'}</b></div></div>
      <div class="card stat-card"><div class="stat-icon">${icon('trend', 18)}</div><div><span class="kpi-label">Régularité 30 j</span><b>${due30 ? pct(done30 / due30) : '—'}</b></div></div>
      <div class="card stat-card"><div class="stat-icon flame">${icon('flame', 18)}</div><div><span class="kpi-label">Série en cours</span><b>${active} j</b></div></div>
      <div class="card stat-card"><div class="stat-icon">${icon('sparkles', 18)}</div><div><span class="kpi-label">Record</span><b>${best} j</b></div></div>
    </div>
    <section class="card habit-table">${daysHead}${habits.map((h) => habitRow(h, days)).join('')}</section>`
    : `<section class="card">${emptyState('flame', 'Aucune habitude pour le moment', 'Les petites actions répétées font les grands changements. Créez votre première habitude.', `<button class="btn btn-primary btn-sm" data-action="new-habit">${icon('plus', 16)}<span>Nouvelle habitude</span></button>`)}</section>`}

    ${archived.length ? `<details class="card archived-box"><summary>${icon('archive', 16)} Archivées <span class="count">${archived.length}</span></summary>
      <div class="habit-table">${archived.map((h) => habitRow(h, days)).join('')}</div></details>` : ''}`;

    el.addEventListener('click', (e) => {
      const d = e.target.closest('[data-detail]');
      if (d) return openDetail(d.dataset.detail);
      handleCommon(e);
    });
  },
};

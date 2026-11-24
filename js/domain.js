// Règles métier : priorités, échéances, séries d'habitudes, statistiques.
import { dateKey, parseKey, addDays, startOfDay, keyOfIso, eachDay } from './utils.js';

export const PRIORITIES = [
  { v: 0, label: 'Aucune' },
  { v: 1, label: 'Basse' },
  { v: 2, label: 'Moyenne' },
  { v: 3, label: 'Haute' },
];

export const today = () => dateKey();

/* ---------------- Tâches ---------------- */

export const isOverdue = (t) => !t.done && !!t.due && t.due < today();

/** Tâches ouvertes pour aujourd'hui (y compris en retard) et tâches terminées aujourd'hui. */
export function todayTasks(tasks) {
  const k = today();
  return {
    open: tasks.filter((t) => !t.done && t.due && t.due <= k),
    doneToday: tasks.filter((t) => t.done && keyOfIso(t.completedAt) === k),
  };
}

export const tasksDoneOn = (tasks, key) => tasks.filter((t) => t.done && keyOfIso(t.completedAt) === key).length;

/* ---------------- Habitudes ---------------- */

export const WEEKDAYS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
export const activeHabits = (s) => s.habits.filter((h) => !h.archived);
export const isScheduled = (h, d) => h.days.includes(d.getDay());

export function freqLabel(h) {
  const d = [...h.days].sort();
  if (d.length === 7) return 'Tous les jours';
  if (d.join() === '1,2,3,4,5') return 'En semaine';
  if (d.join() === '0,6') return 'Le week-end';
  return [1, 2, 3, 4, 5, 6, 0].filter((x) => d.includes(x)).map((x) => WEEKDAYS[x]).join(', ');
}

/** Premier jour suivi : création ou plus ancienne coche si antérieure. */
export function habitStart(h) {
  let start = startOfDay(new Date(h.createdAt));
  for (const k of Object.keys(h.log)) {
    const d = parseKey(k);
    if (d < start) start = d;
  }
  return start;
}

/** La journée compte-t-elle pour cette habitude ? */
export const isDue = (h, d) => isScheduled(h, d) && startOfDay(d) >= habitStart(h);

/** Série en cours : jours planifiés consécutifs réalisés. Aujourd'hui non coché ne casse pas la série. */
export function currentStreak(h) {
  const start = habitStart(h);
  let d = startOfDay(new Date());
  if (isScheduled(h, d) && !h.log[dateKey(d)]) d = addDays(d, -1);
  let streak = 0;
  while (d >= start) {
    const done = !!h.log[dateKey(d)];
    if (done) streak++;
    else if (isScheduled(h, d)) break;
    d = addDays(d, -1);
  }
  return streak;
}

export function bestStreak(h) {
  const todayD = startOfDay(new Date());
  let best = 0;
  let run = 0;
  for (const d of eachDay(habitStart(h), todayD)) {
    const done = !!h.log[dateKey(d)];
    if (done) run++;
    else if (isScheduled(h, d) && d < todayD) run = 0;
    best = Math.max(best, run);
  }
  return best;
}

/** Taux de réalisation sur une période (jours passés et aujourd'hui uniquement). */
export function habitRate(h, from, to) {
  const end = Math.min(+startOfDay(to), +startOfDay(new Date()));
  let due = 0;
  let done = 0;
  for (const d of eachDay(from, new Date(end))) {
    if (!isDue(h, d)) continue;
    due++;
    if (h.log[dateKey(d)]) done++;
  }
  return { due, done, rate: due ? done / due : null };
}

/** Habitudes prévues un jour donné et combien sont réalisées. */
export function habitsOn(habits, d) {
  const k = dateKey(d);
  const due = habits.filter((h) => isDue(h, d));
  return { due: due.length, done: due.filter((h) => h.log[k]).length };
}

export const totalChecks = (h) => Object.keys(h.log).length;

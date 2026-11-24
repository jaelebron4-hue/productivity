// Données d'exemple pour découvrir l'application.
import { uid, dateKey, addDays } from './utils.js';

const at = (d, h, m = 0) => {
  const x = new Date(d);
  x.setHours(h, m, 0, 0);
  return x.toISOString();
};

export function buildSample() {
  const t = new Date();
  const year = t.getFullYear();
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const cats = ['cat-work', 'cat-personal', 'cat-health', 'cat-learning'];
  const pastTitles = [
    'Répondre aux e-mails', 'Préparer la réunion hebdo', 'Courses de la semaine', 'Relire le rapport', 'Payer les factures',
    'Appeler le dentiste', 'Mettre à jour le CV', 'Faire le point budget', 'Ranger le bureau', 'Réviser le chapitre 3',
    'Envoyer le devis', 'Planifier le week-end', 'Sauvegarder les photos', 'Lire un article technique',
  ];
  const tasks = [];
  for (let i = 1; i <= 42; i++) {
    const day = addDays(t, -i);
    const n = Math.floor(Math.random() * (day.getDay() % 6 === 0 ? 2 : 5));
    for (let j = 0; j < n; j++) {
      tasks.push({
        id: uid(), title: pick(pastTitles), notes: '', priority: Math.floor(Math.random() * 4), categoryId: pick(cats),
        due: dateKey(day), done: true, createdAt: at(addDays(day, -2), 9), completedAt: at(day, 9 + j * 2, 15), updatedAt: at(day, 9 + j * 2, 15),
      });
    }
  }
  const open = [
    ['Finaliser la présentation client', 3, 'cat-work', -1, 'Ajouter les chiffres du trimestre et la démo.'],
    ['Réserver les billets de train', 2, 'cat-personal', 0, ''],
    ['Séance de sport 45 min', 1, 'cat-health', 0, ''],
    ['Revue de code de la PR #42', 2, 'cat-work', 0, ''],
    ['Terminer le module 8 du cours', 2, 'cat-learning', 1, ''],
    ['Prendre rendez-vous chez le médecin', 1, 'cat-health', 3, ''],
    ['Préparer le planning de décembre', 2, 'cat-work', 6, ''],
    ['Trier les abonnements inutiles', 0, 'cat-personal', null, ''],
    ['Idées de cadeaux de fin d’année', 0, 'cat-personal', null, ''],
  ];
  for (const [title, priority, categoryId, off, notes] of open)
    tasks.push({ id: uid(), title, notes, priority, categoryId, due: off == null ? null : dateKey(addDays(t, off)), done: false, completedAt: null, createdAt: at(addDays(t, -3), 10) });
  for (const title of ['Planifier la journée', 'Répondre à Julie']) {
    tasks.push({ id: uid(), title, notes: '', priority: 1, categoryId: 'cat-work', due: dateKey(t), done: true, createdAt: at(addDays(t, -1), 18), completedAt: new Date().toISOString() });
  }

  const habitDefs = [
    ['Méditer 10 minutes', '🧘', '#8b5cf6', [0, 1, 2, 3, 4, 5, 6], 0.85],
    ['Lire 20 pages', '📚', '#f59e0b', [0, 1, 2, 3, 4, 5, 6], 0.7],
    ['Sport', '🏃', '#ef4444', [1, 3, 5], 0.8],
    ['Boire 2 L d’eau', '💧', '#3b82f6', [0, 1, 2, 3, 4, 5, 6], 0.9],
    ['Pas d’écran après 22 h', '📵', '#10b981', [0, 1, 2, 3, 4, 5], 0.6],
  ];
  const habits = habitDefs.map(([name, icon, color, days, p], idx) => {
    const log = {};
    for (let i = 1; i <= 75; i++) {
      const d = addDays(t, -i);
      if (!days.includes(d.getDay())) continue;
      if (Math.random() < p || (idx === 0 && i <= 9)) log[dateKey(d)] = true;
    }
    if (idx === 3) log[dateKey(t)] = true;
    return { id: uid(), name, icon, color, days, archived: false, log, createdAt: at(addDays(t, -75), 8) };
  });

  const goals = [
    { title: `Lire 24 livres en ${year}`, description: 'Un peu chaque soir plutôt que les écrans.', horizon: 'long', type: 'numeric', current: 19, target: 24, unit: 'livres', step: 1, deadline: `${year}-12-31`, categoryId: 'cat-learning', milestones: [] },
    { title: 'Lancer mon portfolio', description: '', horizon: 'short', type: 'milestones', deadline: dateKey(addDays(t, 18)), categoryId: 'cat-work', milestones: [
      { id: uid(), title: 'Choisir le design', done: true }, { id: uid(), title: 'Rédiger les études de cas', done: true },
      { id: uid(), title: 'Développer le site', done: false }, { id: uid(), title: 'Mettre en ligne', done: false } ] },
    { title: 'Courir un semi-marathon', description: 'Objectif : moins de 2 h.', horizon: 'long', type: 'milestones', deadline: dateKey(addDays(t, 150)), categoryId: 'cat-health', milestones: [
      { id: uid(), title: 'Courir 5 km sans pause', done: true }, { id: uid(), title: 'Courir 10 km', done: true },
      { id: uid(), title: 'Courir 15 km', done: false }, { id: uid(), title: "S'inscrire à une course", done: false }, { id: uid(), title: 'Le jour J', done: false } ] },
    { title: 'Épargne de précaution', description: '', horizon: 'long', type: 'numeric', current: 1850, target: 3000, unit: '€', step: 50, deadline: dateKey(addDays(t, 200)), categoryId: 'cat-personal', milestones: [] },
    { title: 'Terminer le cours JavaScript', description: '', horizon: 'short', type: 'numeric', current: 7, target: 12, unit: 'modules', step: 1, deadline: dateKey(addDays(t, 14)), categoryId: 'cat-learning', milestones: [] },
    { title: 'Ranger et désencombrer l’appartement', description: '', horizon: 'short', type: 'milestones', deadline: dateKey(addDays(t, -6)), categoryId: 'cat-personal', completedAt: at(addDays(t, -8), 17), milestones: [
      { id: uid(), title: 'Placards', done: true }, { id: uid(), title: 'Bureau', done: true }, { id: uid(), title: 'Cave', done: true } ] },
  ].map((g) => ({ completedAt: null, current: 0, target: 0, unit: '', step: 1, ...g, id: uid(), createdAt: at(addDays(t, -40), 12) }));

  return { tasks, habits, goals };
}

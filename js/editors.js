// Formulaires de création / modification (tâche, habitude, objectif).
import { esc, dateKey, addDays, uid, safeColor } from './utils.js';
import { icon } from './icons.js';
import { PRIORITIES } from './domain.js';
import { getState, save, saveGoal, remove, restore } from './store.js';
import { openModal, segmented, toast, confirmDialog } from './ui.js';

export const COLORS = ['#737373', '#5b5bd6', '#3b82f6', '#06b6d4', '#10b981', '#84cc16', '#f59e0b', '#f97316', '#ef4444', '#ec4899', '#8b5cf6', '#64748b'];
const EMOJIS = ['✨', '🧘', '📚', '🏃', '💧', '🥗', '😴', '✍️', '🎯', '💪', '🧠', '🎸', '🌱', '🚭', '📵', '🙏', '🧹', '💊', '🚶', '☀️'];

const catOptions = (current) =>
  `<option value="">Aucune</option>${getState()
    .categories.map((c) => `<option value="${c.id}" ${c.id === current ? 'selected' : ''}>${esc(c.name)}</option>`)
    .join('')}`;

const colorPicker = (name, current) => `<div class="swatches" role="radiogroup">
  ${COLORS.map((c) => `<label class="swatch" style="--c:${c}"><input type="radio" name="${name}" value="${c}" ${c === current ? 'checked' : ''}><span></span></label>`).join('')}
</div>`;

const formValues = (form) => Object.fromEntries(new FormData(form));

function footer(formId, isEdit) {
  return `${isEdit ? `<button type="button" class="btn btn-ghost danger" data-delete>${icon('trash', 16)}<span>Supprimer</span></button>` : ''}
    <span class="spacer"></span>
    <button type="button" class="btn" data-close>Annuler</button>
    <button type="submit" class="btn btn-primary" form="${formId}">${isEdit ? 'Enregistrer' : 'Créer'}</button>`;
}

/* ---------------- Tâche ---------------- */
export function openTaskEditor(task = null, defaults = {}) {
  const t = task || { title: '', notes: '', priority: 0, categoryId: null, due: null, ...defaults };
  const k0 = dateKey();
  const k1 = dateKey(addDays(new Date(), 1));
  const nextMon = dateKey(addDays(new Date(), ((8 - new Date().getDay()) % 7) || 7));
  openModal({
    title: task ? 'Modifier la tâche' : 'Nouvelle tâche',
    body: `<form id="task-form" class="form" autocomplete="off">
      <input class="input input-lg" name="title" placeholder="Que faut-il faire ?" value="${esc(t.title)}" required maxlength="200" autofocus>
      <textarea class="input" name="notes" rows="3" placeholder="Notes (facultatif)">${esc(t.notes)}</textarea>
      <div class="field"><label>Priorité</label>${segmented('priority', PRIORITIES.map((p) => [p.v, p.label]), t.priority || 0)}</div>
      <div class="field-row">
        <div class="field"><label for="f-due">Échéance</label><input id="f-due" type="date" class="input" name="due" value="${t.due || ''}"></div>
        <div class="field"><label for="f-cat">Catégorie</label><select id="f-cat" class="input" name="categoryId">${catOptions(t.categoryId)}</select></div>
      </div>
      <div class="chips">
        <button type="button" class="chip" data-due="${k0}">Aujourd'hui</button>
        <button type="button" class="chip" data-due="${k1}">Demain</button>
        <button type="button" class="chip" data-due="${nextMon}">Lundi prochain</button>
        <button type="button" class="chip" data-due="">Sans date</button>
      </div>
    </form>`,
    footer: footer('task-form', !!task),
    onMount(m) {
      const form = m.el.querySelector('form');
      m.el.addEventListener('click', (e) => {
        const c = e.target.closest('[data-due]');
        if (c) form.due.value = c.dataset.due;
        if (e.target.closest('[data-delete]')) {
          m.close();
          const item = remove('tasks', task.id);
          toast('Tâche supprimée', { action: { label: 'Annuler', fn: () => restore('tasks', item) } });
        }
      });
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const v = formValues(form);
        if (!v.title.trim()) return;
        save('tasks', {
          ...(task ? { id: task.id } : { done: false, completedAt: null }),
          title: v.title.trim(),
          notes: v.notes.trim(),
          priority: Number(v.priority) || 0,
          due: v.due || null,
          categoryId: v.categoryId || null,
        });
        m.close();
        if (!task) toast('Tâche créée');
      });
    },
  });
}

/* ---------------- Habitude ---------------- */
export function openHabitEditor(habit = null) {
  const h = habit || { name: '', icon: '✨', color: COLORS[0], days: [0, 1, 2, 3, 4, 5, 6] };
  const dayOpts = [[1, 'L'], [2, 'M'], [3, 'M'], [4, 'J'], [5, 'V'], [6, 'S'], [0, 'D']];
  openModal({
    title: habit ? "Modifier l'habitude" : 'Nouvelle habitude',
    body: `<form id="habit-form" class="form" autocomplete="off">
      <div class="habit-name-row">
        <input class="input emoji-input" name="icon" value="${esc(h.icon)}" maxlength="4" aria-label="Icône">
        <input class="input input-lg" name="name" placeholder="Ex. Méditer 10 minutes" value="${esc(h.name)}" required maxlength="80" autofocus>
      </div>
      <div class="emoji-grid">${EMOJIS.map((e) => `<button type="button" class="emoji-btn" data-emoji="${e}">${e}</button>`).join('')}</div>
      <div class="field"><label>Couleur</label>${colorPicker('color', safeColor(h.color))}</div>
      <div class="field"><label>Jours</label>
        ${segmented('days', dayOpts, h.days, { multi: true })}
        <div class="chips" style="margin-top:8px">
          <button type="button" class="chip" data-days="0,1,2,3,4,5,6">Tous les jours</button>
          <button type="button" class="chip" data-days="1,2,3,4,5">En semaine</button>
          <button type="button" class="chip" data-days="0,6">Week-end</button>
        </div>
      </div>
    </form>`,
    footer: footer('habit-form', !!habit),
    onMount(m) {
      const form = m.el.querySelector('form');
      m.el.addEventListener('click', async (e) => {
        const em = e.target.closest('[data-emoji]');
        if (em) form.icon.value = em.dataset.emoji;
        const ds = e.target.closest('[data-days]');
        if (ds) {
          const set = ds.dataset.days.split(',');
          form.querySelectorAll('.seg[data-name="days"] .seg-btn').forEach((b) => b.classList.toggle('active', set.includes(b.dataset.value)));
          form.days.value = ds.dataset.days;
        }
        if (e.target.closest('[data-delete]')) {
          const ok = await confirmDialog({
            title: "Supprimer l'habitude ?",
            message: `« ${habit.name} » et tout son historique seront supprimés.`,
            confirmText: 'Supprimer',
            danger: true,
          });
          if (!ok) return;
          m.close();
          const item = remove('habits', habit.id);
          toast('Habitude supprimée', { action: { label: 'Annuler', fn: () => restore('habits', item) } });
        }
      });
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const v = formValues(form);
        if (!v.name.trim()) return;
        save('habits', {
          ...(habit ? { id: habit.id } : { log: {}, archived: false }),
          name: v.name.trim(),
          icon: v.icon.trim() || '✨',
          color: safeColor(v.color),
          days: v.days.split(',').filter(Boolean).map(Number),
        });
        m.close();
        if (!habit) toast('Habitude créée');
      });
    },
  });
}

/* ---------------- Objectif ---------------- */
export function openGoalEditor(goal = null) {
  const g = goal || {
    title: '', description: '', horizon: 'short', deadline: null, type: 'milestones',
    current: 0, target: 10, unit: '', step: 1, milestones: [], categoryId: null,
  };
  const msRow = (m = { id: uid(), title: '', done: false }) =>
    `<div class="ms-row" data-id="${m.id}" data-done="${m.done ? 1 : 0}">
      <input class="input" value="${esc(m.title)}" placeholder="Étape" maxlength="120">
      <button type="button" class="icon-btn" data-ms-remove aria-label="Retirer">${icon('x', 16)}</button>
    </div>`;
  openModal({
    title: goal ? "Modifier l'objectif" : 'Nouvel objectif',
    body: `<form id="goal-form" class="form" autocomplete="off">
      <input class="input input-lg" name="title" placeholder="Ex. Courir un semi-marathon" value="${esc(g.title)}" required maxlength="140" autofocus>
      <textarea class="input" name="description" rows="2" placeholder="Pourquoi cet objectif ? (facultatif)">${esc(g.description)}</textarea>
      <div class="field-row">
        <div class="field"><label>Horizon</label>${segmented('horizon', [['short', 'Court terme'], ['long', 'Long terme']], g.horizon)}</div>
        <div class="field"><label for="g-deadline">Date cible</label><input id="g-deadline" type="date" class="input" name="deadline" value="${g.deadline || ''}"></div>
      </div>
      <div class="field"><label for="g-cat">Catégorie</label><select id="g-cat" class="input" name="categoryId">${catOptions(g.categoryId)}</select></div>
      <div class="field"><label>Suivi de la progression</label>${segmented('type', [['milestones', 'Par étapes'], ['numeric', 'Valeur chiffrée']], g.type)}</div>
      <div class="type-pane" data-pane="numeric">
        <div class="field-row three">
          <div class="field"><label for="g-cur">Actuel</label><input id="g-cur" class="input" type="number" step="any" name="current" value="${g.current}"></div>
          <div class="field"><label for="g-target">Cible</label><input id="g-target" class="input" type="number" step="any" min="0" name="target" value="${g.target}"></div>
          <div class="field"><label for="g-unit">Unité</label><input id="g-unit" class="input" name="unit" placeholder="km, €, livres…" value="${esc(g.unit)}" maxlength="20"></div>
        </div>
        <div class="field"><label for="g-step">Pas des boutons + / −</label><input id="g-step" class="input" type="number" step="any" min="0" name="step" value="${g.step || 1}"></div>
      </div>
      <div class="type-pane" data-pane="milestones">
        <div class="ms-list">${g.milestones.map(msRow).join('')}</div>
        <button type="button" class="btn btn-ghost btn-sm" data-ms-add>${icon('plus', 16)}<span>Ajouter une étape</span></button>
      </div>
    </form>`,
    footer: footer('goal-form', !!goal),
    onMount(m) {
      const form = m.el.querySelector('form');
      const list = form.querySelector('.ms-list');
      const syncPanes = () => form.querySelectorAll('.type-pane').forEach((p) => (p.hidden = p.dataset.pane !== form.type.value));
      syncPanes();
      form.type.addEventListener('change', syncPanes);
      if (!g.milestones.length) list.insertAdjacentHTML('beforeend', msRow());
      list.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          list.insertAdjacentHTML('beforeend', msRow());
          list.lastElementChild.querySelector('input').focus();
        }
      });
      m.el.addEventListener('click', async (e) => {
        if (e.target.closest('[data-ms-add]')) {
          list.insertAdjacentHTML('beforeend', msRow());
          list.lastElementChild.querySelector('input').focus();
        }
        const rm = e.target.closest('[data-ms-remove]');
        if (rm) rm.closest('.ms-row').remove();
        if (e.target.closest('[data-delete]')) {
          const ok = await confirmDialog({ title: "Supprimer l'objectif ?", message: `« ${goal.title} » sera supprimé.`, confirmText: 'Supprimer', danger: true });
          if (!ok) return;
          m.close();
          const item = remove('goals', goal.id);
          toast('Objectif supprimé', { action: { label: 'Annuler', fn: () => restore('goals', item) } });
        }
      });
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const v = formValues(form);
        if (!v.title.trim()) return;
        const milestones = [...list.querySelectorAll('.ms-row')]
          .map((r) => ({ id: r.dataset.id, title: r.querySelector('input').value.trim(), done: r.dataset.done === '1' }))
          .filter((x) => x.title);
        saveGoal({
          ...(goal ? { id: goal.id } : {}),
          title: v.title.trim(),
          description: v.description.trim(),
          horizon: v.horizon,
          deadline: v.deadline || null,
          categoryId: v.categoryId || null,
          type: v.type,
          current: Number(v.current) || 0,
          target: Math.max(0, Number(v.target) || 0),
          unit: v.unit.trim(),
          step: Number(v.step) > 0 ? Number(v.step) : 1,
          milestones,
        });
        m.close();
        if (!goal) toast('Objectif créé');
      });
    },
  });
}

// Fragments d'interface réutilisés par plusieurs vues + actions communes.
import { esc, relDay, safeColor, pct } from './utils.js';
import { icon } from './icons.js';
import { PRIORITIES, isOverdue, today } from './domain.js';
import { find, remove, restore, toggleTask, toggleHabit } from './store.js';
import { toast } from './ui.js';
import { openTaskEditor, openHabitEditor, openGoalEditor } from './editors.js';

export function taskRow(t, categories, { compact = false } = {}) {
  const cat = categories.find((c) => c.id === t.categoryId);
  const overdue = isOverdue(t);
  const p = t.priority || 0;
  return `<div class="task ${t.done ? 'done' : ''}">
    <button class="check p${p}" data-action="toggle-task" data-id="${t.id}" aria-label="${t.done ? 'Rouvrir' : 'Terminer'} : ${esc(t.title)}">${icon('check', 13)}</button>
    <button class="task-main" data-action="edit-task" data-id="${t.id}">
      <span class="task-title">${esc(t.title)}</span>
      ${!compact && t.notes ? `<span class="task-notes">${esc(t.notes)}</span>` : ''}
      <span class="task-meta">${[
        t.due ? `<span class="meta ${overdue ? 'danger' : t.due === today() ? 'accent' : ''}">${icon('calendar', 13)}${relDay(t.due)}</span>` : '',
        cat ? `<span class="meta"><i class="dot" style="background:${safeColor(cat.color)}"></i>${esc(cat.name)}</span>` : '',
        p ? `<span class="meta prio p${p}">${icon('flag', 13)}${PRIORITIES[p].label}</span>` : '',
      ].join('')}</span>
    </button>
    <button class="icon-btn task-del" data-action="delete-task" data-id="${t.id}" aria-label="Supprimer">${icon('trash', 16)}</button>
  </div>`;
}

export const progressBar = (p, color = 'var(--accent)') =>
  `<div class="bar"><i style="width:${pct(p)};background:${color}"></i></div>`;

export const emptyState = (ic, title, text = '', action = '') => `
  <div class="empty">
    <div class="empty-icon">${icon(ic, 22)}</div>
    <h3>${title}</h3>${text ? `<p>${text}</p>` : ''}${action}
  </div>`;

export function deleteTask(id) {
  const item = remove('tasks', id);
  if (item) toast('Tâche supprimée', { action: { label: 'Annuler', fn: () => restore('tasks', item) } });
}

/** Gestion des actions partagées (data-action). Renvoie true si l'action a été traitée. */
export function handleCommon(e) {
  const a = e.target.closest('[data-action]');
  if (!a) return false;
  const { id } = a.dataset;
  switch (a.dataset.action) {
    case 'toggle-task': {
      const t = find('tasks', id);
      toggleTask(id);
      if (t && !t.done) navigator.vibrate?.(8);
      return true;
    }
    case 'edit-task':
      openTaskEditor(find('tasks', id));
      return true;
    case 'delete-task':
      deleteTask(id);
      return true;
    case 'toggle-habit':
      toggleHabit(id, a.dataset.day || today());
      navigator.vibrate?.(8);
      return true;
    case 'new-task':
      openTaskEditor(null, a.dataset.due ? { due: a.dataset.due } : {});
      return true;
    case 'new-habit':
      openHabitEditor();
      return true;
    case 'new-goal':
      openGoalEditor();
      return true;
    case 'go':
      location.hash = `#/${a.dataset.to}`;
      return true;
    default:
      return false;
  }
}

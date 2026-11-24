// Composants d'interface transverses : modales, confirmations, toasts, infobulles.
import { esc } from './utils.js';
import { icon } from './icons.js';

const stack = [];

export function openModal({ title, body = '', footer = '', onMount, onClose, className = '' }) {
  const root = document.getElementById('modal-root');
  const wrap = document.createElement('div');
  wrap.className = 'modal-backdrop';
  wrap.innerHTML = `
    <div class="modal ${className}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
      <div class="modal-grip" aria-hidden="true"></div>
      <div class="modal-head">
        <h2>${esc(title)}</h2>
        <button class="icon-btn" data-close aria-label="Fermer">${icon('x')}</button>
      </div>
      <div class="modal-body">${body}</div>
      ${footer ? `<div class="modal-foot">${footer}</div>` : ''}
    </div>`;
  root.append(wrap);
  document.documentElement.classList.add('modal-open');
  requestAnimationFrame(() => wrap.classList.add('open'));

  let closed = false;
  const api = { el: wrap.querySelector('.modal'), close };
  function close() {
    if (closed) return;
    closed = true;
    stack.splice(stack.indexOf(api), 1);
    wrap.classList.remove('open');
    setTimeout(() => {
      wrap.remove();
      if (!stack.length) document.documentElement.classList.remove('modal-open');
    }, 200);
    onClose?.();
  }
  wrap.addEventListener('mousedown', (e) => e.target === wrap && close());
  wrap.addEventListener('click', (e) => e.target.closest('[data-close]') && close());
  bindSegmented(api.el);
  stack.push(api);
  onMount?.(api);

  const af = api.el.querySelector('[autofocus]');
  if (af && matchMedia('(pointer: fine)').matches) setTimeout(() => af.focus(), 60);
  return api;
}

export const hasModal = () => stack.length > 0;

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && stack.length) {
    e.preventDefault();
    stack[stack.length - 1].close();
  }
});

export function confirmDialog({ title = 'Confirmer', message, confirmText = 'Confirmer', danger = false }) {
  return new Promise((resolve) => {
    let ok = false;
    openModal({
      title,
      className: 'modal-sm',
      body: `<p class="muted">${esc(message)}</p>`,
      footer: `<button class="btn" data-close>Annuler</button>
               <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-ok>${esc(confirmText)}</button>`,
      onMount: (m) =>
        m.el.querySelector('[data-ok]').addEventListener('click', () => {
          ok = true;
          m.close();
        }),
      onClose: () => resolve(ok),
    });
  });
}

export function toast(msg, { action, timeout = 4500, type = '' } = {}) {
  const root = document.getElementById('toast-root');
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.setAttribute('role', 'status');
  el.innerHTML = `<span>${esc(msg)}</span>${action ? `<button class="toast-action">${esc(action.label)}</button>` : ''}`;
  root.append(el);
  requestAnimationFrame(() => el.classList.add('show'));
  const hide = () => {
    el.classList.remove('show');
    setTimeout(() => el.remove(), 250);
  };
  const t = setTimeout(hide, timeout);
  if (action)
    el.querySelector('.toast-action').addEventListener('click', () => {
      clearTimeout(t);
      action.fn();
      hide();
    });
}

/** Contrôles segmentés : <div class="seg" data-name="x" [data-multi]> + <input type=hidden name=x>. */
export function bindSegmented(root) {
  root.addEventListener('click', (e) => {
    const btn = e.target.closest('.seg[data-name] .seg-btn');
    if (!btn) return;
    const seg = btn.closest('.seg');
    const input = seg.parentElement.querySelector(`input[name="${seg.dataset.name}"]`);
    if (seg.hasAttribute('data-multi')) {
      btn.classList.toggle('active');
      if (!seg.querySelector('.active')) btn.classList.add('active'); // au moins une valeur
    } else {
      seg.querySelectorAll('.seg-btn').forEach((b) => b.classList.toggle('active', b === btn));
    }
    if (input) {
      input.value = [...seg.querySelectorAll('.seg-btn.active')].map((b) => b.dataset.value).join(',');
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }
  });
}

export const segmented = (name, options, current, { multi = false } = {}) => {
  const cur = multi ? new Set(current.map(String)) : new Set([String(current)]);
  return `<div class="seg" data-name="${name}" ${multi ? 'data-multi' : ''}>
    ${options.map(([v, l]) => `<button type="button" class="seg-btn ${cur.has(String(v)) ? 'active' : ''}" data-value="${esc(v)}">${l}</button>`).join('')}
  </div><input type="hidden" name="${name}" value="${esc([...cur].join(','))}">`;
};

export function initTooltip() {
  const tip = document.getElementById('tooltip');
  let cur = null;
  const hide = () => {
    tip.classList.remove('show');
    cur = null;
  };
  document.addEventListener('pointerover', (e) => {
    const t = e.target.closest?.('[data-tip]');
    if (!t) return cur && hide();
    if (t === cur) return;
    cur = t;
    tip.textContent = t.dataset.tip;
    tip.classList.add('show');
    const r = t.getBoundingClientRect();
    const w = tip.offsetWidth;
    const h = tip.offsetHeight;
    const x = Math.max(8, Math.min(innerWidth - w - 8, r.left + r.width / 2 - w / 2));
    let y = r.top - h - 8;
    if (y < 8) y = r.bottom + 8;
    tip.style.transform = `translate(${x}px, ${y}px)`;
  });
  document.addEventListener('scroll', hide, true);
  document.addEventListener('pointerdown', (e) => e.pointerType !== 'mouse' && setTimeout(hide, 1600));
}

export function download(filename, text, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

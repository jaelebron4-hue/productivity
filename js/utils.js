// Petites fonctions utilitaires, sans dépendance.

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ESC[c]);

/** N'accepte qu'une couleur hexadécimale (évite toute injection CSS). */
export const safeColor = (c, fallback = '#5b5bd6') => (/^#[0-9a-f]{3,8}$/i.test(c || '') ? c : fallback);

export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const pad = (n) => String(n).padStart(2, '0');
export const pct = (v) => `${Math.round((v || 0) * 100)}%`;
export const plural = (n, one, many) => `${n} ${n > 1 ? many : one}`;
export const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
export const norm = (s) => String(s || '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

export const debounce = (fn, ms) => {
  let t;
  return (...a) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...a), ms);
  };
};

/* ---------- Dates (toujours en heure locale, clés "AAAA-MM-JJ") ---------- */

export const dateKey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parseKey = (k) => {
  const [y, m, d] = k.split('-').map(Number);
  return new Date(y, m - 1, d);
};
export const startOfDay = (d = new Date()) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};
export const addDays = (d, n) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};
export const daysBetween = (a, b) => Math.round((startOfDay(b) - startOfDay(a)) / 864e5);
export const startOfWeek = (d, weekStart = 1) => {
  const x = startOfDay(d);
  return addDays(x, -((x.getDay() - weekStart + 7) % 7));
};
export const startOfMonth = (d) => new Date(d.getFullYear(), d.getMonth(), 1);
export const endOfMonth = (d) => new Date(d.getFullYear(), d.getMonth() + 1, 0);
export const eachDay = (from, to) => {
  const out = [];
  for (let d = startOfDay(from); d <= to; d = addDays(d, 1)) out.push(d);
  return out;
};
export const keyOfIso = (iso) => (iso ? dateKey(new Date(iso)) : null);

const fmtCache = new Map();
export const fmt = (d, opts) => {
  const k = JSON.stringify(opts);
  if (!fmtCache.has(k)) fmtCache.set(k, new Intl.DateTimeFormat('fr-FR', opts));
  return fmtCache.get(k).format(d);
};

/** "Aujourd'hui", "Demain", "Jeudi", "12 déc."… */
export function relDay(key) {
  const d = parseKey(key);
  const diff = daysBetween(new Date(), d);
  if (diff === 0) return "Aujourd'hui";
  if (diff === 1) return 'Demain';
  if (diff === -1) return 'Hier';
  if (diff > 1 && diff < 7) return cap(fmt(d, { weekday: 'long' }));
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return fmt(d, { day: 'numeric', month: 'short', ...(sameYear ? {} : { year: 'numeric' }) });
}

/** "Dans 12 j", "Dépassé de 3 j"… */
export function relDeadline(key) {
  const diff = daysBetween(new Date(), parseKey(key));
  if (diff < 0) return `Dépassé de ${-diff} j`;
  if (diff === 0) return "Aujourd'hui";
  if (diff === 1) return 'Demain';
  if (diff < 60) return `Dans ${diff} j`;
  const m = Math.round(diff / 30);
  return m < 24 ? `Dans ${m} mois` : `Dans ${Math.round(diff / 365)} ans`;
}

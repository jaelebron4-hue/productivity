// Graphiques SVG faits main : légers, responsives, compatibles thème clair/sombre.
// Usage : la vue insère chart(spec) dans son HTML ; l'app appelle hydrateCharts(root).
import { esc, dateKey, addDays, startOfWeek, fmt, startOfDay } from './utils.js';

const specs = new Map();
let seq = 0;
const ro = new ResizeObserver((entries) => entries.forEach((e) => draw(e.target)));

export function resetCharts() {
  specs.clear();
  ro.disconnect();
}

export function chart(spec) {
  const id = `c${++seq}`;
  specs.set(id, spec);
  const fixed = spec.type === 'bar' || spec.type === 'line';
  return `<div class="chart chart-${spec.type}" data-chart="${id}" style="${fixed ? 'height' : 'min-height'}:${spec.height || 200}px"></div>`;
}

export function hydrateCharts(root) {
  root.querySelectorAll('[data-chart]').forEach((el) => ro.observe(el));
}

function draw(el) {
  const spec = specs.get(el.dataset.chart);
  const w = Math.floor(el.clientWidth);
  if (!spec || !w || el._w === w) return;
  el._w = w;
  el.innerHTML = RENDER[spec.type](spec, w, spec.height || el.clientHeight);
}

function niceMax(v) {
  if (v <= 4) return 4;
  const p = 10 ** Math.floor(Math.log10(v));
  const f = v / p;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p;
}

const fmtNum = (v) => (Number.isInteger(v) ? v : v.toFixed(1));

function axes({ W, H, pad, max, ticks, format }) {
  let out = '';
  for (let i = 0; i <= ticks; i++) {
    const v = (max / ticks) * i;
    const y = pad.t + (H - pad.t - pad.b) * (1 - i / ticks);
    out += `<line x1="${pad.l}" x2="${W - pad.r}" y1="${y}" y2="${y}" class="grid-line"/>`;
    out += `<text x="${pad.l - 8}" y="${y + 4}" class="axis-label" text-anchor="end">${format(v)}</text>`;
  }
  return out;
}

function xLabels(labels, xs, y, minGap = 30) {
  const fit = Math.max(1, Math.floor((xs.at(-1) - xs[0]) / minGap) + 1);
  const step = Math.max(1, Math.ceil(labels.length / fit));
  return labels
    .map((l, i) => (i % step === 0 ? `<text x="${xs[i]}" y="${y}" class="axis-label" text-anchor="middle">${esc(l)}</text>` : ''))
    .join('');
}

/* ---------------- Barres ---------------- */
function bar({ labels, values, tips = [], highlight = -1, color = 'var(--accent)', format = fmtNum }, W, H) {
  const pad = { t: 10, r: 6, b: 24, l: 30 };
  const max = niceMax(Math.max(1, ...values));
  const iw = W - pad.l - pad.r;
  const ih = H - pad.t - pad.b;
  const slot = iw / values.length;
  const bw = Math.max(3, Math.min(34, slot * 0.6));
  const xs = values.map((_, i) => pad.l + slot * i + slot / 2);
  let bars = '';
  values.forEach((v, i) => {
    const h = Math.max(v > 0 ? 3 : 2, (v / max) * ih);
    const y = pad.t + ih - h;
    const cls = v > 0 ? (i === highlight ? 'cbar cbar-hl' : 'cbar') : 'cbar cbar-empty';
    bars += `<rect x="${xs[i] - bw / 2}" y="${y}" width="${bw}" height="${h}" rx="${Math.min(5, bw / 2)}" class="${cls}" style="--c:${color}" data-tip="${esc(tips[i] ?? `${labels[i]} : ${format(v)}`)}"/>`;
    // zone de survol élargie
    bars += `<rect x="${pad.l + slot * i}" y="${pad.t}" width="${slot}" height="${ih}" fill="transparent" data-tip="${esc(tips[i] ?? `${labels[i]} : ${format(v)}`)}"/>`;
  });
  return `<svg width="${W}" height="${H}" role="img">${axes({ W, H, pad, max, ticks: 2, format })}${bars}${xLabels(labels, xs, H - 6)}</svg>`;
}

/* ---------------- Courbe (aire) ---------------- */
function line({ labels, values, tips = [], max = 100, color = 'var(--accent)', format = (v) => `${Math.round(v)}%` }, W, H) {
  const pad = { t: 12, r: 10, b: 24, l: 38 };
  const iw = W - pad.l - pad.r;
  const ih = H - pad.t - pad.b;
  const n = values.length;
  const xs = values.map((_, i) => pad.l + (n === 1 ? iw / 2 : (iw * i) / (n - 1)));
  const y = (v) => pad.t + ih * (1 - v / max);
  const gid = `g${++seq}`;
  // segments continus (les valeurs nulles = pas de donnée)
  const segs = [];
  let cur = [];
  values.forEach((v, i) => {
    if (v == null) {
      if (cur.length) segs.push(cur);
      cur = [];
    } else cur.push([xs[i], y(v)]);
  });
  if (cur.length) segs.push(cur);
  const path = (pts) => pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join('');
  let shapes = '';
  for (const s of segs) {
    if (s.length > 1)
      shapes += `<path d="${path(s)}L${s.at(-1)[0]},${pad.t + ih}L${s[0][0]},${pad.t + ih}Z" fill="url(#${gid})"/>`;
    shapes += `<path d="${path(s)}" class="line-path" style="stroke:${color}"/>`;
  }
  const dots = values
    .map((v, i) => (v == null ? '' : `<circle cx="${xs[i]}" cy="${y(v)}" r="${n > 20 ? 2.5 : 3.5}" class="line-dot" style="stroke:${color}"/>
      <rect x="${xs[i] - iw / n / 2}" y="${pad.t}" width="${iw / n}" height="${ih}" fill="transparent" data-tip="${esc(tips[i] ?? `${labels[i]} : ${format(v)}`)}"/>`))
    .join('');
  return `<svg width="${W}" height="${H}" role="img">
    <defs><linearGradient id="${gid}" x1="0" x2="0" y1="0" y2="1">
      <stop offset="0%" style="stop-color:${color};stop-opacity:.22"/><stop offset="100%" style="stop-color:${color};stop-opacity:0"/>
    </linearGradient></defs>
    ${axes({ W, H, pad, max, ticks: 2, format })}${shapes}${dots}${xLabels(labels, xs, H - 6)}</svg>`;
}

/* ---------------- Anneau ---------------- */
function donut({ items, center = '', sub = '' }, W, H) {
  const total = items.reduce((a, b) => a + b.value, 0);
  const size = Math.min(H, 168);
  const sw = 18;
  const r = (size - sw) / 2;
  const c = 2 * Math.PI * r;
  let off = 0;
  const gap = items.filter((i) => i.value).length > 1 ? 3 : 0;
  const arcs = total
    ? items
        .filter((i) => i.value)
        .map((it) => {
          const len = (it.value / total) * c;
          const s = `<circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke-width="${sw}" style="stroke:${it.color}"
            stroke-dasharray="${Math.max(0, len - gap)} ${c}" stroke-dashoffset="${-off}" transform="rotate(-90 ${size / 2} ${size / 2})"
            data-tip="${esc(`${it.label} : ${it.value} (${Math.round((it.value / total) * 100)}%)`)}" class="donut-arc"/>`;
          off += len;
          return s;
        })
        .join('')
    : '';
  const legend = items
    .map((it) => `<li><i class="dot" style="background:${it.color}"></i><span>${esc(it.label)}</span><b>${it.value}</b></li>`)
    .join('');
  const stacked = W < 360;
  return `<div class="donut-wrap ${stacked ? 'stacked' : ''}">
    <div class="donut" style="width:${size}px;height:${size}px">
      <svg width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke-width="${sw}" class="ring-track"/>${arcs}</svg>
      <div class="donut-center"><b>${esc(center)}</b><span>${esc(sub)}</span></div>
    </div>
    <ul class="legend">${legend || '<li class="muted">Aucune donnée</li>'}</ul>
  </div>`;
}

/* ---------------- Carte de chaleur (activité) ---------------- */
function heatmap({ value, label = (n) => `${n} actions` }, W) {
  const cell = W < 500 ? 11 : 13;
  const gap = 3;
  const left = 26;
  const weeks = Math.max(8, Math.min(53, Math.floor((W - left) / (cell + gap))));
  const end = startOfDay(new Date());
  const start = addDays(startOfWeek(end, 1), -(weeks - 1) * 7);
  const vals = [];
  for (let d = start; d <= end; d = addDays(d, 1)) vals.push([d, value(dateKey(d))]);
  const max = Math.max(1, ...vals.map((v) => v[1]));
  const level = (v) => (v <= 0 ? 0 : Math.min(4, Math.ceil((v / max) * 4)));
  const top = 16;
  let out = '';
  let lastMonth = -1;
  vals.forEach(([d, v], i) => {
    const w = Math.floor(i / 7);
    const row = i % 7;
    const x = left + w * (cell + gap);
    const y = top + row * (cell + gap);
    if (row === 0 && d.getMonth() !== lastMonth) {
      lastMonth = d.getMonth();
      if (w < weeks - 2 || w === 0) out += `<text x="${x}" y="10" class="axis-label">${esc(fmt(d, { month: 'short' }))}</text>`;
    }
    out += `<rect x="${x}" y="${y}" width="${cell}" height="${cell}" rx="3" class="hm hm-${level(v)}"
      data-tip="${esc(`${fmt(d, { weekday: 'short', day: 'numeric', month: 'short' })} · ${label(v)}`)}"/>`;
  });
  ['L', '', 'M', '', 'V', '', 'D'].forEach((l, r) => {
    if (l) out += `<text x="0" y="${top + r * (cell + gap) + cell - 2}" class="axis-label">${l}</text>`;
  });
  const H = top + 7 * (cell + gap);
  return `<svg width="${W}" height="${H}" role="img">${out}</svg>`;
}

const RENDER = { bar, line, donut, heatmap };

/* ---------------- Petits composants SVG ---------------- */
export function ring(p, size = 120, stroke = 10, inner = '', color = 'var(--accent)') {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return `<div class="ring" style="width:${size}px;height:${size}px">
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke-width="${stroke}" class="ring-track"/>
      <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke-width="${stroke}" stroke-linecap="round" class="ring-fill"
        style="stroke:${color}" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - Math.min(1, Math.max(0, p)))}"
        transform="rotate(-90 ${size / 2} ${size / 2})"/>
    </svg><div class="ring-label">${inner}</div></div>`;
}

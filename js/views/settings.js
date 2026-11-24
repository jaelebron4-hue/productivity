import { getState, setSettings, save, remove, restore, exportData, importData, resetAll, loadSample } from '../store.js';
import { esc, fmt, dateKey, safeColor } from '../utils.js';
import { icon } from '../icons.js';
import { COLORS } from '../editors.js';
import { buildSample } from '../seed.js';
import { segmented, toast, confirmDialog, download, openModal } from '../ui.js';
import { getSyncConfig, getSyncStatus, connect, disconnect, syncNow } from '../sync.js';

function syncSection() {
  const cfg = getSyncConfig();
  const st = getSyncStatus();
  if (!cfg.token)
    return `<p class="muted">Synchronisez gratuitement vos appareils grâce à un <b>Gist GitHub secret</b> : aucune donnée ne passe par un serveur tiers payant.</p>
      <ol class="steps">
        <li>Créez un compte gratuit sur <a href="https://github.com/signup" target="_blank" rel="noopener">github.com</a>.</li>
        <li>Générez un jeton : <a href="https://github.com/settings/tokens/new?scopes=gist&description=Productivity%20Tracker" target="_blank" rel="noopener">Nouveau jeton (classic)</a>, cochez uniquement <code>gist</code>, sans expiration.</li>
        <li>Collez-le ci-dessous, sur chacun de vos appareils.</li>
      </ol>
      <form id="sync-form" class="form inline-form" autocomplete="off">
        <input class="input" name="token" type="password" placeholder="ghp_…" required aria-label="Jeton GitHub">
        <button class="btn btn-primary" type="submit">${icon('cloud', 16)}<span>Connecter</span></button>
      </form>
      <p class="muted small">Le jeton reste uniquement sur cet appareil (il n’est jamais exporté).</p>`;
  const when = st.at ? fmt(new Date(st.at), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'jamais';
  return `<div class="sync-box">
      <div class="sync-state ${st.state}"><span class="sync-dot"></span>
        <div><b>${st.state === 'error' ? 'Erreur de synchronisation' : st.state === 'syncing' ? 'Synchronisation…' : 'Synchronisation active'}</b>
        <span class="muted small">${st.state === 'error' ? esc(st.message) : `Dernière synchro : ${when}`}</span></div></div>
      <div class="row-actions">
        <button class="btn btn-sm" data-sync-now>${icon('refresh', 16)}<span>Synchroniser</span></button>
        <button class="btn btn-sm btn-ghost danger" data-sync-off>Déconnecter</button>
      </div>
    </div>
    ${cfg.gistId ? `<p class="muted small">Gist : <a href="https://gist.github.com/${esc(cfg.gistId)}" target="_blank" rel="noopener">${esc(cfg.gistId.slice(0, 10))}…</a> · les modifications sont envoyées automatiquement.</p>` : ''}`;
}

export default {
  title: 'Réglages',
  render(el) {
    const s = getState();
    const st = s.settings;
    const size = new Blob([JSON.stringify(s)]).size;

    el.innerHTML = `
    <header class="page-head"><div><h1>Réglages</h1><p class="sub">Personnalisation, données et synchronisation</p></div></header>

    <section class="card settings-card">
      <h3>Apparence</h3>
      <div class="setting"><div><b>Thème</b><span class="muted small">Clair, sombre ou selon le système</span></div>
        <div id="theme-seg">${segmented('theme', [['system', `${icon('monitor', 15)} Auto`], ['light', `${icon('sun', 15)} Clair`], ['dark', `${icon('moon', 15)} Sombre`]], st.theme)}</div></div>
      <div class="setting"><div><b>Votre prénom</b><span class="muted small">Pour un accueil personnalisé</span></div>
        <input id="name-input" class="input input-sm" value="${esc(st.name)}" placeholder="Prénom" maxlength="40" style="max-width:200px"></div>
    </section>

    <section class="card settings-card">
      <h3>Catégories</h3>
      <div class="cat-list">${s.categories.map((c) => `
        <div class="cat-row" data-id="${c.id}">
          <button class="swatch-btn" data-color="${c.id}" style="background:${safeColor(c.color)}" aria-label="Changer la couleur"></button>
          <input class="input input-sm cat-name" value="${esc(c.name)}" maxlength="40" aria-label="Nom de la catégorie">
          <span class="muted small">${s.tasks.filter((t) => t.categoryId === c.id).length} tâches</span>
          <button class="icon-btn" data-cat-del="${c.id}" aria-label="Supprimer">${icon('trash', 16)}</button>
        </div>`).join('')}</div>
      <form id="cat-form" class="inline-form" autocomplete="off">
        <input class="input input-sm" name="name" placeholder="Nouvelle catégorie" maxlength="40" required>
        <button class="btn btn-sm" type="submit">${icon('plus', 16)}<span>Ajouter</span></button>
      </form>
    </section>

    <section class="card settings-card" id="sync-card">
      <h3>${icon('cloud', 18)} Synchronisation entre appareils</h3>
      <div id="sync-body">${syncSection()}</div>
    </section>

    <section class="card settings-card">
      <h3>Données</h3>
      <p class="muted small">Tout est enregistré automatiquement sur cet appareil (${(size / 1024).toFixed(1).replace('.', ',')} Ko · ${s.tasks.length} tâches · ${s.habits.length} habitudes · ${s.goals.length} objectifs).</p>
      <div class="row-actions">
        <button class="btn" data-export>${icon('download', 16)}<span>Exporter (JSON)</span></button>
        <button class="btn" data-export-csv>${icon('download', 16)}<span>Tâches (CSV)</span></button>
        <label class="btn">${icon('upload', 16)}<span>Importer</span><input type="file" id="import-file" accept="application/json,.json" hidden></label>
        <button class="btn" data-sample>${icon('sparkles', 16)}<span>Données d’exemple</span></button>
      </div>
      <div class="danger-zone"><div><b>Tout effacer</b><span class="muted small">Supprime définitivement toutes vos données.</span></div>
        <button class="btn btn-danger btn-sm" data-reset>${icon('trash', 16)}<span>Réinitialiser</span></button></div>
    </section>

    <section class="card settings-card">
      <h3>${icon('phone', 18)} Installer sur iPhone</h3>
      <ol class="steps">
        <li>Ouvrez l’application dans <b>Safari</b>.</li>
        <li>Touchez le bouton <b>Partager</b> puis <b>« Sur l’écran d’accueil »</b>.</li>
        <li>L’app s’ouvre alors en plein écran et fonctionne hors ligne.</li>
      </ol>
      <p class="muted small">Raccourcis clavier : <kbd>1</kbd>–<kbd>5</kbd> navigation · <kbd>N</kbd> nouvel élément · <kbd>/</kbd> recherche · <kbd>Échap</kbd> fermer.</p>
    </section>`;

    el.querySelector('#name-input').addEventListener('change', (e) => setSettings({ name: e.target.value.trim() }));
    el.querySelector('#theme-seg').addEventListener('click', (e) => {
      const b = e.target.closest('.seg-btn');
      if (b) setSettings({ theme: b.dataset.value });
    });

    el.querySelectorAll('.cat-name').forEach((inp) =>
      inp.addEventListener('change', () => {
        const name = inp.value.trim();
        if (name) save('categories', { id: inp.closest('.cat-row').dataset.id, name });
      }));

    el.querySelector('#cat-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const name = e.target.name.value.trim();
      if (!name) return;
      save('categories', { name, color: COLORS[s.categories.length % COLORS.length] });
    });

    const syncForm = el.querySelector('#sync-form');
    syncForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = syncForm.querySelector('button');
      btn.disabled = true;
      btn.querySelector('span').textContent = 'Connexion…';
      try {
        await connect(syncForm.token.value);
        toast('Synchronisation activée');
      } catch (err) {
        disconnect();
        toast(err.message, { type: 'error' });
      }
      el.querySelector('#sync-body').innerHTML = syncSection();
    });

    el.addEventListener('click', async (e) => {
      const t = e.target;
      if (t.closest('[data-color]')) {
        const id = t.closest('[data-color]').dataset.color;
        const m = openModal({
          title: 'Couleur',
          className: 'modal-sm',
          body: `<div class="swatches big">${COLORS.map((c) => `<button class="swatch-btn" data-pick="${c}" style="background:${c}" aria-label="${c}"></button>`).join('')}</div>`,
          onMount: (api) => api.el.addEventListener('click', (ev) => {
            const p = ev.target.closest('[data-pick]');
            if (p) {
              save('categories', { id, color: p.dataset.pick });
              api.close();
            }
          }),
        });
        return m;
      }
      const del = t.closest('[data-cat-del]');
      if (del) {
        const item = remove('categories', del.dataset.catDel);
        return toast(`Catégorie « ${item.name} » supprimée`, { action: { label: 'Annuler', fn: () => restore('categories', item) } });
      }
      if (t.closest('[data-export]')) {
        download(`productivity-${dateKey()}.json`, exportData());
        return toast('Sauvegarde exportée');
      }
      if (t.closest('[data-export-csv]')) {
        const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
        const cat = (id) => s.categories.find((c) => c.id === id)?.name || '';
        const rows = [['Titre', 'Notes', 'Priorité', 'Catégorie', 'Échéance', 'Terminée', 'Terminée le', 'Créée le']]
          .concat(s.tasks.map((x) => [x.title, x.notes, x.priority, cat(x.categoryId), x.due || '', x.done ? 'oui' : 'non', x.completedAt || '', x.createdAt]));
        download(`taches-${dateKey()}.csv`, '﻿' + rows.map((r) => r.map(q).join(';')).join('\n'), 'text/csv');
        return;
      }
      if (t.closest('[data-sample]')) {
        loadSample(buildSample());
        return toast('Données d’exemple ajoutées');
      }
      if (t.closest('[data-reset]')) {
        const ok = await confirmDialog({ title: 'Tout effacer ?', message: 'Toutes vos tâches, habitudes et objectifs seront supprimés. Pensez à exporter une sauvegarde avant. Cette action est irréversible.', confirmText: 'Tout effacer', danger: true });
        if (ok) {
          resetAll();
          toast('Données réinitialisées');
        }
        return;
      }
      if (t.closest('[data-sync-now]')) {
        await syncNow();
        const stt = getSyncStatus();
        toast(stt.state === 'error' ? stt.message : 'Synchronisé', { type: stt.state === 'error' ? 'error' : '' });
        el.querySelector('#sync-body').innerHTML = syncSection();
        return;
      }
      if (t.closest('[data-sync-off]')) {
        const ok = await confirmDialog({ title: 'Déconnecter la synchronisation ?', message: 'Vos données restent sur cet appareil et dans le Gist. Vous pourrez vous reconnecter à tout moment.', confirmText: 'Déconnecter' });
        if (ok) {
          disconnect();
          el.querySelector('#sync-body').innerHTML = syncSection();
        }
      }
    });

    el.querySelector('#import-file').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      e.target.value = '';
      if (!file) return;
      const text = await file.text();
      openModal({
        title: 'Importer des données',
        className: 'modal-sm',
        body: `<p class="muted">Fichier : <b>${esc(file.name)}</b></p>
          <p class="muted small"><b>Fusionner</b> ajoute les éléments du fichier à vos données. <b>Remplacer</b> efface vos données actuelles.</p>`,
        footer: `<button class="btn" data-close>Annuler</button><button class="btn" data-mode="merge">Fusionner</button><button class="btn btn-danger" data-mode="replace">Remplacer</button>`,
        onMount: (api) => api.el.addEventListener('click', (ev) => {
          const b = ev.target.closest('[data-mode]');
          if (!b) return;
          try {
            importData(text, b.dataset.mode);
            toast('Import réussi');
          } catch (err) {
            toast(err.message, { type: 'error' });
          }
          api.close();
        }),
      });
    });
  },
};

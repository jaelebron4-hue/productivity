# Productivity Tracker

Application web de productivité personnelle (PWA) : **Dashboard, Tâches, Habitudes, Objectifs, Statistiques**.
Thème clair/sombre, responsive, installable sur iPhone, hors ligne, synchronisation gratuite entre appareils.

## Choix techniques

| Besoin | Choix | Pourquoi |
|---|---|---|
| Interface | HTML + CSS + JavaScript (modules ES), **sans framework ni build** | Zéro dépendance, chargement instantané, rien à installer, facile à héberger gratuitement |
| Graphiques | SVG générés à la main (`js/charts.js`) | Légers, nets sur Retina, suivent le thème |
| Données | `localStorage`, sauvegarde automatique à chaque action | Simple, rapide, fonctionne hors ligne |
| Hors ligne / installation | Service worker + manifeste | PWA installable sur iPhone (Safari → Partager → Sur l'écran d'accueil) |
| Synchro | **Gist GitHub secret** (optionnel) | Gratuit, sans serveur à maintenir, fusion élément par élément |
| Sauvegarde | Export / import JSON, export CSV des tâches | Vos données restent à vous |

## Architecture

```
index.html              coquille HTML, thème appliqué avant le rendu
manifest.webmanifest    PWA
sw.js                   cache hors ligne (incrémenter VERSION à chaque mise en ligne)
css/styles.css          design system (variables clair/sombre, responsive)
js/
  app.js                démarrage, routage (#/tasks…), thème, raccourcis, statut de synchro
  store.js              état unique, persistance, import/export, fusion pour la synchro
  domain.js             règles métier : échéances, séries (streaks), taux de réalisation
  sync.js               synchronisation Gist (récupérer → fusionner → renvoyer)
  charts.js             barres, courbe, anneau, carte d'activité
  ui.js                 modales (bottom sheet sur mobile), toasts, infobulles
  editors.js            formulaires tâche / habitude / objectif
  components.js         éléments partagés (ligne de tâche…) et actions communes
  seed.js               données d'exemple
  views/                dashboard, tasks, habits, goals, stats, settings
```

Flux : une vue appelle le store (`save`, `toggleTask`…) → le store enregistre et notifie →
l'app redessine la vue courante. Chaque élément porte un `updatedAt` et les suppressions laissent
une trace (`deleted`), ce qui permet de fusionner proprement deux appareils.

## Lancer en local

```powershell
powershell -ExecutionPolicy Bypass -File serve.ps1
```
puis ouvrir http://localhost:5173 (le service worker est désactivé en local pour éviter le cache).

## Mettre en ligne gratuitement (nécessaire pour l'iPhone)

Une PWA doit être servie en HTTPS. Le plus simple :

1. Créer un dépôt GitHub et y déposer tout le dossier.
2. *Settings → Pages → Deploy from a branch → main / root*.
3. Ouvrir l'URL `https://<utilisateur>.github.io/<depot>/` dans Safari sur l'iPhone → Partager → **Sur l'écran d'accueil**.

(Netlify, Vercel ou Cloudflare Pages fonctionnent aussi : glisser-déposer le dossier.)

## Synchroniser plusieurs appareils

Réglages → Synchronisation : coller un jeton GitHub (classic) avec uniquement la permission `gist`,
sur chaque appareil. Les données sont stockées dans un Gist **secret** et fusionnées automatiquement.

## Raccourcis clavier

`1`–`5` sections · `N` nouvel élément · `/` recherche · `Échap` fermer.
Ajout rapide de tâche : `Appeler Paul demain #perso !!!` (date, catégorie, priorité).

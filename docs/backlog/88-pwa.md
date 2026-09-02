# #88 — PWA : icône d'accueil & plein écran (épopée #70)

**Statut** : ✅ Fait (UAT Jean 02/09/2026) · **Points** : 2 · **Catégorie** : 🧩 Fonctionnalité · **Priorité** : dernier enfant de [#70](70-epopee-responsive.md)

## Objectif
Faire de TVLite une app installable sur l'iPhone : une icône sur l'écran d'accueil qui ouvre
l'app **en plein écran, sans la barre d'adresse de Safari** (elle mange ~110 px de hauteur,
soit un panneau d'indicateur entier).

## Critères d'acceptation
- [x] « Ajouter à l'écran d'accueil » propose **TVLite** avec son icône.
- [x] Lancée depuis l'icône, l'app s'ouvre **sans barre d'adresse ni barre d'onglets** Safari.
- [x] Le thème (clair/sombre) et la zone sûre (encoche, barre home) restent corrects en plein écran.
- [x] La navigation interne (onglets, rapport) reste dans l'app.
- [x] Rechargement : **aucune version périmée servie** — garanti par construction, il n'y a pas de service worker.
- [x] Desktop : aucun changement (balises inertes hors installation).
- [x] UAT Jean sur iPhone — validé le 02/09 (« ça marche super bien »).

## Réalisation (02/09/2026)
- `public/manifest.webmanifest` : `TVLite`, `display: standalone`, `start_url`/`scope` **relatifs** (`./`) — vérifié dans `dist/` : le lien sort bien en `/TradingView-Lite/manifest.webmanifest`.
- `index.html` : lien du manifeste + `apple-mobile-web-app-capable`, `-title`, `-status-bar-style`, `mobile-web-app-capable`, et un `<meta name="theme-color">`.
- `App.tsx` : le `theme-color` **suit le thème choisi** (`#0e1117` en sombre, `#ffffff` en clair) — sinon la barre d'état de l'app installée resterait blanche au-dessus d'un fond sombre. Vérifié à la bascule.
- **Aucun service worker** (voir Décisions) : le piège du cache est éliminé à la racine, pas contourné.

## Décisions
- **Manifeste seul, PAS de service worker.** Le seul besoin est l'icône + le plein écran, et
  iOS l'obtient du manifeste et des balises `apple-*`. Un service worker n'apporterait que le
  hors-ligne (inutile ici : toutes les données viennent du réseau) tout en amenant **le piège du
  cache** identifié au refinement de l'épopée — celui qui a déjà fait croire à Jean que le
  responsive ne marchait pas. On ne l'introduit pas sans besoin réel.
  *Conséquence assumée :* pas d'invite d'installation automatique sur Chrome/Android (elle exige
  un service worker). Sans objet ici — la cible est l'iPhone, où l'ajout se fait par le menu Partager.
- `display: standalone`, `start_url` et `scope` calés sur la base de déploiement (`/TradingView-Lite/`).
- Icône : réutilise `apple-touch-icon.png` (512×512, déjà présent et pensé pour iOS).

## Plan technique
1. `public/manifest.webmanifest` (nom, icône 512, `display: standalone`, couleurs, `start_url`/`scope` relatifs à la base) → vérif : le manifeste se charge sans erreur, chemins corrects en prod.
2. `index.html` : `<link rel="manifest">` + `apple-mobile-web-app-capable` / `-status-bar-style` (iOS < 16.4 les exige encore) → vérif : pas de régression desktop.
3. Vérifier la zone sûre en plein écran (les `env(safe-area-inset-*)` du #84 doivent tenir sans la barre Safari).
4. UAT : ajouter à l'écran d'accueil, lancer, vérifier plein écran + thème.

## Notes / risques
- `theme_color` fige la couleur de la barre d'état : à choisir compatible avec les deux thèmes (ou neutre), sinon elle jure en thème sombre.
- Le manifeste est servi par GitHub Pages sous `/TradingView-Lite/` : des chemins absolus casseraient l'installation.

# #70 — Épopée : Responsive — vue Mobile / iPad

**Statut** : 🔍 Affinée (02/09/2026) · **Points** : ~13-16 · **Catégorie** : 🧩 Fonctionnalité · **Taille** : XL

## Objectif
Rendre TVLite utilisable au doigt sur iPhone et iPad, en s'inspirant de l'app mobile TradingView
(captures du 02/09) : onglets en bas (Watchlist / Graphique), un volet à la fois, menus en
bottom sheets. **Consultation d'abord** — pas d'édition de dessins au doigt.

## Décisions actées
- **Web responsive dans le code existant** (même front Vite, ruptures par largeur d'écran, ~900 px à caler). Pas d'app native. **PWA en ticket bonus de fin d'épopée** (#88).
- **iPad : pas de layout dédié** — paysage = vue desktop, portrait = vue téléphone (conséquence naturelle de la rupture par largeur).
- **Dessins : pas d'édition tactile.** On les affiche, on peut voir la liste de l'ensemble des dessins, en supprimer, et enregistrer/charger les ensembles (#63) — via une liste (bottom sheet), jamais par manipulation sur le canvas.
- **Le desktop reste modifiable**, mais toute nouvelle fonctionnalité doit désormais considérer son comportement iPhone/iPad.
- **Onglets bas** : Watchlist · Graphique, + un slot futur « Portfolio/Backtest » (lié à #83, non construit). Pas d'Explorer ni de Communauté.
- **Recherche de titre** : tap sur le ticker en bas du graphique → la recherche s'ouvre (comme `SymbolSearch` desktop). **Intervalle** : le menu glissant ne montre que les **favoris**, avec un « voir plus » vers la liste complète.
- Zoom/pan tactile du graphique : natif lightweight-charts (pinch, drag des échelles prix/dates).

## Ordre de travail (enfants)
1. **#84 Coquille mobile** ✅ (02/09) — rupture d'écran, onglets bas, bascule Watchlist → Graphique.
2. **#89 Onglet « Rapport »** — 3ᵉ onglet bas : dernier rapport mensuel ; bouton Rapport retiré de la toolbar mobile.
3. **#85 Watchlist mobile** — collections parcourables en haut, sous-catégories, liste tactile.
4. **#86 Graphique mobile v1 (consultation)** — barre du bas, bottom sheets (indicateurs, dessins en gestion lecture seule), empilement « ^ ».
5. **#87 Interactions fines** — overlays de scroll symbole/intervalle, menu « ⋯ », icônes défilantes.
6. **#88 PWA (bonus)** — manifest + service worker : icône écran d'accueil, plein écran.

## Questions ouvertes
- **Fruit de Claude Design à intégrer** (session en cours) → ajustera surtout #86 et #87.
- Mécanique exacte des overlays de scroll (symbole / intervalle) et contenu du menu « ⋯ ».

## Hors périmètre
Tracé et édition de dessins au doigt · onglets Explorer/Communauté · temps réel.

## Notes / risques
- `DrawingLayer.tsx` (~1 700 lignes) est piloté souris — le garder hors du chemin tactile est la raison du « lecture seule ».
- Accès depuis l'iPhone : wifi local (`http://<IP-du-Mac>:5173`, Vite avec `--host`) pour développer et tester ; l'usage nomade réveillera #22 (déploiement Vercel).
- Piège PWA : un service worker mal configuré sert de vieilles versions — à traiter dans #88.

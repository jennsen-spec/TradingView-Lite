# #70 — Épopée : Responsive — vue Mobile / iPad

**Statut** : ✅ Close (02/09/2026) · **Points** : 20 livrés · **Catégorie** : 🧩 Fonctionnalité · **Taille** : XL

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
2. **#89 Onglet « Rapport »** ✅ (02/09) — 3ᵉ onglet bas : dernier rapport mensuel ; bouton Rapport retiré de la toolbar mobile.
3. **#85 Watchlist mobile** ✅ (02/09) — toutes les collections en chips, en-tête ⋯/+, tap → overlay Graphique/Backtest, sans fiche détail ni édition accidentelle.
4. **#86 Graphique mobile v1 (consultation)** ✅ (02/09) — barre du bas, panneaux glissants, repli des légendes, dessins en lecture seule.
5. **#87 Molettes symbole & intervalle** ✅ (02/09) — glissement vertical → molette circulaire façon sélecteur iOS.
6. **#88 PWA (bonus)** ✅ (02/09) — manifeste + balises iOS : icône d'accueil, plein écran.

---

## Clôture de l'épopée — 02/09/2026

**TVLite s'utilise au doigt.** Installée sur l'écran d'accueil de l'iPhone, elle s'ouvre en plein
écran sur trois onglets — Watchlist, Graphique, Rapport — avec les collections en chips, une barre
d'actions en bas, des panneaux qui glissent et des molettes circulaires pour changer de titre ou
d'intervalle sans quitter le graphique. **Le desktop n'a pas bougé d'un pixel.**

Les six enfants, tous validés sur l'iPhone de Jean le 02/09 :
[#84](84-coquille-mobile.md) Coquille (3) · [#89](89-onglet-rapport-mobile.md) Onglet Rapport (2) ·
[#85](85-watchlist-mobile.md) Watchlist (3) · [#86](86-graphique-mobile.md) Graphique v1 (5) ·
[#87](87-molettes-mobile.md) Molettes (5) · [#88](88-pwa.md) PWA (2).

Ce que le chemin a appris, et qui vaut au-delà de l'épopée :
- **La rupture par largeur d'écran a suffi** — aucun code spécifique à l'iPad : paysage = desktop, portrait = téléphone, comme décidé au départ.
- **Réordonner plutôt que réécrire** : la barre du bas est la toolbar desktop déplacée par un `order` CSS, ce qui a laissé intacts les portails d'indicateurs et de dessins.
- **Ne jamais écrire un réglage masqué** : masquer ATR/RS ou forcer un état en mobile aurait effacé la configuration desktop de Jean. Les valeurs affichées sont dérivées, les valeurs enregistrées ne bougent pas.
- **Le zoom de page iOS casse tout `position: fixed`** — c'était la cause du panneau disloqué, pas le panneau.
- **Un `.click()` programmatique ne prouve rien** : il réussit sur un élément qu'aucun doigt ne peut atteindre (bouton de repli des légendes, `pointer-events`). Vérifier par collision.
- **Pas de service worker sans besoin de hors-ligne** : le piège du cache s'élimine en ne l'introduisant pas.

**Décision assumée** : les dessins restent en lecture seule au doigt (voir, lister, supprimer,
charger un ensemble) — tracer et déplacer restent des gestes desktop.

## Questions ouvertes
- Mécanique exacte des overlays de scroll (symbole / intervalle) et contenu extensible du menu « ⋯ » → **#87**, à affiner après #86.

*(Résolu le 02/09 : on avance **sans Claude Design** — la référence est le jeu de captures TradingView mobile ; un apport design ultérieur retoucherait l'habillage, pas la structure.)*

## Hors périmètre
Tracé et édition de dessins au doigt · onglets Explorer/Communauté · temps réel.

## Notes / risques
- `DrawingLayer.tsx` (~1 700 lignes) est piloté souris — le garder hors du chemin tactile est la raison du « lecture seule ».
- Accès depuis l'iPhone : wifi local (`http://<IP-du-Mac>:5173`, Vite avec `--host`) pour développer et tester ; l'usage nomade réveillera #22 (déploiement Vercel).
- Piège PWA : un service worker mal configuré sert de vieilles versions — à traiter dans #88.

---

## Correctif post-clôture — 02/09/2026

**Le document rebondissait dans l'onglet Watchlist** (constaté par Jean) : arrivé au bout de la
liste, iOS enchaînait le défilement sur le document (*rubber-band*), ce qui décalait l'en-tête
et la barre d'onglets. L'onglet Graphique y échappait — le graphique capte le tactile — d'où
l'incohérence entre les deux onglets.

Correctif : en mobile, `html, body { overflow: hidden; overscroll-behavior: none }` (la coquille
occupe exactement la hauteur de l'écran, le document n'a jamais à défiler) et
`overscroll-behavior: contain` sur les conteneurs à défilement interne (liste de la watchlist,
panneaux glissants). Vérifié : le document ne bouge plus, la liste défile normalement
(1320 px de contenu dans 628 px), desktop inchangé.

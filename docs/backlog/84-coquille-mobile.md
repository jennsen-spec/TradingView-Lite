# #84 — Coquille mobile (épopée #70)

**Statut** : ✅ Fait (UAT Jean 02/09/2026) · **Points** : 3 · **Catégorie** : 🧩 Fonctionnalité · **Priorité** : tête de l'épopée [#70](70-epopee-responsive.md)

## Objectif
Poser la structure mobile de TVLite : sous la rupture de largeur, un seul volet à la fois
(Watchlist ou Graphique) avec une barre d'onglets en bas ; au-dessus, le desktop actuel inchangé.

## Critères d'acceptation
- [x] Sous ~900 px de largeur, l'app affiche la vue mobile : le volet actif plein écran + barre d'onglets en bas (Watchlist · Graphique). *(vérifié en émulation 375×812)*
- [x] Au-dessus de la rupture, le layout desktop est identique à aujourd'hui (aucune régression visuelle ni fonctionnelle). *(toolbar, volet watchlist 310 px, aucun onglet bas)*
- [x] Tap sur une action de la watchlist → bascule sur l'onglet Graphique avec le symbole chargé. *(MOM.SYNTH testé)*
- [x] iPad : portrait → vue mobile, paysage → vue desktop ; la rotation bascule proprement sans rechargement. *(810×1080 ↔ 1080×810)*
- [x] Viewport mobile correct : meta viewport (`viewport-fit=cover`), pas de zoom parasite au tap (`touch-action: manipulation`), pas de scroll horizontal (légende du graphe clippée).
- [x] Zones de tap des onglets ≥ 44 px (50 px + safe-area).
- [x] **UAT Jean** : vérifié sur iPhone réel via le wifi local — « ça marche » (02/09). À la validation, Jean a demandé un onglet « Rapport » → nouveau ticket [#89](89-onglet-rapport-mobile.md).

## Décisions
- Rupture par **largeur d'écran** (valeur exacte à caler autour de 900 px) via `matchMedia` — c'est elle qui donne le comportement iPad paysage/portrait.
- Pas de router : la bascule d'onglet est un état React (comme le reste de l'app).
- La barre d'onglets prévoit visuellement un slot futur « Portfolio/Backtest » (inactif, ou absent en v1 — au choix pendant le sprint).
- V1 : `WatchlistPanel` et `Chart` existants affichés tels quels dans la coquille ; leur adaptation fine = #85/#86.

## Questions ouvertes
- (aucune bloquante — le design de Claude Design pourra retoucher l'habillage des onglets après coup)

## Plan technique
1. Meta viewport dans `index.html` + hook `useIsMobile()` (`matchMedia`) → vérif : bascule en direct au resize / rotation simulée.
2. `App.tsx` : layout conditionnel — mobile = volet actif + `BottomTabs` ; desktop = layout actuel intact → vérif : captures aux deux largeurs, diff visuel nul côté desktop.
3. Bascule Watchlist → Graphique branchée sur le callback de sélection de symbole existant → vérif : tap sur AAPL → chart AAPL.
4. Passe CSS tactile minimale (onglets, `touch-action`) → vérif : resize_window mobile dans le navigateur + iPhone réel sur le wifi.

## Notes / risques
- Ne rien dupliquer : la coquille **enveloppe** les composants existants, elle ne les réécrit pas.
- Attention aux pop-ups desktop (recherche, réglages) qui débordent sous 900 px — acceptable en v1, corrigé par #85/#86.

## Réalisation (sprint du 02/09/2026)
- `frontend/src/lib/useIsMobile.ts` (nouveau) — rupture à **900 px** via `matchMedia`, réactive à la rotation.
- `frontend/src/App.tsx` — classes `mobile mtab-{watchlist|chart}`, barre `.bottom-tabs` (2 onglets SVG), watchlist toujours montée en mobile (état conservé), tap symbole → onglet Graphique.
- `frontend/src/styles.css` — bloc « Coquille mobile » en fin de fichier : volet actif par CSS (les deux restent montés), watchlist plein écran, toolbar défilante, `.chart-area{overflow:hidden}` (la légende nowrap créait un scroll horizontal), safe-area iPhone, `touch-action: manipulation`.
- `frontend/index.html` — `viewport-fit=cover`.
- Choix de sprint : **pas de slot « Portfolio/Backtest »** dans la barre (simplicité d'abord — on l'ajoutera quand l'onglet existera). Le bouton watchlist de la toolbar est masqué en mobile (doublon des onglets).

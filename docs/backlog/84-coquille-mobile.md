# #84 — Coquille mobile (épopée #70)

**Statut** : 🔍 Affiné · **Points** : 3 · **Catégorie** : 🧩 Fonctionnalité · **Priorité** : tête de l'épopée [#70](70-epopee-responsive.md)

## Objectif
Poser la structure mobile de TVLite : sous la rupture de largeur, un seul volet à la fois
(Watchlist ou Graphique) avec une barre d'onglets en bas ; au-dessus, le desktop actuel inchangé.

## Critères d'acceptation
- [ ] Sous ~900 px de largeur, l'app affiche la vue mobile : le volet actif plein écran + barre d'onglets en bas (Watchlist · Graphique).
- [ ] Au-dessus de la rupture, le layout desktop est identique à aujourd'hui (aucune régression visuelle ni fonctionnelle).
- [ ] Tap sur une action de la watchlist → bascule sur l'onglet Graphique avec le symbole chargé.
- [ ] iPad : portrait → vue mobile, paysage → vue desktop ; la rotation bascule proprement sans rechargement.
- [ ] Viewport mobile correct : meta viewport, pas de zoom parasite au tap, pas de scroll horizontal.
- [ ] Zones de tap des onglets ≥ 44 px.
- [ ] Vérifié sur iPhone réel via le wifi local (Vite `--host`).

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

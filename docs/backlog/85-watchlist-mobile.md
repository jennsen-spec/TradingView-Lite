# #85 — Watchlist mobile (épopée #70)

**Statut** : 🧪 À valider (sprinté le 02/09/2026) · **Points** : 3 · **Catégorie** : 🧩 Fonctionnalité · **Priorité** : après [#89](89-onglet-rapport-mobile.md) ✅

## Objectif
Rendre l'onglet Watchlist agréable au doigt, façon app TradingView : collections favorites
parcourables en **chips** en haut, lignes plus hautes et lisibles, pas d'actions d'édition
accidentelles au tap. Desktop inchangé.

## Critères d'acceptation
- [x] En mobile, les collections **favorites** s'affichent en chips à noms complets, défilables horizontalement, tap → change de collection (le menu du titre donne toujours accès à toutes). *(« MyPortfolios » / « Duo Sec Momentum » testées)*
- [x] Lignes tactiles : hauteur de tap ≥ 44 px (48 px mesurés), ticker/variation lisibles (police élargie).
- [x] Les icônes étiquette/poubelle (révélées au survol sur desktop) **n'apparaissent pas au tap** en mobile — pas de suppression accidentelle ; l'édition reste un geste desktop en v1 (conforme épopée : consultation d'abord).
- [x] Le bouton ✕ du volet est masqué en mobile (les onglets du bas gèrent la navigation).
- [x] Sections repliables au tap, comme aujourd'hui.
- [x] Desktop : aucun changement (pastilles rondes 30 px à initiale, survol, resize, colonnes, ✕ présent).
- [ ] UAT Jean sur iPhone.

## Réalisation (02/09/2026)
- `WatchlistPanel.tsx` : `useIsMobile()` — les chips `.wl-quick-dot` affichent le nom complet en mobile, l'initiale en desktop.
- `styles.css` (bloc mobile #85) : chips en pilules défilables (scrollbar masquée), `min-height` 48/40 px lignes/sections, `.wl-row-actions` et `.wl-close` masqués.

## Décisions
- Les chips reprennent la rangée « favoris » existante (`.wl-quick`) : même donnée, présentation élargie en mobile — pas de nouveau composant.
- Ajout/renommage/suppression (symboles, sections, listes) restent accessibles via les menus « + » et « ⋯ » : on ne retire que les gestes *accidentels* (survol/clic droit).

## Plan technique
1. `WatchlistPanel.tsx` : `useIsMobile()` → chips à nom complet en mobile (au lieu de l'initiale) → vérif : chips défilables, tap change la collection.
2. `styles.css` (bloc mobile) : chips pills, `min-height` des lignes/sections, `.wl-row-actions`/`.wl-close` masqués → vérif : émulation 375 px + desktop intact.
3. Vérif : tap ligne → graphique (déjà #84), tri Chg% au tap, sections repliables.

## Notes / risques
- Le clic droit (marqueurs, renommer section) n'a pas d'équivalent tactile → v1 : ces gestes restent desktop ; un équivalent (appui long / bottom sheet) sera cadré avec Claude Design (#86/#87).

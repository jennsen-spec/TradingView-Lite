# #85 — Watchlist mobile (épopée #70)

**Statut** : 🧪 À valider (sprinté le 02/09/2026) · **Points** : 3 · **Catégorie** : 🧩 Fonctionnalité · **Priorité** : après [#89](89-onglet-rapport-mobile.md) ✅

## Objectif
Rendre l'onglet Watchlist agréable au doigt, façon app TradingView : collections favorites
parcourables en **chips** en haut, lignes plus hautes et lisibles, pas d'actions d'édition
accidentelles au tap. Desktop inchangé.

## Critères d'acceptation
- [x] En mobile, **toutes les collections** s'affichent en chips à noms complets, défilables horizontalement, tap → change de collection. *(retour UAT : plus de sélecteur ⌄ ni de notion de favoris en mobile — les 4 collections défilent)*
- [x] En-tête façon TV mobile : **⋯ à gauche, + à droite**, pas de titre (la chip active fait office). *(retour UAT)*
- [x] **Le bloc d'info (fiche détail) n'apparaît pas en mobile** — c'est un affichage desktop. *(retour UAT)*
- [x] **Tap sur une ligne → deux boutons** : « Graphique » (ouvre l'onglet Graphique avec le titre) et « Backtest » (inactif — activé quand le module existera, cf. #83). Re-tap sur la ligne ou choix → les boutons se replient. *(retour UAT : plus de bascule directe au tap)*
- [x] Les boutons apparaissent **en overlay sur la ligne même** (comme les icônes de survol, dégradé qui efface le Chg%) — pas de seconde ligne. *(retour UAT : la ligne qui se dépliait était bruyante)*
- [x] **« ＋ Créer une nouvelle liste » dans le menu ⋯** en mobile (le sélecteur ⌄ masqué emportait cette option) ; en desktop l'option reste dans le menu du titre, le ⋯ est inchangé. *(retour UAT)*
- [x] Lignes tactiles : hauteur de tap ≥ 44 px (48 px mesurés), ticker/variation lisibles (police élargie).
- [x] Les icônes étiquette/poubelle (révélées au survol sur desktop) **n'apparaissent pas au tap** en mobile — pas de suppression accidentelle ; l'édition reste un geste desktop en v1 (conforme épopée : consultation d'abord).
- [x] Le bouton ✕ du volet est masqué en mobile (les onglets du bas gèrent la navigation).
- [x] Sections repliables au tap, comme aujourd'hui.
- [x] Desktop : aucun changement (pastilles rondes 30 px à initiale, survol, resize, colonnes, ✕ présent).
- [ ] UAT Jean sur iPhone.

## Réalisation (02/09/2026)
- `WatchlistPanel.tsx` : `useIsMobile()` — la rangée `.wl-quick` liste **toutes les collections** en mobile (noms complets) ; en desktop, pastilles des favoris à initiale comme avant. En mobile, le tap d'une ligne sélectionne (`selRowId`) et révèle `.wl-row-cta` (Graphique / Backtest désactivé) au lieu de charger le graphique.
- `styles.css` (bloc mobile #85) : chips en pilules défilables (scrollbar masquée, `flex: 0 0 auto` sinon la rangée se fait écraser), `min-height` 48/40 px lignes/sections, `.wl-row-actions` et `.wl-close` masqués ; en-tête réordonné en `display: contents` (⋯ en `order:-1`, + poussé à droite, `.wl-title-wrap` masqué, menu ⋯ ancré à gauche).

## Décisions
- Les chips reprennent la rangée « favoris » existante (`.wl-quick`) : même donnée, présentation élargie en mobile — pas de nouveau composant.
- Ajout/renommage/suppression (symboles, sections, listes) restent accessibles via les menus « + » et « ⋯ » : on ne retire que les gestes *accidentels* (survol/clic droit).

## Plan technique
1. `WatchlistPanel.tsx` : `useIsMobile()` → chips à nom complet en mobile (au lieu de l'initiale) → vérif : chips défilables, tap change la collection.
2. `styles.css` (bloc mobile) : chips pills, `min-height` des lignes/sections, `.wl-row-actions`/`.wl-close` masqués → vérif : émulation 375 px + desktop intact.
3. Vérif : tap ligne → graphique (déjà #84), tri Chg% au tap, sections repliables.

## Notes / risques
- Le clic droit (marqueurs, renommer section) n'a pas d'équivalent tactile → v1 : ces gestes restent desktop ; un équivalent (appui long / bottom sheet) sera cadré avec Claude Design (#86/#87).

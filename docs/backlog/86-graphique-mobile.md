# #86 — Graphique mobile v1 (consultation) (épopée #70)

**Statut** : ✅ Fait (UAT Jean 02/09/2026 — « ok c'est bien ») · **Points** : 5 · **Catégorie** : 🧩 Fonctionnalité · **Priorité** : après [#85](85-watchlist-mobile.md) ✅

## Objectif
Rendre l'onglet Graphique utilisable au doigt façon TradingView mobile : la toolbar du haut
disparaît au profit d'une **barre d'actions en bas** (au-dessus des onglets), et les pop-ups
desktop deviennent des **panneaux qui glissent depuis le bas**. Consultation seule — aucun
tracé ni déplacement de dessin au doigt.

## Critères d'acceptation
- [x] En mobile, la toolbar du haut n'apparaît plus : **elle devient la barre du bas** (même DOM réordonné → les portails restent branchés). Le graphique occupe toute la hauteur.
- [x] **Barre du bas** (au-dessus des onglets) : ticker · intervalle · indicateurs · dessins · ⋯ — défilable horizontalement.
- [x] Tap sur le **ticker** → la recherche de symbole s'ouvre.
- [x] Tap sur l'**intervalle** → panneau glissant sur les **favoris** (5 entrées) + « Voir plus… » qui déplie le catalogue complet groupé (11 entrées, Minutes / Heures / Jours).
- [x] Tap **indicateurs** → panneau glissant : catalogue + réglages.
- [x] Tap **dessins** → panneau glissant « Dessins — &lt;symbole&gt; » : liste des dessins avec **suppression** (verrouillés protégés) + les ensembles (#63) enregistrer / restaurer / renommer / supprimer. Aucun tracé au doigt (rangée d'outils masquée).
- [x] Le menu **⋯** contient le **rafraîchissement ↻**, la bascule de **thème ☀/☽** et l'**horodatage** des données (ligne d'information).
- [x] **Bouton « ⌄/⌃ »** sous les légendes : replie/déplie la pile des lignes SMA (replié par défaut en mobile).
- [x] Zoom/pan tactiles : pincer, glisser le graphe, tirer les échelles — le pincement partait sur la page, corrigé (voir retours UAT).
- [x] Un panneau glissant se ferme par tap en dehors ; il **ne masque pas les onglets du bas** (`bottom: 50px + safe-area`).
- [x] Desktop : aucun changement (toolbar en haut, outils de dessin, refresh/thème visibles, 9 lignes de légende, pas de ⋯ ni de bouton de repli).
- [x] UAT Jean sur iPhone — validé le 02/09 après trois tours de corrections.

## Retours UAT du 02/09 — corrigés
- **Le pincement zoomait la PAGE, pas le graphique** (cause racine du « ça part en bordel » sur les ensembles) : sous zoom de page, Safari iOS place les éléments `position: fixed` dans le viewport de mise en page, donc tous les panneaux se décalent et se coupent. → zoom de page neutralisé en mobile (`gesturestart/change/end`), le pincement revient au graphique.
- **Panneau « Dessins » disloqué** : `.sets-modal` se centre par `transform: translateX(-50%)` — non neutralisé par la règle mobile, d'où un décalage systématique de −50 % de la largeur (reproduit en émulation : `left` calculé 0 mais rect à −187). → `transform: none` en mobile.
- **Panneau indicateurs impossible à fermer au tap extérieur** : iOS n'émet pas toujours `mousedown` sur un tap hors élément interactif. → écoute `touchstart` en plus, dans `IndicatorCatalog`, `IntervalSelector` et le menu ⋯.
- **« Indicateurs » devient une icône** en mobile (le libellé reste sur desktop).
- **Panneau « Dessins » illisible** (section Ensembles écrasée en une ligne tronquée) : `.is-modal` est un flex-column contraint en hauteur, la liste des ensembles (`max-height` + `overflow` propres) se faisait comprimer. → en mobile, empilement en flux normal, un seul défilement, séparateur avant « Ensembles », hauteur portée à 72 vh.
- **Le bouton ⌄/⌃ ne réagissait pas au doigt** : les légendes vivent dans `.pane-scale-controls`, en `pointer-events: none` ; `.ind-row` réactive les événements mais mon bouton ne le faisait pas. → `pointer-events: auto`. *(Piège de vérification : un `.click()` programmatique réussit même sur un élément non atteignable — il faut tester la collision via `elementFromPoint`.)*

## Reporté en #87 (mécanique d'overlay)
- **Appui long sur le ticker + glissement** pour passer d'un symbole à l'autre (overlay de la watchlist), et **le même geste sur l'intervalle** : c'est exactement la mécanique d'overlay de scroll cadrée en #87.

## Écart assumé
- **Pas de « masquer » par dessin** dans la liste : il n'existe aucun drapeau de visibilité individuel (la `visibility` actuelle est un filtre par intervalle évalué en ~10 points du rendu). L'ajouter aurait demandé de toucher tout le moteur de rendu de `DrawingLayer` — hors périmètre d'une v1 de consultation. La liste fait donc **voir + supprimer**, et les ensembles couvrent le reste.

## Décisions
- Les panneaux glissants **réutilisent les composants existants** (`IndicatorCatalog`, `IndicatorSettings`, `SymbolSearch`) dans une coquille « bottom sheet » ; on ne réécrit pas leur contenu.
- Les portails de toolbar (`#ind-toolbar-slot`, `#draw-toolbar-slot`) sont remplacés en mobile par des cibles dans la barre du bas — pas de duplication de la logique de `Chart`/`DrawingLayer`.
- La barre du bas est **fixe** (pas de défilement horizontal en v1) : le défilement des icônes et les overlays de scroll symbole/intervalle sont explicitement **#87**.
- **Reste de la toolbar dans le menu ⋯** : refresh ↻, thème ☀/☽, horodatage (confirmé par Jean le 02/09). Le bouton Rapport n'y va pas — il a son onglet (#89).
- **On avance sans Claude Design** (02/09) : le design suit les captures TradingView mobile de référence ; si un apport design arrive plus tard, il retouchera l'habillage, pas la structure.

## Questions ouvertes
- (aucune — prêt à sprinter)

## Plan technique
1. Coquille `BottomSheet` (overlay + panneau, fermeture tap-dehors / glissement) → vérif : ouvre/ferme, n'empiète pas sur `.bottom-tabs`.
2. Barre d'actions mobile dans `App.tsx` + masquage de `.toolbar` en mobile ; slots de portails déplacés → vérif : indicateurs et dessins s'affichent depuis la barre du bas.
3. `IntervalSelector` : rendu « favoris + voir plus » en mobile → vérif : changement d'intervalle, catalogue complet accessible.
4. Panneau dessins : liste + suppression + ensembles, sans interaction canvas → vérif : un dessin se supprime, aucun tracé possible au doigt.
5. Bouton « ^ » de repli des légendes → vérif : replié par défaut en mobile, déplie/replie au tap.
6. Vérif tactile réelle sur iPhone (pinch, pan, échelles).

## Réalisation (02/09/2026)
- `styles.css` : **la toolbar existante devient la barre du bas** (`order: 2` dans `.app` en colonne) — donc `#ind-toolbar-slot` / `#draw-toolbar-slot` restent valides, aucune logique de portail touchée. Menus (`.iv-menu`, `.icat-menu`, `.icat-modal`, `.sets-modal`, `.cb-menu`) passés en panneaux `fixed` ancrés au-dessus des onglets ; rangée d'outils de dessin masquée ; refresh/thème/horodatage masqués de la barre.
- `App.tsx` : bouton et menu **⋯** (recharger, thème, « Données du … »), fermeture au tap extérieur.
- `IntervalSelector.tsx` : en mobile le panneau ouvre sur les **favoris** + « Voir plus… » vers le catalogue complet.
- `Chart.tsx` : `legendOpen` + bouton **⌄/⌃** dans la légende du panneau prix (mobile), replié par défaut.
- `DrawingLayer.tsx` : le panneau des ensembles devient « Dessins — symbole » et liste en mobile les dessins de Jean avec suppression (`supprimerDessin`, dessins verrouillés protégés).

## Notes / risques
- `Chart.tsx` rend ses légendes en absolu (`.pane-legend`) : le repli « ^ » doit réduire la **hauteur occupée**, pas seulement masquer du texte.
- `DrawingLayer.tsx` (~1 700 lignes, piloté souris) reste hors du chemin tactile : en mobile on ne monte que sa couche de rendu et la gestion par liste — c'est le cœur du « lecture seule ».
- Le tap qui ouvre un panneau ne doit pas déclencher le crosshair du graphe (conflit tactile classique).

# #86 — Graphique mobile v1 (consultation) (épopée #70)

**Statut** : 🧪 À valider (sprinté le 02/09/2026) · **Points** : 5 · **Catégorie** : 🧩 Fonctionnalité · **Priorité** : après [#85](85-watchlist-mobile.md) ✅

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
- [ ] Zoom/pan tactiles : pincer, glisser le graphe, tirer l'échelle des prix et celle des dates — **à vérifier sur iPhone** (natif lightweight-charts, non testable en émulation).
- [x] Un panneau glissant se ferme par tap en dehors ; il **ne masque pas les onglets du bas** (`bottom: 50px + safe-area`).
- [x] Desktop : aucun changement (toolbar en haut, outils de dessin, refresh/thème visibles, 9 lignes de légende, pas de ⋯ ni de bouton de repli).
- [ ] UAT Jean sur iPhone.

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

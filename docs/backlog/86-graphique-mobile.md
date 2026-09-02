# #86 — Graphique mobile v1 (consultation) (épopée #70)

**Statut** : 🔍 Affiné · **Points** : 5 · **Catégorie** : 🧩 Fonctionnalité · **Priorité** : après [#85](85-watchlist-mobile.md) ✅

## Objectif
Rendre l'onglet Graphique utilisable au doigt façon TradingView mobile : la toolbar du haut
disparaît au profit d'une **barre d'actions en bas** (au-dessus des onglets), et les pop-ups
desktop deviennent des **panneaux qui glissent depuis le bas**. Consultation seule — aucun
tracé ni déplacement de dessin au doigt.

## Critères d'acceptation
- [ ] En mobile, la toolbar du haut n'apparaît plus ; le graphique occupe toute la hauteur disponible.
- [ ] **Barre du bas** (au-dessus des onglets) : ticker · intervalle · dessins · indicateurs · ⋯.
- [ ] Tap sur le **ticker** → la recherche de symbole s'ouvre (`SymbolSearch`, plein écran en mobile).
- [ ] Tap sur l'**intervalle** → panneau glissant listant les **favoris** (`tvlike:interval-favorites`) + une entrée « voir plus » qui déplie le catalogue complet groupé (Minutes / Heures / Jours).
- [ ] Tap **indicateurs** → panneau glissant : catalogue + réglages (`IndicatorCatalog` / `IndicatorSettings`).
- [ ] Tap **dessins** → panneau glissant listant les dessins et les ensembles (#63) : afficher / masquer, **supprimer**, enregistrer / charger un ensemble. Aucun tracé ni édition au doigt.
- [ ] **Bouton « ^ »** sous les légendes : replie/déplie la pile des lignes SMA (défaut replié en mobile pour dégager le graphe).
- [ ] Zoom/pan tactiles : pincer, glisser le graphe, tirer l'échelle des prix et celle des dates (natif lightweight-charts) — vérifiés sur iPhone.
- [ ] Un panneau glissant se ferme par tap en dehors ou glissement vers le bas ; il ne masque jamais les onglets du bas.
- [ ] Desktop : aucun changement.
- [ ] UAT Jean sur iPhone.

## Décisions
- Les panneaux glissants **réutilisent les composants existants** (`IndicatorCatalog`, `IndicatorSettings`, `SymbolSearch`) dans une coquille « bottom sheet » ; on ne réécrit pas leur contenu.
- Les portails de toolbar (`#ind-toolbar-slot`, `#draw-toolbar-slot`) sont remplacés en mobile par des cibles dans la barre du bas — pas de duplication de la logique de `Chart`/`DrawingLayer`.
- La barre du bas est **fixe** (pas de défilement horizontal en v1) : le défilement des icônes et les overlays de scroll symbole/intervalle sont explicitement **#87**.

## Questions ouvertes
- **Où vont refresh ↻, thème ☀/☽ et l'horodatage des données ?** Proposition : dans le menu « ⋯ » de la barre du bas (l'horodatage en simple ligne d'information). *À confirmer.*
- **Fruit de Claude Design** : peut retoucher l'ordre et l'iconographie de la barre du bas, et l'allure des panneaux.

## Plan technique
1. Coquille `BottomSheet` (overlay + panneau, fermeture tap-dehors / glissement) → vérif : ouvre/ferme, n'empiète pas sur `.bottom-tabs`.
2. Barre d'actions mobile dans `App.tsx` + masquage de `.toolbar` en mobile ; slots de portails déplacés → vérif : indicateurs et dessins s'affichent depuis la barre du bas.
3. `IntervalSelector` : rendu « favoris + voir plus » en mobile → vérif : changement d'intervalle, catalogue complet accessible.
4. Panneau dessins : liste + suppression + ensembles, sans interaction canvas → vérif : un dessin se supprime, aucun tracé possible au doigt.
5. Bouton « ^ » de repli des légendes → vérif : replié par défaut en mobile, déplie/replie au tap.
6. Vérif tactile réelle sur iPhone (pinch, pan, échelles).

## Notes / risques
- `Chart.tsx` rend ses légendes en absolu (`.pane-legend`) : le repli « ^ » doit réduire la **hauteur occupée**, pas seulement masquer du texte.
- `DrawingLayer.tsx` (~1 700 lignes, piloté souris) reste hors du chemin tactile : en mobile on ne monte que sa couche de rendu et la gestion par liste — c'est le cœur du « lecture seule ».
- Le tap qui ouvre un panneau ne doit pas déclencher le crosshair du graphe (conflit tactile classique).

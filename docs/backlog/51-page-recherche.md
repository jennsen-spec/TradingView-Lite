# #51 — Page « Recherche » (lecture seule)

**Statut** : 🔍 Affiné · **Points** : 5 · **Catégorie** : 🧩 Fonctionnalité · **Taille** : M
Épopée : [#47](47-epopee-un-seul-produit.md) · Prérequis : #50

## Objectif
Afficher dans TVLite le **tableau comparatif des jeux de règles** mesurés par le labo, pour que Jean lise ses
résultats **là où sont ses graphiques** — pas dans un terminal à part. C'est le premier morceau concret du
« un seul produit ».

## Critères d'acceptation
- [ ] Une page/onglet **« Recherche »** dans TVLite liste les jeux de règles mesurés, **triables** par écart contre benchmark, pire baisse, % de temps investi.
- [ ] Chaque ligne montre : nom + version du jeu, les trois emplacements (trier/filtrer/interrupteur) en clair, l'**écart apparié** en titre, le *t*, la pire baisse, le % investi, et les **deux univers** côte à côte.
- [ ] Un **désaccord entre univers** est visuellement signalé (l'un positif, l'autre négatif).
- [ ] La **validation reste masquée** tant qu'aucune cartouche n'a été consommée sur ce jeu ; le compteur de cartouches est affiché.
- [ ] Le **compteur global de jeux testés** est visible sur la page.
- [ ] **Lecture seule** : aucune édition de règle, aucun bouton « mesurer » (c'est le CLI qui mesure).
- [ ] Aucun rendement absolu affiché en position de titre.

## Décisions
- **Lecture seule assumée.** L'éditeur de règles à l'écran est explicitement reporté : il coûte des semaines et retarderait la phase d'exploration, qui est le vrai goulot.
- Les données viennent de `research.measurements` via `tvlite-api` (endpoint en lecture).

## Questions ouvertes
- Emplacement dans l'UI : onglet à part, ou volet à côté de la watchlist ? À trancher au sprint avec un aperçu.

## Plan technique
1. Endpoint lecture `/research/measurements` dans `tvlite-api` (+ backend local). → vérif : renvoie les lignes écrites par #50.
2. Composant tableau (tri, deux univers, cartouches). → vérif : un jeu sans cartouche n'affiche pas la validation.
3. Câblage navigation. → vérif : accessible sans casser le layout existant.

## Notes / risques
- Ne pas dupliquer la logique de calcul côté front : la page **affiche**, elle ne mesure rien.
